import { describe, expect, it } from 'vitest';
import {
    avisoCambioAplicado, avisoPorDecidir, clavePlanChange, esperadoDe, evaluarPago, periodoAnterior,
    type InscripcionLite, type PagoLite, type PlanLite,
} from './plan-change-detector';

const PRO: PlanLite = { id: 'pro', name: 'PLAN PRO', price: 150000, is_active: true };
const ELITE: PlanLite = { id: 'elite', name: 'PLAN ELITE ', price: 180000, is_active: true };
const START: PlanLite = { id: 'start', name: 'PLAN START ', price: 90000, is_active: true };
const BASIC: PlanLite = { id: 'basic', name: 'PLAN BASIC SENIORS', price: 90000, is_active: true };
const VIEJO: PlanLite = { id: 'viejo', name: 'PLAN VIEJO', price: 150000, is_active: false };
const PLANES = [PRO, ELITE, START, BASIC, VIEJO];

const insc = (over: Partial<InscripcionLite> = {}): InscripcionLite => ({
    id: 'e1', offering_plan_id: 'elite', monthly_fee: 180000, fee_is_manual: false, ...over,
});
const pago = (over: Partial<PagoLite> = {}): PagoLite => ({ id: 'p-oct', amount: 150000, period_year: 2026, period_month: 10, ...over });
const sep150: PagoLite = { id: 'p-sep', amount: 150000, period_year: 2026, period_month: 9 };

describe('evaluarPago', () => {
    it('paga exactamente lo esperado → nada', () => {
        expect(evaluarPago(pago({ amount: 180000 }), [insc()], PLANES, [])).toEqual({ tipo: 'ok' });
    });

    it('paga el precio de lista de su plan aunque tenga valor pactado distinto → nada (no es cambio de plan)', () => {
        expect(evaluarPago(pago({ amount: 180000 }), [insc({ monthly_fee: 100000 })], PLANES, [])).toEqual({ tipo: 'ok' });
    });

    it('sin monthly_fee el esperado es el precio del plan', () => {
        expect(esperadoDe(insc({ monthly_fee: null }), ELITE)).toBe(180000);
        expect(evaluarPago(pago({ amount: 180000 }), [insc({ monthly_fee: null })], PLANES, [])).toEqual({ tipo: 'ok' });
    });

    it('sin inscripción activa con plan, o pago en 0 → nada', () => {
        expect(evaluarPago(pago(), [], PLANES, [])).toEqual({ tipo: 'ok' });
        expect(evaluarPago(pago({ amount: 0 }), [insc()], PLANES, [])).toEqual({ tipo: 'ok' });
    });

    it('único plan + el periodo anterior pagó lo mismo → CAMBIA', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, [sep150]);
        expect(d).toMatchObject({ tipo: 'cambiar', planViejo: ELITE, planNuevo: PRO, monto: 150000, periodos: ['2026-09', '2026-10'] });
    });

    it('no considera planes inactivos como destino (el único candidato activo es Pro, no «Plan viejo»)', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, [sep150]);
        expect(d.tipo === 'cambiar' && d.planNuevo.id).toBe('pro');
    });

    it('primera vez (el periodo anterior no lo confirma) → solo avisa', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, []);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'primera_vez' });
        const otroMonto = evaluarPago(pago(), [insc()], PLANES, [{ ...sep150, amount: 180000 }]);
        expect(otroMonto).toMatchObject({ tipo: 'avisar', motivo: 'primera_vez' });
    });

    it('el pago confirmante debe ser del periodo inmediatamente anterior, no de hace dos', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, [{ ...sep150, period_month: 8, id: 'p-ago' }]);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'primera_vez' });
    });

    it('enero mira diciembre del año anterior', () => {
        expect(periodoAnterior(2027, 1)).toEqual({ year: 2026, month: 12 });
        const d = evaluarPago(pago({ period_year: 2027, period_month: 1 }), [insc()], PLANES,
            [{ ...sep150, period_year: 2026, period_month: 12 }]);
        expect(d.tipo).toBe('cambiar');
    });

    it('monto ambiguo ($90.000 = Start y Basic Seniors) → avisa, nunca cambia', () => {
        const d = evaluarPago(pago({ amount: 90000 }), [insc()], PLANES, [{ ...sep150, amount: 90000 }]);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'ambiguo' });
        expect(d.tipo === 'avisar' && d.candidatos.map((p) => p.id).sort()).toEqual(['basic', 'start']);
    });

    it('parcial (no coincide con ningún plan) → avisa', () => {
        const d = evaluarPago(pago({ amount: 100000 }), [insc()], PLANES, [{ ...sep150, amount: 100000 }]);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'parcial', candidatos: [] });
    });

    it('valor pactado a mano (fee_is_manual) → nunca cambia solo, aunque haya dos periodos', () => {
        const d = evaluarPago(pago(), [insc({ fee_is_manual: true })], PLANES, [sep150]);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'fee_manual' });
    });

    it('dos inscripciones con plan → no adivina cuál', () => {
        const d = evaluarPago(pago(), [insc(), insc({ id: 'e2', offering_plan_id: 'pro' })], PLANES, [sep150]);
        expect(d).toMatchObject({ tipo: 'avisar', motivo: 'varias_inscripciones' });
    });

    it('idempotencia: tras cambiar, el mismo pago ya es consistente y no vuelve a decidir nada', () => {
        const cambiada = insc({ offering_plan_id: 'pro', monthly_fee: 150000 });
        expect(evaluarPago(pago(), [cambiada], PLANES, [sep150])).toEqual({ tipo: 'ok' });
    });

    it('un pago de un periodo viejo aprobado tarde no manda si ya hay un periodo posterior pagado', () => {
        const viejo = pago({ id: 'p-sep', period_month: 9 });
        const nov: PagoLite = { id: 'p-oct-ok', amount: 180000, period_year: 2026, period_month: 10 };
        expect(evaluarPago(viejo, [insc()], PLANES, [{ ...sep150, id: 'p-ago', period_month: 8 }, nov])).toEqual({ tipo: 'ok' });
    });

    it('el pago evaluado no se confirma a sí mismo', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, [{ ...sep150, id: 'p-oct', period_month: 9 }]);
        expect(d.tipo).toBe('avisar');
    });
});

