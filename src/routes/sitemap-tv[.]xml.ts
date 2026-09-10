import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb.functions";

const BASE_URL = "https://cimaly.cc";
// SEO priority only: the full catalogue stays on Cimaly.
// TMDB returns about 20 results per page. 25 pages ~= 500 TV detail URLs.
const TMDB_PAGES = 25;
const MIN_FIRST_AIR_DATE = "2000-01-01";
const REMOVED_TV_IDS = new Set([103815]);

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const Route = createFileRoute("/sitemap-tv.xml")({
  server: {
    handlers: {
      GET: async () => {
        const tvIds = new Set<number>();

        for (let page = 1; page <= TMDB_PAGES; page++) {
          const result = await tmdbFetch({
            data: {
              path: "/discover/tv",
              params: {
                page,
                sort_by: "popularity.desc",
                include_adult: false,
                "first_air_date.gte": MIN_FIRST_AIR_DATE,
              },
            },
          });

          if (!result.ok || !result.data?.results) {
            continue;
          }

          for (const show of result.data.results) {
            if (
              typeof show?.id === "number" &&
              show.id > 0 &&
              !REMOVED_TV_IDS.has(show.id)
            ) {
              tvIds.add(show.id);
            }
          }
        }

        const urls = Array.from(tvIds).map(
          (id) => `${BASE_URL}/tv/${id}`,
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
