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

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`TMDB error ${response.status}: ${await response.text()}`);
  }

  return response.json();
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

function hasEnoughVotes(item) {
  return (item.vote_count || 0) >= 15;
}

function validOverview(item) {
  return (item.overview || "").trim().length > 20;
}

function scoreItem(item) {
  return (
    (item.popularity || 0) * 2 +
    (item.vote_average || 0) * 10 +
    Math.min(item.vote_count || 0, 500)
  );
}

function sortByScore(results) {
  return [...results].sort((a, b) => scoreItem(b) - scoreItem(a));
}

function pickFromTop(results, top = 5) {
  if (!results.length) {
    throw new Error("No valid TMDB results found");
  }

  const ranked = sortByScore(results).slice(0, top);
  return ranked[Math.floor(Math.random() * ranked.length)];
}

async function localizedDetails(type, id, language) {
  return tmdb(`/${type}/${id}`, { language });
}

async function getTrendingMovies() {
  const trending = await tmdb("/trending/movie/week", { language: "en-US" });

  const filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      hasEnoughVotes(item) &&
      yearIsRecent(item) &&
      validOverview(item)
  );

  return pickFromTop(filtered, 7);
}

async function getTrendingSeries() {
  const trending = await tmdb("/trending/tv/week", { language: "en-US" });

  const filtered = trending.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      hasEnoughVotes(item) &&
      yearIsRecent(item) &&
      validOverview(item)
  );

  return pickFromTop(filtered, 7);
}

async function getTrendingAnime() {
  // On cible anime japonais récents, populaires, et avec diffusion récente
  const primary = await tmdb("/discover/tv", {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
    with_original_language: "ja",
    "first_air_date.gte": MIN_DATE,
    "first_air_date.lte": TODAY_STR,
    "air_date.gte": daysAgo(30),
    "air_date.lte": TODAY_STR,
    "vote_count.gte": "10",
    include_null_first_air_dates: "false",
    page: "1",
  });

  let filtered = primary.results.filter(
    (item) =>
      hasPoster(item) &&
      hasTitle(item) &&
      yearIsRecent(item) &&
      validOverview(item)
  );

  if (!filtered.length) {
    // fallback un peu plus large si peu de résultats
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
        yearIsRecent(item) &&
        validOverview(item)
    );
  }

  return pickFromTop(filtered, 7);
}

async function buildPost(type, item) {
  const en = await localizedDetails(type, item.id, "en-US");
  const ar = await localizedDetails(type, item.id, "ar-SA");

  const titleEN = en.title || en.name;
  const titleAR = ar.title || ar.name || titleEN;

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
  console.log("Nothing will be published.\n");

  const [series, anime, movie] = await Promise.all([
    getTrendingSeries(),
    getTrendingAnime(),
    getTrendingMovies(),
  ]);

  const output = {
    morning_series: await buildPost("tv", series),
    afternoon_anime: await buildPost("tv", anime),
    evening_movie: await buildPost("movie", movie),
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("❌", error);
  process.exit(1);
});
