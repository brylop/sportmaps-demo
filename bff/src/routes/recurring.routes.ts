/**
 * recurring.routes — Suscripciones de cobro recurrente (debito automatico).
 *
 * Soporta dos modos en el mismo motor:
 *   - School mode (legacy): padre paga mensualidad a la escuela. Primer
 *     cobro el dia billing_day del mes siguiente (mes gratis hasta).
 *   - Vendor mode (multi-vendor, 2026-05-22): cliente paga suscripcion a
 *     un coach/wellness/organizer/store. Primer cobro inmediato (lo dispara
 *     el endpoint sincronamente); los siguientes segun billing_period del
 *     plan (weekly/biweekly/monthly/quarterly/yearly).
 *
 * Endpoints para el suscriptor:
 *  - POST   /api/v1/recurring/subscriptions              Crea sub. Acepta school O vendor.
 *  - GET    /api/v1/recurring/subscriptions              Lista las del usuario
 *  - POST   /api/v1/recurring/subscriptions/:id/pause    Pausa
 *  - POST   /api/v1/recurring/subscriptions/:id/resume   Reactiva
 *  - POST   /api/v1/recurring/subscriptions/:id/cancel   Cancela (no reactivable)
 *
 * Endpoints para el vendor (lectura del lado receptor):
 *  - GET    /api/v1/recurring/vendor/subscriptions       Lista las subs activas del vendor.
 *                                                        RLS filtra por dueno del vendor_profile.
 *
 * Endpoint del cron (no expuesto al usuario):
 *  - POST   /api/v1/recurring/run                        Ejecuta cobros vencidos.
 *                                                        Auth: header x-cron-secret == RECURRING_CRON_SECRET.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { runDueRecurringCharges, chargeRecurringSubscriptionById } from '../services/recurring-charges.service';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Una sub es a una escuela O a un vendor. XOR validado en Zod + DB.
const CreateSubSchema = z.object({
    // School mode
    schoolId: z.string().uuid().optional(),
    childId: z.string().uuid().optional(),
    programId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    // Vendor mode
    vendorProfileId: z.string().uuid().optional(),
    subscriptionPlanId: z.string().uuid().optional(),
    billingPeriod: z.enum(['weekly','biweekly','monthly','quarterly','yearly']).optional(),
    // Comunes
    paymentTokenId: z.string().uuid(),
    amount: z.number().positive(),
    billingDay: z.number().int().min(1).max(28).optional(),
    concept: z.string().max(120).optional(),
}).refine(
    (d) => Boolean(d.schoolId) !== Boolean(d.vendorProfileId),
    { message: 'Debes enviar schoolId O vendorProfileId, no ambos ni ninguno.' },
).refine(
    (d) => !d.vendorProfileId || !!d.subscriptionPlanId,
    { message: 'Para vendor mode se requiere subscriptionPlanId.' },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriptions — padre crea suscripcion con tarjeta guardada
// ─────────────────────────────────────────────────────────────────────────────

router.post(
    '/subscriptions',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = CreateSubSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos invalidos', details: parsed.error.issues });
        }

        const isVendorMode = !!parsed.data.vendorProfileId;

        const { data, error } = await supabase.rpc('create_recurring_subscription', {
            p_school_id:            parsed.data.schoolId ?? null,
            p_child_id:             parsed.data.childId ?? null,
            p_payment_token_id:     parsed.data.paymentTokenId,
            p_amount:               parsed.data.amount,
            p_billing_day:          parsed.data.billingDay ?? 1,
            p_concept:              parsed.data.concept ?? (isVendorMode ? 'Suscripcion' : 'Mensualidad'),
            p_program_id:           parsed.data.programId ?? null,
            p_team_id:              parsed.data.teamId ?? null,
            p_vendor_profile_id:    parsed.data.vendorProfileId ?? null,
            p_subscription_plan_id: parsed.data.subscriptionPlanId ?? null,
            p_billing_period:       parsed.data.billingPeriod ?? null,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_recurring_subscription RPC failed');
            return res.status(500).json({ error: 'No se pudo crear la suscripcion.' });
        }
        if (!data?.ok) {
            return res.status(400).json({ error: data?.error ?? 'unknown_error', details: data });
        }

        // Vendor mode: el primer cobro debe ser inmediato. La RPC dejo
        // next_charge_at = now() y marco immediate_charge_due=true; aqui
        // disparamos chargeOne sincronamente para que el cliente sepa al
        // toque si la tarjeta fue rechazada (UX critica vs descubrirlo en
        // un email del cron horas despues).
        if (data.immediate_charge_due) {
            try {
                const charge = await chargeRecurringSubscriptionById(data.subscription_id);
                if (!charge.ok && !charge.skipped) {
                    // La sub queda creada pero el primer cobro fallo. El cron
                    // reintentara segun retry_backoff_hours. Avisamos al UI.
                    return res.status(202).json({
                        ...data,
                        first_charge: { ok: false, error: charge.error ?? 'unknown' },
                        warning: 'Suscripcion creada pero el primer cobro fallo. Se reintentara automaticamente.',
                    });
                }
                return res.status(201).json({
                    ...data,
                    first_charge: { ok: true, skipped: !!charge.skipped },
                });
            } catch (err: any) {
                req.log?.error({ err, subscriptionId: data.subscription_id }, 'immediate charge threw');
                // La sub esta creada y vencida — el cron la tomara. No es 500.
                return res.status(202).json({
                    ...data,
                    first_charge: { ok: false, error: 'pending_cron' },
                    warning: 'Suscripcion creada. El primer cobro se procesara en el siguiente ciclo.',
                });
            }
        }

        return res.status(201).json(data);
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /subscriptions — lista las del usuario autenticado
// ─────────────────────────────────────────────────────────────────────────────

router.get(
    '/subscriptions',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const { data, error } = await supabase
            .from('recurring_subscriptions')
            .select(`
                id, school_id, vendor_profile_id, subscription_plan_id,
                child_id, amount, currency, concept, billing_day, billing_period,
                next_charge_at, last_charge_at, status, failed_attempts,
                cancelled_at, created_at,
                payment_token:payment_tokens!payment_token_id(id, last_four, brand, payment_provider),
                subscription_plan:subscription_plans!subscription_plan_id(id, name, plan_type)
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            req.log?.error({ err: error }, 'list recurring_subscriptions failed');
            return res.status(500).json({ error: 'No se pudieron listar las suscripciones.' });
        }
        return res.json({ subscriptions: data ?? [] });
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /vendor/subscriptions — vendor lista sus suscriptores activos
// ─────────────────────────────────────────────────────────────────────────────
// RLS (rec_subs_vendor_owner_select) ya filtra por dueno del vendor_profile.
// El BFF agrega join con el plan y el subscriptor.
router.get(
    '/vendor/subscriptions',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const status = (req.query.status as string | undefined) ?? null;

        let query = supabase
            .from('recurring_subscriptions')
            .select(`
                id, vendor_profile_id, subscription_plan_id, user_id,
                amount, currency, concept, billing_period,
                next_charge_at, last_charge_at, status, failed_attempts,
                cancelled_at, created_at,
                subscription_plan:subscription_plans!subscription_plan_id(id, name, plan_type, price)
            `)
            .not('vendor_profile_id', 'is', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            req.log?.error({ err: error }, 'list vendor recurring_subscriptions failed');
            return res.status(500).json({ error: 'No se pudieron listar tus suscriptores.' });
        }
        return res.json({ subscriptions: data ?? [] });
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /subscriptions/:id/pause | /resume | /cancel
// ─────────────────────────────────────────────────────────────────────────────

const IdSchema = z.object({ id: z.string().uuid() });

router.post(
    '/subscriptions/:id/pause',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = IdSchema.safeParse(req.params);
        if (!parsed.success) return res.status(400).json({ error: 'invalid_id' });
        const { data, error } = await supabase.rpc('pause_recurring_subscription', { p_sub_id: parsed.data.id });
        if (error) return res.status(500).json({ error: error.message });
        if (!data?.ok) return res.status(400).json({ error: data?.error });
        return res.json(data);
    },
);

router.post(
    '/subscriptions/:id/resume',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = IdSchema.safeParse(req.params);
        if (!parsed.success) return res.status(400).json({ error: 'invalid_id' });
        const { data, error } = await supabase.rpc('resume_recurring_subscription', { p_sub_id: parsed.data.id });
        if (error) return res.status(500).json({ error: error.message });
        if (!data?.ok) return res.status(400).json({ error: data?.error });
        return res.json(data);
    },
);

const CancelSchema = z.object({ reason: z.string().max(280).optional() });
router.post(
    '/subscriptions/:id/cancel',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        const idParsed = IdSchema.safeParse(req.params);
        if (!idParsed.success) return res.status(400).json({ error: 'invalid_id' });
        const bodyParsed = CancelSchema.safeParse(req.body ?? {});
        if (!bodyParsed.success) return res.status(400).json({ error: 'invalid_body' });

        const { data, error } = await supabase.rpc('cancel_recurring_subscription', {
            p_sub_id: idParsed.data.id,
            p_reason: bodyParsed.data.reason ?? null,
        });
        if (error) return res.status(500).json({ error: error.message });
        if (!data?.ok) return res.status(400).json({ error: data?.error });
        return res.json(data);
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /run — endpoint del cron. NO usa requireAuth: se autentica por secret.
// ─────────────────────────────────────────────────────────────────────────────

const RunSchema = z.object({
    limit: z.number().int().min(1).max(500).optional(),
});

router.post('/run', async (req, res: Response) => {
    const expected = process.env.RECURRING_CRON_SECRET;
    const got = req.header('x-cron-secret');
    if (!expected || !got || got !== expected) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    const parsed = RunSchema.safeParse(req.body ?? {});
    const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;

    try {
        const result = await runDueRecurringCharges(limit);
        return res.json(result);
    } catch (err: any) {
        console.error('[recurring.routes] /run failed:', err);
        return res.status(500).json({ error: err?.message ?? 'run_failed' });
    }
});

export default router;
