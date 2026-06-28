/*
 * background.js — Service worker for Discogs Quick Peek
 *
 * FLOW
 * ────
 * 1. User selects text and either:
 *    a. Right-clicks → "Search Discogs for …" context menu item, or
 *    b. Releases mouse (mouseup) with Instant Lookup enabled in the popup.
 *    Either path sends a CONTEXT_LOOKUP / LOOKUP message to content.js,
 *    which forwards a LOOKUP message here.
 *
 * 2. LOOKUP handler (bottom of this file):
 *    a. Reads the stored Discogs API token from chrome.storage.sync.
 *    b. Calls the Discogs /database/search endpoint with the raw query,
 *       requesting 25 results.
 *    c. Passes all 25 results through pickBestResult(), which scores each
 *       one by title-word overlap with the query plus community popularity,
 *       returning the best candidate instead of blindly taking results[0].
 *    d. Branches on the winning result's type (artist / track / master /
 *       release) and calls the appropriate handler below.
 *    e. Sends { ok: true, type, data } back to content.js, which renders
 *       the tooltip.
 *
 * HANDLERS
 * ────────
 * handleArtist  — /artists/{id} + /artists/{id}/releases
 *                 Returns name, profile photo, genre tags, and top-5
 *                 releases sorted by year descending.
 *
 * handleMaster  — /masters/{id}
 *                 Returns title, year, cover art, and full tracklist.
 *                 "Master" is Discogs's canonical grouping of a release
 *                 across all pressings/formats.
 *
 * handleRelease — /releases/{id}
 *                 Same shape as master but for a specific pressing, so it
 *                 also carries the format (Vinyl, CD, etc.).
 *
 * handleTrack   — /masters/{master_id} (resolved from the search result)
 *                 Returns the individual track title alongside its parent
 *                 album's cover, title, and artist.
 *
 * RESULT SCORING (pickBestResult)
 * ───────────────────────────────
 * score = (titleOverlap / queryWordCount) × 3
 *       + log10(community.have + community.want + 1) × 0.5
 *       + 0.3 if type === "master"
 *
 * Title overlap is the primary signal; popularity breaks ties so a
 * well-known release beats a niche one that happens to share a few words.
 * Stop words are stripped before comparison to reduce false matches.
 */

// Right-click context menu registration
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "discogs-lookup",
    title: 'Search Discogs for "%s"',
    contexts: ["selection"]
  });
});

// Forward context menu click to content script
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "discogs-lookup" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: "CONTEXT_LOOKUP",
      query: info.selectionText.trim()
    });
  }
});

// Artist handler — fetches profile photo, genres, and top 5 releases sorted by year
async function handleArtist(id, token) {
  const [artistRes, releasesRes] = await Promise.all([
    fetch(`https://api.discogs.com/artists/${id}?token=${token}`),
    fetch(`https://api.discogs.com/artists/${id}/releases?sort=year&sort_order=desc&per_page=50&token=${token}`)
  ]);
  const [artistData, releasesData] = await Promise.all([
    artistRes.json(),
    releasesRes.json()
  ]);

  // Client-side sort as a safety net since the API sort isn't always stable
  const allReleases = releasesData.releases || [];
  const releases = allReleases
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 5)
    .map(r => ({ id: r.id, type: r.type, title: r.title, year: r.year, coverThumb: r.thumb }));

  // Genres live on releases, not on the artist — pull from the first available entry
  let genres = [];
  const firstRelease = allReleases.find(r => r.resource_url);
  if (firstRelease) {
    try {
      const genreRes = await fetch(`${firstRelease.resource_url}?token=${token}`);
      const genreData = await genreRes.json();
      genres = genreData.genres || [];
    } catch (_) {}
  }

  return {
    name: artistData.name,
    artistThumb: artistData.images?.[0]?.uri ?? null,
    genres,
    url: artistData.uri ?? `https://www.discogs.com/artist/${id}`,
    releases
  };
}

// Master handler — same shape as release but hits /masters/{id}
async function handleMaster(id, token) {
  const res = await fetch(`https://api.discogs.com/masters/${id}?token=${token}`);
  const data = await res.json();
  return {
    id: data.id,
    itemType: "master",
    title: data.title,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? null,
    format: null,
    artists: (data.artists || []).map(a => ({ id: a.id, name: a.name })),
    tracklist: (data.tracklist || []).map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration
    })),
    url: data.uri ?? `https://www.discogs.com/master/${id}`
  };
}

