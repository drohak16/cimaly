import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { fdate, rating, useTmdb, yr } from "@/lib/tmdb";
import { EmptyState, MediaRow } from "./Cards";
import { SeasonExplorer } from "./SeasonExplorer";
import { recordWatch } from "@/lib/storage";

const SERVERS = [
  {
    name: "Server 1",
    movie: (id: string) => `https://vaplayer.ru/embed/movie/${id}`,
    tv: (id: string, s: number, e: number) => `https://vaplayer.ru/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'Server 2',
    movie: (imdbId, tmdbId) => `https://vidsrcme.ru/embed/movie/${imdbId || tmdbId}`,
    tv: (tmdbId, s, e) => `https://vidsrcme.ru/embed/tv/${tmdbId}/${s}/${e}`,
  },
];

export function WatchPage({
  type,
  id,
  season,
  episode,
}: {
  type: "movie" | "tv";
  id: string;
  season?: number;
  episode?: number;
}) {
  const { t, lang } = useLang();
  const isTv = type === "tv";
  const s = season ?? 1;
  const e = episode ?? 1;
  const [serverIdx, setServerIdx] = useState(0);

  const { data, isLoading } = useTmdb(`/${type}/${id}`, { append_to_response: "external_ids,recommendations" }, true);
  const { data: seasonData } = useTmdb(isTv ? `/tv/${id}/season/${s}` : null);

  useEffect(() => setServerIdx(0), [id, s, e]);

  useEffect(() => {
    if (!data || data.__missingKey) return;
    recordWatch({
      type,
      id: Number(id),
      ...(isTv ? { s, e } : {}),
      title: data.title || data.name || "",
      poster: data.poster_path,
      p: 8,
    });
  }, [data, id, type, isTv, s, e]);

  if (isLoading)
    return (
      <div className="watch-wrap">
        <div className="skeleton" style={{ aspectRatio: "16/9", borderRadius: 14 }} />
      </div>
    );

  if (!data || data.__missingKey)
    return (
      <div className="page wrap">
        <EmptyState title={t("tmdbErr")} />
      </div>
    );

  const title = data.title || data.name || "";
  const movieKey = data.external_ids?.imdb_id || id;
  const src = isTv ? SERVERS[serverIdx]!.tv(id, s, e) : SERVERS[serverIdx]!.movie(String(movieKey));

  const epMeta = (seasonData?.episodes || []).find((x: any) => x.episode_number === e) || null;
  const sNums: number[] = (data.seasons || [])
    .filter((x: any) => x.season_number > 0 && x.episode_count > 0)
    .map((x: any) => x.season_number)
    .sort((a: number, b: number) => a - b);
  const maxE = seasonData?.episodes?.length
    ? Math.max(...seasonData.episodes.map((x: any) => x.episode_number))
    : e;

  let prev: { season: number; episode: number } | null = null;
  let next: { season: number; episode: number } | null = null;
  if (isTv) {
    if (e > 1) prev = { season: s, episode: e - 1 };
    else {
      const ps = sNums.filter((x) => x < s).pop();
      if (ps) {
        const cnt = (data.seasons || []).find((x: any) => x.season_number === ps)?.episode_count || 1;
        prev = { season: ps, episode: cnt };
      }
    }
    if (e < maxE) next = { season: s, episode: e + 1 };
    else {
      const ns = sNums.find((x) => x > s);
      if (ns) next = { season: ns, episode: 1 };
    }
  }

  return (
    <>
      <div className="watch-wrap fade">
        <div className="screen">
          <iframe
            key={src}
            src={src}
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="origin"
            title={title}
          />
        </div>
        <div className="servers">
          <span className="lbl">{t("servers")}</span>
          {SERVERS.map((sv, i) => (
            <button
              key={sv.name}
              className={`server-btn${i === serverIdx ? " on" : ""}`}
              onClick={() => setServerIdx(i)}
            >
              {sv.name}
            </button>
          ))}
        </div>
        <p className="notice">{t("embedNotice")}</p>
        <div className="watch-info">
          <p className="now-lbl">{t("nowWatching")}</p>
          <h1 className="watch-title">
            <Link to={isTv ? "/tv/$id" : "/movie/$id"} params={{ id }}>
              {title}
            </Link>
          </h1>
          {isTv && (
            <p className="watch-meta" style={{ color: "#e4e4e7", fontWeight: 600 }}>
              {t("season")} {s} · {t("episode")} {e}
              {epMeta?.name ? ` — ${epMeta.name}` : ""}
            </p>
          )}
          <p className="watch-meta">
            ★ {rating(data.vote_average)} · {yr(data.release_date || data.first_air_date)}
            {!isTv && data.runtime ? ` · ${Math.floor(data.runtime / 60)}h ${data.runtime % 60}${t("min")}` : ""}
            {isTv && epMeta?.air_date ? ` · ${t("airDate")}: ${fdate(epMeta.air_date, lang)}` : ""}
          </p>
          {(epMeta?.overview || data.overview) && (
            <p className="watch-meta" style={{ marginTop: 10, lineHeight: 1.6 }}>
              {epMeta?.overview || data.overview}
            </p>
          )}
          {isTv && (
            <div className="epnav">
              {prev && (
                <Link
                  className="btn btn-dark"
                  to="/watch/tv/$id/$season/$episode"
                  params={{ id, season: String(prev.season), episode: String(prev.episode) }}
                >
                  ‹ {t("prevEp")}
                </Link>
              )}
              {next && (
                <Link
                  className="btn btn-dark"
                  to="/watch/tv/$id/$season/$episode"
                  params={{ id, season: String(next.season), episode: String(next.episode) }}
                >
                  {t("nextEp")} ›
                </Link>
              )}
            </div>
          )}
        </div>
        {isTv && data.seasons?.length ? (
          <section className="section">
            <div className="sec-head">
              <h2 className="sec-title">{t("episodes")}</h2>
            </div>
            <SeasonExplorer tvId={Number(id)} seasons={data.seasons} activeS={s} activeE={e} />
          </section>
        ) : null}
      </div>
      <MediaRow title={t("recommendations")} items={data.recommendations?.results} type={type} />
    </>
  );
}
