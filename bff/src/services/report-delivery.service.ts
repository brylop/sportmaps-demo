/**
 * Despacho del Informe Mensual: correo + notificación in-app.
 *
 * Publicar NO es enviar. La RPC `publish_athlete_report` congela el snapshot y
 * deja `sent_at` en NULL a propósito; este servicio es el que marca el envío.
 *
 * Cascada (spec §7.1): FCM y web push confirman que ACEPTARON el mensaje, no que
 * llegó, así que no se puede condicionar el correo a «el push se entregó». Lo
 * verificable es si el destinatario tiene un canal de push VIVO. Hoy se manda
 * correo siempre — es el canal que toda familia tiene — y la notificación in-app
 * queda registrada para quien abra la app. Afinar la cascada de 24 h es F5.
 */
import { supabase } from '../config/supabase';
import type { ReportSnapshot, SnapshotMetric } from './report-snapshot.service';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sportmaps.co';

/** Tope de la API de Resend por llamada a /emails/batch. No es límite del plan. */
const EMAIL_BATCH_LIMIT = 100;

const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');

function deltaTexto(m: SnapshotMetric): string {
    if (m.delta === null || m.delta === 0) return '';
    const signo = m.delta > 0 ? '+' : '';
    return ` <span style="color:#16a34a;font-weight:600">(${signo}${fmt(m.delta)})</span>`;
}

