/**
 * Historial de asistencia de un hijo — acudiente V2
 * (/children/:id/attendance y /parent-attendance?childId=…).
 *
 * Arriba una frase («Este mes vino a 6 de 8 entrenos») con los últimos
 * meses; debajo todo el historial por mes y, si tiene entrenador personal,
 * sus sesiones.
 *
 * Sale de `attendance_records`, que es donde el profe pasa lista. La RLS que
 * lo habilita es "Parents can view attendance of their children"
 * (child_id contra children.parent_id = auth.uid()). La tabla legacy
 * `attendance` tiene CERO filas: no volver a leerla.
 */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { attendanceSummary, firstName, formatLongDate } from '@/components/parent/v2/hijos/hijosUtils';
import { EmptyNote, InlineError, Pill, Row, Section, SectionSkeleton, type Tone } from '@/components/parent/v2/hijos/parts';
import { CabeceraHijo, Cifra, PaginaHijo, SelectorHijo } from '@/components/parent/hijo-detalle/HijoDetalle';
import { useHijosDelAcudiente } from '@/components/parent/hijo-detalle/useHijoDetalle';
import { attendanceLabel, attendanceTotals, groupByMonth, plural, type AttendanceLabel } from '@/components/parent/hijo-detalle/hijoDetalleUtils';

const LABEL_TONE: Record<AttendanceLabel, Tone> = {
  Vino: 'good',
  'Llegó tarde': 'good',
  'Con excusa': 'neutral',
  'No vino': 'bad',
};

function barColor(pct: number) {
  if (pct >= 80) return 'bg-green-600 dark:bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-600 dark:bg-red-500';
}

interface AttendanceRow {
  id: string;
  attendance_date: string;
  status: string;
  notes: string | null;
}

