// lib/theme.js — Design tokens shared across all components
// Fixes:
//   Item 9: RAIL_W removed — use RAIL_COLLAPSED / RAIL_EXPANDED directly
//   Item 10: _catColorIdx was a global counter whose output depended on component
//            mount order. Replaced with djb2 hash → deterministic per category name.

// ── Color System ────────────────────────────────────────────────────────────
export const C = {
  // Surfaces
  base: "#09090A",
  elevated: "#111113",
  recessed: "#060607",
  surface: "#16161A",
  surfaceHover: "#1C1C21",

  stroke: "rgba(255,255,255,0.06)",
  strokeHover: "rgba(255,255,255,0.1)",

  // Text
  text: "#E2DFD8",
  textSoft: "#9E9A91",
  textFaint: "#5C5950",
  textGhost: "#3A3834",

  // Meaningful signal colors
  gold: "#C8A96E",         // brand / primary action / own content
  goldSoft: "rgba(200,169,110,0.10)",
  goldGlow: "rgba(200,169,110,0.06)",

  green: "#6DAF7B",        // approved / strong / growth / success
  greenSoft: "rgba(109,175,123,0.10)",

  blue: "#6A9FD8",         // informational / timing / neutral metrics
  blueSoft: "rgba(106,159,216,0.10)",

  coral: "#D4806A",        // attention / action needed / hot engagement
  coralSoft: "rgba(212,128,106,0.10)",

  purple: "#9B84C9",       // ICP / audience / people-related signals
  purpleSoft: "rgba(155,132,201,0.10)",

  silver: "#8A8A8A",       // neutral / secondary
};

// ── Typography ──────────────────────────────────────────────────────────────
export const F = {
  serif: "'Playfair Display', 'Georgia', serif",
  sans: "'Instrument Sans', 'DM Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

// ── Rail dimensions ─────────────────────────────────────────────────────────
export const RAIL_COLLAPSED = 60;
export const RAIL_EXPANDED = 180;

// ── Category color palette ───────────────────────────────────────────────────
export const CATEGORY_PALETTE = [
  { fg: "#E06050", bg: "rgba(224,96,80,0.12)" },      // red-coral
  { fg: "#4EA8DE", bg: "rgba(78,168,222,0.12)" },      // sky blue
  { fg: "#5BBD72", bg: "rgba(91,189,114,0.12)" },      // green
  { fg: "#C77DFF", bg: "rgba(199,125,255,0.12)" },     // violet
  { fg: "#E8A838", bg: "rgba(232,168,56,0.12)" },      // amber
  { fg: "#F472B6", bg: "rgba(244,114,182,0.12)" },     // pink
  { fg: "#38BDF8", bg: "rgba(56,189,248,0.12)" },      // cyan
  { fg: "#A3E635", bg: "rgba(163,230,53,0.12)" },      // lime
  { fg: "#FB923C", bg: "rgba(251,146,60,0.12)" },      // orange
  { fg: "#67E8F9", bg: "rgba(103,232,249,0.12)" },     // teal
];

// ── Stable category → color mapping ─────────────────────────────────────────
// djb2 hash of the category name → deterministic palette index.
// Color is always the same for a given name regardless of component mount order.
// Fixes Item 10: global _catColorIdx incremented on mount caused different colors
// for the same category depending on which component rendered it first.
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h >>>= 0; // keep as unsigned 32-bit
  }
  return h;
}

export function getTopicColor(topic) {
  if (!topic || topic === "General") return { fg: C.textFaint, bg: C.surface };
  return CATEGORY_PALETTE[djb2(topic) % CATEGORY_PALETTE.length];
}
