/**
 * receipt-approval.service — Evaluador post-insert de un comprobante (Fase 5).
 *
 * Corre después de que el frontend insertó el pago (patrón /auto-evaluate). Decide,
 * de forma SERVER-AUTHORITATIVE, entre: auto-aprobar / abrir glosa / dejar manual.
 * NO confía en el veredicto ni en los ocr_* que persistió el cliente: para aprobar
 * (mover plata) re-descarga la imagen REAL de storage, recomputa el hash, y re-extrae
 * con DOS providers distintos. Fire-and-forget: nunca rompe el flujo llamante.
 */

import crypto from 'crypto';
import type { Logger } from 'pino';
import { supabase } from '../config/supabase';
import { extractReceiptWith, listConfiguredProviders } from './ocr.service';
import { evaluateVerdict, normalizeReference } from './receipt-verdict';
import { buildVerdictContext } from './receipt-context.service';
import { autoCreateGlosaFromReasons, maybeAutoCreateGlosa } from './glosa.service';
import { emailClient } from '../utils/emailClient';
import { BrandedEmailTemplates } from '../utils/emailTemplates';

const fmtCop = (n?: number | null) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

function guessMime(path: string): string {
    const p = path.toLowerCase();
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.webp')) return 'image/webp';
    if (p.endsWith('.pdf')) return 'application/pdf';
    return 'image/png';
}

type PaymentRow = {
    id: string; school_id: string; status: string; amount: number;
    receipt_url: string | null; receipt_image_sha256: string | null;
    parent_id: string | null; child_id: string | null; team_id: string | null;
    concept: string | null; ocr_reference: string | null;
    receipt_verdict: string | null; receipt_verdict_reasons: unknown;
};

export interface EvaluateResult {
    action: 'approved' | 'glosa' | 'rejected' | 'none';
    glosaId?: string | null;
    /** Motivo del rechazo automático, listo para mostrar. Solo con action='rejected'. */
    reason?: string;
}

/** Forma mínima de una razón de veredicto tal como se persiste en jsonb. */
type ReasonLike = { code?: string; level?: string; message?: string; detail?: unknown };

/**
 * Traduce los motivos ROJOS a un texto que el acudiente pueda entender, nombrando
 * el dato concreto que no cuadró. Devuelve null si no hay ningún motivo rojo (y por
 * tanto no hay nada que rechazar).
 */
export function redRejectionMessage(reasons: ReasonLike[]): string | null {
    const red = reasons.filter((r) => r?.level === 'rojo' && r?.code);
    if (red.length === 0) return null;

    const parts = red.map((r) => {
        const d = (r.detail ?? {}) as Record<string, unknown>;
        switch (r.code) {
            case 'DESTINO_NO_COINCIDE': {
                const dest = typeof d.destination === 'string' ? d.destination : null;
                return dest
                    ? `el comprobante muestra un envío a la cuenta ${dest}, que no es ninguna de las cuentas registradas por la escuela`
                    : 'el dinero se envió a una cuenta que no está registrada por la escuela';
            }
            case 'NOT_A_RECEIPT':
                return 'el archivo no es un comprobante de pago';
            case 'IS_TRANSACTION_LIST':
                return 'el archivo es una lista de movimientos, no un comprobante individual';
            case 'REFERENCIA_DUPLICADA':
                return 'la referencia de ese comprobante ya se usó en otro pago';
            case 'IMAGEN_DUPLICADA':
                return 'esa imagen de comprobante ya se había subido antes';
            case 'FECHA_FUTURA':
                return 'el comprobante tiene una fecha futura';
            default:
                return r.message || String(r.code);
        }
    });

    return `Rechazado automáticamente: ${parts.join('; ')}.`;
}

/**
 * Rechaza el pago por veredicto ROJO, dejando el motivo en `rejection_reason` y
 * avisando al acudiente. El UPDATE exige que el pago siga en `awaiting_approval`:
 * si el admin ya lo aprobó o rechazó a mano, no se pisa su decisión.
 *
 * El rechazo libera el comprobante para reintento: el índice único de dedup por
 * hash excluye los pagos rechazados, así que el acudiente puede subir el correcto.
 *
 * Devuelve null si no había motivo rojo o si el UPDATE no alcanzó ninguna fila.
 */
