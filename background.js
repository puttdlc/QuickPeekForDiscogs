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
 * RESULT SCORING (rankResults)
 * ───────────────────────────────
 * score = (titleOverlap / queryWordCount) × TITLE_OVERLAP_WEIGHT
 *       + min(log10(community.have + community.want + 1), POPULARITY_CAP) × POPULARITY_WEIGHT
 *       + ARTIST_TYPE_BONUS if type === "artist"
 *       + MASTER_TYPE_BONUS if type === "master"
 *       + EXACT_MATCH_BONUS if title tokens exactly equal query tokens
 *
 * Title overlap is the primary signal; popularity only breaks ties so a
 * well-known release beats a niche one that happens to share a few words —
 * it's capped (POPULARITY_CAP) so a viral self-titled album (e.g. "The
 * Beatles") can never outscore the artist entry itself. Stop words are
 * stripped before comparison to reduce false matches. The default weight/bonus
 * constants live in weights.js, and can be overridden per-user from the
 * popup's Advanced Settings screen (stored in chrome.storage.sync).
 */

importScripts("weights.js");

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

// Throws a user-facing message for an invalid token (401) or other non-OK response
function checkResponse(res) {
  if (res.status === 401) throw new Error("Invalid Discogs token. Open the extension popup to update it.");
  if (!res.ok) throw new Error(`Discogs API error: ${res.status}`);
  return res;
}

// Artist handler — fetches profile photo, genres, and top 5 releases sorted by year
async function handleArtist(id, token) {
  const [artistRes, releasesRes] = await Promise.all([
    fetch(`https://api.discogs.com/artists/${id}?token=${token}`),
    fetch(`https://api.discogs.com/artists/${id}/releases?sort=year&sort_order=desc&per_page=50&token=${token}`)
  ]);
  checkResponse(artistRes);
  checkResponse(releasesRes);
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

// Companies/credits/notes/identifiers only exist on the release resource, not the master —
// shared by handleMaster (via main_release) and handleRelease
function extractExtras(data) {
  // description disambiguates otherwise-identical rows, e.g. two "Matrix / Runout"
  // entries labeled "A side runout" vs "B side runout", or a "Price Code" per region
  const allIdentifiers = (data.identifiers || []).map(i => ({
    type: i.type,
    value: i.value,
    description: i.description || null
  }));

  return {
    companies: (data.companies || []).map(c => ({ name: c.name, entityType: c.entity_type_name })),
    credits: (data.extraartists || []).map(a => ({ id: a.id, name: a.name, role: a.role })),
    notes: data.notes || null,
    barcodes: allIdentifiers.filter(i => i.type?.toLowerCase().includes("barcode")),
    identifiers: allIdentifiers.filter(i => !i.type?.toLowerCase().includes("barcode"))
  };
}

// Marketplace/collector stats — num_for_sale and lowest_price live on both master and
// release resources, but have/want/rating (the "community" object) only exist on releases.
// Returns null if nothing came back at all (e.g. the community fetch failed for a master).
function buildStatistics({ numForSale, lowestPrice, community }) {
  const stats = {
    numForSale: numForSale ?? null,
    lowestPrice: lowestPrice ?? null,
    have: community?.have ?? null,
    want: community?.want ?? null,
    ratingAverage: community?.rating?.average ?? null,
    ratingCount: community?.rating?.count ?? null
  };
  return Object.values(stats).some(v => v !== null) ? stats : null;
}

// YouTube link from a resource's "videos" list — masters and releases both carry this.
// When trackTitle is given (track drill-down), prefer a video whose title mentions that
// track over the album's first video.
function extractYoutubeUrl(videos, trackTitle) {
  const ytVideos = (videos || []).filter(v => v.uri && /youtube\.com|youtu\.be/i.test(v.uri));
  if (trackTitle) {
    const match = ytVideos.find(v => v.title?.toLowerCase().includes(trackTitle.toLowerCase()));
    if (match) return match.uri;
  }
  return ytVideos[0]?.uri ?? null;
}

// Master handler — same shape as release but hits /masters/{id}
async function handleMaster(id, token) {
  const res = await fetch(`https://api.discogs.com/masters/${id}?token=${token}`);
  checkResponse(res);
  const data = await res.json();

  // Companies/extraartists/notes/community live on the release level — pull them from
  // the master's primary pressing so those sections have data
  let extras = { companies: [], credits: [], notes: null, barcodes: [], identifiers: [] };
  let community = null;
  let mainVideos = [];
  if (data.main_release_url) {
    try {
      const mainRes = await fetch(`${data.main_release_url}?token=${token}`);
      const mainData = await mainRes.json();
      extras = extractExtras(mainData);
      community = mainData.community;
      mainVideos = mainData.videos || [];
    } catch (_) {}
  }

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
    ...extras,
    masterId: null, // already viewing the master itself
    // The master's own videos list is usually richest, but fall back to its
    // main pressing's videos (already fetched above) if it comes up empty
    youtubeUrl: extractYoutubeUrl(data.videos) ?? extractYoutubeUrl(mainVideos),
    // num_for_sale/lowest_price come from the master itself (aggregated across all pressings)
    statistics: buildStatistics({ numForSale: data.num_for_sale, lowestPrice: data.lowest_price, community }),
    url: data.uri ?? `https://www.discogs.com/master/${id}`
  };
}

