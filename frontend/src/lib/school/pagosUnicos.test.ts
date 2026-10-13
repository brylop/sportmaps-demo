import { describe, expect, it } from 'vitest';
import {
    bloquearNombreDePlan,
    esNombreDePagoUnico,
    esTarifaMensualActiva,
    montoPagoUnico,
    resumenPagosUnicos,
} from './pagosUnicos';

describe('pagos únicos: guard de nombre', () => {
    it('detecta inscripción, matrícula, seguro y póliza con y sin tilde', () => {
        for (const n of ['Inscripción', 'inscripcion', 'Matrícula 2026', 'MATRICULA', 'Seguro', 'Póliza anual', 'poliza']) {
            expect(esNombreDePagoUnico(n)).toBe(true);
        }
        expect(esNombreDePagoUnico('Mensual 3 días')).toBe(false);
        expect(esNombreDePagoUnico('')).toBe(false);
    });

    it('bloquea al crear y al renombrar, no al guardar un plan viejo sin cambiarle el nombre', () => {
        expect(bloquearNombreDePlan('Inscripción', null)).toBe(true);
        expect(bloquearNombreDePlan('Seguro', 'Seguro')).toBe(false);
        expect(bloquearNombreDePlan('Seguro ', 'seguro')).toBe(false);
        expect(bloquearNombreDePlan('Seguro', 'Mensual')).toBe(true);
        expect(bloquearNombreDePlan('Mensual', 'Seguro')).toBe(false);
    });
});

describe('pagos únicos: valores', () => {
    it("'' y 0 se guardan como null (no se cobra)", () => {
        expect(montoPagoUnico('')).toBeNull();
        expect(montoPagoUnico('0')).toBeNull();
        expect(montoPagoUnico(undefined)).toBeNull();
        expect(montoPagoUnico('120000')).toBe(120000);
    });

    it('resumen para la tarjeta', () => {
        expect(resumenPagosUnicos({ registration_fee: 120000, insurance_fee: 150000 }))
            .toBe('+ $120.000 inscripción · + $150.000 seguro (único)');
        expect(resumenPagosUnicos({ registration_fee: 120000, insurance_fee: null }))
            .toBe('+ $120.000 inscripción (único)');
        expect(resumenPagosUnicos({ registration_fee: 0, insurance_fee: null })).toBe('');
    });

    it('tarifa mensual activa', () => {
        expect(esTarifaMensualActiva({ is_active: true, duration_days: 30 })).toBe(true);
        expect(esTarifaMensualActiva({ is_active: false, duration_days: 30 })).toBe(false);
        expect(esTarifaMensualActiva({ is_active: true, duration_days: 90 })).toBe(false);
    });
});
