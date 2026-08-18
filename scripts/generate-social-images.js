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
   BASIC UTILS
========================= */

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

function escapeXml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function tmdb(pathname, params = {}) {
  const url =
    new URL(
      `https://api.themoviedb.org/3${pathname}`
    );

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, value);
    }
  }

  const response =
    await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `TMDB ${response.status} ${pathname}`
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

/* =========================
   POSTER SELECTION
========================= */

function posterScore(poster) {
  return (
    Number(poster.vote_average || 0) * 100 +
    Number(poster.vote_count || 0) * 10 +
    Number(poster.width || 0) / 100
  );
}

function bestPoster(posters = [], language) {
  const matches =
    posters.filter(
      poster =>
        poster.iso_639_1 === language
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

function bestNeutralPoster(posters = []) {
  const neutral =
    posters.filter(
      poster =>
        poster.iso_639_1 === null
    );

  if (!neutral.length) {
    return null;
  }

  return [...neutral].sort(
    (a, b) =>
      posterScore(b) -
      posterScore(a)
  )[0];
}

function bestAnyPoster(posters = []) {
  if (!posters.length) {
    return null;
  }

  return [...posters].sort(
    (a, b) =>
      posterScore(b) -
      posterScore(a)
  )[0];
}

function imageUrl(filePath) {
  return filePath
    ? `https://image.tmdb.org/t/p/original${filePath}`
    : "";
}

async function getOfficialPosters(content) {
  const endpoint =
    content.type === "movie"
      ? `/movie/${content.tmdb_id}/images`
      : `/tv/${content.tmdb_id}/images`;

  /*
    TMDB image languages use ISO 639-1.
    We request EN + AR + neutral.
  */
  const data =
    await tmdb(endpoint, {
      include_image_language: "en,ar,null"
    });

  const posters =
    data.posters || [];

  const english =
    bestPoster(posters, "en");

  const arabic =
    bestPoster(posters, "ar");

  const neutral =
    bestNeutralPoster(posters);

  const any =
    bestAnyPoster(posters);

  /*
    EN:
    official English poster first.
    If not available → neutral → existing TMDB poster → any.

    AR:
    official Arabic poster first.
    If not available → neutral → English → existing poster.
  */

  const enPath =
    english?.file_path ||
    neutral?.file_path ||
    null;

  const arPath =
    arabic?.file_path ||
    neutral?.file_path ||
    english?.file_path ||
    null;

  return {
    english:
      imageUrl(enPath) ||
      content.poster_original ||
      content.poster_w780,

    arabic:
      imageUrl(arPath) ||
      content.poster_original ||
      content.poster_w780,

    hasArabicOfficial:
      Boolean(arabic),

    hasEnglishOfficial:
      Boolean(english),

    fallback:
      imageUrl(any?.file_path) || ""
  };
}

/* =========================
   CIMALY BRANDING
========================= */

function categoryLabel(slot, language) {
  if (language === "ar") {
    if (slot === "morning_series") {
      return "اختيار مسلسل";
    }

    if (slot === "afternoon_anime") {
      return "اختيار أنمي";
    }

    return "اختيار فيلم";
  }

  if (slot === "morning_series") {
    return "SERIES PICK";
  }

  if (slot === "afternoon_anime") {
    return "ANIME PICK";
  }

  return "MOVIE PICK";
}

/*
  IMPORTANT:
  No movie title is added here.

  This lets each official poster keep its
  typography / title treatment / identity.
*/

function englishBranding(slot) {
  const label =
    escapeXml(
      categoryLabel(slot, "en")
    );

  return `
  <svg
    width="${WIDTH}"
    height="${HEIGHT}"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="footerFade"
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
          stop-opacity="0.68"
        />
      </linearGradient>
    </defs>

    <!-- Very subtle lower fade -->
    <rect
      x="0"
      y="990"
      width="1080"
      height="360"
      fill="url(#footerFade)"
    />

    <!-- Cimaly logo -->
    <rect
      x="500"
      y="38"
      width="80"
      height="80"
      rx="18"
      fill="#ef1717"
    />

    <text
      x="540"
      y="98"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="54"
      font-weight="900"
      fill="#ffffff"
    >C</text>

    <!-- Small category -->
    <rect
      x="416"
      y="130"
      width="248"
      height="46"
      rx="23"
      fill="#000000"
      fill-opacity="0.48"
    />

    <text
      x="540"
      y="161"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="19"
      font-weight="600"
      letter-spacing="3"
      fill="#ffffff"
    >${label}</text>

    <!-- CTA -->
    <rect
      x="190"
      y="1238"
      width="700"
      height="72"
      rx="20"
      fill="#080808"
      fill-opacity="0.82"
      stroke="#d8c18e"
      stroke-width="2"
    />

    <text
      x="540"
      y="1285"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="27"
      font-weight="400"
      letter-spacing="2"
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

function arabicBranding(slot) {
  const label =
    escapeXml(
      categoryLabel(slot, "ar")
    );

  return `
  <svg
    width="${WIDTH}"
    height="${HEIGHT}"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id="footerFade"
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
          stop-opacity="0.68"
        />
      </linearGradient>
    </defs>

    <rect
      x="0"
      y="990"
      width="1080"
      height="360"
      fill="url(#footerFade)"
    />

    <!-- Cimaly logo -->
    <rect
      x="500"
      y="38"
      width="80"
      height="80"
      rx="18"
      fill="#ef1717"
    />

    <text
      x="540"
      y="98"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="54"
      font-weight="900"
      fill="#ffffff"
    >C</text>

    <!-- Arabic category -->
    <rect
      x="416"
      y="130"
      width="248"
      height="46"
      rx="23"
      fill="#000000"
      fill-opacity="0.48"
    />

    <text
      x="540"
      y="162"
      text-anchor="middle"
      direction="rtl"
      unicode-bidi="bidi-override"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="22"
      font-weight="600"
      fill="#ffffff"
    >${label}</text>

    <!-- Arabic CTA -->
    <rect
      x="
