import { useQuery } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, DoorClosed, ShieldX } from 'lucide-react';

/**
 * Reporte de ingresos/salidas de un estudiante — log crudo del torniquete +
 * visitas del banco de horas si la inscripción tiene plan de horas. Inline,
 * no modal. Usado desde el perfil del estudiante (SchoolStudentsManagementPage)
 * y desde cualquier otro lugar que necesite auditar el acceso de una persona.
 */

interface StudentReportEvent {
  direction: 'entry' | 'exit';
  access_granted: boolean;
  denial_reason: string | null;
  check_in_method: string;
  occurred_at: string;
}
interface StudentReportVisit {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  billed_minutes: number | null;
  auto_closed: boolean;
}
interface StudentReport {
  athlete_name: string;
  range: { from: string; to: string };
  no_turnstile_data: boolean;
  events: StudentReportEvent[];
  hour_bank: { has_hours_plan: boolean; visits?: StudentReportVisit[] };
}

const DENIAL_LABEL: Record<string, string> = {
  no_enrollment:      'Sin inscripción',
  payment_overdue:    'Pago vencido',
  enrollment_expired: 'Inscripción vencida',
  unknown_user:       'Usuario desconocido',
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bogota' });
}

export function StudentReportPanel({ enrollmentId }: { enrollmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['student-report', enrollmentId],
    queryFn: () => bffClient.get<StudentReport>(`/api/v1/access/student-report/${enrollmentId}`),
    staleTime: 30_000,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-3">Cargando reporte...</p>;
  if (!data) return <p className="text-xs text-muted-foreground py-3">No se pudo cargar el reporte.</p>;

  return (
    <div className="py-3 space-y-3 border-t border-border/30 mt-2">
      <p className="text-[10px] text-muted-foreground">
        Últimos 30 días ({data.range.from} — {data.range.to})
      </p>

      {data.no_turnstile_data ? (
        <p className="text-xs text-muted-foreground italic">
          Esta inscripción es de un menor sin cuenta propia (`children`) — el circuito de torniquete no lo trackea, sin datos de ingreso/salida acá.
        </p>
      ) : data.events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin eventos de torniquete en el rango.</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {data.events.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {!e.access_granted
                ? <ShieldX className="h-3 w-3 text-destructive shrink-0" />
                : e.direction === 'entry'
                  ? <DoorOpen className="h-3 w-3 text-green-500 shrink-0" />
                  : <DoorClosed className="h-3 w-3 text-blue-500 shrink-0" />
              }
              <span className="text-muted-foreground">{fmtDateTime(e.occurred_at)}</span>
              <span>{e.direction === 'entry' ? 'Entrada' : 'Salida'}</span>
              {!e.access_granted && e.denial_reason && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 border-destructive/30 text-destructive">
                  {DENIAL_LABEL[e.denial_reason] ?? e.denial_reason}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {data.hour_bank.has_hours_plan && (data.hour_bank.visits?.length ?? 0) > 0 && (
        <div className="pt-2 border-t border-border/20">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Visitas del banco de horas
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.hour_bank.visits!.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {fmtDateTime(v.started_at)}{v.ended_at ? ` — ${fmtDateTime(v.ended_at)}` : ' (en curso)'}
                </span>
                <span className="flex items-center gap-1.5">
                  {v.billed_minutes != null && <span className="font-semibold">{v.billed_minutes} min</span>}
                  <Badge variant="outline" className="text-[9px] h-4 px-1 py-0">
                    {v.status === 'pending_review' ? 'pendiente revisión' : v.status}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
