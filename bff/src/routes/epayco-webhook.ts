import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Valida la firma SHA-256 del webhook de ePayco.
 *
 * Fórmula oficial:
 *   sha256(P_CUST_ID_CLIENTE ^ P_KEY ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
 *
 * El separador es el carácter caret (^), no XOR.
 */
function validateEpaycoSignature(body: Record<string, any>): boolean {
    const pCustId = process.env.EPAYCO_P_CUST_ID_CLIENT;
    const pKey = process.env.EPAYCO_P_KEY;

    if (!pCustId || !pKey) {
        console.error('[epayco-webhook] Missing EPAYCO_P_CUST_ID_CLIENT or EPAYCO_P_KEY');
        return false;
    }

    const {
        x_ref_payco,
        x_transaction_id,
        x_amount,
        x_currency_code,
        x_signature,
    } = body;

    if (!x_signature) return false;

    // Construir la cadena en el orden exacto que define ePayco
    const raw = `${pCustId}^${pKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
    const expectedHash = crypto.createHash('sha256').update(raw).digest('hex');

    return expectedHash === x_signature;
}

// ── POST /api/v1/webhooks/epayco ─────────────────────────────────────────────
// Llamado por ePayco cuando se completa una transacción.
// SIN autenticación (ePayco no envía nuestro JWT) — la firma SHA256 es la validación.
// SIN rate limit — ePayco puede reintentar N veces si no recibe 200.
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;

        req.log?.info(
            { x_ref_payco: body.x_ref_payco, x_transaction_state: body.x_transaction_state },
            'ePayco webhook received',
        );

        // ── 1. Validar firma SHA256 ──────────────────────────────────────────
        const signatureValid = validateEpaycoSignature(body);
        if (!signatureValid) {
            req.log?.warn({ x_ref_payco: body.x_ref_payco }, 'ePayco webhook signature mismatch');
            return res.status(401).json({ error: 'Firma inválida.' });
        }

        // ── 2. Verificar estado de la transacción ────────────────────────────
        // Solo procesamos transacciones aceptadas.
        // Estados posibles de ePayco: Aceptada, Rechazada, Pendiente, Fallida, Abandonada
        const txState = body.x_transaction_state;
        if (txState !== 'Aceptada') {
            req.log?.info(
                { x_ref_payco: body.x_ref_payco, txState },
                'ePayco webhook: transacción no aceptada, ignorando',
            );
            // Retornamos 200 para que ePayco no reintente
            return res.status(200).json({ received: true, processed: false, reason: `state=${txState}` });
        }

        const epaycoRef = body.x_ref_payco;
        const epaycoTxnId = body.x_transaction_id;
        const txAmount = parseFloat(body.x_amount);
        const paymentId = body.x_extra1; // pasamos el paymentId como extra1 en create-session
        const schoolId = body.x_extra2;

        // ── 3. Idempotencia — verificar si ya se procesó ─────────────────────
        const { data: existingSplit } = await supabase
            .from('payment_splits')
            .select('id')
            .eq('epayco_ref', epaycoRef)
            .maybeSingle();

        if (existingSplit) {
            req.log?.info({ epaycoRef }, 'ePayco webhook: transacción ya procesada (idempotente)');
            return res.status(200).json({ received: true, processed: false, reason: 'already_processed' });
        }

        // ── 4. Obtener el payment_link para verificar montos ─────────────────
        const { data: link, error: linkErr } = await supabase
            .from('payment_links')
            .select('id, payment_id, gross_amount, base_amount, sportmaps_fee, fee_pct, status, expires_at')
            .eq('payment_id', paymentId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (linkErr || !link) {
            req.log?.error({ paymentId, linkErr }, 'ePayco webhook: payment_link no encontrado');
            return res.status(400).json({ error: 'Payment link no encontrado.' });
        }

        // ── 5. Verificar que el link no esté expirado ────────────────────────
        if (new Date(link.expires_at) < new Date()) {
            req.log?.warn({ paymentId }, 'ePayco webhook: payment_link expirado');
            return res.status(400).json({ error: 'Payment link expirado.' });
        }

        // ── 6. Verificar monto (tolerancia de $1 por redondeo) ───────────────
        const expectedAmount = Number(link.gross_amount);
        if (Math.abs(txAmount - expectedAmount) > 1) {
            req.log?.error(
                { expected: expectedAmount, received: txAmount, paymentId },
                'ePayco webhook: monto no coincide',
            );
            return res.status(400).json({ error: 'El monto recibido no coincide.' });
        }

        // ── 7. UPDATE payments → status='paid', payment_channel='online' ─────
        const today = new Date().toISOString().split('T')[0];
        const { error: paymentUpdateErr } = await supabase
            .from('payments')
            .update({
                status: 'paid',
                payment_channel: 'online',
                payment_method: 'epayco',
                payment_date: today,
                approved_at: new Date().toISOString(),
                epayco_ref: epaycoRef,
                epayco_transaction_id: epaycoTxnId,
                gross_amount: txAmount,
                sportmaps_fee: link.sportmaps_fee,
                updated_at: new Date().toISOString(),
            })
            .eq('id', paymentId);

        if (paymentUpdateErr) {
            req.log?.error({ err: paymentUpdateErr, paymentId }, 'Error updating payment in webhook');
            return res.status(500).json({ error: 'Error al actualizar el pago.' });
        }

        // ── 8. UPDATE payment_links → status='paid' ─────────────────────────
        await supabase
            .from('payment_links')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', link.id);

        // ── 9. INSERT payment_splits ─────────────────────────────────────────
        const { error: splitErr } = await supabase
            .from('payment_splits')
            .insert({
                payment_id: paymentId,
                payment_link_id: link.id,
                epayco_ref: epaycoRef,
                epayco_transaction_id: epaycoTxnId,
                gross_amount: txAmount,
                school_receives: link.base_amount,
                sportmaps_receives: link.sportmaps_fee,
                epayco_fee: 0, // ePayco cobra su comisión pero no nos la dice en el webhook
                transfer_status: 'pending',
                raw_webhook: body,
                webhook_signature_valid: true,
            });

        if (splitErr) {
            req.log?.error({ err: splitErr }, 'Error inserting payment_split');
            // No retornamos error — el pago ya se marcó como pagado
        }

        req.log?.info(
            { paymentId, epaycoRef, amount: txAmount },
            'ePayco webhook: pago procesado exitosamente',
        );

        // ── 10. TODO: WhatsApp de confirmación al padre ──────────────────────
        // ── 11. TODO: WhatsApp de notificación a la escuela ──────────────────

        return res.status(200).json({ received: true, processed: true });
    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Unexpected error in ePayco webhook');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
