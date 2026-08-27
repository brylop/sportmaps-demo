import { supabase } from '../config/supabase';

/**
 * F5 de docs/specs/dreamers-banco-de-horas-torniquete.md — corre
 * auto_close_stale_hour_bank_visits() (migración 20260821133157, corregida en
 * 20260827174032), que revisa las visitas 'open' que pasaron la hora de
 * cierre de su día de inicio o el tope de seguridad hours_max_visit_minutes,
 * y las separa en dos casos:
 *   - `closed`: el atleta ya había marcado salida real (el segmento tenía
 *     exited_at) — se cierra y factura de una, mismo cómputo de gracia que
 *     closeHourBankVisit en access-adms.ts. Es el caso típico (una visita al
 *     día), y antes del fix del 2026-08-27 caía siempre en pending_review.
 *   - `pending_review`: nunca marcó salida (anomalía real) — se corta con el
 *     cutoff de siempre, sin facturar, para que el owner corrija (D-8) vía
 *     PATCH /api/v1/access/hour-bank-visits/:id/correct.
 *
 * No-op de costo casi cero para el resto de las escuelas: la RPC solo mira
 * school_settings.hours_plan_enabled = true, que hoy es ninguna.
 */
export async function runHourBankAutoclose(): Promise<void> {
  const { data, error } = await supabase.rpc('auto_close_stale_hour_bank_visits');
  if (error) {
    console.error('[CRON] banco de horas — error en auto-cierre:', error.message);
    return;
  }
  const result = (data as { closed?: number; pending_review?: number }) ?? {};
  const closed = result.closed ?? 0;
  const pendingReview = result.pending_review ?? 0;
  if (closed > 0 || pendingReview > 0) {
    console.log(
      `[CRON] banco de horas — auto-cierre: ${closed} visita(s) cerrada(s) y facturada(s), ` +
      `${pendingReview} pasada(s) a pending_review`
    );
  }
}
