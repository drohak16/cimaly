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
    env: "SERIES_EN_URL",
    remote: "daily/en/series.jpg",
  },
  {
    env: "SERIES_AR_URL",
    remote: "daily/ar/series.jpg",
  },
  {
    env: "ANIME_EN_URL",
    remote: "daily/en/anime.jpg",
  },
  {
    env: "ANIME_AR_URL",
    remote: "daily/ar/anime.jpg",
  },
  {
    env: "MOVIE_EN_URL",
    remote: "daily/en/movie.jpg",
  },
  {
    env: "MOVIE_AR_URL",
    remote: "daily/ar/movie.jpg",
  },
];

async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download failed ${response.status}: ${url}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "image/jpeg";

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  return {
    buffer,
    contentType,
  };
}

async function uploadToSupabase(
  remotePath,
  buffer,
  contentType
) {
  const url =
    `${SUPABASE_URL}/storage/v1/object/` +
    `${SUPABASE_BUCKET}/${remotePath}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization:
        `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },

    body: buffer,
  });

  const result = await response.text();

  if (!response.ok) {
    throw new Error(
      `Supabase upload failed ${response.status}: ${result}`
    );
  }
}

async function processFile(file) {
  const sourceUrl =
    process.env[file.env];

  if (!sourceUrl) {
    console.log(
      `SKIP ${file.remote}: ${file.env} missing`
    );

    return false;
  }

  console.log(
    `Downloading ${file.remote}...`
  );

  const image =
    await downloadImage(sourceUrl);

  console.log(
    `Uploading ${file.remote} to Supabase...`
  );

  await uploadToSupabase(
    file.remote,
    image.buffer,
    image.contentType
  );

  console.log(
    `SUCCESS: ${file.remote}`
  );

  return true;
}

async function main() {
  console.log(
    "Starting Cloudinary → Supabase transfer..."
  );

  let transferred = 0;

  for (const file of FILES) {
    try {
      const ok =
        await processFile(file);

      if (ok) {
        transferred++;
      }
    } catch (error) {
      console.error(
        `ERROR ${file.remote}: ${error.message}`
      );

      process.exitCode = 1;
    }
  }

  console.log(
    `Transferred ${transferred}/${FILES.length} images.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
