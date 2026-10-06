import { supabase } from '../config/supabase';

/**
 * F-E de docs/specs/dreamers-reglas-completas-plan.md (W4 / F5, D8): cargo
 * SUGERIDO por horas de más del banco de horas.
 *
 * Corre una vez al día (03:00 Bogotá, registrado en maintenance.job.ts) la RPC
 * generate_hour_bank_overage_suggestions() (migración 20261005214235), que:
 *   - solo mira escuelas con hours_plan_enabled Y hour_bank_overage_charges_enabled
 *     (default false → no-op para el resto);
 *   - toma periodos ya cerrados (period_end < hoy en Bogotá) con consumo > incluido;
 *   - salta los que tengan visitas 'open' o 'pending_review' (el consumo todavía
 *     puede cambiar; se reintenta la noche siguiente);
 *   - crea UNA fila 'suggested' por periodo (UNIQUE period_id, ON CONFLICT DO
 *     NOTHING → correr dos veces no duplica) y avisa al owner.
 * Nunca crea cobros: eso lo hace el owner con POST /hour-bank-overage-charges/:id/confirm.
 */
export async function runHourBankOverageSuggestions(): Promise<void> {
  const { data, error } = await supabase.rpc('generate_hour_bank_overage_suggestions');
  if (error) {
    console.error('[CRON] banco de horas — error generando cargos por horas de más:', error.message);
    return;
  }
  const r = (data as { created?: number; skipped?: number; notified?: number }) ?? {};
  if ((r.created ?? 0) > 0 || (r.skipped ?? 0) > 0) {
    console.log(
      `[CRON] banco de horas — horas de más: ${r.created ?? 0} cargo(s) sugerido(s), ` +
      `${r.notified ?? 0} aviso(s) al owner, ${r.skipped ?? 0} periodo(s) sin precio/minutos`
    );
  }
}

export type HourBankRounding = 'none' | 'hour_up';

export interface HourBankOverageResult {
  overageMinutes: number;
  billableHours: number;
  hourlyRate: number;
  amount: number;
}

/**
 * ESPEJO de public.hour_bank_overage_calc() (migración 20261005214235). La
 * fuente de verdad es la SQL; esto existe para fijar la fórmula con tests y
 * para que una divergencia futura se vea en el diff. Si cambias una, cambia
 * la otra.
 *
 *   tarifa_hora = precio ÷ (minutos_incluidos ÷ 60)          (D8: una por plan)
 *   minutos_facturables = excedente            si rounding = 'none'
 *                       = ceil(excedente/60)·60 si rounding = 'hour_up'
 *                         (solo sobre el TOTAL del periodo, no por visita)
 *   monto = round(precio × minutos_facturables ÷ minutos_incluidos)
 *
 * Devuelve null cuando no hay nada que cobrar (sin excedente) o no hay con qué
 * calcular la tarifa (precio ≤ 0, minutos incluidos ≤ 0).
 */
export function computeHourBankOverage(input: {
  includedMinutes: number;
  consumedMinutes: number;
  planPrice: number;
  rounding: HourBankRounding;
}): HourBankOverageResult | null {
  const { includedMinutes, consumedMinutes, planPrice, rounding } = input;
  const overage = consumedMinutes - includedMinutes;
  if (overage <= 0 || includedMinutes <= 0 || !(planPrice > 0)) return null;

  const billableMinutes = rounding === 'hour_up' ? Math.ceil(overage / 60) * 60 : overage;
  const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

  return {
    overageMinutes: overage,
    billableHours: round4(billableMinutes / 60),
    hourlyRate: round4(planPrice / (includedMinutes / 60)),
    amount: Math.round((planPrice * billableMinutes) / includedMinutes),
  };
}
