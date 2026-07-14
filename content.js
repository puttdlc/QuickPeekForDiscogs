// Active tooltip, loader, and navigation state
let tooltip = null;
let loader = null;
let navStack = [];
let currentTooltipData = null;
let currentAlternatives = null;

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
  /* Row pairing a title with its YouTube button */
  .dqp-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dqp-title-row .dqp-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* YouTube button — overrides the generic block/margin styling every other <a> gets below */
  .dqp-tooltip a.dqp-youtube-btn {
    display: inline-flex;
    align-items: center;
    margin-top: 0;
    flex-shrink: 0;
    opacity: 0.85;
    transition: opacity 0.12s, transform 0.12s;
  }
  .dqp-tooltip a.dqp-youtube-btn:hover {
    opacity: 1;
    transform: scale(1.08);
  }
  .dqp-tooltip .dqp-youtube-btn img {
    width: 20px;
    height: 14px;
    display: block;
    margin-bottom: 0;
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

  /* "Or did you mean?" alternatives section */
  .dqp-alternatives {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #2a2a2a;
  }
  .dqp-alt-header {
    font-size: 10px;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 5px;
  }
  .dqp-alt-row {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 3px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .dqp-alt-row:hover {
    background: #252525;
  }
  .dqp-tooltip .dqp-alt-thumb {
    width: 30px;
    height: 30px;
    object-fit: cover;
    border-radius: 3px;
    flex-shrink: 0;
    margin-bottom: 0;
  }
  .dqp-alt-info {
    flex: 1;
    overflow: hidden;
  }
  .dqp-alt-title {
    font-size: 11px;
    color: #ccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dqp-alt-meta {
    font-size: 10px;
    color: #555;
    margin-top: 1px;
  }

  /* Collapsible metadata sections (Master / Artists / Companies / Credits / Notes) */
  .dqp-section {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #2a2a2a;
  }
  .dqp-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 0;
  }
  .dqp-section-chevron {
    display: inline-block;
    font-size: 9px;
    width: 8px;
    transition: transform 0.15s;
  }
  .dqp-section.dqp-expanded .dqp-section-chevron {
    transform: rotate(90deg);
  }
  .dqp-section-body {
    display: none;
    margin-top: 6px;
    font-size: 12px;
  }
  .dqp-section.dqp-expanded .dqp-section-body {
    display: block;
  }
  .dqp-info-row {
    padding: 3px 0;
    color: #ccc;
  }
  .dqp-notes-text {
    color: #bbb;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  /* Warning message shown when the token is missing/invalid or a lookup fails */
  .dqp-error-message {
    color: #f3a125;
    font-size: 13px;
    line-height: 1.4;
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
  currentAlternatives = null;
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
  currentAlternatives = null;
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

// Small YouTube link button, placed beside a title when a video is available.
// Loads the icon from svg/youtube.svg (declared web-accessible in manifest.json)
// since this content script runs in the host page's origin, not the extension's.
function buildYoutubeButton(url) {
  const btn = document.createElement("a");
  btn.href = url;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.className = "dqp-youtube-btn";
  btn.title = "Watch on YouTube";

  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("svg/youtube.svg");
  icon.alt = "YouTube";
  btn.appendChild(icon);

  btn.addEventListener("click", (e) => e.stopPropagation());
  return btn;
}

// Wraps a title element with an optional YouTube button to its right
function buildTitleRow(titleEl, youtubeUrl) {
  const row = document.createElement("div");
  row.className = "dqp-title-row";
  row.appendChild(titleEl);
  if (youtubeUrl) {
    row.appendChild(buildYoutubeButton(youtubeUrl));
  }
  return row;
}

// Strip Discogs' bracket markup (artist/label refs, bold/italic/url tags) from free-text notes
function cleanDiscogsMarkup(text) {
  return text
    .replace(/\[(?:a|l|r|m|v)=([^\]]*)\]/gi, "$1")
    .replace(/\[\/?(?:b|i|u)\]/gi, "")
    .replace(/\[url(?:=[^\]]*)?\]/gi, "")
    .replace(/\[\/url\]/gi, "")
    .trim();
}

// Collapsed-by-default section — header toggles the body open/closed on click
function buildSection(title, contentEl) {
  const section = document.createElement("div");
  section.className = "dqp-section";

  const header = document.createElement("div");
  header.className = "dqp-section-header dqp-clickable";

  const chevron = document.createElement("span");
  chevron.className = "dqp-section-chevron";
  chevron.textContent = "▸";
  header.appendChild(chevron);

  const label = document.createElement("span");
  label.textContent = title;
  header.appendChild(label);

  header.addEventListener("click", (e) => {
    e.stopPropagation();
    section.classList.toggle("dqp-expanded");
  });

  const body = document.createElement("div");
  body.className = "dqp-section-body";
  body.appendChild(contentEl);

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

// Single clickable row that jumps to the master release
function buildMasterSectionContent(masterId) {
  const row = document.createElement("div");
  row.className = "dqp-info-row dqp-clickable";
  row.textContent = "View Master Release →";
  row.addEventListener("click", (e) => {
    e.stopPropagation();
    performDrillDownById(masterId, "master");
  });
  return row;
}

// One row per artist, each clickable to drill into that artist's page
function buildArtistsSectionContent(artists) {
  const frag = document.createDocumentFragment();
  artists.forEach(artist => {
    const row = document.createElement("div");
    row.className = "dqp-info-row" + (artist.id ? " dqp-clickable" : "");
    row.textContent = artist.name;
    if (artist.id) {
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        performDrillDownById(artist.id, "artist");
      });
    }
    frag.appendChild(row);
  });
  return frag;
}

