import fs from "fs";

const SUPABASE_FUNCTION_URL =
  "https://yzpdkqjfcivirilkbuwi.supabase.co/functions/v1/upload-social-image";

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY manquant dans GitHub Secrets");
}

// Usage:
// node script/upload-to-supabase.js ./image.jpg daily/en/series.jpg

const localFile = process.argv[2];
const storagePath = process.argv[3];

if (!localFile || !storagePath) {
  console.error(
    "Usage: node script/upload-to-supabase.js <localFile> <storagePath>"
  );
  process.exit(1);
}

if (!fs.existsSync(localFile)) {
  throw new Error(`Fichier introuvable: ${localFile}`);
}

const fileBuffer = fs.readFileSync(localFile);

let contentType = "image/jpeg";

if (localFile.endsWith(".png")) {
  contentType = "image/png";
} else if (localFile.endsWith(".webp")) {
  contentType = "image/webp";
}

const response = await fetch(
  `${SUPABASE_FUNCTION_URL}?path=${encodeURIComponent(storagePath)}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": contentType,
    },
    body: fileBuffer,
  }
);

const text = await response.text();

if (!response.ok) {
  console.error("Upload Supabase échoué:");
  console.error(text);
  process.exit(1);
}

console.log("Upload Supabase réussi");
console.log(text);

const publicUrl =
  `https://yzpdkqjfcivirilkbuwi.supabase.co/storage/v1/object/public/` +
  `cimaly-social/${storagePath}`;

console.log("PUBLIC_URL=" + publicUrl);
