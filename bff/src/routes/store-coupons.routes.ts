/**
 * store-coupons — cupones de descuento por tienda (tienda v2 F3b, mig. 20261013170543).
 *
 * Montado en /api/v1/store (index.ts), ANTES de storeOrdersRouter. La
 * autenticación va por ruta, no con router.use: este router ve pasar todo
 * /api/v1/store y no puede pedir sesión a las rutas públicas del otro.
 *
 * Tienda (quien la administra: can_manage_store_as — dueño, owner/admin de la
 * escuela, admin de plataforma; NO coach):
 *   GET   /vendor/:vendorProfileId/coupons                       → lista + usos + estado
 *   POST  /vendor/:vendorProfileId/coupons                       → crear
 *   PATCH /vendor/:vendorProfileId/coupons/:couponId             → editar / pausar / archivar
 *   GET   /vendor/:vendorProfileId/coupons/:couponId/redemptions → quién lo usó
 * Comprador:
 *   POST  /coupons/validate {code, items, fulfillment?, address?} → quote_cart con SU JWT
 *
 * El BFF usa service role: la RLS no lo frena, así que cada ruta de la tienda
 * pasa por canManageStoreAs. La guardia fn_store_coupons_guard (base) valida
 * alcance y congela código/tipo/valor cuando el cupón ya tiene usos.
 * Contrato: docs/specs/tienda-v2-contrato-checkout.md §2.6.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireMarketplaceAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import { mapStoreRpcError } from '../services/store-rpc-errors';
import { canManageStoreAs } from '../services/store-access';
import { StoreCheckoutSchema, toCreateCartOrderArgs } from '../services/store-checkout';
import {
    CreateCouponSchema, UpdateCouponSchema, couponErrorMessage, couponState, normalizeCouponCode,
    summarizeUsage, toCouponColumns, type CouponRow, type RedemptionLite,
} from '../services/store-coupons';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUPON_COLUMNS = `id, vendor_profile_id, school_id, code, description, kind, value, min_subtotal, max_discount,
  starts_at, ends_at, max_redemptions, max_per_buyer, applies_to, product_ids, category_ids, funded_by,
  status, created_by, created_at, updated_at`;

const router = Router();

function sendDbError(res: Response, error: any) {
    // Código repetido en la tienda (índice único por upper(code)).
    if (error?.code === '23505') {
        return res.status(409).json({ ok: false, error: 'COUPON_CODE_TAKEN', message: 'Ya tienes un cupón con ese código.' });
    }
    if (error?.code === '23514') {
        return res.status(400).json({ ok: false, error: 'COUPON_INVALID_DATA', message: 'Revisa los datos del cupón.' });
    }
    const mapped = mapStoreRpcError(error);
    return res.status(mapped.status).json({ ok: false, error: mapped.code, message: mapped.message });
}

async function guardManager(req: Request, res: Response): Promise<string | null> {
    const vp = String(req.params.vendorProfileId ?? '');
    if (!UUID.test(vp)) { res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' }); return null; }
    if (!(await canManageStoreAs(vp, req.user.id))) { res.status(403).json({ ok: false, error: 'NOT_OWNER' }); return null; }
    return vp;
}

// ─── Tienda ─────────────────────────────────────────────────────────────────
router.get('/vendor/:vendorProfileId/coupons', requireMarketplaceAuth, async (req: Request, res: Response) => {
    const vp = await guardManager(req, res);
    if (!vp) return;
    const { data: coupons, error } = await supabase.from('store_coupons').select(COUPON_COLUMNS)
        .eq('vendor_profile_id', vp).order('created_at', { ascending: false }).limit(200);
    if (error) return sendDbError(res, error);
    const ids = (coupons ?? []).map((c: any) => c.id);
    let usage = new Map();
    if (ids.length) {
        const { data: reds } = await supabase.from('store_coupon_redemptions')
            .select('coupon_id, status, discount_amount').in('coupon_id', ids);
        usage = summarizeUsage((reds ?? []) as RedemptionLite[]);
    }
    const now = new Date();
    const data = (coupons ?? []).map((c: any) => {
        const u = usage.get(c.id) ?? { reserved: 0, consumed: 0, released: 0, discountGiven: 0 };
        return { ...c, usage: u, state: couponState(c as CouponRow, u, now) };
    });
    return res.json({ ok: true, data });
});

router.post('/vendor/:vendorProfileId/coupons', requireMarketplaceAuth, async (req: Request, res: Response) => {
    const vp = await guardManager(req, res);
    if (!vp) return;
    const parsed = CreateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'COUPON_INVALID_DATA', message: 'Revisa los datos del cupón.', details: parsed.error.issues });
    }
    const row = { ...toCouponColumns(parsed.data), vendor_profile_id: vp, created_by: req.user.id, funded_by: 'vendor' };
    const { data, error } = await supabase.from('store_coupons').insert(row).select(COUPON_COLUMNS).single();
    if (error) return sendDbError(res, error);
    await auditLog(req, 'store_coupon_create', 'store_coupons', (data as any).id, null, row);
    return res.status(201).json({ ok: true, data });
});

router.patch('/vendor/:vendorProfileId/coupons/:couponId', requireMarketplaceAuth, async (req: Request, res: Response) => {
    const vp = await guardManager(req, res);
    if (!vp) return;
    const couponId = String(req.params.couponId);
    if (!UUID.test(couponId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const parsed = UpdateCouponSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'COUPON_INVALID_DATA', message: 'Revisa los datos del cupón.', details: parsed.error.issues });
    }
    const { data: before } = await supabase.from('store_coupons').select(COUPON_COLUMNS)
        .eq('id', couponId).eq('vendor_profile_id', vp).maybeSingle();
    if (!before) return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: 'Cupón no encontrado.' });
    const changes = { ...toCouponColumns(parsed.data), updated_by: req.user.id };
    const { data, error } = await supabase.from('store_coupons').update(changes)
        .eq('id', couponId).eq('vendor_profile_id', vp).select(COUPON_COLUMNS).single();
    if (error) return sendDbError(res, error);
    await auditLog(req, 'store_coupon_update', 'store_coupons', couponId, before as any, changes);
    return res.json({ ok: true, data });
});

router.get('/vendor/:vendorProfileId/coupons/:couponId/redemptions', requireMarketplaceAuth, async (req: Request, res: Response) => {
    const vp = await guardManager(req, res);
    if (!vp) return;
    const couponId = String(req.params.couponId);
    if (!UUID.test(couponId)) return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER' });
    const { data, error } = await supabase.from('store_coupon_redemptions')
        .select('id, order_id, status, discount_amount, created_at, consumed_at, released_at, orders (reference, status, total_amount, customer_name)')
        .eq('coupon_id', couponId).eq('vendor_profile_id', vp)
        .order('created_at', { ascending: false }).limit(300);
    if (error) return sendDbError(res, error);
    return res.json({ ok: true, data: data ?? [] });
});

// ─── Comprador ──────────────────────────────────────────────────────────────
/**
 * Valida un código contra el carrito (quote_cart con el JWT del comprador:
 * school_only, cupones de escuela y límite de intentos van por auth.uid()).
 * Nunca lista cupones: solo responde por el código que el comprador escribió.
 */
