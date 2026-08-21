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

  // Si l'heure d'aujourd'hui est déjà passée,
  // programme pour demain.
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
}

/*
  Buffer metadata differs by network.
*/

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

  const metadata = buildMetadata(network);

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

  const response = await fetch(BUFFER_API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.bufferApiKey}`,
    },

    body: JSON.stringify({
      query,
    }),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    const textResponse = await response.text();

    throw new Error(
      `Buffer returned invalid JSON: ${textResponse}`
    );
  }

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

  const result = data.data?.createPost;

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

  const post = await createBufferPost({
    network,
    channelId,
    text,
    dueAt,
    imageUrls,
  });

  console.log(`✅ SUCCESS ${name}`);
  console.log(`Buffer Post ID: ${post.id}`);

  return post;
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

  console.log(imageUrls[0]);
  console.log(imageUrls[1]);

  await Promise.all(
    imageUrls.map((url) =>
      checkPublicImage(url)
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

  /*
    Facebook
  */

  try {
    await publishToChannel({
      network: "facebook",
      name: "Facebook",
      channelId:
        cfg.facebookChannelId,
      item,
      imageUrls,
      text,
      dueAt,
    });
  } catch (error) {
    console.error(
      `❌ Facebook failed for ${item.key}`
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  }

  /*
    Instagram
  */

  try {
    await publishToChannel({
      network: "instagram",
      name: "Instagram",
      channelId:
        cfg.instagramChannelId,
      item,
      imageUrls,
      text,
      dueAt,
    });
  } catch (error) {
    console.error(
      `❌ Instagram failed for ${item.key}`
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  }

  console.log("");
  console.log(
    `${item.key} target schedule: ${dueAt}`
  );
}

async function main() {
  console.log(
    "Starting Cimaly Buffer publisher..."
  );

  console.log(
    "Image source: cimaly.cc"
  );

  for (const item of DAILY_ITEMS) {
    await processItem(item);
  }

  console.log("");
  console.log(
    "Cimaly publisher finished."
  );
}

main().catch((error) => {
  console.error(
    "Fatal error:"
  );

  console.error(
    error
  );

  process.exit(1);
});
