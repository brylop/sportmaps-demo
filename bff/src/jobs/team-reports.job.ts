/**
 * team-reports.job — automatiza el informe GRUPAL (de equipo) de Evaluación
 * Post-Entrenamiento (F4 segunda mitad, migración 20260914151925), que hasta
 * ahora solo se disparaba a mano vía POST /api/v1/school/reports/team/:teamId/publish.
 *
 * Reusa la MISMA cadencia que el informe individual del atleta
 * (report_team_schedule.send_day / school_settings.reports_default_send_day,
 * helpers `_report_send_day` / `_report_scheduled_for` de la migración
 * 20260814173709) — decisión de producto ya tomada, no una fecha nueva.
 *
 * A diferencia de athlete-reports.job.ts, acá no hay paso de "envío": el
 * informe de equipo no tiene recipient/sent_at (spec: por ahora solo lo ven
 * coach/admin, no las familias — ver la migración 20260914151925).
 *
 * `team_reports` no guarda su propio `scheduled_for` (a diferencia de
 * `athlete_reports`), así que el día efectivo se resuelve por fila llamando
 * a las mismas funciones SQL que usa el ciclo individual, en vez de duplicar
 * el COALESCE + el recorte de fin de mes acá en TS.
 */
import { supabase } from '../config/supabase';
import { buildTeamReportSnapshot } from '../services/report-snapshot.service';

export async function runTeamReportsCycle(): Promise<{
    draftsCreated: number;
    reportsPublished: number;
}> {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = hoy.getMonth() + 1;
    const hoyStr = hoy.toISOString().slice(0, 10);
    let draftsCreated = 0;
    let reportsPublished = 0;

    // 1) Borradores del periodo en curso, para todas las escuelas de una vez.
    const { data: draftRuns, error: draftErr } = await supabase.rpc('generate_team_report_drafts_system');
    if (draftErr) {
        console.error('[team-reports-cron] generate_team_report_drafts_system falló:', draftErr.message);
    } else {
        for (const r of (draftRuns ?? []) as any[]) {
            if (r.error_msg) console.error(`[team-reports-cron] escuela ${r.school_id}: ${r.error_msg}`);
            draftsCreated += r.created ?? 0;
        }
    }

    // 2) Borradores del periodo en curso; se publica el que ya cumplió su día.
    const { data: drafts, error: draftsErr } = await supabase
        .from('team_reports')
        .select('id, school_id, team_id')
        .eq('status', 'borrador')
        .eq('period_year', year)
        .eq('period_month', month);

    if (draftsErr) {
        console.error('[team-reports-cron] lectura de borradores falló:', draftsErr.message);
        console.log(`[team-reports-cron] borradores=${draftsCreated} publicados=${reportsPublished}`);
        return { draftsCreated, reportsPublished };
    }

    for (const r of (drafts ?? []) as any[]) {
        try {
            // Mismo helper que usa generate_report_drafts_system para el
            // individual: COALESCE(report_team_schedule.send_day,
            // school_settings.reports_default_send_day, 28).
            const { data: sendDay, error: sendDayErr } = await supabase.rpc('_report_send_day', {
                p_school_id: r.school_id,
                p_team_id: r.team_id,
            });
            if (sendDayErr) {
                console.error(`[team-reports-cron] _report_send_day falló equipo=${r.team_id}:`, sendDayErr.message);
                continue;
            }

            // Fecha concreta recortada al último día del mes (igual que
            // athlete_reports.scheduled_for), vía la misma función SQL.
            const { data: scheduledFor, error: schedErr } = await supabase.rpc('_report_scheduled_for', {
                p_year: year,
                p_month: month,
                p_send_day: sendDay,
            });
            if (schedErr) {
                console.error(`[team-reports-cron] _report_scheduled_for falló equipo=${r.team_id}:`, schedErr.message);
                continue;
            }

            if (String(scheduledFor) > hoyStr) continue; // aún no llega su día de envío.

            const snapshot = await buildTeamReportSnapshot({
                schoolId: r.school_id,
                teamId: r.team_id,
                year,
                month,
            });

            const { error: pubErr } = await supabase.rpc('publish_team_report_system', {
                p_report_id: r.id,
                p_snapshot: snapshot,
            });

            if (pubErr) {
                console.error(`[team-reports-cron] publish_team_report_system falló equipo=${r.team_id}:`, pubErr.message);
                continue;
            }
            reportsPublished++;
        } catch (err: any) {
            console.error(`[team-reports-cron] error armando/publicando equipo=${r.team_id}:`, err?.message || err);
        }
    }

    console.log(`[team-reports-cron] borradores=${draftsCreated} publicados=${reportsPublished}`);
    return { draftsCreated, reportsPublished };
}
