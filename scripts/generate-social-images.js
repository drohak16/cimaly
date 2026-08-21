import fs from "node:fs";
import path from "node:path";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social/daily");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function downloadBinary(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function saveImage(url, outputPath) {
  const buffer = await downloadBinary(url);

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ Saved ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(SELECTION_FILE)) {
    throw new Error("data/last-social-selection.json not found");
  }

  const selection = JSON.parse(
    fs.readFileSync(SELECTION_FILE, "utf8")
  );

  const items = [
    {
      key: "series",
      data: selection.morning_series,
    },
    {
      key: "anime",
      data: selection.afternoon_anime,
    },
    {
      key: "movie",
      data: selection.evening_movie,
    },
  ];

  for (const item of items) {
    if (!item.data) {
      throw new Error(`Missing selection for ${item.key}`);
    }

    const tmdbId = Number(item.data.tmdb_id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new Error(`Invalid TMDB ID for ${item.key}`);
    }

    const posterUrl =
      item.data.poster_original ||
      item.data.poster_w780;

    if (!posterUrl) {
      throw new Error(`No poster for ${item.key} TMDB ${tmdbId}`);
    }

    const filename = `${item.key}-${tmdbId}.jpg`;

    const enPath = path.join(
      OUTPUT_ROOT,
      "en",
      filename
    );

    const arPath = path.join(
      OUTPUT_ROOT,
      "ar",
      filename
    );

    console.log(
      `Downloading ${item.key}: ${item.data.title_en} | TMDB ${tmdbId}`
    );

    await saveImage(posterUrl, enPath);
    await saveImage(posterUrl, arPath);
  }

  console.log("");
  console.log("✅ 6 TMDB-ID-bound Cimaly social files prepared.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
