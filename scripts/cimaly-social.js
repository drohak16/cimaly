const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const headers = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json",
};

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`TMDB error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

function choose(results = []) {
  const usable = results.filter(
    (item) =>
      item.poster_path &&
      (item.title || item.name) &&
      (item.overview || "").trim().length > 30
  );

  if (!usable.length) {
    throw new Error("No usable TMDB result found");
  }

  return usable[Math.floor(Math.random() * Math.min(usable.length, 10))];
}

async function localizedDetails(type, id, language) {
  return tmdb(`/${type}/${id}`, { language });
}

async function getMovie() {
  const today = new Date().toISOString().slice(0, 10);

  const data = await tmdb("/discover/movie", {
    language: "en-US",
    sort_by: "popularity.desc",
    "primary_release_date.lte": today,
    "primary_release_date.gte": "2026-01-01",
    "vote_count.gte": "20",
    include_adult: "false",
    page: "1",
  });

  return choose(data.results);
}

async function getSeries() {
  const data = await tmdb("/discover/tv", {
    language: "en-US",
    sort_by: "popularity.desc",
    "first_air_date.gte": "2025-01-01",
    "vote_count.gte": "20",
    include_null_first_air_dates: "false",
    page: "1",
  });

  return choose(data.results);
}

async function getAnime() {
  const data = await tmdb("/discover/tv", {
    language: "en-US",
    sort_by: "popularity.desc",
    with_genres: "16",
    with_origin_country: "JP",
    with_original_language: "ja",
    "first_air_date.gte": "2024-01-01",
    page: "1",
  });

  return choose(data.results);
}

async function buildPost(type, item) {
  const en = await localizedDetails(type, item.id, "en-US");
  const ar = await localizedDetails(type, item.id, "ar-SA");

  const titleEN = en.title || en.name;
  const titleAR = ar.title || ar.name || titleEN;

  return {
    tmdb_id: item.id,
    type,
    title_en: titleEN,
    title_ar: titleAR,
    overview_en: en.overview || "",
    overview_ar: ar.overview || "",
    poster_original: `https://image.tmdb.org/t/p/original${item.poster_path}`,
    poster_w780: `https://image.tmdb.org/t/p/w780${item.poster_path}`,
    cimaly_url: "https://cimaly.cc",
  };
}

async function main() {
  console.log("🎬 Cimaly social automation — DRY RUN");
  console.log("Nothing will be published.\n");

  const [series, anime, movie] = await Promise.all([
    getSeries(),
    getAnime(),
    getMovie(),
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
