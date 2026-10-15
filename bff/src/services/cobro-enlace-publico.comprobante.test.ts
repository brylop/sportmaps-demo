/**
 * Comprobante por el enlace público con un cobro abonado ('partial', 2026-10-14):
 * se acepta y el veredicto se calcula contra el SALDO
 * (amount - amount_paid - early_payment_discount_applied), no contra `amount`.
 * Cero red y cero base: Supabase, OCR y el estampado están moqueados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    pago: null as any,
    estampar: vi.fn(),
}));

vi.mock('../config/supabase', () => {
    const builder = () => {
        const b: any = {};
        for (const op of ['select', 'eq', 'neq', 'not', 'limit', 'in', 'update']) b[op] = () => b;
        b.maybeSingle = async () => ({ data: h.pago, error: null });
        b.then = (ok: any, ko: any) => Promise.resolve({ data: [], error: null }).then(ok, ko);
        return b;
    };
    return {
        supabase: {
            from: () => builder(),
            rpc: async () => ({ data: true, error: null }),
            storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
        },
    };
});
vi.mock('./ocr.service', () => ({
    extractReceipt: vi.fn(async () => ({
        amount: 90000, currency: 'COP', date: null, time: null, bank: null, reference: null,
        destination: null, destinationName: null, originName: null,
        isReceipt: true, isTransactionList: false, missingFields: [], provider: 'mock',
    })),
}));
vi.mock('../jobs/whatsapp-queue.job', () => ({ estamparComprobante: h.estampar }));

import { ESTADOS_QUE_ACEPTAN_COMPROBANTE, subirComprobantePorToken } from './cobro-enlace-publico.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(1024)]);
const R = { ok: true as const, paymentId: 'pay-1', schoolId: 'sch-1', venceEn: '2099-01-01T00:00:00Z' };

beforeEach(() => {
    h.estampar.mockReset();
    h.estampar.mockResolvedValue({ ok: true, actualizado: true, veredicto: { verdict: 'rojo', reasons: [] } });
    h.pago = {
        id: 'pay-1', school_id: 'sch-1', amount: 165000, amount_paid: 65000, early_payment_discount_applied: 10000,
        late_fee_amount: 15000, status: 'partial', requires_review: false,
    };
});

describe('comprobante de un cobro abonado', () => {
    it("'partial' acepta comprobante", () => {
        expect(ESTADOS_QUE_ACEPTAN_COMPROBANTE).toEqual(['pending', 'overdue', 'partial']);
    });

    it('se estampa con el saldo como monto esperado y permitiendo partial', async () => {
        const out = await subirComprobantePorToken(R as any, PNG);
        expect(out).toEqual({ ok: true, estado: 'en_revision' });
        const [, pago, esperado, opciones] = h.estampar.mock.calls[0];
        expect(pago).toMatchObject({ id: 'pay-1', amount: 165000 });
        expect(esperado).toBe(90000);
        expect(opciones).toEqual({ estados: ['pending', 'overdue', 'partial'] });
    });

    it('pendiente sin abonos: el esperado es el total (mora incluida)', async () => {
        Object.assign(h.pago, { status: 'overdue', amount_paid: 0, early_payment_discount_applied: null });
        await subirComprobantePorToken(R as any, PNG);
        expect(h.estampar.mock.calls[0][2]).toBe(165000);
    });

    it('pagado o anulado: no se sube', async () => {
        h.pago.status = 'cancelled';
        const out = await subirComprobantePorToken(R as any, PNG);
        expect(out).toMatchObject({ ok: false, code: 'no_pagable' });
        expect(h.estampar).not.toHaveBeenCalled();
    });
});
