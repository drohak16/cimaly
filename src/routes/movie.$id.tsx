import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/movie/$id")({
  loader: async ({ params }) => {
    const movie = await tmdb(`/movie/${params.id}`, {}, "en");

    return {
      movie: movie && !movie.__missingKey ? movie : null,
    };
  },

  head: ({ loaderData, params }) => {
    const movie = loaderData?.movie;

    const movieTitle =
      movie?.title ||
      movie?.original_title ||
      "Movie";

    const year = movie?.release_date
      ? movie.release_date.slice(0, 4)
      : "";

    const title = `${movieTitle}${year ? ` (${year})` : ""} – Cimaly`;

    const description =
      movie?.overview?.trim() ||
      `Discover ${movieTitle}${year ? ` (${year})` : ""}, cast, details and more on Cimaly.`;

    const image = movie?.poster_path
      ? `${IMG}w780${movie.poster_path}`
      : undefined;

    const canonical = `https://cimaly.cc/movie/${params.id}`;

    return {
      meta: [
        { title },
        {
          name: "description",
          content: description.slice(0, 160),
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description.slice(0, 160),
        },
        {
          property: "og:type",
          content: "video.movie",
        },
        {
          property: "og:url",
          content: canonical,
        },
        ...(image
          ? [
              {
                property: "og:image",
                content: image,
              },
            ]
          : []),
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description.slice(0, 160),
        },
        ...(image
          ? [
              {
                name: "twitter:image",
                content: image,
              },
            ]
          : []),
      ],
      links: [
        {
          rel: "canonical",
          href: canonical,
        },
      ],
    };
  },

  component: MovieDetailPage,
});

function MovieDetailPage() {
  const { id } = Route.useParams();

  return <DetailPage type="movie" id={id} />;
}
