import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";
import { jsonLd } from "@/lib/seo";
import { mediaSeoMeta } from "@/lib/seo-metadata";

const REMOVED_MOVIE_IDS = new Set(["823482", "49021"]);

export const Route = createFileRoute("/movie/$id")({
  loader: async ({ params }) => {
    if (!/^\d+$/.test(params.id) || REMOVED_MOVIE_IDS.has(params.id)) throw notFound();
    const movie = await tmdb(`/movie/${params.id}`, { append_to_response: "credits,videos,external_ids,recommendations,similar" }, "en");
    if (movie?.__unavailable) throw new Error("TMDB temporarily unavailable");
    if (!movie || !movie.id) throw notFound();
    return { movie };
  },
  head: ({ loaderData, params }) => {
    const movie = loaderData?.movie;
    const movieTitle = movie?.title || movie?.original_title || "Movie";
    const originalTitle = movie?.original_title && movie.original_title !== movieTitle ? movie.original_title : "";
    const overview = movie?.overview?.trim() || "";
    const { title, description } = mediaSeoMeta(movie, "movie");
    const image = movie?.poster_path ? `${IMG}w780${movie.poster_path}` : undefined;
    const canonical = `https://cimaly.cc/movie/${params.id}`;
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Movie",
      name: movieTitle,
      url: canonical,
      ...(originalTitle ? { alternateName: originalTitle } : {}),
      ...(overview ? { description: overview } : {}),
      ...(image ? { image } : {}),
      ...(movie?.release_date ? { datePublished: movie.release_date } : {}),
      ...(movie?.original_language ? { inLanguage: movie.original_language } : {}),
      ...(movie?.genres?.length ? { genre: movie.genres.map((g: { name: string }) => g.name).filter(Boolean) } : {}),
      ...(movie?.runtime > 0 ? { duration: `PT${Math.round(movie.runtime)}M` } : {}),
      ...(movie?.credits?.cast?.length ? { actor: movie.credits.cast.slice(0, 5).filter((c: { name?: string }) => c.name).map((c: { name: string }) => ({ "@type": "Person", name: c.name })) } : {}),
    };
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "video.movie" }, { property: "og:url", content: canonical },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: "summary_large_image" }, { name: "twitter:title", content: title },
      { name: "twitter:description", content: description }, ...(image ? [{ name: "twitter:image", content: image }] : []),
    ], links: [{ rel: "canonical", href: canonical }], scripts: movie?.id ? [{ type: "application/ld+json", children: jsonLd(structuredData) }] : [] };
  },
  component: MovieDetailPage,
});

function MovieDetailPage() {
  const { id } = Route.useParams();
  const { movie } = Route.useLoaderData();
  return <DetailPage type="movie" id={id} initialData={movie} />;
}
