import fs from "fs";
import path from "path";
import os from "os";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const items = [
  {
    src: "social-input/en/series.png",
    publicId: "cimaly/social/daily/en/series",
    label: "en_series"
  },
  {
    src: "social-input/en/movie.png",
    publicId: "cimaly/social/daily/en/movie",
    label: "en_movie"
  },
  {
    src: "social-input/en/anime.png",
    publicId: "cimaly/social/daily/en/anime",
    label: "en_anime"
  },
  {
    src: "social-input/ar/series.png",
    publicId: "cimaly/social/daily/ar/series",
    label: "ar_series"
  },
  {
    src: "social-input/ar/movie.png",
    publicId: "cimaly/social/daily/ar/movie",
    label: "ar_movie"
  },
  {
    src: "social-input/ar/anime.png",
    publicId: "cimaly/social/daily/ar/anime",
    label: "ar_anime"
  }
];

async function prepareImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1080, 1350, {
      fit: "cover",
      position: "center"
    })
    .jpeg({
      quality: 92,
      mozjpeg: true
    })
    .toFile(outputPath);
}

async function uploadOne(item) {
  if (!fs.existsSync(item.src)) {
    throw new Error(`Image introuvable: ${item.src}`);
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `${item.label}-${Date.now()}.jpg`
  );

  await prepareImage(item.src, tmpPath);

  const result = await cloudinary.uploader.upload(tmpPath, {
    public_id: item.publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    type: "upload",
    access_mode: "public",
    format: "jpg"
  });

  fs.unlinkSync(tmpPath);

  return {
    label: item.label,
    url: result.secure_url
  };
}

async function main() {
  const urls = {};

  for (const item of items) {
    const result = await uploadOne(item);
    urls[result.label] = result.url;
    console.log(`✅ Uploaded ${result.label}`);
    console.log(result.url);
  }

  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(
    "artifacts/cloudinary-urls.json",
    JSON.stringify(urls, null, 2),
    "utf8"
  );

  console.log("\n✅ Cloudinary HD upload terminé");
}

main().catch((err) => {
  console.error("❌ Upload Cloudinary HD échoué");
  console.error(err);
  process.exit(1);
});
