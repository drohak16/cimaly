import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/BrowsePage";
import { tmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/tv/")({
  validateSearch: validateBrowseSearch,

  loader: async () => ({
    initialData: await tmdb(
      "/discover/tv",
      { sort_by: "popularity.desc", page: 1, include_adult: false },
      "en",
    ),
  }),

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

  component: TvBrowseRoute,
});

function TvBrowseRoute() {
  const search = Route.useSearch();
  const { initialData } = Route.useLoaderData();
  const isDefaultBrowse = Object.keys(search).length === 0;

  return (
    <BrowsePage
      type="tv"
      search={search}
      initialData={isDefaultBrowse ? initialData : undefined}
    />
  );
}
