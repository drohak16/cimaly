import fs from "fs";
import path from "path";

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

/* =========================
   HISTORY
========================= */

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

/* =========================
   COMMON FILTERS
========================= */

function getDateValue(item) {
  return item.release_date || item.first_air_date || "";
}

function yearIsRecent(item) {
  const date = getDateValue(item);

  return (
    date &&
    date >= MIN_DATE &&
    date <= TODAY_STR
  );
}

function hasPoster(item) {
  return Boolean(item.poster_path);
}

function hasTitle(item) {
  return Boolean(item.title || item.name);
}

function validOverview(item) {
  return (item.overview || "").trim().length > 20;
}

function scoreItem(item) {
  return (
    (item.popularity || 0) * 3 +
    (item.vote_average || 0) * 12 +
    Math.min(item.vote_count || 0, 1500)
  );
}

function rank(results) {
  return [...results].sort(
    (a, b) => scoreItem(b) - scoreItem(a)
  );
}

function pickBestUnused(results, history, bucket) {
  const unused = rank(
    results.filter(
      (item) => !wasRecentlyUsed(history, bucket, item.id)
    )
  );

  if (!unused.length) {
    throw new Error(`No unused ${bucket} result found`);
  }

  return unused[0];
}

/* =========================
   MOVIE
   Trending + 2025/2026
========================= */

async function getTrendingMovie(history) {
  // Day first = more current.
  let trending = await tmdb("/trending/movie/day", {
    language: "en-US",
  });

  let filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item) &&
      (item.vote_count || 0) >= 20
  );

  // If daily results don't give enough choices,
  // use weekly trending.
  if (
    filtered.filter(
      (item) =>
        !wasRecentlyUsed(history, "movies", item.id)
    ).length === 0
  ) {
    trending = await tmdb("/trending/movie/week", {
      language: "en-US",
    });

    filtered = trending.results.filter(
      (item) =>
        hasPoster(item) &&
        hasTitle(item) &&
        validOverview(item) &&
        yearIsRecent(item) &&
        (item.vote_count || 0) >= 20
    );
  }

  return pickBestUnused(filtered, history, "movies");
}

/* =========================
   SERIES
   Global Trending
   2025/2026
========================= */

async function getTrendingSeries(history) {
  let trending = await tmdb("/trending/tv/day", {
    language: "en-US",
  });

  let filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item) &&
      (item.vote_count || 0) >= 15
  );

  if (
    filtered.filter(
      (item) =>
        !wasRecentlyUsed(history, "series", item.id)
    ).length === 0
  ) {
    trending = await tmdb("/trending/tv/week", {
      language: "en-US",
    });

    filtered = trending.results.filter(
      (item) =>
        hasPoster(item) &&
        hasTitle(item) &&
        validOverview(item) &&
        yearIsRecent(item) &&
        (item.vote_count || 0) >= 15
    );
  }

  return pickBestUnused(filtered, history, "series");
}

/* =========================
   ANIME
========================= */

function animeBaseParams() {
  return {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
    with_original_language: "ja",
    "first_air_date.gte": MIN_DATE,
    "first_air_date.lte": TODAY_STR,
    include_null_first_air_dates: "false",
    "vote_count.gte": "5",
    page: "1",
  };
}

function filterAnime(results, history) {
  return results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      validOverview(item) &&
      yearIsRecent(item) &&
      !wasRecentlyUsed(history, "anime", item.id)
  );
}

