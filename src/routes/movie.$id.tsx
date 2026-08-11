import { createFileRoute } from "@tanstack/react-router";
import { DetailPage } from "@/components/DetailPage";

export const Route = createFileRoute("/movie/$id")({
  head: () => ({
    meta: [
      { title: "Movie — Cimaly" },
      { name: "description", content: "Movie details, cast, trailer and streaming servers on Cimaly." },
      { property: "og:title", content: "Movie — Cimaly" },
      { property: "og:description", content: "Movie details, cast, trailer and streaming servers." },
    ],
  }),
  component: () => <DetailPage type="movie" id={Route.useParams().id} />,
});
