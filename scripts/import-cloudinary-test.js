import fs from "node:fs";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET
} = process.env;

if (!CLOUDINARY_CLOUD_NAME) {
  throw new Error("CLOUDINARY_CLOUD_NAME is missing");
}

if (!CLOUDINARY_API_KEY) {
  throw new Error("CLOUDINARY_API_KEY is missing");
}

if (!CLOUDINARY_API_SECRET) {
  throw new Error("CLOUDINARY_API_SECRET is missing");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

const OUTPUT_DIR = path.resolve("public/social/test");
const PUBLIC_ID = "cimaly-test-visual";

async function downloadFile(url, outputPath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download failed ${response.status}: ${await response.text()}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  fs.writeFileSync(outputPath, buffer);
}

async function main() {
  console.log("☁️ Searching Cloudinary test image...");

  const result = await cloudinary.api.resources({
    resource_type: "image",
    type: "upload",
    public_ids: [PUBLIC_ID]
  });

  const asset = result.resources?.[0];

  if (!asset) {
    throw new Error(
      `Cloudinary image not found: ${PUBLIC_ID}`
    );
  }

  console.log("✅ Found image:");
  console.log(asset.secure_url);

  fs.mkdirSync(OUTPUT_DIR, {
    recursive: true
  });

  const extension =
    asset.format ||
    "jpg";

  const outputPath =
    path.join(
      OUTPUT_DIR,
      `cimaly-test-visual.${extension}`
    );

  console.log(
    `⬇️ Downloading to ${outputPath}`
  );

  await downloadFile(
    asset.secure_url,
    outputPath
  );

  const manifest = {
    imported_at:
      new Date().toISOString(),

    cloudinary: {
      public_id:
        asset.public_id,

      asset_folder:
        asset.asset_folder || null,

      secure_url:
        asset.secure_url,

      format:
        asset.format,

      width:
        asset.width,

      height:
        asset.height
    },

    github_path:
      outputPath
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
    "✅ CLOUDINARY → GITHUB TEST READY"
  );

  console.log(
    `✅ Saved: ${outputPath}`
  );
}

main()
  .catch(error => {
    console.error("");
    console.error(
      "❌ IMPORT ERROR"
    );

    console.error(
      error.stack ||
      error.message
    );

    process.exit(1);
  });
