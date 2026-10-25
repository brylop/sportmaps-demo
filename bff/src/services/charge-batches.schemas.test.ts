/**
 * zod del modal «Cobros y pagos» (spec cobros-multiples §9.2). Sin red.
 */
import { describe, expect, it } from 'vitest';
import {
    ChargeBatchRequestSchema, ChargeBatchCreateSchema, filasDeLaOperacion, AnnulSchema, AdjustmentsQuerySchema, ReintentoHorasSchema,
} from './charge-batches.schemas';
import { todayInZone, addDaysToDateString } from '../utils/businessDate';

const HOY = todayInZone();
const VENCE = addDaysToDateString(HOY, 3);
const Y = Number(HOY.slice(0, 4));
const M = Number(HOY.slice(5, 7));
const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const torneo = (x: Record<string, unknown> = {}) => ({ category: 'torneo', amount: 80000, due_date: VENCE, concept: 'Torneo', ...x });
const base = (x: Record<string, unknown> = {}) => ({
    mode: 'single', target: { kind: 'athlete', ids: [id(1)] }, athletes: [{ type: 'child', id: id(1) }], lines: [torneo()], ...x,
});
const ok = (b: unknown) => ChargeBatchRequestSchema.safeParse(b).success;
const msg = (b: unknown) => {
    const r = ChargeBatchRequestSchema.safeParse(b);
    return r.success ? null : r.error.issues.map((i) => i.message).join(' | ');
};

