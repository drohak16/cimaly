import { Link } from "@tanstack/react-router";
import { COUNTRIES, GENRES } from "@/lib/catalog";
import { cname, gname, useLang } from "@/lib/i18n";

export function Footer() {
  const { t, lang, setLang } = useLang();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="logo">Cimaly</div>
            <p className="about">{t("about")}</p>
          </div>
          <div>
            <h4>{t("browse")}</h4>
            <ul>
              <li>
                <Link to="/movies">{t("movies")}</Link>
              </li>
              <li>
                <Link to="/tv">{t("tv")}</Link>
              </li>
              <li>
                <Link to="/movies" search={{ sort: "vote_average.desc" }}>
                  {t("topRated")}
                </Link>
              </li>
              <li>
                <Link to="/mylist">{t("myList")}</Link>
              </li>
              {GENRES.slice(0, 4).map((g) => (
                <li key={g.slug}>
                  <Link to="/genre/$slug" params={{ slug: g.slug }}>
                    {gname(g, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{t("countries")}</h4>
            <ul>
              {COUNTRIES.slice(0, 6).map((c) => (
                <li key={c.c}>
                  <Link to="/country/$code" params={{ code: c.c }}>
                    {cname(c, lang)}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 style={{ marginTop: 20 }}>{t("langs")}</h4>
            <ul>
              <li>
                <a onClick={() => setLang("en")} style={{ cursor: "pointer" }}>
                  English
                </a>{" "}
                ·{" "}
                <a onClick={() => setLang("ar")} style={{ cursor: "pointer" }}>
                  العربية
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Cimaly. {t("rights")}
          </span>
          <span>{t("disclaimer")}</span>
        </div>
      </div>
    </footer>
  );
}