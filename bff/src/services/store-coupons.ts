/**
 * Cupones por tienda (tienda v2 F3b, migración 20261013170543).
 *
 * La base manda: create_cart_order aplica el cupón (nunca el cliente), los
 * topes se cuentan con la fila del cupón FOR UPDATE y la guardia
 * fn_store_coupons_guard valida alcance y congela el código con usos. Acá solo:
 *   - el esquema del body de crear / editar (la base vuelve a validar todo);
 *   - el estado visible de un cupón («vencido», «agotado», «programado»);
 *   - el resumen de usos para la pantalla «Tu tienda → Cupones»;
 *   - los mensajes de los errores de cupón (quote_cart devuelve coupon_error).
 *
 * Puro: se prueba en store-coupons.test.ts. Contrato:
 * docs/specs/tienda-v2-contrato-checkout.md §2.6.
 */

import { z } from 'zod';

const Uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'uuid');
const IsoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'fecha inválida');

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function normalizeCouponCode(code: unknown): string {
    return String(code ?? '').trim().toUpperCase();
}

const CouponFields = {
    description: z.string().trim().max(200).nullable().optional(),
    minSubtotal: z.number().int().min(0).max(100_000_000).optional(),
    maxDiscount: z.number().int().positive().max(100_000_000).nullable().optional(),
    startsAt: IsoDate.optional(),
    endsAt: IsoDate.nullable().optional(),
    maxRedemptions: z.number().int().positive().max(1_000_000).nullable().optional(),
    maxPerBuyer: z.number().int().positive().max(1000).nullable().optional(),
    appliesTo: z.enum(['store', 'products', 'categories']).optional(),
    productIds: z.array(Uuid).max(200).optional(),
    categoryIds: z.array(Uuid).max(50).optional(),
    schoolId: Uuid.nullable().optional(),
};

/** POST /vendor/:vp/coupons. `funded_by` no se expone: v1 solo el vendedor (D-20). */
export const CreateCouponSchema = z.object({
    code: z.string().transform(normalizeCouponCode).refine((c) => COUPON_CODE_RE.test(c), {
        message: 'De 3 a 30 letras, números, guion o guion bajo, sin espacios.',
    }),
    kind: z.enum(['percent', 'fixed']),
    value: z.number().positive(),
    ...CouponFields,
}).strict().superRefine((b, ctx) => {
    if (b.kind === 'percent' && (b.value > 90 || b.value < 1)) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'El porcentaje va de 1 a 90.' });
    }
    if (b.kind === 'fixed' && !Number.isInteger(b.value)) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'El monto fijo va en pesos enteros.' });
    }
    if (b.appliesTo === 'products' && !(b.productIds?.length)) {
        ctx.addIssue({ code: 'custom', path: ['productIds'], message: 'Elige al menos un producto.' });
    }
    if (b.appliesTo === 'categories' && !(b.categoryIds?.length)) {
        ctx.addIssue({ code: 'custom', path: ['categoryIds'], message: 'Elige al menos una categoría.' });
    }
    if (b.startsAt && b.endsAt && Date.parse(b.endsAt) <= Date.parse(b.startsAt)) {
        ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'La fecha final va después de la inicial.' });
    }
});

/**
 * PATCH /vendor/:vp/coupons/:id. Código, tipo y valor también se pueden
 * cambiar mientras el cupón no tenga usos (después la base responde COUPON_LOCKED).
 */
export const UpdateCouponSchema = z.object({
    code: z.string().transform(normalizeCouponCode).refine((c) => COUPON_CODE_RE.test(c)).optional(),
    kind: z.enum(['percent', 'fixed']).optional(),
    value: z.number().positive().optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    ...CouponFields,
}).strict().refine((b) => Object.keys(b).length > 0, { message: 'Nada que cambiar.' });

export type CreateCouponBody = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponBody = z.infer<typeof UpdateCouponSchema>;

