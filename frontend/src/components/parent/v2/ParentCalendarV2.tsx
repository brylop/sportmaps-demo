/**
 * Calendario del acudiente — rediseño V2 (tablero «Acudiente · Calendario»).
 * Dos pestañas: Próximos (entrenos, partidos, torneos y avisos de todos los
 * hijos, por día) y Torneos (inscritos y con inscripción abierta).
 * Lo renderiza CalendarPage SOLO para el rol `parent`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarX2, Radio, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import {
  AgendaItem,
  buildAgenda,
  groupByDay,
  longDate,
  timeParts,
} from './parentCalendarModel';
import {
  AGENDA_DAYS,
  OpenTournamentForChild,
  RegisteredTournament,
  useParentAgenda,
  useParentTournaments,
} from './useParentCalendarData';

type Tab = 'proximos' | 'torneos' | 'mes';

/**
 * `vistaMes`: el calendario mensual de siempre (cuadrícula y «Nuevo evento»).
 * La V2 no le quita al acudiente nada que ya tenía en producción: queda como
 * tercera pestaña.
 */
export default function ParentCalendarV2({ vistaMes }: { vistaMes?: ReactNode } = {}) {
  const [tab, setTab] = useState<Tab>('proximos');
  const TABS: { id: Tab; label: string }[] = [
    { id: 'proximos', label: 'Próximos' },
    { id: 'torneos', label: 'Torneos' },
    ...(vistaMes ? [{ id: 'mes' as const, label: 'Mes' }] : []),
  ];
  const agenda = useParentAgenda();
  const tournaments = useParentTournaments(agenda.data?.children);

  return (
    <div className={cn('mx-auto w-full space-y-4', tab === 'mes' ? 'max-w-page-wide' : 'max-w-page-narrow')}>
      <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>

      <div role="tablist" aria-label="Calendario" className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`acu-cal-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`acu-cal-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'min-h-touch flex-1 rounded-lg text-sm transition-colors motion-safe:active:scale-[0.97]',
                selected ? 'bg-background font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`acu-cal-panel-${tab}`} aria-labelledby={`acu-cal-tab-${tab}`}>
        {tab === 'mes' ? (
          vistaMes
        ) : tab === 'proximos' ? (
          <ProximosPanel
            loading={agenda.isLoading}
            error={agenda.isError}
            onRetry={() => agenda.refetch()}
            data={agenda.data}
          />
        ) : (
          <TorneosPanel
            loading={agenda.isLoading || tournaments.isLoading}
            error={agenda.isError || tournaments.isError}
            onRetry={() => (agenda.isError ? agenda.refetch() : tournaments.refetch())}
            registered={tournaments.data?.registered ?? []}
            open={tournaments.data?.open ?? []}
          />
        )}
      </div>
    </div>
  );
}

// ─── Estados compartidos ─────────────────────────────────────────────────────
function LoadingList() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );
}

function ErrorState({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      <p className="text-sm font-medium">{text}</p>
      <Button variant="outline" className="min-h-touch gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Intentar de nuevo
      </Button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-semibold">{title}</p>
      {text && <p className="max-w-prose-ui text-xs text-muted-foreground">{text}</p>}
    </div>
  );
}

