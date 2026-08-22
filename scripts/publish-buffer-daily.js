const fs = require("fs");

const BUFFER_API_URL = "https://api.buffer.com";
const SELECTION_FILE = "data/last-social-selection.json";
const PUBLISHED_HISTORY_FILE = "data/published-social-history.json";
const ANTI_DUPLICATE_DAYS = 60;
const IMAGE_BASE = "https://raw.githubusercontent.com/drohak16/cimaly/main/public/social/daily";

const REQUIRED = [
  "BUFFER_API_KEY",
  "BUFFER_CHANNEL_ID_FACEBOOK",
  "BUFFER_CHANNEL_ID_INSTAGRAM",
];

for (const key of REQUIRED) {
  if (!process.env[key]) throw new Error(`Missing required secret: ${key}`);
}

const cfg = {
  bufferApiKey: process.env.BUFFER_API_KEY,
  facebookChannelId: process.env.BUFFER_CHANNEL_ID_FACEBOOK,
  instagramChannelId: process.env.BUFFER_CHANNEL_ID_INSTAGRAM,
};

const selection = JSON.parse(fs.readFileSync(SELECTION_FILE, "utf8"));

const SERIES_ITEM = { key: "series", dataKey: "morning_series", expectedType: "tv" };
const ANIME_ITEM = { key: "anime", dataKey: "afternoon_anime", expectedType: "tv" };
const MOVIE_ITEM = { key: "movie", dataKey: "evening_movie", expectedType: "movie" };

function loadHistory() {
  try {
    if (!fs.existsSync(PUBLISHED_HISTORY_FILE)) return { items: [] };
    const parsed = JSON.parse(fs.readFileSync(PUBLISHED_HISTORY_FILE, "utf8"));
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return { items: [] };
  }
}

function saveHistory(history) {
  fs.writeFileSync(PUBLISHED_HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

function cutoffDate(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function contentKey(data) {
  return `${data.type}:${Number(data.tmdb_id)}`;
}

function validateBoundContent(item, data) {
  if (!data || typeof data !== "object") throw new Error(`Missing selected content for ${item.dataKey}`);
  if (!Number.isInteger(Number(data.tmdb_id)) || Number(data.tmdb_id) <= 0) throw new Error(`Invalid TMDB ID for ${item.key}`);
  if (data.type !== item.expectedType) throw new Error(`Content type mismatch for ${item.key}: expected ${item.expectedType}, got ${data.type}`);
  if (!String(data.title_en || "").trim()) throw new Error(`Missing title for ${item.key}`);
  if (!String(data.overview_en || "").trim()) throw new Error(`Missing TMDB story overview for ${data.title_en}`);

  const expectedUrl = data.type === "movie"
    ? `https://cimaly.cc/movie/${data.tmdb_id}`
    : `https://cimaly.cc/tv/${data.tmdb_id}`;
  if (data.cimaly_url !== expectedUrl) throw new Error(`Cimaly URL mismatch for ${data.title_en}`);
  return data;
}

function assertNotRecentlyPublished(data, history) {
  const key = contentKey(data);
  const cutoff = cutoffDate(ANTI_DUPLICATE_DAYS);
  const duplicate = history.items.some((entry) => entry.content_key === key && String(entry.published_at || "") >= cutoff);
  if (duplicate) throw new Error(`Duplicate blocked: ${data.title_en} was already published within ${ANTI_DUPLICATE_DAYS} days.`);
}

function recordPublished(data, slot, history) {
  history.items.push({
    content_key: contentKey(data),
    tmdb_id: Number(data.tmdb_id),
    type: data.type,
    title_en: data.title_en,
    slot,
    published_at: new Date().toISOString(),
  });
  const keepFrom = cutoffDate(365);
  history.items = history.items.filter((entry) => String(entry.published_at || "") >= keepFrom);
  saveHistory(history);
}

function getNextIstanbulSchedule(hour, minute) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const currentHour = Number(get("hour"));
  const currentMinute = Number(get("minute"));

  let targetDay = day;
  const alreadyPassed = currentHour > hour || (currentHour === hour && currentMinute >= minute);
  if (alreadyPassed) targetDay += 1;

  return new Date(Date.UTC(year, month - 1, targetDay, hour - 3, minute, 0)).toISOString();
}

function shortOverview(text, max = 240) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : max).trim()}…`;
}

function bilingualDescription(data, maxEn = 220, maxAr = 190) {
  const titleEn = data.title_en;
  const titleAr = data.title_ar || titleEn;
  const en = shortOverview(data.overview_en, maxEn);
  const ar = data.overview_ar ? shortOverview(data.overview_ar, maxAr) : "";
  return `${titleEn}\n${titleAr}\n${en}${ar ? `\n\n${ar}` : ""}\n\n▶️ Watch now | شاهد الآن\n${data.cimaly_url}`;
}

function buildSeriesAnimeCaption(series, anime) {
  return `📺 SERIES + ANIME NIGHT | مسلسل + أنمي\n\n${bilingualDescription(series)}\n\n──────────\n\n✨ ${bilingualDescription(anime)}\n\n#Cimaly #Series #TVSeries #Anime #AnimeSeries #Streaming #WatchNow #MovieNight`;
}

function buildMovieCaption(movie) {
  return `🎬 MOVIE PICK | اختيار فيلم\n\n${bilingualDescription(movie, 240, 210)}\n\n#Cimaly #Movie #Movies #Cinema #Streaming #WatchNow`;
}

