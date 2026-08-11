import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, MediaCard, SkeletonRows } from "@/components/Cards";
import { useLang } from "@/lib/i18n";
import { useTmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: s.q ? String(s.q) : "" }),
  head: () => ({
    meta: [
      { title: "Search — Cimaly" },
      { name: "description", content: "Search movies and TV shows across Cimaly in English and Arabic." },
      { property: "og:title", content: "Search — Cimaly" },
      { property: "og:description", content: "Search movies and TV shows in English and Arabic." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { t } = useLang();
  const { data, isLoading } = useTmdb(q ? "/search/multi" : null, { query: q, include_adult: false });
  const results = (data?.results || []).filter((r: any) => r.media_type !== "person");

  if (!q)
    return (
      <div className="page wrap">
        <h1 className="page-title">{t("search")}</h1>
        <EmptyState title={t("typeSearch")} />
      </div>
    );

  return (
    <div className="page wrap fade">
      <h1 className="page-title">
        {t("results")} “{q}”
      </h1>
      {isLoading ? (
        <SkeletonRows count={2} />
      ) : !data || data.__missingKey ? (
        <EmptyState title={t("tmdbErr")} />
      ) : !results.length ? (
        <EmptyState title={t("noResults")} hint={t("noResultsHint")} />
      ) : (
        <div className="grid">
          {results.map((r: any) => (
            <MediaCard item={r} key={`${r.media_type}-${r.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
