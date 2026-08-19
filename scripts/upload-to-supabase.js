import fs from "fs";
import path from "path";

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_BUCKET",
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required secret: ${key}`);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

const FILES = [
  {
    local: "public/social/daily/en/series.jpg",
    remote: "daily/en/series.jpg",
  },
  {
    local: "public/social/daily/ar/series.jpg",
    remote: "daily/ar/series.jpg",
  },
  {
    local: "public/social/daily/en/anime.jpg",
    remote: "daily/en/anime.jpg",
  },
  {
    local: "public/social/daily/ar/anime.jpg",
    remote: "daily/ar/anime.jpg",
  },
  {
    local: "public/social/daily/en/movie.jpg",
    remote: "daily/en/movie.jpg",
  },
  {
    local: "public/social/daily/ar/movie.jpg",
    remote: "daily/ar/movie.jpg",
  },
];

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".png") {
    return "image/png";
  }

  if (ext === ".webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

async function uploadFile(localPath, remotePath) {
  if (!fs.existsSync(localPath)) {
    console.log(`SKIP missing file: ${localPath}`);
    return false;
  }

  const fileBuffer = fs.readFileSync(localPath);
  const contentType = getContentType(localPath);

  const url =
    `${SUPABASE_URL}/storage/v1/object/` +
    `${SUPABASE_BUCKET}/${remotePath}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: fileBuffer,
  });

  const data = await response.text();

  if (!response.ok) {
    throw new Error(
      `Upload failed for ${remotePath}: ${response.status} ${data}`
    );
  }

  console.log(`UPLOADED: ${remotePath}`);

  return true;
}

async function main() {
  console.log("Starting Supabase Storage upload...");

  let uploaded = 0;

  for (const file of FILES) {
    try {
      const success = await uploadFile(
        file.local,
        file.remote
      );

      if (success) {
        uploaded++;
      }
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }

  console.log("");
  console.log(`Uploaded ${uploaded}/${FILES.length} files.`);

  if (uploaded === 0) {
    console.log(
      "No images found. Nothing was uploaded."
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:");
  console.error(error);
  process.exit(1);
});
