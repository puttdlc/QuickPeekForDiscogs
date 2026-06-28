// Active tooltip and loader element references
let tooltip = null;
let loader = null;

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
  }
  .dqp-release-row:first-child {
    border-top: none;
    padding-top: 0;
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
    padding: 2px 0;
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
}

// Animated dismiss — shrinks and fades before removing from DOM
function fadeOut() {
  removeLoader();
  if (!tooltip) return;
  const el = tooltip;
  el.classList.add("fading");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  tooltip = null;
}

// Artist layout — profile photo, name header, scrollable release list
function buildArtistLayout(data) {
  const frag = document.createDocumentFragment();

  // Artist PFP image
  if (data.artistThumb) {
    const img = document.createElement("img");
    img.src = data.artistThumb;
    frag.appendChild(img);
  }

  // Artist name header
  const header = document.createElement("div");
  header.className = "dqp-title";
  header.textContent = data.name;
  frag.appendChild(header);

  // Genre tags under the name
  if (data.genres?.length) {
    const genres = document.createElement("div");
    genres.className = "dqp-year";
    genres.textContent = data.genres.join(", ");
    frag.appendChild(genres);
  }

  // Release rows — album art thumbnail + title + year
  const list = document.createElement("div");
  list.className = "dqp-release-list";
  data.releases.forEach(release => {
    const row = document.createElement("div");
    row.className = "dqp-release-row";

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

// Release layout — cover art, title, year + format, full tracklist
function buildReleaseLayout(data) {
  const frag = document.createDocumentFragment();

  // Album cover art
  if (data.coverThumb) {
    const img = document.createElement("img");
    img.src = data.coverThumb;
    frag.appendChild(img);
  }

  // Release title
  const title = document.createElement("div");
  title.className = "dqp-title";
  title.textContent = data.title;
  frag.appendChild(title);

  // Year and format on one line, e.g. "1973 · Vinyl"
  const meta = document.createElement("div");
  meta.className = "dqp-year";
  meta.textContent = [data.year, data.format].filter(Boolean).join(" · ");
  frag.appendChild(meta);

  // Numbered tracklist
  if (data.tracklist?.length) {
    const tracklist = document.createElement("div");
    tracklist.className = "dqp-tracklist";
    data.tracklist.forEach(track => {
      const row = document.createElement("div");
      row.className = "dqp-track";

      // Track position number
      const pos = document.createElement("span");
      pos.className = "dqp-track-pos";
      pos.textContent = track.position || "";
      row.appendChild(pos);

      // Track name
      const name = document.createElement("span");
      name.className = "dqp-track-title";
      name.textContent = track.title;
      row.appendChild(name);

      // Duration (optional — not all releases have it)
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

// Track layout — song title, parent album cover, album name, artist
function buildTrackLayout(data) {
  const frag = document.createDocumentFragment();

  // Track name as the main heading
  const trackTitle = document.createElement("div");
  trackTitle.className = "dqp-title";
  trackTitle.textContent = data.trackTitle;
  frag.appendChild(trackTitle);

  // Parent album cover art
  if (data.coverThumb) {
    const img = document.createElement("img");
    img.src = data.coverThumb;
    frag.appendChild(img);
  }

  // Parent album title
  const albumTitle = document.createElement("div");
  albumTitle.className = "dqp-album-title";
  albumTitle.textContent = data.albumTitle;
  frag.appendChild(albumTitle);

  // Artist name in muted text
  if (data.artist) {
    const artist = document.createElement("div");
    artist.className = "dqp-year";
    artist.textContent = data.artist;
    frag.appendChild(artist);
  }

  return frag;
}

// Build and position the tooltip, branching on result type
function showTooltip(data, x, y) {
  removeTooltip();

  tooltip = document.createElement("div");
  tooltip.className = "dqp-tooltip";

  const scrollInner = document.createElement("div");
  scrollInner.className = "dqp-scroll-inner";

  // Pick the right layout based on what Discogs identified
  let content;
  if (data.type === "artist") {
    content = buildArtistLayout(data);
  } else if (data.type === "track") {
    content = buildTrackLayout(data);
  } else {
    content = buildReleaseLayout(data);
  }
  scrollInner.appendChild(content);

  // "View on Discogs" link at the bottom of every layout
  const link = document.createElement("a");
  link.href = data.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View on Discogs →";
  scrollInner.appendChild(link);

  tooltip.appendChild(scrollInner);

  document.body.appendChild(tooltip);

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
