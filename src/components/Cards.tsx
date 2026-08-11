import { Link } from "@tanstack/react-router";
import { useRef, type ReactNode } from "react";
import { img, rating, yr } from "@/lib/tmdb";

export const PlayIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export type Media = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type?: string;
  genre_ids?: number[];
  overview?: string;
};

export const kindOf = (item: Media, type?: "movie" | "tv") =>
  type === "tv" || item.media_type === "tv" || (!item.title && !!item.name) ? "tv" : "movie";

export function MediaCard({ item, type }: { item: Media; type?: "movie" | "tv" | undefined }) {
  const kind = kindOf(item, type);
  const title = item.title || item.name || "";
  return (
    <Link
      className="card"
      to={kind === "tv" ? "/tv/$id" : "/movie/$id"}
      params={{ id: String(item.id) }}
    >
      <div className="poster">
        <img src={img(item.poster_path)} alt={title} loading="lazy" />
        {!!item.vote_average && <span className="rating-badge">★ {rating(item.vote_average)}</span>}
        <div className="play-hint">
          <span className="play-circle">
            <PlayIcon size={20} />
          </span>
        </div>
      </div>
      <div className="card-title">{title}</div>
      <div className="card-sub">{yr(item.release_date || item.first_air_date)}</div>
    </Link>
  );
}

export function Top10Card({ item, index }: { item: Media; index: number }) {
  const kind = kindOf(item);
  return (
    <Link
      className="card top10"
      to={kind === "tv" ? "/tv/$id" : "/movie/$id"}
      params={{ id: String(item.id) }}
    >
      <span className="rank">{index + 1}</span>
      <div className="poster">
        <img src={img(item.poster_path)} loading="lazy" alt={item.title || item.name || ""} />
      </div>
    </Link>
  );
}

export function Row({
  title,
  children,
  link,
  action,
}: {
  title: ReactNode;
  children: ReactNode;
  link?: ReactNode;
  action?: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: "smooth" });
  };
  return (
    <section className="section wrap fade">
      <div className="sec-head">
        <h2 className="sec-title">{title}</h2>
        {link}
        {action}
      </div>
      <div className="row">
        <button className="arrow prev" aria-label="Previous" onClick={() => scroll(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" />
          </svg>
        </button>
        <button className="arrow next" aria-label="Next" onClick={() => scroll(1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" />
          </svg>
        </button>
        <div className="row-track" ref={track}>
          {children}
        </div>
      </div>
    </section>
  );
}

export function MediaRow({
  title,
  items,
  type,
  link,
  limit = 20,
}: {
  title: ReactNode;
  items?: Media[] | undefined;
  type?: "movie" | "tv" | undefined;
  link?: ReactNode;
  limit?: number;
}) {
  if (!items?.length) return null;
  return (
    <Row title={title} link={link}>
      {items.slice(0, limit).map((it) => (
        <div className="slide" key={`${it.id}-${it.media_type ?? type ?? ""}`}>
          <MediaCard item={it} type={type} />
        </div>
      ))}
    </Row>
  );
}

export function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <section className="section wrap" key={i}>
          <div className="sec-head">
            <div className="skeleton" style={{ width: 220, height: 28 }} />
          </div>
          <div className="sk-row">
            {Array.from({ length: 7 }, (_, j) => (
              <div className="sk-card" key={j}>
                <div className="skeleton sk-poster" />
                <div className="skeleton" style={{ height: 14, width: "75%", marginTop: 9 }} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}