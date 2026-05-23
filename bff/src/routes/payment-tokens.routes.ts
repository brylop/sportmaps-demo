/**
 * payment-tokens.routes — Gestion de tokens Wompi guardados del usuario.
 *
 * Endpoints:
 *  - GET    /api/v1/payment-tokens                          Listar mis tokens
 *  - POST   /api/v1/payment-tokens/:id/set-default          Marcar default
 *  - DELETE /api/v1/payment-tokens/:id                      Borrar token
 *  - POST   /api/v1/subscriptions/:id/auto-renew            Activar/desactivar autopay
 *      body: { autoRenew: boolean, paymentTokenId?: uuid }
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('payment_tokens')
            .select('id, payment_method_type, last_four, brand, holder_name, is_default, is_active, expires_at, created_at')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo tokens.' });
        }

        return res.json({ ok: true, data: data || [] });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

router.post('/:id/set-default', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tokenId = req.params.id;

        // Verificar ownership
        const { data: token } = await supabase
            .from('payment_tokens')
            .select('id')
            .eq('id', tokenId)
            .eq('user_id', req.user.id)
            .single();

        if (!token) {
            return res.status(404).json({ ok: false, error: 'Token no encontrado.' });
        }

        // Desmarcar otros + marcar este
        await supabase.from('payment_tokens').update({ is_default: false }).eq('user_id', req.user.id);
        const { error } = await supabase
            .from('payment_tokens')
            .update({ is_default: true, updated_at: new Date().toISOString() })
            .eq('id', tokenId);

        if (error) return res.status(500).json({ ok: false, error: 'Error actualizando.' });

        return res.json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tokenId = req.params.id;
        const nowIso = new Date().toISOString();

        // Soft-delete: desactivar (mantenemos referencia historica para auditoria)
        const { data, error } = await supabase
            .from('payment_tokens')
            .update({ is_active: false, is_default: false, updated_at: nowIso })
            .eq('id', tokenId)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Token no encontrado.' });
        }

        // Si alguna subscription (SaaS escuela) usaba este token, deshabilitar autopay
        await supabase
            .from('subscriptions')
            .update({ auto_renew: false, payment_token_id: null })
            .eq('user_id', req.user.id)
            .eq('payment_token_id', tokenId);

        // CRITICO: cancelar tambien recurring_subscriptions (autopay padre->escuela).
        // El FK ON DELETE RESTRICT no se dispara con soft-delete, asi que sin esto
        // el cron seguira intentando cobrar manana con una tarjeta is_active=false.
        const { error: rsErr, count: rsCount } = await supabase
            .from('recurring_subscriptions')
            .update({
                status: 'cancelled',
                cancelled_at: nowIso,
                cancelled_reason: 'payment_token_deleted_by_user',
                updated_at: nowIso,
            }, { count: 'exact' })
            .eq('user_id', req.user.id)
            .eq('payment_token_id', tokenId)
            .in('status', ['active', 'paused', 'suspended']);

        if (rsErr) {
            // Log pero no fallar: la tarjeta ya quedo desactivada; un cron de
            // mantenimiento puede reconciliar las subs huerfanas.
            req.log?.error(
                { err: rsErr, tokenId, userId: req.user.id },
                'recurring_subscriptions cancel failed after token delete',
            );
        }

        return res.json({ ok: true, cancelled_recurring_subscriptions: rsCount ?? 0 });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

const AutoRenewSchema = z.object({
    autoRenew: z.boolean(),
    paymentTokenId: z.string().uuid().optional(),
});

router.post('/subscriptions/:id/auto-renew', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const subId = req.params.id;
        const parsed = AutoRenewSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos' });
        }

        const { autoRenew, paymentTokenId } = parsed.data;

        // Verificar ownership
        const { data: sub } = await supabase
            .from('subscriptions')
            .select('id, user_id, status')
            .eq('id', subId)
            .eq('user_id', req.user.id)
            .single();

        if (!sub) {
            return res.status(404).json({ ok: false, error: 'Suscripcion no encontrada.' });
        }

        // Si activa autopay, debe haber un token
        if (autoRenew && paymentTokenId) {
            const { data: token } = await supabase
                .from('payment_tokens')
                .select('id')
                .eq('id', paymentTokenId)
                .eq('user_id', req.user.id)
                .eq('is_active', true)
                .single();

            if (!token) {
                return res.status(400).json({ ok: false, error: 'Token de pago no valido.' });
            }
        }

        const updates: Record<string, unknown> = { auto_renew: autoRenew };
        if (autoRenew && paymentTokenId) {
            updates.payment_token_id = paymentTokenId;
        }
        if (!autoRenew) {
            updates.payment_token_id = null;
        }

        const { error } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('id', subId);

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando suscripcion.' });
        }

        return res.json({ ok: true, autoRenew });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

export default router;
