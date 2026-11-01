// Small smoke test of deployed metadata and sitemaps, no TMDB secret needed.
// Runs only after code is deployed or on demand; no mass Googlebot requests.
import { appendFile } from "node:fs/promises";

const base = "https://cimaly.cc";
const routes = [
  { path: "/movie/9569", kind: "movie" },
  { path: "/tv/648", kind: "tv" },
  { path: "/tv/237170", kind: "tv" },
  { path: "/tv/99423", kind: "tv" },
];
const sitemaps = ["/sitemap-movies.xml", "/sitemap-tv.xml", "/sitemap-anime.xml"];
async function get(path) {
  try {
    const res = await fetch(base+path, {
      headers: { "User-Agent": "CimalySEOCheck/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    return { status: res.status, html: await res.text() };
  } catch(error) {
    return { status: 0, html: String(error) };
  }
}
const results=[];
for (const item of routes) {
  const {status,html}=await get(item.path);
  const head=html.split("</head>")[0] || "";
  const title=head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]??"";
  const desc=head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)/i)?.[1]??"";
  const canonical=`https://cimaly.cc${item.path}`;
  const actualCanonical=head.includes(canonical);
  const structured=head.includes("application/ld+json") &&
      head.includes(item.kind === "movie" ? '"Movie"' : '"TVSeries"');
  const fallback=html.includes("Title information is sourced from TMDB");
  const overview=html.includes('detail-ov');
  const errors=[];
  if(status!==200) errors.push("HTTP "+status);
  if(!actualCanonical) errors.push("Missing canonical");
  if(!structured) errors.push("Missing JSON-LD");
  if(!desc || desc.length<35) errors.push("Missing short description");
  if(!title || !title.includes("Cimaly")) errors.push("Missing title");
  if(!overview && !fallback) errors.push("Missing synopsis/factual fallback");
  results.push({path:item.path,http:status,title,descLength:desc.length,errors});
}
for (const path of sitemaps) {
  const {status,html}=await get(path);
  const urls=(html.match(/<loc>/g)||[]).length;
  const errors=[];
  if(status!==200) errors.push("HTTP "+status);
  if(!html.includes("<urlset"))errors.push("Not an XML urlset");
  if(urls<10)errors.push("Too few entries: "+urls);
  results.push({path,http:status,urls,errors});
}
const summary=[
  "## Cimaly SEO release smoke test", "",
  "| Page | HTTP | URLs | Errors |", "|---|---:|---:|---|",
  ...results.map(x=>`| ${x.path} | ${x.http} | ${x.urls??"—"} | ${x.errors.join("; ")||"none"} |`),
  "",
  "A passing check verifies response markup, not Google indexation."
].join("\n");
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(results.some(x=>x.errors.length))process.exitCode=1;
