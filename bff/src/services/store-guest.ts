/**
 * Compra SIN cuenta en la tienda (D-13, mig. 20261013170553).
 *
 * La base manda: create_guest_cart_order (solo service role) valida correo,
 * límites por correo/IP/hora, pedidos abiertos, monto máximo y bloquea los
 * productos school_only; devuelve el token del enlace /pedido/:token UNA vez
 * (guarda solo su sha256). Acá vive lo que la base no puede hacer:
 *   - validar el body (correo y nombre obligatorios, teléfono opcional);
 *   - pasar la IP REAL del cliente (CF-Connecting-IP, ver storeRateLimit.ts);
 *   - mandar el correo con el enlace del pedido (Resend vía send-email) o,
 *     en el gemelo/local/tests, SIMULARLO (nunca un correo real desde ahí).
 *
 * Puro salvo `enviarCorreoPedidoInvitado`. Se prueba en store-guest.test.ts.
 * Contrato: docs/specs/tienda-v2-contrato-checkout.md §2.7.
 */

import { z } from 'zod';
import { StoreCheckoutSchema, toCreateCartOrderArgs, type StoreCheckoutBody } from './store-checkout';
import { enviarPlantilla, escaparHtml } from './avisos-correo.service';
import { appPublica } from '../utils/url-publica-familias';

/** Token del enlace: 64 hex en minúsculas (2 × uuid v4 sin guiones). */
export const GUEST_TOKEN_RE = /^[0-9a-f]{64}$/;
export const GUEST_TOKEN_HEADER = 'x-pedido-token';

/** Medios que un invitado puede usar: Mercado Pago necesita sesión (POST /payments/mp/create). */
export const GUEST_PAYMENT_METHODS = ['wompi', 'transfer', 'cash_pickup'] as const;

const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * Body de POST /api/v1/public/tienda/checkout. Mismo contrato que el checkout
 * con cuenta (§2.2) pero con `buyer.email` y `buyer.name` obligatorios y la
 * idempotency key obligatoria. Sin cuerpo legacy.
 */
export const GuestCheckoutSchema = z.object({
    items: StoreCheckoutSchema.shape.items,
    fulfillment: z.enum(['pickup', 'shipping']),
    pickupBranchId: StoreCheckoutSchema.shape.pickupBranchId,
    address: StoreCheckoutSchema.shape.address,
    buyer: z.object({
        name: z.string().trim().min(2, 'nombre').max(120),
        email: z.string().trim().max(254).regex(EMAIL_RE, 'correo'),
        phone: z.string().trim().max(40).optional().nullable()
            .refine((p) => !p || /^\+?[0-9]{7,15}$/.test(p.replace(/[\s().-]/g, '')), 'teléfono'),
        document: z.string().trim().max(40).optional().nullable(),
        notes: z.string().max(1000).optional().nullable(),
    }),
    paymentMethod: z.enum(GUEST_PAYMENT_METHODS),
    couponCode: z.string().max(60).optional().nullable(),
    idempotencyKey: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'uuid'),
    // Trampa para bots (campo oculto en el formulario): un humano lo deja vacío.
    website: z.string().max(200).optional().nullable(),
});

export type GuestCheckoutBody = z.infer<typeof GuestCheckoutSchema>;

export interface CreateGuestCartOrderArgs {
    p_items: Array<{ product_id?: string; variant_id?: string; quantity: number }>;
    p_fulfillment: 'pickup' | 'shipping';
    p_pickup_branch: string | null;
    p_address: Record<string, unknown> | null;
    p_buyer: Record<string, unknown>;
    p_payment_method: string;
    p_coupon_code: string | null;
    p_idempotency_key: string;
    p_client_ip: string | null;
}

/** Body HTTP → argumentos de create_guest_cart_order. Puro. Ningún precio pasa. */
export function toCreateGuestCartOrderArgs(body: GuestCheckoutBody, clientIp: string | null): CreateGuestCartOrderArgs {
    const base = toCreateCartOrderArgs({
        items: body.items,
        fulfillment: body.fulfillment,
        pickupBranchId: body.pickupBranchId ?? null,
        address: body.address ?? null,
        buyer: {
            name: body.buyer.name,
            email: body.buyer.email.trim().toLowerCase(),
            phone: body.buyer.phone ? body.buyer.phone.replace(/[\s().-]/g, '') : undefined,
            document: body.buyer.document || undefined,
            notes: body.buyer.notes || undefined,
        },
        paymentMethod: body.paymentMethod,
        couponCode: body.couponCode ?? null,
        idempotencyKey: body.idempotencyKey,
    } as StoreCheckoutBody, '');
    return {
        p_items: base.p_items,
        p_fulfillment: base.p_fulfillment,
        p_pickup_branch: base.p_pickup_branch,
        p_address: base.p_address,
        p_buyer: base.p_buyer,
        p_payment_method: base.p_payment_method,
        p_coupon_code: base.p_coupon_code,
        p_idempotency_key: body.idempotencyKey,
        p_client_ip: clientIp ? clientIp.slice(0, 64) : null,
    };
}

/** Token del header (las llamadas del front) — nunca en la URL del BFF, para que no quede en los logs. */
export function guestTokenFrom(headers: Record<string, unknown>): string | null {
    const raw = headers[GUEST_TOKEN_HEADER];
    const t = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim();
    return GUEST_TOKEN_RE.test(t) ? t : null;
}

export const enlaceDePedido = (appBase: string, token: string) => `${appBase}/pedido/${token}`;

