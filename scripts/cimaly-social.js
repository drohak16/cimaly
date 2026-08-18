import fs from "node:fs";
import path from "node:path";

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const BUFFER_API_KEY = process.env.BUFFER_API_KEY || "";

// =========================
// CONFIG
// =========================
const DRY_RUN = true; // IMPORTANT: true = test seulement, rien ne sera publié
const SAVE_HISTORY_IN_DRY_RUN = false; // pour que les tests ne bloquent pas Odyssey
const MIN_DATE = "2025-01-01";
const ANTI_DUPLICATE_DAYS = 60;

// Si un titre est très important, on le booste sans le bloquer pendant les tests
const BOOST_TITLES = [
  "The Odyssey"
];

// Priorité pays pour les séries si disponibles dans les tendances
const SERIES_COUNTRY_PRIORITY = ["TR", "KR", "US", "GB"];
const ANIME_COUNTRY_PRIORITY = ["JP"];

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
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function hasPoster(item) {
  return !!item?.poster_path;
}

function getDateValue(item) {
  return item.release_date || item.first_air_date || "";
}

function isRecent(item) {
  const date = getDateValue(item);
  return !!date && date >= MIN_DATE && date <= todayStr();
}

function loadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function loadHistory() {
  return loadJson(HISTORY_FILE, { items: [] });
}

function saveHistory(history) {
  saveJson(HISTORY_FILE, history);
}

function isBoostedTitle(title) {
  return BOOST_TITLES.some(t => normalizeText(t) === normalizeText(title));
}

function historyCutoffDate() {
  return daysAgo(ANTI_DUPLICATE_DAYS);
}

function isBlockedByHistory(candidate, history) {
  const candidateTitle = normalizeText(candidate.title_en || candidate.name || candidate.title || "");
  const cutoff = historyCutoffDate();

  // Les titres boostés ne sont pas bloqués par l'historique si on est en test
  if (isBoostedTitle(candidate.title_en || candidate.name || candidate.title || "")) {
    return false;
  }

  return history.items.some(item => {
    const sameTmdb = Number(item.tmdb_id) === Number(candidate.id);
    const sameTitle = normalizeText(item.title_en || "") === candidateTitle;
    const withinWindow = (item.published_at || "") >= cutoff;
    return withinWindow && (sameTmdb || sameTitle);
  });
}

function posterOriginalUrl(posterPath) {
  return `https://image.tmdb.org/t/p/original${posterPath}`;
}

function posterW780Url(posterPath) {
  return `https://image.tmdb.org/t/p/w780${posterPath}`;
}

function cimalyUrl(type, tmdbId) {
  const section = type === "movie" ? "movie" : "tv";
  return `https://cimaly.cc/${section}/${tmdbId}`;
}

function countryBonus(originCountries = [], priorityList = []) {
  if (!Array.isArray(originCountries)) return 0;
  let bonus = 0;
  for (let i = 0; i < priorityList.length; i++) {
    if (originCountries.includes(priorityList[i])) {
      bonus += (priorityList.length - i) * 100;
    }
  }
  return bonus;
}

function titleBoost(title) {
  return isBoostedTitle(title) ? 5000 : 0;
}