// One row per company/label credit (pressing plant, distributor, copyright holder, etc.)
function buildCompaniesSectionContent(companies) {
  const frag = document.createDocumentFragment();
  companies.forEach(c => {
    const row = document.createElement("div");
    row.className = "dqp-info-row";
    row.textContent = c.entityType ? `${c.name} — ${c.entityType}` : c.name;
    frag.appendChild(row);
  });
  return frag;
}

// A single identifier row — description disambiguates rows that would otherwise
// look identical, e.g. "Matrix / Runout: PB 41447 A2 (A side runout, variant 1)"
function buildIdentifierRow(entry) {
  const row = document.createElement("div");
  row.className = "dqp-info-row";
  const label = entry.type ? `${entry.type}: ${entry.value}` : entry.value;
  row.textContent = entry.description ? `${label} (${entry.description})` : label;
  return row;
}

// One row per barcode variant (a release can carry more than one, e.g. per-region pressings)
function buildBarcodeSectionContent(barcodes) {
  const frag = document.createDocumentFragment();
  barcodes.forEach(b => frag.appendChild(buildIdentifierRow(b)));
  return frag;
}

// One row per non-barcode identifier (matrix/runout, label code, rights society, price code, etc.)
function buildIdentifiersSectionContent(identifiers) {
  const frag = document.createDocumentFragment();
  identifiers.forEach(i => frag.appendChild(buildIdentifierRow(i)));
  return frag;
}

// One row per non-primary credit (producer, engineer, artwork, etc.), clickable where an artist ID exists
function buildCreditsSectionContent(credits) {
  const frag = document.createDocumentFragment();
  credits.forEach(c => {
    const row = document.createElement("div");
    row.className = "dqp-info-row" + (c.id ? " dqp-clickable" : "");
    row.textContent = c.role ? `${c.name} — ${c.role}` : c.name;
    if (c.id) {
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        performDrillDownById(c.id, "artist");
      });
    }
    frag.appendChild(row);
  });
  return frag;
}

// Free-text release notes
function buildNotesSectionContent(notes) {
  const div = document.createElement("div");
  div.className = "dqp-notes-text";
  div.textContent = cleanDiscogsMarkup(notes);
  return div;
}

// Marketplace/collector stats — for sale count, lowest price, have/want, community rating
function buildStatisticsSectionContent(stats) {
  const frag = document.createDocumentFragment();
  const rows = [];
  if (stats.lowestPrice != null) rows.push(`Lowest Price: $${stats.lowestPrice.toFixed(2)}`);
  if (stats.numForSale != null) rows.push(`For Sale: ${stats.numForSale}`);
  if (stats.have != null) rows.push(`Have: ${stats.have}`);
  if (stats.want != null) rows.push(`Want: ${stats.want}`);
  if (stats.ratingAverage != null && stats.ratingCount) {
    rows.push(`Rating: ${stats.ratingAverage.toFixed(2)} / 5 (${stats.ratingCount} ratings)`);
  }
  rows.forEach(text => {
    const row = document.createElement("div");
    row.className = "dqp-info-row";
    row.textContent = text;
    frag.appendChild(row);
  });
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
  frag.appendChild(buildTitleRow(title, data.youtubeUrl));

  const meta = document.createElement("div");
  meta.className = "dqp-year";
  meta.textContent = [data.year, data.format].filter(Boolean).join(" · ");
  frag.appendChild(meta);

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
          youtubeUrl: data.youtubeUrl,
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

  // Expandable metadata sections — collapsed by default, each opens on click
  if (data.masterId) {
    frag.appendChild(buildSection("Master", buildMasterSectionContent(data.masterId)));
  }
  if (data.artists?.length) {
    frag.appendChild(buildSection("Artists", buildArtistsSectionContent(data.artists)));
  }
  if (data.companies?.length) {
    frag.appendChild(buildSection("Companies", buildCompaniesSectionContent(data.companies)));
  }
  if (data.credits?.length) {
    frag.appendChild(buildSection("Credits", buildCreditsSectionContent(data.credits)));
  }
  if (data.barcodes?.length) {
    frag.appendChild(buildSection("Barcode", buildBarcodeSectionContent(data.barcodes)));
  }
  if (data.identifiers?.length) {
    frag.appendChild(buildSection("Identifiers", buildIdentifiersSectionContent(data.identifiers)));
  }
  if (data.notes) {
    frag.appendChild(buildSection("Notes", buildNotesSectionContent(data.notes)));
  }
  if (data.statistics) {
    frag.appendChild(buildSection("Statistics", buildStatisticsSectionContent(data.statistics)));
  }

  return frag;
}

