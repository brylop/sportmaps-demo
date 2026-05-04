/**
 * vendor-payouts.routes — Vendor consulta sus liquidaciones; admin las marca pagadas.
 *
 * Endpoints:
 *  - GET  /api/v1/vendor/payouts                   — vendor ve sus payouts
 *  - GET  /api/v1/admin/payouts                    — admin ve todos
 *  - POST /api/v1/admin/payouts/:id/mark-paid      — admin marca como pagado
 *      body: { bankReference?, notes? }
 *  - POST /api/v1/admin/payouts/:id/hold           — admin pone on_hold
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';

const vendorRouter = Router();
const adminRouter = Router();

vendorRouter.use(requireAuth);
adminRouter.use(requireAuth);

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

export { vendorRouter as vendorPayoutsRouter, adminRouter as adminPayoutsRouter };