async function getAnime(history) {
  /*
    PRIORITY 1:
    Anime airing TODAY
  */

  const todayAnime = await tmdb("/discover/tv", {
    ...animeBaseParams(),
    "air_date.gte": TODAY_STR,
    "air_date.lte": TODAY_STR,
  });

  let filtered = filterAnime(todayAnime.results, history);

  if (filtered.length) {
    console.log("🇯🇵 Anime selection: episode airing TODAY");
    return rank(filtered)[0];
  }

  /*
    PRIORITY 2:
    Anime aired during last 3 days
  */

  const recentAnime = await tmdb("/discover/tv", {
    ...animeBaseParams(),
    "air_date.gte": daysAgo(3),
    "air_date.lte": TODAY_STR,
  });

  filtered = filterAnime(recentAnime.results, history);

  if (filtered.length) {
    console.log(
      "🇯🇵 Anime selection: episode aired in last 3 days"
    );

    return rank(filtered)[0];
  }

  /*
    PRIORITY 3:
    Anime aired during last 7 days
  */

  const weeklyAnime = await tmdb("/discover/tv", {
    ...animeBaseParams(),
    "air_date.gte": daysAgo(7),
    "air_date.lte": TODAY_STR,
  });

  filtered = filterAnime(weeklyAnime.results, history);

  if (filtered.length) {
    console.log(
      "🇯🇵 Anime selection: recently airing anime"
    );

    return rank(filtered)[0];
  }

  /*
    PRIORITY 4:
    Popular recent anime 2025/2026
  */

  const fallback = await tmdb("/discover/tv", {
    ...animeBaseParams(),
  });

  filtered = filterAnime(fallback.results, history);

  if (!filtered.length) {
    throw new Error("No unused anime found");
  }

  console.log(
    "🇯🇵 Anime selection: popular recent fallback"
  );

  return rank(filtered)[0];
}

/* =========================
   LOCALIZED DETAILS
========================= */

async function localizedDetails(type, id, language) {
  return tmdb(`/${type}/${id}`, {
    language,
  });
}

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

async function buildPost(type, item) {
  const en = await localizedDetails(
    type,
    item.id,
    "en-US"
  );

  const ar = await localizedDetails(
    type,
    item.id,
    "ar-SA"
  );

  const titleEN =
    en.title ||
    en.name ||
    item.title ||
    item.name ||
    "";

  const possibleArabicTitle =
    ar.title ||
    ar.name ||
    "";

  /*
    Only accept title_ar if it really contains Arabic.
    Japanese/English won't accidentally become Arabic.
  */
  const titleAR = containsArabic(possibleArabicTitle)
    ? possibleArabicTitle
    : "";

  const overviewAR = containsArabic(ar.overview || "")
    ? ar.overview
    : "";

  return {
    tmdb_id: item.id,
    type,

    year_date: getDateValue(item),

    popularity: item.popularity || 0,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,

    origin_country:
      item.origin_country ||
      en.origin_country ||
      [],

    original_language:
      item.original_language ||
      en.original_language ||
      "",

    title_en: titleEN,
    title_ar: titleAR,

    overview_en: en.overview || "",
    overview_ar: overviewAR,

    poster_original:
      `https://image.tmdb.org/t/p/original${item.poster_path}`,

    poster_w780:
      `https://image.tmdb.org/t/p/w780${item.poster_path}`,

    cimaly_url:
      type === "movie"
        ? `https://cimaly.cc/movie/${item.id}`
        : `https://cimaly.cc/tv/${item.id}`,
  };
}

/* =========================
   MAIN
========================= */

async function main() {
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
    `Anti-duplicate window: ${HISTORY_DAYS} days.`
  );

  console.log(
    "Nothing will be published.\n"
  );

  let history = loadHistory();
  history = pruneHistory(history);

  const [series, anime, movie] =
    await Promise.all([
      getTrendingSeries(history),
      getAnime(history),
      getTrendingMovie(history),
    ]);

  const output = {
    morning_series:
      await buildPost("tv", series),

    afternoon_anime:
      await buildPost("tv", anime),

    evening_movie:
      await buildPost("movie", movie),
  };

  console.log(
    "\n📦 SELECTED CONTENT\n"
  );

  console.log(
    JSON.stringify(output, null, 2)
  );

  remember(
    history,
    "series",
    series
  );

  remember(
    history,
    "anime",
    anime
  );

  remember(
    history,
    "movies",
    movie
  );

  saveHistory(history);

  console.log(
    "\n✅ History updated."
  );
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
