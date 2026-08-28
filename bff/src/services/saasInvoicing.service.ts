// saasInvoicing.service — orquesta el envío del recibo SaaS de una escuela:
// genera el PDF si falta, lo sube a Storage, y notifica a los admins de la
// escuela por email + push in-app. El botón de WhatsApp es responsabilidad
// del frontend (patrón wa.me de frontend/src/lib/api/payment-reminders.ts) —
// acá solo se devuelven los datos para armarlo.

import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { resolveSchoolBranding } from '../utils/schoolBrandingResolver';
import { buildBrandedEmail } from '../utils/emailLayout';
import { generateSaasInvoicePdf, SaasInvoiceForPdf, loadActivePaymentAccounts } from './saasInvoicePdf.service';
import { ACADEMY_PLAN_NAMES } from './saasInvoicing.constants';

const INVOICE_BUCKET = 'saas-invoices';

export interface SendInvoiceResult {
    ok: boolean;
    pdfObjectPath: string;
    emailSent: boolean;
    pushSent: boolean;
    whatsapp: { phone: string | null; message: string } | null;
    error?: string;
}

async function ensurePdf(invoice: SaasInvoiceForPdf & { id: string; school_id: string; pdf_object_path: string | null }, schoolName: string): Promise<string> {
    if (invoice.pdf_object_path) return invoice.pdf_object_path;

    const pdfBuffer = await generateSaasInvoicePdf(invoice, schoolName);
    const objectPath = `${invoice.school_id}/${invoice.invoice_number}.pdf`;

    const { error: upErr } = await supabase.storage
        .from(INVOICE_BUCKET)
        .upload(objectPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw new Error(`pdf_upload_failed: ${upErr.message}`);

    const { error: updErr } = await supabase
        .from('school_subscription_invoices')
        .update({ pdf_object_path: objectPath })
        .eq('id', invoice.id);
    if (updErr) throw new Error(`pdf_path_save_failed: ${updErr.message}`);

    return objectPath;
}

/** Admins activos de la escuela (owner/admin) con email/teléfono, para email+push+wa.me. */
async function loadSchoolAdmins(schoolId: string) {
    const { data: members } = await supabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .in('role', ['owner', 'admin']);

    const profileIds = [...new Set((members || []).map((m: any) => m.profile_id).filter(Boolean))];
    if (profileIds.length === 0) return [];

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .in('id', profileIds);

    return profiles || [];
}

function formatCop(cents: number): string {
    return `$${Math.round(cents / 100).toLocaleString('es-CO')}`;
}

/** Texto plano para WhatsApp — una línea por cuenta activa. */
function formatAccountsForWhatsapp(accounts: Awaited<ReturnType<typeof loadActivePaymentAccounts>>): string {
    if (accounts.length === 0) return 'Escríbenos para confirmar el método de pago vigente.';
    return accounts
        .map((a) => `${a.label}: ${a.value} (a nombre de ${a.holder_name})`)
        .join('\n');
}

/** Filas de tabla HTML para el email — mismo dato que ya va en el PDF. */
function formatAccountsForEmail(accounts: Awaited<ReturnType<typeof loadActivePaymentAccounts>>): string {
    if (accounts.length === 0) {
        return '<p style="margin:4px 0;">Escríbenos para confirmar el método de pago vigente.</p>';
    }
    return accounts
        .map((a) => `
            <p style="margin:8px 0 0;"><strong>${a.label}:</strong> ${a.value}</p>
            <p style="margin:0; font-size:12px; color:#6b7280;">A nombre de ${a.holder_name}</p>
        `)
        .join('');
}

export type SaasInvoiceSendReason = 'new' | 'reminder_before' | 'reminder_due' | 'reminder_overdue';

const REASON_COPY: Record<SaasInvoiceSendReason, { title: string; intro: string }> = {
    new: { title: 'Nueva factura SportMaps', intro: 'Tienen una nueva factura de la mensualidad SaaS de SportMaps:' },
    reminder_before: { title: 'Recordatorio: factura por vencer', intro: 'Les recordamos que esta factura de SportMaps está por vencer:' },
    reminder_due: { title: 'Recordatorio: factura vence hoy', intro: 'Esta factura de SportMaps vence hoy:' },
    reminder_overdue: { title: 'Factura SportMaps vencida', intro: 'Esta factura de SportMaps ya venció. Por favor regularízala cuanto antes:' },
};

/**
 * Genera (si falta) el PDF de una factura y notifica a los admins de la
 * escuela por email + push. Idempotente en el sentido de que reintentar no
 * duplica el PDF (usa el que ya está subido); sí reenvía notificaciones.
 * `reason` solo cambia el copy (nueva factura vs. recordatorio en sus 3
 * etapas) — el contenido de datos es el mismo.
 */
export async function sendSaasInvoice(invoiceId: string, reason: SaasInvoiceSendReason = 'new'): Promise<SendInvoiceResult> {
    const { data: invoice, error: invErr } = await supabase
        .from('school_subscription_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (invErr || !invoice) {
        return { ok: false, pdfObjectPath: '', emailSent: false, pushSent: false, whatsapp: null, error: 'invoice_not_found' };
    }

    const { data: school } = await supabase
        .from('schools')
        .select('id, name')
        .eq('id', invoice.school_id)
        .single();
    const schoolName = school?.name || 'tu escuela';

    let pdfObjectPath: string;
    try {
        pdfObjectPath = await ensurePdf(invoice as any, schoolName);
    } catch (err: any) {
        return { ok: false, pdfObjectPath: '', emailSent: false, pushSent: false, whatsapp: null, error: err.message };
    }

    const admins = await loadSchoolAdmins(invoice.school_id);
    const accounts = await loadActivePaymentAccounts();
    const planName = ACADEMY_PLAN_NAMES[invoice.plan_code] ?? invoice.plan_code;
    const amountStr = formatCop(invoice.amount_cents);
    const dueDateStr = new Date(invoice.due_date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const invoiceLink = `${(process.env.FRONTEND_URL || 'https://app.sportmaps.co').replace(/\/$/, '')}/facturacion/recibo/${invoice.id}`;

    const copy = REASON_COPY[reason];

    // ── Email: branding SportMaps (schoolId null), no el de la escuela destinataria ──
    let emailSent = false;
    if (admins.some((a: any) => a.email)) {
        const branding = await resolveSchoolBranding(null);
        const html = buildBrandedEmail({
            branding,
            title: copy.title,
            greeting: `Hola equipo de ${schoolName},`,
            bodyHtml: `
                <p>${copy.intro}</p>
                <table cellpadding="0" cellspacing="0" border="0" width="100%"
                       style="background-color: #f3f4f6; border-radius: 8px; margin: 16px 0;">
                    <tr><td style="padding: 16px;">
                        <p style="margin:4px 0;"><strong>Plan:</strong> ${planName}</p>
                        <p style="margin:4px 0;"><strong>Valor:</strong> ${amountStr}</p>
                        <p style="margin:4px 0;"><strong>Vence:</strong> ${dueDateStr}</p>
                        <p style="margin:4px 0;"><strong>N.° factura:</strong> ${invoice.invoice_number}</p>
                    </td></tr>
                </table>
                <p style="margin:16px 0 4px; font-weight:bold;">Cómo pagar</p>
                ${formatAccountsForEmail(accounts)}
                <p style="margin:12px 0 0; font-size:12px; color:#6b7280;">
                    Envía el comprobante de pago por WhatsApp o correo para que confirmemos tu factura.
                </p>
            `,
            cta: { label: 'Ver factura y estado de pago', url: invoiceLink },
        });

        for (const admin of admins) {
            if (!admin.email) continue;
            const res = await emailClient.send({
                to: admin.email,
                subject: `${copy.title} — ${invoice.invoice_number} · ${amountStr}`,
                html,
            });
            if (res.success) emailSent = true;
        }
    }

    // ── Push in-app: insert en notifications, el dispatcher unificado hace el resto ──
    let pushSent = false;
    if (admins.length > 0) {
        const rows = admins.map((a: any) => ({
            user_id: a.id,
            school_id: invoice.school_id,
            type: 'saas_invoice',
            title: copy.title,
            message: `${planName} · ${amountStr} · vence ${dueDateStr}`,
            link: `/facturacion/recibo/${invoice.id}`,
        }));
        const { error: notifErr } = await supabase.from('notifications').insert(rows);
        pushSent = !notifErr;
    }

    await supabase
        .from('school_subscription_invoices')
        .update({
            sent_email_at: emailSent ? new Date().toISOString() : undefined,
            sent_push_at: pushSent ? new Date().toISOString() : undefined,
        })
        .eq('id', invoice.id);

    const firstAdminWithPhone = admins.find((a: any) => a.phone);
    const whatsapp = {
        phone: firstAdminWithPhone?.phone ?? null,
        message: `Hola ${schoolName}, les compartimos la factura SportMaps ${invoice.invoice_number} por ${amountStr} (vence ${dueDateStr}).\n\n`
            + `Cómo pagar:\n${formatAccountsForWhatsapp(accounts)}\n\n`
            + `Envíanos el comprobante por acá para confirmar tu pago. Detalle: ${invoiceLink}`,
    };

    return { ok: true, pdfObjectPath, emailSent, pushSent, whatsapp };
}

export async function getSignedInvoicePdfUrl(pdfObjectPath: string, expiresInSeconds = 600) {
    return supabase.storage.from(INVOICE_BUCKET).createSignedUrl(pdfObjectPath, expiresInSeconds);
}

export async function markInvoicePaid(invoiceId: string, markedByProfileId: string) {
    return supabase
        .from('school_subscription_invoices')
        .update({ status: 'paid', marked_paid_by: markedByProfileId, marked_paid_at: new Date().toISOString() })
        .eq('id', invoiceId)
        .select()
        .single();
}
