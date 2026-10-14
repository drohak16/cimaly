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
async function fetchTmdb(path, params = {}) {
  const url = new URL(base + path);
  url.searchParams.set("api_key", key);
  url.searchParams.set("language", "en-US");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (response.ok) return await response.json();
      if (![429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`TMDB ${path}: HTTP ${response.status}`);
      }
      if (attempt === 3) throw new Error(`TMDB ${path}: HTTP ${response.status} after retries`);
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30000) : 1000 * 2 ** attempt));
    } catch (error) {
      if (attempt === 3 || (error instanceof Error && /HTTP 40[013456789]/.test(error.message))) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
  throw new Error(`TMDB ${path}: retries exhausted`);
}
const get = path => fetchTmdb(path);
const homeEndpoints = {
  trend: ["/trending/movie/day", {}],
  trendW: ["/trending/movie/week", {}],
  popM: ["/movie/popular", {}],
  popTv: ["/tv/popular", {}],
  nowP: ["/movie/now_playing", {}],
  topM: ["/movie/top_rated", {}],
  topTv: ["/tv/top_rated", {}],
  upc: ["/movie/upcoming", {}],
  tr: ["/discover/tv", { with_origin_country: "TR", sort_by: "popularity.desc" }],
  kr: ["/discover/tv", { with_origin_country: "KR", sort_by: "popularity.desc" }],
  trendTv: ["/trending/tv/day", {}],
};
const getWithParams = (path, params) => fetchTmdb(path, params);
const output = join(process.cwd(), "public", "data");
await mkdir(output, { recursive: true });
const results = await Promise.all(endpoints.map(async ([name, path]) => [name, await get(path)]));
for (const [name, data] of results) {
  await writeFile(join(output, name + ".json"), JSON.stringify(data));
}
console.log(`Wrote ${results.length} static catalogue JSON files`);

const home = Object.fromEntries(await Promise.all(
  Object.entries(homeEndpoints).map(async ([name, [path, params]]) => [name, await getWithParams(path, params)])
));
if (!home.trend?.results?.length || !home.popM?.results?.length || !home.popTv?.results?.length) throw new Error("TMDB home snapshot is incomplete");
await writeFile(join(output, "home.json"), JSON.stringify({ ok: true, data: home }));
console.log("Wrote static homepage data");
