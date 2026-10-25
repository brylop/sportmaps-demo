import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import type { PublicLiveDto } from '@/lib/tournamentTypes';
import { refreshIntervalMs } from '@/lib/tournamentDisplay';

/** `<meta name="robots" content="noindex">` mientras la página está montada (no usamos react-helmet). */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { meta.parentNode?.removeChild(meta); };
  }, []);
}

/**
 * Datos públicos de un torneo en vivo. Refresca cada 10 s con partidos en juego y cada 60 s si no,
 * SOLO con la pestaña visible; al volver a la pestaña refresca de inmediato. El navegador aplica
 * ETag / If-None-Match por su cuenta si el BFF los manda.
 */
export function usePublicLive(slug: string | undefined) {
  const [data, setData] = useState<PublicLiveDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dataRef = useRef<PublicLiveDto | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await bffClient.get<PublicLiveDto>(`/api/v1/tournament-live/public/${encodeURIComponent(slug)}/live`, undefined, 'public');
      dataRef.current = r;
      setData(r); setNotFound(false); setError(null); setUpdatedAt(Date.now());
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 404) setNotFound(true);
      else setError(err.message || 'No pudimos actualizar. Reintentando…');
    } finally { setLoading(false); }
  }, [slug]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load();
        schedule();
      }, refreshIntervalMs(dataRef.current?.matches ?? []));
    };
    const onVis = () => { if (document.visibilityState === 'visible') void load(); };
    void load().then(schedule);
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return { data, notFound, error, loading, updatedAt, now };
}