// Track layout — song title, parent album cover, album name (clickable), artist (clickable)
function buildTrackLayout(data) {
  const frag = document.createDocumentFragment();

  const trackTitle = document.createElement("div");
  trackTitle.className = "dqp-title";
  trackTitle.textContent = data.trackTitle;
  frag.appendChild(buildTitleRow(trackTitle, data.youtubeUrl));

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

// Warning text shown when a lookup fails (missing/invalid token, no results, etc.)
function buildErrorMessage(message) {
  const div = document.createElement("div");
  div.className = "dqp-error-message";
  div.textContent = message;
  return div;
}

// Standalone warning tooltip — used when there's no tooltip open yet to render into
function showErrorTooltip(message, x, y) {
  removeTooltip();
  tooltip = document.createElement("div");
  tooltip.className = "dqp-tooltip";

  const scrollInner = document.createElement("div");
  scrollInner.className = "dqp-scroll-inner";
  scrollInner.appendChild(buildErrorMessage(message));
  tooltip.appendChild(scrollInner);

  document.body.appendChild(tooltip);

  const rect = tooltip.getBoundingClientRect();
  let left = x + 12;
  let top = y + 12;
  if (left + rect.width > window.innerWidth) left = x - rect.width - 12;
  if (top + rect.height > window.innerHeight) top = y - rect.height - 12;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  requestAnimationFrame(() => tooltip?.classList.add("visible"));
}

// "Or did you mean?" section — top 5 alternatives to the main result, ranked by score
function buildAlternativesSection(alternatives) {
  const section = document.createElement("div");
  section.className = "dqp-alternatives";

  const header = document.createElement("div");
  header.className = "dqp-alt-header";
  header.textContent = "Or did you mean:";
  section.appendChild(header);

  alternatives.forEach(alt => {
    const row = document.createElement("div");
    row.className = "dqp-alt-row";
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      // Tracks resolve to their parent master; everything else looks up by its own ID
      const itemType = alt.type === "artist" ? "artist"
                     : alt.type === "master"  ? "master"
                     : alt.type === "track"   ? "master"
                     : "release";
      const id = (alt.type === "track" && alt.master_id) ? alt.master_id : alt.id;
      performDrillDownById(id, itemType);
    });

    if (alt.thumb) {
      const img = document.createElement("img");
      img.src = alt.thumb;
      img.className = "dqp-alt-thumb";
      row.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "dqp-alt-info";

    const title = document.createElement("div");
    title.className = "dqp-alt-title";
    title.textContent = alt.title;
    info.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "dqp-alt-meta";
    meta.textContent = [alt.type, alt.year].filter(Boolean).join(" · ");
    info.appendChild(meta);

    row.appendChild(info);
    section.appendChild(row);
  });

  return section;
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

  // Only show alternatives at the root level (not when navigated into a sub-item)
  if (navStack.length === 0 && currentAlternatives?.length) {
    scrollInner.appendChild(buildAlternativesSection(currentAlternatives));
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
    if (chrome.runtime.lastError) return;
    if (!response?.ok) {
      scrollInner.innerHTML = "";
      scrollInner.appendChild(buildErrorMessage(response?.error || "Lookup failed."));
      return;
    }
    drillDown({ type: response.type, ...response.data });
  });
}

function performDrillDownById(id, itemType) {
  const scrollInner = tooltip.querySelector(".dqp-scroll-inner");
  scrollInner.innerHTML = '<div class="dqp-loading-inner"></div>';
  chrome.runtime.sendMessage({ type: "LOOKUP_BY_ID", id, itemType }, (response) => {
    if (chrome.runtime.lastError) return;
    if (!response?.ok) {
      scrollInner.innerHTML = "";
      scrollInner.appendChild(buildErrorMessage(response?.error || "Lookup failed."));
      return;
    }
    drillDown({ type: response.type, ...response.data });
  });
}

// Build and position the tooltip, branching on result type
function showTooltip(data, x, y, alternatives = []) {
  removeTooltip(); // resets currentAlternatives — must set it again below, after this call
  currentAlternatives = alternatives;

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
    if (chrome.runtime.lastError) return;
    if (!response?.ok) {
      showErrorTooltip(response?.error || "Lookup failed.", x, y);
      return;
    }
    showTooltip({ type: response.type, ...response.data }, x, y, response.alternatives || []);
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
    if (!instantLookup) return;
    performLookup(selectedText, e.clientX, e.clientY);
    // Clear the highlight once the query has fired so it can't misfire on a later mouseup
    window.getSelection().removeAllRanges();
  });
});

// Handle lookup triggered from the right-click context menu
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "CONTEXT_LOOKUP") {
    performLookup(message.query, lastRightClickPos.x, lastRightClickPos.y);
    // Clear the highlight once the query has fired so it can't misfire on a later mouseup
    window.getSelection().removeAllRanges();
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
