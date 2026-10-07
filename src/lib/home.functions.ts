import { createServerFn } from "@tanstack/react-start";

type HomeResult = { ok: boolean; missingKey?: boolean; data?: Record<string, any> };

export const homeFetch = createServerFn({ method: "GET" }).handler(async (): Promise<HomeResult> => {
  const key = process.env["TMDB_API_KEY"];
  if (!key) return { ok: false, missingKey: true };

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

  try {
    const entries = await Promise.all(
      Object.entries(endpoints).map(async ([name, [path, params]]) => {
        const q = new URLSearchParams({ api_key: key, language: "en-US", ...params });
        const res = await fetch(`https://api.themoviedb.org/3${path}?${q.toString()}`);
        return [name, res.ok ? await res.json() : null] as const;
      }),
    );
    return { ok: true, data: Object.fromEntries(entries) };
  } catch {
    return { ok: false };
  }
});
