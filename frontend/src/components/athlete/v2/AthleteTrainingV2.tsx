/**
 * Entrenos del deportista — V2 (lienzo DepEntrenos): Próximos · Plan del mes · Para la casa.
 *
 *  · Próximos: los entrenos de los próximos días (horario del equipo) y los
 *    partidos a los que está convocado (B2, si ya existe). «Ver el mes
 *    completo» lleva al Calendario, que conoce festivos y cancelaciones.
 *  · Plan del mes: el objetivo del mesociclo vigente. Hoy solo lo lee el staff
 *    (RLS de training_mesocycles): si no llega nada, la pestaña NO aparece.
 *  · Para la casa: las rutinas que el profe dejó visibles (AthleteVisibleRoutines,
 *    lo mismo que /training).
 *  · Siempre visible: «Ver todos mis entrenamientos» → /training/todo (la
 *    TrainingPage clásica: sesiones con entrenador personal, actividad libre,
 *    historial). Si hoy hay sesiones PT, un aviso arriba con acceso directo.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Dumbbell, Target, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAthleteTrainingToday } from '@/hooks/useAthleteData';
import { cn } from '@/lib/utils';
import { AthleteVisibleRoutines } from '@/components/athlete/AthleteVisibleRoutines';
import { horaColombia } from '@/components/parent/v2/parentHomeLogic';
import { EmptyNote, InlineError } from '@/components/parent/v2/hijos/parts';
import { formatLongDate } from '@/components/parent/v2/hijos/hijosUtils';
import { entrenosProximos, etiquetaDia, profeCorto, textoPartido } from './athleteV2Model';
import { useAthleteTeams, useMyCallups, usePlanDelMes } from './useAthleteV2Data';
import { useDeportista } from './useDeportista';
import { SegmentedTabs } from './SegmentedTabs';
import { useAhora } from './useAhora';

type Tab = 'proximos' | 'plan' | 'casa';

export interface AthleteTrainingV2Props {
  /** Para pruebas. */
  hoy?: Date;
}

export function AthleteTrainingV2({ hoy }: AthleteTrainingV2Props) {
  const ahora = useAhora(hoy);
  const d = useDeportista();
  const teams = useAthleteTeams(d.userId);
  const teamIds = useMemo(() => (teams.data ?? []).map((t) => t.teamId), [teams.data]);
  const plan = usePlanDelMes(teamIds);
  const hayPlan = (plan.data?.length ?? 0) > 0;
  const [tab, setTab] = useState<Tab>('proximos');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'proximos', label: 'Próximos' },
    ...(hayPlan ? [{ value: 'plan' as const, label: 'Plan del mes' }] : []),
    { value: 'casa', label: 'Para la casa' },
  ];
  const actual: Tab = tab === 'plan' && !hayPlan ? 'proximos' : tab;

  return (
    <div className="mx-auto w-full max-w-page-narrow space-y-4 pb-nav-safe">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Entrenos</h1>
        <SegmentedTabs<Tab> tabs={tabs} value={actual} onChange={setTab} label="Entrenos" />
      </header>

      <SesionesPtHoy />

      {/* Arriba y siempre visible: ahí viven las sesiones con entrenador personal. */}
      <Button asChild variant="outline" className="h-auto min-h-touch w-full justify-between whitespace-normal rounded-2xl px-4 py-3 text-left">
        <Link to={TODOS_MIS_ENTRENAMIENTOS}>
          <span className="flex min-w-0 items-center gap-3">
            <Dumbbell className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">Ver todos mis entrenamientos</span>
              <span className="block text-xs font-normal text-muted-foreground">Sesiones con entrenador personal, actividad libre e historial</span>
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </Button>

      {actual === 'proximos' && <Proximos ahora={ahora} />}
      {actual === 'plan' && hayPlan && (
        <section className="space-y-3">
          {plan.data!.map((p) => {
            const team = teams.data?.find((t) => t.teamId === p.teamId);
            return (
              <article key={p.teamId} className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  Plan del mes · {[team?.nombre, team?.profe ? profeCorto(team.profe) : null].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-2 flex gap-2 text-base font-semibold">
                  <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  {p.objetivo}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">Del {formatLongDate(p.desde).toLowerCase()} al {formatLongDate(p.hasta).toLowerCase()}</p>
              </article>
            );
          })}
        </section>
      )}
      {actual === 'casa' && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">Lo que tu profe te dejó para hacer en la casa. Agrégalo a tu día y él lo ve.</p>
          <AthleteVisibleRoutines />
        </section>
      )}
    </div>
  );
}

/** Pantalla clásica completa (sesiones PT de hoy, actividad libre, historial, planes propios). */
const TODOS_MIS_ENTRENAMIENTOS = '/training/todo';

