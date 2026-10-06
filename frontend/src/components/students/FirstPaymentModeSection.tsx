/**
 * FirstPaymentModeSection — alta a mitad de mes por CLASES RESTANTES (F7).
 *
 * Solo se muestra con ciclo `fixed_calendar` + flag de la escuela
 * (`school_settings.remaining_classes_billing_enabled`) + plan mensual.
 * El owner elige "Mes completo" (lo de siempre) o "Clases restantes"
 * (cuántas le quedan del mes) y si el parcial se cobra hoy o el 1° del mes
 * siguiente (D14b).
 *
 * SIN FÓRMULA AQUÍ: los montos salen de POST /api/v1/students/first-payment-preview,
 * que usa la misma función que el alta real (bff/src/utils/remainingClasses.ts).
 */
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { bffClient } from '@/lib/api/bffClient';
import { formatCOP } from '@/lib/prorationUtils';

export type FirstPaymentMode = 'full_month' | 'remaining_classes';
export type PartialDue = 'today' | 'next_month_first';

export interface FirstPaymentChoice {
  mode: FirstPaymentMode;
  classesRemaining: number | null;
  partialDue: PartialDue;
}

export const DEFAULT_FIRST_PAYMENT_CHOICE: FirstPaymentChoice = {
  mode: 'full_month',
  classesRemaining: null,
  partialDue: 'today',
};

interface PreviewRow {
  kind: 'partial' | 'next_month';
  amount: number;
  due_date: string;
  period_year: number;
  period_month: number;
  description: string;
}

interface PreviewResponse {
  eligible: boolean;
  reason: string | null;
  classes_per_period: number | null;
  rows: PreviewRow[];
  total_today: number | null;
  error?: string;
}

interface Props {
  schoolId: string;
  planId: string;
  startDate: string;
  monthlyFee: number;
  discountPct: number;
  value: FirstPaymentChoice;
  onChange: (v: FirstPaymentChoice) => void;
}

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

export function FirstPaymentModeSection({ schoolId, planId, startDate, monthlyFee, discountPct, value, onChange }: Props) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce: el stepper dispara un cambio por clic.
  useEffect(() => {
    if (!planId || !startDate) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await bffClient.post('/api/v1/students/first-payment-preview', {
          offering_plan_id: planId,
          start_date: startDate,
          monthly_fee: monthlyFee > 0 ? monthlyFee : null,
          discount_pct: discountPct > 0 ? discountPct : undefined,
          ...(value.mode === 'remaining_classes' && value.classesRemaining
            ? { classes_remaining: value.classesRemaining, partial_due: value.partialDue }
            : {}),
        }, { 'x-school-id': schoolId }) as PreviewResponse;
        if (!cancelled) setPreview(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'No se pudo calcular el cobro.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [schoolId, planId, startDate, monthlyFee, discountPct, value.mode, value.classesRemaining, value.partialDue]);

  // Si el plan deja de ser elegible, volver a "Mes completo".
  useEffect(() => {
    if (preview && !preview.eligible && value.mode === 'remaining_classes') {
      onChange(DEFAULT_FIRST_PAYMENT_CHOICE);
    }
  }, [preview, value.mode, onChange]);

  if (!preview?.eligible) return null;

  const max = (preview.classes_per_period ?? 2) - 1;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
      <div className="font-semibold text-foreground">¿Cómo se cobra este primer mes?</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          { v: 'full_month', label: 'Mes completo', desc: 'Se cobra la mensualidad entera de este mes.' },
          { v: 'remaining_classes', label: 'Clases restantes', desc: `Solo las clases que le quedan (de ${preview.classes_per_period} del mes) y el mes siguiente completo.` },
        ] as const).map(opt => (
          <label
            key={opt.v}
            className={`flex cursor-pointer gap-2 rounded-md border-2 p-3 ${value.mode === opt.v ? 'border-primary bg-primary/5' : 'border-muted'}`}
          >
            <input
              type="radio"
              name="first-payment-mode"
              className="mt-0.5"
              checked={value.mode === opt.v}
              onChange={() => onChange({
                ...value,
                mode: opt.v,
                classesRemaining: opt.v === 'remaining_classes' ? (value.classesRemaining ?? 1) : null,
              })}
            />
            <span>
              <span className="block font-medium">{opt.label}</span>
              <span className="block text-xs text-muted-foreground">{opt.desc}</span>
            </span>
          </label>
        ))}
      </div>

      {value.mode === 'remaining_classes' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs">Clases que le quedan este mes</Label>
            <NumberStepper
              value={value.classesRemaining ?? ''}
              onChange={v => {
                const n = v === '' ? null : Math.min(max, Math.max(1, Number(v)));
                onChange({ ...value, classesRemaining: n });
              }}
              min={1}
              max={max}
              className="h-9 w-32"
            />
          </div>

          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={value.partialDue === 'next_month_first'}
              onChange={e => onChange({ ...value, partialDue: e.target.checked ? 'next_month_first' : 'today' })}
            />
            <span>Cobrar el parcial el 1° del próximo mes (junto con la mensualidad)</span>
          </label>
          {value.partialDue === 'next_month_first' && (
            <Alert>
              <AlertDescription className="text-xs">
                El atleta entrenará lo que queda del mes sin haber pagado. Si el cobro vence y no se paga,
                entra al flujo normal de mora.
              </AlertDescription>
            </Alert>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Calculando…
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && preview.rows.length > 0 && (
            <div className="space-y-1 text-muted-foreground">
              {preview.rows.map(r => (
                <div key={r.kind} className="flex justify-between gap-2">
                  <span>{r.description} · vence {fmtDate(r.due_date)}</span>
                  <span className="font-bold text-foreground">{formatCOP(r.amount)}</span>
                </div>
              ))}
              {preview.total_today != null && (
                <div className="flex justify-between border-t border-border pt-1 text-xs">
                  <span>A pagar en el alta (con inscripción y seguro si aplican):</span>
                  <span className="font-semibold text-foreground">{formatCOP(preview.total_today)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
