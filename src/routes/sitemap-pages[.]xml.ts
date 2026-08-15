import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://cimaly.cc";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = [
          `${BASE_URL}/`,
          `${BASE_URL}/movies`,
          `${BASE_URL}/tv`,
          `${BASE_URL}/movie/1284041`,
          `${BASE_URL}/tv/125988`,
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