async function autoRejectRed(p: PaymentRow, reasons: ReasonLike[], log?: Logger): Promise<EvaluateResult | null> {
    const message = redRejectionMessage(reasons);
    if (!message) return null;

    const { data, error } = await supabase
        .from('payments')
        .update({ status: 'rejected', rejection_reason: message })
        .eq('id', p.id)
        .eq('status', 'awaiting_approval')
        .select('id');

    if (error || !data || data.length === 0) {
        (log ?? console).warn?.(
            { paymentId: p.id, code: (error as { code?: string } | null)?.code },
            '[auto-reject] no se aplicó (el admin ya actuó o falló el update) → queda manual',
        );
        return null;
    }

    if (p.parent_id) {
        // Insert directo, NO el RPC notify_user: ese exige auth.uid() y lanza
        // "No autenticado" con el cliente service-role del BFF. Mismo patrón que
        // glosa-notifications.job. La columna es `message`, no `body`.
        const { error: notifyErr } = await supabase.from('notifications').insert({
            user_id: p.parent_id,
            school_id: p.school_id,
            type: 'error',
            title: '❌ Comprobante rechazado',
            message: `${message} Revisa los datos de pago de la escuela y vuelve a intentarlo.`,
            link: '/my-payments',
        });
        if (notifyErr) {
            (log ?? console).warn?.({ paymentId: p.id, code: notifyErr.code }, '[auto-reject] notificación falló');
        }
    }

    (log ?? console).info?.({ paymentId: p.id, reason: message }, '[auto-reject] rechazado por veredicto rojo');
    return { action: 'rejected', reason: message };
}

export async function evaluatePaymentReceipt(paymentId: string, log?: Logger): Promise<EvaluateResult> {
    try {
        const { data: pay } = await supabase
            .from('payments')
            .select('id, school_id, status, amount, receipt_url, receipt_image_sha256, parent_id, child_id, team_id, concept, ocr_reference, receipt_verdict, receipt_verdict_reasons')
            .eq('id', paymentId)
            .single();
        if (!pay || (pay as PaymentRow).status !== 'awaiting_approval') return { action: 'none' };
        const p = pay as PaymentRow;

        const { data: settings } = await supabase
            .from('school_settings')
            .select('auto_approve_enabled, auto_approve_max_amount')
            .eq('school_id', p.school_id)
            .single();

        const amount = Number(p.amount);
        const cap = Number(settings?.auto_approve_max_amount ?? 0);
        const autoApproveEligible = !!settings?.auto_approve_enabled && cap > 0 && amount <= cap;

        const path = typeof p.receipt_url === 'string' ? p.receipt_url : null;
        const downloadable = !!path && !path.toLowerCase().startsWith('http');
        const mime = downloadable ? guessMime(path!) : '';

        // ── Camino AUTO-APPROVE (solo si elegible + imagen descargable, no PDF) ──
        if (autoApproveEligible && downloadable && mime !== 'application/pdf') {
            const { data: blob, error: dlErr } = await supabase.storage.from('payment-receipts').download(path!);
            if (!dlErr && blob) {
                const buf = Buffer.from(await blob.arrayBuffer());
                const base64 = buf.toString('base64');
                const realHash = crypto.createHash('sha256').update(buf).digest('hex');

                // Fix seguridad: sobrescribe el hash con el REAL. Si choca el índice único
                // (otra fila no-terminal con ese hash) → imagen reusada → NO auto-aprueba.
                if (realHash !== p.receipt_image_sha256) {
                    const { error: upErr } = await supabase
                        .from('payments')
                        .update({ receipt_image_sha256: realHash, receipt_image_sha256_source: 'server_verified' })
                        .eq('id', paymentId);
                    if (upErr) {
                        (log ?? console).warn?.({ paymentId, code: (upErr as { code?: string }).code }, '[auto-approve] hash real duplicado/upd falló → manual');
                        return await glosaFallback(p, log);
                    }
                }

                const providers = listConfiguredProviders();
                const providerA = providers[0];
                if (providerA) {
                    const ocrA = await extractReceiptWith(providerA, base64, mime);
                    const ctx = await buildVerdictContext(p.school_id, {
                        referenceNorm: normalizeReference(ocrA.reference),
                        imageSha256: realHash,
                        expectedAmount: amount,
                        paymentId, // excluir el propio pago del dedup (si no, se marca dup contra sí mismo)
                    });
                    const verdictA = evaluateVerdict(ocrA, ctx);

                    // ROJO recomputado por el servidor (imagen real re-descargada y
                    // re-extraída): rechazo automático. Es el veredicto más confiable
                    // que tenemos, así que aquí no hay razón para dejarlo esperando.
                    if (verdictA.verdict === 'rojo') {
                        const rejected = await autoRejectRed(p, verdictA.reasons, log);
                        if (rejected) return rejected;
                    }

                    if (verdictA.verdict === 'verde') {
                        const providerB = providers.find((x) => x !== providerA);
                        if (providerB) {
                            const ocrB = await extractReceiptWith(providerB, base64, mime);
                            const sameAmount = ocrA.amount != null && ocrA.amount === ocrB.amount;
                            const sameRef = normalizeReference(ocrA.reference) === normalizeReference(ocrB.reference);
                            if (sameAmount && sameRef) {
                                const { data: approved } = await supabase.rpc('auto_approve_payment', { p_payment_id: paymentId });
                                if (approved === true) {
                                    await sendApprovalEmail(p, log);
                                    (log ?? console).info?.({ paymentId, providerA, providerB }, '[auto-approve] aprobado');
                                    return { action: 'approved' };
                                }
                                return { action: 'none' }; // RPC no-op (el admin ya actuó / carrera)
                            }
                            // Doble extracción inconsistente → LECTURA_INCONSISTENTE → glosa (server reasons)
                            const gid = await autoCreateGlosaFromReasons(paymentId, p.school_id,
                                [{ code: 'LECTURA_INCONSISTENTE', level: 'amarillo', detail: { a: ocrA.amount, b: ocrB.amount } }], log);
                            return { action: gid ? 'glosa' : 'none', glosaId: gid };
                        }
                        // Sin 2º provider no se puede confirmar → no auto-aprueba (manual).
                        return { action: 'none' };
                    }

                    // Verde no confirmado por el servidor → glosa con los motivos REALES.
                    const gid = await autoCreateGlosaFromReasons(paymentId, p.school_id, verdictA.reasons, log);
                    return { action: gid ? 'glosa' : 'none', glosaId: gid };
                }
            }
        }

        // ── Fallback: auto-approve apagado / PDF / no descargable → glosa por veredicto persistido ──
        return await glosaFallback(p, log);
    } catch (err) {
        (log ?? console).warn?.({ err, paymentId }, '[auto-approve] evaluate falló');
        return { action: 'none' };
    }
}

