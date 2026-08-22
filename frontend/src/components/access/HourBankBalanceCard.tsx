import { useQuery } from '@tanstack/react-query';
import { bffClient } from '@/lib/api/bffClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * F6 — docs/specs/dreamers-banco-de-horas-torniquete.md
 *
 * Muestra el saldo del banco de horas de UNA inscripción (incluidas /
 * reservadas / consumidas / disponibles). No renderiza NADA si la inscripción
 * no tiene un plan de horas (`has_hours_plan: false`) — así es seguro montarlo
 * en cualquier vista de cualquier escuela sin afectar a las que no usan esto.
 */

interface HourBankBalance {
  has_hours_plan: boolean;
  period_id?: string;
  period_start?: string;
  period_end?: string;
  included_minutes?: number;
  reserved_minutes?: number;
  consumed_minutes?: number;
  available_minutes?: number;
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

function fmtDate(d?: string): string {
  if (!d) return '';
  return format(parseISO(d), "d 'de' MMM", { locale: es });
}

export function HourBankBalanceCard({ enrollmentId }: { enrollmentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['hour-bank-balance', enrollmentId],
    queryFn: () => bffClient.get<HourBankBalance>(`/api/v1/access/hour-bank-balance/${enrollmentId}`),
    enabled: !!enrollmentId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  // Sin plan de horas (el caso normal para casi todas las escuelas) — no
  // renderizar nada, no un estado vacío.
  if (!data?.has_hours_plan) return null;

  const included = data.included_minutes ?? 0;
  const reserved = data.reserved_minutes ?? 0;
  const consumed = data.consumed_minutes ?? 0;
  const available = data.available_minutes ?? 0;

  const usedPct = included > 0 ? Math.min(100, ((reserved + consumed) / included) * 100) : 0;
  const isLow = available <= included * 0.15;
  const isOver = available < 0;

  return (
    <Card className="border-l-4" style={{ borderLeftColor: isOver ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e' }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Banco de horas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className={`text-2xl font-black ${isOver ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-foreground'}`}>
            {formatMinutes(available)}
          </span>
          <span className="text-xs text-muted-foreground">disponibles</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${isOver ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>Incluidas: {formatMinutes(included)}</span>
          {reserved > 0 && <span>Reservadas: {formatMinutes(reserved)}</span>}
          <span>Consumidas: {formatMinutes(consumed)}</span>
        </div>

        {data.period_start && data.period_end && (
          <p className="text-[10px] text-muted-foreground">
            Período: {fmtDate(data.period_start)} — {fmtDate(data.period_end)}
          </p>
        )}

        {isOver && (
          <p className="text-[11px] font-medium text-red-600">
            Saldo excedido — hablá con la escuela para completar horas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
