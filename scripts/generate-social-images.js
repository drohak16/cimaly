import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

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
  "@cf/black-forest-labs/flux-2-klein-4b";

const SELECTION_FILE =
  path.resolve("data/last-social-selection.json");

const OUTPUT_ROOT =
  path.resolve("public/social");

const OUTPUT_WIDTH = 1024;
const OUTPUT_HEIGHT = 1280;

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================
   UTILITIES
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
    const text =
      await response.text();

    throw new Error(
      `TMDB ${response.status}: ${text}`
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
          item =>
            item.iso_639_1 === "ar"
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
      "⚠️ Arabic title lookup failed:",
      error.message
    );
  }

  return "";
}

/* =========================
   PREPARE REFERENCE IMAGE
========================= */

async function prepareReferenceImage(
  posterBuffer
) {
  /*
    FLUX.2 Klein reference images
    must be below 512x512.

    We preserve the full poster,
    only making a small reference copy.
  */

  return sharp(posterBuffer)
    .resize({
      width: 500,
      height: 500,
      fit: "inside",
      withoutEnlargement: true
    })
    .png()
    .toBuffer();
}

/* =========================
   ENGLISH PROMPT
========================= */

function buildEnglishPrompt(content) {
  return `
IMAGE 0 is the official poster for "${content.title_en}".

Create a premium vertical 4:5 Cimaly social advertisement based closely on IMAGE 0.

CRITICAL RULES:

Preserve the original poster identity.
Preserve the main characters.
Preserve the original colors.
Preserve the lighting.
Preserve the cinematic atmosphere.
Preserve the visual composition as closely as possible.

The poster must still clearly look like the same official movie poster.

Keep the original movie title clearly visible.
Do not cover the title.
Do not crop the subtitle.
Do not place anything over important typography.

Do NOT add:
MOVIE PICK
SERIES PICK
ANIME PICK

Do NOT use a large centered C logo.

Instead place a small elegant text wordmark:
Cimaly

Put the Cimaly wordmark discreetly in a visually empty area of the poster.

Add one elegant CTA near the bottom:

Watch now on cimaly.cc

The CTA must be clearly readable but subtle.
It must not cover the movie title, subtitle, faces, characters, or important artwork.

Do not add large black header bars.
Do not add large black footer bars.
Do not create a generic social media template.

Use the poster artwork itself as the design.

The finished advertisement should look individually art-directed for this specific movie.

Output should look premium, cinematic and professional.
`;
}

/* =========================
   ARABIC PROMPT
========================= */

function buildArabicPrompt(
  content,
  arabicTitle
) {
  return `
IMAGE 0 is the official poster for "${content.title_en}".

Create the Arabic version of the SAME premium vertical 4:5 Cimaly social advertisement.

CRITICAL:

Use IMAGE 0 as the visual reference.
Keep the same characters, composition, lighting, colors and cinematic identity.

This must clearly remain the same movie poster.

The Arabic movie title is:

"${arabicTitle}"

Replace or reinterpret the visible movie title with the Arabic title "${arabicTitle}".

The Arabic title MUST be visible.
The Arabic title MUST be readable.
The Arabic title MUST NOT be cropped.
The Arabic title MUST NOT cover a face.
The Arabic title MUST NOT be placed randomly.

Adapt the typography so it feels inspired by the original movie title design.

Keep the original poster's artistic personality.

Do NOT add:
MOVIE PICK
SERIES PICK
ANIME PICK

Do NOT use a large centered C logo.

Use only a small elegant Cimaly wordmark in an empty area.

Add this CTA near the bottom:

Watch now on cimaly.cc

Keep that CTA exactly in English.

It must not cover the movie title, subtitle, faces or important artwork.

No large black header.
No large black footer.
No generic template.

The finished Arabic poster must feel like an authentic Arabic localization of the English poster, not a completely different poster.
`;
}

/* =========================
   EXTRACT CLOUDFLARE IMAGE
========================= */

async function extractImageFromResponse(
  response
) {
  const contentType =
    response.headers
      .get("content-type") || "";

  /*
    FLUX generally returns JSON
    containing a base64 image.
  */

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const json =
      await response.json();

    const base64 =
      json?.result?.image ||
      json?.image ||
      (
        typeof json?.result === "string"
          ? json.result
          : null
      );

    if (!base64) {
      throw new Error(
        `Cloudflare returned JSON but no image: ${JSON.stringify(json)}`
      );
    }

    const cleanBase64 =
      base64.includes(",")
        ? base64.split(",").pop()
        : base64;

    return Buffer.from(
      cleanBase64,
      "base64"
    );
  }

  /*
    Fallback in case Cloudflare
    responds directly with image bytes.
  */

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =========================
   CLOUDFLARE FLUX EDIT
========================= */

