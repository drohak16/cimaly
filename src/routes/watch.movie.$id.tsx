import { createFileRoute, notFound } from "@tanstack/react-router";
import { WatchPage } from "@/components/WatchPage";
import { tmdb } from "@/lib/tmdb";

const BASE_URL = "https://cimaly.cc";
const REMOVED_MOVIE_IDS = new Set(["823482", "49021"]);

export const Route = createFileRoute("/watch/movie/$id")({
  loader: async ({ params }) => {
    if (!/^\d+$/.test(params.id)) throw notFound();
    const movie = await tmdb(`/movie/${params.id}`, { append_to_response: "external_ids" }, "en");
    if (!movie || movie.__missingKey || !movie.id) throw notFound();
    return { id: params.id, movie };
  },
  head: ({ loaderData }) => {
    const id = loaderData?.id ?? "";
    const movie = loaderData?.movie;
    const title = movie?.title || "Movie";
    const year = movie?.release_date?.slice(0, 4) || "";
    const canonical = `${BASE_URL}/movie/${id}`;
    const seoTitle = `${title}${year ? ` (${year})` : ""} | Cimaly`;
    return {
      meta: [
        { title: seoTitle },
        { name: "robots", content: "noindex, follow" },
        { name: "googlebot", content: "noindex, follow" },
        { property: "og:title", content: seoTitle },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: WatchMovieRoute,
});

function WatchMovieRoute() {
  const { id } = Route.useParams();
  const { movie } = Route.useLoaderData();
  const poster = movie?.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : undefined;
  const movieKey = movie?.external_ids?.imdb_id || id;
  const videoObject = movie && poster ? {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: movie.title || movie.original_title || "Movie",
    description: movie.overview || `Watch ${movie.title || movie.original_title || "this movie"} on Cimaly.`,
    thumbnailUrl: [poster],
    ...(movie.release_date ? { uploadDate: `${movie.release_date}T00:00:00Z` } : {}),
    ...(movie.runtime ? { duration: `PT${Math.max(1, Number(movie.runtime))}M` } : {}),
    embedUrl: `https://vaplayer.ru/embed/movie/${movieKey}`,
    url: `${BASE_URL}/watch/movie/${id}`,
  } : null;
  return <>{videoObject ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoObject) }} /> : null}<WatchPage type="movie" id={id} /></>;
}
