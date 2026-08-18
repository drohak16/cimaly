import fs from "node:fs";
import path from "node:path";

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!POLLINATIONS_API_KEY) {
  throw new Error("POLLINATIONS_API_KEY is missing");
}

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const MODEL = "nanobanana-2";

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

async function tmdb(pathname) {
  const response = await fetch(
    `https://api.themoviedb.org/3${pathname}`,
    { headers: TMDB_HEADERS }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDB ${response.status}: ${text}`);
  }

  return response.json();
}

async function downloadBinary(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Download failed ${response.status}: ${text}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildPrompt(title) {
  return [
    `Edit the supplied official movie poster for "${title}".`,
    `Create a premium cinematic vertical streaming promo for Cimaly for Instagram.`,
    `Preserve the original composition, title, subtitle, characters, atmosphere, colors, and recognizability of the poster.`,
    `Do not turn it into a different movie poster.`,
    `Do not change the genre or main visual identity.`,
    `Keep the official movie title visible and aesthetically intact.`,
    `Do not cover or crop the title or subtitle.`,
    `Do not add MOVIE PICK, SERIES PICK, or ANIME PICK.`,
    `Add a small elegant "Cimaly" wordmark in a discreet empty area.`,
    `Add a tasteful call to action near the bottom that reads exactly: "Watch now on cimaly.cc".`,
    `The CTA must be elegant, readable, and must not cover the title, subtitle, faces, or important artwork.`,
    `No thick black bars, no ugly template, no random extra text.`,
    `The final result should feel premium, polished, cinematic, and very close to the original poster identity.`
  ].join(" ");
}

async function extractEditedImage(response) {
  const data = await response.json();

  const first = data?.data?.[0];

  if (!first) {
    throw new Error(`No image returned by Pollinations: ${JSON.stringify(data)}`);
  }

  if (first.b64_json) {
    return Buffer.from(first.b64_json, "base64");
  }

  if (first.url) {
    return await downloadBinary(first.url);
  }

  throw new Error(`Unsupported Pollinations response: ${JSON.stringify(data)}`);
}

async function runPollinationsEdit({ imageBuffer, title }) {
  const form = new FormData();

  form.append(
    "image",
    new Blob([imageBuffer], { type: "image/jpeg" }),
    "poster.jpg"
  );

  form.append("model", MODEL);
  form.append("prompt", buildPrompt(title));
  form.append("response_format", "b64_json");

  const response = await fetch(
    "https://gen.pollinations.ai/v1/images/edits",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${POLLINATIONS_API_KEY}`
      },
      body: form
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pollinations ${response.status}: ${text}`);
  }

  return await extractEditedImage(response);
}

/* =========================
   MAIN TEST
========================= */

async function main() {
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
  console.log("🎬 CIMALY POLLINATIONS TEST");
  console.log(`Movie: ${movie.title_en}`);

  const posterUrl =
    movie.poster_original ||
    movie.poster_w780 ||
    movie.poster_url;

  if (!posterUrl) {
    throw new Error("No poster URL found for selected movie");
  }

  console.log("⬇️ Downloading TMDB poster...");
  const posterBuffer = await downloadBinary(posterUrl);
  console.log(`✅ Poster downloaded (${Math.round(posterBuffer.length / 1024)} KB)`);

  console.log("🎨 Generating EN visual with Pollinations...");
  const editedImage = await runPollinationsEdit({
    imageBuffer: posterBuffer,
    title: movie.title_en
  });

  const folder = path.join(OUTPUT_ROOT, todayStr());
  fs.mkdirSync(folder, { recursive: true });

  const slug =
    sanitizeFilename(movie.title_en) ||
    String(movie.tmdb_id);

  const filename = `pollinations-test-${slug}-en.png`;
  const outputPath = path.join(folder, filename);

  fs.writeFileSync(outputPath, editedImage);

  const manifest = {
    generator: "Pollinations.ai",
    model: MODEL,
    test: true,
    buffer: false,
    content: {
      type: movie.type,
      tmdb_id: movie.tmdb_id,
      title_en: movie.title_en,
      poster: posterUrl
    },
    files: {
      english: filename
    }
  };

  fs.writeFileSync(
    path.join(folder, "pollinations-test-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );

  console.log("");
  console.log("✅ CIMALY POLLINATIONS TEST COMPLETE");
  console.log(`✅ EN image saved: ${filename}`);
  console.log("🚫 Buffer publishing OFF");
}

main().catch(error => {
  console.error("");
  console.error("❌ CIMALY POLLINATIONS ERROR");
  console.error(error.message);
  process.exit(1);
});
