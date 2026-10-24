import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicLive, useNoIndex } from '@/hooks/usePublicLive';
import { byScheduleOrder, nowAndNextByCourt } from '@/lib/tournamentDisplay';
import { BracketView, MatchCard, StandingsView } from '@/components/tournaments/TournamentViews';

export const TV_ROTATION_MS = 8000;

/** Modo TV: solo lectura, letra grande, rota entre canchas y categorías cada 8 s. */
export default function TournamentTvPage() {
  const { slug } = useParams<{ slug: string }>();
  useNoIndex();
  const { data, notFound, loading } = usePublicLive(slug);
  const [idx, setIdx] = useState(0);

  const slides = useMemo(() => {
    if (!data) return [] as Array<{ key: string; title: string; render: () => JSX.Element }>;
    const out: Array<{ key: string; title: string; render: () => JSX.Element }> = [];
    const byCourt = nowAndNextByCourt(data.matches);
    if (data.event.live_enabled) {
      for (const c of byCourt) {
        if (!c.live && !c.next) continue;
        out.push({
          key: `court-${c.court}`, title: c.court,
          render: () => (
            <div className="space-y-4">
              {c.live ? <><h3 className="text-2xl font-semibold">En juego</h3><MatchCard match={c.live} large /></> : null}
              {c.next ? <><h3 className="text-2xl font-semibold">Siguiente</h3><MatchCard match={c.next} large /></> : null}
            </div>
          ),
        });
      }
    }
    for (const cat of data.categories) {
      const ms = data.matches.filter((m) => m.category_id === cat.id).sort(byScheduleOrder);
      const ko = ms.filter((m) => m.stage === 'knockout' || m.stage === 'third_place');
      out.push({ key: `tab-${cat.id}`, title: `${cat.name} · Posiciones`, render: () => <div className="text-lg"><StandingsView data={data.standings[cat.id]} /></div> });
      if (ko.length > 0) out.push({ key: `ko-${cat.id}`, title: `${cat.name} · Fase final`, render: () => <BracketView matches={ko} large /> });
      const recent = ms.filter((m) => !m.is_bye && (m.status === 'played' || m.status === 'walkover')).slice(-4).reverse();
      if (recent.length > 0) out.push({ key: `res-${cat.id}`, title: `${cat.name} · Últimos resultados`, render: () => <div className="space-y-3">{recent.map((m) => <MatchCard key={m.id} match={m} large />)}</div> });
    }
    return out;
  }, [data]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), TV_ROTATION_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  if (loading) return <div className="p-10 text-2xl text-muted-foreground">Cargando…</div>;
  if (notFound || !data) return <div className="p-10 text-2xl text-muted-foreground">No encontramos este torneo.</div>;

  const slide = slides.length ? slides[idx % slides.length] : null;
  return (
    <div className="min-h-screen bg-background p-8 text-foreground" data-testid="tv">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="text-4xl font-bold">🏆 {data.event.title}</h1>
        {slide && <span className="text-2xl text-muted-foreground">{slide.title}</span>}
      </header>
      {slide ? <div key={slide.key}>{slide.render()}</div> : <p className="text-2xl text-muted-foreground">Todavía no hay partidos para mostrar.</p>}
      <footer className="mt-8 text-sm text-muted-foreground">Powered by SportMaps</footer>
    </div>
  );
}
