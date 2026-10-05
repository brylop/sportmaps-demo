/**
 * Estado de cuenta por correo: UN correo por familia con todo lo que debe
 * (vencido + pendiente del mes), en vez de un aviso por cobro.
 *
 *   cd bff
 *   npx tsx scripts/enviar-estado-de-cuenta.ts --escuela <school_id>            # simulación: no manda nada
 *   npx tsx scripts/enviar-estado-de-cuenta.ts --escuela <school_id> --aplicar  # manda
 *
 * Por qué un solo correo: la Ley 2300 de 2023 limita el contacto de cobranza a
 * uno por día. Dynasty (2026-10-05) tenía 462 cobros de octubre pendientes y
 * 353 vencidos; mandar el recordatorio y el de vencidos por separado eran dos
 * contactos el mismo día para la misma familia.
 *
 * Frenos:
 *   - Horario de cobranza (L-V 7-19, sábado 8-15, nunca domingos ni festivos).
 *   - Se salta a quien ya recibió un aviso de cobro o de vencido HOY.
 *   - Idempotente por familia y día: id determinístico en email_sends. Correrlo
 *     dos veces (o desde dos máquinas) no duplica.
 *   - Cobros duplicados por pagador (findDuplicatePaymentIds) no se listan.
 */

import 'dotenv/config';
import { supabase } from '../src/config/supabase';
import { emailClient } from '../src/utils/emailClient';
import { buildBrandedEmail } from '../src/utils/emailLayout';
import { resolveSchoolBranding, escapeHtml } from '../src/utils/schoolBrandingResolver';
import { findDuplicatePaymentIds } from '../src/services/duplicatePayerGuard.service';
import { dentroDeHorarioDeCobranza } from '../src/services/whatsapp-plantillas.service';
import { reservarEnvio, cerrarEnvio, fechaColombia } from '../src/services/avisos-correo.service';

const TIPO = 'estado_de_cuenta';

