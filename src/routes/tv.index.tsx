import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/BrowsePage";

export const Route = createFileRoute("/tv/")({
  validateSearch: validateBrowseSearch,

  head: () => ({
    meta: [
      { title: "TV Shows — Cimaly" },
      {
        name: "description",
        content:
          "Browse and filter TV shows by genre, country, year and rating on Cimaly.",
      },
      { property: "og:title", content: "TV Shows — Cimaly" },
      {
        property: "og:description",
        content:
          "Browse and filter TV shows by genre, country, year and rating on Cimaly.",
      },
    ],

    links: [
      {
        rel: "canonical",
        href: "https://cimaly.cc/tv",
      },
    ],
  }),

  component: () => (
    <BrowsePage type="tv" search={Route.useSearch()} />
  ),
});
