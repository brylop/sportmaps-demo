/**
 * AltaFirstChargeCard — «Primer cobro» del formulario de alta (menor y adulto).
 *
 * Muestra lo que el BFF va a crear (cálculo en lib/altaFirstCharge.ts, espejo de
 * buildAltaPayments + emit_enrollment_fees):
 *   · la mensualidad del mes de entrada con su vencimiento real;
 *   · la inscripción y el seguro del plan (solo si el plan los tiene), cada uno
 *     con «No cobrar …» (exoneración por alta: esa fila no se crea);
 *   · el seguro vigente (últimos 12 meses) como «ya tiene seguro vigente», sin sumarlo;
 *   · el «Total primer cobro».
 *
 * Con «Clases restantes» (F7) el detalle de la mensualidad y su total los da
 * FirstPaymentModeSection (calculados por el BFF); aquí quedan solo los pagos únicos.
 */
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { NumberStepper } from '@/components/ui/number-stepper';
import { formatCOP } from '@/lib/prorationUtils';
import { todayColombia } from '@/lib/dateUtils';
import { computeAltaFirstCharge, OneTimeFeeLine } from '@/lib/altaFirstCharge';
import type { BillingCycleType } from '@/lib/prorationUtils';

export interface FeeWaivers {
  registration: boolean;
  insurance: boolean;
}

export const NO_FEE_WAIVERS: FeeWaivers = { registration: false, insurance: false };

/** Campos del payload de create-one / first-payment-preview. Sin exoneración = nada. */
export function feeWaiversPayload(w: FeeWaivers): { waive_registration_fee?: true; waive_insurance_fee?: true } {
  return {
    ...(w.registration ? { waive_registration_fee: true as const } : {}),
    ...(w.insurance ? { waive_insurance_fee: true as const } : {}),
  };
}

interface Props {
  startDate: string;
  monthlyFee: number;
  billing: { billing_cycle_type: BillingCycleType; payment_cutoff_day: number };
  discountPct: number;
  onDiscountChange: (pct: number) => void;
  registrationFee?: number;
  insuranceFee?: number;
  waivers: FeeWaivers;
  onWaiversChange: (w: FeeWaivers) => void;
  /** El coach no exonera (spec cobros-multiples: exonerar = canManageCharges). */
  canWaive?: boolean;
  /** Fecha del seguro vigente del atleta (solo atletas que ya existen). */
  insuranceActiveSince?: string | null;
  /** Clases restantes (F7) elegido: la mensualidad la muestra FirstPaymentModeSection. */
  hideCycleDetail?: boolean;
  /** Sufijo de los id de los inputs (dos modales en la misma página). */
  idSuffix?: string;
}

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

