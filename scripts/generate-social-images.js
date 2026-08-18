import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const SELECTION_FILE =
  path.resolve("data/last-social-selection.json");

const OUTPUT_ROOT =
  path.resolve("public/social");

const WIDTH = 1080;
const HEIGHT = 1350;

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================
   UTILS
========================= */

function todayStr() {
  return new Date()
    .toISOString()
    .slice(0, 10);
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

function escapeXml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

async function tmdb(pathname, params = {}) {
  const url =
    new URL(
      `https://api.themoviedb.org/3${pathname}`
    );

  for (const [key, value]
    of Object.entries(params)) {

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        value
      );
    }
  }

  const response =
    await fetch(url, {
      headers
    });

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status} ${pathname}`
    );
  }

  return response.json();
}

async function downloadImage(url) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Poster download failed: ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

function imageUrl(filePath) {
  return filePath
    ? `https://image.tmdb.org/t/p/original${filePath}`
    : "";
}

/* =========================
   POSTER
   SAME BASE FOR EN + AR
========================= */

function posterScore(poster) {
  return (
    Number(poster.vote_average || 0) * 100 +
    Number(poster.vote_count || 0) * 10 +
    Number(poster.width || 0) / 100
  );
}

function bestPoster(posters, language) {
  const matches =
    posters.filter(
      p =>
        p.iso_639_1 === language
    );

  if (!matches.length) {
    return null;
  }

  return [...matches].sort(
    (a, b) =>
      posterScore(b) -
      posterScore(a)
  )[0];
}

function bestNeutralPoster(posters) {
  const matches =
    posters.filter(
      p =>
        p.iso_639_1 === null
    );

  if (!matches.length) {
    return null;
  }

  return [...matches].sort(
    (a, b) =>
      posterScore(b) -
      posterScore(a)
  )[0];
}

function bestAnyPoster(posters) {
  if (!posters.length) {
    return null;
  }

  return [...posters].sort(
    (a, b) =>
      posterScore(b) -
      posterScore(a)
  )[0];
}

async function getBasePoster(content) {
  const endpoint =
    content.type === "movie"
      ? `/movie/${content.tmdb_id}/images`
      : `/tv/${content.tmdb_id}/images`;

  const data =
    await tmdb(endpoint, {
      include_image_language:
        "en,null,ar"
    });

  const posters =
    data.posters || [];

  const english =
    bestPoster(
      posters,
      "en"
    );

  const neutral =
    bestNeutralPoster(
      posters
    );

  const any =
    bestAnyPoster(
      posters
    );

  const url =
    imageUrl(
      english?.file_path
    ) ||
    imageUrl(
      neutral?.file_path
    ) ||
    content.poster_original ||
    content.poster_w780 ||
    imageUrl(
      any?.file_path
    );

  if (!url) {
    throw new Error(
      `No poster found for ${content.title_en}`
    );
  }

  return {
    url,
    source:
      english
        ? "EN_OFFICIAL"
        : neutral
          ? "NEUTRAL"
          : "FALLBACK"
  };
}

/* =========================
   ARABIC TITLE
========================= */

async function getArabicTitle(content) {
  if (
    content.title_ar &&
    containsArabic(content.title_ar)
  ) {
    return content.title_ar;
  }

  const endpoint =
    content.type === "movie"
      ? `/movie/${content.tmdb_id}/translations`
      : `/tv/${content.tmdb_id}/translations`;

  try {
    const data =
      await tmdb(endpoint);

    const arabic =
      (data.translations || [])
        .find(
          t =>
            t.iso_639_1 === "ar"
        );

    const candidate =
      arabic?.data?.title ||
      arabic?.data?.name ||
      "";

    if (
      candidate &&
      containsArabic(candidate)
    ) {
      return candidate;
    }
  } catch (error) {
    console.log(
      "Arabic title lookup failed:",
      error.message
    );
  }

  return "";
}

/* =========================
   LABELS
========================= */

function categoryLabel(
  slot,
  language
) {
  if (language === "ar") {
    if (
      slot === "morning_series"
    ) {
      return "اختيار مسلسل";
    }

    if (
      slot === "afternoon_anime"
    ) {
      return "اختيار أنمي";
    }

    return "اختيار فيلم";
  }

  if (
    slot === "morning_series"
  ) {
    return "SERIES PICK";
  }

  if (
    slot === "afternoon_anime"
  ) {
    return "ANIME PICK";
  }

  return "MOVIE PICK";
}

