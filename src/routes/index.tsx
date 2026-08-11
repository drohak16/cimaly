import { createFileRoute, Link } from "@tanstack/react-router";
import { HeroSlider } from "@/components/HeroSlider";
import { EmptyState, MediaRow, PlayIcon, Row, SkeletonRows, Top10Card } from "@/components/Cards";
import { useLang } from "@/lib/i18n";
import { IMG, PLACEHOLDER, useTmdb } from "@/lib/tmdb";
import { clearCw, removeCw, useContinueWatching } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cimaly — Movies & TV Shows" },
      { name: "description", content: "Cimaly — global movies & TV shows, in English and Arabic." },
      { property: "og:title", content: "Cimaly — Movies & TV Shows" },
      { property: "og:description", content: "Global movies & TV shows, in English and Arabic." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useLang();
  const cw = useContinueWatching();

  const trend = useTmdb("/trending/movie/day");
  const trendW = useTmdb("/trending/movie/week");
  const popM = useTmdb("/movie/popular");
  const popTv = useTmdb("/tv/popular");
  const nowP = useTmdb("/movie/now_playing");
  const topM = useTmdb("/movie/top_rated");
  const topTv = useTmdb("/tv/top_rated");
  const upc = useTmdb("/movie/upcoming");
  const tr = useTmdb("/discover/tv", { with_origin_country: "TR", sort_by: "popularity.desc" });
  const kr = useTmdb("/discover/tv", { with_origin_country: "KR", sort_by: "popularity.desc" });
  const trendTv = useTmdb("/trending/tv/day");

  if (trend.isLoading)
    return (
      <>
        <div className="hero">
          <div className="hero-grad1" />
        </div>
        <SkeletonRows count={4} />
      </>
    );

  if (!trend.data || trend.data.__missingKey)
    return (
      <div className="page wrap">
        <EmptyState title={t("tmdbErr")} />
      </div>
    );

  const heroSlides = (trend.data.results || []).filter((m: any) => m.backdrop_path).slice(0, 7);

  return (
    <>
      <HeroSlider items={heroSlides} />

      {cw.length > 0 && (
        <Row
          title={t("continueWatching")}
          action={
            <button className="clear-btn" onClick={clearCw}>
              ✕ {t("clear")}
            </button>
          }
        >
          {cw.map((i) => (
            <div className="slide cw-card" key={`${i.type}-${i.id}`}>
              <Link
                className="card"
                to={i.type === "tv" ? "/watch/tv/$id/$season/$episode" : "/watch/movie/$id"}
                params={
                  i.type === "tv"
                    ? { id: String(i.id), season: String(i.s || 1), episode: String(i.e || 1) }
                    : ({ id: String(i.id) } as never)
                }
              >
                <div className="poster">
                  <img src={i.poster ? IMG + "w342" + i.poster : PLACEHOLDER} loading="lazy" alt="" />
                  <div className="play-hint">
                    <span className="play-circle">
                      <PlayIcon size={20} />
                    </span>
                  </div>
                  <div className="progress">
                    <div style={{ width: `${i.p || 8}%` }} />
                  </div>
                </div>
                <div className="card-title">{i.title}</div>
                {i.type === "tv" && (
                  <div className="card-sub">
                    S{i.s || 1} · E{i.e || 1}
                  </div>
                )}
              </Link>
              <button className="cw-x" onClick={() => removeCw(i.type, i.id)}>
                ✕
              </button>
            </div>
          ))}
        </Row>
      )}

      <Row title={t("top10")}>
        {(trend.data.results || []).slice(0, 10).map((it: any, i: number) => (
          <div className="slide lg" key={it.id}>
            <Top10Card item={it} index={i} />
          </div>
        ))}
      </Row>

      <MediaRow
        title={t("trendingWeek")}
        items={trendW.data?.results}
        type="movie"
        link={
          <Link className="sec-link" to="/movies" search={{ sort: "popularity.desc" }}>
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow
        title={t("popularMovies")}
        items={popM.data?.results}
        type="movie"
        link={
          <Link className="sec-link" to="/movies">
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow
        title={t("popularTv")}
        items={popTv.data?.results}
        type="tv"
        link={
          <Link className="sec-link" to="/tv">
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow title={t("nowPlaying")} items={nowP.data?.results} type="movie" />
      <MediaRow title={t("trendingTv")} items={trendTv.data?.results} type="tv" />
      <MediaRow
        title={t("turkish")}
        items={tr.data?.results}
        type="tv"
        link={
          <Link className="sec-link" to="/country/$code" params={{ code: "tr" }}>
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow
        title={t("korean")}
        items={kr.data?.results}
        type="tv"
        link={
          <Link className="sec-link" to="/country/$code" params={{ code: "kr" }}>
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow
        title={t("topMovies")}
        items={topM.data?.results}
        type="movie"
        link={
          <Link className="sec-link" to="/movies" search={{ sort: "vote_average.desc" }}>
            {t("viewAll")} ›
          </Link>
        }
      />
      <MediaRow title={t("topTv")} items={topTv.data?.results} type="tv" />
      <MediaRow title={t("comingSoon")} items={upc.data?.results} type="movie" />
    </>
  );
}
