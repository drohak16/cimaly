const BUFFER_API_URL = "https://api.buffer.com";

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

const DAILY_ITEMS = [
  {
    key: "series",
    hour: 10,
    minute: 0,
    emoji: "📺",
    en: "Series pick",
    ar: "اختيار مسلسل",
  },
  {
    key: "anime",
    hour: 16,
    minute: 0,
    emoji: "✨",
    en: "Anime pick",
    ar: "اختيار أنمي",
  },
  {
    key: "movie",
    hour: 20,
    minute: 30,
    emoji: "🎬",
    en: "Movie pick",
    ar: "اختيار فيلم",
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
    parts.find((part) => part.type === type)?.value;

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  let due = new Date(
    Date.UTC(year, month - 1, day, hour - 3, minute, 0)
  );

  if (due <= now) {
    due = new Date(
      Date.UTC(year, month - 1, day + 1, hour - 3, minute, 0)
    );
  }

  return due.toISOString();
}

function buildCaption(item) {
  return `${item.emoji} ${item.en}
${item.ar}

Watch now on cimaly.cc
شاهد الآن على cimaly.cc`;
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

  return true;
}

async function createBufferPost({
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

  const query = `
    mutation CreatePost {
      createPost(
        input: {
          text: ${JSON.stringify(text)}
          channelId: ${JSON.stringify(channelId)}
          schedulingType: automatic
          mode: customScheduled
          dueAt: ${JSON.stringify(dueAt)}
          assets: [${assets}]
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

  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.bufferApiKey}`,
    },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Buffer HTTP error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  if (data.errors?.length) {
    throw new Error(
      `Buffer GraphQL error: ${JSON.stringify(data.errors)}`
    );
  }

  const result = data.data?.createPost;

  if (!result) {
    throw new Error(
      `Unexpected Buffer response: ${JSON.stringify(data)}`
    );
  }

  if (result.message) {
    throw new Error(`Buffer error: ${result.message}`);
  }

  return result.post;
}

async function processItem(item) {
  console.log("");
  console.log("================================");
  console.log(`Processing ${item.key}`);
  console.log("================================");

  const imageUrls = buildPublicImageUrls(item);

  console.log("Checking public images...");
  console.log(imageUrls[0]);
  console.log(imageUrls[1]);

  await Promise.all(
    imageUrls.map((url) => checkPublicImage(url))
  );

  console.log("✅ Both images are publicly accessible");

  const dueAt = getIstanbulSchedule(
    item.hour,
    item.minute
  );

  const text = buildCaption(item);

  const channels = [
    {
      name: "Facebook",
      id: cfg.facebookChannelId,
    },
    {
      name: "Instagram",
      id: cfg.instagramChannelId,
    },
  ];

  for (const channel of channels) {
    console.log(
      `Scheduling ${item.key} on ${channel.name}...`
    );

    const post = await createBufferPost({
      channelId: channel.id,
      text,
      dueAt,
      imageUrls,
    });

    console.log(`✅ SUCCESS ${channel.name}`);
    console.log(`Buffer Post ID: ${post.id}`);
  }

  console.log(
    `${item.key} scheduled for ${dueAt}`
  );
}

async function main() {
  console.log(
    "Starting Cimaly Buffer publisher with public GitHub/Cloudflare images..."
  );

  for (const item of DAILY_ITEMS) {
    try {
      await processItem(item);
    } catch (error) {
      console.error(
        `❌ ERROR while processing ${item.key}`
      );
      console.error(error.message);
      process.exitCode = 1;
    }
  }

  console.log("");
  console.log("Cimaly publisher finished.");
}

main().catch((error) => {
  console.error("Fatal error:");
  console.error(error);
  process.exit(1);
});
