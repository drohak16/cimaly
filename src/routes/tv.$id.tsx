import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";
import { jsonLd } from "@/lib/seo";
import { mediaSeoMeta } from "@/lib/seo-metadata";

const REMOVED_TV_IDS = new Set(["103815", "114655"]);

export const Route = createFileRoute("/tv/$id")({
  loader: async ({ params }) => {
    if (!/^\d+$/.test(params.id) || REMOVED_TV_IDS.has(params.id)) throw notFound();
    const show = await tmdb(`/tv/${params.id}`, { append_to_response: "credits,videos,external_ids,recommendations,similar" }, "en");
    if (show?.__unavailable) throw new Error("TMDB temporarily unavailable");
    if (!show || !show.id) throw notFound();
    return { show };
  },
  head: ({ loaderData, params }) => {
    const show = loaderData?.show;
    const showTitle = show?.name || show?.original_name || "TV Show";
    const originalTitle = show?.original_name && show.original_name !== showTitle ? show.original_name : "";
    const overview = show?.overview?.trim() || "";
    const { title, description } = mediaSeoMeta(show, "tv");
    const image = show?.poster_path ? `${IMG}w780${show.poster_path}` : undefined;
    const canonical = `https://cimaly.cc/tv/${params.id}`;
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "TVSeries",
      name: showTitle,
      url: canonical,
      ...(originalTitle ? { alternateName: originalTitle } : {}),
      ...(overview ? { description: overview } : {}),
      ...(image ? { image } : {}),
      ...(show?.first_air_date ? { startDate: show.first_air_date } : {}),
      ...(show?.original_language ? { inLanguage: show.original_language } : {}),
      ...(show?.genres?.length ? { genre: show.genres.map((g: { name: string }) => g.name).filter(Boolean) } : {}),
      ...(show?.number_of_seasons > 0 ? { numberOfSeasons: show.number_of_seasons } : {}),
      ...(show?.number_of_episodes > 0 ? { numberOfEpisodes: show.number_of_episodes } : {}),
      ...(show?.credits?.cast?.length ? { actor: show.credits.cast.slice(0, 5).filter((c: { name?: string }) => c.name).map((c: { name: string }) => ({ "@type": "Person", name: c.name })) } : {}),
    };
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "video.tv_show" }, { property: "og:url", content: canonical },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: title },
      { name: "twitter:description", content: description }, ...(image ? [{ name: "twitter:image", content: image }] : []),
    ], links: [{ rel: "canonical", href: canonical }], scripts: show?.id ? [{ type: "application/ld+json", children: jsonLd(structuredData) }] : [] };
  },
  component: TvDetailPage,
});

function TvDetailPage() {
  const { id } = Route.useParams();
  const { show } = Route.useLoaderData();
  return <DetailPage type="tv" id={id} initialData={show} />;
}
