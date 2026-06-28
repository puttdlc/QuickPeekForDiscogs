async function getAlbumCover(query, token) {
  const searchRes = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&token=${token}`
  );
  const searchData = await searchRes.json();
  const firstResult = searchData.results[0];

  const releaseRes = await fetch(
    `https://api.discogs.com/releases/${firstResult.id}?token=${token}`
  );
  const releaseData = await releaseRes.json();

  return {
    title: firstResult.title,
    year: firstResult.year,
    coverThumb: firstResult.cover_image,
    coverFull: releaseData.images[0].uri,
    url: `https://www.discogs.com${firstResult.uri}`
  };
}

// This is what content.js calls into
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOOKUP") {
    chrome.storage.sync.get("token", async ({ token }) => {
      const result = await getAlbumCover(message.query, token);
      sendResponse(result);
    });
    return true; // keeps the message channel open for async response
  }
});