// Release handler — fetches cover, metadata, and full tracklist
async function handleRelease(id, token) {
  const res = await fetch(`https://api.discogs.com/releases/${id}?token=${token}`);
  const data = await res.json();
  return {
    id: data.id,
    itemType: "release",
    title: data.title,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? data.thumb,
    format: data.formats?.[0]?.name ?? null,
    artists: (data.artists || []).map(a => ({ id: a.id, name: a.name })),
    tracklist: (data.tracklist || []).map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration
    })),
    url: data.uri ?? `https://www.discogs.com/release/${id}`
  };
}

// Track handler — resolves the master release this track belongs to
async function handleTrack(firstResult, token) {
  const masterId = firstResult.master_id;
  const res = await fetch(`https://api.discogs.com/masters/${masterId}?token=${token}`);
  const data = await res.json();
  return {
    trackTitle: firstResult.title,
    albumTitle: data.title,
    albumId: masterId,
    albumType: "master",
    artist: data.artists?.[0]?.name ?? null,
    artistId: data.artists?.[0]?.id ?? null,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? firstResult.cover_image,
    url: data.uri ?? `https://www.discogs.com/master/${masterId}`
  };
}

// Words that add noise to title matching — filtered before scoring
const STOP_WORDS = new Set(["the","a","an","and","or","of","in","on","at","to","for","with","by","from","is","it","as","s"]);

function tokenize(str) {
  return str.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

// Score each result against the raw query; higher = better match.
// Combines title word overlap (most important) with community popularity
// so a well-known release beats a niche one with a few matching words.
function pickBestResult(results, query) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return results[0];

  let best = results[0];
  let bestScore = -Infinity;

  for (const result of results) {
    const titleTokens = new Set(tokenize(result.title || ""));
    const overlap = queryTokens.filter(t => titleTokens.has(t)).length;
    const titleScore = overlap / queryTokens.length;

    const popularity = (result.community?.have || 0) + (result.community?.want || 0);
    const popularityScore = Math.log10(popularity + 1);

    // Artists first, then masters as canonical release entries
    const typeBonus = result.type === "artist" ? 1.0 : result.type === "master" ? 0.3 : 0;

    // Strong signal: result title tokens exactly equal the query tokens (no extra words).
    // This catches "Snoop Dogg" → artist card (title "Snoop Dogg", 2 tokens = query 2 tokens)
    // over album "Snoop Dogg - Doggystyle" (3 tokens ≠ 2, so no bonus).
    const exactMatchBonus = (titleTokens.size === queryTokens.length && overlap === queryTokens.length) ? 2.0 : 0;

    const score = titleScore * 3 + popularityScore * 0.5 + typeBonus + exactMatchBonus;
    if (score > bestScore) { bestScore = score; best = result; }
  }

  return best;
}

// Main message listener — searches Discogs, detects result type, delegates to handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOOKUP_BY_ID") {
    (async () => {
      try {
        const { token } = await chrome.storage.sync.get("token");
        if (!token) throw new Error("No Discogs token set. Open the extension popup to add one.");
        let type, data;
        if (message.itemType === "artist") {
          type = "artist";
          data = await handleArtist(message.id, token);
        } else if (message.itemType === "master") {
          type = "release";
          data = await handleMaster(message.id, token);
        } else {
          type = "release";
          data = await handleRelease(message.id, token);
        }
        sendResponse({ ok: true, type, data });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === "LOOKUP") {
    (async () => {
      try {
        const { token } = await chrome.storage.sync.get("token");
        if (!token) throw new Error("No Discogs token set. Open the extension popup to add one.");

        const searchRes = await fetch(
          `https://api.discogs.com/database/search?q=${encodeURIComponent(message.query)}&per_page=25&token=${token}`
        );
        if (!searchRes.ok) throw new Error(`Discogs API error: ${searchRes.status}`);
        const searchData = await searchRes.json();

        if (!searchData.results?.length) throw new Error("No results found for: " + message.query);

        // Rank the top 25 results by title overlap + popularity
        const firstResult = pickBestResult(searchData.results, message.query);
        let type, data;

        if (firstResult.type === "artist") {
          type = "artist";
          data = await handleArtist(firstResult.id, token);
        } else if (firstResult.type === "track") {
          type = "track";
          data = await handleTrack(firstResult, token);
        } else if (firstResult.type === "master") {
          // "master" is the canonical release entry — needs its own endpoint
          type = "release";
          data = await handleMaster(firstResult.id, token);
        } else {
          type = "release";
          data = await handleRelease(firstResult.id, token);
        }

        sendResponse({ ok: true, type, data });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // Keep the message channel open for the async response
  }
});