// Release handler — fetches cover, metadata, and full tracklist
async function handleRelease(id, token) {
  const res = await fetch(`https://api.discogs.com/releases/${id}?token=${token}`);
  checkResponse(res);
  const data = await res.json();

  // Individual pressings often carry no video credits of their own even when the
  // master they belong to does (videos tend to get attached to whichever version
  // the community actively curates) — fall back to the master's list before giving up
  let youtubeUrl = extractYoutubeUrl(data.videos);
  if (!youtubeUrl && data.master_id) {
    try {
      const masterRes = await fetch(`https://api.discogs.com/masters/${data.master_id}?token=${token}`);
      const masterData = await masterRes.json();
      youtubeUrl = extractYoutubeUrl(masterData.videos);
    } catch (_) {}
  }

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
    ...extractExtras(data),
    masterId: data.master_id || null,
    youtubeUrl,
    statistics: buildStatistics({ numForSale: data.num_for_sale, lowestPrice: data.lowest_price, community: data.community }),
    url: data.uri ?? `https://www.discogs.com/release/${id}`
  };
}

// Track handler — resolves the master release this track belongs to
async function handleTrack(firstResult, token) {
  const masterId = firstResult.master_id;
  const res = await fetch(`https://api.discogs.com/masters/${masterId}?token=${token}`);
  checkResponse(res);
  const data = await res.json();

  let youtubeUrl = extractYoutubeUrl(data.videos, firstResult.title);
  // Fall back to the master's main pressing if the master itself has no videos
  if (!youtubeUrl && data.main_release_url) {
    try {
      const mainRes = await fetch(`${data.main_release_url}?token=${token}`);
      const mainData = await mainRes.json();
      youtubeUrl = extractYoutubeUrl(mainData.videos, firstResult.title);
    } catch (_) {}
  }

  return {
    trackTitle: firstResult.title,
    albumTitle: data.title,
    albumId: masterId,
    albumType: "master",
    artist: data.artists?.[0]?.name ?? null,
    artistId: data.artists?.[0]?.id ?? null,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? firstResult.cover_image,
    youtubeUrl,
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

// Scoring weights (TITLE_OVERLAP_WEIGHT, POPULARITY_WEIGHT, POPULARITY_CAP,
// ARTIST_TYPE_BONUS, MASTER_TYPE_BONUS, EXACT_MATCH_BONUS) live in weights.js
// as WEIGHT_DEFAULTS, and can be overridden per-user via the popup's
// Advanced Settings screen — resolved fresh from storage on each lookup.

// Score and sort all results against the raw query; highest score first.
function rankResults(results, query, weights) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [...results];

  return [...results].map(result => {
    const titleTokens = new Set(tokenize(result.title || ""));
    const overlap = queryTokens.filter(t => titleTokens.has(t)).length;
    const titleScore = overlap / queryTokens.length;

    const popularity = (result.community?.have || 0) + (result.community?.want || 0);
    const popularityScore = Math.min(Math.log10(popularity + 1), weights.POPULARITY_CAP);

    // Artists get a large bonus so they always beat self-titled albums with the same query
    const typeBonus = result.type === "artist" ? weights.ARTIST_TYPE_BONUS : result.type === "master" ? weights.MASTER_TYPE_BONUS : 0;

    // Strong signal: result title tokens exactly equal the query tokens (no extra words).
    // This catches "Snoop Dogg" → artist card (title "Snoop Dogg", 2 tokens = query 2 tokens)
    // over album "Snoop Dogg - Doggystyle" (3 tokens ≠ 2, so no bonus).
    const exactMatchBonus = (titleTokens.size === queryTokens.length && overlap === queryTokens.length) ? weights.EXACT_MATCH_BONUS : 0;

    const score = titleScore * weights.TITLE_OVERLAP_WEIGHT + popularityScore * weights.POPULARITY_WEIGHT + typeBonus + exactMatchBonus;
    return { result, score };
  })
  .sort((a, b) => b.score - a.score)
  .map(({ result }) => result);
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
        checkResponse(searchRes);
        const searchData = await searchRes.json();

        if (!searchData.results?.length) throw new Error("No results found for: " + message.query);

        const storedWeights = await chrome.storage.sync.get(Object.keys(WEIGHT_DEFAULTS));
        const weights = resolveWeights(storedWeights);

        // Rank all 25 results; [0] is the best match, [1-5] become "Or did you mean?" alternatives
        const ranked = rankResults(searchData.results, message.query, weights);
        const firstResult = ranked[0];
        const alternatives = ranked.slice(1, 6).map(r => ({
          id: r.id,
          master_id: r.master_id,
          type: r.type,
          title: r.title,
          thumb: r.thumb,
          year: r.year
        }));
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

        sendResponse({ ok: true, type, data, alternatives });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // Keep the message channel open for the async response
  }
});
