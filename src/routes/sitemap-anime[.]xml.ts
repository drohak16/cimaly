import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb.functions";

const BASE_URL = "https://cimaly.cc";
// Anime SEO sitemap: no minimum year filter, so long-running active titles
// such as One Piece (1999) can still be prioritized when popular.
// Animation genre = 16. Origin country JP focuses this sitemap on anime.
const TMDB_PAGES = 5;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-anime.xml")({
  server: {
    handlers: {
      GET: async () => {
        const animeIds = new Set<number>();

        for (let page = 1; page <= TMDB_PAGES; page++) {
          const result = await tmdbFetch({
            data: {
              path: "/discover/tv",
              params: {
                page,
                sort_by: "popularity.desc",
                include_adult: false,
                with_genres: "16",
                with_origin_country: "JP",
              },
            },
          });

          if (!result.ok || !result.data?.results) {
            continue;
          }

          for (const anime of result.data.results) {
            if (typeof anime?.id === "number" && anime.id > 0) {
              animeIds.add(anime.id);
            }
          }
        }

        const urls = Array.from(animeIds).map(
          (id) => `${BASE_URL}/tv/${id}`,
        );

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`,
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
