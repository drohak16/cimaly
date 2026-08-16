import { createFileRoute } from "@tanstack/react-router";
import { WatchPage } from "@/components/WatchPage";
import { tmdb } from "@/lib/tmdb";

const BASE_URL = "https://cimaly.cc";

export const Route = createFileRoute("/watch/tv/$id/$season/$episode")({
  loader: async ({ params }) => {
    const season = Number(params.season) || 1;
    const episode = Number(params.episode) || 1;

    const [show, seasonData] = await Promise.all([
      tmdb(
        `/tv/${params.id}`,
        {
          append_to_response: "external_ids",
        },
        "en",
      ),
      tmdb(`/tv/${params.id}/season/${season}`, {}, "en"),
    ]);

    const episodeData =
      seasonData?.episodes?.find(
        (item: any) => item.episode_number === episode,
      ) || null;

    return {
      id: params.id,
      season,
      episode,
      show:
        show && !show.__missingKey
          ? show
          : null,
      episodeData:
        episodeData && !episodeData.__missingKey
          ? episodeData
          : null,
    };
  },

  head: ({ loaderData }) => {
    const id = loaderData?.id ?? "";
    const season = loaderData?.season ?? 1;
    const episode = loaderData?.episode ?? 1;
    const show = loaderData?.show;
    const episodeData = loaderData?.episodeData;

    const showTitle = show?.name || "TV Show";
    const episodeTitle = episodeData?.name || "";

    const canonical =
      `${BASE_URL}/watch/tv/${id}/${season}/${episode}`;

    const seoTitle =
      `${showTitle} الموسم ${season} الحلقة ${episode} مترجم | Cimaly`;

    const overview =
      episodeData?.overview ||
      show?.overview ||
      `Watch ${showTitle} season ${season} episode ${episode} on Cimaly.`;

    const description =
      `مشاهدة مسلسل ${showTitle} الموسم ${season} الحلقة ${episode} مترجم` +
      `${episodeTitle ? ` - ${episodeTitle}` : ""} على Cimaly. ${overview}`;

    const shortDescription = description.slice(0, 160);

    const imagePath =
      episodeData?.still_path ||
      show?.poster_path ||
      show?.backdrop_path;

    const image = imagePath
      ? `https://image.tmdb.org/t/p/w780${imagePath}`
      : undefined;

    return {
      meta: [
        {
          title: seoTitle,
        },
        {
          name: "description",
          content: shortDescription,
        },
        {
          property: "og:type",
          content: "video.episode",
        },
        {
          property: "og:title",
          content: seoTitle,
        },
        {
          property: "og:description",
          content: shortDescription,
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
          content: seoTitle,
        },
        {
          name: "twitter:description",
          content: shortDescription,
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

  component: WatchEpisode,
});

function WatchEpisode() {
  const { id, season, episode } = Route.useParams();

  return (
    <WatchPage
      type="tv"
      id={id}
      season={Number(season) || 1}
      episode={Number(episode) || 1}
    />
  );
}
