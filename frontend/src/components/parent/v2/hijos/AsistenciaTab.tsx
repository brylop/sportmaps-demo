import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChildAttendance } from './useHijosData';
import { attendanceSummary, firstName, formatLongDate, type Hijo } from './hijosUtils';
import { EmptyNote, InlineError, Pill, Row, Section, SectionSkeleton } from './parts';

function barColor(pct: number) {
  if (pct >= 80) return 'bg-green-600 dark:bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-600 dark:bg-red-500';
}

export function AsistenciaTab({ hijo }: { hijo: Hijo }) {
  const { data, isLoading, isError, refetch } = useChildAttendance(hijo.id);
  const nombre = firstName(hijo.full_name);

  if (isLoading) return <SectionSkeleton rows={4} label="Cargando la asistencia" />;

  if (isError) {
    return (
      <InlineError
        message={`No pudimos cargar la asistencia de ${nombre}. Revisa tu conexión e intenta de nuevo.`}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyNote icon={<CalendarCheck className="h-8 w-8 opacity-40" aria-hidden="true" />}>
        <p className="font-medium text-foreground">Todavía no hay asistencia registrada.</p>
        <p className="mt-1">Cuando el profe llame lista en los entrenos de {nombre}, la verás aquí.</p>
      </EmptyNote>
    );
  }

  const s = attendanceSummary(data);
  const { came, total } = s.thisMonth;

  return (
    <div className="space-y-4">
      <Section>
        <div className="p-4">
          <p className="text-base font-semibold">
            {total > 0
              ? `Este mes vino a ${came} de ${total} ${total === 1 ? 'entreno' : 'entrenos'}.`
              : 'Este mes todavía no hay entrenos registrados.'}
          </p>
          <div className="mt-4 grid grid-cols-4 gap-3" aria-label="Asistencia por mes">
            {s.months.map((m) => (
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
        </div>
      </Section>

      <Section title="Últimos entrenos">
        <div className="mt-1">
          {s.last.map((l, i) => (
            <Row key={`${l.date}-${i}`}>
              <span className="min-w-0 flex-1 truncate text-sm">{formatLongDate(l.date)}</span>
              <Pill tone={l.label === 'Vino' ? 'good' : l.label === 'Con excusa' ? 'neutral' : 'bad'}>{l.label}</Pill>
            </Row>
          ))}
        </div>
      </Section>

      <Link
        to={`/children/${hijo.id}/attendance`}
        className="flex min-h-touch items-center justify-center text-sm font-medium text-primary hover:underline"
      >
        Ver todo el historial
      </Link>
    </div>
  );
}
