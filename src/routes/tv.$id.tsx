import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";

const REMOVED_TV_IDS = new Set(["103815", "114655"]);

export const Route = createFileRoute("/tv/$id")({
  loader: async ({ params }) => {
    if (!/^\d+$/.test(params.id) || REMOVED_TV_IDS.has(params.id)) throw notFound();
    const show = await tmdb(`/tv/${params.id}`, { append_to_response: "credits,videos,external_ids,recommendations,similar" }, "en");
    if (!show || show.__missingKey || !show.id) throw notFound();
    return { show };
  },
  head: ({ loaderData, params }) => {
    const show = loaderData?.show;
    const showTitle = show?.name || show?.original_name || "TV Show";
    const originalTitle = show?.original_name && show.original_name !== showTitle ? show.original_name : "";
    const year = show?.first_air_date ? show.first_air_date.slice(0, 4) : "";
    const country = show?.origin_country?.[0] || show?.production_countries?.[0]?.name || "";
    const genre = show?.genres?.[0]?.name || "";
    const currentYear = new Date().getUTCFullYear();
    const firstYear = Number(year || 0);
    const popularity = Number(show?.popularity || 0);
    const lastAirYear = Number(show?.last_air_date?.slice?.(0, 4) || 0);
    const nextAirYear = Number(show?.next_episode_to_air?.air_date?.slice?.(0, 4) || 0);
    // Returning shows/anime qualify from current activity, not only their original release year.
    // Uses fields already returned by the detail request, so there is no extra TMDB request.
    const isActiveNow = lastAirYear >= currentYear - 1 || nextAirYear >= currentYear;
    const isCurrentlyPopular = popularity >= 35 || ((firstYear >= currentYear - 1 || isActiveNow) && popularity >= 10);
    const isAnime = show?.genres?.some((g: { name?: string }) => g?.name === "Animation") && (show?.original_language === "ja" || show?.origin_country?.includes("JP"));

    const standardTitle = `${showTitle}${year ? ` (${year})` : ""} – ${country ? `${country} TV Series` : "TV Series"} | Cimaly`;
    const arabicPopularTitle = isAnime
      ? `${showTitle}${year ? ` (${year})` : ""} مترجم – مشاهدة الأنمي | Cimaly`
      : `${showTitle}${year ? ` (${year})` : ""} مترجم – مشاهدة المسلسل | Cimaly`;
    const title = isCurrentlyPopular ? arabicPopularTitle : standardTitle;

    const seoIntro = [`${showTitle}${year ? ` (${year})` : ""}`, originalTitle ? `also known as ${originalTitle}` : "", country ? `is a ${country}${genre ? ` ${genre}` : ""} TV series` : genre ? `is a ${genre} TV series` : ""].filter(Boolean).join(" ");
    const overview = show?.overview?.trim() || "";
    const standardDescription = overview ? `${seoIntro}. ${overview}` : `${seoIntro}. Discover seasons, episodes, cast, release information and more on Cimaly.`;
    const arabicDescription = isAnime
      ? `مشاهدة ${showTitle}${year ? ` (${year})` : ""} مترجم بالعربية. تابع الحلقات وتعرف على القصة والشخصيات وتفاصيل الأنمي على Cimaly.`
      : `مشاهدة مسلسل ${showTitle}${year ? ` (${year})` : ""} مترجم بالعربية. تابع الحلقات وتعرف على القصة وطاقم العمل وتفاصيل المسلسل على Cimaly.`;
    const description = isCurrentlyPopular ? arabicDescription : standardDescription;
    const image = show?.poster_path ? `${IMG}w780${show.poster_path}` : undefined;
    const canonical = `https://cimaly.cc/tv/${params.id}`;
    return { meta: [
      { title }, { name: "description", content: description.slice(0, 160) },
      { property: "og:title", content: title }, { property: "og:description", content: description.slice(0, 160) },
      { property: "og:type", content: "video.tv_show" }, { property: "og:url", content: canonical },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: title },
      { name: "twitter:description", content: description.slice(0, 160) }, ...(image ? [{ name: "twitter:image", content: image }] : []),
    ], links: [{ rel: "canonical", href: canonical }] };
  },
  component: TvDetailPage,
});

function TvDetailPage() {
  const { id } = Route.useParams();
  const { show } = Route.useLoaderData();
  return <DetailPage type="tv" id={id} initialData={show} />;
}
