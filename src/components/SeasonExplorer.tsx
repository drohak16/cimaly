import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { IMG, PLACEHOLDER, fdate, useTmdb } from "@/lib/tmdb";
import { EmptyState } from "./Cards";

export type Season = { season_number: number; episode_count: number };
export type Episode = {
  episode_number: number;
  name?: string;
  air_date?: string;
  runtime?: number;
  still_path?: string | null;
  overview?: string;
};

export function SeasonExplorer({
  tvId,
  seasons,
  activeS,
  activeE,
}: {
  tvId: number;
  seasons: Season[];
  activeS?: number;
  activeE?: number;
}) {
  const { t, lang } = useLang();
  const usable = seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);
  const [current, setCurrent] = useState<number>(activeS || usable[0]?.season_number || 1);
  const { data, isLoading } = useTmdb(`/tv/${tvId}/season/${current}`);
  const eps: Episode[] = data?.episodes || [];

  return (
    <>
      <div className="season-tabs">
        {usable.map((s) => (
          <button
            key={s.season_number}
            className={`season-tab${s.season_number === current ? " on" : ""}`}
            onClick={() => setCurrent(s.season_number)}
          >
            {t("season")} {s.season_number}{" "}
            <span style={{ opacity: 0.65, fontWeight: 400 }}>({s.episode_count})</span>
          </button>
        ))}
      </div>
      <div>
        {isLoading ? (
          <div className="skeleton" style={{ height: 220, borderRadius: 12 }} />
        ) : eps.length ? (
          <div className="ep-grid">
            {eps.map((ep) => (
              <Link
                key={ep.episode_number}
                className={`ep-card${current === activeS && ep.episode_number === activeE ? " on" : ""}`}
                to="/watch/tv/$id/$season/$episode"
                params={{ id: String(tvId), season: String(current), episode: String(ep.episode_number) }}
              >
                <div className="ep-thumb">
                  <img src={ep.still_path ? IMG + "w300" + ep.still_path : PLACEHOLDER} loading="lazy" alt="" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="ep-t">
                    {ep.episode_number}. {ep.name || `${t("episode")} ${ep.episode_number}`}
                  </div>
                  <div className="ep-d">
                    {fdate(ep.air_date, lang)}
                    {ep.runtime ? ` · ${ep.runtime} ${t("min")}` : ""}
                  </div>
                  <div className="ep-ov">{ep.overview || ""}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t("noResults")} />
        )}
      </div>
    </>
  );
}
