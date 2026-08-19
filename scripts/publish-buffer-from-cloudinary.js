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

const CLOUDINARY_BASE =
  "https://res.cloudinary.com/vzsas2fn/image/upload";

const posts = [
  {
    key: "en_series",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/en/series.jpg`,
    text: `SERIES PICK

SILO
The truth lies below.

Watch now on cimaly.cc`
  },

  {
    key: "ar_series",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/ar/series.jpg`,
    text: `اختيار مسلسل

سايلو
الحقيقة في الأسفل.

شاهد الآن على cimaly.cc`
  },

  {
    key: "en_movie",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/en/movie.jpg`,
    text: `MOVIE PICK

AVENGERS: DOOMSDAY
The fight for our world begins now.

Watch now on cimaly.cc`
  },

  {
    key: "ar_movie",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/ar/movie.jpg`,
    text: `اختيار فيلم

المنتقمون: يوم القيامة
المواجهة الأخيرة تبدأ الآن.

شاهد الآن على cimaly.cc`
  },

  {
    key: "en_anime",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/en/anime.jpg`,
    text: `ANIME PICK

MUSHOKU TENSEI: JOBLESS REINCARNATION

A new life. A second chance. An epic journey.

Watch now on cimaly.cc`
  },

  {
    key: "ar_anime",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/ar/anime.jpg`,
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
    console.error("Buffer error:", result);
    throw new Error(`Buffer HTTP ${response.status}`);
  }

  return result;
}

async function main() {
  for (const post of posts) {
    console.log(`Publishing ${post.key} → Facebook`);

    await createBufferPost(
      FACEBOOK_PROFILE_ID,
      post.text,
      post.image
    );

    console.log(`Publishing ${post.key} → Instagram`);

    await createBufferPost(
      INSTAGRAM_PROFILE_ID,
      post.text,
      post.image
    );
  }

  console.log("✅ All posts sent to Buffer");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
