import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb.functions";

const BASE_URL = "https://cimaly.cc";
const TMDB_PAGES = 5;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-movies.xml")({
  server: {
    handlers: {
      GET: async () => {
        const movieIds = new Set<number>();

        for (let page = 1; page <= TMDB_PAGES; page++) {
          const result = await tmdbFetch({
            data: {
              path: "/discover/movie",
              params: {
                page,
                sort_by: "popularity.desc",
                include_adult: false,
              },
            },
          });

          if (!result.ok || !result.data?.results) {
            continue;
          }

          for (const movie of result.data.results) {
            if (
              typeof movie?.id === "number" &&
              movie.id > 0
            ) {
              movieIds.add(movie.id);
            }
          }
        }

        const urls = Array.from(movieIds).map(
          (id) => `${BASE_URL}/movie/${id}`,
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