// ─── Correo de confirmación ─────────────────────────────────────────────────

export type ModoCorreo = 'send' | 'simulate';

/**
 * ¿Se manda de verdad? Solo cuando el BFF apunta a una Supabase en la nube y
 * nadie pidió simular. El gemelo (127.0.0.1/localhost), los tests y
 * SIMULATE_EMAILS/STORE_GUEST_EMAIL_MODE=simulate → simulación (se registra
 * en el log, sin el token).
 */
export function modoCorreoInvitado(env: Record<string, string | undefined> = process.env): ModoCorreo {
    const forced = (env.STORE_GUEST_EMAIL_MODE || '').toLowerCase();
    if (forced === 'simulate' || env.SIMULATE_EMAILS === 'true' || env.NODE_ENV === 'test' || env.VITEST) return 'simulate';
    let host = '';
    try { host = new URL(env.SUPABASE_URL || '').hostname.toLowerCase(); } catch { host = ''; }
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')
        || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host) || !host.endsWith('.supabase.co')) {
        return 'simulate';
    }
    return forced === 'send' || forced === '' ? 'send' : 'simulate';
}

export interface DatosCorreoPedido {
    to: string;
    nombre: string;
    tienda: string;
    referencia: string;
    total: number;
    medio: string;
    retiro: boolean;
    sede?: string | null;
    codigoRetiro?: string | null;
    enlace: string;
}

const MEDIO: Record<string, string> = {
    transfer: 'Transferencia bancaria',
    cash_pickup: 'Efectivo al retirar',
    wompi: 'Pago en línea',
};

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

/** Asunto + HTML del correo. Puro (todo lo que viene del usuario va escapado). */
export function correoPedidoInvitado(d: DatosCorreoPedido): { subject: string; html: string } {
    const e = (s: string) => escaparHtml(s);
    const pasos = d.medio === 'transfer'
        ? 'Transfiere el total a la cuenta de la tienda y sube el comprobante desde el enlace de tu pedido. Te guardamos los productos mientras tanto.'
        : d.medio === 'cash_pickup'
            ? 'Pagas en efectivo cuando retires en la sede, mostrando tu código de retiro.'
            : 'Si no terminaste el pago en línea, puedes retomarlo desde el enlace de tu pedido.';
    const codigo = d.codigoRetiro
        ? `<p style="margin:16px 0;padding:12px;border:2px dashed #248223;border-radius:8px;text-align:center;">`
          + `<span style="display:block;color:#4a4a4a;font-size:13px;">Código de retiro</span>`
          + `<span style="font-size:28px;font-weight:bold;letter-spacing:6px;">${e(d.codigoRetiro)}</span></p>`
        : '';
    const p = (t: string) => `<p style="color:#4a4a4a;line-height:1.6;margin:0 0 10px;">${t}</p>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border-top:3px solid #248223;">`
        + `<h2 style="color:#248223;margin-top:0;">Recibimos tu pedido ${e(d.referencia)}</h2>`
        + p(`Hola ${e(d.nombre)}, tu pedido en <strong>${e(d.tienda)}</strong> quedó creado.`)
        + p(`Total: <strong>${e(pesos(d.total))}</strong> · ${e(MEDIO[d.medio] ?? d.medio)}`
            + (d.retiro ? ` · Retiro en sede${d.sede ? `: ${e(d.sede)}` : ''}` : ''))
        + p(e(pasos))
        + codigo
        + `<p style="margin-top:20px;"><a href="${e(d.enlace)}" style="display:inline-block;padding:12px 24px;background:#FB9F1E;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Ver mi pedido</a></p>`
        + p(`Guarda este correo: el botón es tu acceso al pedido (estado, comprobante y código de retiro). No lo reenvíes.`)
        + p(`¿Quieres ver tus compras siempre a mano? Crea tu cuenta en SportMaps con este mismo correo (${e(d.to)}) y tus pedidos aparecen solos en «Mis compras».`)
        + `</div>`;
    return { subject: `Tu pedido ${d.referencia} en ${d.tienda}`, html };
}

export type ResultadoCorreo = 'sent' | 'simulated' | 'failed';

/** Manda (o simula) el correo. Nunca lanza; nunca registra el token. */
export async function enviarCorreoPedidoInvitado(
    d: DatosCorreoPedido,
    deps: { modo?: ModoCorreo; enviar?: typeof enviarPlantilla; log?: (msg: string, extra: Record<string, unknown>) => void } = {},
): Promise<ResultadoCorreo> {
    const modo = deps.modo ?? modoCorreoInvitado();
    const log = deps.log ?? ((msg, extra) => console.info(msg, extra));
    const { subject, html } = correoPedidoInvitado(d);
    const destino = d.to.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
    if (modo === 'simulate') {
        log('[tienda-invitado] correo SIMULADO (no sale)', { to: destino, subject, referencia: d.referencia });
        return 'simulated';
    }
    try {
        const r = await (deps.enviar ?? enviarPlantilla)(null, [d.to], {}, { subject, titulo: subject, lineas: [], html });
        if (!r.ok) {
            log('[tienda-invitado] correo fallido', { to: destino, referencia: d.referencia, error: r.error });
            return 'failed';
        }
        return 'sent';
    } catch (err: any) {
        log('[tienda-invitado] correo fallido', { to: destino, referencia: d.referencia, error: err?.message });
        return 'failed';
    }
}

/** Base de la app para el enlace del correo (siempre https pública; ver url-publica-familias). */
export function baseEnlacePedido(): string {
    return appPublica();
}
