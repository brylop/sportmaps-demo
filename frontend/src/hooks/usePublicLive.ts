import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '@/lib/api/bffClient';
import type { PublicLiveV2 } from '@/components/tournaments/public/publicModel';
import {
  LIVE_EVENT, acceptPush, liveTopic, mergeOverrides, pollIntervalMs, refetchDelayMs, type LivePushPayload, type Overrides,
} from '@/components/tournaments/live/liveTransport';

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

export type LiveTransport = 'push' | 'polling';

/**
 * Datos públicos de un torneo en vivo.
 *
 * Transporte (F4): con el marcador en vivo encendido se suscribe al canal privado Broadcast
 * `tlive:<slug>` de Supabase Realtime: cada punto llega al instante con el estado mínimo del partido
 * (sin consultar la base). El polling sigue de respaldo: cada 10 s / 60 s sin push, 3× más lento
 * con push conectado. Solo con la pestaña visible; al ocultarla se suelta el canal.
 *
 * La FORMA de lo que devuelve no cambió ({ data, notFound, error, loading, updatedAt, now });
 * se agregó `transport` (informativo) y `reload` (recarga a demanda).
 */
export function usePublicLive(slug: string | undefined) {
  const [data, setData] = useState<PublicLiveV2 | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [transport, setTransport] = useState<LiveTransport>('polling');
  const polledRef = useRef<PublicLiveV2 | null>(null);
  const overridesRef = useRef<Overrides>(new Map());
  const pushRef = useRef(false);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');

  const publish = useCallback(() => {
    if (!polledRef.current) return;
    setData(mergeOverrides(polledRef.current, overridesRef.current) as PublicLiveV2);
  }, []);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const r = await bffClient.get<PublicLiveV2>(`/api/v1/tournament-live/public/${encodeURIComponent(slug)}/live`, undefined, 'public');
      polledRef.current = r;
      publish();
      setNotFound(false); setError(null); setUpdatedAt(Date.now());
    } catch (e) {
      const err = e as { status?: number; message?: string };
      if (err.status === 404) setNotFound(true);
      else setError(err.message || 'No pudimos actualizar. Reintentando…');
    } finally { setLoading(false); }
  }, [slug, publish]);

  // Polling de respaldo.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load();
        schedule();
      }, pollIntervalMs(polledRef.current?.matches ?? [], pushRef.current));
    };
    const onVis = () => {
      const v = document.visibilityState === 'visible';
      setVisible(v);
      if (v) void load();
    };
    void load().then(schedule);
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  // Push: solo con marcador en vivo y pestaña visible.
  const liveOn = !!data?.event.live_enabled;
  useEffect(() => {
    if (!slug || !liveOn || !visible) return;
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // Import diferido: si el cliente de Supabase no carga (sin variables, pruebas), queda el polling.
    import('@/integrations/supabase/client').then(({ supabase }) => {
      if (cancelled) return;
      const channel = supabase.channel(liveTopic(slug), { config: { private: true, broadcast: { self: false } } });
      channel
        .on('broadcast', { event: LIVE_EVENT }, ({ payload }) => {
          const outcome = acceptPush(overridesRef.current, polledRef.current, payload);
          if (outcome === 'applied') { publish(); setUpdatedAt(Date.now()); }
          const delay = refetchDelayMs(outcome, outcome === 'invalid' ? null : (payload as LivePushPayload));
          if (delay != null && !refetchTimer) refetchTimer = setTimeout(() => { refetchTimer = undefined; void load(); }, delay);
        })
        .subscribe((status) => {
          const ok = status === 'SUBSCRIBED';
          pushRef.current = ok;
          setTransport(ok ? 'push' : 'polling');
        });
      cleanup = () => { void supabase.removeChannel(channel); };
    }).catch(() => { /* sin tiempo real: sigue el polling */ });
    return () => {
      cancelled = true;
      pushRef.current = false;
      setTransport('polling');
      if (refetchTimer) clearTimeout(refetchTimer);
      cleanup?.();
    };
  }, [slug, liveOn, visible, load, publish]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return { data, notFound, error, loading, updatedAt, now, transport, reload: load };
}
