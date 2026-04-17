import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * Valida la firma SHA-256 del webhook de ePayco.
 * Fórmula: sha256(P_CUST_ID ^ P_KEY ^ x_ref_payco ^ x_transaction_id ^ x_amount ^ x_currency_code)
 */
function validateEpaycoSignature(body: Record<string, any>): boolean {
    const pCustId = process.env.EPAYCO_P_CUST_ID_CLIENT;
    const pKey = process.env.EPAYCO_P_KEY;

    if (!pCustId || !pKey) {
        console.error('[epayco-mkt-webhook] Missing EPAYCO_P_CUST_ID_CLIENT or EPAYCO_P_KEY');
        return false;
    }

    const { x_ref_payco, x_transaction_id, x_amount, x_currency_code, x_signature } = body;
    if (!x_signature) return false;

    const raw = `${pCustId}^${pKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
    const expectedHash = crypto.createHash('sha256').update(raw).digest('hex');

    return expectedHash === x_signature;
}


// ── POST /api/v1/webhooks/epayco/marketplace ─────────────────────────────────
// Webhook unificado para pagos del marketplace (servicios, eventos, suscripciones).
// Diferente del webhook de /api/v1/webhooks/epayco que maneja pagos de escuelas.
router.post('/', async (req: Request, res: Response) => {
    try {
        const body = req.body;

        req.log?.info(
            { x_ref_payco: body.x_ref_payco, x_transaction_state: body.x_transaction_state },
            'ePayco marketplace webhook received',
        );

        // 1. Validar firma
        if (!validateEpaycoSignature(body)) {
            req.log?.warn({ x_ref_payco: body.x_ref_payco }, 'ePayco marketplace webhook signature mismatch');
            return res.status(401).json({ error: 'Firma inválida.' });
        }

        // 2. Solo procesar transacciones aceptadas
        if (body.x_transaction_state !== 'Aceptada') {
            req.log?.info(
                { x_ref_payco: body.x_ref_payco, state: body.x_transaction_state },
                'ePayco marketplace: transacción no aceptada',
            );
            return res.status(200).json({ received: true, processed: false, reason: `state=${body.x_transaction_state}` });
        }

        const epaycoRef = body.x_ref_payco;
        const transactionId = body.x_extra1;  // marketplace_transaction.id
        const source = body.x_extra2;          // 'marketplace'
        const txAmount = parseFloat(body.x_amount);

        // 3. Verificar que es del marketplace
        if (source !== 'marketplace') {
            req.log?.info({ source }, 'ePayco webhook not for marketplace, ignoring');
            return res.status(200).json({ received: true, processed: false, reason: 'not_marketplace' });
        }

        // 4. Idempotencia — verificar si ya se procesó
        const { data: existingTx } = await supabase
            .from('marketplace_transactions')
            .select('id, status, epayco_ref')
            .eq('epayco_ref', epaycoRef)
            .maybeSingle();

        if (existingTx) {
            req.log?.info({ epaycoRef }, 'ePayco marketplace: ya procesado (idempotente)');
            return res.status(200).json({ received: true, processed: false, reason: 'already_processed' });
        }

        // 5. Obtener transaccion pendiente
        const { data: tx, error: txErr } = await supabase
            .from('marketplace_transactions')
            .select('id, gross_amount, status')
            .eq('id', transactionId)
            .eq('status', 'pending')
            .single();

        if (txErr || !tx) {
            req.log?.error({ transactionId, txErr }, 'ePayco marketplace: transaction not found');
            return res.status(400).json({ error: 'Transacción no encontrada.' });
        }

        // 6. Verificar monto (tolerancia $1 por redondeo)
        if (Math.abs(txAmount - Number(tx.gross_amount)) > 1) {
            req.log?.error(
                { expected: tx.gross_amount, received: txAmount },
                'ePayco marketplace: monto no coincide',
            );
            return res.status(400).json({ error: 'Monto no coincide.' });
        }

        // 7. Confirmar pago via RPC unificada
        const { data: result, error: confirmErr } = await supabase.rpc('confirm_marketplace_payment', {
            p_transaction_id: transactionId,
            p_epayco_ref: epaycoRef,
            p_payment_method: 'epayco',
        });

        if (confirmErr) {
            req.log?.error({ err: confirmErr }, 'confirm_marketplace_payment RPC failed');
            return res.status(500).json({ error: 'Error confirmando pago.' });
        }

        req.log?.info(
            { transactionId, epaycoRef, amount: txAmount, checkout_type: result?.checkout_type },
            'ePayco marketplace: pago confirmado',
        );

        return res.status(200).json({ received: true, processed: true, result });
    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Unexpected error in ePayco marketplace webhook');
        return res.status(500).json({ error: 'Error interno.' });
    }
});

export default router;
