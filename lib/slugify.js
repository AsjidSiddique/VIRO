/**
 * slugify(name)
 * Converts a product name to a URL-friendly slug using hyphens.
 * Hyphens are used (not underscores) because Google treats hyphens
 * as word separators, which improves keyword indexing.
 *
 * Example: "Red Leather Shoes!" → "red-leather-shoes"
 */
export function slugify(name) {
  return (name || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // replace non-alphanumeric runs with hyphen
    .replace(/(^-|-$)/g, '');       // strip leading/trailing hyphens
}

/**
 * extractId(param)
 * Extracts the real product ID from a slug-id param.
 *
 * Handles two ID formats:
 *  1. UUID  — "facial-cleansing-brush-8ea929ab-5317-4dd1-98d0-3366bb2e8c66"
 *             → "8ea929ab-5317-4dd1-98d0-3366bb2e8c66"  (last 36 chars, UUID pattern)
 *  2. Short ID — "red-shoes-abc123"
 *             → "abc123"  (last hyphen-segment)
 *
 * Falls back to the full param if nothing matches.
 */
export function extractId(param) {
  if (!param) return param;

  // Match a UUID at the end of the string (with optional preceding hyphen)
  // UUID format: 8-4-4-4-12 hex chars separated by hyphens = 36 chars total
  const uuidMatch = param.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (uuidMatch) return uuidMatch[0];

  // Fallback: short non-UUID id — take last segment after hyphen
  const parts = param.split('-');
  return parts[parts.length - 1];
}
