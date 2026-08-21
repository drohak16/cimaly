const fs = require("fs");

const BUFFER_API_URL = "https://api.buffer.com";
const SELECTION_FILE = "data/last-social-selection.json";

const REQUIRED = [
  "BUFFER_API_KEY",
  "BUFFER_CHANNEL_ID_FACEBOOK",
  "BUFFER_CHANNEL_ID_INSTAGRAM",
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required secret: ${key}`);
  }
}

const cfg = {
  bufferApiKey: process.env.BUFFER_API_KEY,
  facebookChannelId: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
  instagramChannelId: process.env.BUFFER_CHANNEL_ID_INSTAGRAM,
};

const selection = JSON.parse(
  fs.readFileSync(SELECTION_FILE, "utf8")
);

const DAILY_ITEMS = [
  {
    key: "series",
    dataKey: "morning_series",
    hour: 10,
    minute: 0,
    emoji: "📺",
    labelEn: "SERIES PICK",
    labelAr: "اختيار مسلسل",
    hashtags:
      "#Cimaly #Series #TVSeries #Streaming #WatchNow",
  },
  {
    key: "anime",
    dataKey: "afternoon_anime",
    hour: 16,
    minute: 0,
    emoji: "✨",
    labelEn: "ANIME PICK",
    labelAr: "اختيار أنمي",
    hashtags:
      "#Cimaly #Anime #AnimeSeries #Streaming #WatchNow",
  },
  {
    key: "movie",
    dataKey: "evening_movie",
    hour: 20,
    minute: 30,
    emoji: "🎬",
    labelEn: "MOVIE PICK",
    labelAr: "اختيار فيلم",
    hashtags:
      "#Cimaly #Movie #Movies #Cinema #Streaming #WatchNow",
  },
];

function getIstanbulSchedule(hour, minute) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type) =>
    parts.find((p) => p.type === type)?.value;

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  let due = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - 3,
      minute,
      0
    )
  );

  if (due <= now) {
    due = new Date(
      Date.UTC(
        year,
        month - 1,
        day + 1,
        hour - 3,
        minute,
        0
      )
    );
  }

  return due.toISOString();
}

function shortOverview(text, max = 210) {
  if (!text) {
    return "Discover today's Cimaly pick and step into a story worth watching.";
  }

  const clean = text
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= max) {
    return clean;
  }

  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");

  return `${cut
    .slice(
      0,
      lastSpace > 120 ? lastSpace : max
    )
    .trim()}…`;
}

function buildCaption(item) {
  const data = selection[item.dataKey] || {};

  const titleEn =
    data.title_en || item.labelEn;

  const titleAr =
    data.title_ar || titleEn;

  const introEn =
    shortOverview(data.overview_en);

  const introAr = data.overview_ar
    ? shortOverview(
        data.overview_ar,
        180
      )
    : "اكتشف اختيار اليوم على Cimaly واستمتع بقصة تستحق المشاهدة.";

  const watchUrl =
    data.cimaly_url ||
    "https://cimaly.cc";

  return `${item.emoji} ${item.labelEn} | ${item.labelAr}

${titleEn}
${titleAr}

${introEn}

${introAr}

▶️ Watch now | شاهد الآن
${watchUrl}

${item.hashtags}`;
}

function buildPublicImageUrls(item) {
  return [
    `https://cimaly.cc/social/daily/en/${item.key}.jpg`,
    `https://cimaly.cc/social/daily/ar/${item.key}.jpg`,
  ];
}

