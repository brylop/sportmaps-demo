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
import { voidPaymentSource, fetchAcceptanceTokens } from '../services/wompi.service';

const router = Router();
router.use(requireAuth);

/**
 * Enmascara el holder_name: deja primera palabra + inicial de las siguientes.
 * "PEDRO PEREZ GOMEZ" → "PEDRO P. G."
 *
 * El holder_name completo solo se necesita server-side para reconciliacion.
 * En el cliente alcanza el masked + last_four para que el padre reconozca
 * "esa es mi tarjeta".
 */
function maskHolderName(name: string | null | undefined): string | null {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0] ?? null;
    return `${parts[0]} ${parts.slice(1).map(p => p[0] + '.').join(' ')}`;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('payment_tokens')
            .select('id, payment_method_type, last_four, brand, holder_name, payment_provider, is_default, is_active, expires_at, created_at')
            .eq('user_id', req.user.id)
            .eq('is_active', true)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ ok: false, error: 'Error obteniendo tokens.' });
        }

        // Enmascarar holder_name antes de devolver — privacidad (A7).
        const masked = (data || []).map(t => ({
            ...t,
            holder_name: maskHolderName(t.holder_name),
        }));

        return res.json({ ok: true, data: masked });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err.message || 'Error interno.' });
    }
});

router.post('/:id/set-default', async (req: AuthenticatedRequest, res: Response) => {
    try {
        // RPC atomico: en una sola transaccion marca este + desmarca el resto.
        // Reemplaza los 2 UPDATE separados anteriores (race "nadie default").
        const { data, error } = await supabase.rpc('set_default_payment_token', {
            p_token_id: req.params.id,
        });
        if (error) {
            return res.status(500).json({ ok: false, error: 'Error actualizando.' });
        }
        if (!data?.ok) {
            const status = data?.error === 'token_not_found' ? 404 : 400;
            return res.status(status).json({ ok: false, error: data?.error || 'unknown' });
        }
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
            .select('id, payment_provider, provider_payment_source_id')
            .single();

        if (error || !data) {
            return res.status(404).json({ ok: false, error: 'Token no encontrado.' });
        }

        // Defense in depth: si es Wompi con payment_source permanente, VOIDearlo
        // tambien en el provider. Si falla la llamada al provider NO bloqueamos
        // al user — la tarjeta ya esta is_active=false localmente y el cron no
        // intentara cobrarla.
        if (data.payment_provider === 'wompi' && data.provider_payment_source_id) {
            const voidRes = await voidPaymentSource(Number(data.provider_payment_source_id));
            if (!voidRes.ok) {
                req.log?.warn(
                    { err: voidRes.error, tokenId, paymentSourceId: data.provider_payment_source_id },
                    'voidPaymentSource failed at provider (non-blocking)',
                );
            }
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /acceptance/wompi — devuelve los 2 acceptance tokens + permalinks PDF
//
// El frontend lo llama al abrir el modal de "guardar tarjeta" para mostrar
// los checkboxes obligatorios de Habeas Data + politica de pagos. Los JWT
// devueltos se mandan despues en POST /save-intent.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/acceptance/wompi', async (_req: AuthenticatedRequest, res: Response) => {
    const r = await fetchAcceptanceTokens();
    if (!r.ok) {
        return res.status(502).json({ ok: false, error: r.error });
    }
    return res.json({
        ok: true,
        data: {
            acceptance_token: r.tokens.acceptanceToken,
            personal_data_auth_token: r.tokens.personalDataAuthToken,
            acceptance_permalink: r.tokens.acceptancePermalink,
            personal_data_permalink: r.tokens.personalDataPermalink,
        },
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /save-intent — el padre opto por guardar tarjeta + acepto Habeas Data
//
// Llamar ANTES de abrir el Widget de Wompi. Registra el consent ligado al
// `reference` que se mostrara al provider. Cuando el webhook procese
// APPROVED, lee este consent y crea el payment_source permanente.
//
// Sin esta llamada, NO guardamos tarjeta (respeta opt-in del usuario y deja
// prueba durable de aceptacion legal).
// ─────────────────────────────────────────────────────────────────────────────

const SaveIntentSchema = z.object({
    reference: z.string().min(4).max(120),
    paymentProvider: z.enum(['wompi', 'mercadopago']).default('wompi'),
    acceptanceToken: z.string().min(10),
    personalDataAuthToken: z.string().min(10),
    acceptancePermalink: z.string().url().optional(),
    personalDataPermalink: z.string().url().optional(),
});

// Cap de tarjetas activas por usuario. Configurable via env; default 5.
// Anti card-testing fraud — un atacante con cuenta valida no debe poder
// crear cientos de tokens probando numeros robados.
const MAX_ACTIVE_PAYMENT_TOKENS_PER_USER = Number(process.env.MAX_ACTIVE_PAYMENT_TOKENS_PER_USER ?? 5);

router.post('/save-intent', async (req: AuthenticatedRequest, res: Response) => {
    const parsed = SaveIntentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'invalid_body', details: parsed.error.issues });
    }

    // Cap por usuario — si ya tiene >= N tokens activos, bloquear el intent.
    // El cap se chequea aqui (antes del consent) porque el actual flujo
    // crea el payment_token recien en el webhook tras APPROVED. Sin chequeo
    // aqui, el padre podria avanzar y solo enterarse del bloqueo despues
    // del cobro real — mala UX y posibles cobros sin tarjeta guardable.
    const { data: tokenCount } = await supabase.rpc('count_active_payment_tokens', {
        p_user_id: req.user.id,
    });
    if (typeof tokenCount === 'number' && tokenCount >= MAX_ACTIVE_PAYMENT_TOKENS_PER_USER) {
        return res.status(409).json({
            ok: false,
            error: 'max_active_tokens_reached',
            message: `Ya tienes ${tokenCount} tarjetas guardadas (maximo ${MAX_ACTIVE_PAYMENT_TOKENS_PER_USER}). Elimina una antes de agregar otra.`,
        });
    }

    // IP y UA para auditoria forense. trust proxy=1 esta seteado en index.ts
    const ip = (req.ip || req.socket?.remoteAddress || '').toString();
    const ua = req.get('user-agent') || '';

    const { data, error } = await supabase.rpc('register_card_save_intent', {
        p_reference: parsed.data.reference,
        p_user_id: req.user.id,
        p_payment_provider: parsed.data.paymentProvider,
        p_acceptance_token: parsed.data.acceptanceToken,
        p_personal_data_auth_token: parsed.data.personalDataAuthToken,
        p_acceptance_permalink: parsed.data.acceptancePermalink ?? null,
        p_personal_data_permalink: parsed.data.personalDataPermalink ?? null,
        p_ip_address: ip || null,
        p_user_agent: ua || null,
    });

    if (error) {
        req.log?.error({ err: error, reference: parsed.data.reference }, 'register_card_save_intent failed');
        return res.status(500).json({ ok: false, error: 'register_failed' });
    }
    return res.json(data);
});

export default router;
