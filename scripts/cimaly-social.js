import fs from "node:fs";
import path from "node:path";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const BUFFER_API_KEY = process.env.BUFFER_API_KEY || "";

// =========================
// CONFIG
// =========================
const DRY_RUN = true;
const SAVE_HISTORY_IN_DRY_RUN = false;

const MIN_DATE = "2025-01-01";
const ANTI_DUPLICATE_DAYS = 60;

// Boost temporaire possible pour un titre très important.
// On garde The Odyssey disponible si toujours trending.
const BOOST_TITLES = [
  "The Odyssey"
];

const HISTORY_FILE = path.resolve("data/social-history.json");
const LAST_SELECTION_FILE = path.resolve("data/last-social-selection.json");

// =========================
// CHECK ENV
// =========================
if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

// =========================
// UTILS
// =========================
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function uniqBy(arr, getKey) {
  const map = new Map();

  for (const item of arr) {
    const key = getKey(item);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function hasPoster(item) {
  return Boolean(item?.poster_path);
}

function getDateValue(item) {
  return item.release_date || item.first_air_date || "";
}

function isRecent(item) {
  const date = getDateValue(item);

  return Boolean(
    date &&
    date >= MIN_DATE &&
    date <= todayStr()
  );
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  ensureDir(filePath);

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

// =========================
// HISTORY
// =========================
function loadHistory() {
  const oldHistory = loadJson(HISTORY_FILE, null);

  // Compatibilité avec notre ancien format :
  // { movies: [], series: [], anime: [] }
  if (
    oldHistory &&
    !Array.isArray(oldHistory.items)
  ) {
    return {
      items: []
    };
  }

  return oldHistory || {
    items: []
  };
}

function saveHistory(history) {
  saveJson(HISTORY_FILE, history);
}

function historyCutoffDate() {
  return daysAgo(ANTI_DUPLICATE_DAYS);
}

function isBoostedTitle(title = "") {
  return BOOST_TITLES.some(
    boosted =>
      normalizeText(boosted) ===
      normalizeText(title)
  );
}

function isBlockedByHistory(candidate, history) {
  const cutoff = historyCutoffDate();

  const candidateTitle = normalizeText(
    candidate.title ||
    candidate.name ||
    ""
  );

  return (history.items || []).some(item => {
    const withinWindow =
      (item.published_at || "") >= cutoff;

    const sameTmdb =
      Number(item.tmdb_id) ===
      Number(candidate.id);

    const sameTitle =
      normalizeText(item.title_en || "") ===
      candidateTitle;

    return (
      withinWindow &&
      (sameTmdb || sameTitle)
    );
  });
}

function updateHistory(selection) {
  const history = loadHistory();

  history.items = Array.isArray(history.items)
    ? history.items
    : [];

  const now = todayStr();

  history.items.push(
    {
      slot: "morning_series",
      tmdb_id: selection.morning_series.tmdb_id,
      type: "tv",
      title_en: selection.morning_series.title_en,
      published_at: now
    },
    {
      slot: "afternoon_anime",
      tmdb_id: selection.afternoon_anime.tmdb_id,
      type: "tv",
      title_en: selection.afternoon_anime.title_en,
      published_at: now
    },
    {
      slot: "evening_movie",
      tmdb_id: selection.evening_movie.tmdb_id,
      type: "movie",
      title_en: selection.evening_movie.title_en,
      published_at: now
    }
  );

  const keepFrom = daysAgo(365);

  history.items = history.items.filter(
    item =>
      (item.published_at || "") >= keepFrom
  );

  saveHistory(history);
}

// =========================
// TMDB
// =========================
async function tmdb(pathname, params = {}) {
  const url = new URL(
    `https://api.themoviedb.org/3${pathname}`
  );

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `TMDB error ${response.status} on ${pathname}: ${await response.text()}`
    );
  }

  return response.json();
}

async function fetchPages(
  pathname,
  pages = 2,
  params = {}
) {
  const results = [];

  for (let page = 1; page <= pages; page++) {
    const data = await tmdb(pathname, {
      ...params,
      page
    });

    results.push(...(data.results || []));
  }

  return results;
}

// =========================
// DETAILS / LOCALIZATION
// =========================
function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

function posterOriginalUrl(posterPath) {
  return posterPath
    ? `https://image.tmdb.org/t/p/original${posterPath}`
    : "";
}

function posterW780Url(posterPath) {
  return posterPath
    ? `https://image.tmdb.org/t/p/w780${posterPath}`
    : "";
}

function cimalyUrl(type, id) {
  return type === "movie"
    ? `https://cimaly.cc/movie/${id}`
    : `https://cimaly.cc/tv/${id}`;
}

async function enrichItem(type, rawItem) {
  const endpoint =
    type === "movie"
      ? "movie"
      : "tv";

  const [enData, arData] =
    await Promise.all([
      tmdb(`/${endpoint}/${rawItem.id}`, {
        language: "en-US"
      }),

      tmdb(`/${endpoint}/${rawItem.id}`, {
        language: "ar-SA"
      })
    ]);

  const titleEN =
    type === "movie"
      ? enData.title ||
        rawItem.title ||
        ""
      : enData.name ||
        rawItem.name ||
        "";

  const rawArabicTitle =
    type === "movie"
      ? arData.title || ""
      : arData.name || "";

  const titleAR =
    containsArabic(rawArabicTitle)
      ? rawArabicTitle
      : "";

  const overviewAR =
    containsArabic(arData.overview || "")
      ? arData.overview
      : "";

  const posterPath =
    enData.poster_path ||
    rawItem.poster_path ||
    "";

  return {
    tmdb_id: rawItem.id,
    type,

    year_date:
      getDateValue(rawItem),

    popularity:
      Number(rawItem.popularity || 0),

    vote_average:
      Number(rawItem.vote_average || 0),

    vote_count:
      Number(rawItem.vote_count || 0),

    origin_country:
      rawItem.origin_country ||
      enData.origin_country ||
      [],

    original_language:
      rawItem.original_language ||
      enData.original_language ||
      "",

    title_en:
      titleEN,

    title_ar:
      titleAR,

    overview_en:
      enData.overview ||
      rawItem.overview ||
      "",

    overview_ar:
      overviewAR,

    poster_original:
      posterOriginalUrl(posterPath),

    poster_w780:
      posterW780Url(posterPath),

    cimaly_url:
      cimalyUrl(type, rawItem.id)
  };
}

// =========================
// SCORING
// =========================
function baseScore(item) {
  return (
    Number(item.popularity || 0) * 10 +
    Number(item.vote_average || 0) * 40 +
    Math.min(
      Number(item.vote_count || 0),
      3000
    ) * 0.25
  );
}

function titleBoost(item) {
  const title =
    item.title ||
    item.name ||
    "";

  return isBoostedTitle(title)
    ? 5000
    : 0;
}

function scoreSeries(item) {
  // Aucun bonus pays.
  // Seulement popularité / note / votes / trending.
  return (
    baseScore(item) +
    titleBoost(item)
  );
}

function scoreMovie(item) {
  return (
    baseScore(item) +
    titleBoost(item)
  );
}

function scoreAnime(item) {
  return (
    baseScore(item) +
    titleBoost(item)
  );
}

// =========================
// PICKER
// =========================
function pickBestCandidate(
  candidates,
  history,
  usedTitles = new Set()
) {
  for (const candidate of candidates) {
    const title =
      candidate.title ||
      candidate.name ||
      "";

    const key =
      normalizeText(title);

    if (usedTitles.has(key)) {
      continue;
    }

    if (
      isBlockedByHistory(
        candidate,
        history
      )
    ) {
      continue;
    }

    usedTitles.add(key);

    return candidate;
  }

  return null;
}

// =========================
// MOVIES
// =========================
async function getMovieCandidates() {
  const dayTrending =
    await fetchPages(
      "/trending/movie/day",
      1,
      {
        language: "en-US"
      }
    );

  const weekTrending =
    await fetchPages(
      "/trending/movie/week",
      2,
      {
        language: "en-US"
      }
    );

  const discover =
    await fetchPages(
      "/discover/movie",
      2,
      {
        language: "en-US",
        sort_by: "popularity.desc",
        "release_date.gte": MIN_DATE,
        "release_date.lte": todayStr(),
        include_adult: "false"
      }
    );

  return uniqBy(
    [
      ...dayTrending,
      ...weekTrending,
      ...discover
    ],
    item => item.id
  )
    .filter(hasPoster)
    .filter(isRecent)
    .filter(
      item =>
        Number(item.vote_count || 0) >= 20
    );
}

// =========================
// SERIES
// GLOBAL TRENDING
// AUCUN FILTRE PAYS
// =========================
async function getSeriesCandidates() {
  const dayTrending =
    await fetchPages(
      "/trending/tv/day",
      1,
      {
        language: "en-US"
      }
    );

  const weekTrending =
    await fetchPages(
      "/trending/tv/week",
      2,
      {
        language: "en-US"
      }
    );

  const discover =
    await fetchPages(
      "/discover/tv",
      2,
      {
        language: "en-US",
        sort_by: "popularity.desc",
        "first_air_date.gte": MIN_DATE,
        "first_air_date.lte": todayStr(),
        include_adult: "false"
      }
    );

  return uniqBy(
    [
      ...dayTrending,
      ...weekTrending,
      ...discover
    ],
    item => item.id
  )
    .filter(hasPoster)
    .filter(isRecent)
    .filter(
      item =>
        Number(item.vote_count || 0) >= 10
    );
}

// =========================
// ANIME
// =========================
async function isAnimeEpisodeToday(item) {
  try {
    const detail =
      await tmdb(`/tv/${item.id}`, {
        language: "en-US"
      });

    const last =
      detail.last_episode_to_air;

    const next =
      detail.next_episode_to_air;

    return (
      last?.air_date === todayStr() ||
      next?.air_date === todayStr()
    );
  } catch {
    return false;
  }
}

async function getAnimeCandidates() {
  const baseParams = {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
    with_original_language: "ja",
    "first_air_date.gte": MIN_DATE,
    "first_air_date.lte": todayStr(),
    include_adult: "false",
    "vote_count.gte": "5"
  };

  const discover =
    await fetchPages(
      "/discover/tv",
      3,
      baseParams
    );

  const filtered =
    uniqBy(
      discover,
      item => item.id
    )
      .filter(hasPoster)
      .filter(isRecent);

  // On vérifie les premiers candidats populaires
  // pour voir s'ils ont réellement un épisode aujourd'hui.
  const topForTodayCheck =
    [...filtered]
      .sort(
        (a, b) =>
          scoreAnime(b) -
          scoreAnime(a)
      )
      .slice(0, 20);

  const airingToday = [];

  for (const item of topForTodayCheck) {
    if (
      await isAnimeEpisodeToday(item)
    ) {
      airingToday.push(item);
    }
  }

  if (airingToday.length) {
    console.log(
      "🇯🇵 Anime selection: episode airing TODAY"
    );

    return airingToday.sort(
      (a, b) =>
        scoreAnime(b) -
        scoreAnime(a)
    );
  }

  console.log(
    "🇯🇵 Anime selection: no verified episode today, using trending recent anime"
  );

  return filtered.sort(
    (a, b) =>
      scoreAnime(b) -
      scoreAnime(a)
  );
}

// =========================
// BUILD SELECTION
// =========================
async function buildSelection() {
  const history =
    loadHistory();

  const usedTitles =
    new Set();

  console.log(
    "🎬 Cimaly social automation — DRY RUN"
  );

  console.log(
    "Trending + recent content only."
  );

  console.log(
    "Films / series / anime: 2025–2026."
  );

  console.log(
    "Series: GLOBAL trending — no country priority."
  );

  console.log(
    `Anti-duplicate window: ${ANTI_DUPLICATE_DAYS} days.`
  );

  if (DRY_RUN) {
    console.log(
      "Nothing will be published."
    );
  }

  console.log("");

  // SERIES
  const seriesRaw =
    await getSeriesCandidates();

  const seriesSorted =
    [...seriesRaw].sort(
      (a, b) =>
        scoreSeries(b) -
        scoreSeries(a)
    );

  const chosenSeries =
    pickBestCandidate(
      seriesSorted,
      history,
      usedTitles
    );

  if (!chosenSeries) {
    throw new Error(
      "No valid series candidate found"
    );
  }

  // ANIME
  const animeSorted =
    await getAnimeCandidates();

  const chosenAnime =
    pickBestCandidate(
      animeSorted,
      history,
      usedTitles
    );

  if (!chosenAnime) {
    throw new Error(
      "No valid anime candidate found"
    );
  }

  // MOVIE
  const movieRaw =
    await getMovieCandidates();

  const movieSorted =
    [...movieRaw].sort(
      (a, b) =>
        scoreMovie(b) -
        scoreMovie(a)
    );

  const chosenMovie =
    pickBestCandidate(
      movieSorted,
      history,
      usedTitles
    );

  if (!chosenMovie) {
    throw new Error(
      "No valid movie candidate found"
    );
  }

  const [
    morningSeries,
    afternoonAnime,
    eveningMovie
  ] = await Promise.all([
    enrichItem(
      "tv",
      chosenSeries
    ),

    enrichItem(
      "tv",
      chosenAnime
    ),

    enrichItem(
      "movie",
      chosenMovie
    )
  ]);

  return {
    morning_series:
      morningSeries,

    afternoon_anime:
      afternoonAnime,

    evening_movie:
      eveningMovie
  };
}

// =========================
// MAIN
// =========================
async function main() {
  const selection =
    await buildSelection();

  console.log("");
  console.log(
    "📦 SELECTED CONTENT"
  );
  console.log("");

  console.log(
    JSON.stringify(
      selection,
      null,
      2
    )
  );

  saveJson(
    LAST_SELECTION_FILE,
    selection
  );

  console.log("");

  if (
    DRY_RUN &&
    !SAVE_HISTORY_IN_DRY_RUN
  ) {
    console.log(
      "✅ DRY RUN complete."
    );

    console.log(
      "ℹ️ History NOT updated."
    );

    console.log(
      "ℹ️ Test selections will NOT block titles for 60 days."
    );
  } else {
    updateHistory(selection);

    console.log(
      "✅ History updated."
    );
  }

  if (!DRY_RUN) {
    console.log(
      "⚠️ Production mode enabled."
    );

    if (!BUFFER_API_KEY) {
      console.log(
        "⚠️ BUFFER_API_KEY missing."
      );
    }
  }
}

main().catch(error => {
  console.error(
    "❌",
    error
  );

  process.exit(1);
});
