import { createFileRoute, notFound } from "@tanstack/react-router";
import { EmptyState, MediaCard, MediaRow, SkeletonRows } from "@/components/Cards";
import { COUNTRIES } from "@/lib/catalog";
import { cname, useLang } from "@/lib/i18n";
import { tmdb, useTmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/country/$code")({
  loader: async ({ params }) => {
    const c = COUNTRIES.find((item) => item.c === params.code);
    if (!c) throw notFound();
    const up = params.code.toUpperCase();
    const [tv, movie] = await Promise.all([
      tmdb("/discover/tv", { with_origin_country: up, sort_by: "popularity.desc" }, "en"),
      tmdb("/discover/movie", { with_origin_country: up, sort_by: "popularity.desc" }, "en"),
    ]);
    if (tv?.__unavailable && movie?.__unavailable) throw new Error("TMDB temporarily unavailable");
    return { tv, movie };
  },
  head: ({ params }) => {
  const country = COUNTRIES.find((x) => x.c === params.code);
  const countryName = country ? cname(country, "en") : params.code.toUpperCase();

  return {
    meta: [
      {
        title: `${countryName} Movies & TV Shows — Cimaly`,
      },
      {
        name: "description",
        content: `Discover movies and TV shows from ${countryName} on Cimaly. Browse popular, trending and recent titles.`,
      },
      {
        property: "og:title",
        content: `${countryName} Movies & TV Shows — Cimaly`,
      },
      {
        property: "og:description",
        content: `Discover movies and TV shows from ${countryName} on Cimaly.`,
      },
    ],

    links: [
      {
        rel: "canonical",
        href: `https://cimaly.cc/country/${params.code}`,
      },
    ],
  };
},
  component: CountryPage,
});

function CountryPage() {
  const { code } = Route.useParams();
  const { t, lang } = useLang();
  const { tv: initialTv, movie: initialMovie } = Route.useLoaderData();
  const c = COUNTRIES.find((x) => x.c === code);
  const up = (code || "").toUpperCase();
  const tvD = useTmdb(c ? "/discover/tv" : null, { with_origin_country: up, sort_by: "popularity.desc" }, false, lang === "en" && initialTv?.results ? initialTv : undefined);
  const mvD = useTmdb(c ? "/discover/movie" : null, { with_origin_country: up, sort_by: "popularity.desc" }, false, lang === "en" && initialMovie?.results ? initialMovie : undefined);
  const newD = useTmdb(c ? "/discover/tv" : null, {
    with_origin_country: up,
    sort_by: "first_air_date.desc",
    "vote_count.gte": 5,
  });

  const name = cname(c, lang);

  return (
    <>
      <div className="page wrap">
        <h1 className="page-title">{name}</h1>
        <p className="text-muted-foreground">Discover movies and TV shows from {c?.en || name}, including popular and recent titles.</p>
      </div>
      {tvD.isLoading ? (
        <SkeletonRows count={2} />
      ) : (
        <>
          <MediaRow title={`${t("tv")} — ${name}`} items={tvD.data?.results} type="tv" />
          <MediaRow title={`${t("movies")} — ${name}`} items={mvD.data?.results} type="movie" />
          <section className="section wrap fade">
            <div className="sec-head">
              <h2 className="sec-title">{t("newest")}</h2>
            </div>
            {newD.data?.results?.length ? (
              <div className="grid">
                {newD.data.results.map((r: any) => (
                  <MediaCard item={r} type="tv" key={r.id} />
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
