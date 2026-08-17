const fs = require("fs");
const path = require("path");

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json",
};

const TODAY = new Date();
const TODAY_STR = TODAY.toISOString().slice(0, 10);
const MIN_DATE = "2025-01-01";
const HISTORY_DAYS = 60;

const HISTORY_PATH = path.join(
  process.cwd(),
  "data",
  "social-history.json"
);

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function tmdb(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(
      `TMDB error ${response.status}: ${await response.text()}`
    );
  }

  return response.json();
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) {
    return {
      movies: [],
      series: [],
      anime: [],
    };
  }

  return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
}

function saveHistory(history) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(
    HISTORY_PATH,
    JSON.stringify(history, null, 2) + "\n"
  );
}

function pruneHistory(history) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);

  for (const key of ["movies", "series", "anime"]) {
    history[key] = (history[key] || []).filter((entry) => {
      return new Date(entry.date) >= cutoff;
    });
  }

  return history;
}

function wasRecentlyUsed(history, bucket, tmdbId) {
  return (history[bucket] || []).some(
    (entry) => Number(entry.tmdb_id) === Number(tmdbId)
  );
}

function remember(history, bucket, item) {
  history[bucket] = history[bucket] || [];

  history[bucket].push({
    tmdb_id: item.id,
    title: item.title || item.name || "",
    date: TODAY_STR,
  });
}

function getDateValue(item) {
  return item.release_date || item.first_air_date || "";
}

function yearIsRecent(item) {
  const date = getDateValue(item);
  return date >= MIN_DATE && date <= TODAY_STR;
}

function hasPoster(item) {
  return !!item.poster_path;
}

function hasTitle(item) {
  return !!(item.title || item.name);
}

function validOverview(item) {
  return (item.overview || "").trim().length > 20;
}

function scoreItem(item) {
  return (
    (item.popularity || 0) * 3 +
    (item.vote_average || 0) * 12 +
    Math.min(item.vote_count || 0, 1000)
  );
}

function pickBestUnused(results, history, bucket) {
  const filtered = results
    .filter((item) => !wasRecentlyUsed(history, bucket, item.id))
    .sort((a, b) => scoreItem(b) - scoreItem(a));

  if (!filtered.length) {
    throw new Error(`No unused ${bucket} results found`);
  }

  return filtered[0];
}

async function localizedDetails(type, id, language) {
  return tmdb(`/${type}/${id}`, { language });
}

async function getTrendingMovies(history) {
  const trending = await tmdb("/trending/movie/week", {
    language: "en-US",
  });

  const filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item) &&
      (item.vote_count || 0) >= 20
  );

  return pickBestUnused(filtered, history, "movies");
}

async function getTrendingSeries(history) {
  const trending = await tmdb("/trending/tv/week", {
    language: "en-US",
  });

  const filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item) &&
      (item.vote_count || 0) >= 20
  );

  return pickBestUnused(filtered, history, "series");
}

async function getTrendingAnime(history) {
  const recentAir = await tmdb("/discover/tv", {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
    with_original_language: "ja",
    "first_air_date.gte": MIN_DATE,
    "first_air_date.lte": TODAY_STR,
    "air_date.gte": daysAgo(7),
    "air_date.lte": TODAY_STR,
    "vote_count.gte": "10",
    include_null_first_air_dates: "false",
    page: "1",
  });

  let filtered = recentAir.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item)
  );

  filtered = filtered.filter(
    (item) => !wasRecentlyUsed(history, "anime", item.id)
  );

  if (!filtered.length) {
    const fallback = await tmdb("/discover/tv", {
      language: "en-US",
      sort_by: "popularity.desc",
      with_genres: "16",
      with_origin_country: "JP",
      with_original_language: "ja",
      "first_air_date.gte": MIN_DATE,
      "first_air_date.lte": TODAY_STR,
      "vote_count.gte": "10",
      include_null_first_air_dates: "false",
      page: "1",
    });

    filtered = fallback.results.filter(
      (item) =>
        hasPoster(item) &&
        hasTitle(item) &&
        validOverview(item) &&
        yearIsRecent(item) &&
        !wasRecentlyUsed(history, "anime", item.id)
    );
  }

  if (!filtered.length) {
    throw new Error("No unused anime results found");
  }

  filtered.sort((a, b) => scoreItem(b) - scoreItem(a));
  return filtered[0];
}

async function buildPost(type, item) {
  const en = await localizedDetails(type, item.id, "en-US");
  const ar = await localizedDetails(type, item.id, "ar-SA");

  const titleEN = en.title || en.name;
  const rawArabicTitle = ar.title || ar.name || "";

  const titleAR =
    rawArabicTitle &&
    rawArabicTitle !== en.original_title &&
    rawArabicTitle !== en.original_name
      ? rawArabicTitle
      : "";

  return {
    tmdb_id: item.id,
    type,
    year_date: getDateValue(item),
    popularity: item.popularity || 0,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    title_en: titleEN,
    title_ar: titleAR,
    overview_en: en.overview || "",
    overview_ar: ar.overview || "",
    poster_original: `https://image.tmdb.org/t/p/original${item.poster_path}`,
    poster_w780: `https://image.tmdb.org/t/p/w780${item.poster_path}`,
    cimaly_url:
      type === "movie"
        ? `https://cimaly.cc/movie/${item.id}`
        : `https://cimaly.cc/tv/${item.id}`,
  };
}

async function main() {
  console.log("🎬 Cimaly social automation — DRY RUN");
  console.log("Trending + recent content only (2025–2026).");
  console.log(`Anti-duplicate window: ${HISTORY_DAYS} days.`);
  console.log("Nothing will be published.\n");

  let history = loadHistory();
  history = pruneHistory(history);

  const [series, anime, movie] = await Promise.all([
    getTrendingSeries(history),
    getTrendingAnime(history),
    getTrendingMovies(history),
  ]);

  const output = {
    morning_series: await buildPost("tv", series),
    afternoon_anime: await buildPost("tv", anime),
    evening_movie: await buildPost("movie", movie),
  };

  console.log(JSON.stringify(output, null, 2));

  // Pour le dry run, on enregistre quand même les choix
  // afin de tester que le prochain run choisit d'autres titres.
  remember(history, "series", series);
  remember(history, "anime", anime);
  remember(history, "movies", movie);

  saveHistory(history);

  console.log("\n✅ History updated.");
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
