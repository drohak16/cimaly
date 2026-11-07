// Checks previously reported GSC 5xx URLs without adding site traffic spikes.
// Run in GitHub Actions. Public URLs only; no account secrets or paid services.
import { appendFile, writeFile } from "node:fs/promises";

const BASE = "https://cimaly.cc";
const old5xx = [
  "/movie/42703",
  "/movie/1900",
  "/movie/17134",
  "/movie/19348",
  "/movie/29559",
  "/watch/tv/124460/1/586",
  "/tv/23406",
  "/movie/554908",
  "/tv/208791",
  "/tv/62875",
  "/tv/5576",
  "/watch/tv/208376/1/44",
  "/movie/359364",
  "/movie/458109",
  "/watch/movie/9262",
  "/movie/10633",
  "/movie/11234",
  "/tv/39176",
  "/tv/306630",
  "/movie/840983",
  "/movie/460325",
  "/watch/tv/65733/1/1420",
  "/movie/1018894",
  "/movie/628466",
  "/movie/1122772",
  "/watch/tv/38251/1/22",
  "/watch/tv/74016/1/3"
];
const targets = [
  { url: BASE + "/", group: "core" },
  { url: BASE + "/robots.txt", group: "robots" },
  { url: BASE + "/sitemap.xml", group: "sitemap-index" },
  { url: BASE + "/sitemap-pages.xml", group: "sitemap-pages" },
  { url: BASE + "/sitemap-movies.xml", group: "sitemap-detail" },
  { url: BASE + "/sitemap-tv.xml", group: "sitemap-detail" },
  { url: BASE + "/sitemap-anime.xml", group: "sitemap-detail" },
  { url: BASE + "/movies", group: "listing" },
  { url: BASE + "/tv", group: "listing" },
  { url: BASE + "/genre/documentary", group: "listing" },
  { url: BASE + "/country/tr", group: "listing" },
  { url: BASE + "/movie/9569", group: "movie-detail" },
  { url: BASE + "/tv/648", group: "tv-detail" },
  ...old5xx.map((p) => ({ url: BASE + p, group: "previous-5xx" })),
  { url: "https://www.cimaly.cc/", group: "www-redirect" },
];

async function probe(target) {
  const startedAt = Date.now();
  try {
    const response = await fetch(target.url, {
      headers: { "User-Agent": "CimalySEOHealth/1.0 (periodic public-site status check)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    // Read response so late SSR errors are not silently missed.
    const html = await response.text();
    const fallback500 = html.includes("<title>This page didn't load</title>") ||
      /<h1\b[^>]*>\s*This page didn't load\s*<\/h1>/i.test(html);
    const wrongRedirect = target.group === "www-redirect" &&
      !response.url.startsWith("https://cimaly.cc/");
    const status = fallback500 && response.ok ? 500 : response.status;
    // Check actual crawlable HTML anchors, not only loader data inside scripts.
    // Reuse the homepage response already fetched: zero extra HTTP requests.
    const mediaLinks = target.url === BASE + "/"
      ? new Set(
          [...html.matchAll(/href=["']([^"']+)["']/g)]
            .map((m) => m[1])
            .filter((href) => {
              const parts = href.split("/");
              return parts.length === 3 &&
                (parts[1] === "movie" || parts[1] === "tv") &&
                /^[0-9]+$/.test(parts[2]);
            }),
        ).size
      : null;
    const emptyHome = mediaLinks !== null && mediaLinks < 15;
    const group = target.group;
    const head = html.split("</head>")[0] ?? "";
    const declaredCanonical = head.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ??
      head.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] ?? "";
    const robotsNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex|<meta[^>]*content=["'][^"']*noindex[^>]*name=["']robots/i.test(head);
    const checkCanonical = ["core", "listing", "movie-detail", "tv-detail"].includes(group);
    const seoPath = new URL(target.url).pathname;
    const expectedCanonical = BASE + seoPath;
    const invalidCanonical = checkCanonical && declaredCanonical !== expectedCanonical;
    const invalidRobots = checkCanonical && robotsNoindex;
    const invalidDetail = group === "movie-detail" || group === "tv-detail"
      ? !head.includes("application/ld+json") ||
        !head.includes(group === "movie-detail" ? '"Movie"' : '"TVSeries"')
      : false;
    const invalidSitemap = group.startsWith("sitemap-")
      ? !html.includes(group === "sitemap-index" ? "<sitemapindex" : "<urlset") ||
        (html.match(/<loc>/g) ?? []).length < (group === "sitemap-index" ? 4 : 10) ||
        !html.includes(BASE + "/")
      : false;
    const invalidRobotsTxt = group === "robots" && !html.includes("Sitemap: " + BASE + "/sitemap.xml");
    const noListing = group === "listing" && !/<h1\b/i.test(html);
    const contentError = invalidCanonical ? "Canonical mismatch: " + (declaredCanonical || "missing")
      : invalidRobots ? "Unexpected noindex"
      : invalidDetail ? "Missing Movie/TVSeries JSON-LD"
      : invalidSitemap ? "Sitemap invalid or missing URLs"
      : invalidRobotsTxt ? "robots.txt sitemap directive missing"
      : noListing ? "Listing page has no H1" : null;
    return {
      ...target, status, finalUrl: response.url,
      milliseconds: Date.now() - startedAt,
      mediaLinks,
      error: wrongRedirect ? "www canonical redirect missing"
        : fallback500 ? "SSR fallback error page"
        : emptyHome ? "Homepage SSR has fewer than 15 media links"
        : contentError,
    };
  } catch (error) {
    return {
      ...target, status: null, finalUrl: null,
      milliseconds: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = [];
for (let i = 0; i < targets.length; i += 2) {
  results.push(...await Promise.all(targets.slice(i, i + 2).map(probe)));
  await new Promise((resolve) => setTimeout(resolve, 350));
}
const errors = results.filter((r) => r.status === null || r.status >= 500 || r.error);
const missing = results.filter((r) => r.status === 404);
const run = {
  timestamp: new Date().toISOString(),
  count: results.length,
  critical: errors.length,
  http404: missing.length,
  results,
};
await writeFile("seo-health-result.json", JSON.stringify(run, null, 2) + "\n");
const summary = [
  "## Cimaly SEO health — " + run.timestamp,
  "",
  "Checked: **" + run.count + "** public URLs, including 27 historical 5xx routes and SEO metadata.",
  "Critical (5xx / timeout / redirect): **" + run.critical + "**.",
  "HTTP 404 (requires individual verification): **" + run.http404 + "**.",
  "",
  "| URL | HTTP | Note |",
  "|---|---:|---|",
  ...results.map((r) => {
    const path = r.url.replace(BASE, "");
    return "| " + path + " | " + (r.status ?? "error") + " | " + (r.error ?? (r.mediaLinks !== null && r.mediaLinks !== undefined ? "SSR media links: " + r.mediaLinks : "")) + " |";
  }),
  "",
  "The original GSC 5xx report is historical; a 200 now doesn't guarantee that Google has reindexed the page.",
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (errors.length) process.exitCode = 1;
