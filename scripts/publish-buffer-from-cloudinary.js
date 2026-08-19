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

const BUFFER_API_URL = "https://api.buffer.com";
const CLOUDINARY_BASE = "https://res.cloudinary.com/vzsas2fn/image/upload";

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

A new life.
A second chance.
An epic journey.

Watch now on cimaly.cc`
  },
  {
    key: "ar_anime",
    image: `${CLOUDINARY_BASE}/cimaly/social/daily/ar/anime.jpg`,
    text: `اختيار أنمي

موشوكو تينسي: التناسخ بلا عمل

حياة جديدة.
فرصة ثانية.
رحلة ملحمية.

شاهد الآن على cimaly.cc`
  }
];

function gqlString(value) {
  return JSON.stringify(String(value));
}

async function callBufferGraphQL(query) {
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BUFFER_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ query })
  });

  const raw = await response.text();

  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`Réponse Buffer invalide: ${raw}`);
  }

  if (!response.ok) {
    console.error("❌ HTTP error from Buffer");
    console.error(result);
    throw new Error(`Buffer HTTP ${response.status}`);
  }

  if (result.errors && result.errors.length > 0) {
    console.error("❌ GraphQL errors");
    console.error(JSON.stringify(result.errors, null, 2));
    throw new Error(result.errors[0].message || "GraphQL error");
  }

  return result;
}

async function createBufferPost(channelId, text, imageUrl) {
  const mode = PUBLISH_NOW ? "shareNow" : "addToQueue";

  const query = `
    mutation CreatePost {
      createPost(
        input: {
          text: ${gqlString(text)}
          channelId: ${gqlString(channelId)}
          schedulingType: automatic
          mode: ${mode}
          assets: [
            {
              image: {
                url: ${gqlString(imageUrl)}
              }
            }
          ]
        }
      ) {
        ... on PostActionSuccess {
          post {
            id
            text
            status
            dueAt
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const result = await callBufferGraphQL(query);

  const payload = result?.data?.createPost;

  if (!payload) {
    console.error("❌ Réponse createPost vide");
    console.error(JSON.stringify(result, null, 2));
    throw new Error("createPost vide");
  }

  if (payload.message) {
    console.error("❌ MutationError");
    console.error(payload.message);
    throw new Error(payload.message);
  }

  return payload.post;
}

async function main() {
  console.log("Starting Cimaly social test...");
  console.log(`Publish now: ${PUBLISH_NOW ? "YES" : "NO - Buffer queue"}`);

  for (const post of posts) {
    console.log(`\n➡️ ${post.key}`);

    console.log("Facebook...");
    const fb = await createBufferPost(
      FACEBOOK_PROFILE_ID,
      post.text,
      post.image
    );
    console.log("✅ Facebook OK");
    console.log(fb);

    console.log("Instagram...");
    const ig = await createBufferPost(
      INSTAGRAM_PROFILE_ID,
      post.text,
      post.image
    );
    console.log("✅ Instagram OK");
    console.log(ig);
  }

  console.log("\n✅ ALL POSTS SENT TO BUFFER");
}

main().catch((error) => {
  console.error("\n❌ CIMALY SOCIAL ERROR");
  console.error(error);
  process.exit(1);
});
