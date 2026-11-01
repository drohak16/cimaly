/** Safe JSON-LD serialization for content supplied by TMDB. */
export function jsonLd(data: Record<string, unknown>): string {
  // Avoid terminating the <script> tag if a title or synopsis contains HTML.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
