/**
 * «Inscripción y seguro» en la ficha de edición del atleta.
 *
 * En el alta son opt-in. Si la escuela no los marcó —o los desmarcó por error—
 * los cobra después desde aquí: el BFF crea el mismo cobro único del alta con el
 * valor del plan y queda el registro. No repite una inscripción viva ni un seguro
 * de los últimos 12 meses (lo decide el BFF; esto solo lo muestra).
 */
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

interface Props {
  athleteId: string;
  athleteType: 'child' | 'adult' | 'unregistered';
}

export function EnrollmentFeesSection({ athleteId, athleteType }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<FeesView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marked, setMarked] = useState<Record<FeeKind, boolean>>({ inscripcion: false, seguro: false });

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

  useEffect(() => { setMarked({ inscripcion: false, seguro: false }); load(); }, [load]);

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

  const total = view.fees.reduce((s, f) => s + (f.can_charge && marked[f.kind] ? f.plan_amount : 0), 0);
  const anyMarked = view.fees.some((f) => f.can_charge && marked[f.kind]);

  const charge = async () => {
    setSaving(true);
    try {
      const { bffClient } = await import('@/lib/api/bffClient');
      const out = await bffClient.post<FeesView & { created: string[] }>(
        `/api/v1/students/${athleteId}/enrollment-fees`,
        { athlete_type: athleteType, inscripcion: marked.inscripcion, seguro: marked.seguro },
      );
      setView({ plan: out.plan, fees: out.fees });
      setMarked({ inscripcion: false, seguro: false });
      queryClient.invalidateQueries({ queryKey: ['school-students'] });
      toast({ title: '✅ Cobro creado', description: `Se cobró ${formatCOP(total)} (queda pendiente en Cobros y pagos).` });
    } catch (e: any) {
      toast({ title: 'No se pudo cobrar', description: e?.message || 'Ocurrió un error inesperado', variant: 'destructive' });
      load();
    } finally {
      setSaving(false);
    }
  };

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
                disabled={saving}
                onCheckedChange={(v) => setMarked((m) => ({ ...m, [f.kind]: v === true }))}
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
      {anyMarked && (
        <Button type="button" size="sm" onClick={charge} disabled={saving}>
          {saving ? 'Cobrando…' : `Cobrar ${formatCOP(total)}`}
        </Button>
      )}
    </div>
  );
}
