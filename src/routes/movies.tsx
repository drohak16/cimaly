import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/BrowsePage";

export const Route = createFileRoute("/movies")({
  validateSearch: validateBrowseSearch,

  head: () => ({
    meta: [
      { title: "Movies — Cimaly" },
      {
        name: "description",
        content:
          "Browse and filter movies by genre, country, year and rating on Cimaly.",
      },
      { property: "og:title", content: "Movies — Cimaly" },
      {
        property: "og:description",
        content:
          "Browse and filter movies by genre, country, year and rating on Cimaly.",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://cimaly.cc/movies",
      },
    ],
  }),

  component: () => (
    <BrowsePage type="movie" search={Route.useSearch()} />
  ),
});
