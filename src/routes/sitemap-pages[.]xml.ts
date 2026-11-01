import { createFileRoute } from "@tanstack/react-router";
import { GENRES, COUNTRIES } from "@/lib/catalog";

const BASE_URL = "https://cimaly.cc";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = [
          `${BASE_URL}/`,
          `${BASE_URL}/movies`,
          `${BASE_URL}/tv`,
          ...GENRES.map((genre) => `${BASE_URL}/genre/${genre.slug}`),
          ...COUNTRIES.map((country) => `${BASE_URL}/country/${country.c}`),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=UTF-8",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
