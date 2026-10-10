import { describe, expect, it } from 'vitest';
import {
    MANUAL_CHARGE_CATEGORY_OPTIONS,
    canReuseOnPeriodConflict,
    effectiveManualCategory,
    manualChargeInsertFields,
    manualChargeIsPeriodic,
} from './manualPaymentCharge';

const PLAN = '00000000-0000-4000-8000-000000000001';

describe('effectiveManualCategory', () => {
    it('la elegida por la escuela manda sobre el concepto', () => {
        expect(effectiveManualCategory('seguro', 'Mensualidad octubre')).toBe('seguro');
    });

    it('sin elección, se deduce del concepto', () => {
        expect(effectiveManualCategory(null, 'Mensualidad')).toBe('mensualidad');
        expect(effectiveManualCategory(null, 'Inscripción — Plan A')).toBe('inscripcion');
        expect(effectiveManualCategory(null, 'Matrícula 2026')).toBe('inscripcion');
        expect(effectiveManualCategory(null, 'Seguro de accidentes — Plan A')).toBe('seguro');
        expect(effectiveManualCategory(null, 'Uniforme de competencia')).toBe('articulos');
    });

    it('concepto irreconocible = sin categoría (comportamiento anterior)', () => {
        expect(effectiveManualCategory(null, 'Cuota')).toBeNull();
        expect(effectiveManualCategory(undefined, '')).toBeNull();
    });
});

describe('manualChargeInsertFields', () => {
    it('mensualidad: con plan (extiende vigencia) y sujeta al índice de período', () => {
        expect(manualChargeInsertFields('mensualidad', PLAN)).toEqual({
            payment_category: 'mensualidad',
            period_uniqueness_exempt: false,
            offering_plan_id: PLAN,
        });
    });

    it.each(['inscripcion', 'seguro', 'articulos', 'torneo', 'excedente', 'otro'] as const)(
        '%s: cobro único — exento del período y sin plan (no extiende vigencia)',
        (cat) => {
            expect(manualChargeInsertFields(cat, PLAN)).toEqual({
                payment_category: cat,
                period_uniqueness_exempt: true,
                offering_plan_id: null,
            });
        },
    );

    it('sin categoría: igual que antes (plan del deportista, no exento)', () => {
        expect(manualChargeInsertFields(null, PLAN)).toEqual({
            payment_category: null,
            period_uniqueness_exempt: false,
            offering_plan_id: PLAN,
        });
        expect(manualChargeInsertFields(null, undefined).offering_plan_id).toBeNull();
    });
});

describe('manualChargeIsPeriodic', () => {
    it('solo la mensualidad pide «Mes que cubre»', () => {
        expect(manualChargeIsPeriodic('mensualidad')).toBe(true);
        expect(manualChargeIsPeriodic('inscripcion')).toBe(false);
        expect(manualChargeIsPeriodic('seguro')).toBe(false);
        expect(manualChargeIsPeriodic(null)).toBe(false);
    });
});

describe('canReuseOnPeriodConflict', () => {
    const periodErr = { code: '23505', message: 'duplicate key value violates unique constraint "uniq_payment_active_period_per_child"' };

    it('reutiliza solo si el choque es del índice de período y hay período elegido', () => {
        expect(canReuseOnPeriodConflict(periodErr, true)).toBe(true);
    });

    it('sin período NO reutiliza: no se sabe cuál es "el mismo" cobro', () => {
        expect(canReuseOnPeriodConflict(periodErr, false)).toBe(false);
    });

    it('otro 23505 (comprobante duplicado) no es un choque de período', () => {
        expect(canReuseOnPeriodConflict(
            { code: '23505', message: 'duplicate key value violates unique constraint "uq_payments_school_receipt_hash"' },
            true,
        )).toBe(false);
        expect(canReuseOnPeriodConflict({ code: '42501', message: 'x' }, true)).toBe(false);
        expect(canReuseOnPeriodConflict(null, true)).toBe(false);
    });
});

describe('MANUAL_CHARGE_CATEGORY_OPTIONS', () => {
    it('ofrece mensualidad, inscripción y seguro, sin repetir', () => {
        const values = MANUAL_CHARGE_CATEGORY_OPTIONS.map((o) => o.value);
        expect(values).toEqual(expect.arrayContaining(['mensualidad', 'inscripcion', 'seguro']));
        expect(new Set(values).size).toBe(values.length);
    });
});
