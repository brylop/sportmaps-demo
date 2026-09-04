/**
 * payment-lifecycle-emails.job — dos correos automáticos del ciclo de cobro,
 * apagados por defecto (`school_settings.charge_notifications_enabled`):
 *
 *   1. sendChargeCreatedEmails(): el cobro del mes ya está disponible.
 *      Dispara por *polling*, no desde dentro de `open_month()` — cubre
 *      tanto la apertura manual (botón) como el cron `auto_generate_payments`
 *      sin acoplarse a ninguna de las dos (ambas terminan en la misma fila
 *      `payments` con `charge_notice_sent_at IS NULL`).
 *   2. sendOverdueNoticeEmails(): el pago pasó los días de gracia y sigue sin
 *      pagarse. Corre después de `apply_late_fees()` (pg_cron), que es quien
 *      marca `status='overdue'` — este job solo agrega el correo.
 *
 * Ninguno de los dos reemplaza al `send_payment_reminders` in-app existente
 * (previo al vencimiento, gateado por `reminder_enabled`) — son momentos y
 * canales distintos.
 *
 * Idempotencia por CLAIM: se marca `*_notice_sent_at` inmediatamente después
 * de intentar el envío (falle o no) — mismo trade-off ya aceptado en
 * `glosa-notifications.job.ts`: se prioriza no duplicar sobre garantizar
 * entrega. Antes de enviar, se excluyen los cobros que
 * `duplicatePayerGuard` marca como ya pagados bajo una ficha gemela del
 * mismo atleta (el bug real que le llegó a familias al día en Dynasty,
 * ago-2026, cuando el envío era manual y sin este filtro).
 */

import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { BrandedEmailTemplates } from '../utils/emailTemplates';
import { findDuplicatePaymentIds } from '../services/duplicatePayerGuard.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

const fmtCop = (n?: number | null) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

interface PaymentRow {
    id: string;
    school_id: string;
    amount: number;
    due_date: string | null;
    concept: string | null;
    parent_id: string | null;
    child_id: string | null;
    user_id: string | null;
    unregistered_athlete_id: string | null;
    period_year: number | null;
    period_month: number | null;
}

interface Resolved {
    contactName: string;
    contactEmail: string | null;
    athleteName: string;
}

/** Contactos de un lote de pagos, mismo criterio que payment-reminders.ts:
 * menor → acudiente (parent_id → profiles); adulto → user_id → profiles;
 * no registrado → la tabla propia es el contacto. */