async function checkPublicImage(url) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Image inaccessible: ${url} | HTTP ${response.status}`
    );
  }
}

function buildMetadata(network) {
  if (network === "facebook") {
    return `
      metadata: {
        facebook: {
          type: post
        }
      }
    `;
  }

  if (network === "instagram") {
    return `
      metadata: {
        instagram: {
          type: post
          shouldShareToFeed: true
        }
      }
    `;
  }

  return "";
}

async function createBufferPost({
  network,
  channelId,
  text,
  dueAt,
  imageUrls,
}) {
  const assets = imageUrls
    .map(
      (url) => `
        {
          image: {
            url: ${JSON.stringify(url)}
          }
        }
      `
    )
    .join(",");

  const metadata =
    buildMetadata(network);

  const query = `
    mutation CreatePost {
      createPost(
        input: {
          text: ${JSON.stringify(text)}
          channelId: ${JSON.stringify(channelId)}
          schedulingType: automatic
          mode: customScheduled
          dueAt: ${JSON.stringify(dueAt)}
          assets: [
            ${assets}
          ]
          ${metadata}
        }
      ) {
        ... on PostActionSuccess {
          post {
            id
            text
          }
        }

        ... on MutationError {
          message
        }
      }
    }
  `;

  const response = await fetch(
    BUFFER_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Authorization:
          `Bearer ${cfg.bufferApiKey}`,
      },
      body: JSON.stringify({
        query,
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `Buffer HTTP error ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  if (data.errors?.length) {
    throw new Error(
      `Buffer GraphQL error: ${JSON.stringify(
        data.errors
      )}`
    );
  }

  const result =
    data.data?.createPost;

  if (!result) {
    throw new Error(
      `Unexpected Buffer response: ${JSON.stringify(
        data
      )}`
    );
  }

  if (result.message) {
    throw new Error(
      `Buffer error: ${result.message}`
    );
  }

  return result.post;
}

function isDuplicateError(error) {
  const msg = String(
    error?.message || error
  ).toLowerCase();

  return (
    msg.includes(
      "already got this one scheduled"
    ) ||
    msg.includes(
      "same thing twice"
    ) ||
    (
      msg.includes("already") &&
      msg.includes("scheduled")
    )
  );
}

async function publishToChannel({
  network,
  name,
  channelId,
  item,
  imageUrls,
  text,
  dueAt,
}) {
  console.log("");
  console.log(
    `Scheduling ${item.key} on ${name}...`
  );

  try {
    const post =
      await createBufferPost({
        network,
        channelId,
        text,
        dueAt,
        imageUrls,
      });

    console.log(
      `✅ SUCCESS ${name}`
    );

    console.log(
      `Buffer Post ID: ${post.id}`
    );

    return true;
  } catch (error) {
    if (isDuplicateError(error)) {
      console.log(
        `⚠️ ${name}: duplicate already scheduled — skipped safely.`
      );

      return true;
    }

    console.error(
      `❌ ${name} failed for ${item.key}`
    );

    console.error(
      error.message
    );

    return false;
  }
}

async function processItem(item) {
  console.log("");
  console.log(
    "================================"
  );
  console.log(
    `Processing ${item.key}`
  );
  console.log(
    "================================"
  );

  const imageUrls =
    buildPublicImageUrls(item);

  console.log(
    "Checking public images..."
  );

  console.log(
    imageUrls.join("\n")
  );

  await Promise.all(
    imageUrls.map(
      checkPublicImage
    )
  );

  console.log(
    "✅ Both images are publicly accessible"
  );

  const dueAt =
    getIstanbulSchedule(
      item.hour,
      item.minute
    );

  const text =
    buildCaption(item);

  let ok = true;

  ok =
    (await publishToChannel({
      network: "facebook",
      name: "Facebook",
      channelId:
        cfg.facebookChannelId,
      item,
      imageUrls,
      text,
      dueAt,
    })) && ok;

  ok =
    (await publishToChannel({
      network: "instagram",
      name: "Instagram",
      channelId:
        cfg.instagramChannelId,
      item,
      imageUrls,
      text,
      dueAt,
    })) && ok;

  console.log("");
  console.log(
    `${item.key} target schedule: ${dueAt}`
  );

  return ok;
}

async function main() {
  console.log(
    "Starting Cimaly Buffer publisher..."
  );

  console.log(
    "Image source: cimaly.cc"
  );

  let allOk = true;

  for (const item of DAILY_ITEMS) {
    allOk =
      (await processItem(item)) &&
      allOk;
  }

  console.log("");
  console.log(
    "Cimaly publisher finished."
  );

  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Fatal error:"
  );

  console.error(error);

  process.exit(1);
});
