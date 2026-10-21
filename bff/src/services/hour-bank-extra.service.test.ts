/**
 * Venta de horas adicionales por adelantado: lo que se verifica ANTES de cobrar,
 * lo que se suma al banco DESPUÉS y lo que se revierte al anular.
 *
 * La base falsa APLICA los filtros (eq / like / in / is) sobre filas con la forma
 * REAL que deja la RPC del lote — en particular el concepto «<concepto> — <atleta>».
 * Una versión anterior simulaba la tabla entera y no vio que la búsqueda por
 * igualdad de concepto nunca encontraba el pago.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, unknown>;
const h = vi.hoisted(() => ({
    tablas: {} as Record<string, { data: unknown; error: { message: string } | null }>,
    rpc: vi.fn(),
}));

vi.mock('../config/supabase', () => {
    const consulta = (tabla: string) => {
        const filtros: ((f: Fila) => boolean)[] = [];
        const res = () => {
            const r = h.tablas[tabla] ?? { data: null, error: null };
            if (!Array.isArray(r.data)) return Promise.resolve(r);
            return Promise.resolve({ data: (r.data as Fila[]).filter((f) => filtros.every((fn) => fn(f))), error: r.error });
        };
        const b: any = {
            select: () => b,
            eq: (c: string, v: unknown) => { filtros.push((f) => f[c] === v); return b; },
            in: (c: string, vs: unknown[]) => { filtros.push((f) => vs.includes(f[c])); return b; },
            is: (c: string, v: unknown) => { filtros.push((f) => (f[c] ?? null) === v); return b; },
            like: (c: string, p: string) => {
                filtros.push((f) => typeof f[c] === 'string' && (p.endsWith('%') ? (f[c] as string).startsWith(p.slice(0, -1)) : f[c] === p));
                return b;
            },
            limit: () => b,
            maybeSingle: () => res(),
            then: (ok: any, ko: any) => res().then(ok, ko),
        };
        return b;
    };
    return { supabase: { from: (t: string) => consulta(t), rpc: (...a: unknown[]) => h.rpc(...a) } };
});

import {
    lineaDeHoras, reintentarSumaDeHoras, revertirHorasDeLote, sumarHorasAdicionales, verificarHorasAdicionales,
} from './hour-bank-extra.service';
import { CobrosError, argsCreate, argsPreview } from './charge-batches.service';
import { conceptoHorasAdicionales, formatearHoras, minutosDeHoras, tarifaPorHora } from './hour-bank-extra.shared';
import { todayInZone } from '../utils/businessDate';

const ESCUELA = 'e0000000-0000-4000-8000-000000000001';
const ACTOR = 'a0000000-0000-4000-8000-000000000001';
const NINA = 'c0000000-0000-4000-8000-000000000001';
const OTRA_NINA = 'c0000000-0000-4000-8000-000000000002';
const INSC = 'd0000000-0000-4000-8000-000000000001';
const PAGO = 'f0000000-0000-4000-8000-000000000001';
const LOTE = 'b0000000-0000-4000-8000-000000000001';
const ATLETA = { type: 'child', id: NINA } as const;

const linea = (x: Record<string, unknown> = {}) => ({
    category: 'excedente', extra_hours: 2, enrollment_id: INSC, amount: 30625, due_date: todayInZone(), concept: 'Horas adicionales', pay_amount: 30625, ...x,
}) as any;
const lote = (lines: any[], athletes: any[] = [ATLETA]) => ({ lines, athletes }) as any;

/** El pago tal como lo deja create_charge_batch: concepto con « — nombre del atleta». */
const pagoReal = (x: Fila = {}): Fila => ({
    id: PAGO, status: 'paid', amount: 30625, school_id: ESCUELA, charge_batch_id: LOTE, payment_category: 'clase_extra',
    concept: 'Horas adicionales · 2 h — Ana Pérez', child_id: NINA, ...x,
});

beforeEach(() => {
    h.tablas = {
        enrollments: { data: { id: INSC, offering_plan_id: 'p1', status: 'active' }, error: null },
        offering_plans: { data: { included_minutes_per_period: 720 }, error: null },
        school_settings: { data: { hours_plan_enabled: true }, error: null },
        hour_bank_grants: { data: [], error: null },
        payments: { data: [pagoReal()], error: null },
        charge_batches: { data: { id: LOTE }, error: null },
    };
    h.rpc.mockReset();
    h.rpc.mockResolvedValue({ data: { granted: true, duplicated: false, minutes: 120, period_id: 'per1', available_minutes: 840 }, error: null });
});