// ─── Próximos ────────────────────────────────────────────────────────────────
function ProximosPanel({
  loading, error, onRetry, data,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  data: ReturnType<typeof useParentAgenda>['data'];
}) {
  const days = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    return groupByDay(buildAgenda({ ...data, now, days: AGENDA_DAYS }), now);
  }, [data]);

  if (loading) return <LoadingList />;
  if (error) return <ErrorState text="No pudimos cargar el calendario." onRetry={onRetry} />;
  if (days.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No hay nada en las próximas dos semanas"
        text={data && data.children.length === 0
          ? 'Cuando tus hijos estén en un equipo, aquí verás sus entrenos y partidos.'
          : 'Cuando la escuela o el profe publiquen algo, aparece aquí.'}
      />
    );
  }

  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.dayKey} aria-label={d.label} className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{d.label}</h2>
          <ul className="space-y-2">
            {d.items.map((it) => <AgendaRow key={it.key} item={it} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

const TAG_STYLES: Record<string, string> = {
  Partido: 'bg-primary/10 text-primary',
  Torneo: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Tuyo: 'bg-muted text-muted-foreground',
};

function AgendaRow({ item }: { item: AgendaItem }) {
  const { time, period } = timeParts(item.start);
  return (
    <li
      className={cn(
        'flex min-h-touch items-center gap-3 rounded-2xl border bg-card px-3.5 py-3',
        item.kind === 'notice' && 'border-dashed bg-muted/40',
      )}
    >
      <div className="flex w-14 shrink-0 flex-col leading-tight">
        {item.allDay ? (
          <span className="text-base font-bold text-muted-foreground" aria-label="Todo el día">—</span>
        ) : (
          <>
            <span className="text-base font-bold">{time}</span>
            <span className="text-xs font-medium text-muted-foreground">{period}</span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{item.title}</p>
        {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
        {item.note && <p className="mt-0.5 text-xs font-medium text-foreground/80">{item.note}</p>}
      </div>
      {item.tag && (
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', TAG_STYLES[item.tag] ?? 'bg-muted text-muted-foreground')}>
          {item.tag}
        </span>
      )}
    </li>
  );
}

// ─── Torneos ─────────────────────────────────────────────────────────────────
function registrationBadge(r: RegisteredTournament): { text: string; className: string } {
  if (r.paymentStatus === 'pending' && r.status !== 'approved') {
    return { text: 'Falta el pago', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' };
  }
  if (r.status === 'pending') return { text: 'Inscripción en revisión', className: 'bg-muted text-muted-foreground' };
  return { text: 'Inscripción lista', className: 'bg-primary/10 text-primary' };
}

function TorneosPanel({
  loading, error, onRetry, registered, open,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  registered: RegisteredTournament[];
  open: OpenTournamentForChild[];
}) {
  if (loading) return <LoadingList />;
  if (error) return <ErrorState text="No pudimos cargar los torneos." onRetry={onRetry} />;

  return (
    <div className="space-y-3">
      {registered.length === 0 && open.length === 0 && (
        <EmptyState icon={Trophy} title="No hay torneos por ahora" />
      )}

      {registered.map((r) => {
        const badge = registrationBadge(r);
        const fecha = longDate(r.eventDate);
        return (
          <article key={r.registrationId} className="space-y-2 rounded-2xl border bg-card p-4">
            <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', badge.className)}>{badge.text}</span>
            <h3 className="text-base font-semibold leading-snug">{r.title}</h3>
            <p className="text-sm text-muted-foreground">{[r.childName, fecha].filter(Boolean).join(' · ')}</p>
            {r.liveUrl && (
              <Button asChild variant="outline" className="min-h-touch w-full gap-2">
                <Link to={r.liveUrl}>
                  <Radio className="h-4 w-4" aria-hidden />
                  Ver partidos y tabla en vivo
                </Link>
              </Button>
            )}
          </article>
        );
      })}

      {open.map((o) => {
        const fecha = longDate(o.eventDate);
        const hasta = longDate(o.priceUntil);
        const precio = o.price === null ? null : o.price === 0 ? 'Gratis' : formatCurrency(o.price);
        const label = o.childName
          ? `Inscribir a ${o.childName}${precio ? ` · ${precio}` : ''}`
          : 'Ver inscripción';
        return (
          <article key={`${o.eventId}-${o.childId ?? 'x'}`} className="space-y-2 rounded-2xl border bg-card p-4">
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Inscripciones abiertas</span>
            <h3 className="text-base font-semibold leading-snug">{o.title}</h3>
            <p className="text-sm text-muted-foreground">
              {[o.childName, fecha, hasta ? `precio hasta el ${hasta}` : null].filter(Boolean).join(' · ')}
            </p>
            <Button asChild className="min-h-touch w-full">
              <Link to={`/tournaments/${o.eventId}/register`}>{label}</Link>
            </Button>
          </article>
        );
      })}

      <p className="px-1 pt-1 text-center text-xs text-muted-foreground">
        Cuando la escuela inscribe al equipo, el torneo aparece aquí solo.
      </p>
    </div>
  );
}
