/**
 * store-checkout (tienda v2 F0): el body HTTP → create_cart_order, el monto
 * contra orders.total_amount, y la firma Wompi con las llaves DEL VENDEDOR.
 *
 * Invariante D-5 = A: aunque las llaves de ENV estén cargadas, una orden de
 * tienda NUNCA se firma ni se cobra con ellas (son de una escuela real).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

const estado = vi.hoisted(() => ({
    seller: null as any,
    calls: [] as any[],
}));

vi.mock('../config/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('./payment-provider.resolver', () => ({
    resolveSellerGateway: async (ref: any) => { estado.calls.push(ref); return estado.seller; },
}));

import {
    StoreCheckoutSchema,
    toCreateCartOrderArgs,
    amountMatchesOrder,
    gatewayPayloadForOrder,
    sellerGatewayForOrder,
    SellerGatewayError,
} from './store-checkout';

const ENV = { ...process.env };
const ORDER = {
    id: 'o1',
    reference: 'CART-ABC-123',
    total_amount: 178000,
    payment_method: 'wompi',
    seller_gateway_id: 'gw-vendedor',
    seller_gateway_kind: 'vendor',
};

beforeEach(() => {
    estado.seller = null;
    estado.calls = [];
    process.env.WOMPI_INTEGRITY_SECRET = 'integrity_ENV_DYNASTY';
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_ENV';
    process.env.WOMPI_PRIVATE_KEY = 'prv_prod_ENV';
});
afterEach(() => { process.env = { ...ENV }; });

describe('toCreateCartOrderArgs', () => {
    it('contrato nuevo: precio del cliente descartado, comprador = sesión', () => {
        const body = StoreCheckoutSchema.parse({
            items: [{ productId: '00000000-0000-4000-d000-000000000002', quantity: 2, unitPrice: 1, total: 1 }],
            fulfillment: 'pickup',
            paymentMethod: 'transfer',
            buyer: { name: 'Padre' },
            idempotencyKey: '11111111-1111-4111-8111-111111111111',
        });
        const a = toCreateCartOrderArgs(body, 'user-sesion');
        expect(a.p_items).toEqual([{ product_id: '00000000-0000-4000-d000-000000000002', quantity: 2 }]);
        expect(JSON.stringify(a)).not.toMatch(/unitPrice|unit_price|"total"/);
        expect(a.p_buyer_id).toBe('user-sesion');
        expect(a.p_payment_method).toBe('transfer');
        expect(a.p_fulfillment).toBe('pickup');
        expect(a.p_address).toBeNull();
        expect(a.p_idempotency_key).toBe('11111111-1111-4111-8111-111111111111');
    });

    it('body legacy de CartCheckoutModal: envío con la dirección y el proveedor preferido', () => {
        const body = StoreCheckoutSchema.parse({
            items: [{ productId: '00000000-0000-4000-d000-000000000002', variantId: '00000000-0000-4000-e000-000000000005', quantity: 1 }],
            shippingAddress: { line1: 'Cra 1', city: 'Medellín', department: 'Antioquia' },
            contactPhone: '3000000000', contactEmail: 'a@b.co', customerName: 'Ana',
            preferredProvider: 'mercadopago',
        });
        const a = toCreateCartOrderArgs(body, 'u');
        expect(a.p_fulfillment).toBe('shipping');
        expect(a.p_address).toMatchObject({ departamento: 'Antioquia', ciudad: 'Medellín', direccion: 'Cra 1' });
        expect(a.p_payment_method).toBe('mercadopago');
        expect(a.p_buyer).toEqual({ name: 'Ana', email: 'a@b.co', phone: '3000000000' });
        expect(a.p_items[0]).toEqual({ variant_id: '00000000-0000-4000-e000-000000000005', product_id: '00000000-0000-4000-d000-000000000002', quantity: 1 });
    });

    it('cantidades fuera de 1–20 no pasan el schema', () => {
        expect(StoreCheckoutSchema.safeParse({ items: [{ productId: '00000000-0000-4000-d000-000000000002', quantity: 21 }] }).success).toBe(false);
        expect(StoreCheckoutSchema.safeParse({ items: [{ quantity: 1 }] }).success).toBe(false);
    });
});

describe('amountMatchesOrder', () => {
    it('al peso, en centavos o en pesos', () => {
        expect(amountMatchesOrder(178000, { cents: 17800000 })).toBe(true);
        expect(amountMatchesOrder('178000', { cop: 178000 })).toBe(true);
        expect(amountMatchesOrder(178000, { cents: 17800100 })).toBe(false);
        expect(amountMatchesOrder(178000, { cop: 177999 })).toBe(false);
        expect(amountMatchesOrder(0, { cop: 0 })).toBe(false);
        expect(amountMatchesOrder(178000, {})).toBe(false);
    });
});

describe('gatewayPayloadForOrder (D-5 = A)', () => {
    it('Wompi: firma con el integrity secret DEL VENDEDOR y su llave pública', async () => {
        estado.seller = {
            provider: 'wompi', publicKey: 'pub_test_VENDEDOR', accessToken: 'prv_test_VENDEDOR',
            integritySecret: 'integrity_VENDEDOR', webhookSecret: 'events_VENDEDOR', sandbox: true, isDefault: true, source: 'vendor',
        };
        const g = await gatewayPayloadForOrder(ORDER);
        const esperada = crypto.createHash('sha256').update('CART-ABC-12317800000COPintegrity_VENDEDOR').digest('hex');
        const conEnv = crypto.createHash('sha256').update('CART-ABC-12317800000COPintegrity_ENV_DYNASTY').digest('hex');
        expect(g.signature).toBe(esperada);
        expect(g.signature).not.toBe(conEnv);
        expect(g.publicKey).toBe('pub_test_VENDEDOR');
        expect(g.amountInCents).toBe(17800000);
        expect(estado.calls).toEqual([{ gatewayId: 'gw-vendedor', gatewayKind: 'vendor' }]);
    });

    it('sin pasarela resoluble del vendedor → SellerGatewayError (nunca cae a ENV)', async () => {
        estado.seller = null;
        await expect(gatewayPayloadForOrder(ORDER)).rejects.toBeInstanceOf(SellerGatewayError);
    });

    it("una credencial con source 'env' se rechaza aunque llegue", async () => {
        estado.seller = { provider: 'wompi', publicKey: 'pub_prod_ENV', accessToken: 'x', integritySecret: 'y', sandbox: false, isDefault: true, source: 'env' };
        await expect(sellerGatewayForOrder(ORDER)).rejects.toBeInstanceOf(SellerGatewayError);
    });

    it('la pasarela del vendedor debe ser del mismo proveedor que la orden', async () => {
        estado.seller = { provider: 'mercadopago', publicKey: 'APP_USR-x', accessToken: 'tok', sandbox: true, isDefault: true, source: 'school_direct' };
        await expect(sellerGatewayForOrder(ORDER)).rejects.toBeInstanceOf(SellerGatewayError);
    });

    it('MP: devuelve la llave pública del vendedor, sin firma', async () => {
        estado.seller = { provider: 'mercadopago', publicKey: 'TEST-pub-VEND', accessToken: 'TEST-tok', sandbox: true, isDefault: true, source: 'vendor' };
        const g = await gatewayPayloadForOrder({ ...ORDER, payment_method: 'mercadopago' });
        expect(g).toMatchObject({ provider: 'mercadopago', publicKey: 'TEST-pub-VEND', amountInCents: 17800000 });
        expect(g.signature).toBeUndefined();
    });

    it('transferencia/efectivo no abren pasarela', async () => {
        await expect(gatewayPayloadForOrder({ ...ORDER, payment_method: 'transfer' })).rejects.toBeInstanceOf(SellerGatewayError);
        expect(estado.calls).toEqual([]);
    });
});
