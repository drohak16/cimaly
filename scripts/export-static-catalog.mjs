/**
 * Build-time TMDB catalogue snapshot. Run in CI with TMDB_API_KEY.
 * Produces only public JSON (never writes the API key to output).
 * This is a migration building block, not a complete static deployment.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const key = process.env.TMDB_API_KEY;
if (!key) throw new Error("TMDB_API_KEY is required at build time");
const base = "https://api.themoviedb.org/3";
const endpoints = [
  ["trending-movies", "/trending/movie/week"],
  ["trending-tv", "/trending/tv/week"],
  ["popular-movies", "/movie/popular"],
  ["popular-tv", "/tv/popular"],
  ["top-rated-movies", "/movie/top_rated"],
  ["top-rated-tv", "/tv/top_rated"],
  ["now-playing", "/movie/now_playing"],
  ["upcoming", "/movie/upcoming"],
];
async function get(path) {
  const url = new URL(base + path);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`TMDB ${path}: HTTP ${response.status}`);
  return response.json();
}
const output = join(process.cwd(), "public", "data");
await mkdir(output, { recursive: true });
const results = await Promise.all(endpoints.map(async ([name, path]) => [name, await get(path)]));
for (const [name, data] of results) {
  await writeFile(join(output, name + ".json"), JSON.stringify(data));
}
console.log(`Wrote ${results.length} static catalogue JSON files`);
