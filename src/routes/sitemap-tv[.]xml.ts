import { createFileRoute } from "@tanstack/react-router";
import { tmdbFetch } from "@/lib/tmdb.functions";

const BASE_URL = "https://cimaly.cc";
const TMDB_PAGES = 1;

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

        // 1. Get popular TV shows from TMDB
        for (let page = 1; page <= TMDB_PAGES; page++) {
          const result = await tmdbFetch({
            data: {
              path: "/discover/tv",
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

          for (const show of result.data.results) {
            if (
              typeof show?.id === "number" &&
              show.id > 0
            ) {
              tvIds.add(show.id);
            }
          }
        }

        const urls = new Set<string>();

        // 2. Get seasons + episode counts for every TV show
        for (const id of tvIds) {
          const result = await tmdbFetch({
            data: {
              path: `/tv/${id}`,
              params: {
                language: "en-US",
              },
            },
          });

          if (!result.ok || !result.data) {
            continue;
          }

          const show = result.data;

          // TV detail page
          urls.add(`${BASE_URL}/tv/${id}`);

          // Individual episode pages
          for (const season of show.seasons || []) {
            const seasonNumber = Number(season?.season_number);
            const episodeCount = Number(season?.episode_count);

            // Ignore specials / Season 0
            if (
              !Number.isFinite(seasonNumber) ||
              !Number.isFinite(episodeCount) ||
              seasonNumber <= 0 ||
              episodeCount <= 0
            ) {
              continue;
            }

            for (
              let episode = 1;
              episode <= episodeCount;
              episode++
            ) {
              urls.add(
                `${BASE_URL}/watch/tv/${id}/${seasonNumber}/${episode}`,
              );
            }
          }
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(urls)
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
