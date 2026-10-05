import { describe, it, expect } from 'vitest';
import { isRetryableWithSameKey, storeErrorCode, storeErrorView } from '../lib/store/storeErrors';
import {
  buyerCanCancel, buyerCanConfirmReceived, buyerCanRetryGateway, buyerCanUploadReceipt, buyerStatusMessage,
  buyerTimeline, isValidPickupCode, sellerActions,
} from '../lib/store/orderStatus';

/** Imita el BFFError: { status, message, body: { ok:false, error, message, details? } }. */
const bff = (status: number, error: string, details?: unknown) =>
  Object.assign(new Error(error), { status, body: { ok: false, error, message: 'x', ...(details ? { details } : {}) } });

describe('errores del contrato → mensaje claro', () => {
  it('todos los códigos del contrato §4 tienen texto propio (nunca "Algo salió mal")', () => {
    const codes = [
      'STORE_DISABLED', 'SELLER_NOT_ALLOWED', 'MULTIPLE_SELLERS', 'PRODUCT_NOT_FOUND', 'PRODUCT_NOT_AVAILABLE',
      'VARIANT_REQUIRED', 'INSUFFICIENT_STOCK', 'INVALID_QTY', 'COUPONS_NOT_AVAILABLE', 'PAYMENT_METHOD_NOT_ACCEPTED',
      'GATEWAY_NOT_CONFIGURED', 'NO_TRANSFER_ACCOUNTS', 'SELLER_GATEWAY_NOT_CONFIGURED', 'CASH_REQUIRES_PICKUP',
      'ADDRESS_REQUIRED', 'INVALID_PICKUP_BRANCH', 'INVALID_FULFILLMENT', 'SHIPPING_ZONE_NOT_FOUND', 'INVALID_STATE',
      'ORDER_EXPIRED', 'TRANSITION_NOT_ALLOWED', 'INVALID_PICKUP_CODE', 'NOT_OWNER', 'FORBIDDEN', 'REASON_REQUIRED',
      'INVALID_RECEIPT_PATH', 'INVALID_FILE',
    ];
    for (const c of codes) {
      const v = storeErrorView(bff(409, c));
      expect(v.code, c).toBe(c);
      expect(v.title, c).not.toBe('Algo salió mal');
      expect(v.description, c).not.toMatch(/[A-Z]{3,}_[A-Z]/); // no se filtra el código crudo
    }
  });

  it('STORE_DISABLED → mensaje de tienda cerrada y acción store_off', () => {
    const v = storeErrorView(bff(503, 'STORE_DISABLED'));
    expect(v.title).toBe('La tienda no está disponible');
    expect(v.action).toBe('store_off');
  });

  it('INSUFFICIENT_STOCK con detalle dice cuántas quedan', () => {
    const v = storeErrorView(bff(409, 'INSUFFICIENT_STOCK', [{ product_id: 'p', variant_id: null, requested: 4, available: 1 }]));
    expect(v.description).toContain('Solo quedan 1');
    expect(v.action).toBe('review_cart');
    expect(storeErrorView(bff(409, 'INSUFFICIENT_STOCK', [{ product_id: 'p', requested: 1, available: 0 }])).description).toContain('se agotó');
  });

  it('medios de pago no disponibles ofrecen elegir otro', () => {
    for (const c of ['GATEWAY_NOT_CONFIGURED', 'SELLER_GATEWAY_NOT_CONFIGURED', 'NO_TRANSFER_ACCOUNTS', 'PAYMENT_METHOD_NOT_ACCEPTED']) {
      expect(storeErrorView(bff(409, c)).action).toBe('choose_other_method');
    }
  });

  it('error de una RPC directa (token en el message de PostgREST)', () => {
    expect(storeErrorCode({ code: 'P0001', message: 'INSUFFICIENT_STOCK' })).toBe('INSUFFICIENT_STOCK');
    expect(storeErrorCode({ code: '42501', message: 'NOT_OWNER' })).toBe('NOT_OWNER');
  });

  it('desconocido / red / sesión', () => {
    expect(storeErrorView(bff(500, 'INTERNAL')).title).toBe('Algo salió mal');
    expect(storeErrorView(new TypeError('Failed to fetch')).code).toBe('NETWORK');
    expect(storeErrorView(Object.assign(new Error('x'), { status: 401 })).action).toBe('login');
    expect(storeErrorView(Object.assign(new Error('Límite'), { status: 429, body: { error: 'Límite de operaciones de pago alcanzado.' } })).code).toBe('RATE_LIMITED');
  });

  it('idempotency key: se reusa solo si el pedido pudo haberse creado (red / 5xx)', () => {
    expect(isRetryableWithSameKey(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableWithSameKey(bff(502, 'BAD_GATEWAY'))).toBe(true);
    expect(isRetryableWithSameKey(bff(409, 'INSUFFICIENT_STOCK'))).toBe(false);
    expect(isRetryableWithSameKey(bff(503, 'STORE_DISABLED'))).toBe(false);
  });
});

describe('estados — comprador', () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const past = new Date(Date.now() - 3600_000).toISOString();

  it('subir comprobante: transferencia pendiente y vigente', () => {
    expect(buyerCanUploadReceipt({ status: 'pending_payment', payment_method: 'transfer', expires_at: future })).toBe(true);
    expect(buyerCanUploadReceipt({ status: 'pending_payment', payment_method: 'transfer', expires_at: past })).toBe(false);
    expect(buyerCanUploadReceipt({ status: 'awaiting_approval', payment_method: 'transfer' })).toBe(false);
    expect(buyerCanUploadReceipt({ status: 'pending_payment', payment_method: 'cash_pickup' })).toBe(false);
  });

  it('cancelar solo antes de pagar; "ya lo recibí" solo enviado; reabrir pasarela solo pendiente', () => {
    expect(buyerCanCancel({ status: 'pending_payment' })).toBe(true);
    expect(buyerCanCancel({ status: 'awaiting_approval' })).toBe(true);
    expect(buyerCanCancel({ status: 'paid' })).toBe(false);
    expect(buyerCanConfirmReceived({ status: 'shipped' })).toBe(true);
    expect(buyerCanConfirmReceived({ status: 'ready_for_pickup' })).toBe(false);
    expect(buyerCanRetryGateway({ status: 'pending_payment', payment_method: 'wompi', expires_at: future })).toBe(true);
    expect(buyerCanRetryGateway({ status: 'pending_payment', payment_method: 'transfer' })).toBe(false);
  });

  it('mensaje con el motivo de rechazo del comprobante', () => {
    expect(buyerStatusMessage({ status: 'pending_payment', payment_method: 'transfer', rejection_reason: 'valor incompleto' }))
      .toContain('valor incompleto');
    expect(buyerStatusMessage({ status: 'awaiting_approval', payment_method: 'transfer' })).toContain('revisando');
    expect(buyerStatusMessage({ status: 'paid' })).toContain('Pago confirmado');
  });

  it('línea de tiempo: retiro vs envío y paso actual', () => {
    const pickup = buyerTimeline({ status: 'preparing', fulfillment_mode: 'pickup' });
    expect(pickup.map((s) => s.status)).toEqual(['pending_payment', 'paid', 'preparing', 'ready_for_pickup', 'delivered']);
    expect(pickup.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo']);
    expect(buyerTimeline({ status: 'shipped', fulfillment_mode: 'shipping' })[3].status).toBe('shipped');
    expect(buyerTimeline({ status: 'awaiting_approval' })[0]).toMatchObject({ label: 'Comprobante en revisión', state: 'current' });
    expect(buyerTimeline({ status: 'delivered' }).every((s) => s.state === 'done')).toBe(true);
  });
});

describe('estados — tienda', () => {
  const kinds = (o: Parameters<typeof sellerActions>[0]) => sellerActions(o).map((a) => (a.kind === 'transition' ? `→${a.to}` : a.kind));

  it('matriz del contrato §2.4', () => {
    expect(kinds({ status: 'awaiting_approval', payment_method: 'transfer' })).toEqual(['approve_receipt', 'reject_receipt']);
    expect(kinds({ status: 'pending_payment', payment_method: 'cash_pickup' })).toEqual(['confirm_cash', 'cancel']);
    expect(kinds({ status: 'pending_payment', payment_method: 'transfer' })).toEqual(['cancel']);
    expect(kinds({ status: 'paid' })).toEqual(['→preparing']);
    expect(kinds({ status: 'preparing', fulfillment_mode: 'pickup' })).toEqual(['→ready_for_pickup']);
    expect(kinds({ status: 'preparing', fulfillment_mode: 'shipping' })).toEqual(['→shipped']);
    expect(kinds({ status: 'ready_for_pickup' })).toEqual(['→delivered']);
    expect(kinds({ status: 'delivered' })).toEqual([]);
    expect(kinds({ status: 'cancelled' })).toEqual([]);
  });

  it('entregar un retiro exige el código; enviado pide guía', () => {
    const [deliver] = sellerActions({ status: 'ready_for_pickup' });
    expect(deliver).toMatchObject({ kind: 'transition', to: 'delivered', needsPickupCode: true });
    const [ship] = sellerActions({ status: 'preparing', fulfillment_mode: 'shipping' });
    expect(ship).toMatchObject({ needsTracking: true });
    expect(isValidPickupCode('123456')).toBe(true);
    expect(isValidPickupCode('12345')).toBe(false);
    expect(isValidPickupCode('12a456')).toBe(false);
  });
});
