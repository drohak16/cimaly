import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmptyState, MediaCard, MediaRow, SkeletonRows } from "@/components/Cards";
import { GENRES } from "@/lib/catalog";
import { gname, useLang } from "@/lib/i18n";
import { tmdb, useTmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/genre/$slug")({
  beforeLoad: ({ params }) => {
    if (!GENRES.some((genre) => genre.slug === params.slug)) {
      throw notFound();
    }
  },
  loader: async ({ params }) => {
    const g = GENRES.find((item) => item.slug === params.slug);
    if (!g) throw notFound();
    const [tv, movie] = await Promise.all([
      tmdb("/discover/tv", { with_genres: g.tv ?? 0, sort_by: "popularity.desc" }, "en"),
      tmdb("/discover/movie", { with_genres: g.id ?? 0, sort_by: "popularity.desc" }, "en"),
    ]);
    if (tv?.__unavailable && movie?.__unavailable) throw new Error("TMDB temporarily unavailable");
    return { tv, movie };
  },
  head: ({ params }) => {
    const genreName = params.slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return {
      meta: [
        { title: `${genreName} Movies & TV Shows — Cimaly` },
        {
          name: "description",
          content: `Explore ${genreName} movies and TV shows on Cimaly. Discover popular and trending titles from around the world.`,
        },
        { property: "og:title", content: `${genreName} Movies & TV Shows — Cimaly` },
        { property: "og:description", content: `Explore ${genreName} movies and TV shows on Cimaly.` },
      ],
      links: [{ rel: "canonical", href: `https://cimaly.cc/genre/${params.slug}` }],
    };
  },
  component: GenrePage,
});

function GenrePage() {
  const { slug } = Route.useParams();
  const { t, lang } = useLang();
  const { tv: initialTv, movie: initialMovie } = Route.useLoaderData();
  const g = GENRES.find((x) => x.slug === slug)!;
  const tvD = useTmdb("/discover/tv", { with_genres: g.tv ?? 0, sort_by: "popularity.desc" }, false, lang === "en" && initialTv?.results ? initialTv : undefined);
  const mvD = useTmdb("/discover/movie", { with_genres: g.id ?? 0, sort_by: "popularity.desc" }, false, lang === "en" && initialMovie?.results ? initialMovie : undefined);
  const name = gname(g, lang);

  return (
    <>
      <div className="page wrap">
        <h1 className="page-title">{name}</h1>
        <p className="text-muted-foreground">Explore popular {g.en.toLowerCase()} movies and TV shows, including recent releases and highly rated titles.</p>
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
