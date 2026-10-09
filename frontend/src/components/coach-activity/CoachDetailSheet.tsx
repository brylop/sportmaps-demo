/**
 * Detalle de un entrenador en "Seguimiento deportivo" (solo lectura):
 * mesociclo vigente + serie de 8 semanas arriba, y pestañas
 * Sesiones · Asistencia · Evaluaciones · Documentos.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ClipboardList, FileText, Users, Star } from 'lucide-react';
import { SessionViewer } from '@/components/school/SessionViewer';
import { dayToLocalDate } from '@/lib/dateUtils';
import { CoachWeeksChart } from './CoachWeekChart';
import { StatusBadge } from './CoachCard';
import { lastActivityText } from './format';
import { STATUS_META, type CoachActivity, type CoachSessionItem } from './types';

const dayLabel = (ymd: string) => format(dayToLocalDate(ymd), "EEEE d 'de' MMMM", { locale: es });

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function adherenceTone(pct: number | null): string {
  // Semáforo fijo del rediseño: verde ≥ 80 %, ámbar 60-79 %, rojo < 60 %.
  if (pct === null) return 'text-muted-foreground';
  if (pct >= 80) return 'text-green-700 dark:text-green-400';
  if (pct >= 60) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

export function CoachDetailSheet({ coach, onClose }: { coach: CoachActivity | null; onClose: () => void }) {
  const [viewing, setViewing] = useState<CoachSessionItem | null>(null);

  return (
    <>
      <Sheet open={!!coach} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-4 sm:p-6">
          {coach && (
            <div className="space-y-4">
              <SheetHeader className="text-left space-y-1">
                <SheetTitle className="pr-6 leading-snug">{coach.full_name}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={coach.status} />
                    <span className="text-xs">{STATUS_META[coach.status].hint}</span>
                  </div>
                </SheetDescription>
                <p className="text-xs text-muted-foreground">{lastActivityText(coach.last_activity_at)}</p>
              </SheetHeader>

              {coach.mesocycles.length > 0 && (
                <div className="space-y-2">
                  {coach.mesocycles.map((m) => (
                    <div key={m.id} className="rounded-xl border bg-card p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">Mesociclo · {m.team_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(dayToLocalDate(m.starts_on), 'd MMM', { locale: es })} – {format(dayToLocalDate(m.ends_on), 'd MMM', { locale: es })}
                        </p>
                      </div>
                      {m.general_objective && <p className="mt-1 text-xs text-muted-foreground break-words">{m.general_objective}</p>}
                      <p className="mt-1 text-sm">
                        {m.adherence_pct === null ? (
                          <span className="text-muted-foreground">Todavía no vence ninguna sesión planificada.</span>
                        ) : (
                          <>
                            <span className={`text-lg font-extrabold ${adherenceTone(m.adherence_pct)}`}>{m.adherence_pct}%</span>{' '}
                            de cumplimiento: {m.done_to_date} de {m.planned_to_date} sesiones planificadas ya tienen lista
                            {m.planned_total > 0 && <span className="text-muted-foreground"> (el plan tiene {m.planned_total})</span>}.
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">Verde 80 % o más · Ámbar 60-79 % · Rojo menos de 60 %</p>
                </div>
              )}

              <CoachWeeksChart weekly={coach.weekly} name={coach.full_name} />

              <Tabs defaultValue="sesiones" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-auto">
                  <TabsTrigger value="sesiones" className="text-xs px-1 py-1.5">Sesiones</TabsTrigger>
                  <TabsTrigger value="asistencia" className="text-xs px-1 py-1.5">Asistencia</TabsTrigger>
                  <TabsTrigger value="evaluaciones" className="text-xs px-1 py-1.5">Evaluaciones</TabsTrigger>
                  <TabsTrigger value="documentos" className="text-xs px-1 py-1.5">Documentos</TabsTrigger>
                </TabsList>

                <TabsContent value="sesiones" className="space-y-2 pt-2">
                  {coach.sessions.length === 0 ? (
                    <Empty>No hay sesiones planificadas esta semana para sus equipos.</Empty>
                  ) : coach.sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setViewing(s)}
                      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent
                                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{dayLabel(s.session_date)}</p>
                        <p className="text-xs text-muted-foreground break-words">
                          {s.team_name}
                          {s.blocks > 0 && ` · ${s.blocks} bloque${s.blocks === 1 ? '' : 's'}`}
                          {s.created_by_name && !s.created_by_coach && ` · la creó ${s.created_by_name}`}
                        </p>
                        {s.objective && <p className="text-xs break-words line-clamp-2">{s.objective}</p>}
                      </div>
                      {s.in_mesocycle && <Badge variant="secondary" className="shrink-0 text-[10px]">Mesociclo</Badge>}
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </TabsContent>

                <TabsContent value="asistencia" className="space-y-2 pt-2">
                  {coach.attendance.length === 0 ? (
                    <Empty>No tomó lista esta semana.</Empty>
                  ) : coach.attendance.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                      <Users className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{dayLabel(a.session_date)}</p>
                        <p className="text-xs text-muted-foreground break-words">{a.team_name}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm">
                        <span className="font-bold tabular-nums">{a.present}</span>
                        <span className="text-muted-foreground"> de {a.total} vinieron</span>
                      </p>
                    </div>
                  ))}
                  <Link to="/attendance-history" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Ver el histórico de asistencia <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </TabsContent>

                <TabsContent value="evaluaciones" className="space-y-2 pt-2">
                  {coach.evaluations_by_day.length === 0 && coach.mesocycle_evaluations_week === 0 ? (
                    <Empty>{coach.has_account ? 'No registró evaluaciones esta semana.' : 'No tiene cuenta en la app: no hay evaluaciones a su nombre.'}</Empty>
                  ) : (
                    <>
                      <p className="text-sm">
                        Evaluó a <span className="font-bold">{coach.evaluations_week.athletes}</span> deportista{coach.evaluations_week.athletes === 1 ? '' : 's'}
                        {' '}({coach.evaluations_week.entries} registro{coach.evaluations_week.entries === 1 ? '' : 's'}).
                      </p>
                      {coach.evaluations_by_day.map((d) => (
                        <div key={d.date} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                          <Star className="h-4 w-4 shrink-0 text-amber-500" />
                          <p className="min-w-0 flex-1 text-sm font-medium capitalize">{dayLabel(d.date)}</p>
                          <p className="shrink-0 text-sm">
                            <span className="font-bold tabular-nums">{d.athletes}</span>
                            <span className="text-muted-foreground"> deportista{d.athletes === 1 ? '' : 's'}</span>
                          </p>
                        </div>
                      ))}
                      {coach.mesocycle_evaluations_week > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Además calificó {coach.mesocycle_evaluations_week} indicador{coach.mesocycle_evaluations_week === 1 ? '' : 'es'} de la rúbrica del mesociclo.
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="documentos" className="space-y-2 pt-2">
                  {/* TODO(F6): mostrar acá MesocycleDocuments (solo lectura) del
                      mesociclo vigente cuando la migración 20261008154654
                      (training_mesocycle_documents + bucket) esté aplicada. Hasta
                      entonces, se enlaza al mesociclo en Métricas y Rendimiento. */}
                  <div className="rounded-lg border border-dashed px-3 py-6 text-center">
                    <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Los documentos se adjuntan al mesociclo de cada equipo.
                    </p>
                    {coach.mesocycles.length > 0 ? (
                      <Link to="/training-plans" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        Abrir el mesociclo de {coach.mesocycles.map((m) => m.team_name).join(', ')} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Sin mesociclo vigente esta semana.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <SessionViewer
        open={!!viewing}
        onClose={() => setViewing(null)}
        sessionId={viewing?.id ?? null}
        teamId={viewing?.team_id ?? ''}
        teamName={viewing?.team_name ?? ''}
        createdByName={viewing?.created_by_name}
      />
    </>
  );
}
