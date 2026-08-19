import fs from "fs";
import path from "path";

const SUPABASE_FUNCTION_URL =
  "https://yzpdkqjfcivirilkbuwi.supabase.co/functions/v1/upload-social-image";

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY manquant dans GitHub Secrets");
}

const localFile = process.argv[2];
const storagePath = process.argv[3];

if (!localFile || !storagePath) {
  console.error(
    "Usage: node scripts/upload-to-supabase.js <localFile> <storagePath>"
  );
  process.exit(1);
}

if (!fs.existsSync(localFile)) {
  throw new Error(`Fichier introuvable: ${localFile}`);
}

const buffer = fs.readFileSync(localFile);

let contentType = "image/jpeg";

if (localFile.toLowerCase().endsWith(".png")) {
  contentType = "image/png";
}

if (localFile.toLowerCase().endsWith(".webp")) {
  contentType = "image/webp";
}

const blob = new Blob([buffer], { type: contentType });

const form = new FormData();

form.append(
  "file",
  blob,
  path.basename(localFile)
);

form.append("path", storagePath);

const response = await fetch(SUPABASE_FUNCTION_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  body: form,
});

const result = await response.json();

if (!response.ok) {
  console.error("❌ Upload Supabase échoué");
  console.error(result);
  process.exit(1);
}

console.log("✅ Upload Supabase réussi");
console.log("Path:", result.path);
console.log("Public URL:", result.public_url);
