import { describe, expect, it, vi } from 'vitest';

// El servicio de horas importa Supabase; aquí solo se prueba la regla pura.
vi.mock('../config/supabase', () => ({ supabase: {} }));

import { CobrosError } from './charge-batches.service';
import { totalAPagar, verificarComprobanteConHoras } from './comprobante-horas';

type Cuerpo = Parameters<typeof verificarComprobanteConHoras>[0];

const linea = (over: Record<string, unknown> = {}) => ({ category: 'mensualidad', due_date: '2026-11-01', concept: 'Mensualidad', pay_amount: 387_000, ...over });
const horas = (pay = 64_500) => linea({ category: 'excedente', concept: 'Horas adicionales', extra_hours: 2, enrollment_id: 'enr-1', pay_amount: pay });
const pago = (ocrAmount: number | null, over: Record<string, unknown> = {}) => ({
    method: 'transfer', payment_date: '2026-10-21', receipt_url: 'u/x.png', ocr: ocrAmount == null ? undefined : { ocr_amount: ocrAmount }, ...over,
});
const cuerpo = (lines: unknown[], payment: unknown, pending: unknown[] = []) => ({ lines, pending, payment }) as unknown as Cuerpo;

describe('totalAPagar', () => {
    it('suma lo pagado en líneas nuevas y pendientes', () => {
        expect(totalAPagar(cuerpo([linea(), horas()], null, [{ pay_amount: 10_000 }]))).toBe(461_500);
    });
});

describe('verificarComprobanteConHoras', () => {
    it('comprobante que cubre el total: pasa', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(451_500)))).not.toThrow();
    });
    it('comprobante de más: pasa (solo bloquea por menos)', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(500_000)))).not.toThrow();
    });
    it('comprobante igual al total SIN las horas: bloquea con 422 y los montos', () => {
        try {
            verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(387_000)));
            throw new Error('debía bloquear');
        } catch (e) {
            expect(e).toBeInstanceOf(CobrosError);
            const err = e as CobrosError;
            expect(err.status).toBe(422);
            expect(err.code).toBe('COMPROBANTE_MENOR_AL_TOTAL');
            expect(err.extra).toEqual({ comprobante: 387_000, total: 451_500 });
        }
    });
    it('un peso de menos ya bloquea (tolerancia 0, como el veredicto)', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(451_499)))).toThrow(CobrosError);
    });
    it('sin horas en la operación no se mete (caso de siempre)', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea()], pago(100_000)))).not.toThrow();
    });
    it('en efectivo o sin comprobante no aplica', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(1, { method: 'cash', receipt_url: undefined })))).not.toThrow();
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(1, { receipt_url: undefined })))).not.toThrow();
    });
    it('sin monto leído por el OCR o sin pago no hay con qué comparar', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], pago(null)))).not.toThrow();
        expect(() => verificarComprobanteConHoras(cuerpo([linea(), horas()], undefined))).not.toThrow();
    });
    it('las horas solas con comprobante menor: bloquea', () => {
        expect(() => verificarComprobanteConHoras(cuerpo([horas(64_500)], pago(30_000)))).toThrow(CobrosError);
    });
});
