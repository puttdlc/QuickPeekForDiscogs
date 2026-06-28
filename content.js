// Active tooltip, loader, and navigation state
let tooltip = null;
let loader = null;
let navStack = [];
let currentTooltipData = null;

// All injected styles for tooltip, loader, and layout variants
const style = document.createElement("style");
style.textContent = `
  /* Tooltip card — dark floating panel */
  .dqp-tooltip {
    position: fixed;
    z-index: 9999;
    background: #1a1a1a;
    color: #f0f0f0;
    border: 1px solid #444;
    border-radius: 10px;
    width: 200px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    font-family: sans-serif;
    font-size: 14px;
    cursor: default;
    opacity: 0;
    transform: scale(0.95);
    transition: opacity 0.15s ease, transform 0.2s ease, width 0.2s ease, box-shadow 0.2s ease;
  }
  /* Inner scroll wrapper — keeps content scrollable without background bleed */
  .dqp-scroll-inner {
    max-height: 360px;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px;
  }
  /* Bouncy pop-in animation */
  .dqp-tooltip.visible {
    opacity: 1;
    transform: scale(1);
  }
  /* Hover expand — slightly wider with deeper shadow */
  .dqp-tooltip:hover {
    width: 240px;
    box-shadow: 0 6px 28px rgba(0,0,0,0.65);
  }
  /* Fade-out shrink on dismiss */
  .dqp-tooltip.fading {
    opacity: 0;
    transform: scale(0.95);
    pointer-events: none;
  }
  /* Cover / artist photo — full width with rounded corners */
  .dqp-tooltip img {
    width: 100%;
    border-radius: 6px;
    display: block;
    margin-bottom: 8px;
  }
  /* Bold title line */
  .dqp-tooltip .dqp-title {
    font-weight: bold;
  }
  /* Muted subtitle (year, format, artist name) */
  .dqp-tooltip .dqp-year {
    color: #aaa;
    margin-top: 2px;
  }
  /* "View on Discogs" link */
  .dqp-tooltip a {
    display: block;
    margin-top: 8px;
    color: #4a9eff;
    text-decoration: none;
    font-size: 13px;
  }

  /* Back navigation header — hidden until user drills in */
  .dqp-nav {
    display: none;
    align-items: center;
    padding: 5px 8px;
    border-bottom: 1px solid #333;
    background: #222;
  }
  .dqp-back-btn {
    background: none;
    border: none;
    color: #aaa;
    font-size: 12px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: sans-serif;
  }
  .dqp-back-btn:hover {
    color: #f3a125;
  }

  /* Clickable items inside the tooltip */
  .dqp-clickable {
    cursor: pointer;
    transition: color 0.12s;
  }
  .dqp-clickable:hover {
    color: #f3a125 !important;
  }

  /* Artist release list — stacked rows of thumbnail + title + year */
  .dqp-release-list {
    margin-top: 8px;
  }
  .dqp-release-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
    border-top: 1px solid #333;
    border-radius: 4px;
    transition: background 0.12s;
  }
  .dqp-release-row:first-child {
    border-top: none;
    padding-top: 0;
  }
  .dqp-release-row.dqp-clickable:hover {
    background: #252525;
    padding-left: 4px;
    padding-right: 4px;
    margin: 0 -4px;
  }
  /* Small square album thumbnail inside a release row */
  .dqp-tooltip .dqp-release-thumb {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
    margin-bottom: 0;
  }
  .dqp-release-info .dqp-title {
    font-size: 12px;
  }
  .dqp-release-info .dqp-year {
    font-size: 11px;
    margin-top: 1px;
  }

  /* Tracklist rows — position number, track title, duration */
  .dqp-tracklist {
    margin-top: 8px;
    font-size: 12px;
  }
  .dqp-track {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 3px 2px;
    border-radius: 3px;
    transition: background 0.12s;
  }
  .dqp-track.dqp-clickable:hover {
    background: #252525;
  }
  .dqp-track-pos {
    color: #888;
    min-width: 18px;
    flex-shrink: 0;
    font-size: 11px;
    text-align: right;
  }
  /* Track title truncates if too long for the panel width */
  .dqp-track-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dqp-track-dur {
    color: #888;
    font-size: 11px;
    flex-shrink: 0;
  }

  /* Album title line used in the track layout */
  .dqp-album-title {
    font-size: 13px;
    color: #ccc;
    margin-top: 4px;
  }

  /* In-tooltip loading spinner while drill-down fetches */
  .dqp-loading-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
  }
  .dqp-loading-inner::after {
    content: "";
    width: 20px;
    height: 20px;
    border: 2px solid #444;
    border-top-color: #f3a125;
    border-radius: 50%;
    animation: dqp-spin 0.7s linear infinite;
  }

  /* Rolling circle loading indicator */
  .dqp-loader {
    position: fixed;
    z-index: 9999;
    width: 32px;
    height: 32px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 50%;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
  }
  .dqp-loader.visible {
    opacity: 1;
  }
  /* Orange spinning arc inside the loader circle */
  .dqp-loader::after {
    content: "";
    position: absolute;
    inset: 6px;
    border: 2px solid #444;
    border-top-color: #f3a125;
    border-radius: 50%;
    animation: dqp-spin 0.7s linear infinite;
  }
  @keyframes dqp-spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Spawn the loader dot near the cursor
function showLoader(x, y) {
  removeLoader();
  loader = document.createElement("div");
  loader.className = "dqp-loader";
  loader.style.left = `${x + 12}px`;
  loader.style.top = `${y + 12}px`;
  document.body.appendChild(loader);
  requestAnimationFrame(() => loader?.classList.add("visible"));
}

// Fade the loader out and remove it from the DOM
function removeLoader() {
  if (!loader) return;
  const el = loader;
  el.classList.remove("visible");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  loader = null;
}

// Hard-remove tooltip instantly (used before placing a new one)
function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
  navStack = [];
  currentTooltipData = null;
}

// Animated dismiss — shrinks and fades before removing from DOM
function fadeOut() {
  removeLoader();
  if (!tooltip) return;
  const el = tooltip;
  el.classList.add("fading");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  tooltip = null;
  navStack = [];
  currentTooltipData = null;
}

// Artist layout — profile photo, name header, scrollable release list
function buildArtistLayout(data) {
  const frag = document.createDocumentFragment();

  if (data.artistThumb) {
    const img = document.createElement("img");
    img.src = data.artistThumb;
    frag.appendChild(img);
  }

  const header = document.createElement("div");
  header.className = "dqp-title";
  header.textContent = data.name;
  frag.appendChild(header);

  if (data.genres?.length) {
    const genres = document.createElement("div");
    genres.className = "dqp-year";
    genres.textContent = data.genres.join(", ");
    frag.appendChild(genres);
  }

  const list = document.createElement("div");
  list.className = "dqp-release-list";
  data.releases.forEach(release => {
    const row = document.createElement("div");
    row.className = "dqp-release-row" + (release.id ? " dqp-clickable" : "");
    if (release.id) {
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        performDrillDownById(release.id, release.type === "master" ? "master" : "release");
      });
    }

    if (release.coverThumb) {
      const img = document.createElement("img");
      img.src = release.coverThumb;
      img.className = "dqp-release-thumb";
      row.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "dqp-release-info";

    const title = document.createElement("div");
    title.className = "dqp-title";
    title.textContent = release.title;
    info.appendChild(title);

    if (release.year) {
      const year = document.createElement("div");
      year.className = "dqp-year";
      year.textContent = release.year;
      info.appendChild(year);
    }

    row.appendChild(info);
    list.appendChild(row);
  });
  frag.appendChild(list);

  return frag;
}

// Release layout — cover art, title, year + format, artists, full tracklist
function buildReleaseLayout(data) {
  const frag = document.createDocumentFragment();

  if (data.coverThumb) {
    const img = document.createElement("img");
    img.src = data.coverThumb;
    frag.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "dqp-title";
  title.textContent = data.title;
  frag.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "dqp-year";
  meta.textContent = [data.year, data.format].filter(Boolean).join(" · ");
  frag.appendChild(meta);

  // Artist names — each individually clickable
  if (data.artists?.length) {
    const artistsEl = document.createElement("div");
    artistsEl.className = "dqp-year";
    artistsEl.style.marginTop = "4px";
    data.artists.forEach((artist, i) => {
      if (i > 0) artistsEl.appendChild(document.createTextNode(", "));
      const span = document.createElement("span");
      span.className = "dqp-clickable";
      span.textContent = artist.name;
      if (artist.id) {
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          performDrillDownById(artist.id, "artist");
        });
      }
      artistsEl.appendChild(span);
    });
    frag.appendChild(artistsEl);
  }

  if (data.tracklist?.length) {
    const tracklist = document.createElement("div");
    tracklist.className = "dqp-tracklist";
    data.tracklist.forEach(track => {
      const row = document.createElement("div");
      row.className = "dqp-track dqp-clickable";
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        drillDown({
          type: "track",
          trackTitle: track.title,
          albumTitle: data.title,
          albumId: data.id,
          albumType: data.itemType || "release",
          artist: data.artists?.[0]?.name ?? null,
          artistId: data.artists?.[0]?.id ?? null,
          year: data.year,
          coverThumb: data.coverThumb,
          url: data.url
        });
      });

      const pos = document.createElement("span");
      pos.className = "dqp-track-pos";
      pos.textContent = track.position || "";
      row.appendChild(pos);

      const name = document.createElement("span");
      name.className = "dqp-track-title";
      name.textContent = track.title;
      row.appendChild(name);

      if (track.duration) {
        const dur = document.createElement("span");
        dur.className = "dqp-track-dur";
        dur.textContent = track.duration;
        row.appendChild(dur);
      }

      tracklist.appendChild(row);
    });
    frag.appendChild(tracklist);
  }

  return frag;
}

// Track layout — song title, parent album cover, album name (clickable), artist (clickable)
function buildTrackLayout(data) {
  const frag = document.createDocumentFragment();

  const trackTitle = document.createElement("div");
  trackTitle.className = "dqp-title";
  trackTitle.textContent = data.trackTitle;
  frag.appendChild(trackTitle);

  if (data.coverThumb) {
    const img = document.createElement("img");
    img.src = data.coverThumb;
    frag.appendChild(img);
  }

  if (data.albumTitle) {
    const albumTitle = document.createElement("div");
    albumTitle.className = "dqp-album-title dqp-clickable";
    albumTitle.textContent = data.albumTitle;
    albumTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      // If we navigated here from an album, just go back rather than re-fetching
      if (navStack.length > 0) {
        goBack();
      } else if (data.albumId) {
        performDrillDownById(data.albumId, data.albumType || "master");
      }
    });
    frag.appendChild(albumTitle);
  }

  if (data.artist) {
    const artist = document.createElement("div");
    artist.className = "dqp-year dqp-clickable";
    artist.textContent = data.artist;
    artist.addEventListener("click", (e) => {
      e.stopPropagation();
      if (data.artistId) {
        performDrillDownById(data.artistId, "artist");
      } else {
        performDrillDownSearch(data.artist);
      }
    });
    frag.appendChild(artist);
  }

  return frag;
}

// Render content into the existing tooltip's scroll area; update nav visibility
function renderContent(typeAndData) {
  currentTooltipData = typeAndData;

  const nav = tooltip.querySelector(".dqp-nav");
  nav.style.display = navStack.length > 0 ? "flex" : "none";

  const scrollInner = tooltip.querySelector(".dqp-scroll-inner");
  scrollInner.innerHTML = "";

  let content;
  if (typeAndData.type === "artist") {
    content = buildArtistLayout(typeAndData);
  } else if (typeAndData.type === "track") {
    content = buildTrackLayout(typeAndData);
  } else {
    content = buildReleaseLayout(typeAndData);
  }
  scrollInner.appendChild(content);

  if (typeAndData.url) {
    const link = document.createElement("a");
    link.href = typeAndData.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on Discogs →";
    scrollInner.appendChild(link);
  }

  scrollInner.scrollTop = 0;
}

// Push current view onto the stack and render new data
function drillDown(newData) {
  navStack.push(currentTooltipData);
  renderContent(newData);
}

// Pop the stack and return to the previous view
function goBack() {
  if (!navStack.length) return;
  const prev = navStack.pop();
  renderContent(prev);
}

// Show a spinner inside the tooltip while fetching, then drill into the result
function performDrillDownSearch(query) {
  const scrollInner = tooltip.querySelector(".dqp-scroll-inner");
  scrollInner.innerHTML = '<div class="dqp-loading-inner"></div>';
  chrome.runtime.sendMessage({ type: "LOOKUP", query }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) return;
    drillDown({ type: response.type, ...response.data });
  });
}

function performDrillDownById(id, itemType) {
  const scrollInner = tooltip.querySelector(".dqp-scroll-inner");
  scrollInner.innerHTML = '<div class="dqp-loading-inner"></div>';
  chrome.runtime.sendMessage({ type: "LOOKUP_BY_ID", id, itemType }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) return;
    drillDown({ type: response.type, ...response.data });
  });
}

// Build and position the tooltip, branching on result type
function showTooltip(data, x, y) {
  removeTooltip();

  tooltip = document.createElement("div");
  tooltip.className = "dqp-tooltip";

  // Back navigation header (hidden until the user drills in)
  const nav = document.createElement("div");
  nav.className = "dqp-nav";
  const backBtn = document.createElement("button");
  backBtn.className = "dqp-back-btn";
  backBtn.textContent = "← Back";
  backBtn.addEventListener("click", (e) => { e.stopPropagation(); goBack(); });
  nav.appendChild(backBtn);
  tooltip.appendChild(nav);

  const scrollInner = document.createElement("div");
  scrollInner.className = "dqp-scroll-inner";
  tooltip.appendChild(scrollInner);

  document.body.appendChild(tooltip);

  renderContent(data);

  // Viewport boundary check — flip to left or up if it would overflow
  const rect = tooltip.getBoundingClientRect();
  let left = x + 12;
  let top = y + 12;
  if (left + rect.width > window.innerWidth) left = x - rect.width - 12;
  if (top + rect.height > window.innerHeight) top = y - rect.height - 12;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  // Trigger pop-in animation on next frame
  requestAnimationFrame(() => tooltip?.classList.add("visible"));
}

// Track last right-click position for context menu lookups
let lastRightClickPos = { x: 0, y: 0 };

// Kick off a lookup — shows loader while waiting, then swaps in tooltip
function performLookup(query, x, y) {
  removeTooltip();
  showLoader(x, y);
  chrome.runtime.sendMessage({ type: "LOOKUP", query }, (response) => {
    removeLoader();
    if (chrome.runtime.lastError || !response?.ok) return;
    showTooltip({ type: response.type, ...response.data }, x, y);
  });
}

// Record cursor position on right-click for context menu placement
document.addEventListener("contextmenu", (e) => {
  lastRightClickPos = { x: e.clientX, y: e.clientY };
});

// Instant lookup on text selection (if the setting is enabled)
document.addEventListener("mouseup", (e) => {
  // Never treat clicks inside the tooltip as "lost selection" — those are navigation actions
  if (tooltip && tooltip.contains(e.target)) return;

  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) {
    removeTooltip();
    return;
  }

  chrome.storage.sync.get("instantLookup", ({ instantLookup }) => {
    if (instantLookup) performLookup(selectedText, e.clientX, e.clientY);
  });
});

// Handle lookup triggered from the right-click context menu
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONTEXT_LOOKUP") {
    performLookup(message.query, lastRightClickPos.x, lastRightClickPos.y);
  }
});

// Click outside tooltip closes it
document.addEventListener("mousedown", (e) => {
  if (tooltip && !tooltip.contains(e.target)) removeTooltip();
});

// Page scroll closes tooltip — but scrolling inside the tooltip itself is allowed
window.addEventListener("scroll", (e) => {
  if (tooltip?.contains(e.target)) return;
  fadeOut();
}, { capture: true, passive: true });
