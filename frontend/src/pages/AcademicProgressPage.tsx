/**
 * Progreso de un hijo — acudiente V2 (/children/:id/progress y
 * /academic-progress?childId=…).
 *
 * Lo principal sale de las MISMAS fuentes que la pestaña Progreso de Hijos
 * (parent/v2/hijos/useHijosData): performance_entries vía el BFF
 * (/athlete/performance/{entries,evolution}) y el último informe mensual.
 *
 *   1. Cómo le fue en los últimos entrenos (lo califica el profe o, si no,
 *      la autoevaluación del deportista).
 *   2. En qué va mejorando (todas sus habilidades medidas) + consejo del profe.
 *   3. Gráficas por medición (PerformanceEvolutionSection), plegado.
 *   4. Entrenador personal (sesiones, récords, bienestar), solo si tiene.
 *   5. Evaluaciones anteriores (`academic_progress`, tabla legada casi vacía
 *      que da 403 para algunos hijos): solo si trae filas; si falla, no se ve.
 *   6. Rutinas que el profe dejó visibles (plegadas; solo si hay).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronRight, Clock as ClockIcon, Lightbulb, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { bffClient } from '@/lib/api/bffClient';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AthleteVisibleRoutines } from '@/components/athlete/AthleteVisibleRoutines';
import { WellnessModule } from '@/components/wellness/WellnessModule';
import { PerformanceEvolutionSection } from '@/components/performance/PerformanceEvolutionSection';
import { useChildExerciseStats } from '@/hooks/useAthleteData';
import { groupPRsByMuscle, getDisplayName, MUSCLE_GROUP_CONFIG, type MuscleGroup } from '@/lib/trainer/muscleGroups';
import {
  useChildPerformanceEntries,
  useChildPerformanceEvolution,
  useChildReports,
  useLatestReportSnapshot,
} from '@/components/parent/v2/hijos/useHijosData';
import {
  firstName,
  formatLongDate,
  recentSessions,
  skillRows,
  skillRowsFromSnapshot,
  type SessionRating,
} from '@/components/parent/v2/hijos/hijosUtils';
import { EmptyNote, InlineError, Pill, Row, Section, SectionSkeleton, type Tone } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, PaginaHijo, SelectorHijo, VerMas } from '@/components/parent/hijo-detalle/HijoDetalle';
import { useHijosDelAcudiente } from '@/components/parent/hijo-detalle/useHijoDetalle';
import { plural } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

const RATING_TONE: Record<SessionRating, Tone> = { Bien: 'good', Normal: 'neutral', 'Le costó': 'bad' };

const BLOCK_TYPE_LABEL: Record<string, string> = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  hiit: 'Intervalos',
  flexibility: 'Flexibilidad',
  warmup: 'Calentamiento',
  cooldown: 'Vuelta a la calma',
};

interface PtSession {
  id: string;
  name: string;
  status: string;
  session_date: string;
  trainer_name: string;
  trainer_id: string;
  blocks?: any[];
  results?: {
    blocks_results?: any[];
    performance_note?: string;
    actual_duration_minutes?: number;
  };
}

interface AcademicProgressRow {
  id: string;
  skill_name: string;
  skill_level: number;
  comments: string | null;
  evaluation_date: string;
}

// ── Detalle de una sesión con entrenador personal ────────────────────────────

function SessionDetailModal({ session, onClose }: { session: PtSession | null; onClose: () => void }) {
  if (!session) return null;
  const blocks = session.blocks ?? [];
  const blocksResults = session.results?.blocks_results ?? [];
  const note = session.results?.performance_note;
  const duration = session.results?.actual_duration_minutes;
  const getResult = (idx: number) => blocksResults.find((r: any) => r.block_index === idx);

  return (
    <Dialog open={!!session} onOpenChange={onClose}>
      <DialogContent className="max-h-sheet max-w-modal overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{session.name}</DialogTitle>
          <DialogDescription>
            {formatLongDate(session.session_date)} · {session.trainer_name}
            {duration ? ` · ${duration} min` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {note && (
            <div className="flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>
                <span className="font-semibold">Lo que dijo el entrenador: </span>
                {note}
              </p>
            </div>
          )}

          {blocks.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border">
              {blocks.map((block: any, idx: number) => {
                const result = getResult(idx);
                const completed = result?.completed ?? false;
                const detalle = [
                  BLOCK_TYPE_LABEL[block.type] ?? block.type,
                  block.sets && `${block.sets} series`,
                  block.reps && `${block.reps} repeticiones`,
                  block.duration_minutes && `${block.duration_minutes} min`,
                ].filter(Boolean).join(' · ');
                return (
                  <div key={idx} className="border-t px-4 py-3 first:border-t-0">
                    <div className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{block.name}</span>
                        {detalle && <span className="block text-xs text-muted-foreground">{detalle}</span>}
                      </span>
                      <Pill tone={completed ? 'good' : 'neutral'}>{completed ? 'Hecho' : 'Sin hacer'}</Pill>
                    </div>
                    {result && block.type === 'strength' && (result.actual_weight || result.actual_reps) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.actual_weight && <>Peso: <span className="font-semibold text-foreground">{result.actual_weight}</span></>}
                        {result.actual_weight && result.actual_reps && ' · '}
                        {result.actual_reps && <>Repeticiones: <span className="font-semibold text-foreground">{result.actual_reps}</span></>}
                      </p>
                    )}
                    {result?.actual_rpe && block.type === 'hiit' && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        ¿Qué tan duro fue?: <span className="font-semibold text-foreground">{result.actual_rpe} de 10</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Esta sesión no tiene ejercicios cargados.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Récords personales por grupo muscular ────────────────────────────────────

const UNIT_SUFFIX: Record<string, string> = { kg: 'kg', min: 'min', rpe: 'de 10', rep: 'rep.' };

function RecordsPersonales({ childId }: { childId: string }) {
  const { data: exerciseStats, isLoading } = useChildExerciseStats(childId, 90);
  const [selected, setSelected] = useState('');
  const prs = exerciseStats?.prs ?? [];

  if (isLoading) return <SectionSkeleton rows={2} label="Cargando los récords" />;
  if (prs.length === 0) {
    return <p className="text-sm text-muted-foreground">Cuando complete sesiones con su entrenador, aquí verás sus mejores marcas.</p>;
  }

  const grouped = groupPRsByMuscle(prs);
  const series = selected ? exerciseStats?.evolution[selected] ?? [] : [];
  const chartData = series.map((e) => ({
    fecha: new Date(`${e.date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
    valor: e.value,
    unit: e.unit,
  }));

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([group, groupPrs]) => {
        const cfg = MUSCLE_GROUP_CONFIG[group as MuscleGroup];
        return (
          <div key={group}>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">{cfg.label}</p>
            <div className="overflow-hidden rounded-xl border">
              {groupPrs.map((pr) => {
                const sel = selected === pr.stat_type;
                return (
                  <button
                    key={pr.stat_type}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setSelected(sel ? '' : pr.stat_type)}
                    className={cn(
                      'flex min-h-touch w-full items-center gap-3 border-t px-3 py-2 text-left transition-colors first:border-t-0 hover:bg-muted/50',
                      sel && 'bg-primary/5',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{getDisplayName(pr.stat_type)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {plural(pr.total_sets, 'registro', 'registros')}
                        {pr.pr_date && ` · mejor marca el ${formatLongDate(pr.pr_date).toLowerCase()}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {pr.best_value} <span className="text-xs font-normal text-muted-foreground">{UNIT_SUFFIX[pr.unit] ?? pr.unit}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {selected && (
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Cómo ha ido · {getDisplayName(selected)}</p>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted-foreground">Hacen falta al menos dos sesiones con este ejercicio para ver la gráfica.</p>
          ) : (
            <div className="h-chart-sm">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={32} />
                  <RechartTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      background: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                      border: '1px solid hsl(var(--border))',
                    }}
                    formatter={(val: any) => [`${val} ${chartData[0]?.unit ?? ''}`, getDisplayName(selected)]}
                  />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
      {!selected && <p className="text-xs text-muted-foreground">Toca un ejercicio para ver cómo ha ido.</p>}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function AcademicProgressPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedSession, setSelectedSession] = useState<PtSession | null>(null);

  const hijos = useHijosDelAcudiente();
  const pedido = id || searchParams.get('childId') || '';
  const childId = pedido || hijos.data?.[0]?.id || '';
  const hijo = hijos.data?.find((h) => h.id === childId) ?? null;
  const nombre = hijo ? firstName(hijo.full_name) : 'tu hijo';

  // Al cambiar de hijo, cerrar cualquier detalle abierto del anterior.
  useEffect(() => setSelectedSession(null), [childId]);

  const elegir = (next: string) => {
    if (id) navigate(`/children/${next}/progress`, { replace: true });
    else setSearchParams({ childId: next }, { replace: true });
  };

  // Lo principal: las mismas lecturas que la pestaña Progreso.
  const entries = useChildPerformanceEntries(childId || undefined);
  const evolution = useChildPerformanceEvolution(childId || undefined);
  const reports = useChildReports(childId || undefined);
  const snapshot = useLatestReportSnapshot(reports.data?.[0]?.id);

  // Legado: evaluaciones de `academic_progress`. Secundario y silencioso.
  const legacy = useQuery({
    queryKey: ['academic-progress', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_progress')
        .select('id, skill_name, skill_level, comments, evaluation_date')
        .eq('child_id', childId)
        .order('evaluation_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcademicProgressRow[];
    },
    enabled: !!childId,
    retry: false,
  });

  // Entrenador personal (con bloques y resultados para el detalle).
  const pt = useQuery({
    queryKey: ['child-pt-sessions-full', childId],
    queryFn: async (): Promise<PtSession[]> => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id, blocks, results')
        .eq('client_id', childId)
        .order('session_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const trainerIds = [...new Set(data.map((s: any) => s.trainer_id).filter(Boolean))];
      const { data: profiles } = await (supabase as any)
        .from('trainer_profiles')
        .select('user_id, display_name')
        .in('user_id', trainerIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      return data.map((s: any) => ({ ...s, trainer_name: profileMap.get(s.trainer_id) ?? 'Entrenador' }));
    },
    enabled: !!childId,
    retry: false,
  });

  // Solo para saber si hay rutinas visibles: la biblioteca completa (compartida
  // con otras pantallas) se abre plegada para no tapar el progreso.
  const routines = useQuery({
    queryKey: ['hijo-detalle-rutinas', childId],
    queryFn: async () => {
      const data = await bffClient.get<unknown>(`/api/v1/athlete/training/routines-visible?child_id=${childId}`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!childId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const ptSessions = pt.data ?? [];
  const hasPT = ptSessions.length > 0;
  const ptDone = ptSessions.filter((s) => s.status === 'completed').length;

  const sessions = recentSessions(entries.data, 8);
  let skills = skillRows(evolution.data?.metrics, evolution.data?.evolution, 50);
  if (skills.length === 0) skills = skillRowsFromSnapshot(snapshot.data?.snapshot?.metrics, 50);
  const snap = snapshot.data?.snapshot;
  const coachNote = snap?.coach_note?.trim() || null;
  const toWorkOn = (snap?.to_work_on ?? []).map((m) => m.label).filter(Boolean).slice(0, 2);
  const hayGraficas = (evolution.data?.metrics?.length ?? 0) > 0;
  const legacyRows = (legacy.data ?? []).filter((item, i, self) => i === self.findIndex((t) => t.skill_name === item.skill_name));

  const mejoras = skills.filter((s) => s.improved === true).length;
  const frase =
    skills.length > 0
      ? mejoras > 0
        ? `${nombre} mejoró en ${plural(mejoras, 'habilidad', 'habilidades')} desde la medición anterior.`
        : `El profe ha medido ${plural(skills.length, 'habilidad', 'habilidades')} de ${nombre}.`
      : `Aquí verás cómo va ${nombre} en los entrenos.`;

  const principal = () => {
    if (hijos.isLoading || entries.isLoading || evolution.isLoading) {
      return <SectionSkeleton rows={4} label="Cargando el progreso" />;
    }
    if (hijos.isError && !pedido) {
      return <InlineError message="No pudimos cargar a tus hijos. Revisa tu conexión e intenta de nuevo." onRetry={() => hijos.refetch()} />;
    }
    if (!childId) {
      return (
        <EmptyNote icon={<TrendingUp className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no tienes hijos registrados.</p>
          <p className="mt-1">Agrégalos en la pestaña Hijos para ver su progreso.</p>
        </EmptyNote>
      );
    }
    const reintentar = () => {
      entries.refetch();
      evolution.refetch();
    };
    if (entries.isError && evolution.isError) {
      return <InlineError message={`No pudimos cargar el progreso de ${nombre}. Revisa tu conexión e intenta de nuevo.`} onRetry={reintentar} />;
    }
    const nothing = sessions.rows.length === 0 && skills.length === 0 && !coachNote && toWorkOn.length === 0;
    const parcial = entries.isError || evolution.isError;
    // Si una lectura falló, «no hay evaluaciones» sería mentira.
    if (nothing && parcial) {
      return <InlineError message={`No pudimos cargar todo el progreso de ${nombre}. Revisa tu conexión e intenta de nuevo.`} onRetry={reintentar} />;
    }
    if (nothing) {
      return (
        <EmptyNote icon={<TrendingUp className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no hay evaluaciones de {nombre}.</p>
          <p className="mt-1">Cuando el profe califique un entreno o mida una habilidad, lo verás aquí.</p>
        </EmptyNote>
      );
    }

    return (
      <>
        {parcial && <InlineError message="Una parte del progreso no cargó. Lo que ves puede estar incompleto." onRetry={reintentar} />}

        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <Section title="Cómo le fue en los últimos entrenos">
            {sessions.rows.length === 0 ? (
              <p className="px-4 pb-4 pt-1 text-sm text-muted-foreground">El profe todavía no ha calificado entrenos.</p>
            ) : (
              <>
                {sessions.source === 'self' && (
                  <p className="px-4 pb-1 text-xs text-muted-foreground">Según cómo se sintió {nombre} al terminar.</p>
                )}
                <div className="mt-1">
                  {sessions.rows.map((s) => (
                    <Row key={s.date}>
                      <span className="min-w-0 flex-1 truncate text-sm">{formatLongDate(s.date)}</span>
                      <Pill tone={RATING_TONE[s.rating]}>{s.rating}</Pill>
                    </Row>
                  ))}
                </div>
              </>
            )}
          </Section>

          <Section title="En qué va mejorando">
            {skills.length === 0 ? (
              <p className="px-4 pb-4 pt-1 text-sm text-muted-foreground">Todavía no hay habilidades medidas.</p>
            ) : (
              <ul className="space-y-4 px-4 pb-4 pt-2">
                {skills.map((s) => (
                  <li key={s.key}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0">{s.label}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{s.valueLabel}</span>
                        {s.deltaLabel && (
                          <span
                            className={cn(
                              'ml-2 text-xs font-semibold',
                              s.improved === true && 'text-green-700 dark:text-green-400',
                              s.improved === false && 'text-muted-foreground',
                            )}
                          >
                            {s.deltaLabel}
                          </span>
                        )}
                      </span>
                    </div>
                    {s.score !== null && (
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(s.score / 5) * 100}%` }} />
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">Última medición: {formatLongDate(s.lastDate.slice(0, 10)).toLowerCase()}</p>
                  </li>
                ))}
              </ul>
            )}
            {(coachNote || toWorkOn.length > 0) && (
              <div className="mx-4 mb-4 flex gap-2 rounded-xl bg-primary/5 p-3 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p>
                  {coachNote ? (
                    <>
                      <span className="font-semibold">Consejo del profe: </span>
                      {coachNote}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Para trabajar en casa: </span>
                      {toWorkOn.join(' y ').toLowerCase()}.
                    </>
                  )}
                </p>
              </div>
            )}
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">Solo se compara con su propio avance. Nunca con otros niños.</p>
          </Section>
        </div>

        {hayGraficas && (
          <VerMas titulo="Ver las gráficas de cada medición" sub="El detalle de todo lo que el profe ha medido, mes a mes">
            <PerformanceEvolutionSection childId={childId} title={`Mediciones de ${nombre}`} description="Toca una para ver cómo ha cambiado." />
          </VerMas>
        )}
      </>
    );
  };

  return (
    <PaginaHijo wide>
      <SelectorHijo hijos={hijos.data ?? []} selectedId={childId} onSelect={elegir} />
      <CabeceraHijo hijo={hijo} titulo={hijo ? `Progreso de ${nombre}` : 'Progreso'} sub={frase} />

      {principal()}

      {childId && hasPT && (
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <Section title="Con entrenador personal">
            <p className="px-4 text-xs text-muted-foreground">
              {ptDone} de {plural(ptSessions.length, 'sesión', 'sesiones')} hechas. Toca una hecha para ver el detalle.
            </p>
            <div className="mt-1">
              {ptSessions.map((s) => {
                const done = s.status === 'completed';
                const contenido = (
                  <>
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', done ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' : 'bg-muted text-muted-foreground')}>
                      {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ClockIcon className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.trainer_name} · {formatLongDate(s.session_date)}
                      </span>
                    </span>
                    {done ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Pill tone="neutral">Pendiente</Pill>}
                  </>
                );
                return done ? (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSession(s)}
                    className="flex min-h-touch w-full items-center gap-3 border-t px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-muted/50"
                  >
                    {contenido}
                  </button>
                ) : (
                  <div key={s.id} className="flex min-h-touch items-center gap-3 border-t px-4 py-2.5 first:border-t-0">
                    {contenido}
                  </div>
                );
              })}
            </div>
          </Section>

          <div className="space-y-4">
            <Section title="Mejores marcas">
              <div className="p-4 pt-2">
                <RecordsPersonales childId={childId} />
              </div>
            </Section>
            <VerMas titulo="Bienestar y medidas" sub="Lo que registra su entrenador personal">
              <WellnessModule clientId={childId} clientName={hijo?.full_name} isTrainer={false} />
            </VerMas>
          </div>
        </div>
      )}

      {childId && legacyRows.length > 0 && (
        <VerMas titulo="Evaluaciones anteriores" sub={plural(legacyRows.length, 'habilidad evaluada', 'habilidades evaluadas')}>
          <ul className="space-y-4">
            {legacyRows.map((item) => (
              <li key={item.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0">{item.skill_name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{item.skill_level} %</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, item.skill_level))}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatLongDate(item.evaluation_date.slice(0, 10))}
                  {item.comments ? ` · «${item.comments}»` : ''}
                </p>
              </li>
            ))}
          </ul>
        </VerMas>
      )}

      {childId && (routines.data?.length ?? 0) > 0 && (
        <VerMas titulo="Rutinas que compartió el profe" sub={`${plural(routines.data!.length, 'rutina', 'rutinas')} para consultar en casa`}>
          <AthleteVisibleRoutines childId={childId} />
        </VerMas>
      )}

      <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
    </PaginaHijo>
  );
}
