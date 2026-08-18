import fs from "node:fs";
import path from "node:path";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

if (!CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_API_TOKEN is missing");
}

if (!CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is missing");
}

const MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social");

const WIDTH = 1080;
const HEIGHT = 1350;

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

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
    throw new Error(`TMDB ${response.status} on ${pathname}`);
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
    console.log("Arabic translation lookup failed:", error.message);
  }

  return "";
}

function buildEnglishPrompt(content) {
  return [
    `Edit the supplied official movie poster for "${content.title_en}" into a premium Instagram 4:5 social poster.`,
    `Preserve the original composition, cinematic mood, characters, colors, lighting, and recognizability of the poster.`,
    `Keep the original movie title visible and aesthetically intact.`,
    `Do not crop away or cover the title or subtitle.`,
    `Do not add "movie pick", "series pick", or "anime pick".`,
    `Replace the earlier centered logo approach with a small elegant "Cimaly" wordmark placed discreetly in a free corner of the poster.`,
    `Add a tasteful call to action near the bottom that reads exactly: "Watch now on cimaly.cc".`,
    `The CTA must be elegant and readable, but must not cover the title or subtitle.`,
    `Make the result feel polished, premium, cinematic, and very close to the original poster identity.`,
    `Do not create black header or footer bands.`,
    `Do not change the movie into another genre.`,
    `Do not invent a different poster layout.`
  ].join(" ");
}

function buildArabicPrompt(content, arabicTitle) {
  const arabicInstruction = arabicTitle
    ? `Add the movie title translated into Arabic as "${arabicTitle}". The Arabic title must be clearly visible and well designed, while respecting the original poster style as much as possible.`
    : `If no official Arabic title is available, keep the original title visible and add only subtle Arabic-friendly layout touches without damaging the poster.`;

  return [
    `Edit the supplied official movie poster for "${content.title_en}" into a premium Instagram 4:5 Arabic social poster.`,
    `Preserve the original composition, cinematic mood, characters, colors, lighting, and recognizability of the poster.`,
    `Keep the original poster identity intact.`,
    arabicInstruction,
    `The Arabic title must not be awkward, must not be cropped, and must not hide the original important poster design.`,
    `Do not add "movie pick", "series pick", or "anime pick".`,
    `Use a small elegant "Cimaly" wordmark placed discreetly in a free corner of the poster.`,
    `Add a tasteful call to action near the bottom that reads exactly: "Watch now on cimaly.cc".`,
    `The CTA must not cover the title or subtitle.`,
    `Do not create black header or footer bands.`,
    `Keep the design premium, clean, and close to the original poster.`,
    `Do not turn this into a totally different poster.`
  ].join(" ");
}

function negativePrompt() {
  return [
    `ugly layout`,
    `cropped title`,
    `covered title`,
    `covered subtitle`,
    `black top band`,
    `black bottom band`,
    `movie pick label`,
    `series pick label`,
    `anime pick label`,
    `big central logo`,
    `messy typography`,
    `garbled text`,
    `warped faces`,
    `distorted anatomy`,
    `extra limbs`,
    `low quality`,
    `blurry title`,
    `unreadable call to action`,
    `random extra text`
  ].join(", ");
}

async function runCloudflareEdit({
  prompt,
  imageBuffer,
  seed
}) {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;

  const payload = {
    prompt,
    negative_prompt: negativePrompt(),
    image_b64: imageBuffer.toString("base64"),
    width: WIDTH,
    height: HEIGHT,
    num_steps: 20,
    strength: 0.34,
    guidance: 7.5,
    seed
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare AI error ${response.status}: ${errorText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateMoviePosters() {
  if (!fs.existsSync(SELECTION_FILE)) {
    throw new Error("data/last-social-selection.json not found");
  }

  const selection = JSON.parse(fs.readFileSync(SELECTION_FILE, "utf8"));
  const content = selection.evening_movie;

  if (!content) {
    throw new Error("evening_movie not found in selection file");
  }

  console.log(`🎬 Selected movie for Cloudflare test: ${content.title_en}`);

  const arabicTitle = await getArabicTitle(content);
  console.log(arabicTitle ? `Arabic title found: ${arabicTitle}` : "Arabic title not found");

  const posterUrl = content.poster_original || content.poster_w780;

  if (!posterUrl) {
    throw new Error("No poster URL found in selection");
  }

  console.log("⬇️ Downloading TMDB poster...");
  const posterBuffer = await downloadImage(posterUrl);

  const dateFolder = path.join(OUTPUT_ROOT, todayStr());
  fs.mkdirSync(dateFolder, { recursive: true });

  const slug = sanitizeFilename(content.title_en) || String(content.tmdb_id);

  const enFilename = `movie-test-${slug}-en.png`;
  const arFilename = `movie-test-${slug}-ar.png`;

  const enOutput = path.join(dateFolder, enFilename);
  const arOutput = path.join(dateFolder, arFilename);

  console.log("🎨 Generating EN version with Cloudflare AI...");
  const enImage = await runCloudflareEdit({
    prompt: buildEnglishPrompt(content),
    imageBuffer: posterBuffer,
    seed: 1001
  });

  fs.writeFileSync(enOutput, enImage);

  console.log("🎨 Generating AR version with Cloudflare AI...");
  const arImage = await runCloudflareEdit({
    prompt: buildArabicPrompt(content, arabicTitle),
    imageBuffer: posterBuffer,
    seed: 1001
  });

  fs.writeFileSync(arOutput, arImage);

  const manifest = {
    tested_content: {
      type: content.type,
      tmdb_id: content.tmdb_id,
      title_en: content.title_en,
      title_ar: arabicTitle,
      source_poster: posterUrl
    },
    outputs: {
      english: {
        file: enOutput,
        url: `https://cimaly.cc/social/${todayStr()}/${enFilename}`
      },
      arabic: {
        file: arOutput,
        url: `https://cimaly.cc/social/${todayStr()}/${arFilename}`
      }
    }
  };

  fs.writeFileSync(
    path.join(dateFolder, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log("");
  console.log("✅ Cloudflare EN/AR test images generated");
  console.log(JSON.stringify(manifest, null, 2));
  console.log("");
  console.log("⚠️ Buffer publishing is still OFF.");
}

generateMoviePosters().catch(error => {
  console.error("❌", error);
  process.exit(1);
});
