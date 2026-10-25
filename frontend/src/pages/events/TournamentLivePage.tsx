import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Radio } from 'lucide-react';
import { usePublicLive, useNoIndex } from '@/hooks/usePublicLive';
import { agoText, byScheduleOrder, liveMatches, nowAndNextByCourt, validateStreamUrl } from '@/lib/tournamentDisplay';
import { BracketView, MatchCard, StandingsView } from '@/components/tournaments/TournamentViews';

/**
 * Página PÚBLICA «en vivo» de un torneo — sin login, sin nombres de deportistas (solo equipos y marcadores).
 * Plan: docs/specs/torneos-en-vivo-multideporte-plan.md §3.4.
 */
export default function TournamentLivePage() {
  const { slug } = useParams<{ slug: string }>();
  useNoIndex();
  const { data, notFound, error, loading, updatedAt, now } = usePublicLive(slug);
  const [catSel, setCatSel] = useState<string | null>(null);

  const catId = catSel ?? data?.categories[0]?.id ?? null;
  const matches = data?.matches ?? [];
  const catMatches = useMemo(() => matches.filter((m) => !catId || m.category_id === catId).sort(byScheduleOrder), [matches, catId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando torneo…</div>;
  if (notFound || !data) return <div className="p-6 text-sm text-muted-foreground">No encontramos este torneo o todavía no es público.</div>;

  const ev = data.event;
  const liveOn = ev.live_enabled;
  const enJuego = liveOn ? liveMatches(matches) : [];
  const siguientes = liveOn ? nowAndNextByCourt(matches).filter((c) => c.next) : [];
  const played = catMatches.filter((m) => !m.is_bye && (m.status === 'played' || m.status === 'walkover')).reverse();
  const knockout = catMatches.filter((m) => m.stage === 'knockout' || m.stage === 'third_place');
  const standing = catId ? data.standings[catId] : undefined;
  const streamOk = ev.stream_url && !validateStreamUrl(ev.stream_url);
  const cta = `/register?utm_source=torneo_en_vivo&utm_medium=pie&utm_campaign=${encodeURIComponent(slug ?? '')}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">🏆 {ev.title}</h1>
        <p className="text-sm text-muted-foreground">
          {[ev.school_name, ev.sport, ev.city, ev.event_date].filter(Boolean).join(' · ')}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span aria-live="polite">{agoText(updatedAt, now)}</span>
          {error && <span className="text-destructive">· {error}</span>}
          {streamOk && (
            <Button size="sm" variant="outline" asChild className="ml-auto">
              <a href={ev.stream_url!} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-4 w-4" /> Ver transmisión</a>
            </Button>
          )}
        </div>
      </header>

      {!liveOn && (
        <Card><CardContent className="py-3 text-sm text-muted-foreground">Este torneo no tiene marcador en vivo. Aquí verás los resultados y la tabla cuando se carguen.</CardContent></Card>
      )}

      {liveOn && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Radio className="h-4 w-4 text-primary" /> En juego ahora</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {enJuego.length === 0 ? <p className="text-sm text-muted-foreground">No hay partidos en juego en este momento.</p>
              : enJuego.map((m) => <MatchCard key={m.id} match={m} large />)}
          </CardContent>
        </Card>
      )}

      {siguientes.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Siguiente en cada cancha</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {siguientes.map((c) => <MatchCard key={c.court} match={c.next!} />)}
          </CardContent>
        </Card>
      )}

      {data.categories.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categorías">
          {data.categories.map((c) => (
            <Button key={c.id} role="tab" aria-selected={c.id === catId} size="sm" variant={c.id === catId ? 'default' : 'outline'} onClick={() => setCatSel(c.id)}>{c.name}</Button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Tabla de posiciones</CardTitle></CardHeader>
        <CardContent><StandingsView data={standing} /></CardContent>
      </Card>

      {knockout.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fase final</CardTitle></CardHeader>
          <CardContent><BracketView matches={knockout} /></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Resultados</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {played.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay partidos terminados.</p>
            : played.map((m) => <MatchCard key={m.id} match={m} />)}
        </CardContent>
      </Card>

      <footer className="flex flex-col items-center gap-2 border-t py-4 text-center text-sm text-muted-foreground">
        <Badge variant="outline">Powered by SportMaps</Badge>
        <Button asChild size="sm"><a href={cta}>Organiza tu torneo con SportMaps</a></Button>
      </footer>
    </div>
  );
}
