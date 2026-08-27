import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bffClient, BFFError } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Check, FileText, ChevronUp, DoorOpen, DoorClosed, ShieldX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * F6 — docs/specs/dreamers-banco-de-horas-torniquete.md
 *
 * Vista de escuela (owner/admin/coach) del banco de horas: saldo de todos los
 * atletas con plan de horas + bandeja de revisión de visitas pending_review
 * (solo owner puede corregir, D-8 — el BFF lo hace cumplir; acá solo se oculta
 * la bandeja si el 403 llega, no se duplica la regla).
 *
 * No renderiza NADA si la escuela no tiene ningún atleta con plan de horas —
 * seguro de montar en AccessControlPage para cualquier escuela (GYM RM incluida).
 */

interface HourBankBalanceRow {
  enrollment_id: string;
  athlete_name: string;
  plan_name: string;
  period_start: string;
  period_end: string;
  included_minutes: number;
  reserved_minutes: number;
  consumed_minutes: number;
  available_minutes: number;
}

interface PendingVisit {
  id: string;
  enrollment_id: string;
  started_at: string;
  ended_at: string | null;
  auto_closed: boolean;
}

function formatMinutes(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? '-' : '';
  if (h === 0) return `${sign}${m} min`;
  if (m === 0) return `${sign}${h}h`;
  return `${sign}${h}h ${m}min`;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CorrectVisitRow({ visit, onDone }: { visit: PendingVisit; onDone: () => void }) {
  const { toast } = useToast();
  const [endedAt, setEndedAt] = useState(() => toLocalInputValue(visit.ended_at ?? visit.started_at));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await bffClient.patch(`/api/v1/access/hour-bank-visits/${visit.id}/correct`, {
        ended_at: new Date(endedAt).toISOString(),
      });
      toast({ title: 'Visita corregida', description: 'Se aplicó el descuento del banco de horas.' });
      onDone();
    } catch (err) {
      toast({
        title: 'No se pudo corregir',
        description: err instanceof BFFError ? err.message : 'Error inesperado',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-b border-border/30 last:border-0">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <span className="text-xs flex-1 min-w-[120px]">
        Entrada: {new Date(visit.started_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
        {visit.auto_closed && <Badge variant="outline" className="ml-2 text-[9px]">auto-cerrada</Badge>}
      </span>
      <Input
        type="datetime-local"
        value={endedAt}
        onChange={(e) => setEndedAt(e.target.value)}
        className="h-8 w-56 text-xs"
      />
      <Button size="sm" className="h-8" disabled={saving} onClick={submit}>
        <Check className="h-3.5 w-3.5 mr-1" /> Confirmar salida
      </Button>
    </div>
  );
}

// ─── Reporte de ingresos/salidas de un estudiante — inline, no modal ─────────
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

function StudentReportPanel({ enrollmentId }: { enrollmentId: string }) {
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

export function HourBankSchoolSection() {
  const queryClient = useQueryClient();

  const { data: balancesData } = useQuery({
    queryKey: ['hour-bank-balances'],
    queryFn: () => bffClient.get<{ balances: HourBankBalanceRow[] }>('/api/v1/access/hour-bank-balances'),
    staleTime: 30_000,
  });

  // Bandeja de revisión: solo owner tiene permiso (403 para el resto — se
  // oculta sin más, el BFF ya hizo cumplir D-8).
  const { data: pendingData } = useQuery({
    queryKey: ['hour-bank-visits', 'pending_review'],
    queryFn: () => bffClient.get<{ visits: PendingVisit[] }>('/api/v1/access/hour-bank-visits?status=pending_review'),
    staleTime: 30_000,
    retry: false,
  });

  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const balances = balancesData?.balances ?? [];
  const pending = pendingData?.visits ?? [];

  if (balances.length === 0 && pending.length === 0) return null;

  return (
    <div className="space-y-4">
      {balances.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Banco de horas — saldo por atleta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {balances.map((b) => {
                const isOver = b.available_minutes < 0;
                const isLow = !isOver && b.available_minutes <= b.included_minutes * 0.15;
                const isExpanded = expandedReport === b.enrollment_id;
                return (
                  <div key={b.enrollment_id} className="border-b border-border/20 last:border-0">
                    <div className="flex items-center justify-between py-1.5 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{b.athlete_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.plan_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`font-black ${isOver ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-foreground'}`}>
                          {formatMinutes(b.available_minutes)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setExpandedReport(isExpanded ? null : b.enrollment_id)}
                          title="Ver reporte de ingresos/salidas"
                        >
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    {isExpanded && <StudentReportPanel enrollmentId={b.enrollment_id} />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Visitas pendientes de revisión ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pending.map((v) => (
              <CorrectVisitRow
                key={v.id}
                visit={v}
                onDone={() => {
                  queryClient.invalidateQueries({ queryKey: ['hour-bank-visits', 'pending_review'] });
                  queryClient.invalidateQueries({ queryKey: ['hour-bank-balances'] });
                }}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