describe('helpers puros', () => {
    it('formatea horas en es-CO y arma el concepto', () => {
        expect(formatearHoras(2)).toBe('2');
        expect(formatearHoras(1.5)).toBe('1,5');
        expect(formatearHoras(2.25)).toBe('2,25');
        expect(conceptoHorasAdicionales(2)).toBe('Horas adicionales · 2 h');
    });
    it('minutos y tarifa por hora (la fórmula del excedente)', () => {
        expect(minutosDeHoras(2)).toBe(120);
        expect(minutosDeHoras(1.25)).toBe(75);
        expect(tarifaPorHora(387000, 720)).toBe(32250);   // PGR6x2 de Dreamers
        expect(tarifaPorHora(122500, 480)).toBe(15313);   // 122.500 ÷ 8 h
        expect(tarifaPorHora(0, 720)).toBeNull();
        expect(tarifaPorHora(100000, 0)).toBeNull();
    });
});

describe('lineaDeHoras', () => {
    it('devuelve la línea de horas o null', () => {
        expect(lineaDeHoras(lote([linea()]))?.extra_hours).toBe(2);
        expect(lineaDeHoras(lote([{ category: 'torneo', amount: 1 }]))).toBeNull();
    });
});

describe('verificarHorasAdicionales (antes del lote)', () => {
    it('sin venta de horas no consulta nada', async () => {
        h.tablas.enrollments = { data: null, error: { message: 'no debía llamarse' } };
        await expect(verificarHorasAdicionales(ESCUELA, lote([{ category: 'torneo', amount: 1 }]))).resolves.toBeUndefined();
    });
    it('todo en orden: no lanza', async () => {
        await expect(verificarHorasAdicionales(ESCUELA, lote([linea()]))).resolves.toBeUndefined();
    });
    it('sin atleta', async () => {
        await expect(verificarHorasAdicionales(ESCUELA, lote([linea()], []))).rejects.toMatchObject({ code: 'HORAS_SIN_ATLETA' });
    });
    it('inscripción de otro atleta o escuela → 404', async () => {
        h.tablas.enrollments = { data: null, error: null };
        const e = await verificarHorasAdicionales(ESCUELA, lote([linea()])).catch((x) => x);
        expect(e).toBeInstanceOf(CobrosError);
        expect(e).toMatchObject({ status: 404, code: 'HORAS_INSCRIPCION_AJENA' });
    });
    it('escuela sin banco de horas → 409', async () => {
        h.tablas.school_settings = { data: { hours_plan_enabled: false }, error: null };
        await expect(verificarHorasAdicionales(ESCUELA, lote([linea()]))).rejects.toMatchObject({ status: 409, code: 'SIN_BANCO_DE_HORAS' });
    });
    it('plan sin horas configuradas → 409 con la salida «Otro cobro» (caso PGP4x1)', async () => {
        h.tablas.offering_plans = { data: { included_minutes_per_period: null }, error: null };
        const e = await verificarHorasAdicionales(ESCUELA, lote([linea()])).catch((x) => x);
        expect(e).toMatchObject({ status: 409, code: 'PLAN_SIN_HORAS' });
        expect(e.message).toContain('Otro cobro');
    });
    it('inscripción sin plan → plan sin horas', async () => {
        h.tablas.enrollments = { data: { id: INSC, offering_plan_id: null, status: 'active' }, error: null };
        await expect(verificarHorasAdicionales(ESCUELA, lote([linea()]))).rejects.toMatchObject({ code: 'PLAN_SIN_HORAS' });
    });
    it('migración sin aplicar (la tabla no existe) → 503 y NO se cobra', async () => {
        h.tablas.hour_bank_grants = { data: null, error: { message: 'relation "hour_bank_grants" does not exist' } };
        await expect(verificarHorasAdicionales(ESCUELA, lote([linea()]))).rejects.toMatchObject({ status: 503, code: 'MIGRACION_PENDIENTE' });
    });
});

