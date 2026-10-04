/**
 * vendor-payouts.routes — Vendor consulta sus liquidaciones; admin las gestiona.
 *
 * Vendor:
 *  - GET  /api/v1/vendor/payouts                   — vendor ve sus payouts
 *  - GET  /api/v1/vendor/balance                   — resumen + can_request_payout
 *  - POST /api/v1/vendor/payouts/request           — solicita liquidacion
 *      body: { amount?: number }   (omitir = todo el available_balance)
 *
 * Admin:
 *  - GET  /api/v1/admin/payouts                    — admin ve todos
 *  - POST /api/v1/admin/payouts/:id/mark-paid      — admin marca como pagado
 *      body: { bankReference?, notes? }
 *  - POST /api/v1/admin/payouts/:id/hold           — admin pone on_hold
 *  - POST /api/v1/admin/payouts/generate           — auto-genera payouts pending
 *  - POST /api/v1/admin/payouts/release-all        — libera escrows madurados
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { requireStoreEnabled } from '../services/store-flag.service';

const vendorRouter = Router();
const adminRouter = Router();

vendorRouter.use(requireAuth);
adminRouter.use(requireAuth);
// Tienda apagada (spec blindaje §1.3). Los routers se montan en /api/v1/vendor y
// /api/v1/admin: el gate va SOLO sobre sus prefijos, no sobre todo el mount.
vendorRouter.use(['/payouts', '/balance'], requireStoreEnabled);
adminRouter.use('/payouts', requireStoreEnabled);

vendorRouter.get('/payouts', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { status, page = '1', limit = '50' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let q = supabase
            .from('vendor_payouts')
            .select('*', { count: 'exact' })
            .eq('vendor_id', req.user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (status) q = q.eq('status', status as string);

        const { data, error, count } = await q;
        if (error) {
            req.log?.error({ err: error }, 'Error fetching vendor payouts');
            return res.status(500).json({ ok: false, error: 'Error obteniendo liquidaciones.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

adminRouter.get('/payouts', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data: actorProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', req.user.id)
            .single();

        if (actorProfile?.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const { status, vendor_id, page = '1', limit = '100' } = req.query;
        const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

        let q = supabase
            .from('vendor_payouts')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit as string, 10) - 1);

        if (status) q = q.eq('status', status as string);
        if (vendor_id) q = q.eq('vendor_id', vendor_id as string);

        const { data, error, count } = await q;
        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo liquidaciones.' });
        }

        return res.json({ ok: true, data: data || [], total: count || 0 });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

const MarkPaidSchema = z.object({
    bankReference: z.string().optional(),
    notes: z.string().optional(),
});

adminRouter.post('/payouts/:id/mark-paid', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data: actorProfile } = await supabase
            .from('profiles').select('role').eq('id', req.user.id).single();
        if (actorProfile?.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const parsed = MarkPaidSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos' });
        }

        const { data, error } = await supabase
            .from('vendor_payouts')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                paid_by: req.user.id,
                bank_reference: parsed.data.bankReference || null,
                notes: parsed.data.notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error marking payout as paid');
            return res.status(500).json({ ok: false, error: 'Error actualizando.' });
        }

        return res.json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

adminRouter.post('/payouts/:id/hold', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data: actorProfile } = await supabase
            .from('profiles').select('role').eq('id', req.user.id).single();
        if (actorProfile?.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const { data, error } = await supabase
            .from('vendor_payouts')
            .update({
                status: 'on_hold',
                notes: req.body?.notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando.' });
        }

        return res.json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR — GET /api/v1/vendor/balance (resumen + bank account status)
// ─────────────────────────────────────────────────────────────────────────────
vendorRouter.get('/balance', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase.rpc('vendor_payout_summary');
        if (error) {
            req.log?.error({ err: error }, 'Error en vendor_payout_summary');
            return res.status(500).json({ ok: false, error: 'Error obteniendo balance.' });
        }
        return res.json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR — POST /api/v1/vendor/payouts/request
// ─────────────────────────────────────────────────────────────────────────────
const RequestPayoutSchema = z.object({
    amount: z.number().positive().optional(),
});

vendorRouter.post('/payouts/request', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const parsed = RequestPayoutSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.' });
        }

        const { data, error } = await supabase.rpc('request_payout', {
            p_amount: parsed.data.amount ?? null,
        });

        if (error) {
            req.log?.warn({ err: error }, 'request_payout fallo');
            return res.status(400).json({ ok: false, error: error.message });
        }
        return res.status(201).json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/v1/admin/payouts/generate
// Auto-crea payouts para vendors con available_balance >= min.
// ─────────────────────────────────────────────────────────────────────────────
// Tienda v2 F0 (M-F0-5, T7/T21): un solo motor de liquidación. Este endpoint
// llamaba admin_generate_pending_payouts (tercer motor; con service role ya
// fallaba con 42501). Con D-5 = A el vendedor cobra con sus llaves y no hay
// payout que generar: la comisión queda adeudada (vendor_balances.commission_due).
adminRouter.post('/payouts/generate', (_req: AuthenticatedRequest, res: Response) => {
    return res.status(410).json({
        ok: false,
        error: 'PAYOUTS_GENERATE_GONE',
        message: 'Los vendedores cobran con sus propias llaves (D-5 = A); no hay payouts que generar.',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — POST /api/v1/admin/payouts/release-all
// Libera settlements pending -> processing en todos los vendors elegibles.
// ─────────────────────────────────────────────────────────────────────────────
adminRouter.post('/payouts/release-all', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data: actorProfile } = await supabase
            .from('profiles').select('role').eq('id', req.user.id).single();
        if (actorProfile?.role !== 'admin' && actorProfile?.role !== 'super_admin') {
            return res.status(403).json({ ok: false, error: 'forbidden' });
        }

        const { data, error } = await supabase.rpc('release_settlements_all');
        if (error) {
            return res.status(500).json({ ok: false, error: error.message });
        }
        return res.json({ ok: true, data });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

export { vendorRouter as vendorPayoutsRouter, adminRouter as adminPayoutsRouter };