// =========================
// TMDB
// =========================
async function tmdb(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB error ${response.status} on ${pathname}`);
  }

  return response.json();
}

async function fetchPages(pathname, pages = 2, params = {}) {
  const results = [];
  for (let page = 1; page <= pages; page++) {
    const data = await tmdb(pathname, { ...params, page });
    results.push(...(data.results || []));
  }
  return results;
}

async function enrichItem(type, rawItem) {
  const endpoint = type === "movie" ? "movie" : "tv";

  const [enData, arData] = await Promise.all([
    tmdb(`/${endpoint}/${rawItem.id}`, { language: "en-US" }),
    tmdb(`/${endpoint}/${rawItem.id}`, { language: "ar-SA" }),
  ]);

  const titleEn =
    type === "movie"
      ? enData.title || rawItem.title || ""
      : enData.name || rawItem.name || "";

  const titleAr =
    type === "movie"
      ? arData.title || ""
      : arData.name || "";

  const overviewEn = enData.overview || rawItem.overview || "";
  const overviewAr = arData.overview || "";

  const originCountries =
    enData.origin_country ||
    rawItem.origin_country ||
    [];

  const originalLanguage =
    enData.original_language ||
    rawItem.original_language ||
    "";

  const posterPath = enData.poster_path || rawItem.poster_path;

  return {
    tmdb_id: rawItem.id,
    type,
    year_date: getDateValue(rawItem),
    popularity: Number(rawItem.popularity || 0),
    vote_average: Number(rawItem.vote_average || 0),
    vote_count: Number(rawItem.vote_count || 0),
    origin_country: originCountries,
    original_language: originalLanguage,
    title_en: titleEn,
    title_ar: titleAr,
    overview_en: overviewEn,
    overview_ar: overviewAr,
    poster_original: posterOriginalUrl(posterPath),
    poster_w780: posterW780Url(posterPath),
    cimaly_url: cimalyUrl(type, rawItem.id),
  };
}

// =========================
// CANDIDATE BUILDERS
// =========================
async function getSeriesCandidates() {
  const trending = await fetchPages("/trending/tv/week", 2, { language: "en-US" });
  const discover = await fetchPages("/discover/tv", 2, {
    language: "en-US",
    sort_by: "popularity.desc",
    "first_air_date.gte": MIN_DATE,
    include_adult: false,
  });

  return uniqBy([...trending, ...discover], item => item.id)
    .filter(item => hasPoster(item))
    .filter(item => isRecent(item));
}

async function getAnimeCandidates() {
  const airingToday = await fetchPages("/tv/airing_today", 2, { language: "en-US" });
  const discoverAnime = await fetchPages("/discover/tv", 2, {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    include_adult: false,
    "first_air_date.gte": MIN_DATE,
  });

  const all = uniqBy([...airingToday, ...discoverAnime], item => item.id)
    .filter(item => hasPoster(item))
    .filter(item => isRecent(item))
    .filter(item => {
      const countries = item.origin_country || [];
      return (
        countries.includes("JP") ||
        item.original_language === "ja"
      );
    });

  return all;
}

async function getMovieCandidates() {
  const trending = await fetchPages("/trending/movie/week", 2, { language: "en-US" });
  const discover = await fetchPages("/discover/movie", 2, {
    language: "en-US",
    sort_by: "popularity.desc",
    "release_date.gte": MIN_DATE,
    include_adult: false,
  });

  return uniqBy([...trending, ...discover], item => item.id)
    .filter(item => hasPoster(item))
    .filter(item => isRecent(item));
}

// =========================
// SCORING
// =========================
function scoreSeries(item) {
  return (
    Number(item.popularity || 0) * 10 +
    Number(item.vote_average || 0) * 50 +
    Number(item.vote_count || 0) * 0.2 +
    countryBonus(item.origin_country || [], SERIES_COUNTRY_PRIORITY) +
    titleBoost(item.title || item.name || "")
  );
}

function scoreAnime(item) {
  return (
    Number(item.popularity || 0) * 10 +
    Number(item.vote_average || 0) * 50 +
    Number(item.vote_count || 0) * 0.2 +
    countryBonus(item.origin_country || [], ANIME_COUNTRY_PRIORITY) +
    titleBoost(item.title || item.name || "")
  );
}

function scoreMovie(item) {
  return (
    Number(item.popularity || 0) * 10 +
    Number(item.vote_average || 0) * 50 +
    Number(item.vote_count || 0) * 0.2 +
    titleBoost(item.title || item.name || "")
  );
}

// =========================
// PICKERS
// =========================
function pickBestCandidate(candidates, history, usedTitles = new Set()) {
  for (const candidate of candidates) {
    const rawTitle = candidate.title || candidate.name || "";
    const key = normalizeText(rawTitle);

    if (usedTitles.has(key)) continue;
    if (isBlockedByHistory(candidate, history)) continue;

    usedTitles.add(key);
    return candidate;
  }
  return null;
}

async function buildSelection() {
  const history = loadHistory();
  const usedTitles = new Set();

  console.log("🎬 Cimaly social automation — DRY RUN");
  console.log(`Trending + recent content only.`);
  console.log(`Films / series / anime: 2025–2026.`);
  console.log(`Anti-duplicate window: ${ANTI_DUPLICATE_DAYS} days.`);
  console.log(DRY_RUN ? `Nothing will be published.` : `Publishing enabled.`);
  console.log("");

  // SERIES
  const seriesCandidatesRaw = await getSeriesCandidates();
  const seriesCandidates = [...seriesCandidatesRaw].sort((a, b) => scoreSeries(b) - scoreSeries(a));
  const chosenSeriesRaw = pickBestCandidate(seriesCandidates, history, usedTitles);
  if (!chosenSeriesRaw) throw new Error("No valid series candidate found.");

  // ANIME
  console.log("🇯🇵 Anime selection: episode airing TODAY if possible");
  const animeCandidatesRaw = await getAnimeCandidates();
  const animeCandidates = [...animeCandidatesRaw].sort((a, b) => scoreAnime(b) - scoreAnime(a));
  const chosenAnimeRaw = pickBestCandidate(animeCandidates, history, usedTitles);
  if (!chosenAnimeRaw) throw new Error("No valid anime candidate found.");

  // MOVIE
  const movieCandidatesRaw = await getMovieCandidates();
  const movieCandidates = [...movieCandidatesRaw].sort((a, b) => scoreMovie(b) - scoreMovie(a));
  const chosenMovieRaw = pickBestCandidate(movieCandidates, history, usedTitles);
  if (!chosenMovieRaw) throw new Error("No valid movie candidate found.");

  const [morningSeries, afternoonAnime, eveningMovie] = await Promise.all([
    enrichItem("tv", chosenSeriesRaw),
    enrichItem("tv", chosenAnimeRaw),
    enrichItem("movie", chosenMovieRaw),
  ]);

  return {
    morning_series: morningSeries,
    afternoon_anime: afternoonAnime,
    evening_movie: eveningMovie,
  };
}

// =========================
// HISTORY
// =========================
function buildHistoryItems(selection) {
  const now = todayStr();
  return [
    {
      slot: "morning_series",
      tmdb_id: selection.morning_series.tmdb_id,
      type: selection.morning_series.type,
      title_en: selection.morning_series.title_en,
      published_at: now,
    },
    {
      slot: "afternoon_anime",
      tmdb_id: selection.afternoon_anime.tmdb_id,
      type: selection.afternoon_anime.type,
      title_en: selection.afternoon_anime.title_en,
      published_at: now,
    },
    {
      slot: "evening_movie",
      tmdb_id: selection.evening_movie.tmdb_id,
      type: selection.evening_movie.type,
      title_en: selection.evening_movie.title_en,
      published_at: now,
    },
  ];
}

function updateHistory(selection) {
  const history = loadHistory();
  const newItems = buildHistoryItems(selection);

  history.items = Array.isArray(history.items) ? history.items : [];
  history.items.push(...newItems);

  // on garde seulement les 365 derniers jours
  const cutoff = daysAgo(365);
  history.items = history.items.filter(item => (item.published_at || "") >= cutoff);

  saveHistory(history);
}

// =========================
// MAIN
// =========================
async function main() {
  const selection = await buildSelection();

  console.log("");
  console.log("📦 SELECTED CONTENT");
  console.log("");
  console.log(JSON.stringify(selection, null, 2));
  console.log("");

  saveJson(LAST_SELECTION_FILE, selection);

  if (DRY_RUN && !SAVE_HISTORY_IN_DRY_RUN) {
    console.log("ℹ️ DRY RUN active: history NOT updated.");
    console.log("ℹ️ So titles like The Odyssey will NOT be blocked by tests.");
  } else {
    updateHistory(selection);
    console.log("✅ History updated.");
  }

  if (!DRY_RUN) {
    console.log("");
    console.log("⚠️ Real publish mode is enabled.");
    console.log("⚠️ In the next step, we will add the visual generator + Buffer publish.");
    if (!BUFFER_API_KEY) {
      console.log("⚠️ BUFFER_API_KEY missing.");
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
