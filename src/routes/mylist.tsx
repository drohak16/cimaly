import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/Cards";
import { useLang } from "@/lib/i18n";
import { IMG, PLACEHOLDER, rating } from "@/lib/tmdb";
import { toggleList, useMyList } from "@/lib/storage";

export const Route = createFileRoute("/mylist")({
  head: () => ({
    meta: [
      { title: "My List — Cimaly" },
      { name: "description", content: "Your saved movies and TV shows on Cimaly." },
      { property: "og:title", content: "My List — Cimaly" },
      { property: "og:description", content: "Your saved movies and TV shows." },
    ],
  }),
  component: MyListPage,
});

function MyListPage() {
  const { t } = useLang();
  const items = useMyList();
  return (
    <div className="page wrap fade">
      <h1 className="page-title">{t("myList")}</h1>
      {!items.length ? (
        <EmptyState title={t("emptyList")} hint={t("emptyListHint")} />
      ) : (
        <div className="grid">
          {items.map((i) => (
            <div className="cw-card" key={`${i.type}-${i.id}`}>
              <Link className="card" to={i.type === "tv" ? "/tv/$id" : "/movie/$id"} params={{ id: String(i.id) }}>
                <div className="poster">
                  <img src={i.poster ? IMG + "w342" + i.poster : PLACEHOLDER} loading="lazy" alt="" />
                  {i.r ? <span className="rating-badge">★ {rating(i.r)}</span> : null}
                </div>
                <div className="card-title">{i.title}</div>
                <div className="card-sub">{i.y || ""}</div>
              </Link>
              <button className="cw-x" onClick={() => toggleList(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
