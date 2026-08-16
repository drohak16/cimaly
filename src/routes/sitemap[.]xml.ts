import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://cimaly.cc";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const sitemaps = [
          `${BASE_URL}/sitemap-pages.xml`,
          `${BASE_URL}/sitemap-movies.xml`,
          `${BASE_URL}/sitemap-tv.xml`,
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(
    (url) => `  <sitemap>
    <loc>${url}</loc>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;

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