export function AltaFirstChargeCard({
  startDate, monthlyFee, billing, discountPct, onDiscountChange,
  registrationFee = 0, insuranceFee = 0, waivers, onWaiversChange, canWaive = true,
  insuranceActiveSince = null, hideCycleDetail = false, idSuffix = '',
}: Props) {
  const [discountEnabled, setDiscountEnabled] = useState(false);

  const hasFees = registrationFee > 0 || insuranceFee > 0;
  if (!startDate || (!monthlyFee && !hasFees)) return null;

  const r = computeAltaFirstCharge({
    startDate,
    today: todayColombia(),
    monthlyFee,
    cycleType: billing.billing_cycle_type,
    cutoffDay: billing.payment_cutoff_day,
    discountPct: discountEnabled ? discountPct : 0,
    registrationFee,
    insuranceFee,
    waiveRegistration: waivers.registration,
    waiveInsurance: waivers.insurance,
    insuranceActiveSince,
  });
  const m = r.monthly;

  const handleDiscountToggle = (checked: boolean) => {
    setDiscountEnabled(checked);
    onDiscountChange(checked ? discountPct : 0);
  };
  const handleDiscountPctChange = (val: string) => {
    const n = Math.min(100, Math.max(0, Number(val)));
    onDiscountChange(discountEnabled ? n : 0);
  };

  const feesCharged = r.registration.charged + r.insurance.charged;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 text-sm" data-testid="alta-first-charge">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" />
        Primer cobro
      </div>

      {/* ── Mensualidad del mes de entrada ── */}
      {!hideCycleDetail && m && (
        <div className="space-y-1 text-muted-foreground">
          {billing.billing_cycle_type === 'prorated' && !m.isFullMonth && (
            <div className="flex justify-between">
              <span>Días restantes:</span>
              <span className="font-medium text-foreground">{m.remainingDays} de {m.totalDaysInMonth}</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span>
              {billing.billing_cycle_type === 'prorated'
                ? (m.isFullMonth ? 'Mensualidad (mes completo)' : 'Mensualidad proporcional')
                : billing.billing_cycle_type === 'rolling_30' ? 'Mensualidad (ciclo de 30 días)' : 'Mensualidad'}
            </span>
            <span className="text-right">
              {m.listAmount !== m.amount && (
                <span className="mr-2 text-xs line-through">{formatCOP(m.listAmount)}</span>
              )}
              <span className="font-bold text-foreground">{formatCOP(m.amount)}</span>
            </span>
          </div>
          <div className="flex justify-between text-xs" data-testid="alta-monthly-due">
            <span>Vence:</span><span>{fmtDate(m.dueDate)}</span>
          </div>
        </div>
      )}

      {/* ── Pagos únicos del plan (inscripción / seguro) ── */}
      <FeeRow
        label="Inscripción (pago único)"
        line={r.registration}
        tone="orange"
        canWaive={canWaive}
        waiveLabel="No cobrar inscripción"
        checkboxId={`waive-registration${idSuffix}`}
        checked={waivers.registration}
        onCheckedChange={v => onWaiversChange({ ...waivers, registration: v })}
      />
      <FeeRow
        label="Seguro de accidentes (pago único)"
        line={r.insurance}
        tone="sky"
        canWaive={canWaive}
        waiveLabel="No cobrar seguro"
        checkboxId={`waive-insurance${idSuffix}`}
        checked={waivers.insurance}
        onCheckedChange={v => onWaiversChange({ ...waivers, insurance: v })}
        activeNote={insuranceActiveSince ? `Ya tiene seguro vigente (desde ${fmtDate(insuranceActiveSince)}): no se cobra otra vez.` : undefined}
      />
      {hasFees && (r.registration.charged > 0 || r.insurance.charged > 0) && (
        <p className="text-xs text-muted-foreground">Los pagos únicos vencen el {fmtDate(r.feesDueDate)}.</p>
      )}

      {/* ── Descuento primer mes ── */}
      {m && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`discount-toggle${idSuffix}`}
              checked={discountEnabled}
              onChange={e => handleDiscountToggle(e.target.checked)}
              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor={`discount-toggle${idSuffix}`} className="text-xs font-medium text-foreground cursor-pointer">
              Aplicar descuento solo este mes (mensualidad)
            </label>
          </div>
          {discountEnabled && (
            <div className="flex-1 max-w-[160px]">
              <NumberStepper
                value={discountPct || ''}
                onChange={(val) => handleDiscountPctChange(String(val))}
                min={0}
                max={100}
                unit="%"
                className="h-9"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Total ── */}
      {!hideCycleDetail ? (
        <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground" data-testid="alta-total">
          <span>Total primer cobro</span>
          <span>{formatCOP(r.total)}</span>
        </div>
      ) : hasFees ? (
        <div className="flex justify-between border-t border-border pt-2 text-xs text-muted-foreground">
          <span>Pagos únicos del alta (la mensualidad se detalla abajo)</span>
          <span className="font-semibold text-foreground">{formatCOP(feesCharged)}</span>
        </div>
      ) : null}

      {/* ── Mensualidades siguientes ── */}
      {monthlyFee > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-2">
          <span>Mensualidades siguientes:</span>
          <span className="font-medium">{formatCOP(monthlyFee)} / mes</span>
        </div>
      )}
    </div>
  );
}

const TONES = {
  orange: {
    box: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900',
    text: 'text-orange-700 dark:text-orange-400',
  },
  sky: {
    box: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900',
    text: 'text-sky-700 dark:text-sky-400',
  },
} as const;

function FeeRow({
  label, line, tone, canWaive, waiveLabel, checkboxId, checked, onCheckedChange, activeNote,
}: {
  label: string;
  line: OneTimeFeeLine;
  tone: keyof typeof TONES;
  canWaive: boolean;
  waiveLabel: string;
  checkboxId: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  activeNote?: string;
}) {
  if (line.status === 'none') return null;
  const t = TONES[tone];
  const notCharged = line.status === 'waived' || line.status === 'active';
  return (
    <div className={`rounded-md border px-2.5 py-1.5 text-sm space-y-1 ${t.box}`}>
      <div className="flex justify-between gap-2">
        <span className={t.text}>{label}</span>
        <span className="text-right">
          {notCharged && <span className={`mr-2 text-xs line-through ${t.text}`}>{formatCOP(line.amount)}</span>}
          <span className={`font-bold ${t.text}`}>{formatCOP(line.charged)}</span>
        </span>
      </div>
      {line.status === 'active' && activeNote && (
        <p className={`text-xs ${t.text}`}>{activeNote}</p>
      )}
      {canWaive && line.status !== 'active' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={checkboxId}
            checked={checked}
            onChange={e => onCheckedChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor={checkboxId} className={`text-xs cursor-pointer ${t.text}`}>{waiveLabel}</label>
        </div>
      )}
    </div>
  );
}