/** Body (camelCase) → columnas de store_coupons. Solo lo que vino. */
export function toCouponColumns(b: Partial<CreateCouponBody & UpdateCouponBody>): Record<string, unknown> {
    const map: Array<[keyof typeof b, string]> = [
        ['code', 'code'], ['kind', 'kind'], ['value', 'value'], ['description', 'description'],
        ['minSubtotal', 'min_subtotal'], ['maxDiscount', 'max_discount'], ['startsAt', 'starts_at'],
        ['endsAt', 'ends_at'], ['maxRedemptions', 'max_redemptions'], ['maxPerBuyer', 'max_per_buyer'],
        ['appliesTo', 'applies_to'], ['productIds', 'product_ids'], ['categoryIds', 'category_ids'],
        ['schoolId', 'school_id'], ['status', 'status'],
    ];
    const out: Record<string, unknown> = {};
    for (const [k, col] of map) if (b[k] !== undefined) out[col] = b[k];
    return out;
}

export interface CouponRow {
    id: string;
    code: string;
    kind: 'percent' | 'fixed';
    value: number | string;
    status: 'active' | 'paused' | 'archived';
    starts_at: string;
    ends_at: string | null;
    max_redemptions: number | null;
    [k: string]: unknown;
}

export interface RedemptionLite { coupon_id: string; status: 'reserved' | 'consumed' | 'released'; discount_amount: number | string }

export interface CouponUsage { reserved: number; consumed: number; released: number; discountGiven: number }

/** Usos por cupón: reservas abiertas, consumidas (pagadas) y liberadas; descuento dado = consumido. */
export function summarizeUsage(rows: RedemptionLite[]): Map<string, CouponUsage> {
    const out = new Map<string, CouponUsage>();
    for (const r of rows) {
        const u = out.get(r.coupon_id) ?? { reserved: 0, consumed: 0, released: 0, discountGiven: 0 };
        u[r.status] += 1;
        if (r.status === 'consumed') u.discountGiven += Number(r.discount_amount) || 0;
        out.set(r.coupon_id, u);
    }
    return out;
}

export type CouponState = 'active' | 'paused' | 'archived' | 'scheduled' | 'expired' | 'exhausted';

/** Lo que la tienda ve en la lista: además del status guardado, vencido / agotado / programado. */
export function couponState(c: CouponRow, usage: CouponUsage | undefined, now = new Date()): CouponState {
    if (c.status !== 'active') return c.status;
    if (c.ends_at && Date.parse(c.ends_at) <= now.getTime()) return 'expired';
    if (Date.parse(c.starts_at) > now.getTime()) return 'scheduled';
    const used = (usage?.reserved ?? 0) + (usage?.consumed ?? 0);
    if (c.max_redemptions != null && used >= c.max_redemptions) return 'exhausted';
    return 'active';
}

/** Mensajes para coupon_error de quote_cart (los mismos que los tokens de create_cart_order). */
export const COUPON_ERROR_MESSAGES: Record<string, string> = {
    COUPON_INVALID: 'Ese código no existe en esta tienda o no está activo.',
    COUPON_EXPIRED: 'Ese código ya venció.',
    COUPON_NOT_STARTED: 'Ese código todavía no está vigente.',
    COUPON_LIMIT: 'Ese código ya se agotó.',
    COUPON_BUYER_LIMIT: 'Ya usaste este código el máximo de veces permitido.',
    COUPON_MIN_PURCHASE: 'Tu compra no alcanza el mínimo para este código.',
    COUPON_NOT_APPLICABLE: 'Ese código no aplica a los productos de tu carrito.',
    COUPON_TOO_MANY_ATTEMPTS: 'Probaste demasiados códigos. Intenta de nuevo en 15 minutos.',
    COUPON_LOGIN_REQUIRED: 'Inicia sesión para usar un código de descuento.',
    MULTIPLE_SELLERS: 'Los códigos se aplican a una tienda a la vez.',
};

export function couponErrorMessage(code: string | null | undefined, detail?: { min_subtotal?: number | string } | null): string | null {
    if (!code) return null;
    if (code === 'COUPON_MIN_PURCHASE' && detail?.min_subtotal != null) {
        const min = Number(detail.min_subtotal).toLocaleString('es-CO');
        return `Este código pide una compra mínima de $${min}.`;
    }
    return COUPON_ERROR_MESSAGES[code] ?? 'No pudimos aplicar ese código.';
}
