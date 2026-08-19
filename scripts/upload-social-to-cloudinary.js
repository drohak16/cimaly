import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const assets = [
  {
    key: "en_movie",
    localPath: "assets/social/en/movie.jpg",
    publicId: "cimaly/social/daily/en/movie",
    folder: "cimaly/social/daily/en",
    displayName: "movie_en"
  },
  {
    key: "en_series",
    localPath: "assets/social/en/series.jpg",
    publicId: "cimaly/social/daily/en/series",
    folder: "cimaly/social/daily/en",
    displayName: "series_en"
  },
  {
    key: "en_anime",
    localPath: "assets/social/en/anime.jpg",
    publicId: "cimaly/social/daily/en/anime",
    folder: "cimaly/social/daily/en",
    displayName: "anime_en"
  },
  {
    key: "ar_movie",
    localPath: "assets/social/ar/movie.jpg",
    publicId: "cimaly/social/daily/ar/movie",
    folder: "cimaly/social/daily/ar",
    displayName: "movie_ar"
  },
  {
    key: "ar_series",
    localPath: "assets/social/ar/series.jpg",
    publicId: "cimaly/social/daily/ar/series",
    folder: "cimaly/social/daily/ar",
    displayName: "series_ar"
  },
  {
    key: "ar_anime",
    localPath: "assets/social/ar/anime.jpg",
    publicId: "cimaly/social/daily/ar/anime",
    folder: "cimaly/social/daily/ar",
    displayName: "anime_ar"
  }
];

async function uploadOne(item) {
  if (!fs.existsSync(item.localPath)) {
    throw new Error(`Image introuvable: ${item.localPath}`);
  }

  const result = await cloudinary.uploader.upload(item.localPath, {
    public_id: item.publicId,
    asset_folder: item.folder,
    display_name: item.displayName,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    use_filename: false,
    unique_filename: false
  });

  return {
    key: item.key,
    secure_url: result.secure_url,
    public_id: result.public_id
  };
}

async function main() {
  const output = {};

  for (const item of assets) {
    const result = await uploadOne(item);
    output[result.key] = result.secure_url;
    console.log(`✅ Uploaded: ${item.key}`);
    console.log(result.secure_url);
  }

  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(
    "artifacts/cloudinary-urls.json",
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log("\n✅ Upload Cloudinary terminé.");
  console.log("✅ Fichier créé: artifacts/cloudinary-urls.json");
}

main().catch((error) => {
  console.error("❌ Erreur upload Cloudinary");
  console.error(error);
  process.exit(1);
});
