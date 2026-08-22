import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social/daily");
const WIDTH = 1080;
const HEIGHT = 1350;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function downloadBinary(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "CimalySocialBot/1.0" },
  });
  if (!response.ok) throw new Error(`Poster download failed ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function overlaySvg({ lang, title, label }) {
  const rtl = lang === "ar";
  const titleSafe = escapeXml(title);
  const labelSafe = escapeXml(label);
  const topLabelX = rtl ? 990 : 990;
  const titleX = rtl ? 990 : 86;
  const titleAnchor = rtl ? "end" : "start";
  const subtitle = rtl ? "شاهد الآن على Cimaly" : "WATCH NOW ON CIMALY";
  const footer = rtl ? "اختيارات جديدة يوميًا" : "Fresh picks, every day.";
  const direction = rtl ? 'direction="rtl" unicode-bidi="bidi-override"' : "";

  return Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#05070d" stop-opacity="0"/>
        <stop offset="100%" stop-color="#05070d" stop-opacity="0.92"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="1080" height="150" fill="#05070d" fill-opacity="0.58"/>
    <rect x="0" y="620" width="1080" height="730" fill="url(#bottom)"/>

    <text x="56" y="96" fill="#ffffff" font-size="52" font-weight="800" font-family="Arial, DejaVu Sans, sans-serif">CIMALY</text>
    <rect x="758" y="44" width="266" height="70" rx="24" fill="#05070d" fill-opacity="0.82" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>
    <text x="${topLabelX}" y="89" text-anchor="end" fill="#ffffff" font-size="30" font-weight="700" font-family="Arial, DejaVu Sans, sans-serif" ${direction}>${labelSafe}</text>

    <rect x="46" y="900" width="988" height="400" rx="42" fill="#07090f" fill-opacity="0.91" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>
    <rect x="86" y="880" width="214" height="12" rx="6" fill="#ffffff"/>

    <text x="${titleX}" y="1018" text-anchor="${titleAnchor}" fill="#ffffff" font-size="66" font-weight="800" font-family="Arial, DejaVu Sans, sans-serif" ${direction}>${titleSafe}</text>
    <text x="${titleX}" y="1090" text-anchor="${titleAnchor}" fill="#f0f0f0" font-size="34" font-weight="700" font-family="Arial, DejaVu Sans, sans-serif" ${direction}>${escapeXml(subtitle)}</text>
    <text x="${titleX}" y="1160" text-anchor="${titleAnchor}" fill="#ffffff" font-size="38" font-weight="800" font-family="Arial, DejaVu Sans, sans-serif">cimaly.cc</text>
    <text x="${titleX}" y="1240" text-anchor="${titleAnchor}" fill="#cdd2dc" font-size="28" font-weight="500" font-family="Arial, DejaVu Sans, sans-serif" ${direction}>${escapeXml(footer)}</text>
  </svg>`);
}

async function renderCard({ posterBuffer, outputPath, lang, title, label }) {
  ensureDir(path.dirname(outputPath));
  await sharp(posterBuffer)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([{ input: overlaySvg({ lang, title, label }), top: 0, left: 0 }])
    .jpeg({ quality: 91, chromaSubsampling: "4:4:4" })
    .toFile(outputPath);
  console.log(`✅ Generated ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(SELECTION_FILE)) throw new Error("data/last-social-selection.json not found");
  const selection = JSON.parse(fs.readFileSync(SELECTION_FILE, "utf8"));

  const items = [
    { key: "series", data: selection.morning_series, labelEn: "SERIES", labelAr: "مسلسل" },
    { key: "anime", data: selection.afternoon_anime, labelEn: "ANIME", labelAr: "أنمي" },
    { key: "movie", data: selection.evening_movie, labelEn: "MOVIE", labelAr: "فيلم" },
  ];

  for (const item of items) {
    if (!item.data) throw new Error(`Missing selection for ${item.key}`);
    const tmdbId = Number(item.data.tmdb_id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) throw new Error(`Invalid TMDB ID for ${item.key}`);

    const posterUrl = item.data.poster_original || item.data.poster_w780;
    if (!posterUrl) throw new Error(`No poster for ${item.key} TMDB ${tmdbId}`);
    const posterBuffer = await downloadBinary(posterUrl);
    const filename = `${item.key}-${tmdbId}.jpg`;

    await renderCard({
      posterBuffer,
      outputPath: path.join(OUTPUT_ROOT, "en", filename),
      lang: "en",
      title: item.data.title_en,
      label: item.labelEn,
    });

    await renderCard({
      posterBuffer,
      outputPath: path.join(OUTPUT_ROOT, "ar", filename),
      lang: "ar",
      title: item.data.title_ar || item.data.title_en,
      label: item.labelAr,
    });
  }

  console.log("✅ Six branded Cimaly social visuals generated from the exact current selection.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
