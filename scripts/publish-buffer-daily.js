const BUFFER_API_URL = "https://api.buffer.com";
const IMAGE_BASE = "https://raw.githubusercontent.com/drohak16/cimaly/main/public/social/cimaly-2026-08-24-hd";

const REQUIRED = ["BUFFER_API_KEY", "BUFFER_CHANNEL_ID_FACEBOOK", "BUFFER_CHANNEL_ID_INSTAGRAM"];
for (const key of REQUIRED) if (!process.env[key]) throw new Error(`Missing required secret: ${key}`);

const cfg = {
  bufferApiKey: process.env.BUFFER_API_KEY,
  facebookChannelId: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
  instagramChannelId: process.env.BUFFER_CHANNEL_ID_INSTAGRAM,
};

const POSTS = [
  {
    key: "film-bilingual-hd",
    images: [`${IMAGE_BASE}/film-en.jpg`, `${IMAGE_BASE}/film-ar.jpg`],
    text: `🎬 TOY STORY 5\n\nToy meets tech in a new chapter where playtime faces a very different kind of challenge.\n\n🎬 حكاية لعبة 5\n\nالألعاب تواجه عالم التكنولوجيا في فصل جديد يغيّر شكل وقت اللعب.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc\n\n#Cimaly #ToyStory5 #Movie #Animation #Comedy #فيلم #رسوم_متحركة #كوميديا`,
  },
  {
    key: "series-bilingual-hd",
    images: [`${IMAGE_BASE}/series-en.jpg`, `${IMAGE_BASE}/series-ar.jpg`],
    text: `📺 REACHER — SEASON 4\n\nA new conspiracy pulls Reacher into another high-stakes investigation where every clue matters.\n\n📺 ريشر — الموسم 4\n\nمؤامرة جديدة تجر ريشر إلى تحقيق خطير حيث كل دليل قد يغيّر كل شيء.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc\n\n#Cimaly #Reacher #Series #Action #Thriller #مسلسل #أكشن #تشويق`,
  },
  {
    key: "anime-bilingual-hd",
    images: [`${IMAGE_BASE}/anime-en.jpg`, `${IMAGE_BASE}/anime-ar.jpg`],
    text: `✨ FRIEREN: BEYOND JOURNEY'S END — SEASON 2\n\nFrieren, Fern and Stark continue their journey north, carrying memories and new discoveries with them.\n\n✨ فريرن: ما وراء نهاية الرحلة — الموسم 2\n\nتواصل فريرن وفيرن وستارك رحلتهم نحو الشمال بين الذكريات والاكتشافات الجديدة.\n\n▶️ Watch now / شاهد الآن على Cimaly\nhttps://cimaly.cc\n\n#Cimaly #Frieren #Anime #Fantasy #Adventure #انمي #خيال #مغامرة`,
  },
];

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
  console.log("Validating six Best Method HD assets...");
  await Promise.all([...new Set(POSTS.flatMap(p => p.images))].map(assertImage));
  const dueAt = "2026-08-23T21:15:00.000Z"; // 00:15 Europe/Istanbul, Aug 24
  console.log(`Scheduling three bilingual Best Method HD posts for ${dueAt}`);
  for (const post of POSTS) {
    await Promise.all([
      createPost("facebook", cfg.facebookChannelId, post, dueAt),
      createPost("instagram", cfg.instagramChannelId, post, dueAt),
    ]);
  }
}

main().catch(err => { console.error(`❌ ${err.message}`); process.exit(1); });