router.post('/coupons/validate', requireMarketplaceAuth, async (req: Request, res: Response) => {
    const code = normalizeCouponCode(req.body?.code);
    if (!code) return res.status(400).json({ ok: false, error: 'COUPON_INVALID', message: couponErrorMessage('COUPON_INVALID') });
    const parsed = StoreCheckoutSchema.safeParse({ ...req.body, couponCode: code });
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: 'INVALID_PARAMETER', details: parsed.error.issues });
    }
    const args = toCreateCartOrderArgs(parsed.data, req.user.id);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: req.headers.authorization ?? '' } },
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await userClient.rpc('quote_cart', {
        p_items: args.p_items, p_fulfillment: args.p_fulfillment, p_address: args.p_address, p_coupon_code: code,
    });
    if (error) {
        const mapped = mapStoreRpcError(error);
        return res.status(mapped.status).json({ ok: false, error: mapped.code, message: mapped.message });
    }
    const q = (data ?? {}) as Record<string, any>;
    const err = q.coupon_error ?? null;
    return res.json({
        ok: true,
        data: {
            valid: !err,
            code,
            error: err,
            message: couponErrorMessage(err, q.coupon_error_detail),
            detail: q.coupon_error_detail ?? null,
            coupon: q.coupon ?? null,
            subtotal: Number(q.subtotal ?? 0),
            discountTotal: Number(q.discount_total ?? 0),
            taxTotal: Number(q.tax_total ?? 0),
            total: Number(q.total ?? 0),
        },
    });
});

export default router;