async function resolveContacts(payments: PaymentRow[]): Promise<Map<string, Resolved>> {
    const parentIds = [...new Set(payments.map(p => p.parent_id || p.user_id).filter(Boolean))] as string[];
    const childIds = [...new Set(payments.map(p => p.child_id).filter(Boolean))] as string[];
    const unregIds = [...new Set(payments.map(p => p.unregistered_athlete_id).filter(Boolean))] as string[];

    const [{ data: profiles }, { data: children }, { data: unregistered }] = await Promise.all([
        parentIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', parentIds) : Promise.resolve({ data: [] as any[] }),
        childIds.length ? supabase.from('children').select('id, full_name').in('id', childIds) : Promise.resolve({ data: [] as any[] }),
        unregIds.length ? supabase.from('unregistered_athletes').select('id, full_name, email').in('id', unregIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const childMap = new Map((children || []).map(c => [c.id, c]));
    const unregMap = new Map((unregistered || []).map(u => [u.id, u]));

    const out = new Map<string, Resolved>();
    for (const p of payments) {
        const profile = profileMap.get(p.parent_id || p.user_id || '');
        const child = childMap.get(p.child_id || '');
        const unreg = unregMap.get(p.unregistered_athlete_id || '');
        out.set(p.id, {
            contactName: (profile as any)?.full_name || (unreg as any)?.full_name || 'Familia',
            contactEmail: (profile as any)?.email || (unreg as any)?.email || null,
            athleteName: (child as any)?.full_name || (unreg as any)?.full_name || 'tu deportista',
        });
    }
    return out;
}

async function enabledSchoolIds(): Promise<string[]> {
    const { data } = await supabase
        .from('school_settings')
        .select('school_id')
        .eq('charge_notifications_enabled', true);
    return (data || []).map(r => r.school_id);
}

async function filterOutDuplicates(payments: PaymentRow[]): Promise<PaymentRow[]> {
    const bySchool = new Map<string, PaymentRow[]>();
    for (const p of payments) {
        if (!bySchool.has(p.school_id)) bySchool.set(p.school_id, []);
        bySchool.get(p.school_id)!.push(p);
    }
    const excluded = new Set<string>();
    for (const [schoolId, rows] of bySchool) {
        const ids = await findDuplicatePaymentIds(schoolId, rows);
        ids.forEach(id => excluded.add(id));
    }
    return payments.filter(p => !excluded.has(p.id));
}

export async function sendChargeCreatedEmails(): Promise<{ sent: number }> {
    let sent = 0;
    try {
        const schoolIds = await enabledSchoolIds();
        if (schoolIds.length === 0) return { sent: 0 };

        const { data: candidates, error } = await supabase
            .from('payments')
            .select('id, school_id, amount, due_date, concept, parent_id, child_id, user_id, unregistered_athlete_id, period_year, period_month')
            .eq('payment_type', 'subscription')
            .eq('status', 'pending')
            .is('charge_notice_sent_at', null)
            .in('school_id', schoolIds);
        if (error) throw error;
        if (!candidates || candidates.length === 0) return { sent: 0 };

        const toSend = await filterOutDuplicates(candidates as PaymentRow[]);
        const contacts = await resolveContacts(toSend);

        for (const p of toSend) {
            const contact = contacts.get(p.id);
            try {
                if (contact?.contactEmail) {
                    const tpl = await BrandedEmailTemplates.chargeCreated({
                        parentName: contact.contactName,
                        amount: fmtCop(p.amount),
                        childName: contact.athleteName,
                        concept: p.concept || 'Mensualidad',
                        dueDate: fmtDate(p.due_date),
                        paymentLink: `${FRONTEND_URL}/my-payments`,
                        schoolId: p.school_id,
                    });
                    await emailClient.send({ to: contact.contactEmail, subject: tpl.subject, html: tpl.html });
                    sent++;
                }
            } catch (e: unknown) {
                console.warn('[payment-lifecycle] correo de cobro generado falló', { paymentId: p.id, e });
            } finally {
                await supabase.from('payments').update({ charge_notice_sent_at: new Date().toISOString() }).eq('id', p.id);
            }
        }
    } catch (err: any) {
        console.error('[payment-lifecycle] sendChargeCreatedEmails falló:', err?.message || err);
    }
    if (sent > 0) console.log(`[payment-lifecycle] correos de cobro generado enviados=${sent}`);
    return { sent };
}

export async function sendOverdueNoticeEmails(): Promise<{ sent: number }> {
    let sent = 0;
    try {
        const schoolIds = await enabledSchoolIds();
        if (schoolIds.length === 0) return { sent: 0 };

        const { data: candidates, error } = await supabase
            .from('payments')
            .select('id, school_id, amount, due_date, concept, parent_id, child_id, user_id, unregistered_athlete_id, period_year, period_month')
            .eq('status', 'overdue')
            .is('overdue_notice_sent_at', null)
            .in('school_id', schoolIds);
        if (error) throw error;
        if (!candidates || candidates.length === 0) return { sent: 0 };

        const toSend = await filterOutDuplicates(candidates as PaymentRow[]);
        const contacts = await resolveContacts(toSend);

        for (const p of toSend) {
            const contact = contacts.get(p.id);
            try {
                if (contact?.contactEmail) {
                    const tpl = await BrandedEmailTemplates.paymentOverdue({
                        parentName: contact.contactName,
                        amount: fmtCop(p.amount),
                        childName: contact.athleteName,
                        dueDate: fmtDate(p.due_date),
                        paymentLink: `${FRONTEND_URL}/my-payments`,
                        schoolId: p.school_id,
                    });
                    await emailClient.send({ to: contact.contactEmail, subject: tpl.subject, html: tpl.html });
                    sent++;
                }
            } catch (e: unknown) {
                console.warn('[payment-lifecycle] correo de vencido falló', { paymentId: p.id, e });
            } finally {
                await supabase.from('payments').update({ overdue_notice_sent_at: new Date().toISOString() }).eq('id', p.id);
            }
        }
    } catch (err: any) {
        console.error('[payment-lifecycle] sendOverdueNoticeEmails falló:', err?.message || err);
    }
    if (sent > 0) console.log(`[payment-lifecycle] correos de vencido enviados=${sent}`);
    return { sent };
}
