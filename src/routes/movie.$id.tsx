import { createFileRoute, notFound } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";

const REMOVED_MOVIE_IDS = new Set(["823482"]);

export const Route = createFileRoute("/movie/$id")({
  loader: async ({ params }) => {
    if (!/^\d+$/.test(params.id) || REMOVED_MOVIE_IDS.has(params.id)) {
      throw notFound();
    }

    const movie = await tmdb(
      `/movie/${params.id}`,
      { append_to_response: "credits,videos,external_ids,recommendations,similar" },
      "en",
    );

    if (!movie || movie.__missingKey || !movie.id) {
      throw notFound();
    }

    return { movie };
  },

  head: ({ loaderData, params }) => {
    const movie = loaderData?.movie;

    const movieTitle = movie?.title || movie?.original_title || "Movie";
    const originalTitle = movie?.original_title && movie.original_title !== movieTitle ? movie.original_title : "";
    const year = movie?.release_date ? movie.release_date.slice(0, 4) : "";
    const country = movie?.production_countries?.[0]?.name || "";
    const genre = movie?.genres?.[0]?.name || "";

    const titleQualifier = country ? `${country} Movie` : "Movie";
    const title = `${movieTitle}${year ? ` (${year})` : ""} – ${titleQualifier} | Cimaly`;

    const seoIntro = [
      `${movieTitle}${year ? ` (${year})` : ""}`,
      originalTitle ? `also known as ${originalTitle}` : "",
      country ? `is a ${country}${genre ? ` ${genre}` : ""} movie` : genre ? `is a ${genre} movie` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const overview = movie?.overview?.trim() || "";
    const description = overview
      ? `${seoIntro}. ${overview}`
      : `${seoIntro}. Discover cast, release information, details and more on Cimaly.`;

    const image = movie?.poster_path ? `${IMG}w780${movie.poster_path}` : undefined;
    const canonical = `https://cimaly.cc/movie/${params.id}`;

    return {
      meta: [
        { title },
        { name: "description", content: description.slice(0, 160) },
        { property: "og:title", content: title },
        { property: "og:description", content: description.slice(0, 160) },
        { property: "og:type", content: "video.movie" },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description.slice(0, 160) },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },

  component: MovieDetailPage,
});

function MovieDetailPage() {
  const { id } = Route.useParams();
  const { movie } = Route.useLoaderData();

  return <DetailPage type="movie" id={id} initialData={movie} />;
}
