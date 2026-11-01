import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb.functions";

const BASE_URL = "https://cimaly.cc";
// Anime SEO sitemap: no minimum year filter, so long-running active titles
// such as One Piece (1999) can still be prioritized when popular.
// Animation genre = 16. Origin country JP focuses this sitemap on anime.
const TMDB_PAGES = 5;
const REMOVED_TV_IDS = new Set([103815, 114655]);

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

        // Five calls per sitemap: three popularity pages plus two 2025+ pages.
        // Do not remove older catalogue titles; they remain browsable.
        for (let slot = 1; slot <= TMDB_PAGES; slot++) {
          const recent = slot > 3;
          const page = recent ? slot - 3 : slot;
          const today = new Date().toISOString().slice(0, 10);
          const result = await tmdbFetch({
            data: {
              path: "/discover/tv",
              params: {
                page,
                sort_by: recent ? "first_air_date.desc" : "popularity.desc",
                include_adult: false,
                with_genres: "16",
                with_origin_country: "JP",
                ...(recent ? { "first_air_date.gte": "2025-01-01", "first_air_date.lte": today, "vote_count.gte": 5 } : {}),
              },
            },
          });

          if (!result.ok || !Array.isArray(result.data?.results)) {
            return new Response("Sitemap temporarily unavailable", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
            });
          }

          for (const anime of result.data.results) {
            if (typeof anime?.id === "number" && anime.id > 0 && !REMOVED_TV_IDS.has(anime.id)) {
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
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      },
    },
  },
});
