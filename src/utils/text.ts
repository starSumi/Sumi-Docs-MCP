/**
 * @file Text Utilities
 * Pure functions for text processing and snippet extraction
 */

/**
 * Extract a context snippet around a search term
 *
 * @param text - Full text content
 * @param query - Search query (case-insensitive)
 * @param maxLength - Maximum snippet length in characters (default: 200)
 * @returns Snippet with query highlighted in context, avoiding surrogate pair splits
 */
export function extractSnippet(
  text: string,
  query: string,
  maxLength: number = 200,
): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    // Query not found, return beginning
    const end = Math.min(text.length, maxLength);
    let snippet = text.slice(0, end);

    // Avoid splitting surrogate pairs at the end
    if (end < text.length && isLowSurrogate(text.charCodeAt(end))) {
      snippet = text.slice(0, end - 1);
    }

    return snippet.trim() + (end < text.length ? "..." : "");
  }

  // Calculate snippet boundaries
  const beforeContext = Math.floor((maxLength - query.length) / 2);
  let start = Math.max(0, index - beforeContext);
  let end = Math.min(text.length, start + maxLength);

  // Avoid splitting surrogate pairs at boundaries
  if (start > 0 && isLowSurrogate(text.charCodeAt(start))) {
    start = Math.max(0, start - 1);
  }
  if (end < text.length && isLowSurrogate(text.charCodeAt(end))) {
    end = Math.max(start + 1, end - 1);
  }

  let snippet = text.slice(start, end).trim();

  // Add ellipsis
  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < text.length) {
    snippet = snippet + "...";
  }

  return snippet;
}

/**
 * Check if a character code is a low surrogate (U+DC00 to U+DFFF)
 */
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Calculate simple relevance score for search ranking
 *
 * @param text - Text to score
 * @param headings - Array of headings
 * @param query - Search query
 * @returns Numeric score (higher is more relevant)
 */
export function calculateRelevanceScore(
  text: string,
  headings: Array<{ level: number; text: string }>,
  query: string,
): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let score = 0;

  // Count occurrences in text (1 point each) using indexOf to avoid regex special chars
  let index = 0;
  while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
    score += 1;
    index += lowerQuery.length;
  }

  // Heading matches are weighted higher
  for (const heading of headings) {
    const lowerHeading = heading.text.toLowerCase();
    if (lowerHeading.includes(lowerQuery)) {
      // H1 = 10 points, H2 = 5 points, H3 = 3 points
      score += heading.level === 1 ? 10 : heading.level === 2 ? 5 : 3;
    }
  }

  return score;
}

/**
 * Normalize whitespace in text
 *
 * @param text - Input text
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
