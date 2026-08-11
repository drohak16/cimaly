import { createFileRoute } from "@tanstack/react-router";
import { WatchPage } from "@/components/WatchPage";

export const Route = createFileRoute("/watch/movie/$id")({
  head: () => ({
    meta: [
      { title: "Watch Movie — Cimaly" },
      { name: "description", content: "Stream movies with multiple servers on Cimaly." },
      { property: "og:title", content: "Watch Movie — Cimaly" },
      { property: "og:description", content: "Stream movies with multiple servers." },
    ],
  }),
  component: () => <WatchPage type="movie" id={Route.useParams().id} />,
});
