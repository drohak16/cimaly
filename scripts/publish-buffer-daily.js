const BUFFER_API_URL = "https://api.buffer.com";

const REQUIRED = [
  "BUFFER_API_KEY",
  "BUFFER_CHANNEL_ID_FACEBOOK",
  "BUFFER_CHANNEL_ID_INSTAGRAM",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required secret: ${key}`);
  }
}

const cfg = {
  bufferApiKey: process.env.BUFFER_API_KEY,

  facebookChannelId:
    process.env.BUFFER_CHANNEL_ID_FACEBOOK,

  instagramChannelId:
    process.env.BUFFER_CHANNEL_ID_INSTAGRAM,

  cloudName:
    process.env.CLOUDINARY_CLOUD_NAME,

  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY,

  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET,
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

  const parts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value;

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  // Istanbul = UTC+3
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

  // Si l'heure est déjà passée aujourd'hui,
  // programmer pour demain.
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

function buildCaption(item) {
  return `${item.emoji} ${item.en}
${item.ar}

Watch now on cimaly.cc
شاهد الآن على cimaly.cc`;
}

async function getCloudinaryAsset(
  folder,
  publicId
) {
  const auth = Buffer.from(
    `${cfg.cloudinaryApiKey}:${cfg.cloudinaryApiSecret}`
  ).toString("base64");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloudName}/resources/search`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },

      body: JSON.stringify({
        expression:
          `asset_folder="${folder}" AND public_id="${publicId}"`,
        max_results: 1,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Cloudinary error ${response.status}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data.resources?.[0] || null;
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
          channelId: ${JSON.stringify(
            channelId
          )}
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

  const response = await fetch(
    BUFFER_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization:
          `Bearer ${cfg.bufferApiKey}`,
      },

      body: JSON.stringify({
        query,
      }),
    }
  );

  const data = await response.json();

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

  // Ta structure Cloudinary actuelle :
  //
  // cimaly/social/daily/en/series
  // cimaly/social/daily/en/anime
  // cimaly/social/daily/en/movie
  //
  // cimaly/social/daily/ar/series
  // cimaly/social/daily/ar/anime
  // cimaly/social/daily/ar/movie

  const folderEn =
    `cimaly/social/daily/en/${item.key}`;

  const folderAr =
    `cimaly/social/daily/ar/${item.key}`;

  console.log(
    `Looking in EN folder: ${folderEn}`
  );

  console.log(
    `Looking in AR folder: ${folderAr}`
  );

  const [assetEn, assetAr] =
    await Promise.all([
      getCloudinaryAsset(
        folderEn,
        item.key
      ),

      getCloudinaryAsset(
        folderAr,
        item.key
      ),
    ]);

  /*
    Sécurité :
    si une image EN ou AR manque,
    rien n'est envoyé à Buffer.
  */

  if (!assetEn || !assetAr) {
    console.log(
      `SKIPPING ${item.key}`
    );

    console.log(
      `EN found: ${Boolean(assetEn)}`
    );

    console.log(
      `AR found: ${Boolean(assetAr)}`
    );

    return;
  }

  console.log(
    `EN image: ${assetEn.secure_url}`
  );

  console.log(
    `AR image: ${assetAr.secure_url}`
  );

  const imageUrls = [
    assetEn.secure_url,
    assetAr.secure_url,
  ];

  const dueAt =
    getIstanbulSchedule(
      item.hour,
      item.minute
    );

  const text =
    buildCaption(item);

  const channels = [
    {
      name: "Facebook",
      id:
        cfg.facebookChannelId,
    },

    {
      name: "Instagram",
      id:
        cfg.instagramChannelId,
    },
  ];

  for (const channel of channels) {
    console.log(
      `Scheduling ${item.key} on ${channel.name}...`
    );

    const post =
      await createBufferPost({
        channelId:
          channel.id,

        text,

        dueAt,

        imageUrls,
      });

    console.log(
      `SUCCESS ${channel.name}`
    );

    console.log(
      `Buffer Post ID: ${post.id}`
    );
  }

  console.log(
    `${item.key} scheduled for ${dueAt}`
  );
}

async function main() {
  console.log(
    "Starting Cimaly automatic Buffer publisher..."
  );

  for (
    const item of DAILY_ITEMS
  ) {
    try {
      await processItem(
        item
      );
    } catch (error) {
      console.error(
        `ERROR while processing ${item.key}`
      );

      console.error(
        error.message
      );

      process.exitCode = 1;
    }
  }

  console.log("");
  console.log(
    "Cimaly publisher finished."
  );
}

main().catch(
  (error) => {
    console.error(
      "Fatal error:"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);
