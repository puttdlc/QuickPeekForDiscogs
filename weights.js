/*
 * weights.js — Shared scoring-weight definitions for Discogs Quick Peek
 *
 * Loaded by both background.js (via importScripts) and popup.html (via <script>)
 * so the default values, labels, and descriptions live in exactly one place.
 * User overrides are stored in chrome.storage.sync under each WEIGHT_DEFS key.
 */

const WEIGHT_DEFS = [
  {
    key: "TITLE_OVERLAP_WEIGHT",
    label: "Title Overlap Weight",
    desc: "Multiplier on title-word overlap ratio — the primary matching signal.",
    default: 3
  },
  {
    key: "POPULARITY_WEIGHT",
    label: "Popularity Weight",
    desc: "Multiplier on community popularity — a tie-breaker, not a deciding factor.",
    default: 0.5
  },
  {
    key: "POPULARITY_CAP",
    label: "Popularity Cap",
    desc: "Ceiling on the popularity score before weighting is applied.",
    default: 3
  },
  {
    key: "ARTIST_TYPE_BONUS",
    label: "Artist Type Bonus",
    desc: "Flat bonus so artists beat self-titled albums with the same query.",
    default: 4.0
  },
  {
    key: "MASTER_TYPE_BONUS",
    label: "Master Type Bonus",
    desc: "Flat bonus favoring canonical masters over single pressings.",
    default: 0.3
  },
  {
    key: "EXACT_MATCH_BONUS",
    label: "Exact Match Bonus",
    desc: "Flat bonus when title tokens exactly equal query tokens.",
    default: 2.0
  }
];

const WEIGHT_DEFAULTS = WEIGHT_DEFS.reduce((acc, w) => {
  acc[w.key] = w.default;
  return acc;
}, {});

// Merges stored overrides onto the defaults, ignoring anything invalid or negative
// so a corrupted/tampered storage value can never break scoring.
function resolveWeights(stored) {
  const weights = { ...WEIGHT_DEFAULTS };
  for (const key of Object.keys(WEIGHT_DEFAULTS)) {
    const value = stored?.[key];
    if (typeof value === "number" && !Number.isNaN(value) && value >= 0) {
      weights[key] = value;
    }
  }
  return weights;
}