function arg(nombre: string): string | undefined {
    const i = process.argv.indexOf(nombre);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const fmtCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fechaCorta = (d: string | null) => d
    ? new Date(`${d.slice(0, 10)}T12:00:00-05:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
    : '—';

async function todas<T>(q: (desde: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
    const out: T[] = [];
    for (let desde = 0; ; desde += 1000) {
        const { data, error } = await q(desde);
        if (error) throw new Error(error.message);
        out.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return out;
    }
}

async function main() {
    const schoolId = arg('--escuela');
    const aplicar = process.argv.includes('--aplicar');
    if (!schoolId) throw new Error('Falta --escuela <school_id>');

    const ahora = new Date();
    if (aplicar && !dentroDeHorarioDeCobranza(ahora)) {
        throw new Error('Fuera del horario de cobranza (Ley 2300). No se manda nada.');
    }
    const hoy = fechaColombia(ahora);
    const inicioHoy = new Date(`${hoy}T00:00:00-05:00`).toISOString();

    const pagos = await todas<any>((desde) => supabase.from('payments')
        .select('id, school_id, parent_id, user_id, child_id, unregistered_athlete_id, concept, amount, amount_paid, status, due_date, charge_notice_sent_at, overdue_notice_sent_at')
        .eq('school_id', schoolId).in('status', ['pending', 'overdue', 'partial'])
        .order('due_date').range(desde, desde + 999));

    const duplicados = new Set(await findDuplicatePaymentIds(schoolId, pagos as any));
    const vivos = pagos.filter((p) => !duplicados.has(p.id));

    // Contacto: mismo criterio que payment-lifecycle-emails (resolveContacts).
    const perfilIds = [...new Set(vivos.map((p) => p.parent_id || p.user_id).filter(Boolean))];
    const childIds = [...new Set(vivos.map((p) => p.child_id).filter(Boolean))];
    const unregIds = [...new Set(vivos.map((p) => p.unregistered_athlete_id).filter(Boolean))];
    const trozos = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / 200) }, (_, i) => a.slice(i * 200, i * 200 + 200));
    const leer = async (tabla: string, cols: string, ids: string[]) =>
        (await Promise.all(trozos(ids).map((t) => supabase.from(tabla).select(cols).in('id', t))))
            .flatMap((r) => (r.data ?? []) as any[]);
    const [perfiles, hijos, noReg] = await Promise.all([
        leer('profiles', 'id, full_name, email', perfilIds as string[]),
        leer('children', 'id, full_name', childIds as string[]),
        leer('unregistered_athletes', 'id, full_name, email', unregIds as string[]),
    ]);
    const perfilM = new Map(perfiles.map((x) => [x.id, x]));
    const hijoM = new Map(hijos.map((x) => [x.id, x]));
    const noRegM = new Map(noReg.map((x) => [x.id, x]));

    type Familia = { email: string; nombre: string; filas: any[]; avisadaHoy: boolean };
    const familias = new Map<string, Familia>();
    let sinCorreo = 0;
    for (const p of vivos) {
        const perfil = perfilM.get(p.parent_id || p.user_id || '');
        const nr = noRegM.get(p.unregistered_athlete_id || '');
        const email = String(perfil?.email || nr?.email || '').trim().toLowerCase();
        if (!email.includes('@')) { sinCorreo++; continue; }
        const f = familias.get(email) ?? { email, nombre: perfil?.full_name || nr?.full_name || 'Familia', filas: [], avisadaHoy: false };
        const saldo = Number(p.amount || 0) - (p.status === 'partial' ? Number(p.amount_paid || 0) : 0);
        f.filas.push({
            atleta: hijoM.get(p.child_id || '')?.full_name || nr?.full_name || perfil?.full_name || '',
            concepto: p.concept || 'Cobro', vence: p.due_date, saldo,
            vencido: p.status === 'overdue' || (p.due_date && p.due_date < hoy),
        });
        if ((p.charge_notice_sent_at && p.charge_notice_sent_at >= inicioHoy)
            || (p.overdue_notice_sent_at && p.overdue_notice_sent_at >= inicioHoy)) f.avisadaHoy = true;
        familias.set(email, f);
    }

    const branding = await resolveSchoolBranding(schoolId);
    const frontend = (process.env.FRONTEND_URL || 'https://app.sportmaps.co').replace(/\/$/, '');
    const escuela = branding.schoolName.replace(/&amp;/g, '&');

    let enviados = 0, yaHoy = 0, duplicadoLog = 0, fallos = 0, total = 0;
    for (const f of familias.values()) {
        const deuda = f.filas.reduce((s, r) => s + r.saldo, 0);
        if (deuda <= 0) continue;
        total += deuda;
        if (f.avisadaHoy) { yaHoy++; continue; }
        if (!aplicar) continue;

        const vencido = f.filas.filter((r) => r.vencido).reduce((s, r) => s + r.saldo, 0);
        const filasHtml = f.filas.map((r) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.atleta)}<br><span style="color:#666;font-size:12px;">${escapeHtml(r.concepto)}</span></td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;white-space:nowrap;">${fechaCorta(r.vence)}${r.vencido ? '<br><span style="color:#b91c1c;font-size:12px;">Vencido</span>' : ''}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${fmtCop(r.saldo)}</td>
            </tr>`).join('');

        const html = buildBrandedEmail({
            branding,
            title: 'Tu estado de cuenta',
            greeting: `Hola ${escapeHtml(f.nombre)},`,
            bodyHtml: `
                <p>Este es el resumen de lo que tienes pendiente con <strong>${escapeHtml(escuela)}</strong>:</p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;margin:12px 0;">
                  <tr style="background:#f5f5f5;"><th align="left" style="padding:6px 8px;">Deportista / concepto</th><th align="left" style="padding:6px 8px;">Vence</th><th align="right" style="padding:6px 8px;">Valor</th></tr>
                  ${filasHtml}
                  <tr><td colspan="2" style="padding:8px;"><strong>Total</strong></td><td style="padding:8px;text-align:right;"><strong>${fmtCop(deuda)}</strong></td></tr>
                </table>
                ${vencido > 0 ? `<p style="color:#b91c1c;">De ese total, <strong>${fmtCop(vencido)}</strong> ya están vencidos.</p>` : ''}
                <p>Puedes pagar desde la app o enviar el comprobante de tu transferencia a la escuela.</p>`,
            cta: { label: 'Ver y pagar', url: `${frontend}/my-payments` },
            closingHtml: 'Si ya pagaste, ignora este mensaje: la escuela lo está revisando.',
        });

        const reserva = await reservarEnvio({ clave: `${TIPO}:${schoolId}:${f.email}:${hoy}`, tipo: TIPO, schoolId, refId: null, destinos: [f.email] });
        if (!reserva) { duplicadoLog++; continue; }
        const r = await emailClient.send({ to: f.email, subject: `Estado de cuenta — ${escuela}`, html });
        await cerrarEnvio(reserva, { ok: !!r.success && !(r as any).simulated, error: r.success ? undefined : String((r as any).error?.message ?? (r as any).error) });
        if (r.success && !(r as any).simulated) enviados++; else fallos++;
        await new Promise((res) => setTimeout(res, 600)); // Resend: ~2 req/s
    }

    console.log(JSON.stringify({
        modo: aplicar ? 'APLICADO' : 'SIMULACION', escuela, cobros: vivos.length, duplicados_excluidos: duplicados.size,
        familias_con_correo: familias.size, cobros_sin_correo: sinCorreo, ya_avisadas_hoy: yaHoy,
        enviados, ya_enviados_antes: duplicadoLog, fallos, deuda_total: fmtCop(total),
        horario_ok: dentroDeHorarioDeCobranza(ahora),
    }, null, 2));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
