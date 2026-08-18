import fs from "node:fs";
import path from "node:path";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

if (!CLOUDFLARE_API_TOKEN) {
  throw new Error("CLOUDFLARE_API_TOKEN is missing");
}

if (!CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is missing");
}

const MODEL =
  "@cf/runwayml/stable-diffusion-v1-5-img2img";

const SELECTION_FILE =
  path.resolve("data/last-social-selection.json");

const OUTPUT_ROOT =
  path.resolve("public/social");

const WIDTH = 1080;
const HEIGHT = 1350;

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================
   BASIC UTILS
========================= */

function todayStr() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function sanitizeFilename(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

/* =========================
   TMDB
========================= */

async function tmdb(pathname, params = {}) {
  const url =
    new URL(
      `https://api.themoviedb.org/3${pathname}`
    );

  for (
    const [key, value]
    of Object.entries(params)
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(
        key,
        value
      );
    }
  }

  const response =
    await fetch(url, {
      headers: TMDB_HEADERS
    });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `TMDB ${response.status} on ${pathname}: ${errorText}`
    );
  }

  return response.json();
}

async function downloadImage(url) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Poster download failed: ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =========================
   ARABIC TITLE
========================= */

async function getArabicTitle(content) {
  if (
    content.title_ar &&
    containsArabic(content.title_ar)
  ) {
    return content.title_ar;
  }

  const endpoint =
    content.type === "movie"
      ? `/movie/${content.tmdb_id}/translations`
      : `/tv/${content.tmdb_id}/translations`;

  try {
    const data =
      await tmdb(endpoint);

    const arabic =
      (data.translations || [])
        .find(
          t =>
            t.iso_639_1 === "ar"
        );

    const candidate =
      arabic?.data?.title ||
      arabic?.data?.name ||
      "";

    if (
      candidate &&
      containsArabic(candidate)
    ) {
      return candidate;
    }
  } catch (error) {
    console.log(
      "⚠️ Arabic translation lookup failed:",
      error.message
    );
  }

  return "";
}

/* =========================
   PROMPTS
========================= */

function buildEnglishPrompt(content) {
  return [
    `Edit the supplied official movie poster for "${content.title_en}".`,
    `Create a premium vertical Instagram 4:5 social poster.`,
    `Preserve the original composition, characters, lighting, colors, atmosphere and overall poster identity.`,
    `Keep the official movie title and subtitle fully visible.`,
    `Do not cover or crop the movie title.`,
    `Do not add MOVIE PICK, SERIES PICK or ANIME PICK.`,
    `Do not place a large logo in the center.`,
    `Add a subtle elegant Cimaly wordmark in a free area of the artwork where it does not cover any important text or character.`,
    `Add the exact CTA "Watch now on cimaly.cc" near the bottom.`,
    `The CTA must be elegant, small and readable.`,
    `The CTA must not cover the title, subtitle, faces or important artwork.`,
    `Do not create black header or footer bands.`,
    `Keep the result extremely close to the original poster.`,
    `Do not redesign the movie poster into a different composition.`,
    `High-end streaming advertising design, cinematic and clean.`
  ].join(" ");
}

