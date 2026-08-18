import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SELECTION_FILE = path.resolve(
  "data/last-social-selection.json"
);

const OUTPUT_ROOT = path.resolve("public/social");

const WIDTH = 1080;
const HEIGHT = 1350;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function escapeXml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sanitizeFilename(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Could not download poster: ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

function englishOverlay(title, category) {
  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());

  return `
  <svg width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="55%" stop-color="black" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
      </linearGradient>
    </defs>

    <rect
      x="0"
      y="0"
      width="${WIDTH}"
      height="${HEIGHT}"
      fill="url(#bottom)"
    />

    <circle
      cx="82"
      cy="82"
      r="43"
      fill="#050505"
      fill-opacity="0.78"
    />

    <text
      x="82"
      y="101"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="55"
      font-weight="900"
      fill="#e50914"
    >C</text>

    <text
      x="62"
      y="1050"
      font-family="Arial, Helvetica, sans-serif"
      font-size="28"
      font-weight="700"
      letter-spacing="5"
      fill="#ffffff"
    >${safeCategory}</text>

    <text
      x="62"
      y="1125"
      font-family="Arial, Helvetica, sans-serif"
      font-size="54"
      font-weight="800"
      fill="#ffffff"
    >${safeTitle}</text>

    <rect
      x="62"
      y="1185"
      width="235"
      height="62"
      rx="31"
      fill="#e50914"
    />

    <text
      x="179"
      y="1227"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="25"
      font-weight="800"
      fill="white"
    >WATCH NOW</text>

    <text
      x="62"
      y="1300"
      font-family="Arial, Helvetica, sans-serif"
      font-size="26"
      font-weight="600"
      letter-spacing="3"
      fill="white"
    >CIMALY.CC</text>
  </svg>`;
}

function arabicOverlay(title, category) {
  const safeTitle = escapeXml(
    title || "شاهد الآن على Cimaly"
  );

  const safeCategory = escapeXml(category);

  return `
  <svg width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="55%" stop-color="black" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
      </linearGradient>
    </defs>

    <rect
      x="0"
      y="0"
      width="${WIDTH}"
      height="${HEIGHT}"
      fill="url(#bottom)"
    />

    <circle
      cx="82"
      cy="82"
      r="43"
      fill="#050505"
      fill-opacity="0.78"
    />

    <text
      x="82"
      y="101"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-size="55"
      font-weight="900"
      fill="#e50914"
    >C</text>

    <text
      x="1018"
      y="1050"
      text-anchor="end"
      direction="rtl"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="29"
      font-weight="700"
      fill="#ffffff"
    >${safeCategory}</text>

    <text
      x="1018"
      y="1125"
      text-anchor="end"
      direction="rtl"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="52"
      font-weight="800"
      fill="#ffffff"
    >${safeTitle}</text>

    <rect
      x="783"
      y="1185"
      width="235"
      height="62"
      rx="31"
      fill="#e50914"
    />

    <text
      x="900"
      y="1227"
      text-anchor="middle"
      direction="rtl"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="25"
      font-weight="800"
      fill="white"
    >شاهد الآن</text>

    <text
      x="1018"
      y="1300"
      text-anchor="end"
      font-family="Arial, Helvetica, sans-serif"
      font-size="26"
      font-weight="600"
      letter-spacing="3"
      fill="white"
    >CIMALY.CC</text>
  </svg>`;
}

function getCategory(slot, arabic = false) {
  if (slot === "morning_series") {
    return arabic ? "مسلسل" : "SERIES";
  }

  if (slot === "afternoon_anime") {
    return arabic ? "أنمي" : "ANIME";
  }

  return arabic ? "فيلم" : "MOVIE";
}

async function createImage({
  posterBuffer,
  overlay,
  output
}) {
  await sharp(posterBuffer)
    .resize(WIDTH, HEIGHT, {
      fit: "cover",
      position: "centre"
    })
    .composite([
      {
        input: Buffer.from(overlay),
        top: 0,
        left: 0
      }
    ])
    .jpeg({
      quality: 92,
      chromaSubsampling: "4:4:4"
    })
    .toFile(output);
}

async function generateForContent(slot, content, dir) {
  console.log(
    `🎨 Generating ${slot}: ${content.title_en}`
  );

  const poster =
    await downloadImage(
      content.poster_original ||
      content.poster_w780
    );

  const slug =
    sanitizeFilename(content.title_en) ||
    String(content.tmdb_id);

  const enFilename =
    `${slot}-${slug}-en.jpg`;

  const arFilename =
    `${slot}-${slug}-ar.jpg`;

  const enPath =
    path.join(dir, enFilename);

  const arPath =
    path.join(dir, arFilename);

  await createImage({
    posterBuffer: poster,
    overlay: englishOverlay(
      content.title_en,
      getCategory(slot, false)
    ),
    output: enPath
  });

  await createImage({
    posterBuffer: poster,
    overlay: arabicOverlay(
      content.title_ar || content.title_en,
      getCategory(slot, true)
    ),
    output: arPath
  });

  return {
    english: {
      file: enPath,
      url:
        `https://cimaly.cc/social/${todayStr()}/${enFilename}`
    },

    arabic: {
      file: arPath,
      url:
        `https://cimaly.cc/social/${todayStr()}/${arFilename}`
    }
  };
}

async function main() {
  if (!fs.existsSync(SELECTION_FILE)) {
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

  const dayFolder =
    path.join(
      OUTPUT_ROOT,
      todayStr()
    );

  fs.mkdirSync(
    dayFolder,
    {
      recursive: true
    }
  );

  const output = {};

  for (const [
    slot,
    content
  ] of Object.entries(selection)) {
    output[slot] =
      await generateForContent(
        slot,
        content,
        dayFolder
      );
  }

  const manifestPath =
    path.join(
      dayFolder,
      "manifest.json"
    );

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      output,
      null,
      2
    ) + "\n"
  );

  console.log("");
  console.log(
    "✅ SOCIAL IMAGES GENERATED"
  );

  console.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  console.log("");
  console.log(
    "⚠️ Nothing sent to Buffer."
  );
}

main().catch(error => {
  console.error(
    "❌",
    error
  );

  process.exit(1);
});
