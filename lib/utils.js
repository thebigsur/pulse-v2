// ═══════════════════════════════════════════════════════
// THE PULSE v2 — Utility Functions
// Incorporates lessons learned from v1
// ═══════════════════════════════════════════════════════

/**
 * Sanitize Unicode text for Claude API (v1 lesson: broken surrogates crash API)
 * Scans character-by-character to remove lone surrogates, null bytes, non-characters
 */
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Skip null bytes
    if (code === 0) continue;
    // Handle surrogate pairs
    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate — check for valid low surrogate
      if (i + 1 < text.length) {
        const next = text.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          result += text[i] + text[i + 1];
          i++; // skip low surrogate
          continue;
        }
      }
      continue; // lone high surrogate — skip
    }
    if (code >= 0xDC00 && code <= 0xDFFF) continue; // lone low surrogate — skip
    // Skip non-characters
    if (code === 0xFFFE || code === 0xFFFF) continue;
    result += text[i];
  }
  return result;
}

/**
 * Safe number extraction (v1 lesson: || chains fail on zero)
 * Returns first actual number including zero
 */
export function num(...values) {
  for (const v of values) {
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (Array.isArray(v) && typeof v.length === 'number') return v.length;
  }
  return 0;
}

/**
 * Extract Apify token from potentially mangled env var
 * (v1 lesson: Railway prepends https:// to tokens)
 */
export function extractApifyToken(raw) {
  if (!raw) return null;
  const match = raw.match(/apify_api_[A-Za-z0-9]+/);
  return match ? match[0] : raw;
}

/**
 * Post-scrape quality filter (v1 lesson: scrapers return junk)
 * Drops posts that are too short, hashtag-heavy, non-English, or URL-only
 */
export function isQualityPost(text) {
  if (!text || text.length < 20) return false;
  // Too many hashtags (>60%)
  const hashCount = (text.match(/#\w+/g) || []).length;
  const wordCount = text.split(/\s+/).length;
  if (hashCount / wordCount > 0.6) return false;
  // Not enough Latin characters (<50%)
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  if (latinChars / text.length < 0.5) return false;
  // URL-only
  if (/^https?:\/\/\S+$/.test(text.trim())) return false;
  return true;
}

/**
 * Calculate engagement velocity
 * (v1 lesson: raw counts miss timing — 50 likes in 2h > 500 in 3d)
 */
export function engagementVelocity(likes, comments, shares, ageHours) {
  const total = num(likes) + num(comments) + num(shares);
  if (ageHours <= 0) return total;
  return total / Math.max(ageHours, 0.5);
}

/**
 * Word count helper
 */
export function wordCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
