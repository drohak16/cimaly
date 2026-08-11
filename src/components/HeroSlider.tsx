import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GENRES } from "@/lib/catalog";
import { gname, useLang } from "@/lib/i18n";
import { IMG, rating, yr } from "@/lib/tmdb";
import { PlayIcon, type Media } from "./Cards";

export function HeroSlider({ items }: { items: Media[] }) {
  const { t, lang } = useLang();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % items.length), 6500);
    return () => clearInterval(timer);
  }, [items.length]);

  const genreOf = (ids?: number[]) =>
    (ids || [])
      .map((id) => GENRES.find((g) => g.id === id || g.tv === id))
      .filter(Boolean)
      .slice(0, 3)
      .map((g) => gname(g!, lang));

  return (
    <div className="hero">
      {items.map((m, i) => (
        <div className={`hero-slide${i === idx ? " on" : ""}`} key={m.id}>
          <img src={IMG + "original" + m.backdrop_path} alt="" loading={i > 0 ? "lazy" : "eager"} />
          <div className="hero-grad1" />
          <div className="hero-grad2" />
          <div className="hero-content">
            <div className="hero-in">
              <h1 className="hero-title">{m.title || m.name}</h1>
              <div className="hero-meta">
                {genreOf(m.genre_ids).map((g, gi) => (
                  <span key={g} style={{ display: "contents" }}>
                    {gi ? <span className="dot">·</span> : null}
                    <span>{g}</span>
                  </span>
                ))}
                <span className="dot">·</span>
                <span>{yr(m.release_date)}</span>
                <span className="dot">·</span>
                <span className="star">★ {rating(m.vote_average)}</span>
              </div>
              <p className="hero-desc">{m.overview || ""}</p>
              <div className="hero-btns">
                <Link className="btn btn-play" to="/watch/movie/$id" params={{ id: String(m.id) }}>
                  <PlayIcon />
                  {t("play")}
                </Link>
                <Link className="btn btn-dark" to="/movie/$id" params={{ id: String(m.id) }}>
                  ⓘ {t("details")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="hero-dots">
        {items.map((m, i) => (
          <button key={m.id} className={i === idx ? "on" : ""} aria-label={`Slide ${i + 1}`} onClick={() => setIdx(i)} />
        ))}
      </div>
    </div>
  );
}
