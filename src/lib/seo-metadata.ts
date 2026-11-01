// Factual SEO for English canonical HTML; Arabic stays available via the UI.
type Kind = "movie" | "tv";
export function mediaSeoMeta(data: any, kind: Kind): { title: string; description: string } {
  const name = String(data?.title || data?.name || data?.original_title || data?.original_name || (kind === "movie" ? "Movie" : "TV Series")).trim();
  const date = String(kind === "movie" ? data?.release_date || "" : data?.first_air_date || "");
  const year = /^\d{4}/.test(date) ? date.slice(0, 4) : "";
  const heading = year ? `${name} (${year})` : name;
  const genres: string[] = (Array.isArray(data?.genres) ? data.genres : [])
    .map((g: { name?: string }) => g.name).filter((x: unknown): x is string => typeof x === "string" && x.length > 0);
  const isAnime = genres.includes("Animation") &&
    (data?.original_language === "ja" ||
      (Array.isArray(data?.origin_country) && data.origin_country.includes("JP")) ||
      (Array.isArray(data?.production_countries) && data.production_countries.some((c: { iso_3166_1?: string }) => c.iso_3166_1 === "JP")));
  const label = isAnime ? (kind === "movie" ? "Anime Film" : "Anime Series") :
    (genres[0] ? genres[0] + " " : "") + (kind === "movie" ? "Movie" : "TV Series");
  const title = `${heading} — ${label} | Cimaly`;
  const synopsis = String(data?.overview || "").replace(/\s+/g, " ").trim();
  const country = String(data?.production_countries?.[0]?.name || data?.origin_country?.[0] || "").trim();
  const cast: string[] = (Array.isArray(data?.credits?.cast) ? data.credits.cast : [])
    .slice(0, 3).map((p: { name?: string }) => p.name).filter((x: unknown): x is string => typeof x === "string" && x.length > 0);
  const genreText = genres.slice(0, 2).join("/");
  const fallback = [
    `${heading} is listed as a ${genreText ? genreText.toLowerCase() + " " : ""}${kind === "movie" ? "film" : "TV series"}${country ? " from " + country : ""}.`,
    cast.length ? `Cast includes ${cast.join(", ")}.` : "",
    kind === "movie" ? "Explore film credits and release details on Cimaly." : "Explore cast, seasons and episodes on Cimaly.",
  ].filter(Boolean).join(" ");
  const raw = synopsis ? `${heading}: ${synopsis}` : fallback;
  const description = raw.length <= 160 ? raw : raw.slice(0, 158).replace(/\s+\S*$/, "").trimEnd() + "…";
  return { title, description };
}