describe('sumarHorasAdicionales (después del lote)', () => {
    const l = linea();
    const suma = (batch: string | null = LOTE, atleta: any = ATLETA) => sumarHorasAdicionales(ESCUELA, ACTOR, batch, l, atleta);

    it('encuentra el pago con el concepto REAL (con « — atleta») y suma 120 min con el pago como llave', async () => {
        const r = await suma();
        expect(r).toMatchObject({ ok: true, minutes: 120, hours: 2, period_id: 'per1', available_minutes: 840, payment_id: PAGO });
        expect(h.rpc).toHaveBeenCalledTimes(1);
        expect(h.rpc).toHaveBeenCalledWith('grant_hour_bank_minutes', expect.objectContaining({
            p_enrollment_id: INSC, p_minutes: 120, p_actor: ACTOR, p_payment_id: PAGO, p_on: todayInZone(),
            p_reason: 'Horas adicionales compradas (2 h)',
        }));
    });
    it('un concepto SIN el sufijo (forma vieja o manual) también se encuentra', async () => {
        h.tablas.payments = { data: [pagoReal({ concept: 'Horas adicionales · 2 h' })], error: null };
        expect((await suma()).ok).toBe(true);
    });
    it('no toma el pago de OTRO atleta ni de otro lote ni de otra categoría ni otra cantidad de horas', async () => {
        h.tablas.payments = { data: [
            pagoReal({ id: 'x1', child_id: OTRA_NINA }),
            pagoReal({ id: 'x2', charge_batch_id: 'otro-lote' }),
            pagoReal({ id: 'x3', payment_category: 'torneo' }),
            pagoReal({ id: 'x4', concept: 'Horas adicionales · 3 h — Ana Pérez' }),
        ], error: null };
        expect(await suma()).toMatchObject({ ok: false, reason: 'sin_cobro' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('el cobro quedó pendiente → NO suma y dice cómo reintentar', async () => {
        h.tablas.payments = { data: [pagoReal({ status: 'pending' })], error: null };
        const r = await suma();
        expect(r).toMatchObject({ ok: false, reason: 'sin_pago', payment_id: PAGO });
        expect(r.message).toContain('Reintentar');
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('la línea no se creó («No cobrar» o venta idéntica del día) → no suma', async () => {
        h.tablas.payments = { data: [], error: null };
        expect(await suma()).toMatchObject({ ok: false, reason: 'sin_cobro' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('dos cobros candidatos → no adivina', async () => {
        h.tablas.payments = { data: [pagoReal(), pagoReal({ id: 'otro' })], error: null };
        expect(await suma()).toMatchObject({ ok: false, reason: 'error' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('sin lote o sin atleta no hace nada', async () => {
        expect(await suma(null)).toMatchObject({ ok: false, reason: 'error' });
        expect(await sumarHorasAdicionales(ESCUELA, ACTOR, LOTE, l, undefined)).toMatchObject({ ok: false, reason: 'error' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('la RPC falla → nunca lanza; dice que el cobro quedó y las horas no', async () => {
        h.rpc.mockResolvedValue({ data: null, error: { message: 'SIN_BANCO_DE_HORAS: el plan no tiene horas' } });
        const r = await suma();
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('error');
        expect(r.message).toContain('El cobro quedó registrado');
    });
    it('reintento sobre un pago ya acreditado → duplicated, sin sumar otra vez', async () => {
        h.rpc.mockResolvedValue({ data: { granted: false, duplicated: true, minutes: 120, period_id: 'per1' }, error: null });
        expect(await suma()).toMatchObject({ ok: true, duplicated: true, minutes: 120 });
    });
    it('1,5 h → 90 minutos y concepto con coma', async () => {
        h.tablas.payments = { data: [pagoReal({ concept: 'Horas adicionales · 1,5 h — Ana Pérez' })], error: null };
        await sumarHorasAdicionales(ESCUELA, ACTOR, LOTE, linea({ extra_hours: 1.5 }), ATLETA);
        expect(h.rpc).toHaveBeenCalledWith('grant_hour_bank_minutes', expect.objectContaining({
            p_minutes: 90, p_reason: 'Horas adicionales compradas (1,5 h)',
        }));
    });
});

describe('reintentarSumaDeHoras', () => {
    it('lote de otra escuela → 404 y no suma', async () => {
        h.tablas.charge_batches = { data: null, error: null };
        await expect(reintentarSumaDeHoras(ESCUELA, ACTOR, LOTE, ATLETA, INSC, 2)).rejects.toMatchObject({ status: 404, code: 'LOTE_NO_ENCONTRADO' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('inscripción que no es del atleta → 404 y no suma', async () => {
        h.tablas.enrollments = { data: null, error: null };
        await expect(reintentarSumaDeHoras(ESCUELA, ACTOR, LOTE, ATLETA, INSC, 2)).rejects.toMatchObject({ code: 'HORAS_INSCRIPCION_AJENA' });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('todo en orden: suma (idempotente por pago)', async () => {
        expect(await reintentarSumaDeHoras(ESCUELA, ACTOR, LOTE, ATLETA, INSC, 2)).toMatchObject({ ok: true, minutes: 120 });
    });
});

describe('revertirHorasDeLote (al anular)', () => {
    it('revierte cada suma de los cobros anulados', async () => {
        h.tablas.hour_bank_grants = { data: [{ school_id: ESCUELA, payment_id: PAGO, minutes: 120, reverted_at: null }], error: null };
        h.rpc.mockResolvedValue({ data: { reverted: true, minutes: 120 }, error: null });
        const r = await revertirHorasDeLote(ESCUELA, ACTOR, [PAGO, 'otro-pago'], 'Cobro anulado: error de digitación');
        expect(r).toEqual({ reverted: 1, minutes: 120, errors: [] });
        expect(h.rpc).toHaveBeenCalledTimes(1);
        expect(h.rpc).toHaveBeenCalledWith('revoke_hour_bank_grant', { p_payment_id: PAGO, p_actor: ACTOR, p_reason: 'Cobro anulado: error de digitación' });
    });
    it('no toca las sumas ya revertidas ni las de otra escuela', async () => {
        h.tablas.hour_bank_grants = { data: [
            { school_id: ESCUELA, payment_id: PAGO, minutes: 120, reverted_at: '2026-10-21T10:00:00Z' },
            { school_id: 'otra', payment_id: 'p2', minutes: 60, reverted_at: null },
        ], error: null };
        expect(await revertirHorasDeLote(ESCUELA, ACTOR, [PAGO, 'p2'], 'x')).toEqual({ reverted: 0, minutes: 0, errors: [] });
        expect(h.rpc).not.toHaveBeenCalled();
    });
    it('sin pagos anulados no consulta; sin la tabla (migración pendiente) no falla', async () => {
        expect(await revertirHorasDeLote(ESCUELA, ACTOR, [], 'x')).toEqual({ reverted: 0, minutes: 0, errors: [] });
        h.tablas.hour_bank_grants = { data: null, error: { message: 'relation does not exist' } };
        expect(await revertirHorasDeLote(ESCUELA, ACTOR, [PAGO], 'x')).toEqual({ reverted: 0, minutes: 0, errors: [] });
    });
    it('un error de la RPC no lanza: lo devuelve', async () => {
        h.tablas.hour_bank_grants = { data: [{ school_id: ESCUELA, payment_id: PAGO, minutes: 120, reverted_at: null }], error: null };
        h.rpc.mockResolvedValue({ data: null, error: { message: 'FORBIDDEN' } });
        const r = await revertirHorasDeLote(ESCUELA, ACTOR, [PAGO], 'x');
        expect(r.reverted).toBe(0);
        expect(r.errors).toEqual(['FORBIDDEN']);
    });
});

describe('lo que ve la RPC del lote (el preview_hash depende de esto)', () => {
    const cuerpo = () => ({
        mode: 'single', target: { kind: 'athlete', ids: [NINA] }, athletes: [ATLETA],
        lines: [linea({ pay_amount: 30625, concept: 'lo que escribió la pantalla' })], pending: [],
        payment: { method: 'cash', payment_date: todayInZone() },
    }) as any;

    it('la venta de horas llega a la RPC como «Clase extra» con el concepto fijo y sin extra_hours', () => {
        const [l] = argsPreview(ESCUELA, ACTOR, cuerpo()).p_lines as Record<string, unknown>[];
        expect(l.category).toBe('clase_extra');
        expect(l.concept).toBe('Horas adicionales · 2 h');
        expect(l).not.toHaveProperty('extra_hours');
        expect(l.enrollment_id).toBe(INSC);
        expect(l.amount).toBe(30625);
        expect(l.pay_amount).toBe(30625);
    });
    it('vista previa y creación arman la MISMA línea (si no, el hash no coincide)', () => {
        const b = { ...cuerpo(), client_request_id: 'x', preview_hash: 'h', overrides: [], notify_families: false };
        expect(argsCreate(ESCUELA, ACTOR, b).p_lines).toEqual(argsPreview(ESCUELA, ACTOR, b).p_lines);
    });
    it('un excedente del período sigue igual: categoría excedente y su overage_charge_id', () => {
        const b = cuerpo();
        b.lines = [{ category: 'excedente', overage_charge_id: 'ov1', amount: 50000, due_date: todayInZone(), concept: 'Horas adicionales sept', pay_amount: 0 }];
        const [l] = argsPreview(ESCUELA, ACTOR, b).p_lines as Record<string, unknown>[];
        expect(l.category).toBe('excedente');
        expect(l.overage_charge_id).toBe('ov1');
        expect(l.concept).toBe('Horas adicionales sept');
    });
});
