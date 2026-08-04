/**
 * admin-payments.routes — Endpoints administrativos para destrabar pagos
 * marcados como `requires_review = true` por el webhook.
 *
 * Endpoints:
 *  - GET  /api/v1/admin/payments/blocked        Lista los pagos bloqueados
 *      del usuario autenticado (cliente) o de los que el usuario administra
 *      (admin global, school owner, vendor, organizer) segun la vista
 *      `blocked_payments_view`.
 *  - GET  /api/v1/admin/payments/blocked/:userId  (solo admin global) lista
 *      bloqueos de un user especifico.
 *  - POST /api/v1/admin/payments/unblock         Destraba un pago. Body:
 *      `{ kind: 'payment'|'marketplace_transaction'|'order', id: uuid }`.
 *      La RPC unblock_payment verifica permisos del actor (admin / school
 *      owner / vendor / organizer segun el kind).
 *
 * Diseno: NO usa service_role bypass; las RPCs son SECURITY DEFINER y
 * verifican `auth.uid()` + role contra cada caso.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { createClient } from '@supabase/supabase-js';

const router = Router();

router.use(requireAuth);

const UnblockSchema = z.object({
    kind: z.enum(['payment', 'marketplace_transaction', 'order']),
    id: z.string().uuid(),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /blocked — bloqueos visibles para el usuario actual via RLS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/blocked', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        const userClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data, error } = await userClient
            .from('blocked_payments_view')
            .select('*')
            .order('last_failure_at', { ascending: false })
            .limit(200);

        if (error) {
            req.log?.error({ err: error }, 'Error fetching blocked_payments_view');
            return res.status(500).json({ ok: false, error: 'Error obteniendo bloqueos.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err: any) {
        req.log?.error({ err }, 'Unexpected error in /admin/payments/blocked');
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /unblock — destrabar un pago
// ─────────────────────────────────────────────────────────────────────────────
router.post('/unblock', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = UnblockSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                ok: false,
                error: 'Datos invalidos',
                details: parsed.error.issues,
            });
        }

        const { kind, id } = parsed.data;

        // ✅ Cliente con JWT del usuario — auth.uid() en el RPC resuelve correctamente
        const token = req.headers.authorization?.split(' ')[1];
        const userClient = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data, error } = await userClient.rpc('unblock_payment', {
            p_kind: kind,
            p_id: id,
        });

        if (error) {
            req.log?.error({ err: error, kind, id }, 'unblock_payment RPC failed');
            return res.status(500).json({ ok: false, error: 'Error en la operacion.' });
        }

        if (!data?.ok) {
            const code = data?.error || 'unknown';
            const status = code === 'forbidden' ? 403 : code === 'unauthenticated' ? 401 : 400;
            return res.status(status).json({ ok: false, error: code });
        }

        return res.json({ ok: true, data });
    } catch (err: any) {
        req.log?.error({ err }, 'Unexpected error in /admin/payments/unblock');
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /status/:userId — admin global puede consultar el estado de bloqueo
// de cualquier usuario. El BFF llama a is_user_payment_blocked.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status/:userId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;

        const { data: actorProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        // Cualquiera puede ver su propio estado; admin global ve todos.
        if (req.user.id !== userId && actorProfile?.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const { data, error } = await supabase.rpc('is_user_payment_blocked', { p_user_id: userId });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error consultando estado.' });
        }

        return res.json({ ok: true, data });
    } catch (err: any) {
        req.log?.error({ err }, 'Unexpected error in /admin/payments/status');
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

export default router;
