import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicLive, useNoIndex } from '@/hooks/usePublicLive';
import { formatBogota, teamName } from '@/lib/tournamentDisplay';
import { brandStyle } from '@/components/tournaments/public/brand';
import { StatusPill, TeamBadge } from '@/components/tournaments/public/PublicMatchCard';
import { EmptyState } from '@/components/tournaments/public/PublicTabs';
import { ShareSheet } from '@/components/tournaments/public/ShareSheet';
import { MatchSocialPanel } from '@/components/tournaments/live/MatchSocialPanel';
import { ShareResultButton } from '@/components/tournaments/live/ShareResultButton';
import {
  lastKoRoundByCup, phaseShort, setsGrid, shareLink, teamIndex, tournamentView, winnerSide, type PublicMatchV2, type TeamInfo,
} from '@/components/tournaments/public/publicModel';

type MTab = 'partido' | 'comentarios' | 'fotos';
const MTAB_LABEL: Record<MTab, string> = { partido: 'Partido', comentarios: 'Comentarios', fotos: 'Fotos' };
/** Comentarios y Fotos los pinta el panel de «vivo» (que además trae MVP); se abre en su pestaña. */
const SOCIAL_TAB = { comentarios: 'comentarios', fotos: 'medios' } as const;

/** Página PÚBLICA de un partido: /torneo/:slug/partido/:matchId — Partido · Comentarios · Fotos. */
export default function TournamentMatchPage() {
  const { slug = '', matchId = '' } = useParams<{ slug: string; matchId: string }>();
  useNoIndex();
  const { data, notFound, loading } = usePublicLive(slug);
  const [tab, setTab] = useState<MTab>('partido');
  const [share, setShare] = useState(false);
  const teams = useMemo(() => (data ? teamIndex(data) : new Map()), [data]);
  const match = data?.matches.find((m) => m.id === matchId) as PublicMatchV2 | undefined;

  if (loading) return <div className="p-6" role="status" aria-busy="true"><div className="h-40 animate-pulse rounded-xl bg-muted" /><span className="sr-only">Cargando partido…</span></div>;
  if (notFound || !data || !match) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <EmptyState icon="🔎" title="No encontramos este partido">Puede que el calendario haya cambiado.</EmptyState>
        {data && <p className="text-center"><Link className="text-sm underline" to={`/torneo/${encodeURIComponent(slug)}/en-vivo`}>Volver al torneo</Link></p>}
      </div>
    );
  }

  const t = tournamentView(data);
  const { style } = brandStyle(t.brand_color);
  const cat = data.categories.find((c) => c.id === match.category_id)?.name ?? '';
  const home = teamName(match, 'home'); const away = teamName(match, 'away');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const phase = phaseShort(match, lastKoRoundByCup(data.matches).get(match.cup_label ?? '') ?? match.round);

  return (
    <div className="min-h-screen bg-background text-foreground" style={style}>
      <header className="bg-[var(--brand)] text-[var(--brand-fg)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 py-3">
          <Link to={`/torneo/${encodeURIComponent(slug)}/en-vivo`} className="rounded-full p-2 hover:bg-white/10" aria-label="Volver al torneo"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-lg font-extrabold">{home} vs {away}</h1>
            <p className="truncate text-xs uppercase opacity-85">{[cat, t.title].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-white/10" aria-label="Compartir partido" onClick={() => setShare(true)}><Share2 className="h-5 w-5" /></button>
        </div>
        <div className="mx-auto flex max-w-3xl gap-2 px-3 pb-3" role="tablist" aria-label="Secciones del partido">
          {(Object.keys(MTAB_LABEL) as MTab[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setTab(k)}
              className={cn('flex-1 rounded-lg py-2 text-sm font-semibold', k === tab ? 'bg-background text-foreground' : 'bg-white/15')}>
              {MTAB_LABEL[k]}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5" role="tabpanel">
        {tab === 'partido' && (
          <div className="space-y-4">
            <MatchDetail match={match} teams={teams} phase={phase} venue={t.venue?.name ?? null} />
            {(match.status === 'played' || match.status === 'walkover') && (
              <div className="flex justify-center">
                <ShareResultButton match={match} tournament={t.title} category={cat} url={shareLink(origin, slug, 'match', { matchId })} label="Compartir resultado" size="default" />
              </div>
            )}
          </div>
        )}
        {tab !== 'partido' && <MatchSocialPanel key={tab} slug={slug} matchId={matchId} defaultTab={SOCIAL_TAB[tab]} />}
      </main>

      {share && (
        <ShareSheet open={share} onOpenChange={setShare} targets={[
          { scope: 'match', label: 'Partido', title: `${home} vs ${away} · ${t.title}`, url: shareLink(origin, slug, 'match', { matchId }) },
          { scope: 'category', label: 'Categoría', title: `${t.title} · ${cat}`, url: shareLink(origin, slug, 'category', { categoryId: match.category_id }) },
          { scope: 'tournament', label: 'Torneo', title: t.title, url: shareLink(origin, slug, 'tournament') },
        ]} />
      )}
    </div>
  );
}

/** Pestaña «Partido»: estado, marcador grande, sets en cuadrícula por equipo, cancha, hora y sede. */
function MatchDetail({ match: m, teams, phase, venue }: { match: PublicMatchV2; teams: Map<string, TeamInfo>; phase: string; venue: string | null }) {
  const win = winnerSide(m);
  const isSets = m.model === 'sets';
  const grid = isSets ? setsGrid(m.sets, (m.sets?.length ?? 0) > 3 ? 5 : 3) : null;
  const hasScore = m.home_score != null && m.away_score != null && m.status !== 'scheduled';
  const row = (side: 'home' | 'away') => {
    const id = side === 'home' ? m.home_team_id : m.away_team_id;
    const name = teamName(m, side);
    const vals = grid ? grid[side] : [];
    return (
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamBadge team={id ? teams.get(id) : null} name={name} />
          <span className={cn('min-w-0 break-words text-sm uppercase', win === side ? 'font-extrabold' : 'font-semibold')}>{name}</span>
        </div>
        {grid && vals.map((v, i) => (
          <span key={i} className={cn('flex h-10 w-12 items-center justify-center rounded-md border text-lg tabular-nums sm:w-14',
            i === grid.current ? 'border-red-500 bg-red-50 font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200' : 'bg-muted/60')}>
            {v ?? ''}
          </span>
        ))}
      </div>
    );
  };
  return (
    <div className="space-y-4" data-testid="match-detail">
      <div className="flex flex-col items-center gap-2 text-center">
        <StatusPill status={m.status} large />
        <p className="text-5xl font-black tabular-nums" aria-label={hasScore ? `Marcador ${m.home_score} a ${m.away_score}` : 'Aún sin marcador'}>
          {hasScore ? <>{m.home_score}<span className="mx-2 text-muted-foreground">:</span>{m.away_score}</> : <span className="text-2xl text-muted-foreground">vs</span>}
        </p>
        {isSets && hasScore && <p className="text-xs uppercase text-muted-foreground">sets</p>}
      </div>
      <div className="space-y-2 rounded-xl border bg-card p-3" aria-label="Detalle por equipo">
        {row('home')}
        {row('away')}
      </div>
      <p className="text-center text-sm text-muted-foreground">{[phase, venue, m.court, formatBogota(m.scheduled_at)].filter(Boolean).join(' · ')}</p>
    </div>
  );
}