function buildArabicPrompt(
  content,
  arabicTitle
) {
  const titleInstruction =
    arabicTitle
      ? [
          `Create an Arabic version of the title using the translation "${arabicTitle}".`,
          `The Arabic title must be clearly visible.`,
          `Match the visual personality, scale, positioning and style of the original movie title as closely as possible.`,
          `Do not use a generic banner behind the Arabic title.`,
          `Do not cover faces or important artwork with the Arabic title.`
        ].join(" ")
      : [
          `Keep the original movie title clearly visible.`,
          `Do not invent an incorrect Arabic translation.`
        ].join(" ");

  return [
    `Edit the supplied official movie poster for "${content.title_en}".`,
    `Create a premium vertical Instagram 4:5 Arabic social poster.`,
    `Preserve the original composition, characters, lighting, colors, atmosphere and overall poster identity.`,
    titleInstruction,
    `Do not add MOVIE PICK, SERIES PICK or ANIME PICK.`,
    `Do not place a large logo in the center.`,
    `Add a subtle elegant Cimaly wordmark in a free area of the artwork.`,
    `Add the exact CTA "Watch now on cimaly.cc" near the bottom.`,
    `Keep the website address in Latin characters exactly as cimaly.cc.`,
    `The CTA must not cover the original title, Arabic title, subtitle, faces or important artwork.`,
    `Do not create black header or footer bands.`,
    `Do not completely redesign the movie poster.`,
    `Keep the result extremely close to the original poster.`,
    `Arabic typography must be clean, correctly connected, centered appropriately and readable.`,
    `High-end streaming advertising design, cinematic and clean.`
  ].join(" ");
}

function negativePrompt() {
  return [
    "ugly graphic design",
    "generic social media template",
    "black header",
    "black footer",
    "movie pick",
    "series pick",
    "anime pick",
    "large centered logo",
    "covered movie title",
    "covered subtitle",
    "cropped title",
    "cropped text",
    "unreadable text",
    "garbled letters",
    "broken Arabic",
    "disconnected Arabic letters",
    "random text",
    "extra text",
    "watermark",
    "distorted face",
    "warped anatomy",
    "extra limbs",
    "low quality",
    "blurry",
    "different movie poster",
    "completely different composition"
  ].join(", ");
}

/* =========================
   CLOUDFLARE AI
========================= */

function isCapacityError(
  status,
  errorText
) {
  return (
    status === 429 &&
    (
      errorText.includes(
        '"code":3040'
      ) ||
      errorText.includes(
        "Capacity temporarily exceeded"
      ) ||
      errorText.includes(
        "Out of capacity"
      )
    )
  );
}

async function runCloudflareEdit({
  prompt,
  imageBuffer,
  seed
}) {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;

  const payload = {
    prompt,
    negative_prompt:
      negativePrompt(),

    image_b64:
      imageBuffer.toString(
        "base64"
      ),

    width:
      WIDTH,

    height:
      HEIGHT,

    num_steps:
      20,

    // Low strength = closer to original poster
    strength:
      0.28,

    guidance:
      7.5,

    seed
  };

  const MAX_ATTEMPTS = 5;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `☁️ Cloudflare AI attempt ${attempt}/${MAX_ATTEMPTS}`
    );

    const response =
      await fetch(url, {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${CLOUDFLARE_API_TOKEN}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
          )
      });

    if (response.ok) {
      console.log(
        "✅ Cloudflare AI generation successful."
      );

      return Buffer.from(
        await response.arrayBuffer()
      );
    }

    const errorText =
      await response.text();

    console.log(
      `⚠️ Cloudflare returned ${response.status}`
    );

    console.log(
      errorText
    );

    const temporary =
      isCapacityError(
        response.status,
        errorText
      );

    if (!temporary) {
      throw new Error(
        `Cloudflare AI error ${response.status}: ${errorText}`
      );
    }

    if (
      attempt ===
      MAX_ATTEMPTS
    ) {
      throw new Error(
        `Cloudflare AI remained out of capacity after ${MAX_ATTEMPTS} attempts.`
      );
    }

    const delays = [
      20,
      40,
      60,
      90,
      120
    ];

    const waitSeconds =
      delays[
        attempt - 1
      ] || 120;

    console.log(
      `⏳ Cloudflare capacity busy. Waiting ${waitSeconds} seconds...`
    );

    await sleep(
      waitSeconds * 1000
    );
  }

  throw new Error(
    "Cloudflare AI generation failed unexpectedly."
  );
}

/* =========================
   GENERATE TEST MOVIE
========================= */

