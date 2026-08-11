import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { COUNTRIES, GENRES } from "@/lib/catalog";
import { cname, gname, useLang } from "@/lib/i18n";
import { img, rating, tmdb, yr } from "@/lib/tmdb";

type Sug = { id: number; title?: string; name?: string; media_type?: string; poster_path?: string | null; release_date?: string; first_air_date?: string; vote_average?: number };

export function Header() {
  const { t, lang, toggleLang } = useLang();
  const navigate = useNavigate();
  const [solid, setSolid] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drop, setDrop] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [sugs, setSugs] = useState<Sug[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onClick = () => setDrop(null);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const closeAll = () => {
    setSugs([]);
    setSearchOpen(false);
    setMobileOpen(false);
  };

  const onType = (v: string) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setSugs([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const data = await tmdb("/search/multi", { query: v.trim(), include_adult: false }, lang);
      setSugs(((data?.results as Sug[]) || []).filter((r) => r.media_type !== "person").slice(0, 7));
    }, 300);
  };

  const goSearch = (v: string) => {
    if (!v.trim()) return;
    closeAll();
    navigate({ to: "/search", search: { q: v.trim() } });
  };

  return (
    <header className={`header${solid ? " solid" : ""}`}>
      <div className="header-in">
        <Link to="/" className="logo" onClick={closeAll}>
          Cimaly
        </Link>
        <nav className="nav">
          <Link to="/">{t("home")}</Link>
          <Link to="/movies">{t("movies")}</Link>
          <Link to="/tv">{t("tv")}</Link>
          <div className="dropdown">
            <button
              className="navbtn"
              onClick={(e) => {
                e.stopPropagation();
                setDrop(drop === "g" ? null : "g");
              }}
            >
              {t("genres")} ▾
            </button>
            <div className={`dropdown-panel${drop === "g" ? " open" : ""}`}>
              {GENRES.map((g) => (
                <Link key={g.slug} to="/genre/$slug" params={{ slug: g.slug }} onClick={closeAll}>
                  {gname(g, lang)}
                </Link>
              ))}
            </div>
          </div>
          <div className="dropdown">
            <button
              className="navbtn"
              onClick={(e) => {
                e.stopPropagation();
                setDrop(drop === "c" ? null : "c");
              }}
            >
              {t("countries")} ▾
            </button>
            <div className={`dropdown-panel${drop === "c" ? " open" : ""}`}>
              {COUNTRIES.map((c) => (
                <Link key={c.c} to="/country/$code" params={{ code: c.c }} onClick={closeAll}>
                  {cname(c, lang)}
                </Link>
              ))}
            </div>
          </div>
          <Link to="/movies" search={{ sort: "primary_release_date.desc" }}>
            {t("latest")}
          </Link>
          <Link to="/movies" search={{ sort: "vote_average.desc" }}>
            {t("topRated")}
          </Link>
          <Link to="/mylist">{t("myList")}</Link>
        </nav>
        <div className="hdr-actions">
          <button
            className="icon-btn"
            aria-label="Search"
            onClick={() => {
              setSearchOpen((o) => !o);
              setTimeout(() => inputRef.current?.focus(), 30);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
          </button>
          <button className="lang-btn" onClick={toggleLang}>
            {lang === "en" ? "العربية" : "English"}
          </button>
          <button className="icon-btn hamburger" aria-label="Menu" onClick={() => setMobileOpen((o) => !o)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`search-wrap${searchOpen ? " open" : ""}`}>
        <div className="search-in">
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            autoComplete="off"
            placeholder={t("searchPh")}
            value={value}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goSearch(value);
            }}
          />
          {sugs.length > 0 && (
            <div className="suggestions">
              {sugs.map((r) => {
                const type = r.media_type === "tv" ? "tv" : "movie";
                return (
                  <div
                    className="sug-item"
                    key={`${type}-${r.id}`}
                    onClick={() => {
                      closeAll();
                      navigate({
                        to: type === "tv" ? "/tv/$id" : "/movie/$id",
                        params: { id: String(r.id) },
                      });
                    }}
                  >
                    <img src={img(r.poster_path, "w185")} alt="" loading="lazy" />
                    <div>
                      <div className="sug-t">{r.title || r.name}</div>
                      <div className="sug-s">
                        {type === "tv" ? t("tv") : t("movies")} · {yr(r.release_date || r.first_air_date)} · ★{" "}
                        {rating(r.vote_average)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <nav className={`mobile-nav${mobileOpen ? " open" : ""}`}>
        <Link to="/" onClick={closeAll}>
          {t("home")}
        </Link>
        <Link to="/movies" onClick={closeAll}>
          {t("movies")}
        </Link>
        <Link to="/tv" onClick={closeAll}>
          {t("tv")}
        </Link>
        <Link to="/mylist" onClick={closeAll}>
          {t("myList")}
        </Link>
        <p className="mob-label">{t("genres")}</p>
        <div className="chip-row">
          {GENRES.slice(0, 12).map((g) => (
            <Link className="chip" key={g.slug} to="/genre/$slug" params={{ slug: g.slug }} onClick={closeAll}>
              {gname(g, lang)}
            </Link>
          ))}
        </div>
        <p className="mob-label">{t("countries")}</p>
        <div className="chip-row">
          {COUNTRIES.slice(0, 12).map((c) => (
            <Link className="chip" key={c.c} to="/country/$code" params={{ code: c.c }} onClick={closeAll}>
              {cname(c, lang)}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}