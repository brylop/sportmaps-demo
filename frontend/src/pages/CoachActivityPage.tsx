/**
 * Seguimiento deportivo (/seguimiento-deportivo) — vista del dueño/admin.
 *
 * Spec docs/specs/rediseno-seguimiento-deportivo.md (F4). Solo lectura: qué
 * hizo cada entrenador en la semana (planificó, tomó lista, evaluó), con
 * semáforo en palabras. Todo sale de UNA llamada al BFF
 * (GET /api/v1/school/coach-activity), no de N consultas desde el cliente.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ClipboardCheck, Loader2, AlertTriangle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { dayToLocalDate } from '@/lib/dateUtils';
import { WhoWorkedChart } from '@/components/coach-activity/CoachWeekChart';
import { CoachCard } from '@/components/coach-activity/CoachCard';
import { CoachDetailSheet } from '@/components/coach-activity/CoachDetailSheet';
import { STATUS_META, getCoachActivity, type CoachStatus } from '@/components/coach-activity/types';

const toYmd = (d: Date) => format(d, 'yyyy-MM-dd');
const currentMonday = () => toYmd(startOfWeek(new Date(), { weekStartsOn: 1 }));

export default function CoachActivityPage() {
  const { schoolId } = useSchoolContext();
  const thisWeek = useMemo(currentMonday, []);
  const [week, setWeek] = useState(thisWeek);
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['coach-activity', schoolId, week],
    queryFn: () => getCoachActivity(week),
    enabled: !!schoolId,
    staleTime: 60 * 1000,
  });

  const shiftWeek = (delta: number) => setWeek((w) => toYmd(addDays(dayToLocalDate(w), delta * 7)));
  const monday = dayToLocalDate(week);
  const rangeLabel = `${format(monday, 'd MMM', { locale: es })} – ${format(addDays(monday, 6), 'd MMM yyyy', { locale: es })}`;
  const openCoach = data?.coaches.find((c) => c.staff_id === openStaffId) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4 sm:px-6 animate-in fade-in duration-500">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          Seguimiento deportivo
        </h1>
        <p className="text-sm text-muted-foreground">
          Qué hizo cada entrenador en la semana: sesiones planificadas, listas tomadas y evaluaciones.
        </p>
      </header>

      {/* Selector de semana */}
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-2 py-2">
        <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => shiftWeek(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 text-center">
          <p className="font-semibold capitalize">{rangeLabel}</p>
          {week === thisWeek ? (
            <p className="text-xs text-muted-foreground">Esta semana</p>
          ) : (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setWeek(thisWeek)}>
              Volver a esta semana
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" aria-label="Semana siguiente" disabled={week >= thisWeek} onClick={() => shiftWeek(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <p className="text-sm">No se pudo cargar el seguimiento de esta semana.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>Reintentar</Button>
        </div>
      ) : data.coaches.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          La escuela no tiene entrenadores activos. Agrégalos en <Link to="/staff" className="text-primary hover:underline">Entrenadores</Link>.
        </div>
      ) : (
        <>
          <WhoWorkedChart coaches={data.coaches} />

          {/* Leyenda del semáforo, en palabras */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(['verde', 'ambar', 'rojo'] as CoachStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} aria-hidden />
                <span className="font-semibold text-foreground">{STATUS_META[s].label}</span>: {STATUS_META[s].hint.toLowerCase()}
                {' '}({data.totals[s]})
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.coaches.map((c) => (
              <CoachCard key={c.staff_id} coach={c} onOpen={() => setOpenStaffId(c.staff_id)} />
            ))}
          </div>

          <Link to="/training-plans" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <Activity className="h-4 w-4" /> Ver las sesiones por equipo en Métricas y Rendimiento
          </Link>
        </>
      )}

      <CoachDetailSheet coach={openCoach} onClose={() => setOpenStaffId(null)} />
    </div>
  );
}
