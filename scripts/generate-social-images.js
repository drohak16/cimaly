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

// Instagram portrait 4:5
const WIDTH = 1080;
const HEIGHT = 1350;

// IMPORTANT:
// Les éléments Cimaly ne sont plus posés sur l'affiche.
// On réserve une zone au-dessus et en dessous.
const TOP_AREA = 175;
const BOTTOM_AREA = 115;
const POSTER_AREA_HEIGHT =
  HEIGHT - TOP_AREA - BOTTOM_AREA;

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* ========================================
   UTILS
======================================== */

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

/* ========================================
   POSTER SELECTION

   IMPORTANT:
   EN + AR utilisent maintenant EXACTEMENT
   le même poster de base.
======================================== */

function posterScore(poster) {
  return (
    Number(poster.vote_average || 0) * 100 +
    Number(poster.vote_count || 0) * 10 +
    Number(poster.width || 0) / 100
  );
}

function bestPosterByLanguage(
  posters,
  language
) {
  const matches =
    posters.filter(
      p =>
        p.iso_639_1 === language
    );

  if (!matches.length) {
    return null;
  }

  return [...matches]
    .sort(
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

  return [...matches]
    .sort(
      (a, b) =>
        posterScore(b) -
        posterScore(a)
    )[0];
}

function bestAnyPoster(posters) {
  if (!posters.length) {
    return null;
  }

  return [...posters]
    .sort(
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

  // PRIORITÉ :
  // 1 English officiel
  // 2 poster neutre
  // 3 poster déjà sélectionné
  // 4 meilleur poster disponible

  const english =
    bestPosterByLanguage(
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

/* ========================================
   ARABIC TITLE

   On cherche plus loin que ar-SA.
======================================== */

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
          translation =>
            translation.iso_639_1 === "ar"
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
      "Arabic translation lookup failed:",
      error.message
    );
  }

  // Dernier fallback :
  // on ne fabrique pas un faux titre arabe.
  return "";
}

/* ========================================
   LABELS
======================================== */

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

/* ========================================
   TOP HEADER

   Cette zone est HORS poster.
   Elle ne peut donc plus couvrir un titre.
======================================== */

function topHeader(
  slot,
  language,
  arabicTitle = ""
) {
  const label =
    escapeXml(
      categoryLabel(
        slot,
        language
      )
    );

  if (
    language === "ar"
  ) {
    const safeTitle =
      escapeXml(
        arabicTitle
      );

    return `
    <svg
      width="${WIDTH}"
      height="${TOP_AREA}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <rect
        width="${WIDTH}"
        height="${TOP_AREA}"
        fill="#090909"
      />

      <rect
        x="510"
        y="17"
        width="60"
        height="60"
        rx="13"
        fill="#ef1717"
      />

      <text
        x="540"
        y="62"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="42"
        font-weight="900"
        fill="#ffffff"
      >C</text>

      <text
        x="540"
        y="105"
        text-anchor="middle"
        direction="rtl"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="20"
        fill="#cfcfcf"
      >${label}</text>

      ${
        safeTitle
          ? `
          <text
            x="540"
            y="148"
            text-anchor="middle"
            direction="rtl"
            font-family="DejaVu Sans, Arial, sans-serif"
            font-size="31"
            font-weight="700"
            fill="#ffffff"
          >${safeTitle}</text>
          `
          : ""
      }

    </svg>`;
  }

  return `
  <svg
    width="${WIDTH}"
    height="${TOP_AREA}"
    xmlns="http://www.w3.org/2000/svg"
  >

    <rect
      width="${WIDTH}"
      height="${TOP_AREA}"
      fill="#090909"
    />

    <rect
      x="510"
      y="25"
      width="60"
      height="60"
      rx="13"
      fill="#ef1717"
    />

    <text
      x="540"
      y="70"
      text-anchor="middle"
      font-family="Arial, sans-serif"
      font-size="42"
      font-weight="900"
      fill="#ffffff"
    >C</text>

    <text
      x="540"
      y="126"
      text-anchor="middle"
      font-family="Arial, sans-serif"
      font-size="20"
      font-weight="600"
      letter-spacing="4"
      fill="#d9d9d9"
    >${label}</text>

  </svg>`;
}

/* ========================================
   BOTTOM CTA

   Aussi HORS poster.
   Donc plus de sous-titre couvert.
======================================== */

function bottomCTA(language) {
  if (
    language === "ar"
  ) {
    return `
    <svg
      width="${WIDTH}"
      height="${BOTTOM_AREA}"
      xmlns="http://www.w3.org/2000/svg"
    >

      <rect
        width="${WIDTH}"
        height="${BOTTOM_AREA}"
        fill="#090909"
      />

      <rect
        x="190"
        y="21"
        width="700"
        height="70"
        rx="18"
        fill="#111111"
        stroke="#cbb98d"
        stroke-width="2"
      />

      <text
        x="540"
        y="66"
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

    </svg>`;
  }

  return `
  <svg
    width="${WIDTH}"
    height="${BOTTOM_AREA}"
    xmlns="http://www.w3.org/2000/svg"
  >

    <rect
      width="${WIDTH}"
      height="${BOTTOM_AREA}"
      fill="#090909"
    />

    <rect
      x="190"
      y="21"
      width="700"
      height="70"
      rx="18"
      fill="#111111"
      stroke="#cbb98d"
      stroke-width="2"
    />

    <text
      x="540"
      y="66"
      text-anchor="middle"
      font-family="Arial, sans-serif"
      font-size="26"
      fill="#ffffff"
    >
      Watch now on
      <tspan
        fill="#ef1717"
        font-weight="800"
      > cimaly.cc</tspan>
    </text>

  </svg>`;
}

/* ========================================
   POSTER AREA

   Le poster complet est conservé.
   Aucun overlay Cimaly dessus.
======================================== */

async function buildPosterArea(
  posterBuffer
) {
  const background =
    await sharp(
      posterBuffer
    )
      .resize(
        WIDTH,
        POSTER_AREA_HEIGHT,
        {
          fit: "cover",
          position: "centre"
        }
      )
      .blur(20)
      .modulate({
        brightness: 0.40
      })
      .jpeg({
        quality: 85
      })
      .toBuffer();

  const foreground =
    await sharp(
      posterBuffer
    )
      .resize(
        WIDTH,
        POSTER_AREA_HEIGHT,
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

  return sharp(background)
    .composite([
      {
        input: foreground,
        top: 0,
        left: 0
      }
    ])
    .jpeg({
      quality: 94
    })
    .toBuffer();
}

/* ========================================
   FINAL IMAGE
======================================== */

async function createImage({
  posterUrl,
  language,
  slot,
  arabicTitle,
  output
}) {
  const posterBuffer =
    await downloadImage(
      posterUrl
    );

  const posterArea =
    await buildPosterArea(
      posterBuffer
    );

  const header =
    Buffer.from(
      topHeader(
        slot,
        language,
        arabicTitle
      )
    );

  const footer =
    Buffer.from(
      bottomCTA(
        language
      )
    );

  const headerImage =
    await sharp(header)
      .png()
      .toBuffer();

  const footerImage =
    await sharp(footer)
      .png()
      .toBuffer();

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: "#090909"
    }
  })
    .composite([
      {
        input: headerImage,
        top: 0,
        left: 0
      },
      {
        input: posterArea,
        top: TOP_AREA,
        left: 0
      },
      {
        input: footerImage,
        top:
          HEIGHT -
          BOTTOM_AREA,
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

/* ========================================
   GENERATE ONE CONTENT
======================================== */

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
      : "Arabic title: NOT AVAILABLE"
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

    language:
      "en",

    slot,

    arabicTitle:
      "",

    output:
      enOutput
  });

  await createImage({
    posterUrl:
      basePoster.url,

    language:
      "ar",

    slot,

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

/* ========================================
   MAIN
======================================== */

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
    "✅ EN + AR use the same poster."
  );

  console.log(
    "✅ Cimaly header does not cover poster titles."
  );

  console.log(
    "✅ CTA does not cover poster subtitles."
  );

  console.log(
    "✅ Arabic title added outside poster when available."
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
