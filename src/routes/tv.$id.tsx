import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";
import { IMG, tmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/tv/$id")({
  loader: async ({ params }) => {
    const show = await tmdb(`/tv/${params.id}`, {}, "en");

    return {
      show: show && !show.__missingKey ? show : null,
    };
  },

  head: ({ loaderData, params }) => {
    const show = loaderData?.show;

    const showTitle =
      show?.name ||
      show?.original_name ||
      "TV Show";

    const year = show?.first_air_date
      ? show.first_air_date.slice(0, 4)
      : "";

    const title = `${showTitle}${year ? ` (${year})` : ""} – Cimaly`;

    const description =
      show?.overview?.trim() ||
      `Discover ${showTitle}${year ? ` (${year})` : ""}, seasons, episodes, cast and more on Cimaly.`;

    const image = show?.poster_path
      ? `${IMG}w780${show.poster_path}`
      : undefined;

    const canonical = `https://cimaly.cc/tv/${params.id}`;

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
          content: "video.tv_show",
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

  component: TvDetailPage,
});

function TvDetailPage() {
  const { id } = Route.useParams();

  return <DetailPage type="tv" id={id} />;
}