async function runFluxEdit({
  prompt,
  referenceBuffer,
  seed
}) {
  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`;

  const reference =
    await prepareReferenceImage(
      referenceBuffer
    );

  const MAX_ATTEMPTS = 3;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `☁️ FLUX attempt ${attempt}/${MAX_ATTEMPTS}`
    );

    const form =
      new FormData();

    form.append(
      "prompt",
      prompt
    );

    /*
      IMPORTANT:
      Cloudflare requires exactly
      input_image_0 for reference image.
    */

    form.append(
      "input_image_0",
      new Blob(
        [reference],
        {
          type: "image/png"
        }
      ),
      "poster-reference.png"
    );

    form.append(
      "width",
      String(OUTPUT_WIDTH)
    );

    form.append(
      "height",
      String(OUTPUT_HEIGHT)
    );

    form.append(
      "guidance",
      "4"
    );

    form.append(
      "seed",
      String(seed)
    );

    /*
      DO NOT manually set Content-Type.
      fetch creates the correct multipart boundary.
    */

    const response =
      await fetch(endpoint, {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${CLOUDFLARE_API_TOKEN}`
        },

        body:
          form
      });

    if (response.ok) {
      console.log(
        "✅ FLUX generation successful"
      );

      return extractImageFromResponse(
        response
      );
    }

    const errorText =
      await response.text();

    console.log(
      `⚠️ FLUX HTTP ${response.status}`
    );

    console.log(
      errorText
    );

    const temporary =
      response.status === 429 ||
      errorText.includes(
        "Capacity temporarily exceeded"
      ) ||
      errorText.includes(
        '"code":3040'
      );

    if (!temporary) {
      throw new Error(
        `FLUX error ${response.status}: ${errorText}`
      );
    }

    if (
      attempt === MAX_ATTEMPTS
    ) {
      throw new Error(
        "FLUX temporarily unavailable after 3 attempts."
      );
    }

    const waitSeconds =
      attempt === 1
        ? 15
        : 30;

    console.log(
      `⏳ Waiting ${waitSeconds}s...`
    );

    await sleep(
      waitSeconds * 1000
    );
  }
}

/* =========================
   GENERATE ONE MOVIE
========================= */

async function generateMovieTest() {
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

  const movie =
    selection.evening_movie;

  if (!movie) {
    throw new Error(
      "evening_movie missing"
    );
  }

  console.log("");
  console.log(
    "🎬 CIMALY FLUX TEST"
  );

  console.log(
    `Movie: ${movie.title_en}`
  );

  const arabicTitle =
    await getArabicTitle(
      movie
    );

  console.log(
    `Arabic title: ${
      arabicTitle ||
      "NOT FOUND"
    }`
  );

  if (!arabicTitle) {
    throw new Error(
      "Arabic title required for this test."
    );
  }

  const posterUrl =
    movie.poster_original ||
    movie.poster_w780;

  if (!posterUrl) {
    throw new Error(
      "Movie poster URL missing"
    );
  }

  console.log(
    "⬇️ Downloading TMDB poster..."
  );

  const poster =
    await downloadImage(
      posterUrl
    );

  console.log(
    `✅ Poster downloaded (${Math.round(
      poster.length / 1024
    )} KB)`
  );

  const folder =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    folder,
    {
      recursive: true
    }
  );

  const slug =
    sanitizeFilename(
      movie.title_en
    ) ||
    String(movie.tmdb_id);

  const englishFilename =
    `flux-test-${slug}-en.png`;

  const arabicFilename =
    `flux-test-${slug}-ar.png`;

  const englishPath =
    path.join(
      folder,
      englishFilename
    );

  const arabicPath =
    path.join(
      folder,
      arabicFilename
    );

  /*
    ENGLISH
  */

  console.log("");
  console.log(
    "🇬🇧 Generating English visual..."
  );

  const englishImage =
    await runFluxEdit({
      prompt:
        buildEnglishPrompt(
          movie
        ),

      referenceBuffer:
        poster,

      seed:
        20260818
    });

  await sharp(
    englishImage
  )
    .resize(
      1080,
      1350,
      {
        fit: "cover"
      }
    )
    .png()
    .toFile(
      englishPath
    );

  console.log(
    `✅ EN saved: ${englishFilename}`
  );

  /*
    ARABIC
  */

  console.log("");
  console.log(
    "🇸🇦 Generating Arabic visual..."
  );

  const arabicImage =
    await runFluxEdit({
      prompt:
        buildArabicPrompt(
          movie,
          arabicTitle
        ),

      referenceBuffer:
        poster,

      /*
        Same seed helps keep
        EN / AR visually related.
      */
      seed:
        20260818
    });

  await sharp(
    arabicImage
  )
    .resize(
      1080,
      1350,
      {
        fit: "cover"
      }
    )
    .png()
    .toFile(
      arabicPath
    );

  console.log(
    `✅ AR saved: ${arabicFilename}`
  );

  /*
    MANIFEST
  */

  const manifest = {
    generator:
      "Cloudflare Workers AI",

    model:
      MODEL,

    test:
      true,

    buffer:
      false,

    content: {
      tmdb_id:
        movie.tmdb_id,

      title_en:
        movie.title_en,

      title_ar:
        arabicTitle,

      poster:
        posterUrl
    },

    files: {
      english:
        englishFilename,

      arabic:
        arabicFilename
    }
  };

  fs.writeFileSync(
    path.join(
      folder,
      "flux-test-manifest.json"
    ),

    JSON.stringify(
      manifest,
      null,
      2
    ) + "\n"
  );

  console.log("");
  console.log(
    "✅ CIMALY FLUX TEST COMPLETE"
  );

  console.log(
    "✅ English generated"
  );

  console.log(
    "✅ Arabic generated"
  );

  console.log(
    "🚫 Buffer publishing OFF"
  );
}

/* =========================
   START
========================= */

generateMovieTest()
  .catch(error => {
    console.error("");
    console.error(
      "❌ CIMALY FLUX ERROR"
    );

    console.error(
      error.message
    );

    process.exit(1);
  });
