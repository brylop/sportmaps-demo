import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import type { PublicLiveV2, PublicMatchV2 } from '@/components/tournaments/public/publicModel';
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
 * PUNTO DE ENCHUFE de «vivo» (tiempo real): este hook sigue haciendo polling (10 s con partidos en juego,
 * 60 s si no). Para enchufar el transporte en vivo, suscríbete dentro del `useEffect` marcado abajo y llama:
 *  - `patchMatch(match)` cuando llegue UN partido actualizado (la página se repinta sin esperar al polling), o
 *  - `reload()` cuando el evento diga «cambió algo» sin traer el partido (tabla, cuadro…).
 * Las dos también se devuelven, por si prefieres suscribirte desde un componente.
 *
 * Datos públicos de un torneo en vivo. Refresca cada 10 s con partidos en juego y cada 60 s si no,
 * SOLO con la pestaña visible; al volver a la pestaña refresca de inmediato. El navegador aplica
 * ETag / If-None-Match por su cuenta si el BFF los manda.
 */
export function usePublicLive(slug: string | undefined) {
  const [data, setData] = useState<PublicLiveV2 | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dataRef = useRef<PublicLiveV2 | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await bffClient.get<PublicLiveV2>(`/api/v1/tournament-live/public/${encodeURIComponent(slug)}/live`, undefined, 'public');
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

  /** Reemplaza un partido por id (lo usa el transporte en vivo). Ignora versiones viejas si trae `version`. */
  const patchMatch = useCallback((m: PublicMatchV2 & { version?: number }) => {
    setData((prev) => {
      if (!prev) return prev;
      const i = prev.matches.findIndex((x) => x.id === m.id);
      if (i < 0) return prev;
      const old = prev.matches[i] as PublicMatchV2 & { version?: number };
      if (old.version != null && m.version != null && m.version < old.version) return prev;
      const matches = prev.matches.slice();
      matches[i] = { ...old, ...m };
      const next = { ...prev, matches };
      dataRef.current = next;
      return next;
    });
    setUpdatedAt(Date.now());
  }, []);

  // ── PUNTO DE ENCHUFE «vivo»: suscripción en tiempo real (usar `patchMatch` / `load`). ──
  // useEffect(() => { if (!slug) return; const off = subscribeTournament(slug, { onMatch: patchMatch, onChange: load }); return off; }, [slug, patchMatch, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return { data, notFound, error, loading, updatedAt, now, reload: load, patchMatch };
}
