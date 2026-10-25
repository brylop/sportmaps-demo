/**
 * plan-por-asistencia.job — corre una vez al inicio de mes (día 1, 06:00 America/Bogota por
 * defecto) y calcula el plan por clases tomadas del MES ANTERIOR para las escuelas con
 * `plan_por_asistencia_modo` en 'sombra' o 'auto'. La lógica vive en
 * `services/plan-por-asistencia.service.ts`.
 *
 *  · Idempotente: único parcial en `enrollment_plan_changes` + pre-lectura; los tres BFF
 *    (dev/stg/prod) comparten base y aun así no duplican.
 *  · Solo arranca en Render (`debenCorrerLosCrons`) y respeta DISABLE_PLAN_ASISTENCIA_CRON
 *    y CRONS_ENABLED=false.
 *  · Hora configurable: PLAN_ASISTENCIA_CRON_DIA (1-28, def. 1) y PLAN_ASISTENCIA_CRON_HORA (0-23, def. 6).
 *  · En modo sombra NO avisa a la familia.
 */

import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { debenCorrerLosCrons } from './crons-solo-en-render';
import { calcularPlanPorAsistencia, type OpcionesCalculo, type ResultadoCalculo } from '../services/plan-por-asistencia.service';

/** Corrida a demanda (rutas, scripts) y la del cron. `dryRun` no escribe. */
export async function runPlanPorAsistencia(opts: OpcionesCalculo = {}): Promise<ResultadoCalculo> {
    return calcularPlanPorAsistencia(opts);
}

export function expresionCron(env: NodeJS.ProcessEnv = process.env): string {
    const dia = Number(env.PLAN_ASISTENCIA_CRON_DIA);
    const hora = Number(env.PLAN_ASISTENCIA_CRON_HORA);
    const d = Number.isInteger(dia) && dia >= 1 && dia <= 28 ? dia : 1;
    const h = Number.isInteger(hora) && hora >= 0 && hora <= 23 ? hora : 6;
    return `0 ${h} ${d} * *`;
}

export function iniciarPlanPorAsistenciaCron(): void {
    if (!debenCorrerLosCrons()) return;
    if (process.env.CRONS_ENABLED === 'false') return;
    if (process.env.DISABLE_PLAN_ASISTENCIA_CRON === 'true') {
        console.log('[CRON] Plan por asistencia APAGADO (DISABLE_PLAN_ASISTENCIA_CRON=true).');
        return;
    }
    const expr = expresionCron();
    cron.schedule(expr, async () => {
        if (process.env.DISABLE_PLAN_ASISTENCIA_CRON === 'true') return;
        try {
            const r = await runPlanPorAsistencia();
            console.log(`[CRON] Plan por asistencia ${r.year}-${r.month}: disponible=${r.disponible} evaluadas=${r.inscripciones_evaluadas} `
                + `propuestas=${r.propuestas.length} escritas=${r.escritas} ya=${r.ya_registradas} errores=${r.errores}`
                + (r.motivo_no_disponible ? ` motivo=${r.motivo_no_disponible}` : ''));
        } catch (err: any) {
            Sentry.captureException(err);
            console.error('[CRON] Error en plan por asistencia:', err?.message || err);
        }
    }, { timezone: 'America/Bogota' });
    console.log(`[CRON] Plan por asistencia registrado (${expr}, America/Bogota; modo por escuela, default apagado).`);
}