function buildPublicImageUrls(item, data) {
  const id = Number(data.tmdb_id);
  return [
    `${IMAGE_BASE}/en/${item.key}-${id}.jpg`,
    `${IMAGE_BASE}/ar/${item.key}-${id}.jpg`,
  ];
}

async function checkPublicImage(url) {
  let response = await fetch(url, { method: "HEAD", redirect: "follow" });
  if (!response.ok) response = await fetch(url, { method: "GET", redirect: "follow" });
  if (!response.ok) throw new Error(`GitHub image inaccessible: ${url} | HTTP ${response.status}`);
}

function buildMetadata(network) {
  if (network === "facebook") return `metadata: { facebook: { type: post } }`;
  if (network === "instagram") return `metadata: { instagram: { type: post shouldShareToFeed: true } }`;
  return "";
}

async function createBufferPost({ network, channelId, text, dueAt, imageUrls }) {
  const assets = imageUrls.map((url) => `{ image: { url: ${JSON.stringify(url)} } }`).join(",");
  const query = `mutation CreatePost {
    createPost(input: {
      text: ${JSON.stringify(text)}
      channelId: ${JSON.stringify(channelId)}
      schedulingType: automatic
      mode: customScheduled
      dueAt: ${JSON.stringify(dueAt)}
      assets: [${assets}]
      ${buildMetadata(network)}
    }) {
      ... on PostActionSuccess { post { id text } }
      ... on MutationError { message }
    }
  }`;

  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.bufferApiKey}` },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Buffer HTTP error ${response.status}: ${JSON.stringify(data)}`);
  if (data.errors?.length) throw new Error(`Buffer GraphQL error: ${JSON.stringify(data.errors)}`);
  const result = data.data?.createPost;
  if (!result) throw new Error(`Unexpected Buffer response: ${JSON.stringify(data)}`);
  if (result.message) throw new Error(`Buffer error: ${result.message}`);
  return result.post;
}

function isDuplicateError(error) {
  const msg = String(error?.message || error).toLowerCase();
  return msg.includes("already got this one scheduled") || msg.includes("same thing twice") || (msg.includes("already") && msg.includes("scheduled"));
}

async function publishToChannel({ network, name, channelId, slot, imageUrls, text, dueAt }) {
  try {
    const post = await createBufferPost({ network, channelId, text, dueAt, imageUrls });
    console.log(`✅ SUCCESS ${name} ${slot} | Buffer Post ID: ${post.id}`);
    return true;
  } catch (error) {
    if (isDuplicateError(error)) {
      console.log(`⚠️ ${name} ${slot}: already scheduled — skipped safely.`);
      return true;
    }
    console.error(`❌ ${name} failed for ${slot}: ${error.message}`);
    return false;
  }
}

async function publishSeriesAnime(history) {
  const series = validateBoundContent(SERIES_ITEM, selection[SERIES_ITEM.dataKey]);
  const anime = validateBoundContent(ANIME_ITEM, selection[ANIME_ITEM.dataKey]);
  assertNotRecentlyPublished(series, history);
  assertNotRecentlyPublished(anime, history);

  const imageUrls = [
    ...buildPublicImageUrls(SERIES_ITEM, series),
    ...buildPublicImageUrls(ANIME_ITEM, anime),
  ];
  await Promise.all(imageUrls.map(checkPublicImage));

  const dueAt = getNextIstanbulSchedule(0, 30);
  const text = buildSeriesAnimeCaption(series, anime);
  console.log(`Scheduling combined series+anime carousel for ${dueAt}`);
  console.log(imageUrls.join("\n"));

  const facebookOk = await publishToChannel({ network: "facebook", name: "Facebook", channelId: cfg.facebookChannelId, slot: "series+anime", imageUrls, text, dueAt });
  const instagramOk = await publishToChannel({ network: "instagram", name: "Instagram", channelId: cfg.instagramChannelId, slot: "series+anime", imageUrls, text, dueAt });

  if (facebookOk && instagramOk) {
    recordPublished(series, "series+anime", history);
    recordPublished(anime, "series+anime", history);
    return true;
  }
  return false;
}

async function publishMovie(history) {
  const movie = validateBoundContent(MOVIE_ITEM, selection[MOVIE_ITEM.dataKey]);
  assertNotRecentlyPublished(movie, history);
  const imageUrls = buildPublicImageUrls(MOVIE_ITEM, movie);
  await Promise.all(imageUrls.map(checkPublicImage));

  const dueAt = getNextIstanbulSchedule(19, 30);
  const text = buildMovieCaption(movie);
  console.log(`Scheduling movie ${movie.title_en} for ${dueAt}`);

  const facebookOk = await publishToChannel({ network: "facebook", name: "Facebook", channelId: cfg.facebookChannelId, slot: "movie", imageUrls, text, dueAt });
  const instagramOk = await publishToChannel({ network: "instagram", name: "Instagram", channelId: cfg.instagramChannelId, slot: "movie", imageUrls, text, dueAt });

  if (facebookOk && instagramOk) {
    recordPublished(movie, "movie", history);
    return true;
  }
  return false;
}

async function main() {
  console.log("Starting Cimaly Buffer publisher with GitHub-hosted images...");
  const history = loadHistory();
  let allOk = true;

  try {
    allOk = (await publishSeriesAnime(history)) && allOk;
  } catch (error) {
    console.error(`❌ BLOCKED series+anime: ${error.message}`);
    allOk = false;
  }

  try {
    allOk = (await publishMovie(history)) && allOk;
  } catch (error) {
    console.error(`❌ BLOCKED movie: ${error.message}`);
    allOk = false;
  }

  if (!allOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