export default function AttendancePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const hijos = useHijosDelAcudiente();
  const pedido = id || searchParams.get('childId') || '';
  const selectedChildId = pedido || hijos.data?.[0]?.id || '';
  const hijo = hijos.data?.find((h) => h.id === selectedChildId) ?? null;
  const nombre = hijo ? firstName(hijo.full_name) : 'tu hijo';

  const elegir = (childId: string) => {
    if (id) navigate(`/children/${childId}/attendance`, { replace: true });
    else setSearchParams({ childId }, { replace: true });
  };

  const attendance = useQuery({
    queryKey: ['attendance', selectedChildId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, attendance_date, status, notes')
        .eq('child_id', selectedChildId)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
    enabled: !!selectedChildId,
  });

  // Sesiones con entrenador personal (solo si las tiene; si falla, no estorba).
  const { data: ptSessions } = useQuery({
    queryKey: ['child-pt-attendance', selectedChildId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('id, name, status, session_date, trainer_id')
        .eq('client_id', selectedChildId)
        .in('status', ['completed', 'assigned'])
        .order('session_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; status: string; session_date: string }[];
    },
    enabled: !!selectedChildId,
    retry: false,
  });

  const records = attendance.data ?? [];
  const summary = attendanceSummary(records);
  const totals = attendanceTotals(records);
  const meses = groupByMonth(records, (r) => r.attendance_date);
  const ptDone = ptSessions?.filter((s) => s.status === 'completed').length ?? 0;

  const cuerpo = () => {
    if (hijos.isLoading || (selectedChildId && attendance.isLoading)) {
      return <SectionSkeleton rows={5} label="Cargando la asistencia" />;
    }
    if (hijos.isError && !pedido) {
      return <InlineError message="No pudimos cargar a tus hijos. Revisa tu conexión e intenta de nuevo." onRetry={() => hijos.refetch()} />;
    }
    if (!selectedChildId) {
      return (
        <EmptyNote icon={<CalendarCheck className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no tienes hijos registrados.</p>
          <p className="mt-1">Agrégalos en la pestaña Hijos para ver su asistencia.</p>
        </EmptyNote>
      );
    }
    if (attendance.isError) {
      return (
        <InlineError
          message={`No pudimos cargar la asistencia de ${nombre}. Revisa tu conexión e intenta de nuevo.`}
          onRetry={() => attendance.refetch()}
        />
      );
    }
    if (records.length === 0) {
      return (
        <EmptyNote icon={<CalendarCheck className="h-8 w-8 opacity-40" aria-hidden="true" />}>
          <p className="font-medium text-foreground">Todavía no hay asistencia registrada.</p>
          <p className="mt-1">Cuando el profe llame lista en los entrenos de {nombre}, la verás aquí.</p>
        </EmptyNote>
      );
    }

    const { came, total } = summary.thisMonth;
    return (
      <>
        <Section>
          <div className="p-4">
            <p className="text-base font-semibold">
              {total > 0
                ? `Este mes vino a ${came} de ${plural(total, 'entreno', 'entrenos')}.`
                : 'Este mes todavía no hay entrenos registrados.'}
            </p>
            {total === 0 && records[0] && (
              <p className="mt-1 text-sm text-muted-foreground">
                La última lista fue el {formatLongDate(records[0].attendance_date).toLowerCase()}.
              </p>
            )}
            <div className="mt-4 grid grid-cols-4 gap-3" aria-label="Asistencia por mes">
              {summary.months.map((m) => (
                <div key={m.key} className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold tabular-nums">{m.total ? `${m.pct} %` : '—'}</span>
                  <div className="flex h-16 w-full items-end overflow-hidden rounded-lg bg-muted">
                    <div
                      className={cn('w-full rounded-lg', m.total ? barColor(m.pct) : '')}
                      style={{ height: `${m.total ? Math.max(m.pct, 4) : 0}%` }}
                      title={m.total ? `${m.came} de ${m.total}` : 'Sin entrenos'}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Cifra valor={`${totals.pct} %`} etiqueta={`Vino a ${totals.came} de ${totals.total}`} />
              <Cifra valor={totals.late} etiqueta={totals.late === 1 ? 'Vez que llegó tarde' : 'Veces que llegó tarde'} />
              <Cifra valor={totals.absent} etiqueta={totals.absent === 1 ? 'Falta' : 'Faltas'} />
              <Cifra valor={totals.excused} etiqueta="Con excusa" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Llegar tarde cuenta como haber venido, igual que lo ve la escuela.</p>
          </div>
        </Section>

        {meses.map((g) => {
          const vino = g.items.filter((r) => attendanceLabel(r.status) === 'Vino' || attendanceLabel(r.status) === 'Llegó tarde').length;
          return (
            <Section key={g.key} title={g.label}>
              <p className="px-4 text-xs text-muted-foreground">Vino a {vino} de {plural(g.items.length, 'entreno', 'entrenos')}</p>
              <div className="mt-1">
                {g.items.map((r) => {
                  const label = attendanceLabel(r.status);
                  return (
                    <Row key={r.id}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{formatLongDate(r.attendance_date)}</span>
                        {r.notes?.trim() && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                      </span>
                      <Pill tone={LABEL_TONE[label]}>{label}</Pill>
                    </Row>
                  );
                })}
              </div>
            </Section>
          );
        })}
      </>
    );
  };

  return (
    <PaginaHijo>
      <SelectorHijo hijos={hijos.data ?? []} selectedId={selectedChildId} onSelect={elegir} />
      <CabeceraHijo
        hijo={hijo}
        titulo={hijo ? `Asistencia de ${nombre}` : 'Asistencia'}
        sub="Cada entreno en el que el profe llamó lista."
      />
      {cuerpo()}

      {(ptSessions?.length ?? 0) > 0 && (
        <Section title="Con entrenador personal">
          <p className="px-4 text-xs text-muted-foreground">
            {ptDone} de {plural(ptSessions!.length, 'sesión asignada', 'sesiones asignadas')} ya se hicieron.
          </p>
          <div className="mt-1">
            {ptSessions!.map((s) => (
              <Row key={s.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">{formatLongDate(s.session_date)}</span>
                </span>
                <Pill tone={s.status === 'completed' ? 'good' : 'info'}>{s.status === 'completed' ? 'Hecha' : 'Pendiente'}</Pill>
              </Row>
            ))}
          </div>
        </Section>
      )}
    </PaginaHijo>
  );
}
