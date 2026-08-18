import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const MODEL = "gemini-3.1-flash-image";

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social");

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================
   UTILS
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

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

function detectMimeFromUrl(url = "") {
  const lower = url.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";

  return "image/jpeg";
}

/* =========================
   TMDB
========================= */

async function tmdb(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: TMDB_HEADERS
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDB ${response.status}: ${text}`);
  }

  return response.json();
}

async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Poster download failed: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getArabicTitle(content) {
  if (content.title_ar && containsArabic(content.title_ar)) {
    return content.title_ar;
  }

  const endpoint =
    content.type === "movie"
      ? `/movie/${content.tmdb_id}/translations`
      : `/tv/${content.tmdb_id}/translations`;

  try {
    const data = await tmdb(endpoint);

    const arabic = (data.translations || []).find(
      t => t.iso_639_1 === "ar"
    );

    const candidate =
      arabic?.data?.title ||
      arabic?.data?.name ||
      "";

    if (candidate && containsArabic(candidate)) {
      return candidate;
    }
  } catch (error) {
    console.log("⚠️ Arabic translation lookup failed:", error.message);
  }

  return "";
}

/* =========================
   PROMPTS
========================= */

function buildEnglishPrompt(content) {
  return [
    `Using the provided official poster for "${content.title_en}", create a premium Instagram 4:5 social visual for Cimaly.`,
    `Preserve the original composition, characters, lighting, color palette, mood, and recognizability of the poster.`,
    `Keep the official movie title clearly visible and aesthetically intact.`,
    `Do not cover or crop the title or subtitle.`,
    `Do not add MOVIE PICK, SERIES PICK, or ANIME PICK.`,
    `Do not redesign the poster into a totally different layout.`,
    `Add a small elegant "Cimaly" wordmark in a discreet free corner.`,
    `Add a refined call to action near the bottom that reads exactly: "Watch now on cimaly.cc".`,
    `The CTA must be readable but subtle, and must not cover the movie title, subtitle, faces, or important artwork.`,
    `Do not add black header or footer bands.`,
    `The final result should feel cinematic, polished, premium, and very close to the original poster identity.`
  ].join(" ");
}

function buildArabicPrompt(content, arabicTitle) {
  const arabicRule = arabicTitle
    ? [
        `Create the Arabic version of this same poster.`,
        `Translate the movie title into Arabic as: "${arabicTitle}".`,
        `The Arabic title must be visible, clean, readable, and well integrated into the composition.`,
        `It should feel inspired by the original title styling.`,
        `It must not cover faces or important artwork.`
      ].join(" ")
    : [
        `Create an Arabic-friendly version while keeping the original title visible, because no Arabic title was available from TMDB.`
      ].join(" ");

  return [
    `Using the provided official poster for "${content.title_en}", create a premium Instagram 4:5 Arabic social visual for Cimaly.`,
    `Preserve the original composition, characters, lighting, color palette, mood, and recognizability of the poster.`,
    arabicRule,
    `Do not add MOVIE PICK, SERIES PICK, or ANIME PICK.`,
    `Do not redesign the poster into a totally different layout.`,
    `Add a small elegant "Cimaly" wordmark in a discreet free corner.`,
    `Add a refined call to action near the bottom that reads exactly: "Watch now on cimaly.cc".`,
    `Keep "cimaly.cc" in Latin characters exactly like that.`,
    `The CTA must be readable but subtle, and must not cover the movie title, subtitle, faces, or important artwork.`,
    `Do not add black header or footer bands.`,
    `The final result should feel cinematic, polished, premium, and very close to the original poster identity.`
  ].join(" ");
}

/* =========================
   GEMINI
========================= */

function extractFirstImage(interaction) {
  for (const step of interaction.steps || []) {
    if (step.type === "model_output") {
      for (const block of step.content || []) {
        if (block.type === "image" && block.data) {
          return {
            buffer: Buffer.from(block.data, "base64"),
            mimeType: block.mime_type || "image/png"
          };
        }
      }
    }
  }

  const texts = [];
  for (const step of interaction.steps || []) {
    for (const block of step.content || []) {
      if (block.type === "text" && block.text) {
        texts.push(block.text);
      }
    }
  }

  throw new Error(
    `No image returned by Gemini. Text output: ${texts.join(" | ")}`
  );
}

async function runGeminiEdit({
  prompt,
  posterBuffer,
  mimeType
}) {
  const input = [
    {
      type: "image",
      mime_type: mimeType,
      data: posterBuffer.toString("base64")
    },
    {
      type: "text",
      text: prompt
    }
  ];

  const interaction = await ai.interactions.create({
    model: MODEL,
    input,
    response_format: {
      type: "image",
      aspect_ratio: "4:5",
      image_size: "1K"
    }
  });

  return extractFirstImage(interaction);
}

/* =========================
   MAIN TEST
========================= */

async function generateMovieTest() {
  if (!fs.existsSync(SELECTION_FILE)) {
    throw new Error("data/last-social-selection.json not found");
  }

  const selection = JSON.parse(
    fs.readFileSync(SELECTION_FILE, "utf8")
  );

  const movie = selection.evening_movie;

  if (!movie) {
    throw new Error("evening_movie not found in selection file");
  }

  console.log("");
  console.log("🎬 CIMALY GEMINI TEST");
  console.log(`Movie: ${movie.title_en}`);

  const arabicTitle = await getArabicTitle(movie);

  console.log(
    `Arabic title: ${arabicTitle || "NOT FOUND"}`
  );

  const posterUrl = movie.poster_original || movie.poster_w780;

  if (!posterUrl) {
    throw new Error("No poster URL found in selection");
  }

  console.log("⬇️ Downloading TMDB poster...");
  const posterBuffer = await downloadImage(posterUrl);
  const mimeType = detectMimeFromUrl(posterUrl);

  console.log(`✅ Poster downloaded (${Math.round(posterBuffer.length / 1024)} KB)`);

  const folder = path.join(OUTPUT_ROOT, todayStr());
  fs.mkdirSync(folder, { recursive: true });

  const slug = sanitizeFilename(movie.title_en) || String(movie.tmdb_id);

  const enFilename = `gemini-test-${slug}-en.png`;
  const arFilename = `gemini-test-${slug}-ar.png`;

  const enPath = path.join(folder, enFilename);
  const arPath = path.join(folder, arFilename);

  console.log("");
  console.log("🇬🇧 Generating English visual...");
  const englishResult = await runGeminiEdit({
    prompt: buildEnglishPrompt(movie),
    posterBuffer,
    mimeType
  });

  fs.writeFileSync(enPath, englishResult.buffer);
  console.log(`✅ EN saved: ${enFilename}`);

  console.log("");
  console.log("🇸🇦 Generating Arabic visual...");
  const arabicResult = await runGeminiEdit({
    prompt: buildArabicPrompt(movie, arabicTitle),
    posterBuffer,
    mimeType
  });

  fs.writeFileSync(arPath, arabicResult.buffer);
  console.log(`✅ AR saved: ${arFilename}`);

  const manifest = {
    generator: "Google Gemini API",
    model: MODEL,
    test: true,
    buffer: false,
    content: {
      tmdb_id: movie.tmdb_id,
      title_en: movie.title_en,
      title_ar: arabicTitle,
      poster: posterUrl
    },
    files: {
      english: enFilename,
      arabic: arFilename
    }
  };

  fs.writeFileSync(
    path.join(folder, "gemini-test-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log("");
  console.log("✅ CIMALY GEMINI TEST COMPLETE");
  console.log("✅ English generated");
  console.log("✅ Arabic generated");
  console.log("🚫 Buffer publishing OFF");
}

generateMovieTest().catch(error => {
  console.error("");
  console.error("❌ CIMALY GEMINI ERROR");
  console.error(error.message);
  process.exit(1);
});
