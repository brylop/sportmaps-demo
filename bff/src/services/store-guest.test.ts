import { describe, expect, it, vi } from 'vitest';
import {
    GuestCheckoutSchema, toCreateGuestCartOrderArgs, guestTokenFrom, modoCorreoInvitado,
    correoPedidoInvitado, enviarCorreoPedidoInvitado, enlaceDePedido,
} from './store-guest';

const KEY = '0b7f2c1e-1111-4222-8333-444455556666';
const base = {
    items: [{ productId: '00000000-0000-4000-d000-00000000f101', quantity: 2 }],
    fulfillment: 'pickup',
    buyer: { name: 'Socio Sin Cuenta', email: ' Socio@GYM.co ', phone: '300 123 4567' },
    paymentMethod: 'transfer',
    idempotencyKey: KEY,
};

describe('GuestCheckoutSchema', () => {
    it('acepta el contrato mínimo (correo y nombre obligatorios, teléfono opcional)', () => {
        expect(GuestCheckoutSchema.safeParse(base).success).toBe(true);
        const { phone: _p, ...sinTel } = base.buyer;
        expect(GuestCheckoutSchema.safeParse({ ...base, buyer: sinTel }).success).toBe(true);
    });

    it.each([
        ['sin correo', { ...base, buyer: { name: 'Socio X' } }, 'buyer.email'],
        ['correo inválido', { ...base, buyer: { ...base.buyer, email: 'socio@' } }, 'buyer.email'],
        ['sin nombre', { ...base, buyer: { email: 'a@b.co' } }, 'buyer.name'],
        ['teléfono con letras', { ...base, buyer: { ...base.buyer, phone: '30A-12' } }, 'buyer.phone'],
        ['Mercado Pago (necesita sesión)', { ...base, paymentMethod: 'mercadopago' }, 'paymentMethod'],
        ['sin idempotency key', { ...base, idempotencyKey: undefined }, 'idempotencyKey'],
        ['cantidad 0', { ...base, items: [{ productId: base.items[0].productId, quantity: 0 }] }, 'items.0.quantity'],
    ])('rechaza: %s', (_n, body, campo) => {
        const r = GuestCheckoutSchema.safeParse(body);
        expect(r.success).toBe(false);
        expect(r.error!.issues.map((i) => i.path.join('.'))).toContain(campo);
    });
});

describe('toCreateGuestCartOrderArgs', () => {
    it('normaliza correo y teléfono, pasa la IP y NUNCA precios', () => {
        const body = GuestCheckoutSchema.parse({ ...base, items: [{ ...base.items[0], unitPrice: 1, total: 1 }] });
        const a = toCreateGuestCartOrderArgs(body, '181.63.24.103');
        expect(a.p_items).toEqual([{ product_id: base.items[0].productId, quantity: 2 }]);
        expect(a.p_buyer).toEqual({ name: 'Socio Sin Cuenta', email: 'socio@gym.co', phone: '3001234567' });
        expect(a.p_client_ip).toBe('181.63.24.103');
        expect(a.p_idempotency_key).toBe(KEY);
        expect(a.p_payment_method).toBe('transfer');
        expect(JSON.stringify(a)).not.toMatch(/unit_?price|"total"/i);
        expect(a).not.toHaveProperty('p_buyer_id');
    });
});

describe('guestTokenFrom', () => {
    const t = 'a'.repeat(64);
    it('solo 64 hex en minúsculas desde el header', () => {
        expect(guestTokenFrom({ 'x-pedido-token': t })).toBe(t);
        expect(guestTokenFrom({ 'x-pedido-token': ` ${t} ` })).toBe(t);
        expect(guestTokenFrom({ 'x-pedido-token': t.toUpperCase() })).toBeNull();
        expect(guestTokenFrom({ 'x-pedido-token': t.slice(1) })).toBeNull();
        expect(guestTokenFrom({})).toBeNull();
    });
});

describe('modoCorreoInvitado', () => {
    it('simula en el gemelo, local, tests y con SIMULATE_EMAILS', () => {
        expect(modoCorreoInvitado({ SUPABASE_URL: 'http://127.0.0.1:54321' })).toBe('simulate');
        expect(modoCorreoInvitado({ SUPABASE_URL: 'http://localhost:54321' })).toBe('simulate');
        expect(modoCorreoInvitado({ SUPABASE_URL: 'https://x.supabase.co', SIMULATE_EMAILS: 'true' })).toBe('simulate');
        expect(modoCorreoInvitado({ SUPABASE_URL: 'https://x.supabase.co', STORE_GUEST_EMAIL_MODE: 'simulate' })).toBe('simulate');
        expect(modoCorreoInvitado({ SUPABASE_URL: 'https://x.supabase.co', NODE_ENV: 'test' })).toBe('simulate');
        expect(modoCorreoInvitado({})).toBe('simulate');
    });
    it('manda de verdad solo contra Supabase en la nube', () => {
        expect(modoCorreoInvitado({ SUPABASE_URL: 'https://abc.supabase.co' })).toBe('send');
    });
});

describe('correo del pedido', () => {
    const datos = {
        to: 'socio@gym.co', nombre: '<b>Socio</b>', tienda: 'GYM RM', referencia: 'CART-1', total: 80000,
        medio: 'transfer', retiro: true, sede: 'Sede Norte', codigoRetiro: null, enlace: enlaceDePedido('https://app.sportmaps.co', 'f'.repeat(64)),
    };
    it('trae el enlace, escapa lo del usuario e invita a crear cuenta con el mismo correo', () => {
        const { subject, html } = correoPedidoInvitado(datos);
        expect(subject).toBe('Tu pedido CART-1 en GYM RM');
        expect(html).toContain(`https://app.sportmaps.co/pedido/${'f'.repeat(64)}`);
        expect(html).not.toContain('<b>Socio</b>');
        expect(html).toContain('&lt;b&gt;Socio&lt;/b&gt;');
        expect(html).toMatch(/Crea tu cuenta en SportMaps con este mismo correo/);
        expect(html).toMatch(/sube el comprobante/);
    });
    it('efectivo: muestra el código de retiro', () => {
        expect(correoPedidoInvitado({ ...datos, medio: 'cash_pickup', codigoRetiro: '123456' }).html).toContain('123456');
    });
    it('simulación: no llama al proveedor ni registra el token', async () => {
        const enviar = vi.fn();
        const log = vi.fn();
        const r = await enviarCorreoPedidoInvitado(datos, { modo: 'simulate', enviar: enviar as any, log });
        expect(r).toBe('simulated');
        expect(enviar).not.toHaveBeenCalled();
        expect(JSON.stringify(log.mock.calls)).not.toContain('f'.repeat(64));
        expect(JSON.stringify(log.mock.calls)).not.toContain('socio@gym.co');
    });
    it('envío real: un destinatario, HTML propio; un fallo no lanza', async () => {
        const enviar = vi.fn().mockResolvedValue({ ok: true });
        expect(await enviarCorreoPedidoInvitado(datos, { modo: 'send', enviar: enviar as any, log: () => {} })).toBe('sent');
        expect(enviar).toHaveBeenCalledWith(null, ['socio@gym.co'], {}, expect.objectContaining({ html: expect.stringContaining('/pedido/') }));
        const falla = vi.fn().mockRejectedValue(new Error('caído'));
        expect(await enviarCorreoPedidoInvitado(datos, { modo: 'send', enviar: falla as any, log: () => {} })).toBe('failed');
    });
});
