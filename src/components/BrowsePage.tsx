import { useNavigate } from "@tanstack/react-router";
import { COUNTRIES, GENRES } from "@/lib/catalog";
import { cname, gname, useLang } from "@/lib/i18n";
import { useTmdb } from "@/lib/tmdb";
import { EmptyState, MediaCard, SkeletonRows } from "./Cards";

export type BrowseSearch = {
  genre?: string;
  country?: string;
  year?: string;
  rating?: string;
  sort?: string;
  page?: number;
};

export const validateBrowseSearch = (s: Record<string, unknown>): BrowseSearch => {
  const out: BrowseSearch = {};
  for (const k of ["genre", "country", "year", "rating", "sort"] as const) {
    if (s[k]) out[k] = String(s[k]);
  }
  if (s["page"]) out.page = Number(s["page"]) || 1;
  return out;
};

export function BrowsePage({ type, search }: { type: "movie" | "tv"; search: BrowseSearch }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const isTv = type === "tv";
  const page = search.page || 1;
  const sort = search.sort || "popularity.desc";
  const title = isTv ? t("tv") : t("movies");

  const q: Record<string, string | number | boolean> = { sort_by: sort, page, include_adult: false };
  if (search.genre) q["with_genres"] = search.genre;
  if (search.country) q["with_origin_country"] = search.country.toUpperCase();
  if (search.rating) {
    q["vote_average.gte"] = search.rating;
    q["vote_count.gte"] = 50;
  }
  if (sort === "vote_average.desc") q["vote_count.gte"] = 200;
  if (search.year) q[isTv ? "first_air_date_year" : "primary_release_year"] = search.year;

  const { data, isLoading } = useTmdb(`/discover/${type}`, q);

  const go = (patch: BrowseSearch) => {
    const next: BrowseSearch = { ...search, ...patch };
    for (const k of Object.keys(next) as (keyof BrowseSearch)[]) if (!next[k]) delete next[k];
    navigate({ to: isTv ? "/tv" : "/movies", search: next });
  };

  const years = Array.from({ length: 60 }, (_, i) => new Date().getFullYear() + 1 - i);
  const sel = (
    name: keyof BrowseSearch,
    cur: string,
    options: { v: string | number; l: string | number }[],
    label: string,
  ) => (
    <select value={cur} onChange={(ev) => go({ [name]: ev.target.value, page: 1 } as unknown as BrowseSearch)}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option value={o.v} key={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );

  const results = data?.results || [];
  const totalPages = Math.min(data?.total_pages || 1, 500);

  return (
    <div className="page wrap fade">
      <h1 className="page-title">{title}</h1>
      <div className="filters">
        {sel(
          "genre",
          search.genre || "",
          GENRES.map((g) => ({ v: isTv ? g.tv : g.id, l: gname(g, lang) })),
          t("genre") + ": " + t("all"),
        )}
        {sel(
          "country",
          search.country || "",
          COUNTRIES.map((c) => ({ v: c.c, l: cname(c, lang) })),
          t("country") + ": " + t("all"),
        )}
        {sel("year", search.year || "", years.map((y) => ({ v: y, l: y })), t("anyYear"))}
        {sel("rating", search.rating || "", [8, 7, 6, 5].map((r) => ({ v: r, l: r + "+" })), t("anyRating"))}
        <span
          style={{
            marginInlineStart: "auto",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".1em",
            color: "var(--dim)",
          }}
        >
          {t("sortBy")}
        </span>
        {sel(
          "sort",
          sort,
          [
            { v: "popularity.desc", l: t("popular") },
            { v: isTv ? "first_air_date.desc" : "primary_release_date.desc", l: t("newest") },
            { v: "vote_average.desc", l: t("topRated") },
            { v: isTv ? "name.asc" : "original_title.asc", l: t("az") },
          ],
          t("sortBy"),
        )}
        <button className="clear-btn" onClick={() => navigate({ to: isTv ? "/tv" : "/movies", search: {} })}>
          {t("reset")}
        </button>
      </div>

      {isLoading ? (
        <SkeletonRows count={2} />
      ) : !data || data.__missingKey ? (
        <EmptyState title={t("tmdbErr")} />
      ) : !results.length ? (
        <EmptyState title={t("noResults")} hint={t("noResultsHint")} />
      ) : (
        <>
          <div className="grid">
            {results.map((r: any) => (
              <MediaCard item={r} type={type} key={r.id} />
            ))}
          </div>
          <div className="pager">
            {page > 1 && <button onClick={() => go({ page: page - 1 })}>‹</button>}
            <span>
              {page} / {totalPages}
            </span>
            {page < totalPages && <button onClick={() => go({ page: page + 1 })}>›</button>}
          </div>
        </>
      )}
    </div>
  );
}