/* =========================
   SAFE TITLE WRAPPING
========================= */

function splitArabicTitle(
  title,
  maxChars = 24
) {
  if (!title) {
    return [];
  }

  const words =
    title.split(/\s+/);

  const lines = [];
  let current = "";

  for (const word of words) {
    const test =
      current
        ? `${current} ${word}`
        : word;

    if (
      test.length >
      maxChars
    ) {
      if (current) {
        lines.push(current);
      }

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

/* =========================
   OVERLAY
========================= */

function createOverlay({
  slot,
  language,
  arabicTitle
}) {
  const category =
    escapeXml(
      categoryLabel(
        slot,
        language
      )
    );

  const isArabic =
    language === "ar";

  const arabicLines =
    isArabic
      ? splitArabicTitle(
          arabicTitle,
          24
        )
      : [];

  const titleBlock =
    isArabic &&
    arabicLines.length
      ? `
        <rect
          x="120"
          y="150"
          width="840"
          height="${
            arabicLines.length === 1
              ? 74
              : 118
          }"
          rx="24"
          fill="#000"
          fill-opacity="0.28"
        />

        ${arabicLines.map(
          (line, index) => `
          <text
            x="540"
            y="${195 + index * 46}"
            text-anchor="middle"
            direction="rtl"
            font-family="DejaVu Sans, Arial, sans-serif"
            font-size="${
              arabicLines.length === 1
                ? 43
                : 38
            }"
            font-weight="800"
            fill="#ffffff"
            stroke="#000000"
            stroke-opacity="0.22"
            stroke-width="1"
          >${escapeXml(line)}</text>
        `
        ).join("")}
      `
      : "";

  return `
  <svg
    width="${WIDTH}"
    height="${HEIGHT}"
    xmlns="http://www.w3.org/2000/svg"
  >

    <defs>
      <linearGradient
        id="bottomFade"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="#000"
          stop-opacity="0"
        />

        <stop
          offset="100%"
          stop-color="#000"
          stop-opacity="0.62"
        />
      </linearGradient>
    </defs>

    <!-- CIMALY LOGO -->
    <rect
      x="506"
      y="34"
      width="68"
      height="68"
      rx="16"
      fill="#ef1717"
    />

    <text
      x="540"
      y="84"
      text-anchor="middle"
      font-family="Arial, sans-serif"
      font-size="47"
      font-weight="900"
      fill="#ffffff"
    >C</text>

    <!-- CATEGORY -->
    <rect
      x="425"
      y="111"
      width="230"
      height="42"
      rx="21"
      fill="#000000"
      fill-opacity="0.34"
    />

    <text
      x="540"
      y="139"
      text-anchor="middle"
      ${
        isArabic
          ? 'direction="rtl"'
          : ""
      }
      font-family="${
        isArabic
          ? "DejaVu Sans, Arial, sans-serif"
          : "Arial, sans-serif"
      }"
      font-size="19"
      font-weight="600"
      ${
        isArabic
          ? ""
          : 'letter-spacing="3"'
      }
      fill="#ffffff"
    >${category}</text>

    ${titleBlock}

    <!-- SUBTLE BOTTOM FADE -->
    <rect
      x="0"
      y="1090"
      width="${WIDTH}"
      height="260"
      fill="url(#bottomFade)"
    />

    <!-- CTA -->
    <rect
      x="185"
      y="1242"
      width="710"
      height="70"
      rx="22"
      fill="#090909"
      fill-opacity="0.78"
      stroke="#d4bf8f"
      stroke-width="2"
    />

    ${
      isArabic
        ? `
        <text
          x="540"
          y="1287"
          text-anchor="middle"
          direction="rtl"
          font-family="DejaVu Sans, Arial, sans-serif"
          font-size="27"
          fill="#ffffff"
        >
          شاهد الآن على
          <tspan
            direction="ltr"
            fill="#ef1717"
            font-weight="800"
          > cimaly.cc</tspan>
        </text>
        `
        : `
        <text
          x="540"
          y="1287"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="27"
          fill="#ffffff"
        >
          Watch now on
          <tspan
            fill="#ef1717"
            font-weight="800"
          > cimaly.cc</tspan>
        </text>
        `
    }

  </svg>`;
}

/* =========================
   CREATE IMAGE
========================= */

async function createImage({
  posterUrl,
  slot,
  language,
  arabicTitle,
  output
}) {
  const poster =
    await downloadImage(
      posterUrl
    );

  // full frame
  const background =
    await sharp(poster)
      .resize(
        WIDTH,
        HEIGHT,
        {
          fit: "cover",
          position: "centre"
        }
      )
      .blur(22)
      .modulate({
        brightness: 0.62
      })
      .jpeg({
        quality: 86
      })
      .toBuffer();

  // preserve the whole official poster
  const foreground =
    await sharp(poster)
      .resize(
        WIDTH,
        HEIGHT,
        {
          fit: "contain",
          position: "centre",
          background: {
            r: 0,
            g: 0,
            b: 0,
            alpha: 0
          }
        }
      )
      .png()
      .toBuffer();

  const overlay =
    Buffer.from(
      createOverlay({
        slot,
        language,
        arabicTitle
      })
    );

  await sharp(background)
    .composite([
      {
        input:
          foreground,
        top: 0,
        left: 0
      },
      {
        input:
          overlay,
        top: 0,
        left: 0
      }
    ])
    .jpeg({
      quality: 94,
      chromaSubsampling:
        "4:4:4"
    })
    .toFile(output);
}

/* =========================
   GENERATE
========================= */

async function generateContent(
  slot,
  content,
  directory
) {
  console.log("");
  console.log(
    `🎨 ${slot}: ${content.title_en}`
  );

  const basePoster =
    await getBasePoster(
      content
    );

  console.log(
    `Base poster: ${basePoster.source}`
  );

  console.log(
    "EN + AR use SAME base poster."
  );

  const arabicTitle =
    await getArabicTitle(
      content
    );

  console.log(
    arabicTitle
      ? `Arabic title: ${arabicTitle}`
      : "Arabic title: not available"
  );

  const slug =
    sanitizeFilename(
      content.title_en
    ) ||
    String(
      content.tmdb_id
    );

  const enFilename =
    `${slot}-${slug}-en.jpg`;

  const arFilename =
    `${slot}-${slug}-ar.jpg`;

  const enOutput =
    path.join(
      directory,
      enFilename
    );

  const arOutput =
    path.join(
      directory,
      arFilename
    );

  await createImage({
    posterUrl:
      basePoster.url,

    slot,

    language:
      "en",

    arabicTitle:
      "",

    output:
      enOutput
  });

  await createImage({
    posterUrl:
      basePoster.url,

    slot,

    language:
      "ar",

    arabicTitle,

    output:
      arOutput
  });

  return {
    english: {
      file:
        enOutput,

      url:
        `https://cimaly.cc/social/${todayStr()}/${enFilename}`
    },

    arabic: {
      file:
        arOutput,

      url:
        `https://cimaly.cc/social/${todayStr()}/${arFilename}`
    },

    same_base_poster:
      true,

    arabic_title:
      arabicTitle
  };
}

/* =========================
   MAIN
========================= */

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

  const directory =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    directory,
    {
      recursive: true
    }
  );

  const manifest = {};

  for (
    const [slot, content]
    of Object.entries(
      selection
    )
  ) {
    manifest[slot] =
      await generateContent(
        slot,
        content,
        directory
      );
  }

  fs.writeFileSync(
    path.join(
      directory,
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
    "✅ CIMALY VISUALS GENERATED"
  );

  console.log(
    "✅ Full-frame poster preserved."
  );

  console.log(
    "✅ Same poster used for EN and AR."
  );

  console.log(
    "✅ Arabic title added when available."
  );

  console.log(
    "✅ Watch now on cimaly.cc added."
  );

  console.log(
    "✅ No black header/footer bands."
  );

  console.log("");
  console.log(
    "⚠️ BUFFER PUBLISHING IS STILL OFF."
  );
}

main().catch(error => {
  console.error(
    "❌",
    error
  );

  process.exit(1);
});
