import { createServerFn } from "@tanstack/react-start";

type HomeResult = { ok: boolean; missingKey?: boolean; data?: Record<string, any> };
const TTL_MS = 10 * 60 * 1000;
const STALE_MS = 12 * 60 * 60 * 1000;
let cachedHome: { value: HomeResult; refreshedAt: number } | undefined;
let inFlight: Promise<HomeResult> | undefined;

async function loadHome(key: string): Promise<HomeResult> {
  const endpoints: Record<string, [string, Record<string, string>]> = {
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
  const previous = cachedHome && Date.now() - cachedHome.refreshedAt < STALE_MS
    ? cachedHome.value.data
    : undefined;
  const entries = await Promise.all(Object.entries(endpoints).map(async ([name, [path, params]]) => {
    try {
      const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
      const response = await fetch(`https://api.themoviedb.org/3${path}?${q.toString()}`, {
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) return [name, previous?.[name] ?? null] as const;
      return [name, await response.json()] as const;
    } catch {
      return [name, previous?.[name] ?? null] as const;
    }
  }));
  const data = Object.fromEntries(entries);
  const result: HomeResult = { ok: Object.values(data).some((v) => v && Array.isArray(v.results)), data };
  if (result.ok) cachedHome = { value: result, refreshedAt: Date.now() };
  return result.ok ? result : previous ? { ok: true, data: previous } : { ok: false };
}

export const homeFetch = createServerFn({ method: "GET" }).handler(async (): Promise<HomeResult> => {
  const key = process.env["TMDB_API_KEY"];
  if (!key) return { ok: false, missingKey: true };
  if (cachedHome && Date.now() - cachedHome.refreshedAt < TTL_MS) return cachedHome.value;
  if (!inFlight) inFlight = loadHome(key).finally(() => { inFlight = undefined; });
  return inFlight;
});