describe('ChargeBatchRequestSchema', () => {
    it('un atleta con un torneo es válido y aplica defaults', () => {
        const r = ChargeBatchRequestSchema.parse(base());
        expect(r.pending).toEqual([]);
        expect(filasDeLaOperacion(r)).toBe(1);
    });

    it('caso mixto T20: pendientes con condonación y pronto pago + línea pagada + línea pendiente', () => {
        expect(ok(base({
            lines: [torneo({ pay_amount: 80000 }), { category: 'mensualidad', due_date: VENCE, concept: 'Mensualidad', period: { year: M === 12 ? Y + 1 : Y, month: M === 12 ? 1 : M + 1 } }],
            pending: [
                { payment_id: id(90), seen: { amount: 759150, amount_paid: 0 }, waive_late_fee: {}, pay_amount: 723000 },
                { payment_id: id(91), seen: { amount: 723000, amount_paid: 0 }, discount: { basis: 'porcentaje', value: 10, reason_code: 'pronto_pago' }, pay_amount: 650700 },
            ],
            payment: { method: 'cash', payment_date: HOY },
        }))).toBe(true);
    });

    it('mensualidad: período obligatorio, máx. 3 meses adelante y 12 atrás', () => {
        expect(msg(base({ lines: [{ category: 'mensualidad', due_date: VENCE, concept: 'M' }] }))).toContain('mes');
        const adelante = (n: number) => { const a = (M - 1 + n); return { year: Y + Math.floor(a / 12), month: (a % 12) + 1 }; };
        expect(ok(base({ lines: [{ category: 'mensualidad', due_date: VENCE, concept: 'M', period: adelante(3) }] }))).toBe(true);
        expect(ok(base({ lines: [{ category: 'mensualidad', due_date: VENCE, concept: 'M', period: adelante(4) }] }))).toBe(false);
        expect(ok(base({ lines: [{ category: 'mensualidad', due_date: VENCE, concept: 'M', period: adelante(-13) }] }))).toBe(false);
    });

    it('cobro único sin valor o con período → inválido', () => {
        expect(ok(base({ lines: [torneo({ amount: undefined })] }))).toBe(false);
        expect(ok(base({ lines: [torneo({ period: { year: Y, month: M } })] }))).toBe(false);
    });

    it('descuento y «No cobrar» son excluyentes; % ≤ 100; «otro» exige texto', () => {
        expect(ok(base({ lines: [torneo({ discount: { basis: 'valor', value: 1000, reason_code: 'beca' }, exonerate: { reason_text: 'beca total' } })] }))).toBe(false);
        expect(ok(base({ lines: [torneo({ discount: { basis: 'porcentaje', value: 100, reason_code: 'beca' } })] }))).toBe(true);
        expect(ok(base({ lines: [torneo({ discount: { basis: 'porcentaje', value: 100.5, reason_code: 'beca' } })] }))).toBe(false);
        expect(ok(base({ lines: [torneo({ discount: { basis: 'valor', value: 5, reason_code: 'otro', reason_text: 'Acuerdo con el club' } })] }))).toBe(true);
    });

    it('pago sin nada que pagar o pagos sin medio → inválido', () => {
        expect(ok(base({ payment: { method: 'cash', payment_date: HOY } }))).toBe(false);
        expect(ok(base({ lines: [torneo({ pay_amount: 80000 })] }))).toBe(false);
        expect(ok(base({ payment: { method: 'transfer', payment_date: addDaysToDateString(HOY, 1) }, lines: [torneo({ pay_amount: 1 })] }))).toBe(false);
    });

    it('modo varios: sin pendientes, sin pago, sin atleta nuevo, sin «No cobrar», sin pagos por línea', () => {
        const multi = (x: Record<string, unknown>) => base({ mode: 'multi', target: { kind: 'team', ids: [id(5)] }, athletes: [{ type: 'child', id: id(1) }, { type: 'child', id: id(2) }], ...x });
        expect(ok(multi({}))).toBe(true);
        expect(ok(multi({ lines: [torneo({ exonerate: { reason_text: 'no se cobra' } })] }))).toBe(false);
        expect(ok(multi({ lines: [torneo({ pay_amount: 1 })], payment: { method: 'cash', payment_date: HOY } }))).toBe(false);
        expect(ok(multi({ new_athlete: { kind: 'menor', full_name: 'Visitante', guardian_phone: '3001112222' }, athletes: [] }))).toBe(false);
    });

    it('modo un atleta con dos atletas → inválido; atleta nuevo excluye athletes[]', () => {
        expect(ok(base({ athletes: [{ type: 'child', id: id(1) }, { type: 'child', id: id(2) }] }))).toBe(false);
        const nuevo = { kind: 'adulto', full_name: 'Persona Nueva', guardian_phone: '3001112222' };
        expect(ok(base({ athletes: [], new_athlete: nuevo }))).toBe(true);
        expect(ok(base({ new_athlete: nuevo }))).toBe(false);
    });

    it('descuento general: referencias a líneas que existen', () => {
        const g = (refs: string[]) => base({ global_discount: { basis: 'valor', value: 1000, reason_code: 'varios_meses', line_refs: refs } });
        expect(ok(g(['new:0']))).toBe(true);
        expect(ok(g(['new:1']))).toBe(false);
        expect(ok(g([`pending:${id(9)}`]))).toBe(false);
    });

    it('topes Q10: 200 atletas y 600 filas', () => {
        const atletas = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'child', id: id(i) }));
        const multi = (n: number, lineas: number) => ({ mode: 'multi', target: { kind: 'list', ids: [] }, athletes: atletas(n), lines: Array.from({ length: lineas }, () => torneo()) });
        expect(ok(multi(200, 3))).toBe(true);
        expect(ok(multi(201, 1))).toBe(false);
        expect(ok(multi(100, 6))).toBe(true);
        expect(ok(multi(101, 6))).toBe(false);
    });
});

describe('ChargeBatchCreateSchema / otros', () => {
    it('exige client_request_id uuid y preview_hash', () => {
        expect(ChargeBatchCreateSchema.safeParse({ ...base(), client_request_id: 'x', preview_hash: 'h' }).success).toBe(false);
        expect(ChargeBatchCreateSchema.safeParse({ ...base(), client_request_id: id(7), preview_hash: '' }).success).toBe(false);
        const r = ChargeBatchCreateSchema.parse({ ...base(), client_request_id: id(7), preview_hash: 'h' });
        expect(r).toMatchObject({ notify_families: false, overrides: [] });
    });

    it('anular exige motivo de 3+ caracteres', () => {
        expect(AnnulSchema.safeParse({ reason: 'no', expected_count: 1 }).success).toBe(false);
        expect(AnnulSchema.safeParse({ reason: 'Lote por error', expected_count: 0 }).success).toBe(true);
    });

    it('informe: últimos 30 días por defecto', () => {
        const r = AdjustmentsQuerySchema.parse({});
        expect(r.to).toBe(HOY);
        expect(r.from).toBe(addDaysToDateString(HOY, -30));
    });
});

