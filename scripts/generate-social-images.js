import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SELECTION_FILE = path.resolve("data/last-social-selection.json");
const OUTPUT_ROOT = path.resolve("public/social");

const TMDB_TOKEN = process.env.TMDB_READ_TOKEN;

if (!TMDB_TOKEN) {
  throw new Error("TMDB_READ_TOKEN is missing");
}

const WIDTH = 1080;
const HEIGHT = 1350;

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: "application/json"
};

/* =========================================================
   BASIC HELPERS
========================================================= */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeFilename(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function containsArabic(text = "") {
  return /[\u0600-\u06FF]/.test(text);
}

function escapeXml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function splitWords(text = "", maxChars = 25) {
  const words = text.trim().split(/\s+/);

  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current
      ? `${current} ${word}`
      : word;

    if (
      test.length > maxChars &&
      current
    ) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 2);
}

/* =========================================================
   TMDB
========================================================= */

async function tmdb(pathname) {
  const response = await fetch(
    `https://api.themoviedb.org/3${pathname}`,
    {
      headers: TMDB_HEADERS
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `TMDB ${response.status}: ${text}`
    );
  }

  return response.json();
}

async function downloadImage(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Poster download failed: ${response.status}`
    );
  }

  return Buffer.from(
    await response.arrayBuffer()
  );
}

/* =========================================================
   ARABIC
