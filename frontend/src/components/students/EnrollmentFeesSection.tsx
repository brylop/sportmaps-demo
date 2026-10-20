/**
 * «Inscripción y seguro» en la ficha de edición del atleta.
 *
 * En el alta son opt-in. Si la escuela no los marcó —o los desmarcó por error—
 * los cobra después desde aquí: el BFF crea el mismo cobro único del alta con el
 * valor del plan y queda el registro. No repite una inscripción viva ni un seguro
 * de los últimos 12 meses (lo decide el BFF; esto solo lo muestra).
 *
 * Lo marcado se cobra al pulsar «Guardar Cambios» de la ficha (el padre llama a
 * cobrarInscripcionSeguro): marcar y guardar es un solo gesto, sin otro botón.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatCOP } from '@/lib/prorationUtils';

export type FeeKind = 'inscripcion' | 'seguro';
export type FeeState = 'sin_valor' | 'por_cobrar' | 'cobrado' | 'pagado' | 'vigente';

export interface FeeLine {
  kind: FeeKind;
  plan_amount: number;
  state: FeeState;
  payment: { id: string; amount: number; status: string; due_date: string | null } | null;
  previously_cancelled: boolean;
  can_charge: boolean;
}

export interface FeesView {
  plan: { id: string; name: string } | null;
  fees: FeeLine[];
}

const NOMBRE: Record<FeeKind, string> = { inscripcion: 'Inscripción', seguro: 'Seguro de accidentes' };

const ESTADO_COBRO: Record<string, string> = {
  pending: 'pendiente', overdue: 'vencido', partial: 'abonado parcial', awaiting_approval: 'en revisión', paid: 'pagado',
};

const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Texto de una línea que no se puede marcar (ya cobrada, pagada, vigente o sin valor). */
export function describirLinea(f: FeeLine): string {
  const nombre = NOMBRE[f.kind];
  if (f.state === 'sin_valor') return `${nombre}: el plan no tiene este valor configurado.`;
  const p = f.payment;
  const monto = p ? formatCOP(p.amount) : '';
  if (f.state === 'pagado') return `${nombre} ${monto}: pagada${p?.due_date ? ` (${fmtDay(p.due_date)})` : ''}.`;
  if (f.state === 'vigente') return `${nombre}: ya tiene uno vigente (últimos 12 meses)${p?.due_date ? `, de ${fmtDay(p.due_date)}` : ''}.`;
  if (f.state === 'cobrado') return `${nombre} ${monto}: ${ESTADO_COBRO[p?.status ?? ''] ?? 'ya cobrada'}${p?.due_date ? `, vence ${fmtDay(p.due_date)}` : ''}.`;
  return nombre;
}

export type FeesMarked = Record<FeeKind, boolean>;
export const NO_FEES_MARKED: FeesMarked = { inscripcion: false, seguro: false };

/** Cobra lo marcado (POST del BFF). Lanza con el mensaje del servidor si no se pudo. */
export async function cobrarInscripcionSeguro(
  athleteId: string,
  athleteType: 'child' | 'adult' | 'unregistered',
  marked: FeesMarked,
): Promise<void> {
  const { bffClient } = await import('@/lib/api/bffClient');
  await bffClient.post(`/api/v1/students/${athleteId}/enrollment-fees`, {
    athlete_type: athleteType, inscripcion: marked.inscripcion, seguro: marked.seguro,
  });
}

interface Props {
  athleteId: string;
  athleteType: 'child' | 'adult' | 'unregistered';
  marked: FeesMarked;
  onMarkedChange: (m: FeesMarked) => void;
  disabled?: boolean;
}

export function EnrollmentFeesSection({ athleteId, athleteType, marked, onMarkedChange, disabled }: Props) {
  const [view, setView] = useState<FeesView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { bffClient } = await import('@/lib/api/bffClient');
      const data = await bffClient.get<FeesView>(`/api/v1/students/${athleteId}/enrollment-fees?athlete_type=${athleteType}`);
      setView(data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [athleteId, athleteType]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Revisando inscripción y seguro…</p>;
  }
  if (failed || !view) {
    return (
      <p className="text-xs text-muted-foreground">
        No se pudo leer la inscripción y el seguro del plan.{' '}
        <button type="button" className="underline" onClick={load}>Reintentar</button>
      </p>
    );
  }
  if (!view.plan) return null; // sin plan activo no hay valores que cobrar

  const total = view.fees.reduce((sum, f) => sum + (f.can_charge && marked[f.kind] ? f.plan_amount : 0), 0);

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="enrollment-fees-section">
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-primary" /> Inscripción y seguro · {view.plan.name}
      </p>
      <div className="space-y-1.5">
        {view.fees.map((f) => (
          f.can_charge ? (
            <div key={f.kind} className="flex items-start gap-2">
              <Checkbox
                id={`fee-after-${f.kind}`}
                checked={marked[f.kind]}
                disabled={disabled}
                onCheckedChange={(v) => onMarkedChange({ ...marked, [f.kind]: v === true })}
              />
              <Label htmlFor={`fee-after-${f.kind}`} className="text-sm font-normal cursor-pointer leading-snug">
                Cobrar {f.kind === 'inscripcion' ? 'inscripción' : 'seguro'} ({formatCOP(f.plan_amount)})
                <span className="block text-[11px] text-muted-foreground">
                  {f.previously_cancelled ? 'Se canceló antes; se crea un cobro nuevo.' : 'Aún no se ha cobrado.'}
                </span>
              </Label>
            </div>
          ) : (
            <p key={f.kind} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              {f.state === 'pagado' || f.state === 'vigente'
                ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" />
                : <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
              {describirLinea(f)}
            </p>
          )
        ))}
      </div>
      {total > 0 && (
        <p className="text-xs font-medium text-primary">
          Al pulsar «Guardar Cambios» se cobran {formatCOP(total)} (quedan pendientes en Cobros y pagos).
        </p>
      )}
    </div>
  );
}
