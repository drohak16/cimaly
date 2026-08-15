import { createFileRoute } from "@tanstack/react-router";
import { WatchPage } from "@/components/WatchPage";
import { tmdb } from "@/lib/tmdb";

const BASE_URL = "https://cimaly.cc";

export const Route = createFileRoute("/watch/movie/$id")({
  loader: async ({ params }) => {
    const movie = await tmdb(
      `/movie/${params.id}`,
      {
        append_to_response: "external_ids",
      },
      "en",
    );

    if (!movie || movie.__missingKey) {
      return {
        id: params.id,
        movie: null,
      };
    }

    return {
      id: params.id,
      movie,
    };
  },

  head: ({ loaderData }) => {
    const id = loaderData?.id ?? "";
    const movie = loaderData?.movie;

    const title = movie?.title || "Movie";
    const year = movie?.release_date?.slice(0, 4) || "";
    const overview =
      movie?.overview ||
      `Watch ${title} and discover movie details on Cimaly.`;

    const canonical = `${BASE_URL}/watch/movie/${id}`;

    const seoTitle = `${title}${year ? ` (${year})` : ""} مترجم - مشاهدة فيلم | Cimaly`;

    const description =
      `مشاهدة فيلم ${title} مترجم${year ? ` (${year})` : ""} على Cimaly. ${overview}`.slice(
        0,
        160,
      );

    const poster = movie?.poster_path
      ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
      : undefined;

    return {
      meta: [
        {
          title: seoTitle,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:type",
          content: "video.movie",
        },
        {
          property: "og:title",
          content: seoTitle,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:url",
          content: canonical,
        },
        ...(poster
          ? [
              {
                property: "og:image",
                content: poster,
              },
            ]
          : []),
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: seoTitle,
        },
        {
          name: "twitter:description",
          content: description,
        },
        ...(poster
          ? [
              {
                name: "twitter:image",
                content: poster,
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

  component: WatchMovieRoute,
});

function WatchMovieRoute() {
  const { id } = Route.useParams();

  return <WatchPage type="movie" id={id} />;
}
