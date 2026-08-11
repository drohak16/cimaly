import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  path: z.string().regex(/^\/[A-Za-z0-9/_\-.]*$/),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type TmdbResult = { ok: boolean; missingKey?: boolean; data?: any };

export const tmdbFetch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }): Promise<TmdbResult> => {
    const key = process.env["TMDB_API_KEY"];
    if (!key) return { ok: false, missingKey: true };
    const q = new URLSearchParams({ api_key: key });
    for (const [k, v] of Object.entries(data.params ?? {})) q.set(k, String(v));
    try {
      const res = await fetch(`https://api.themoviedb.org/3${data.path}?${q.toString()}`);
      if (!res.ok) return { ok: false };
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false };
    }
  });