import { useQuery } from "@tanstack/react-query";
import { tmdbFetch } from "./tmdb.functions";
import { useLang } from "./i18n";

export const IMG = "https://image.tmdb.org/t/p/";
export const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#1a1a1d"/><text x="250" y="390" text-anchor="middle" fill="#3d3d42" font-family="Arial" font-size="36" font-weight="700">CIMALY</text></svg>`,
  );

export const img = (p?: string | null, size = "w342") => (p ? IMG + size + p : PLACEHOLDER);
export const yr = (d?: string | null) => (d ? d.slice(0, 4) : "");
export const rating = (v?: number | null) => (v ? (Math.round(v * 10) / 10).toFixed(1) : "–");
export const fdate = (d: string | undefined | null, lang: string) => {
  if (!d) return "";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
};

export type TmdbParams = Record<string, string | number | boolean>;

/** Missing-secret sentinel so the UI can show a safe placeholder. */
export const MISSING_KEY = Symbol("missing-tmdb-key");

export async function tmdb(path: string, params: TmdbParams = {}, lang = "en"): Promise<any | null> {
  const res = await tmdbFetch({
    data: { path, params: { language: lang === "ar" ? "ar-SA" : "en-US", ...params } },
  });
  if (!res.ok) return res.missingKey ? { __missingKey: true } : null;
  return res.data;
}

/** Arabic pages sometimes lack an overview; fall back to English text. */
export async function tmdbLocalized(path: string, params: TmdbParams = {}, lang = "en") {
  const data = await tmdb(path, params, lang);
  if (lang === "ar" && data && !data.__missingKey && !data.overview) {
    const en = await tmdb(path, { ...params, language: "en-US" }, "en");
    if (en && !en.__missingKey) data.overview = data.overview || en.overview;
  }
  return data;
}

export function useTmdb(path: string | null, params: TmdbParams = {}, localized = false) {
  const { lang } = useLang();
  return useQuery({
    queryKey: ["tmdb", path, params, lang, localized],
    enabled: !!path,
    queryFn: () => (localized ? tmdbLocalized(path!, params, lang) : tmdb(path!, params, lang)),
    staleTime: 5 * 60 * 1000,
  });
}

export const isMissingKey = (d: any) => !!d?.__missingKey;