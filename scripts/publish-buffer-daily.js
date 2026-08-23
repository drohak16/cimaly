const BUFFER_API_URL = "https://api.buffer.com";
const IMAGE_BASE = "https://raw.githubusercontent.com/drohak16/cimaly/main/public/social/cimaly-2026-08-23";

const REQUIRED = ["BUFFER_API_KEY", "BUFFER_CHANNEL_ID_FACEBOOK", "BUFFER_CHANNEL_ID_INSTAGRAM"];
for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing required secret: ${key}`);
}

const cfg = {
  bufferApiKey: process.env.BUFFER_API_KEY,
  facebookChannelId: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
  instagramChannelId: process.env.BUFFER_CHANNEL_ID_INSTAGRAM,
};

const POSTS = [
  {
    key: "series-bilingual",
    images: [`${IMAGE_BASE}/series-en.jpg`, `${IMAGE_BASE}/series-ar.jpg`],
    text: `📺 LANTERNS — NEW SERIES\n\nTwo intergalactic officers are drawn into a dark Earth-based mystery while investigating a murder in the American heartland.\n\n📺 لانترنز — مسلسل جديد\n\nشرطيان من شرطة الفضاء يجدان نفسيهما متورطين في لغز غامض على الأرض أثناء التحقيق في جريمة قتل.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc/tv/95350\n\n#Cimaly #Lanterns #Series #SciFi #Drama #مسلسلات #خيال_علمي #شاهد_الآن`,
  },
  {
    key: "anime-bilingual",
    images: [`${IMAGE_BASE}/anime-en.jpg`, `${IMAGE_BASE}/anime-ar.jpg`],
    text: `🔥 BLACK TORCH — NEW ANIME\n\nJiro Azuma, a descendant of ninjas who can speak with animals, discovers that a mysterious injured cat carries a legendary supernatural power.\n\n🔥 بلاك تورش — أنمي جديد\n\nجيرو أزوما من سلالة النينجا ويستطيع التحدث مع الحيوانات. بعد لقائه بقط غامض، يكتشف قوة أسطورية خارقة تغيّر حياته.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc/tv/285993\n\n#Cimaly #BlackTorch #Anime #Action #Fantasy #انمي #أكشن #خيال`,
  },
  {
    key: "film-bilingual",
    images: [`${IMAGE_BASE}/film-en.jpg`, `${IMAGE_BASE}/film-ar.jpg`],
    text: `🎬 THE SUMMER BEYOND THE SKY\n\nSometimes, summer changes more than time. A quiet coming-of-age story about two students looking beyond the city and toward what comes next.\n\n🎬 ذلك الصيف ما وراء السماء\n\nأحيانًا، يغيّر الصيف أكثر من الوقت. حكاية هادئة عن شابين أمام أفق جديد، بين الرومانسية والحياة اليومية وما ينتظرهما بعد ذلك.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc\n\n#Cimaly #Movie #Drama #Romance #AnimeMovie #فيلم #دراما #رومانسية`,
  },
];

function getIstanbulDueAt(hour, minute) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  let day = Number(parts.day);
  const currentHour = Number(parts.hour);
  const currentMinute = Number(parts.minute);
  if (currentHour > hour || (currentHour === hour && currentMinute >= minute)) day += 1;
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, day, hour - 3, minute, 0)).toISOString();
}

async function assertImage(url) {
  let r = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!r.ok) r = await fetch(url, { method: "GET", redirect: "follow" });
  if (!r.ok) throw new Error(`Required GitHub image unavailable: ${url} (${r.status})`);
}

function metadata(network) {
  if (network === "facebook") return `metadata: { facebook: { type: post } }`;
  return `metadata: { instagram: { type: post shouldShareToFeed: true } }`;
}

async function createPost(network, channelId, post, dueAt) {
  const assets = post.images.map(url => `{ image: { url: ${JSON.stringify(url)} } }`).join(", ");
  const query = `mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(post.text)}
      channelId: ${JSON.stringify(channelId)}
      schedulingType: automatic
      mode: customScheduled
      dueAt: ${JSON.stringify(dueAt)}
      assets: [${assets}]
      ${metadata(network)}
    }) {
      ... on PostActionSuccess { post { id text } }
      ... on MutationError { message }
    }
  }`;
  const r = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.bufferApiKey}` },
    body: JSON.stringify({ query }),
  });
  const body = await r.json();
  if (!r.ok || body.errors?.length || body.data?.createPost?.message) {
    throw new Error(`Buffer ${network} ${post.key}: ${JSON.stringify(body)}`);
  }
  console.log(`✅ ${network} ${post.key}: ${body.data.createPost.post.id}`);
}

async function main() {
  console.log("Validating all six Cimaly images before scheduling three bilingual posts...");
  await Promise.all([...new Set(POSTS.flatMap(p => p.images))].map(assertImage));

  const dueAt = getIstanbulDueAt(4, 45);
  console.log(`Scheduling three bilingual Cimaly posts for ${dueAt} (04:45 Istanbul)`);

  for (const post of POSTS) {
    await Promise.all([
      createPost("facebook", cfg.facebookChannelId, post, dueAt),
      createPost("instagram", cfg.instagramChannelId, post, dueAt),
    ]);
  }
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
