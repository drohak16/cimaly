import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  path: z.string().regex(/^\/[A-Za-z0-9/_\-.]*$/),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

type TmdbInput = z.infer<typeof schema>;
export type TmdbResult = { ok: boolean; missingKey?: boolean; status?: number; data?: any };

type CacheEntry = { result: TmdbResult; freshUntil: number; staleUntil: number };
// Bounded per-isolate cache; no storage of API keys and no paid service/Worker required.
// Cloudflare can evict an isolate at any time, so this is an optimization, not persistence.
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TmdbResult>>();
const MAX_ENTRIES = 80;
const STALE_MS = 12 * 60 * 60 * 1000;

function cacheDuration(path: string): number {
  if (path.startsWith("/search/")) return 2 * 60 * 1000;
  if (path.startsWith("/discover/") || path.startsWith("/trending/")) return 10 * 60 * 1000;
  if (/^\/(movie|tv)\/\d+(\/season\/\d+)?$/.test(path)) return 60 * 60 * 1000;
  return 10 * 60 * 1000;
}

function cacheKey(data: TmdbInput): string {
  return JSON.stringify([data.path, Object.entries(data.params ?? {}).sort(([a], [b]) => a.localeCompare(b))]);
}

async function fromTmdb(data: TmdbInput, key: string): Promise<TmdbResult> {
  const q = new URLSearchParams({ api_key: key });
  for (const [name, value] of Object.entries(data.params ?? {})) q.set(name, String(value));
  try {
    const response = await fetch(`https://api.themoviedb.org/3${data.path}?${q.toString()}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      if (response.status >= 500 || response.status === 429) {
        console.warn("TMDB transient failure", data.path, response.status);
      }
      return { ok: false, status: response.status };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    console.warn("TMDB upstream request failed", data.path, error instanceof Error ? error.name : "unknown");
    return { ok: false };
  }
}

async function fetchCached(data: TmdbInput): Promise<TmdbResult> {
  const key = process.env["TMDB_API_KEY"];
  if (!key) return { ok: false, missingKey: true };
  const id = cacheKey(data);
  const now = Date.now();
  const saved = cache.get(id);
  if (saved && now < saved.freshUntil) return saved.result;

  const existing = inFlight.get(id);
  if (existing) return existing;

  const pending = (async () => {
    const next = await fromTmdb(data, key);
    if (next.ok) {
      // Avoid caching exceptionally large TMDB responses in a small edge isolate.
      if (JSON.stringify(next.data).length < 450_000) {
        cache.delete(id);
        cache.set(id, {
          result: next,
          freshUntil: Date.now() + cacheDuration(data.path),
          staleUntil: Date.now() + cacheDuration(data.path) + STALE_MS,
        });
        while (cache.size > MAX_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          cache.delete(oldest);
        }
      }
      return next;
    }
    // Real 404 must remain a 404; do not resurrect deleted/nonexistent records.
    if (next.status === 404) {
      cache.delete(id);
      return next;
    }
    // A previously successful payload is preferable to a transient 500 for Googlebot.
    return saved && Date.now() < saved.staleUntil ? saved.result : next;
  })().finally(() => inFlight.delete(id));

  inFlight.set(id, pending);
  return pending;
}

export const tmdbFetch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<TmdbResult> => fetchCached(data));
