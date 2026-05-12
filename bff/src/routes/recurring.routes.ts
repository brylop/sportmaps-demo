/**
 * recurring.routes — Suscripciones de cobro recurrente (debito automatico).
 *
 * Endpoints para el padre:
 *  - POST   /api/v1/recurring/subscriptions              Crea sub usando tarjeta guardada
 *  - GET    /api/v1/recurring/subscriptions              Lista las del usuario
 *  - POST   /api/v1/recurring/subscriptions/:id/pause    Pausa (no cobra hasta resume)
 *  - POST   /api/v1/recurring/subscriptions/:id/resume   Reactiva
 *  - POST   /api/v1/recurring/subscriptions/:id/cancel   Cancela (no reactivable)
 *
 * Endpoint del cron (no expuesto al usuario):
 *  - POST   /api/v1/recurring/run                        Ejecuta cobros vencidos.
 *                                                        Auth: header x-cron-secret == RECURRING_CRON_SECRET.
 *                                                        Lo llama la Edge Function `run-recurring-charges`.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { runDueRecurringCharges } from '../services/recurring-charges.service';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const CreateSubSchema = z.object({
    schoolId: z.string().uuid(),
    childId: z.string().uuid().optional(),
    paymentTokenId: z.string().uuid(),
    amount: z.number().positive(),
    billingDay: z.number().int().min(1).max(28).optional(),
    concept: z.string().max(120).optional(),
    programId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
});

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

        const { data, error } = await supabase.rpc('create_recurring_subscription', {
            p_school_id:        parsed.data.schoolId,
            p_child_id:         parsed.data.childId ?? null,
            p_payment_token_id: parsed.data.paymentTokenId,
            p_amount:           parsed.data.amount,
            p_billing_day:      parsed.data.billingDay ?? 1,
            p_concept:          parsed.data.concept ?? 'Mensualidad',
            p_program_id:       parsed.data.programId ?? null,
            p_team_id:          parsed.data.teamId ?? null,
        });

        if (error) {
            req.log?.error({ err: error }, 'create_recurring_subscription RPC failed');
            return res.status(500).json({ error: 'No se pudo crear la suscripcion.' });
        }
        if (!data?.ok) {
            return res.status(400).json({ error: data?.error ?? 'unknown_error' });
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
                id, school_id, child_id, amount, currency, concept, billing_day,
                next_charge_at, last_charge_at, status, failed_attempts,
                cancelled_at, created_at,
                payment_token:payment_tokens!payment_token_id(id, last_four, brand, payment_provider)
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
