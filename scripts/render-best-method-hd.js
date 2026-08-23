const fs = require('fs');
const path = require('path');

const OUT = 'public/social/cimaly-2026-08-24-hd/source';
fs.mkdirSync(OUT, { recursive: true });

const items = [
  {key:'film-en', cat:'FILM', title:'TOY STORY 5', sub:'TOY MEETS TECH.', genres:'ADVENTURE  •  ANIMATION  •  COMEDY', accent:'#ffbd00', top:'#163e6e', bottom:'#0a142d', rtl:false},
  {key:'film-ar', cat:'فيلم', title:'حكاية لعبة 5', sub:'اللعب يلتقي بالتكنولوجيا.', genres:'مغامرة  •  رسوم متحركة  •  كوميديا', accent:'#ffbd00', top:'#163e6e', bottom:'#0a142d', rtl:true},
  {key:'series-en', cat:'SERIES', title:'REACHER — SEASON 4', sub:'THE HUNT GETS PERSONAL.', genres:'ACTION  •  THRILLER  •  DRAMA', accent:'#1cb473', top:'#103a32', bottom:'#071618', rtl:false},
  {key:'series-ar', cat:'مسلسل', title:'ريشر — الموسم 4', sub:'هذه المرة، المطاردة شخصية.', genres:'أكشن  •  تشويق  •  دراما', accent:'#1cb473', top:'#103a32', bottom:'#071618', rtl:true},
  {key:'anime-en', cat:'ANIME', title:'FRIEREN — SEASON 2', sub:'THE JOURNEY CONTINUES.', genres:'FANTASY  •  ADVENTURE  •  DRAMA', accent:'#8b5cf6', top:'#2b184d', bottom:'#0d0d22', rtl:false},
  {key:'anime-ar', cat:'أنمي', title:'فريرن — الموسم 2', sub:'الرحلة مستمرة.', genres:'خيال  •  مغامرة  •  دراما', accent:'#8b5cf6', top:'#2b184d', bottom:'#0d0d22', rtl:true},
];

const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function svg(i){
  const anchor = i.rtl ? 'end' : 'start';
  const x = i.rtl ? 1960 : 200;
  const dir = i.rtl ? 'direction="rtl" unicode-bidi="bidi-override"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2160" height="2700" viewBox="0 0 2160 2700">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${i.top}"/><stop offset="1" stop-color="${i.bottom}"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${i.accent}" stop-opacity=".32"/><stop offset="1" stop-color="${i.accent}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="2160" height="2700" fill="url(#bg)"/>
<circle cx="1430" cy="1320" r="760" fill="url(#glow)"/>
<rect x="70" y="70" width="2020" height="2560" rx="58" fill="none" stroke="#fff" stroke-width="8" opacity=".92"/>
<circle cx="185" cy="180" r="64" fill="#ffbd00"/><path d="M165 145 L165 215 L225 180 Z" fill="#0b1629"/>
<text x="285" y="215" font-family="DejaVu Sans, sans-serif" font-size="112" font-weight="800" fill="#fff">CIMALY</text>
<rect x="${i.rtl?1600:150}" y="370" width="410" height="118" rx="36" fill="${i.accent}"/>
<text x="${i.rtl?1805:355}" y="449" text-anchor="middle" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="62" font-weight="800" fill="#fff" ${dir}>${esc(i.cat)}</text>
<text x="${x}" y="760" text-anchor="${anchor}" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="190" font-weight="900" fill="#fff" ${dir}>${esc(i.title)}</text>
<text x="${x}" y="980" text-anchor="${anchor}" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="84" font-weight="700" fill="#f4f4f4" ${dir}>${esc(i.sub)}</text>
<rect x="150" y="1110" width="1860" height="126" rx="30" fill="#000" fill-opacity=".22" stroke="${i.accent}" stroke-width="5"/>
<text x="1080" y="1193" text-anchor="middle" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="54" font-weight="700" fill="#fff" ${dir}>${esc(i.genres)}</text>
<g opacity=".28" fill="${i.accent}">
  <circle cx="540" cy="1550" r="185"/><circle cx="1080" cy="1480" r="285"/><circle cx="1620" cy="1580" r="220"/>
  <path d="M300 1880 Q1080 1280 1860 1880" fill="none" stroke="${i.accent}" stroke-width="36"/>
</g>
<rect x="120" y="2070" width="1920" height="390" rx="58" fill="#050d1c" stroke="${i.accent}" stroke-width="5"/>
<circle cx="${i.rtl?1880:280}" cy="2265" r="78" fill="${i.accent}"/><path d="M${i.rtl?1852:252} 2220 L${i.rtl?1852:252} 2310 L${i.rtl?1925:325} 2265 Z" fill="#071526"/>
<text x="${i.rtl?1660:470}" y="2225" text-anchor="${anchor}" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="70" font-weight="800" fill="#fff" ${dir}>${i.rtl?'شاهد الآن على':'WATCH NOW ON'}</text>
<text x="${i.rtl?1660:470}" y="2350" text-anchor="${anchor}" font-family="DejaVu Sans, sans-serif" font-size="100" font-weight="900" fill="#ffbd00">cimaly.cc</text>
<text x="1080" y="2575" text-anchor="middle" font-family="Noto Sans Arabic, DejaVu Sans, sans-serif" font-size="44" fill="#eee" ${dir}>${i.rtl?'HD  •  جودة عالية  •  كل الأجهزة  •  آمن وموثوق':'HD  •  HIGH QUALITY  •  ALL DEVICES  •  SAFE & SECURE'}</text>
</svg>`;
}

for (const i of items) fs.writeFileSync(path.join(OUT, `${i.key}.svg`), svg(i));
console.log(`Rendered ${items.length} SVG masters to ${OUT}`);
