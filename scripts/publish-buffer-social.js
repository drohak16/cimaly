import fs from "fs";

const BUFFER_ACCESS_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const FACEBOOK_PROFILE_ID = process.env.BUFFER_FACEBOOK_PROFILE_ID;
const INSTAGRAM_PROFILE_ID = process.env.BUFFER_INSTAGRAM_PROFILE_ID;
const PUBLISH_NOW = process.env.PUBLISH_NOW === "true";

if (!BUFFER_ACCESS_TOKEN) {
  throw new Error("BUFFER_ACCESS_TOKEN manquant");
}
if (!FACEBOOK_PROFILE_ID) {
  throw new Error("BUFFER_FACEBOOK_PROFILE_ID manquant");
}
if (!INSTAGRAM_PROFILE_ID) {
  throw new Error("BUFFER_INSTAGRAM_PROFILE_ID manquant");
}

if (!fs.existsSync("artifacts/cloudinary-urls.json")) {
  throw new Error("artifacts/cloudinary-urls.json introuvable");
}

const urls = JSON.parse(
  fs.readFileSync("artifacts/cloudinary-urls.json", "utf8")
);

const posts = [
  {
    key: "en_series",
    image: urls.en_series,
    text: `SERIES PICK

SILO
The truth lies below.

Watch now on cimaly.cc`
  },
  {
    key: "ar_series",
    image: urls.ar_series,
    text: `اختيار مسلسل

سايلو
الحقيقة في الأسفل.

شاهد الآن على cimaly.cc`
  },
  {
    key: "en_movie",
    image: urls.en_movie,
    text: `MOVIE PICK

AVENGERS: DOOMSDAY
The fight for our world begins now.

Watch now on cimaly.cc`
  },
  {
    key: "ar_movie",
    image: urls.ar_movie,
    text: `اختيار فيلم

المنتقمون: يوم القيامة
المواجهة الأخيرة تبدأ الآن.

شاهد الآن على cimaly.cc`
  },
  {
    key: "en_anime",
    image: urls.en_anime,
    text: `ANIME PICK

MUSHOKU TENSEI: JOBLESS REINCARNATION
A new life. A second chance. An epic journey.

Watch now on cimaly.cc`
  },
  {
    key: "ar_anime",
    image: urls.ar_anime,
    text: `اختيار أنمي

موشوكو تينسي: التناسخ بلا عمل
حياة جديدة. فرصة ثانية. رحلة ملحمية.

شاهد الآن على cimaly.cc`
  }
];

async function createBufferPost(profileId, text, imageUrl) {
  const form = new URLSearchParams();
  form.append("access_token", BUFFER_ACCESS_TOKEN);
  form.append("text", text);
  form.append("profile_ids[]", profileId);
  form.append("media[photo]", imageUrl);

  if (PUBLISH_NOW) {
    form.append("now", "true");
  }

  const response = await fetch(
    "https://api.bufferapp.com/1/updates/create.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("❌ Buffer error:", result);
    throw new Error(`Erreur Buffer HTTP ${response.status}`);
  }

  return result;
}

async function main() {
  for (const post of posts) {
    console.log(`\n🚀 ${post.key} → Facebook`);
    await createBufferPost(FACEBOOK_PROFILE_ID, post.text, post.image);

    console.log(`🚀 ${post.key} → Instagram`);
    await createBufferPost(INSTAGRAM_PROFILE_ID, post.text, post.image);
  }

  console.log("\n✅ Tous les posts ont été envoyés à Buffer.");
}

main().catch((error) => {
  console.error("❌ Erreur publication Buffer");
  console.error(error);
  process.exit(1);
});
