import { createFileRoute, Navigate } from "@tanstack/react-router";
import { EmptyState, MediaCard, MediaRow, SkeletonRows } from "@/components/Cards";
import { GENRES } from "@/lib/catalog";
import { gname, useLang } from "@/lib/i18n";
import { useTmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/genre/$slug")({
head: ({ params }) => {
  const genreName = params.slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    meta: [
      {
        title: `${genreName} Movies & TV Shows — Cimaly`,
      },
      {
        name: "description",
        content: `Explore ${genreName} movies and TV shows on Cimaly. Discover popular and trending titles from around the world.`,
      },
      {
        property: "og:title",
        content: `${genreName} Movies & TV Shows — Cimaly`,
      },
      {
        property: "og:description",
        content: `Explore ${genreName} movies and TV shows on Cimaly.`,
      },
    ],

    links: [
      {
        rel: "canonical",
        href: `https://cimaly.cc/genre/${params.slug}`,
      },
    ],
  };
},  
  component: GenrePage,
});
function GenrePage() {
  const { slug } = Route.useParams();
  const { t, lang } = useLang();
  const g = GENRES.find((x) => x.slug === slug);
  const tvD = useTmdb(g ? "/discover/tv" : null, { with_genres: g?.tv ?? 0, sort_by: "popularity.desc" });
  const mvD = useTmdb(g ? "/discover/movie" : null, { with_genres: g?.id ?? 0, sort_by: "popularity.desc" });

  if (!g) return <Navigate to="/" />;
  const name = gname(g, lang);

  return (
    <>
      <div className="page wrap">
        <h1 className="page-title">{name}</h1>
      </div>
      {tvD.isLoading || mvD.isLoading ? (
        <SkeletonRows count={2} />
      ) : (
        <>
          <MediaRow title={`${t("tv")} — ${name}`} items={tvD.data?.results} type="tv" />
          <section className="section wrap fade">
            <div className="sec-head">
              <h2 className="sec-title">{`${t("movies")} — ${name}`}</h2>
            </div>
            {mvD.data?.results?.length ? (
              <div className="grid">
                {mvD.data.results.map((r: any) => (
                  <MediaCard item={r} type="movie" key={r.id} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("noResults")} />
            )}
          </section>
        </>
      )}
    </>
  );
}
