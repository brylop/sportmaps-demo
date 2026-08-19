/**
 * athlete-reports.job — F5, la pieza que faltaba: automatiza generar + publicar
 * + enviar. La entrega (correo + notif in-app) ya existía en
 * report-delivery.service.ts; esto es lo que la dispara sola cada día.
 *
 * No incluye recordatorios (coach sin nota / padre sin abrir) — eso queda para
 * una segunda pasada, según se acordó.
 */
import { supabase } from '../config/supabase';
import { buildReportSnapshot, type SubjectType } from '../services/report-snapshot.service';
import { deliverPublishedReports } from '../services/report-delivery.service';

export async function runAthleteReportsCycle(): Promise<{
    draftsCreated: number;
    teamsPublished: number;
    reportsPublished: number;
    sent: number;
}> {
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = hoy.getMonth() + 1;
    let draftsCreated = 0;
    let teamsPublished = 0;
    let reportsPublished = 0;
    let sent = 0;

    // 1) Borradores del periodo en curso, para todas las escuelas de una vez.
    const { data: draftRuns, error: draftErr } = await supabase.rpc('generate_report_drafts_system');
    if (draftErr) {
        console.error('[reports-cron] generate_report_drafts_system falló:', draftErr.message);
    } else {
        for (const r of (draftRuns ?? []) as any[]) {
            if (r.error_msg) console.error(`[reports-cron] escuela ${r.school_id}: ${r.error_msg}`);
            draftsCreated += r.created ?? 0;
        }
    }

    // 2) Publica los lotes cuyo scheduled_for es hoy y no están retenidos ni ya
    //    publicados. Se agrupa por (school_id, team_id) porque publicar es por
    //    equipo (D17: el snapshot incluye notas de TODOS los equipos del atleta,
    //    pero el lote que se congela hoy es el del equipo gobernante).
    const { data: dueReports, error: dueErr } = await supabase
        .from('athlete_reports')
        .select('id, school_id, team_id, subject_type, subject_id, period_year, period_month, coach_note')
        .in('status', ['borrador', 'listo'])
        .eq('period_year', year)
        .eq('period_month', month)
        .lte('scheduled_for', hoy.toISOString().slice(0, 10));

    if (dueErr) {
        console.error('[reports-cron] lectura de informes vencidos falló:', dueErr.message);
        return { draftsCreated, teamsPublished, reportsPublished, sent };
    }

    const porEquipo = new Map<string, { school_id: string; team_id: string | null; reports: any[] }>();
    for (const r of (dueReports ?? []) as any[]) {
        // team_id NULL (D-C, atleta sin equipo) se agrupa por escuela sola —
        // no hay lote de equipo que publicar en conjunto.
        const key = `${r.school_id}:${r.team_id ?? 'sin-equipo'}`;
        if (!porEquipo.has(key)) porEquipo.set(key, { school_id: r.school_id, team_id: r.team_id, reports: [] });
        porEquipo.get(key)!.reports.push(r);
    }

    for (const [, grupo] of porEquipo) {
        if (!grupo.team_id) continue; // sin equipo: se deja para revisión manual del admin (D-C).

        try {
            const snapshots: Record<string, unknown> = {};
            for (const r of grupo.reports) {
                const snap = await buildReportSnapshot({
                    schoolId: grupo.school_id,
                    subjectType: r.subject_type as SubjectType,
                    subjectId: r.subject_id,
                    year: r.period_year,
                    month: r.period_month,
                    governingTeamId: r.team_id,
                    coachNote: r.coach_note,
                });
                snapshots[r.id] = snap;
            }

            const { data: resultados, error: pubErr } = await supabase.rpc('publish_team_reports_system', {
                p_school_id: grupo.school_id,
                p_team_id: grupo.team_id,
                p_year: year,
                p_month: month,
                p_snapshots: snapshots,
            });

            if (pubErr) {
                console.error(`[reports-cron] publish_team_reports_system falló equipo=${grupo.team_id}:`, pubErr.message);
                continue;
            }
            teamsPublished++;
            reportsPublished += ((resultados ?? []) as any[]).filter((r) => r.resultado === 'publicado').length;
        } catch (err: any) {
            console.error(`[reports-cron] error armando snapshots equipo=${grupo.team_id}:`, err?.message || err);
        }
    }

    // 3) Envía lo publicado que aún no salió (correo + notif in-app), por
    //    escuela — deliverPublishedReports ya filtra onlyDue y agrupa por lote.
    const { data: escuelas } = await supabase
        .from('athlete_reports')
        .select('school_id')
        .eq('period_year', year)
        .eq('period_month', month)
        .eq('status', 'publicado')
        .is('sent_at', null);

    const schoolIds = [...new Set(((escuelas ?? []) as any[]).map((e) => e.school_id))];
    for (const schoolId of schoolIds) {
        try {
            const salida = await deliverPublishedReports(schoolId, year, month, { onlyDue: true, limit: 100 });
            sent += salida.sent;
        } catch (err: any) {
            console.error(`[reports-cron] envío falló escuela=${schoolId}:`, err?.message || err);
        }
    }

    console.log(`[reports-cron] borradores=${draftsCreated} equipos_publicados=${teamsPublished} informes_publicados=${reportsPublished} enviados=${sent}`);
    return { draftsCreated, teamsPublished, reportsPublished, sent };
}
