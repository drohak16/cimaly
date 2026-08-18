import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social");

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const WIDTH = 1080;
const HEIGHT = 1350;

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFilename(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

function escapeXml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitWords(text = "", maxChars = 25) {
  const words = text.trim().split(/\s+/);

  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current
      ? `${current} ${word}`
      : word;

    if (
      test.length > maxChars &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

/* =========================================================
   TMDB
========================================================= */

async function tmdb(pathname) {
  const response = await fetch(
    `https://api.themoviedb.org/3${pathname}`,
    {
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `TMDB ${response.status}: ${text}`
    );
  }

  return response.json();
}

async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Poster download failed: ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =========================================================
   ARABIC TITLE
========================================================= */

async function getArabicTitle(content) {
  if (
    content.title_ar &&
    containsArabic(content.title_ar)
  ) {
    return content.title_ar;
  }

  const isMovie =
    content.type === "movie";

  const endpoint = isMovie
    ? `/movie/${content.tmdb_id}/translations`
    : `/tv/${content.tmdb_id}/translations`;

  try {
    const data = await tmdb(endpoint);

    const arabic =
      (data.translations || [])
        .find(
          item =>
            item.iso_639_1 === "ar"
        );

    const title =
      arabic?.data?.title ||
      arabic?.data?.name ||
      "";

    if (
      title &&
      containsArabic(title)
    ) {
      return title;
    }
  } catch (error) {
    console.log(
      "⚠️ Arabic title lookup failed:",
      error.message
    );
  }

  return "";
}

/* =========================================================
   PREPARE POSTER
========================================================= */

async function preparePoster(buffer) {
  return sharp(buffer)
    .resize(WIDTH, HEIGHT, {
      fit: "cover",
      position: "centre"
    })
    .jpeg({
      quality: 94,
      chromaSubsampling: "4:4:4"
    })
    .toBuffer();
}

/* =========================================================
   SMART ZONE DETECTION
========================================================= */

const ZONES = [
  {
    name: "top-left",
    left: 35,
    top: 35,
    width: 420,
    height: 220
  },
  {
    name: "top-right",
    left: WIDTH - 455,
    top: 35,
    width: 420,
    height: 220
  },
  {
    name: "bottom-left",
    left: 35,
    top: HEIGHT - 255,
    width: 420,
    height: 220
  },
  {
    name: "bottom-right",
    left: WIDTH - 455,
    top: HEIGHT - 255,
    width: 420,
    height: 220
  }
];

async function analyzeZone(
  poster,
  zone
) {
  const stats =
    await sharp(poster)
      .extract({
        left: zone.left,
        top: zone.top,
        width: zone.width,
        height: zone.height
      })
      .greyscale()
      .stats();

  const channel =
    stats.channels[0];

  const brightness =
    channel.mean;

  const entropy =
    stats.entropy || 0;

  /*
    Lower entropy = visually calmer.
    Darker areas are usually better
    for white text.
  */

  const brightnessPenalty =
    brightness > 170
      ? 35
      : brightness > 130
        ? 15
        : 0;

  const score =
    entropy * 25 +
    brightnessPenalty;

  return {
    ...zone,
    brightness,
    entropy,
    score
  };
}

async function findBestZones(poster) {
  const results = [];

  for (const zone of ZONES) {
    results.push(
      await analyzeZone(
        poster,
        zone
      )
    );
  }

  results.sort(
    (a, b) =>
      a.score - b.score
  );

  return results;
}

/* =========================================================
   SVG ELEMENTS
========================================================= */

function cimalyBadge(zone) {
  const rightSide =
    zone.name.includes("right");

  const x =
    rightSide
      ? zone.left + zone.width - 24
      : zone.left + 24;

  const anchor =
    rightSide
      ? "end"
      : "start";

  return Buffer.from(`
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="${x}"
        y="${zone.top + 62}"
        text-anchor="${anchor}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="40"
        font-weight="700"
        letter-spacing="1"
        fill="white"
        stroke="rgba(0,0,0,0.55)"
        stroke-width="3"
        paint-order="stroke"
      >Cimaly</text>
    </svg>
  `);
}

function englishCTA(zone) {
  const rightSide =
    zone.name.includes("right");

  const x =
    rightSide
      ? zone.left + zone.width - 24
      : zone.left + 24;

  const anchor =
    rightSide
      ? "end"
      : "start";

  return Buffer.from(`
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="${rightSide
          ? x - 325
          : x - 14}"
        y="${zone.top + 110}"
        width="340"
        height="62"
        rx="31"
        fill="rgba(0,0,0,0.42)"
      />

      <text
        x="${x}"
        y="${zone.top + 151}"
        text-anchor="${anchor}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="25"
        font-weight="600"
        fill="white"
      >Watch now on cimaly.cc</text>
    </svg>
  `);
}

function arabicTitleSvg(
  title,
  zone
) {
  if (!title) {
    return null;
  }

  const lines =
    splitWords(
      title,
      18
    );

  const rightSide =
    zone.name.includes("right");

  const x =
    rightSide
      ? zone.left + zone.width - 24
      : zone.left + 24;

  const anchor =
    rightSide
      ? "end"
      : "start";

  const first =
    escapeXml(
      lines[0] || ""
    );

  const second =
    escapeXml(
      lines[1] || ""
    );

  return Buffer.from(`
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="${x}"
        y="${zone.top + 80}"
        text-anchor="${anchor}"
        direction="rtl"
        unicode-bidi="bidi-override"
        font-family="Arial, sans-serif"
        font-size="44"
        font-weight="700"
        fill="white"
        stroke="rgba(0,0,0,0.7)"
        stroke-width="4"
        paint-order="stroke"
      >
        ${first}
      </text>

      ${
        second
          ? `
            <text
              x="${x}"
              y="${zone.top + 134}"
              text-anchor="${anchor}"
              direction="rtl"
              unicode-bidi="bidi-override"
              font-family="Arial, sans-serif"
              font-size="38"
              font-weight="700"
              fill="white"
              stroke="rgba(0,0,0,0.7)"
              stroke-width="4"
              paint-order="stroke"
            >
              ${second}
            </text>
          `
          : ""
      }
    </svg>
  `);
}

function arabicCTA(zone) {
  const rightSide =
    zone.name.includes("right");

  const x =
    rightSide
      ? zone.left + zone.width - 24
      : zone.left + 24;

  const anchor =
    rightSide
      ? "end"
      : "start";

  return Buffer.from(`
    <svg
      width="${WIDTH}"
      height="${HEIGHT}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="${rightSide
          ? x - 300
          : x - 14}"
        y="${zone.top + 145}"
        width="315"
        height="58"
        rx="29"
        fill="rgba(0,0,0,0.42)"
      />

      <text
        x="${x}"
        y="${zone.top + 184}"
        text-anchor="${anchor}"
        direction="rtl"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="600"
        fill="white"
      >شاهد الآن على cimaly.cc</text>
    </svg>
  `);
}

/* =========================================================
   ENGLISH DESIGN
========================================================= */

async function createEnglishImage({
  poster,
  output
}) {
  const zones =
    await findBestZones(
      poster
    );

  const brandingZone =
    zones[0];

  let ctaZone =
    zones.find(
      z =>
        z.name !==
        brandingZone.name
    );

  if (!ctaZone) {
    ctaZone = zones[1];
  }

  console.log(
    `   Cimaly zone: ${brandingZone.name}`
  );

  console.log(
    `   CTA zone: ${ctaZone.name}`
  );

  await sharp(poster)
    .composite([
      {
        input:
          cimalyBadge(
            brandingZone
          )
      },

      {
        input:
          englishCTA(
            ctaZone
          )
      }
    ])
    .jpeg({
      quality: 95
    })
    .toFile(output);
}

/* =========================================================
   ARABIC DESIGN
========================================================= */

async function createArabicImage({
  poster,
  arabicTitle,
  output
}) {
  const zones =
    await findBestZones(
      poster
    );

  const titleZone =
    zones[0];

  const remaining =
    zones.filter(
      zone =>
        zone.name !==
        titleZone.name
    );

  const brandingZone =
    remaining[0] ||
    zones[1];

  const ctaZone =
    remaining[1] ||
    zones[2];

  console.log(
    `   Arabic title zone: ${titleZone.name}`
  );

  console.log(
    `   Cimaly zone: ${brandingZone.name}`
  );

  console.log(
    `   CTA zone: ${ctaZone.name}`
  );

  const overlays = [];

  const titleSvg =
    arabicTitleSvg(
      arabicTitle,
      titleZone
    );

  if (titleSvg) {
    overlays.push({
      input: titleSvg
    });
  }

  overlays.push({
    input:
      cimalyBadge(
        brandingZone
      )
  });

  overlays.push({
    input:
      arabicCTA(
        ctaZone
      )
  });

  await sharp(poster)
    .composite(overlays)
    .jpeg({
      quality: 95
    })
    .toFile(output);
}

/* =========================================================
   CONTENT GENERATION
========================================================= */

async function generatePair(
  content,
  category
) {
  if (!content) {
    console.log(
      `⚠️ No ${category} selected`
    );

    return null;
  }

  const title =
    content.title_en ||
    content.name ||
    "untitled";

  console.log("");
  console.log(
    `🎨 Creating ${category}: ${title}`
  );

  const posterUrl =
    content.poster_original ||
    content.poster_w780 ||
    content.poster_url;

  if (!posterUrl) {
    console.log(
      `⚠️ No poster for ${title}`
    );

    return null;
  }

  console.log(
    "⬇️ Downloading poster..."
  );

  const original =
    await downloadImage(
      posterUrl
    );

  const poster =
    await preparePoster(
      original
    );

  const arabicTitle =
    await getArabicTitle(
      content
    );

  console.log(
    `🇸🇦 Arabic title: ${
      arabicTitle ||
      "not found"
    }`
  );

  const dateFolder =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    dateFolder,
    {
      recursive: true
    }
  );

  const slug =
    sanitizeFilename(
      title
    ) ||
    String(
      content.tmdb_id
    );

  const enName =
    `${category}-${slug}-en.jpg`;

  const arName =
    `${category}-${slug}-ar.jpg`;

  const enPath =
    path.join(
      dateFolder,
      enName
    );

  const arPath =
    path.join(
      dateFolder,
      arName
    );

  console.log(
    "🇬🇧 Creating EN..."
  );

  await createEnglishImage({
    poster,
    output:
      enPath
  });

  console.log(
    `✅ ${enName}`
  );

  console.log(
    "🇸🇦 Creating AR..."
  );

  await createArabicImage({
    poster,
    arabicTitle,
    output:
      arPath
  });

  console.log(
    `✅ ${arName}`
  );

  return {
    category,
    tmdb_id:
      content.tmdb_id,

    title_en:
      title,

    title_ar:
      arabicTitle,

    poster:
      posterUrl,

    english:
      enName,

    arabic:
      arName
  };
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  if (
    !fs.existsSync(
      SELECTION_FILE
    )
  ) {
    throw new Error(
      "data/last-social-selection.json not found"
    );
  }

  const selection =
    JSON.parse(
      fs.readFileSync(
        SELECTION_FILE,
        "utf8"
      )
    );

  console.log("");
  console.log(
    "🎬 CIMALY SHARP SOCIAL DESIGN"
  );

  const results = [];

  const series =
    await generatePair(
      selection.morning_series,
      "series"
    );

  if (series) {
    results.push(series);
  }

  const anime =
    await generatePair(
      selection.afternoon_anime,
      "anime"
    );

  if (anime) {
    results.push(anime);
  }

  const movie =
    await generatePair(
      selection.evening_movie,
      "movie"
    );

  if (movie) {
    results.push(movie);
  }

  const folder =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    folder,
    {
      recursive: true
    }
  );

  const manifest = {
    generator:
      "Sharp",

    date:
      todayStr(),

    buffer:
      false,

    design_version:
      "cimaly-smart-minimal-v1",

    generated:
      results
  };

  fs.writeFileSync(
    path.join(
      folder,
      "manifest.json"
    ),

    JSON.stringify(
      manifest,
      null,
      2
    ) + "\n"
  );

  console.log("");
  console.log(
    "✅ CIMALY SOCIAL VISUALS COMPLETE"
  );

  console.log(
    `✅ ${results.length * 2} images generated`
  );

  console.log(
    "🚫 Buffer remains OFF"
  );
}

main()
  .catch(error => {
    console.error("");
    console.error(
      "❌ CIMALY SHARP ERROR"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exit(1);
  });
