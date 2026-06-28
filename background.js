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
    .map(r => ({ title: r.title, year: r.year, coverThumb: r.thumb }));

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
    url: artistData.uri ? `https://www.discogs.com${artistData.uri}` : `https://www.discogs.com/artist/${id}`,
    releases
  };
}

// Master handler — same shape as release but hits /masters/{id}
async function handleMaster(id, token) {
  const res = await fetch(`https://api.discogs.com/masters/${id}?token=${token}`);
  const data = await res.json();
  return {
    title: data.title,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? null,
    format: null,
    tracklist: (data.tracklist || []).map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration
    })),
    url: data.uri ? `https://www.discogs.com${data.uri}` : `https://www.discogs.com/master/${id}`
  };
}

// Release handler — fetches cover, metadata, and full tracklist
async function handleRelease(id, token) {
  const res = await fetch(`https://api.discogs.com/releases/${id}?token=${token}`);
  const data = await res.json();
  return {
    title: data.title,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? data.thumb,
    format: data.formats?.[0]?.name ?? null,
    tracklist: (data.tracklist || []).map(t => ({
      position: t.position,
      title: t.title,
      duration: t.duration
    })),
    url: data.uri ? `https://www.discogs.com${data.uri}` : `https://www.discogs.com/release/${id}`
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
    artist: data.artists?.[0]?.name ?? null,
    year: data.year,
    coverThumb: data.images?.[0]?.uri ?? firstResult.cover_image,
    url: data.uri ? `https://www.discogs.com${data.uri}` : `https://www.discogs.com/master/${masterId}`
  };
}

// Main message listener — searches Discogs, detects result type, delegates to handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOOKUP") {
    (async () => {
      try {
        const { token } = await chrome.storage.sync.get("token");
        if (!token) throw new Error("No Discogs token set. Open the extension popup to add one.");

        // Search without a type filter so Discogs returns its best match
        const searchRes = await fetch(
          `https://api.discogs.com/database/search?q=${encodeURIComponent(message.query)}&token=${token}`
        );
        if (!searchRes.ok) throw new Error(`Discogs API error: ${searchRes.status}`);
        const searchData = await searchRes.json();

        if (!searchData.results?.length) throw new Error("No results found for: " + message.query);

        // Branch on what Discogs identified the top result as
        const firstResult = searchData.results[0];
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
