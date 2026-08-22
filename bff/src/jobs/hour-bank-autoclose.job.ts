import { supabase } from '../config/supabase';

/**
 * F5 de docs/specs/dreamers-banco-de-horas-torniquete.md — corre
 * auto_close_stale_hour_bank_visits() (migración 20260821133157), que corta a
 * 'pending_review' las visitas 'open' que pasaron la hora de cierre de su día
 * de inicio o el tope de seguridad hours_max_visit_minutes. NO factura nada —
 * eso pasa cuando el owner corrige (D-8), vía PATCH /api/v1/access/hour-bank-
 * visits/:id/correct.
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
  const count = (data as number) ?? 0;
  if (count > 0) {
    console.log(`[CRON] banco de horas — auto-cierre: ${count} visita(s) pasada(s) a pending_review`);
  }
}
