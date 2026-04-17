import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';

const router = Router();

router.use(requireMarketplaceAuth);

const EPAYCO_APIFY_URL = 'https://apify.epayco.co';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getEpaycoToken(): Promise<string> {
    const publicKey = process.env.EPAYCO_PUBLIC_KEY;
    const privateKey = process.env.EPAYCO_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        throw new Error('Credenciales de ePayco no configuradas.');
    }

    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

    const res = await fetch(`${EPAYCO_APIFY_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${credentials}`,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ePayco login failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    if (!data.token) throw new Error('ePayco login response missing token');
    return data.token;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const ServiceCheckoutSchema = z.object({
    appointmentId: z.string().uuid(),
    serviceListingId: z.string().uuid().optional(),
    serviceVariationId: z.string().uuid().optional(),
});

const EventCheckoutSchema = z.object({
    eventRegistrationId: z.string().uuid(),
});

const SubscriptionCheckoutSchema = z.object({
    planId: z.string().uuid(),
});

const GenericPaySchema = z.object({
    transactionId: z.string().uuid(),
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/service — Checkout para citas de servicio (fisio, coach, etc)
// Paso 1: Crea transaccion en BD via RPC
// Paso 2: Crea sesion ePayco y retorna sessionId al frontend
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/service', async (req: Request, res: Response) => {
    try {
        const parsed = ServiceCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { appointmentId, serviceListingId, serviceVariationId } = parsed.data;

        // Llamar RPC que calcula comisiones y crea transaccion
        const { data: result, error } = await supabase.rpc('create_service_checkout', {
            p_appointment_id: appointmentId,
            p_service_listing_id: serviceListingId || null,
            p_service_variation_id: serviceVariationId || null,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_service_checkout RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando checkout.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        // Cortesia — no necesita ePayco
        if (result.is_courtesy) {
            await auditLog(req, 'service_courtesy', 'marketplace_transactions', result.transaction_id);
            return res.status(200).json({ ok: true, data: result });
        }

        // Crear sesion ePayco para cobro
        const sessionData = await createEpaycoSession({
            transactionId: result.transaction_id,
            amount: result.amount,
            description: `Cita de servicio — SportMaps`,
            userId: req.user.id,
        });

        await auditLog(req, 'service_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                sessionId: sessionData.sessionId,
                token: sessionData.token,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in service checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/event — Checkout para inscripcion individual a evento
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/event', async (req: Request, res: Response) => {
    try {
        const parsed = EventCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { eventRegistrationId } = parsed.data;

        const { data: result, error } = await supabase.rpc('create_event_checkout', {
            p_event_registration_id: eventRegistrationId,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_event_checkout RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando checkout.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        // Evento gratuito
        if (result.is_free) {
            await auditLog(req, 'event_free_registration', 'marketplace_transactions', result.transaction_id);
            return res.status(200).json({ ok: true, data: result });
        }

        const sessionData = await createEpaycoSession({
            transactionId: result.transaction_id,
            amount: result.amount,
            description: `Inscripción evento — SportMaps`,
            userId: req.user.id,
        });

        await auditLog(req, 'event_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                sessionId: sessionData.sessionId,
                token: sessionData.token,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in event checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/subscription — Checkout para suscripcion (escuela, paquete)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/subscription', async (req: Request, res: Response) => {
    try {
        const parsed = SubscriptionCheckoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { planId } = parsed.data;

        const { data: result, error } = await supabase.rpc('create_subscription', {
            p_plan_id: planId,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_subscription RPC failed');
            return res.status(500).json({ ok: false, error: 'Error creando suscripción.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        // Trial — no cobrar ahora
        if (result.is_trial) {
            await auditLog(req, 'subscription_trial', 'subscriptions', result.subscription_id);
            return res.status(200).json({ ok: true, data: result });
        }

        const sessionData = await createEpaycoSession({
            transactionId: result.transaction_id,
            amount: result.amount,
            description: `Suscripción — SportMaps`,
            userId: req.user.id,
        });

        await auditLog(req, 'subscription_checkout', 'marketplace_transactions', result.transaction_id, null, {
            amount: result.amount,
            subscription_id: result.subscription_id,
        });

        return res.status(201).json({
            ok: true,
            data: {
                ...result,
                sessionId: sessionData.sessionId,
                token: sessionData.token,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in subscription checkout');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /checkout/pay — Pagar transaccion existente (ej: renovacion de sub)
// Para cuando ya existe la marketplace_transaction pero no se ha pagado.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout/pay', async (req: Request, res: Response) => {
    try {
        const parsed = GenericPaySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos inválidos' });
        }

        const { transactionId } = parsed.data;

        // Verificar que la transaccion pertenece al usuario y esta pendiente
        const { data: tx, error: txErr } = await supabase
            .from('marketplace_transactions')
            .select('id, gross_amount, status, description')
            .eq('id', transactionId)
            .eq('user_id', req.user.id)
            .eq('status', 'pending')
            .single();

        if (txErr || !tx) {
            return res.status(404).json({ ok: false, error: 'Transacción no encontrada o ya procesada.' });
        }

        const sessionData = await createEpaycoSession({
            transactionId: tx.id,
            amount: tx.gross_amount,
            description: tx.description || 'Pago SportMaps',
            userId: req.user.id,
        });

        return res.status(201).json({
            ok: true,
            data: {
                transaction_id: tx.id,
                amount: tx.gross_amount,
                sessionId: sessionData.sessionId,
                token: sessionData.token,
            },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error in generic pay');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /refund — Solicitar reembolso
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refund', async (req: Request, res: Response) => {
    try {
        const { transactionId, reason } = req.body;

        if (!transactionId || !reason) {
            return res.status(400).json({ ok: false, error: 'transactionId y reason son requeridos.' });
        }

        const { data: result, error } = await supabase.rpc('request_refund', {
            p_transaction_id: transactionId,
            p_reason: reason,
        });

        if (error) {
            req.log?.error({ err: error }, 'request_refund RPC failed');
            return res.status(500).json({ ok: false, error: 'Error solicitando reembolso.' });
        }

        if (!result?.ok) {
            return res.status(400).json({ ok: false, error: result?.error || 'Error desconocido' });
        }

        await auditLog(req, 'refund_request', 'refunds', result.refund_id, null, {
            amount: result.refund_amount,
            pct: result.refund_pct,
        });

        return res.json({ ok: true, data: result });
    } catch (err: any) {
        req.log?.error({ err }, 'Error requesting refund');
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /transactions — Mis transacciones del marketplace
// ─────────────────────────────────────────────────────────────────────────────
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        const { type, status, page = '1', limit = '20' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let query = supabase
            .from('marketplace_transactions')
            .select('*', { count: 'exact' })
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (type) query = query.eq('checkout_type', type as string);
        if (status) query = query.eq('status', status as string);

        const { data, error, count } = await query;

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo transacciones.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriptions — Mis suscripciones activas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/subscriptions', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select(`
                *,
                subscription_plans (id, name, description, plan_type, price, billing_period, features)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo suscripciones.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /subscriptions/:id/cancel — Cancelar suscripcion
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/subscriptions/:id/cancel', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { reason, cancelImmediately } = req.body;

        const { data: sub, error: subErr } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('id', id)
            .eq('user_id', req.user.id)
            .single();

        if (subErr || !sub) {
            return res.status(404).json({ ok: false, error: 'Suscripción no encontrada.' });
        }

        if (sub.status === 'cancelled') {
            return res.status(400).json({ ok: false, error: 'Suscripción ya está cancelada.' });
        }

        const updates: Record<string, unknown> = {
            cancellation_reason: reason || null,
        };

        if (cancelImmediately) {
            updates.status = 'cancelled';
            updates.cancelled_at = new Date().toISOString();
        } else {
            updates.cancel_at_period_end = true;
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error cancelando suscripción.' });
        }

        await auditLog(req, 'subscription_cancel', 'subscriptions', id as string, null, {
            immediate: !!cancelImmediately,
        });

        return res.json({
            ok: true,
            data,
            message: cancelImmediately
                ? 'Suscripción cancelada inmediatamente.'
                : 'La suscripción se cancelará al final del periodo actual.',
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});


// ── Internal: createEpaycoSession ────────────────────────────────────────────
// Crea sesion de checkout en ePayco para cualquier tipo de marketplace_transaction.

async function createEpaycoSession(params: {
    transactionId: string;
    amount: number;
    description: string;
    userId: string;
}): Promise<{ sessionId: string; token: string }> {
    const epaycoToken = await getEpaycoToken();

    const bffUrl = process.env.BFF_URL || 'https://sportmaps-bff.onrender.com';
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

    const sessionRes = await fetch(`${EPAYCO_APIFY_URL}/payment/session/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${epaycoToken}`,
        },
        body: JSON.stringify({
            checkout_version: '2',
            name: params.description,
            description: params.description,
            currency: 'COP',
            amount: String(params.amount),
            tax: '0',
            tax_base: String(params.amount),
            invoice: params.transactionId,
            confirmation: `${bffUrl}/api/v1/webhooks/epayco/marketplace`,
            response: `${frontendUrl}/marketplace/confirmacion`,
            extras: {
                extra1: params.transactionId,  // marketplace_transaction.id
                extra2: 'marketplace',          // identifica que es del marketplace unificado
                extra3: params.userId,
            },
        }),
    });

    if (!sessionRes.ok) {
        const errBody = await sessionRes.text();
        throw new Error(`ePayco session create failed: ${errBody}`);
    }

    const sessionData = await sessionRes.json();
    const sessionId = sessionData.data?.sessionId || sessionData.sessionId;

    if (!sessionId) {
        throw new Error('ePayco no retornó un ID de sesión válido.');
    }

    // Guardar sessionId en la transaccion
    const token = crypto.randomBytes(32).toString('hex');

    await supabase
        .from('marketplace_transactions')
        .update({ epayco_session_id: sessionId, metadata: { token } })
        .eq('id', params.transactionId);

    return { sessionId, token };
}

export default router;
