/**
 * Cupones de descuento por tienda (tienda v2 F3b, mig. 20261013170543).
 *
 * La base aplica el cupón (quote_cart lo cotiza, create_cart_order lo cobra).
 * Aquí solo: textos para el comprador y la tienda, y validación del formulario
 * de la tienda antes de mandarlo al BFF (que la base vuelve a validar).
 * Contrato: docs/specs/tienda-v2-contrato-checkout.md §2.6.
 */
import { formatCurrency } from '@/lib/utils';

export type CouponKind = 'percent' | 'fixed';
export type CouponStatus = 'active' | 'paused' | 'archived';
export type CouponState = CouponStatus | 'scheduled' | 'expired' | 'exhausted';
export type CouponScope = 'store' | 'products' | 'categories';

export interface StoreCoupon {
    id: string;
    vendor_profile_id: string;
    school_id: string | null;
    code: string;
    description: string | null;
    kind: CouponKind;
    value: number;
    min_subtotal: number;
    max_discount: number | null;
    starts_at: string;
    ends_at: string | null;
    max_redemptions: number | null;
    max_per_buyer: number | null;
    applies_to: CouponScope;
    product_ids: string[];
    category_ids: string[];
    status: CouponStatus;
    created_at: string;
    usage: { reserved: number; consumed: number; released: number; discountGiven: number };
    state: CouponState;
}

export interface CouponRedemption {
    id: string;
    order_id: string;
    status: 'reserved' | 'consumed' | 'released';
    discount_amount: number;
    created_at: string;
    orders?: { reference: string | null; status: string; total_amount: number; customer_name: string | null } | null;
}

export const COUPON_CODE_RE = /^[A-Z0-9_-]{3,30}$/;

export function normalizeCouponCode(code: string): string {
    return code.trim().toUpperCase();
}

/** Mensaje para el comprador (mismos textos que el BFF). Nunca el código crudo. */
export const COUPON_ERROR_TEXT: Record<string, string> = {
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
    COUPONS_NOT_AVAILABLE: 'Esta tienda todavía no recibe códigos de descuento.',
};

export function couponErrorText(code: string | null | undefined, detail?: { min_subtotal?: number | string } | null): string | null {
    if (!code) return null;
    if (code === 'COUPON_MIN_PURCHASE' && detail?.min_subtotal != null) {
        return `Este código pide una compra mínima de ${formatCurrency(Number(detail.min_subtotal))}.`;
    }
    return COUPON_ERROR_TEXT[code] ?? 'No pudimos aplicar ese código.';
}

/** "10 %" · "$20.000". */
export function couponValueLabel(c: Pick<StoreCoupon, 'kind' | 'value'>): string {
    return c.kind === 'percent' ? `${Number(c.value)} %` : formatCurrency(Number(c.value));
}

/** Una línea con las condiciones: mínimo, tope, usos. */
export function couponConditions(c: Pick<StoreCoupon, 'min_subtotal' | 'max_discount' | 'max_redemptions' | 'max_per_buyer' | 'ends_at' | 'applies_to' | 'school_id'>): string {
    const parts: string[] = [];
    if (Number(c.min_subtotal) > 0) parts.push(`mínimo ${formatCurrency(Number(c.min_subtotal))}`);
    if (c.max_discount) parts.push(`tope ${formatCurrency(Number(c.max_discount))}`);
    if (c.max_redemptions) parts.push(`${c.max_redemptions} usos en total`);
    if (c.max_per_buyer) parts.push(c.max_per_buyer === 1 ? '1 por comprador' : `${c.max_per_buyer} por comprador`);
    if (c.applies_to === 'products') parts.push('solo algunos productos');
    if (c.applies_to === 'categories') parts.push('solo algunas categorías');
    if (c.school_id) parts.push('solo familias de una escuela');
    if (c.ends_at) parts.push(`hasta el ${new Date(c.ends_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`);
    return parts.join(' · ') || 'Toda la tienda, sin mínimo';
}

export const COUPON_STATE_LABEL: Record<CouponState, string> = {
    active: 'Activo',
    paused: 'Pausado',
    archived: 'Archivado',
    scheduled: 'Programado',
    expired: 'Vencido',
    exhausted: 'Agotado',
};

export interface CouponForm {
    code: string;
    description: string;
    kind: CouponKind;
    value: string;
    minSubtotal: string;
    maxDiscount: string;
    maxRedemptions: string;
    maxPerBuyer: string;
    endsAt: string; // yyyy-mm-dd o ''
}

export const EMPTY_COUPON_FORM: CouponForm = {
    code: '', description: '', kind: 'percent', value: '10', minSubtotal: '', maxDiscount: '',
    maxRedemptions: '', maxPerBuyer: '1', endsAt: '',
};

const intOrNull = (s: string): number | null => {
    const t = s.replace(/[.\s$]/g, '').trim();
    return t === '' ? null : Number(t);
};

/** Formulario → body del BFF, o el problema en español. */
export function couponPayload(f: CouponForm): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
    const code = normalizeCouponCode(f.code);
    if (!COUPON_CODE_RE.test(code)) return { ok: false, error: 'El código va de 3 a 30 letras o números, sin espacios.' };
    const value = intOrNull(f.value);
    if (value == null || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Escribe cuánto descuenta.' };
    if (f.kind === 'percent' && (value < 1 || value > 90)) return { ok: false, error: 'El porcentaje va de 1 a 90.' };
    const nums = { minSubtotal: intOrNull(f.minSubtotal), maxDiscount: intOrNull(f.maxDiscount),
        maxRedemptions: intOrNull(f.maxRedemptions), maxPerBuyer: intOrNull(f.maxPerBuyer) };
    for (const [k, v] of Object.entries(nums)) {
        if (v != null && (!Number.isInteger(v) || v < (k === 'minSubtotal' ? 0 : 1))) return { ok: false, error: 'Revisa los números: van enteros y positivos.' };
    }
    let endsAt: string | null = null;
    if (f.endsAt) {
        const d = new Date(`${f.endsAt}T23:59:59-05:00`); // fin del día en Colombia
        if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return { ok: false, error: 'La fecha de vencimiento tiene que ser futura.' };
        endsAt = d.toISOString();
    }
    const body: Record<string, unknown> = { code, kind: f.kind, value };
    if (f.description.trim()) body.description = f.description.trim();
    if (nums.minSubtotal != null) body.minSubtotal = nums.minSubtotal;
    if (nums.maxDiscount != null) body.maxDiscount = nums.maxDiscount;
    if (nums.maxRedemptions != null) body.maxRedemptions = nums.maxRedemptions;
    body.maxPerBuyer = nums.maxPerBuyer; // null = sin límite por comprador
    if (endsAt) body.endsAt = endsAt;
    return { ok: true, body };
}

/** Errores del BFF al crear/editar → texto. */
export function couponAdminErrorText(err: unknown): string {
    const code = (err as { body?: { error?: string; message?: string } } | null)?.body?.error;
    const msg = (err as { body?: { message?: string } } | null)?.body?.message;
    if (code === 'COUPON_CODE_TAKEN') return 'Ya tienes un cupón con ese código.';
    if (code === 'COUPON_LOCKED') return 'Este cupón ya tiene usos: no se puede cambiar el código ni el descuento. Pausa este y crea otro.';
    if (code === 'NOT_OWNER') return 'Solo el dueño o un administrador de la tienda maneja los cupones.';
    return msg || 'No se pudo guardar el cupón.';
}