async function glosaFallback(p: PaymentRow, log?: Logger): Promise<EvaluateResult> {
    // Camino sin re-extracción (auto-approve apagado, PDF, o imagen no descargable):
    // se decide con el veredicto ya persistido. Ese veredicto lo computó el BFF en
    // /extract-receipt — el cliente solo lo relaya — y para RECHAZAR el sesgo juega
    // a favor: un cliente hostil nunca se auto-rechaza. Antes un ROJO caía en
    // maybeAutoCreateGlosa, que solo mapea motivos AMARILLOS y además exige
    // auto_glosa_enabled, así que devolvía null y el comprobante se quedaba mudo
    // en la cola esperando a que alguien lo viera.
    if (p.receipt_verdict === 'rojo') {
        const reasons = Array.isArray(p.receipt_verdict_reasons) ? (p.receipt_verdict_reasons as ReasonLike[]) : [];
        const rejected = await autoRejectRed(p, reasons, log);
        if (rejected) return rejected;
    }
    const gid = await maybeAutoCreateGlosa(p.id, log);
    return { action: gid ? 'glosa' : 'none', glosaId: gid };
}

async function sendApprovalEmail(p: PaymentRow, log?: Logger): Promise<void> {
    try {
        if (!p.parent_id) return;
        const { data: parent } = await supabase.from('profiles').select('full_name, email').eq('id', p.parent_id).single();
        if (!parent?.email) return;
        const tpl = await BrandedEmailTemplates.paymentConfirmation({
            parentName: parent.full_name || 'Acudiente',
            amount: fmtCop(p.amount),
            concept: p.concept || 'tu pago',
            receiptNumber: p.ocr_reference || String(p.id).slice(0, 8).toUpperCase(),
            schoolId: p.school_id,
        });
        await emailClient.send({ to: parent.email, subject: tpl.subject, html: tpl.html });
    } catch (err) {
        (log ?? console).warn?.({ err, paymentId: p.id }, '[auto-approve] email de aprobación falló');
    }
}
