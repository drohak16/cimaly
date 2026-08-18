import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} = process.env;

if (!CLOUDINARY_CLOUD_NAME) {
  throw new Error("CLOUDINARY_CLOUD_NAME missing");
}

if (!CLOUDINARY_API_KEY) {
  throw new Error("CLOUDINARY_API_KEY missing");
}

if (!CLOUDINARY_API_SECRET) {
  throw new Error("CLOUDINARY_API_SECRET missing");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

/*
  Cloudinary folders
*/
const EN_FOLDER = "cimaly/social/daily/en";
const AR_FOLDER = "cimaly/social/daily/ar";

/*
  Get current date in Istanbul.
*/
function istanbulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

const TODAY = istanbulDate();

const OUTPUT_DIR = path.resolve(
  "public",
  "social",
  TODAY
);

function sanitize(text = "") {
  return String(text)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function download(url, destination) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download ${response.status}: ${url}`
    );
  }

  const buffer = Buffer.from(
    await response.arrayBuffer()
  );

  fs.writeFileSync(
    destination,
    buffer
  );
}

/*
  Read every asset from one Cloudinary folder.
*/
async function getFolderAssets(folder) {
  let nextCursor = undefined;
  const all = [];

  do {
    const result =
      await cloudinary.api.resources_by_asset_folder(
        folder,
        {
          max_results: 100,
          next_cursor: nextCursor
        }
      );

    all.push(
      ...(result.resources || [])
    );

    nextCursor =
      result.next_cursor;

  } while (nextCursor);

  return all;
}

/*
  We only import today's files.

  Expected public IDs:
  2026-08-19-series-en
  2026-08-19-anime-en
  2026-08-19-movie-en

  and the AR equivalents.
*/
function selectTodayAssets(
  assets,
  language
) {
  return assets.filter(asset => {
    const id =
      asset.public_id || "";

    return (
      id.startsWith(`${TODAY}-`) &&
      id.endsWith(`-${language}`)
    );
  });
}

async function importLanguage({
  folder,
  language
}) {
  console.log("");
  console.log(
    `☁️ Reading ${folder}`
  );

  const assets =
    await getFolderAssets(folder);

  console.log(
    `Found ${assets.length} total asset(s)`
  );

  const todayAssets =
    selectTodayAssets(
      assets,
      language
    );

  console.log(
    `Found ${todayAssets.length} asset(s) for ${TODAY}`
  );

  const imported = [];

  for (const asset of todayAssets) {
    if (!asset.secure_url) {
      continue;
    }

    const extension =
      asset.format || "jpg";

    const filename =
      `${sanitize(asset.public_id)}.${extension}`;

    const destination =
      path.join(
        OUTPUT_DIR,
        filename
      );

    console.log(
      `⬇️ ${filename}`
    );

    await download(
      asset.secure_url,
      destination
    );

    imported.push({
      language,
      public_id:
        asset.public_id,
      asset_folder:
        asset.asset_folder,
      secure_url:
        asset.secure_url,
      filename,
      width:
        asset.width,
      height:
        asset.height,
      format:
        extension,
      created_at:
        asset.created_at
    });
  }

  return imported;
}

async function main() {
  console.log(
    `📅 Istanbul date: ${TODAY}`
  );

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true
    }
  );

  const english =
    await importLanguage({
      folder: EN_FOLDER,
      language: "en"
    });

  const arabic =
    await importLanguage({
      folder: AR_FOLDER,
      language: "ar"
    });

  const files = [
    ...english,
    ...arabic
  ];

  if (files.length === 0) {
    console.log("");
    console.log(
      `⚠️ No daily Cimaly images found for ${TODAY}.`
    );

    console.log(
      "Nothing will be committed."
    );

    return;
  }

  const manifest = {
    date:
      TODAY,

    timezone:
      "Europe/Istanbul",

    imported_at:
      new Date().toISOString(),

    source: {
      english_folder:
        EN_FOLDER,

      arabic_folder:
        AR_FOLDER
    },

    count:
      files.length,

    files
  };

  fs.writeFileSync(
    path.join(
      OUTPUT_DIR,
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
    `✅ Imported ${files.length} image(s)`
  );

  console.log(
    `📁 public/social/${TODAY}/`
  );
}

main()
  .catch(error => {
    console.error("");
    console.error(
      "❌ DAILY IMPORT ERROR"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exit(1);
  });
