import { createFileRoute } from "@tanstack/react-router";
import { BrowsePage, validateBrowseSearch } from "@/components/BrowsePage";
import { tmdb } from "@/lib/tmdb";

export const Route = createFileRoute("/movies")({
  validateSearch: validateBrowseSearch,

  loader: async () => ({
    initialData: await tmdb(
      "/discover/movie",
      { sort_by: "popularity.desc", page: 1, include_adult: false },
      "en",
    ),
  }),

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

  component: MoviesRoute,
});

function MoviesRoute() {
  const search = Route.useSearch();
  const { initialData } = Route.useLoaderData();
  const isDefaultBrowse = Object.keys(search).length === 0;

  return (
    <BrowsePage
      type="movie"
      search={search}
      initialData={isDefaultBrowse ? initialData : undefined}
    />
  );
}
