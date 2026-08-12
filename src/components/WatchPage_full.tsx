import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { fdate, rating, useTmdb, yr } from "@/lib/tmdb";
import { EmptyState, MediaRow } from "./Cards";
import { SeasonExplorer } from "./SeasonExplorer";
import { recordWatch } from "@/lib/storage";

const pad2 = (n: number) => String(n).padStart(2, "0");

// Turn a title into anaplayer's slug (transliterate Turkish letters, hyphenate)
function slugify(title: string): string {
  const map: Record<string, string> = {
    ğ: "g", Ğ: "g", ı: "i", İ: "i", ş: "s", Ş: "s",
    ö: "o", Ö: "o", ç: "c", Ç: "c", ü: "u", Ü: "u",
  };
  return (title || "")
    .replace(/[ğĞıİşŞöÖçÇüÜ]/g, (c) => map[c] || c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ServerCtx = {
  type: "movie" | "tv";
  id: string;
  imdbId: string;
  slugTitle: string;
  year: string;
  s: number;
  e: number;
};

const SERVERS: { name: string; url: (c: ServerCtx) => string }[] = [
  {
    name: "Server 1",
    url: (c) =>
      c.type === "movie"
        ? `https://vaplayer.ru/embed/movie/${c.imdbId || c.id}`
        : `https://vaplayer.ru/embed/tv/${c.id}/${c.s}/${c.e}`,
  },
  {
    name: "Server 2",
    url: (c) =>
      c.type === "movie"
        ? `https://vidsrcme.ru/embed/movie/${c.imdbId || c.id}`
        : `https://vidsrcme.ru/embed/tv/${c.id}/${c.s}/${c.e}`,
  },
  {
    name: "Server 3",
    url: (c) => {
      const base = c.year ? `${slugify(c.slugTitle)}-${c.year}` : slugify(c.slugTitle);
      const path = c.type === "movie" ? base : `${base}-s${pad2(c.s)}e${pad2(c.e)}`;
      return `https://w.anaplayer.online/albaplayer/${path}/?serv=0`;
    },
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
  const src = SERVERS[serverIdx]!.url({
    type,
    id,
    imdbId: String(data.external_ids?.imdb_id || id),
    slugTitle: data.original_title || data.original_name || title,
    year: yr(data.release_date || data.first_air_date),
    s,
    e,
  });

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
