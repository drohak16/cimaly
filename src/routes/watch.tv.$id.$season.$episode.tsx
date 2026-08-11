import { createFileRoute } from "@tanstack/react-router";
import { WatchPage } from "@/components/WatchPage";

export const Route = createFileRoute("/watch/tv/$id/$season/$episode")({
  head: () => ({
    meta: [
      { title: "Watch Episode — Cimaly" },
      { name: "description", content: "Stream TV episodes with multiple servers on Cimaly." },
      { property: "og:title", content: "Watch Episode — Cimaly" },
      { property: "og:description", content: "Stream TV episodes with multiple servers." },
    ],
  }),
  component: WatchEpisode,
});

function WatchEpisode() {
  const { id, season, episode } = Route.useParams();
  return <WatchPage type="tv" id={id} season={Number(season) || 1} episode={Number(episode) || 1} />;
}
