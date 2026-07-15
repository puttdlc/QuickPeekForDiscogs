# Privacy Policy — Quick Peek for Discogs

**Last updated:** July 14, 2026

Quick Peek for Discogs ("the extension") does not collect, transmit, or store any personal data, analytics, telemetry, or browsing history.

## What the extension does

The extension lets you highlight text on any webpage and look it up on [Discogs](https://www.discogs.com). When you do this, the selected text is sent directly from your browser to Discogs's public REST API (`api.discogs.com`) to retrieve matching artist, release, or track information, which is then displayed in a tooltip on the page you're viewing.

## Data we store

The extension uses `chrome.storage.sync` to store two things locally, on your device and synced through your own Google account (the same as any other Chrome setting):

- **Your Discogs Personal Access Token** — used to authenticate your requests to the Discogs API.
- **Your "Instant Select Lookup" preference** — whether lookups trigger automatically on text selection or only via the right-click menu.

Neither of these ever leaves your browser except as part of a request to `api.discogs.com`, which is required for the extension to function.

## Data we do not collect

The extension does not collect, log, or transmit:

- Personally identifiable information (name, email, address, etc.)
- Health, financial, or authentication data (other than your own Discogs token, described above)
- Browsing history, web activity, or analytics of any kind
- Location data

## Third parties

The only external service the extension communicates with is the [Discogs API](https://www.discogs.com/developers), operated by Zink Media, LLC. Requests to Discogs are subject to [Discogs's own privacy policy](https://www.discogs.com/privacy). The extension has no backend or server of its own, and does not share data with any other third party.

## Changes to this policy

If this policy changes, the updated version will be posted at this same location with a revised "Last updated" date.

## Contact

Questions about this policy can be raised via [GitHub Issues](https://github.com/puttdlc/QuickPeekForDiscogs/issues) on the project repository.

## Disclaimer

This is an independent, unofficial project and is not affiliated with, endorsed by, or sponsored by Discogs or Zink Media, LLC.