async function generateMoviePosters() {
  if (
    !fs.existsSync(
      SELECTION_FILE
    )
  ) {
    throw new Error(
      "data/last-social-selection.json not found"
    );
  }

  const selection =
    JSON.parse(
      fs.readFileSync(
        SELECTION_FILE,
        "utf8"
      )
    );

  const content =
    selection.evening_movie;

  if (!content) {
    throw new Error(
      "evening_movie not found in selection file"
    );
  }

  console.log("");
  console.log(
    `🎬 Selected movie for Cloudflare test: ${content.title_en}`
  );

  const arabicTitle =
    await getArabicTitle(
      content
    );

  if (arabicTitle) {
    console.log(
      `🇸🇦 Arabic title found: ${arabicTitle}`
    );
  } else {
    console.log(
      "⚠️ No Arabic title found."
    );
  }

  const posterUrl =
    content.poster_original ||
    content.poster_w780;

  if (!posterUrl) {
    throw new Error(
      "No poster URL found in selected movie."
    );
  }

  console.log(
    "⬇️ Downloading original TMDB poster..."
  );

  const posterBuffer =
    await downloadImage(
      posterUrl
    );

  console.log(
    `✅ Poster downloaded: ${Math.round(
      posterBuffer.length / 1024
    )} KB`
  );

  const dateFolder =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    dateFolder,
    {
      recursive: true
    }
  );

  const slug =
    sanitizeFilename(
      content.title_en
    ) ||
    String(
      content.tmdb_id
    );

  const enFilename =
    `movie-test-${slug}-en.png`;

  const arFilename =
    `movie-test-${slug}-ar.png`;

  const enOutput =
    path.join(
      dateFolder,
      enFilename
    );

  const arOutput =
    path.join(
      dateFolder,
      arFilename
    );

  /* ENGLISH */

  console.log("");
  console.log(
    "🎨 Generating EN version with Cloudflare AI..."
  );

  const enImage =
    await runCloudflareEdit({
      prompt:
        buildEnglishPrompt(
          content
        ),

      imageBuffer:
        posterBuffer,

      seed:
        1101
    });

  fs.writeFileSync(
    enOutput,
    enImage
  );

  console.log(
    `✅ EN image saved: ${enFilename}`
  );

  /* ARABIC */

  console.log("");
  console.log(
    "🎨 Generating AR version with Cloudflare AI..."
  );

  const arImage =
    await runCloudflareEdit({
      prompt:
        buildArabicPrompt(
          content,
          arabicTitle
        ),

      imageBuffer:
        posterBuffer,

      seed:
        1101
    });

  fs.writeFileSync(
    arOutput,
    arImage
  );

  console.log(
    `✅ AR image saved: ${arFilename}`
  );

  /* MANIFEST */

  const manifest = {
    generator:
      "Cloudflare Workers AI",

    model:
      MODEL,

    test_only:
      true,

    buffer_publishing:
      false,

    tested_content: {
      type:
        content.type,

      tmdb_id:
        content.tmdb_id,

      title_en:
        content.title_en,

      title_ar:
        arabicTitle,

      source_poster:
        posterUrl
    },

    outputs: {
      english: {
        file:
          enOutput,

        url:
          `https://cimaly.cc/social/${todayStr()}/${enFilename}`
      },

      arabic: {
        file:
          arOutput,

        url:
          `https://cimaly.cc/social/${todayStr()}/${arFilename}`
      }
    }
  };

  fs.writeFileSync(
    path.join(
      dateFolder,
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
    "✅ CLOUDFLARE MOVIE TEST COMPLETE"
  );

  console.log(
    `🎬 ${content.title_en}`
  );

  console.log(
    `🇸🇦 ${arabicTitle || "No Arabic title"}`
  );

  console.log(
    "✅ EN image generated"
  );

  console.log(
    "✅ AR image generated"
  );

  console.log(
    "⚠️ Buffer publishing remains OFF."
  );
}

/* =========================
   START
========================= */

generateMoviePosters()
  .catch(error => {
    console.error("");
    console.error(
      "❌ ERROR:"
    );

    console.error(
      error.message
    );

    process.exit(1);
  });
