import { appendFile, writeFile } from "node:fs/promises";
const paths = ["/movie/9569","/movie/6077","/movie/294793","/movie/29130","/movie/624860","/movie/631782","/movie/1585407","/movie/689249","/movie/631049","/movie/10488","/movie/18477","/movie/633889","/movie/967847","/movie/25196","/movie/1018793","/movie/76351","/movie/2077","/movie/513576","/movie/268660","/movie/261470","/movie/57517","/movie/262873","/movie/9061","/movie/187897","/movie/596161","/tv/648","/tv/207037","/tv/126167","/tv/28361","/tv/136763","/tv/67177","/tv/36737","/tv/64783","/tv/31368","/tv/213193","/tv/205783","/tv/70785","/tv/2562","/tv/137893","/tv/123503","/tv/123405","/tv/82737","/tv/235685","/tv/30297","/tv/205443","/tv/237170","/tv/99423","/tv/277894","/tv/227371","/tv/128061"];
async function check(path) {
  try {
    const url = "https://cimaly.cc"+path;
    const r = await fetch(url, { redirect:"follow",signal:AbortSignal.timeout(18000),headers:{"User-Agent":"CimalySEOAudit/1.0"} });
    const html=await r.text();
    const head=html.split("</head>")[0]??"";
    const title=head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]??"";
    const meta=[...head.matchAll(/<meta[^>]+>/gi)].map(x=>x[0]);
    const desc=meta.find(x=>/name=["']description["']/i.test(x))??"";
    const m=desc.match(/content=["']([^"']*)/i);
    const canonical=head.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]??head.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]??"";
    const noindex=/name=["']robots["'][^>]*noindex|noindex[^>]*name=["']robots/i.test(head);
    const script=/application\/ld\+json/i.test(head);
    const h1=(html.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]??"").replace(/<[^>]+>/g,"").trim();
    const overview=/<p[^>]*class=["'][^"']*detail-ov/.test(html);
    return {path,status:r.status,title:title.slice(0,100),descriptionLength:(m?.[1]??"").length,canonical,hasJsonLd:script,noindex,h1:h1.slice(0,100),hasOverview:overview,htmlLength:html.length};
  }catch(e){return {path,error:e instanceof Error?e.message:String(e)}}
}
const data=[];
for(let i=0;i<paths.length;i+=2){ data.push(...await Promise.all(paths.slice(i,i+2).map(check))); await new Promise(r=>setTimeout(r,450));}
const stats = {count:data.length,success:data.filter(x=>x.status===200).length,not200:data.filter(x=>x.status!==200).length,noindex:data.filter(x=>x.noindex).length,missingCanonical:data.filter(x=>!x.canonical).length,wrongCanonical:data.filter(x=>x.canonical&&x.canonical!=="https://cimaly.cc"+x.path).length,missingJsonLd:data.filter(x=>!x.hasJsonLd).length,missingOverview:data.filter(x=>!x.hasOverview).length,descriptionTooShort:data.filter(x=>x.descriptionLength<50).length};
const report={timestamp:new Date().toISOString(),stats,data};
await writeFile("seo-unindexed-audit.json",JSON.stringify(report,null,2)+"\n");
const s=["## Historic crawled-not-indexed sample",JSON.stringify(stats),"","| URL | HTTP | Desc length | Canonical | JSON-LD | Overview |","|---|---:|---:|---|---|---|",...data.map(x=>"| "+x.path+" | "+(x.status??x.error)+" | "+(x.descriptionLength??"-")+" | "+(x.canonical===("https://cimaly.cc"+x.path)?"yes":"NO")+" | "+(x.hasJsonLd?"yes":"NO")+" | "+(x.hasOverview?"yes":"NO")+" |")].join("\n");
console.log(s);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,s);
