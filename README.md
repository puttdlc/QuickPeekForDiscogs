# Discogs Quick-Peek

**Selection Lookup for Discogs!** Highlight any word or phrase on any web page and get an instant Discogs preview: artist bios and genres, album/release artwork and tracklists. It's a way to discover music while you're reading, without leaving the page to go search Discogs yourself.

This extension is built on the Manifest V3 Chrome extension specification, turning the [Discogs](https://www.discogs.com) database into a convenient inline lookup tool. Easily highlight any artist, album, or track name on any webpage and instantly see release details, cover art, and marketplace info without leaving the page.

---

## Jump to

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Setup](#setup)
- [Permissions](#permissions)
- [Discogs API reference](#discogs-api-reference)
- [Project Structure](#project-structure)
- [Limitations](#limitations)
- [Privacy](#privacy)
- [Disclaimer](#disclaimer)
- [Credits](#credits)
- [License](#license)

## What it does

Quick-Peek puts the Discogs database one selection away from any text on the web:

- **Select text → right-click → "Search Discogs for '…'"**, or
- **Select text → release the mouse** with *Instant Select Lookup* **turned on** in the popup, for a zero-click flow.

Either path uses the `/database/search` endpoint and renders a floating tooltip near your cursor with the best-matching result — without ever navigating away from the page you're on.

Example Usage Patterns:

| You selected... | Quick-Peek shows... |
|---|---|
| An artist name (`Herbie Hancock`) | Photo, genre tags, and their 5 most recent releases |
| An album/release title (`Selected Head Hunters`) | Cover art, year, format, artist credits, and the full tracklist |
| A song title (`Chameleon`)| The track name plus its parent album's cover, title, and artist |
| Anything else | Its single best-guess match, with five ranked alternatives underneath in case the guess is wrong |

From any card, you can keep drilling in: click an artist's name to jump to their artist page, click a track to see which album it's from.

Example Usage:
1. Click an album cover to see its full tracklist
2. Each click pushes a new view onto an in-tooltip navigation stack
3. Use the **← Back** button to retrace your steps.

## How it works

The extension has three parts that talk to each other only through Chrome's messaging APIs: (`content.js`) watches the page and renders the tooltip, (`background.js`) that handles **REST-API** with Discogs and finally (`popup.js`) for the popup for the token and settings.

A selection or right-click sends the query to the `background.js`, which searches Discogs, scores the results to pick the best match (weighing title overlap and popularity over raw search order), fetches that result's full details, and sends it back to render. Clicking deeper into a card repeats this by ID instead of by search, building the back-navigable stack inside the tooltip.

## Setup

1. **Clone or download this repository.**
2. **Load it as an unpacked extension:**
   - Open `chrome://extensions`
   - Enable **Developer mode** (top-right toggle)
   - Click **Load unpacked** and select the `discogs-quick-peek` folder
3. **Get a Discogs Personal Access Token:**
   - Go to [discogs.com/settings/developers](https://www.discogs.com/settings/developers) (also linked from the extension popup footer)
   - Generate a token under "Personal Access Token", and copy it to your clipboard.
4. **Paste the token into the extension popup** and click **Save Token**, then reload any tabs you want the extension active on.
5. *(Optional)* Toggle **Instant Select Lookup** on if you'd rather skip the right-click menu and have every text selection trigger a lookup automatically. Though, it is recommended to be used only for more intensive lookup sessions as it will trigger the lookup regardless of text length, which may be intrusive for your average browsing experiences.

Your token is stored only in `chrome.storage.sync` (synced via your Google account like any other Chrome extension setting) and is sent only to `api.discogs.com` as a query parameter on each request. This extension never touches any third-party server, and the extension has no backend of its own.

## Permissions

Declared in [`manifest.json`](manifest.json):

- `storage` — persist the API token and the instant-lookup preference.
- `contextMenus` — add the "Search Discogs for…" right-click item.
- `host_permissions: ["https://api.discogs.com/*"]` — the only network endpoint the extension is allowed to talk to.
- `content_scripts` matching `<all_urls>` — the tooltip/selection logic needs to run on whatever page you're reading; it does not request `activeTab`-level page-content access beyond rendering its own UI.



## Discogs API reference

This project is built entirely on Discogs's public REST API:

- **API documentation:** [discogs.com/developers](https://www.discogs.com/developers)
- **Authentication:** [Personal Access Tokens](https://www.discogs.com/settings/developers) (simplest auth method; full OAuth 1.0a flow exists but isn't needed for read-only personal use)
- **Database endpoints used:**
  - [`GET /database/search`](https://www.discogs.com/developers#page:database,header:database-search) — full-text search across artists, releases, masters, and labels
  - [`GET /artists/{artist_id}`](https://www.discogs.com/developers#page:database,header:database-artist) and [`GET /artists/{artist_id}/releases`](https://www.discogs.com/developers#page:database,header:database-artist-releases)
  - [`GET /masters/{master_id}`](https://www.discogs.com/developers#page:database,header:database-master-release)
  - [`GET /releases/{release_id}`](https://www.discogs.com/developers#page:database,header:database-release)
- **Rate limits:** authenticated requests are capped at `60 requests per minute` per Discogs's published limits. Drilling into deeply nested results (e.g. an artist card, which fires two parallel requests plus a follow-up genre lookup) consumes more of that budget than a flat release lookup; be mindful if you're rapid-firing lookups across many tabs.

## Project Structure

- `manifest.json` — MV3 manifest: permissions, content script registration, action/popup wiring
- `background.js` — service worker: Discogs API calls, result ranking, context menu registration
- `content.js` — injected into every page: tooltip UI, drill-down nav, selection/click listeners
- `popup.html` — toolbar popup markup and scoped styles
- `popup.js` — popup logic: reads/writes `chrome.storage.sync` for the token and instant-lookup toggle
- `icons/icon128.png` — extension icon, used at 16/48/128px (*Subject to change, as this is the placeholder icon from Chrome's extension tutorial*)
- `LICENSE` — MIT

## Limitations

- Search relevance is heuristic, not semantic. `pickBestResult`/`rankResults` is a scoring function over title overlap and community popularity, not a language model, so unusual phrasing or very short/ambiguous selections (single common words) can surface an unrelated top result. That's exactly what the "Or did you mean?" list is there to recover from.
- No offline/cache layer — every lookup is a live round-trip to `api.discogs.com`, so results reflect the current Discogs database in real time, but the extension is non-functional without a network connection or a valid token.
- Genre tags on artist cards are inferred from one of the artist's releases (Discogs doesn't attach genres to the artist resource itself), so they reflect that release's tagging rather than a verified artist-level genre. So it's not entirely uncommon for the artist's genre to seem completely irrelevant to their work.

## Privacy

Quick-Peek does not collect, transmit, or store any analytics, telemetry, or browsing data. The only outbound network calls are to `api.discogs.com`, carrying your search query and your own Discogs token. Selected text never leaves the browser except as the literal search string sent to Discogs.

## Disclaimer

This is an independent, unofficial project and is not affiliated with, endorsed by, or sponsored by Discogs or Zink Media, LLC. "Discogs" is a trademark of Zink Media, LLC.

## Credits

- Built on the [Discogs API](https://www.discogs.com/developers) and the data contributed by the Discogs community.

## License

[MIT](LICENSE)