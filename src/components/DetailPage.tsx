import { Link } from "@tanstack/react-router";
import { IMG, PLACEHOLDER, fdate, img, rating, useTmdb, yr } from "@/lib/tmdb";
import { useLang } from "@/lib/i18n";
import { EmptyState, MediaRow, PlayIcon, SkeletonRows } from "./Cards";
import { SeasonExplorer } from "./SeasonExplorer";
import { toggleList, useMyList } from "@/lib/storage";

export function DetailPage({ type, id }: { type: "movie" | "tv"; id: string }) {
  const { t, lang } = useLang();
  const list = useMyList();
  const { data, isLoading } = useTmdb(
    `/${type}/${id}`,
    { append_to_response: "credits,videos,external_ids,recommendations,similar" },
    true,
  );

  if (isLoading)
    return (
      <>
        <div className="page wrap">
          <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
        </div>
        <SkeletonRows count={2} />
      </>
    );

  if (!data || data.__missingKey)
    return (
      <div className="page wrap">
        <EmptyState title={data?.__missingKey ? t("tmdbErr") : t("tmdbErr")} />
      </div>
    );

  const isTv = type === "tv";
  const title = data.title || data.name || "";
  const orig = data.original_title || data.original_name;
  const director = (data.credits?.crew || []).find((c: any) => c.job === "Director");
  const trailerV = (data.videos?.results || []).find((v: any) => v.site === "YouTube" && v.type === "Trailer");
  const castList = (data.credits?.cast || []).slice(0, 14);
  const firstSeason =
    (data.seasons || []).find((s: any) => s.season_number > 0 && s.episode_count > 0)?.season_number || 1;
  const listed = list.some((i) => i.type === type && i.id === Number(id));

  return (
    <>
      <div className="detail-hero fade">
        <div className="detail-bg">
          {data.backdrop_path && <img src={IMG + "original" + data.backdrop_path} alt="" />}
        </div>
        <div className="wrap detail-in">
          <div className="detail-poster">
            <img src={img(data.poster_path, "w500")} alt={title} />
          </div>
          <div className="info" style={{ flex: 1, minWidth: 0 }}>
            <h1 className="detail-title">{title}</h1>
            {orig && orig !== title && (
              <p className="detail-orig">
                {t("originalTitle")}: {orig}
              </p>
            )}
            <div className="detail-meta">
              <span className="star" style={{ color: "var(--amber)", fontWeight: 700 }}>
                ★ {rating(data.vote_average)}
              </span>
              <span>{yr(data.release_date || data.first_air_date)}</span>
              {!isTv && data.runtime ? (
                <span>
                  {Math.floor(data.runtime / 60)}h {data.runtime % 60}
                  {t("min")}
                </span>
              ) : null}
              {isTv && (
                <>
                  <span>
                    {data.number_of_seasons || 0} {t("seasons")}
                  </span>
                  <span>
                    {data.number_of_episodes || 0} {t("episodes")}
                  </span>
                </>
              )}
              {data.production_countries?.[0] && <span>{data.production_countries[0].name}</span>}
              <span>{(data.original_language || "").toUpperCase()}</span>
            </div>
            <div className="genre-pills">
              {(data.genres || []).map((g: any) => (
                <span className="pill" key={g.id}>
                  {g.name}
                </span>
              ))}
            </div>
            {data.overview && <p className="detail-ov">{data.overview}</p>}
            <dl className="facts">
              {director && (
                <div>
                  <dt>{t("director")}</dt>
                  <dd>{director.name}</dd>
                </div>
              )}
              {data.status && (
                <div>
                  <dt>{t("status")}</dt>
                  <dd>{data.status}</dd>
                </div>
              )}
              {!isTv && data.release_date && (
                <div>
                  <dt>{t("releaseDate")}</dt>
                  <dd>{fdate(data.release_date, lang)}</dd>
                </div>
              )}
              {isTv && data.first_air_date && (
                <div>
                  <dt>{t("firstAir")}</dt>
                  <dd>{fdate(data.first_air_date, lang)}</dd>
                </div>
              )}
              {isTv && data.last_air_date && (
                <div>
                  <dt>{t("lastAir")}</dt>
                  <dd>{fdate(data.last_air_date, lang)}</dd>
                </div>
              )}
              {isTv && data.networks?.length ? (
                <div>
                  <dt>{t("network")}</dt>
                  <dd>{data.networks.map((n: any) => n.name).join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            <div className="detail-btns">
              {isTv ? (
                <Link
                  className="btn btn-brand"
                  to="/watch/tv/$id/$season/$episode"
                  params={{ id, season: String(firstSeason), episode: "1" }}
                >
                  <PlayIcon />
                  {t("watchNow")}
                </Link>
              ) : (
                <Link className="btn btn-brand" to="/watch/movie/$id" params={{ id }}>
                  <PlayIcon />
                  {t("watchNow")}
                </Link>
              )}
              <button
                className="btn btn-dark"
                onClick={() =>
                  toggleList({
                    type,
                    id: Number(id),
                    title,
                    poster: data.poster_path,
                    r: data.vote_average || 0,
                    y: yr(data.release_date || data.first_air_date),
                  })
                }
              >
                {listed ? t("inList") : "+ " + t("addList")}
              </button>
              {trailerV && (
                <a
                  className="btn btn-ghost"
                  target="_blank"
                  rel="noopener"
                  href={`https://www.youtube.com/watch?v=${trailerV.key}`}
                >
                  ▶ {t("trailer")}
                </a>
              )}
              {data.external_ids?.imdb_id && (
                <a
                  className="btn btn-ghost"
                  style={{ color: "var(--amber)" }}
                  target="_blank"
                  rel="noopener"
                  href={`https://www.imdb.com/title/${data.external_ids.imdb_id}/`}
                >
                  IMDb
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {isTv && data.seasons?.length ? (
        <section className="section wrap">
          <div className="sec-head">
            <h2 className="sec-title">
              {t("seasons")} &amp; {t("episodes")}
            </h2>
          </div>
          <SeasonExplorer tvId={Number(id)} seasons={data.seasons} />
        </section>
      ) : null}

      {castList.length ? (
        <section className="section wrap">
          <div className="sec-head">
            <h2 className="sec-title">{t("cast")}</h2>
          </div>
          <div className="row">
            <div className="row-track">
              {castList.map((p: any) => (
                <div className="cast-item" key={p.id + "-" + p.character}>
                  <div className="ph">
                    <img src={p.profile_path ? IMG + "w185" + p.profile_path : PLACEHOLDER} loading="lazy" alt="" />
                  </div>
                  <div className="cast-n">{p.name}</div>
                  <div className="cast-c">{p.character || ""}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <MediaRow title={t("recommendations")} items={data.recommendations?.results} type={type} />
      <MediaRow title={t("similar")} items={data.similar?.results} type={type} />
    </>
  );
}
