'use client';

/**
 * Cimaly — WatchPage.tsx
 * A self-contained watch page with switchable servers.
 *
 *   Server 1: vaplayer   — movies: /embed/movie/<imdbId>       series: /embed/tv/<tmdbId>/<s>/<e>
 *   Server 2: vidsrcme   — movies: /embed/movie/<imdbId>       series: /embed/tv/<tmdbId>/<s>/<e>
 *
 * Movies embed by IMDb id (tt…), so the page fetches the IMDb id from TMDB.
 * Series embed by TMDB id + season + episode.
 *
 * Usage examples (Next.js App Router):
 *   // app/watch/movie/[id]/page.tsx
 *   import WatchPage from '@/components/WatchPage';
 *   export default function P({ params }: { params: { id: string } }) {
 *     return <WatchPage type="movie" tmdbId={Number(params.id)} />;
 *   }
 *
 *   // app/watch/tv/[id]/[season]/[episode]/page.tsx
 *   import WatchPage from '@/components/WatchPage';
 *   export default function P({ params }: { params: { id: string; season: string; episode: string } }) {
 *     return (
 *       <WatchPage type="tv" tmdbId={Number(params.id)}
 *         season={Number(params.season)} episode={Number(params.episode)} />
 *     );
 *   }
 */

import { useEffect, useMemo, useState } from 'react';

// TMDB key (public metadata). Replace with your own or a NEXT_PUBLIC_ env var.
const TMDB_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_TMDB_API_KEY) ||
  'f7100f8b277105b2535714a69e0d2774';

// ---- Servers ---------------------------------------------------------------
// Add / reorder servers here. `movie` gets the IMDb id, `tv` gets tmdbId+s+e.
const SERVERS: {
  name: string;
  movie: (imdbId: string, tmdbId: number) => string;
  tv: (tmdbId: number, s: number, e: number) => string;
}[] = [
  {
    name: 'Server 1',
    movie: (imdbId, tmdbId) => `https://vaplayer.ru/embed/movie/${imdbId || tmdbId}`,
    tv: (tmdbId, s, e) => `https://vaplayer.ru/embed/tv/${tmdbId}/${s}/${e}`,
  },
  {
    name: 'Server 2',
    movie: (imdbId, tmdbId) => `https://vidsrcme.ru/embed/movie/${imdbId || tmdbId}`,
    tv: (tmdbId, s, e) => `https://vidsrcme.ru/embed/tv/${tmdbId}/${s}/${e}`,
  },
];

export interface WatchPageProps {
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
}

interface Meta {
  title: string;
  imdbId: string;
  overview: string;
  year: string;
  rating: number;
}

export default function WatchPage({ type, tmdbId, season = 1, episode = 1 }: WatchPageProps) {
  const [server, setServer] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=external_ids&language=en-US`
        );
        const d = await res.json();
        if (cancelled) return;
        setMeta({
          title: d.title || d.name || '',
          imdbId: d.imdb_id || d.external_ids?.imdb_id || '',
          overview: d.overview || '',
          year: (d.release_date || d.first_air_date || '').slice(0, 4),
          rating: d.vote_average || 0,
        });
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, tmdbId]);

  const src = useMemo(() => {
    const s = SERVERS[server];
    if (type === 'movie') return s.movie(meta?.imdbId || '', tmdbId);
    return s.tv(tmdbId, season, episode);
  }, [server, type, tmdbId, season, episode, meta?.imdbId]);

  // For movies, Server-that-needs-IMDb waits until we have it.
  const needsImdb = type === 'movie';
  const ready = !needsImdb || Boolean(meta?.imdbId) || !loading;

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        {/* Player */}
        <div style={styles.screen}>
          {ready ? (
            <iframe
              key={src}
              src={src}
              style={styles.iframe}
              frameBorder={0}
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="origin"
              title={meta?.title || 'Cimaly Player'}
            />
          ) : (
            <div style={styles.loading}>Loading…</div>
          )}
        </div>

        {/* Server switcher */}
        <div style={styles.servers}>
          <span style={styles.serversLabel}>SERVERS</span>
          {SERVERS.map((s, i) => (
            <button
              key={s.name}
              onClick={() => setServer(i)}
              style={{ ...styles.serverBtn, ...(i === server ? styles.serverBtnOn : {}) }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <p style={styles.notice}>
          Playback is provided by an external embedded player. If a server does not load, switch to another one.
        </p>

        {/* Meta */}
        <div style={styles.info}>
          <p style={styles.now}>NOW WATCHING</p>
          <h1 style={styles.title}>{meta?.title || `#${tmdbId}`}</h1>
          {type === 'tv' && (
            <p style={styles.metaLine}>
              Season {season} · Episode {episode}
            </p>
          )}
          <p style={styles.metaDim}>
            {meta?.rating ? `★ ${meta.rating.toFixed(1)}` : ''}
            {meta?.year ? ` · ${meta.year}` : ''}
          </p>
          {meta?.overview && <p style={styles.overview}>{meta.overview}</p>}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { background: '#0a0a0b', color: '#f4f4f5', minHeight: '100vh', paddingTop: 24 },
  wrap: { maxWidth: 1024, margin: '0 auto', padding: '0 16px 40px' },
  screen: {
    position: 'relative',
    aspectRatio: '16 / 9',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#000',
    border: '1px solid #2a2a2e',
  },
  iframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#71717a',
    fontSize: 14,
  },
  servers: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },
  serversLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#71717a',
    marginInlineEnd: 4,
  },
  serverBtn: {
    border: '1px solid #2a2a2e',
    background: '#1a1a1d',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: '#d4d4d8',
    cursor: 'pointer',
  },
  serverBtnOn: { background: '#e50914', borderColor: '#e50914', color: '#fff' },
  notice: { fontSize: 12, color: '#52525b', marginTop: 10 },
  info: { borderTop: '1px solid rgba(42,42,46,0.6)', marginTop: 18, paddingTop: 18 },
  now: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#e50914',
  },
  title: { fontSize: 26, fontWeight: 800, marginTop: 4 },
  metaLine: { marginTop: 6, fontSize: 14, fontWeight: 600, color: '#d4d4d8' },
  metaDim: { marginTop: 4, fontSize: 14, color: '#a1a1aa' },
  overview: { marginTop: 12, fontSize: 14, lineHeight: 1.6, color: '#a1a1aa', maxWidth: 760 },
};
