/**
 * paymentFailureEmail.service — correo (además del in-app de
 * `notify_payment_attempt_failed`) cuando un intento de pago online es
 * rechazado. Mismo evento, canal adicional para quien no vive pendiente
 * de la app: un acudiente y el dueño de la escuela.
 *
 * Fire-and-forget: si el correo falla, el registro del intento fallido
 * (payments.last_failure_reason, payment_links.status) ya quedó igual.
 */

import type { Logger } from 'pino';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { BrandedEmailTemplates } from '../utils/emailTemplates';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';
const fmtCop = (n?: number | null) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const PAYMENT_SELECT =
    'school_id, concept, amount, ' +
    'child:children!payments_child_id_fkey(full_name), ' +
    'parent:profiles!payments_parent_id_fkey(full_name, email)';

export async function sendPaymentAttemptFailedEmails(
    paymentId: string,
    bankReason: string | null,
    ambiguous: boolean,
    log?: Logger,
): Promise<void> {
    try {
        const { data: p } = await supabase
            .from('payments')
            .select(PAYMENT_SELECT)
            .eq('id', paymentId)
            .single();
        if (!p) return;

        const parent: any = (p as any).parent;
        const child: any = (p as any).child;
        const schoolId = (p as any).school_id as string | null;
        const concept = (p as any).concept || 'tu cobro';
        const amount = fmtCop((p as any).amount);

        if (parent?.email) {
            const tpl = ambiguous
                ? await BrandedEmailTemplates.paymentAttemptAmbiguous({
                      parentName: parent.full_name || 'Acudiente',
                      concept,
                      amount,
                      link: `${FRONTEND_URL}/my-payments`,
                      schoolId,
                  })
                : await BrandedEmailTemplates.paymentAttemptFailed({
                      parentName: parent.full_name || 'Acudiente',
                      concept,
                      amount,
                      bankReason,
                      link: `${FRONTEND_URL}/my-payments`,
                      schoolId,
                  });
            await emailClient.send({ to: parent.email, subject: tpl.subject, html: tpl.html });
        }

        if (schoolId) {
            const { data: school } = await supabase.from('schools').select('owner_id').eq('id', schoolId).single();
            const ownerId = school?.owner_id as string | undefined;
            if (ownerId) {
                const { data: owner } = await supabase.from('profiles').select('email').eq('id', ownerId).single();
                if (owner?.email) {
                    const tpl = await BrandedEmailTemplates.paymentAttemptFailedSchoolAlert({
                        payerName: parent?.full_name || 'Un acudiente',
                        studentName: child?.full_name || null,
                        concept,
                        amount,
                        bankReason,
                        ambiguous,
                        link: `${FRONTEND_URL}/payments-automation`,
                        schoolId,
                    });
                    await emailClient.send({ to: owner.email, subject: tpl.subject, html: tpl.html });
                }
            }
        }
    } catch (err) {
        (log ?? console).warn?.({ err, paymentId }, '[payment-failure] email falló (no-bloqueante)');
    }
}