function filaMetrica(m: SnapshotMetric): string {
    return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee">
        <div style="font-size:14px;font-weight:600;color:#111">${esc(m.label)}</div>
        ${m.hint ? `<div style="font-size:12px;color:#666;margin-top:2px">${esc(m.hint)}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
        <span style="font-size:16px;font-weight:700;color:#111">${fmt(m.value)}</span>
        ${m.unit ? `<span style="font-size:11px;color:#888"> ${esc(m.unit)}</span>` : ''}
        ${deltaTexto(m)}
      </td>
    </tr>`;
}

/**
 * El correo lleva RESUMEN + ENLACE, nunca el informe completo ni un adjunto
 * (D5). Si el correo trae todo, el correo canibaliza la app y nadie entra.
 */
export function renderReportEmail(snapshot: ReportSnapshot, link: string): { subject: string; html: string } {
    const nombre = snapshot.athlete.name.split(' ')[0] || snapshot.athlete.name;
    const mejoras = snapshot.highlights.length;

    const subject = mejoras > 0
        ? `${nombre} mejoró en ${mejoras} ${mejoras === 1 ? 'área' : 'áreas'} en ${snapshot.period.label}`
        : `Informe de ${nombre} — ${snapshot.period.label}`;

    const notaEquipo = snapshot.team_notes[0]?.body;

    const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:13px;color:#888;margin:0 0 4px">${esc(snapshot.school.name)}</p>
  <h1 style="font-size:22px;margin:0 0 4px">Informe de ${esc(snapshot.athlete.name)}</h1>
  <p style="font-size:14px;color:#666;margin:0 0 24px;text-transform:capitalize">${esc(snapshot.period.label)}</p>

  ${snapshot.highlights.length > 0 ? `
    <h2 style="font-size:15px;margin:0 0 8px">Lo que más mejoró</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${snapshot.highlights.map(filaMetrica).join('')}
    </table>` : ''}

  ${snapshot.attendance.pct !== null ? `
    <p style="font-size:14px;background:#f6f6f6;padding:12px;border-radius:8px;margin:0 0 24px">
      <strong>Asistencia del mes:</strong> ${snapshot.attendance.present} de ${snapshot.attendance.total}
      entrenamientos (${snapshot.attendance.pct}%)
    </p>` : ''}

  ${notaEquipo ? `
    <h2 style="font-size:15px;margin:0 0 8px">Del entrenador</h2>
    <p style="font-size:14px;line-height:1.6;color:#333;margin:0 0 24px">${esc(notaEquipo)}</p>` : ''}

  ${snapshot.coach_note ? `
    <p style="font-size:14px;line-height:1.6;color:#333;background:#f0f7ff;padding:12px;border-radius:8px;margin:0 0 24px">
      ${esc(snapshot.coach_note)}
    </p>` : ''}

  <a href="${esc(link)}"
     style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">
    Ver el detalle completo
  </a>

  <p style="font-size:12px;color:#999;margin-top:28px;line-height:1.5">
    ${snapshot.metrics.length} ${snapshot.metrics.length === 1 ? 'medición' : 'mediciones'} de este mes.
    Entra a la app para ver la evolución de cada una.
  </p>
</div>`;

    return { subject, html };
}

interface EmailItem { to: string; subject: string; html: string }

/**
 * Manda un lote a la edge function `send-email`. Se usan `subject`/`html`
 * directos en vez de un `type` con plantilla: así no hay que tocar la edge
 * function para agregar el informe.
 */
async function sendEmailBatch(batch: EmailItem[]): Promise<{ ok: boolean; error?: string }> {
    if (batch.length === 0) return { ok: true };

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ batch }),
        });
        if (!response.ok) return { ok: false, error: await response.text() };
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
    }
}

export interface DeliveryResult {
    report_id: string;
    sent: boolean;
    channel: 'email' | 'none';
    reason?: string;
}

/**
 * Despacha los informes publicados y aún no enviados de un periodo.
 *
 * Sin destinatario NO cuenta como fallo (D16): el informe queda publicado y la
 * familia lo verá cuando vincule su cuenta. Es el caso mayoritario hoy — en
 * Dynasty solo el 22% de los menores tiene acudiente vinculado — así que
 * tratarlo como error llenaría el log de ruido sobre algo que no está roto.
 */
export async function deliverPublishedReports(
    schoolId: string,
    year: number,
    month: number,
    opts: { limit?: number; onlyDue?: boolean; teamIds?: string[]; reportIds?: string[] } = {},
): Promise<{ results: DeliveryResult[]; sent: number; skipped: number }> {
    const hoy = new Date().toISOString().slice(0, 10);

    let query = supabase
        .from('athlete_reports')
        .select('id, subject_type, subject_id, recipient_id, snapshot, scheduled_for, team_id')
        .eq('school_id', schoolId)
        .eq('period_year', year)
        .eq('period_month', month)
        .eq('status', 'publicado')
        .is('sent_at', null)
        .order('scheduled_for', { ascending: true })
        .limit(opts.limit ?? EMAIL_BATCH_LIMIT);

    // El emisor diario manda solo lo que ya venció; publicar y mandar a mano
    // (para probar) no debería esperar al día del calendario.
    if (opts.onlyDue) query = query.lte('scheduled_for', hoy);

    // Cuando la escuela delega la liberación al entrenador, éste despacha SUS
    // equipos y nada más. Sin este filtro, delegar en un coach le daría el botón
    // de mandarle correo a toda la escuela.
    if (opts.teamIds) {
        if (opts.teamIds.length === 0) return { results: [], sent: 0, skipped: 0 };
        query = query.in('team_id', opts.teamIds);
    }

    // Envío puntual: «evalué a este atleta y quiero mandarle a él». Se COMBINA
    // con el filtro de equipos, no lo reemplaza — si no, pasarle un id ajeno
    // sería la forma de saltarse el alcance del coach.
    if (opts.reportIds) {
        if (opts.reportIds.length === 0) return { results: [], sent: 0, skipped: 0 };
        query = query.in('id', opts.reportIds);
    }

    const { data: informes, error } = await query;
    if (error) throw error;

    const filas = (informes ?? []) as any[];
    if (filas.length === 0) return { results: [], sent: 0, skipped: 0 };

    const conDestinatario = filas.filter((r) => r.recipient_id);
    const results: DeliveryResult[] = filas
        .filter((r) => !r.recipient_id)
        .map((r) => ({
            report_id: r.id,
            sent: false,
            channel: 'none' as const,
            reason: 'sin acudiente vinculado',
        }));

    if (conDestinatario.length === 0) {
        return { results, sent: 0, skipped: results.length };
    }

    const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', [...new Set(conDestinatario.map((r) => r.recipient_id))]);

    const emailPorId = new Map(((perfiles ?? []) as any[]).map((p) => [p.id, p.email]));

    const batch: EmailItem[] = [];
    const enviados: string[] = [];
    const notificaciones: any[] = [];

    for (const informe of conDestinatario) {
        const email = emailPorId.get(informe.recipient_id);
        const snapshot = informe.snapshot as ReportSnapshot | null;

        if (!snapshot) {
            results.push({ report_id: informe.id, sent: false, channel: 'none', reason: 'sin snapshot' });
            continue;
        }
        if (!email) {
            results.push({ report_id: informe.id, sent: false, channel: 'none', reason: 'destinatario sin correo' });
            continue;
        }

        // F4 (vista dedicada) ya existe para menores —
        // /children/:id/reports/:reportId (ChildReportDetailPage), con PDF al
        // vuelo. Para atleta adulto (subject_type='profile') todavía no hay
        // página propia, así que sigue cayendo a la evolución general.
        const link = informe.subject_type === 'child'
            ? `${FRONTEND_URL}/children/${informe.subject_id}/reports/${informe.id}`
            : `${FRONTEND_URL}/stats`;

        const { subject, html } = renderReportEmail(snapshot, link);
        batch.push({ to: email, subject, html });
        enviados.push(informe.id);

        notificaciones.push({
            user_id: informe.recipient_id,
            school_id: schoolId,
            type: 'report',
            title: subject,
            message: `Ya está disponible el informe de ${snapshot.period.label}.`,
            link: informe.subject_type === 'child'
                ? `/children/${informe.subject_id}/reports/${informe.id}`
                : '/stats',
        });

        results.push({ report_id: informe.id, sent: true, channel: 'email' });
    }

    if (batch.length > 0) {
        const envio = await sendEmailBatch(batch);

        if (!envio.ok) {
            // No se marca sent_at: si falla el lote, estos informes se reintentan
            // en la próxima corrida. Marcarlos igual los perdería en silencio.
            return {
                results: results.map((r) =>
                    r.sent ? { ...r, sent: false, channel: 'none', reason: `error de envío: ${envio.error}` } : r,
                ),
                sent: 0,
                skipped: results.length,
            };
        }

        await supabase
            .from('athlete_reports')
            .update({ sent_at: new Date().toISOString() })
            .in('id', enviados);

        // La notificación in-app dispara el push por el trigger que ya existe
        // sobre `notifications` (despachador unificado). Si falla, el correo ya
        // salió: no se revierte el envío por eso.
        if (notificaciones.length > 0) {
            const { error: notifErr } = await supabase.from('notifications').insert(notificaciones);
            if (notifErr) console.error('[informes] no se pudo encolar la notificación in-app:', notifErr.message);
        }
    }

    return {
        results,
        sent: enviados.length,
        skipped: results.length - enviados.length,
    };
}