/**
 * Si hoy tiene sesiones con entrenador personal, se avisa ARRIBA con acceso
 * directo: esas sesiones solo se hacen en /training/todo. Misma consulta que
 * TrainingPage (useAthleteTrainingToday). Si falla o no hay, no se pinta nada.
 */
function SesionesPtHoy() {
  const today = useAthleteTrainingToday();
  const pt = (today.data?.pt_sessions ?? []) as { id?: string; name?: string | null; status?: string | null }[];
  const pendientes = pt.filter((s) => s.status !== 'completed');
  if (pt.length === 0) return null;
  const n = pendientes.length;
  return (
    <section aria-label="Sesiones con entrenador personal hoy" className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-start gap-2 text-base font-semibold leading-snug">
        <Dumbbell className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        {n === 0
          ? 'Ya hiciste tus sesiones con entrenador personal de hoy.'
          : n === 1
            ? `Hoy tienes una sesión con tu entrenador personal${pendientes[0].name ? `: ${pendientes[0].name}` : ''}.`
            : `Hoy tienes ${n} sesiones con tu entrenador personal.`}
      </p>
      <Button asChild className="min-h-touch self-start rounded-xl">
        <Link to={TODOS_MIS_ENTRENAMIENTOS}>{n === 0 ? 'Ver mis sesiones' : 'Ir a mi sesión'}</Link>
      </Button>
    </section>
  );
}

function Proximos({ ahora }: { ahora: Date }) {
  const d = useDeportista();
  const teams = useAthleteTeams(d.userId);
  const callups = useMyCallups(d.userId);

  if (teams.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Cargando tus entrenos">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }
  if (teams.isError) {
    return <InlineError message="No pudimos cargar tus entrenos. Revisa tu conexión e intenta de nuevo." onRetry={() => { void teams.refetch(); }} />;
  }

  const entrenos = entrenosProximos(teams.data ?? [], ahora);
  const porDia = new Map<string, { label: string; items: typeof entrenos }>();
  for (const e of entrenos) {
    const k = e.fecha.toDateString();
    if (!porDia.has(k)) porDia.set(k, { label: etiquetaDia(e.fecha, ahora), items: [] });
    porDia.get(k)!.items.push(e);
  }
  const partidos = callups.data && !callups.data.oculto ? callups.data.data : [];

  return (
    <div className="space-y-4">
      {callups.isError && (
        <InlineError message="No pudimos revisar tus partidos." onRetry={() => { void callups.refetch(); }} />
      )}
      {partidos.length > 0 && (
        <section aria-label="Partidos" className="space-y-1.5">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Partidos</h2>
          <div className="overflow-hidden rounded-2xl border bg-card">
            {partidos.map((p, i) => (
              <div key={p.lineupId} className={cn('flex min-h-touch items-center gap-3 px-4 py-3', i > 0 && 'border-t')}>
                <Trophy className="h-5 w-5 shrink-0 text-orange" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{p.rival ? `Contra ${p.rival}` : 'Partido'}</span>
                  <span className="block text-xs text-muted-foreground">{textoPartido(p)}</span>
                </span>
                <span className="rounded-full bg-orange/15 px-2.5 py-1 text-xs font-semibold text-foreground">
                  {p.respuesta === 'va' ? 'Vas' : p.respuesta === 'no_va' ? 'No vas' : 'Convocado'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {porDia.size === 0 ? (
        <EmptyNote icon={<CalendarDays className="h-8 w-8 opacity-40" aria-hidden />}>
          <p className="font-medium text-foreground">
            {(teams.data ?? []).length === 0 ? 'Aún no tienes un equipo con horario.' : 'No tienes entrenos en los próximos días.'}
          </p>
          <p className="mt-1">Cuando la escuela programe el siguiente, aparece aquí.</p>
        </EmptyNote>
      ) : (
        [...porDia.values()].map((g) => (
          <section key={g.label} aria-label={g.label} className="space-y-1.5">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {g.items.map((e, i) => (
                <div key={e.key} className={cn('flex min-h-touch items-center gap-3 px-4 py-3', i > 0 && 'border-t')}>
                  <span className="w-20 shrink-0 text-sm font-semibold tabular-nums">{horaColombia(e.hora)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{e.equipo}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[e.lugar, e.profe ? profeCorto(e.profe) : null, e.fin ? `hasta ${horaColombia(e.fin)}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="flex flex-col gap-1">
        <Link to="/calendar" className="flex min-h-touch items-center justify-center gap-1 text-sm font-semibold text-primary">
          Ver el mes completo <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link to="/my-event-registrations" className="flex min-h-touch items-center justify-center gap-1 text-sm font-semibold text-primary">
          Mis torneos y eventos <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export default AthleteTrainingV2;
