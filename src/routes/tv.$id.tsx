import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";

export const Route = createFileRoute("/tv/$id")({
  head: () => ({
    meta: [
      { title: "TV Show — Cimaly" },
      { name: "description", content: "Seasons, episodes, cast and streaming servers for TV shows on Cimaly." },
      { property: "og:title", content: "TV Show — Cimaly" },
      { property: "og:description", content: "Seasons, episodes, cast and streaming servers." },
    ],
  }),
  component: () => <DetailPage type="tv" id={Route.useParams().id} />,
});