describe('horas adicionales vendidas por adelantado (extra_hours)', () => {
    const venta = (x: Record<string, unknown> = {}) => ({
        category: 'excedente', extra_hours: 2, enrollment_id: id(7), amount: 30625, due_date: VENCE, concept: 'Horas adicionales', pay_amount: 30625, ...x,
    });
    const conPago = { payment: { method: 'cash', payment_date: HOY } };

    it('2 horas con su inscripción y el pago es válido', () => {
        expect(ok(base({ lines: [venta()], ...conPago }))).toBe(true);
    });
    it('acepta fracciones de 15 minutos', () => {
        expect(ok(base({ lines: [venta({ extra_hours: 1.25 })], ...conPago }))).toBe(true);
        expect(ok(base({ lines: [venta({ extra_hours: 0.25 })], ...conPago }))).toBe(true);
    });
    it('rechaza lo que no es múltiplo de 15 minutos, cero, negativo y más de 24 h', () => {
        expect(msg(base({ lines: [venta({ extra_hours: 1.1 })], ...conPago }))).toContain('15 minutos');
        expect(ok(base({ lines: [venta({ extra_hours: 0 })], ...conPago }))).toBe(false);
        expect(ok(base({ lines: [venta({ extra_hours: -1 })], ...conPago }))).toBe(false);
        expect(ok(base({ lines: [venta({ extra_hours: 25 })], ...conPago }))).toBe(false);
    });
    it('exige la inscripción a la que se le suman', () => {
        expect(msg(base({ lines: [venta({ enrollment_id: undefined })], ...conPago }))).toContain('inscripción');
    });
    it('es excedente del período O horas vendidas, no ambos ni ninguno', () => {
        expect(ok(base({ lines: [venta({ overage_charge_id: id(8) })], ...conPago }))).toBe(false);
        expect(ok(base({ lines: [venta({ extra_hours: undefined })], ...conPago }))).toBe(false);
        expect(ok(base({ lines: [venta({ extra_hours: undefined, overage_charge_id: id(8) })], ...conPago }))).toBe(true);
    });
    it('las horas se venden PAGADAS: sin pay_amount no se acepta (sin pago no hay horas)', () => {
        expect(msg(base({ lines: [venta({ pay_amount: undefined })], ...conPago }))).toContain('pagadas');
        expect(msg(base({ lines: [venta({ pay_amount: 0 })], ...conPago }))).toContain('pagadas');
    });
    it('solo la categoría horas adicionales lleva extra_hours', () => {
        expect(msg(base({ lines: [torneo({ extra_hours: 2 })] }))).toContain('horas vendidas');
    });
    it('una sola venta por operación, solo en modo un atleta y sin atleta nuevo', () => {
        expect(msg(base({ lines: [venta(), venta()], ...conPago }))).toContain('Una venta');
        expect(ok(base({
            mode: 'multi', athletes: [{ type: 'child', id: id(1) }, { type: 'child', id: id(2) }],
            lines: [venta({ pay_amount: undefined })],
        }))).toBe(false);
        expect(ok(base({
            athletes: [], new_athlete: { kind: 'menor', full_name: 'Niña Nueva', guardian_phone: '3001234567' },
            lines: [venta()], ...conPago,
        }))).toBe(false);
    });
});

describe('ReintentoHorasSchema', () => {
    const cuerpo = (x: Record<string, unknown> = {}) => ({ athlete: { type: 'child', id: id(1) }, enrollment_id: id(7), extra_hours: 2, ...x });
    it('acepta atleta + inscripción + horas', () => {
        expect(ReintentoHorasSchema.safeParse(cuerpo()).success).toBe(true);
    });
    it('rechaza horas inválidas o ids que no son uuid', () => {
        expect(ReintentoHorasSchema.safeParse(cuerpo({ extra_hours: 1.1 })).success).toBe(false);
        expect(ReintentoHorasSchema.safeParse(cuerpo({ extra_hours: 0 })).success).toBe(false);
        expect(ReintentoHorasSchema.safeParse(cuerpo({ extra_hours: 30 })).success).toBe(false);
        expect(ReintentoHorasSchema.safeParse(cuerpo({ enrollment_id: 'x' })).success).toBe(false);
        expect(ReintentoHorasSchema.safeParse({ extra_hours: 2, enrollment_id: id(7) }).success).toBe(false);
    });
});
