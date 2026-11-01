// One-time, bounded audit of a representative sample of GSC 404 URLs.
// A 404 for a genuinely removed title is valid. Do not treat every 404 as a bug.
import { appendFile, writeFile } from "node:fs/promises";
const paths = ["/movie/1480","/movie/4890","/movie/265393","/movie/452397","/movie/31052","/movie/594767","/movie/633318","/movie/513949","/movie/83","/movie/53441","/movie/38621","/movie/653708","/movie/30709","/movie/19855","/movie/1208704","/movie/4512","/movie/298582","/movie/278378","/movie/70196","/movie/22858","/movie/2987","/movie/466577","/movie/18912","/movie/1511408","/movie/888","/movie/1567488","/movie/37821","/movie/965150","/tv/209749","/tv/38420","/tv/40663","/tv/11861","/tv/92649","/tv/3889","/tv/62806","/tv/207717","/tv/9550","/tv/285052","/tv/123622","/tv/211684","/tv/2440","/tv/90602","/tv/207281","/tv/94280","/tv/254701","/tv/67674","/tv/65174","/tv/499","/tv/60639","/tv/3498","/tv/127090","/tv/63033","/tv/28462","/tv/497","/tv/233667","/tv/22980","/watch/tv/124460/1/464","/watch/tv/124460/1/207","/watch/tv/207521/1/4","/watch/tv/128718/1/49","/watch/tv/64757/1/101","/watch/tv/124460/1/714","/watch/tv/2046/1/9","/watch/tv/52910/1/241","/watch/tv/208372/1/145","/watch/tv/120199/1/19","/watch/tv/65564/1/32","/watch/tv/126170/1/33","/watch/movie/9922","/watch/tv/254002/1/13","/watch/movie/337426","/watch/movie/449658","/watch/tv/56570/1/13","/watch/tv/1341/1/71","/watch/tv/58362/1/134","/watch/movie/1753224","/watch/movie/187216","/watch/movie/329","/watch/tv/3850/1/13","/watch/tv/27660/1/10","/watch/tv/107085/1/30","/watch/tv/42855/1/1","/watch/tv/241148/1/136","/watch/tv/91746/1/9","/m/0b4cxjq","/m/0dszqp","/m/0bvznb","/m/07rgcl","/m/0641ct4","/m/0bwl022","/m/01fhr","/m/0jt5l1z","/m/0crf4z","/en/minder","/en/mobile_suit_gundam_zz","/en/when_the_levees_broke","/en/catscratch","/en/chobits","/en/the_gertrude_berg_show","/en/father_of_the_pride","/en/alguna_vez_tendremos_alas","/en/floricienta"];
const urls = paths.map(path => "https://cimaly.cc"+path);
urls.push("https://www.cimaly.cc/movie/1480", "https://www.cimaly.cc/tv/209749");
const result = [];
async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "CimalySEOAudit/1.0" },
      signal: AbortSignal.timeout(18000),
    });
    const html = (res.headers.get("content-type")||"").includes("html") ? await res.text() : "";
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
    const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]?.replace(/<[^>]+>/g,"").trim().slice(0,110) ?? "";
    const soft404 = res.status === 200 && (/^404$|page not found|this page didn't load/i.test(h1+" "+title));
    const noIndex = /<meta[^>]+(?:name=["']robots["'][^>]+content=["'][^"']*noindex|content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots)/i.test(html);
    return { url, status:res.status, finalUrl:res.url, title:title.slice(0,120), h1, noIndex, soft404, ms:Date.now()-started };
  } catch(e) { return {url, status:null,error:e instanceof Error?e.message:String(e),ms:Date.now()-started}; }
}
for(let i=0;i<urls.length;i+=2){
  result.push(...await Promise.all(urls.slice(i,i+2).map(probe)));
  await new Promise(resolve=>setTimeout(resolve,500));
}
const stats = {};
for(const x of result){
  const path=new URL(x.url).pathname;
  const group=path.startsWith("/movie/")?"movie":path.startsWith("/tv/")?"tv":path.startsWith("/watch/")?"watch":"legacy";
  const key=group+":"+(x.status??"error");
  stats[key]=(stats[key]||0)+1;
}
const report={at:new Date().toISOString(),count:result.length,stats,result};
await writeFile("seo-404-audit.json", JSON.stringify(report,null,2)+"\n");
const md=[
  "## Sample of historic Google Search Console 404s",
  "Checked "+result.length+" URLs. Group totals by current status:",
  "","| Group/status | Count |","|---|---:|",
  ...Object.entries(stats).map(([k,v])=>"| "+k+" | "+v+" |"),
  "","| URL | Status | H1/title |","|---|---:|---|",
  ...result.map(x=>"| "+new URL(x.url).pathname+" | "+(x.status??"error")+" | "+(x.h1||x.title||x.error||"").replace(/\|/g,"/").slice(0,80)+" |"),
  "",
  "HTTP 404 for truly nonexistent old URLs is expected. A 200 response alone does not prove search indexing."
].join("\n");
console.log(md);
if(process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,md);
