import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { bffClient } from '@/lib/api/bffClient';

/**
 * Cambio de plan en escuelas con banco de horas (Dreamers, Academia Superior).
 * Spec: docs/specs/dreamers-ciclo-cobro-1-al-5-y-bloqueo.md §3.1.
 *
 * Si el atleta ya pagó el período, el admin decide entre un pago PARCIAL (la
 * diferencia entre el plan nuevo y lo pagado) y un pago COMPLETO. Es un aviso
 * informativo: el sistema recomienda, no impone.
 */

export type PlanChangeChargeMode = 'partial' | 'full';

export interface PlanChangePreview {
  applies: boolean;
  reason?: string;
  current_plan?: { id: string; name: string; price: number };
  new_plan?: { id: string; name: string; price: number; included_minutes: number | null };
  paid_in_period: number;
  consumed_minutes: number;
  included_minutes: number | null;
  remaining_minutes: number | null;
  days_left: number;
  partial_amount: number;
  full_amount: number;
  needs_choice: boolean;
  scenario: 'sin_pago' | 'pago_con_horas' | 'horas_agotadas' | 'cierre_de_periodo';
  recommended: PlanChangeChargeMode | 'wait' | null;
  message: string;
}

export type AthleteIdentity =
  | { child_id: string }
  | { user_id: string }
  | { unregistered_athlete_id: string };

/** Pide la vista previa al BFF. Devuelve null si el cambio no necesita diálogo. */
export async function fetchPlanChangePreview(
  athlete: AthleteIdentity,
  newPlanId: string,
): Promise<PlanChangePreview | null> {
  try {
    const res = await bffClient.post<{ data: PlanChangePreview }>(
      '/api/v1/enrollments/plan-change-preview',
      { ...athlete, new_plan_id: newPlanId },
    );
    const preview = res?.data;
    return preview && preview.applies && preview.needs_choice ? preview : null;
  } catch {
    // Si la vista previa falla, el cambio sigue el flujo de siempre (el BFF
    // aplica el cobro habitual): el aviso es una ayuda, no una barrera.
    return null;
  }
}

const hoursLabel = (minutes: number | null): string => {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

interface Props {
  preview: PlanChangePreview | null;
  open: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (mode: PlanChangeChargeMode) => void;
}

export function PlanChangeDialog({ preview, open, submitting, onCancel, onConfirm }: Props) {
  const [mode, setMode] = useState<PlanChangeChargeMode>('partial');

  useEffect(() => {
    if (!preview) return;
    // 'wait' (cerca del cierre) no es un cobro: si igual se cambia ahora, se sugiere el parcial.
    setMode(preview.recommended === 'full' ? 'full' : 'partial');
  }, [preview]);

  if (!preview || !preview.new_plan || !preview.current_plan) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambio de plan</DialogTitle>
          <DialogDescription>
            {preview.current_plan.name} → {preview.new_plan.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p>{preview.message}</p>

          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
            <span className="text-muted-foreground">Pagado en el período</span>
            <span className="text-right font-medium">{formatCurrency(preview.paid_in_period)}</span>
            <span className="text-muted-foreground">Horas usadas</span>
            <span className="text-right font-medium">{hoursLabel(preview.consumed_minutes)}</span>
            <span className="text-muted-foreground">Horas restantes (plan actual)</span>
            <span className="text-right font-medium">{hoursLabel(preview.remaining_minutes)}</span>
            <span className="text-muted-foreground">Días que faltan del período</span>
            <span className="text-right font-medium">{preview.days_left}</span>
          </div>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as PlanChangeChargeMode)} className="space-y-2">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="partial" id="plan-change-partial" className="mt-1" />
              <Label htmlFor="plan-change-partial" className="flex-1 cursor-pointer space-y-1">
                <span className="flex items-center gap-2 font-medium">
                  Pago parcial: {formatCurrency(preview.partial_amount)}
                  {preview.recommended === 'partial' && <Badge variant="secondary">Recomendado</Badge>}
                </span>
                <span className="block text-muted-foreground font-normal">
                  La diferencia entre el plan nuevo ({formatCurrency(preview.new_plan.price)}) y lo ya pagado.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="full" id="plan-change-full" className="mt-1" />
              <Label htmlFor="plan-change-full" className="flex-1 cursor-pointer space-y-1">
                <span className="flex items-center gap-2 font-medium">
                  Pago completo: {formatCurrency(preview.full_amount)}
                  {preview.recommended === 'full' && <Badge variant="secondary">Recomendado</Badge>}
                </span>
                <span className="block text-muted-foreground font-normal">
                  Un cobro nuevo por el valor total del plan nuevo.
                </span>
              </Label>
            </div>
          </RadioGroup>

          <p className="text-xs text-muted-foreground">
            El cobro nuevo vence hoy. En las dos opciones las horas ya usadas pasan al plan nuevo y el banco de horas
            del período queda con las horas del plan nuevo.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {preview.recommended === 'wait' ? 'Esperar al día 1' : 'Cancelar'}
          </Button>
          <Button onClick={() => onConfirm(mode)} disabled={submitting}>
            {submitting ? 'Cambiando…' : 'Cambiar de plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