describe('avisos', () => {
    it('la clave es estable por atleta y periodo', () => {
        expect(clavePlanChange('child_id:abc', 2026, 9)).toBe('plan-change:child_id:abc:2026-09');
    });

    it('el aviso de cambio nombra atleta, planes, monto y periodos', () => {
        const d = evaluarPago(pago(), [insc()], PLANES, [sep150]);
        if (d.tipo !== 'cambiar') throw new Error('debía cambiar');
        const a = avisoCambioAplicado('Ana Pérez', d);
        expect(a.mensaje).toContain('Ana Pérez');
        expect(a.mensaje).toContain('PLAN ELITE');
        expect(a.mensaje).toContain('PLAN PRO');
        expect(a.mensaje).toContain('2026-09 y 2026-10');
        expect(a.mensaje).toMatch(/150\.000/);
    });

    it('cada motivo tiene su aviso y todos dicen que no se cambió o cómo se resolverá', () => {
        const motivos = [
            evaluarPago(pago(), [insc()], PLANES, []),
            evaluarPago(pago({ amount: 90000 }), [insc()], PLANES, []),
            evaluarPago(pago({ amount: 100000 }), [insc()], PLANES, []),
            evaluarPago(pago(), [insc({ fee_is_manual: true })], PLANES, []),
            evaluarPago(pago(), [insc(), insc({ id: 'e2' })], PLANES, []),
        ];
        const titulos = new Set<string>();
        for (const d of motivos) {
            if (d.tipo !== 'avisar') throw new Error('debía avisar');
            const a = avisoPorDecidir('Ana', d, '2026-10');
            titulos.add(a.titulo);
            expect(a.mensaje).toContain('Ana');
            expect(a.mensaje.length).toBeGreaterThan(30);
        }
        expect(titulos.size).toBe(5);
    });
});
