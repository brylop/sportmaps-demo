import { describe, expect, it } from 'vitest';
import {
    decidirComprobante, esLineaDeHoras, horasAPagarDeLineas, horasPorSeparar, mensajeDeComprobante, separarLineas,
} from './separarHoras';

const base = { metodo: 'transfer' as const, tieneComprobante: true, montoLeido: 451_500, totalAPagar: 451_500, horasAPagar: 64_500 };

describe('decidirComprobante', () => {
    it('el comprobante cubre el total: ok (las horas van en la misma operación)', () => {
        expect(decidirComprobante(base)).toEqual({ tipo: 'ok' });
    });
    it('comprobante de más: ok (no deja horas sin pagar)', () => {
        expect(decidirComprobante({ ...base, montoLeido: 500_000 })).toEqual({ tipo: 'ok' });
    });
    it('igual al total SIN las horas: bloquea y propone separar', () => {
        expect(decidirComprobante({ ...base, montoLeido: 387_000 })).toEqual({
            tipo: 'bloquear', motivo: 'coincide_sin_horas', comprobante: 387_000, total: 451_500, horas: 64_500, principal: 387_000, puedeSeparar: true,
        });
    });
    it('menor por cualquier otra cantidad: bloquea (menor_al_total) y también ofrece separar', () => {
        expect(decidirComprobante({ ...base, montoLeido: 400_000 })).toMatchObject({ tipo: 'bloquear', motivo: 'menor_al_total', puedeSeparar: true });
    });
    it('un peso de menos ya bloquea (tolerancia 0)', () => {
        expect(decidirComprobante({ ...base, montoLeido: 451_499 }).tipo).toBe('bloquear');
    });
    it('solo horas (nada principal): bloquea pero no se puede separar', () => {
        expect(decidirComprobante({ ...base, totalAPagar: 64_500, montoLeido: 30_000 })).toMatchObject({ tipo: 'bloquear', puedeSeparar: false, principal: 0 });
    });
    it('efectivo, sin comprobante, sin lectura del OCR o sin horas: no aplica', () => {
        expect(decidirComprobante({ ...base, metodo: 'cash', montoLeido: 1 }).tipo).toBe('ok');
        expect(decidirComprobante({ ...base, tieneComprobante: false, montoLeido: 1 }).tipo).toBe('ok');
        expect(decidirComprobante({ ...base, montoLeido: null }).tipo).toBe('ok');
        expect(decidirComprobante({ ...base, montoLeido: 0 }).tipo).toBe('ok');
        expect(decidirComprobante({ ...base, horasAPagar: 0, montoLeido: 10 }).tipo).toBe('ok');
    });
});

describe('líneas', () => {
    const lineas = [{ id: 'm', extra_hours: null }, { id: 'h', extra_hours: 2 }, { id: 'o' }];
    it('reconoce la línea de horas por adelantado', () => {
        expect(lineas.map(esLineaDeHoras)).toEqual([false, true, false]);
    });
    it('«Ya las usó» no es una venta de horas: no se bloquea ni se separa aunque lleve horas', () => {
        expect(esLineaDeHoras({ extra_hours: 1, horas_modo: 'usadas' })).toBe(false);
        expect(esLineaDeHoras({ extra_hours: 1, horas_modo: 'adelantado' })).toBe(true);
        expect(separarLineas([{ extra_hours: 1, horas_modo: 'usadas' as const }]).horas).toHaveLength(0);
    });
    it('suma solo lo pagado de las líneas de horas, alineado por posición', () => {
        expect(horasAPagarDeLineas(lineas, [387_000, 64_500, 0])).toBe(64_500);
    });
    it('separa: lo principal se queda, las horas se van', () => {
        const { principal, horas } = separarLineas(lineas);
        expect(principal.map((l) => l.id)).toEqual(['m', 'o']);
        expect(horas.map((l) => l.id)).toEqual(['h']);
    });
    it('anota las horas y el monto de la segunda operación', () => {
        expect(horasPorSeparar([{ extra_hours: 1.5 }, { extra_hours: 0.5 }], 64_500.4)).toMatchObject({ horas: 2, monto: 64_500 });
    });
});

describe('mensajeDeComprobante', () => {
    it('ok no dice nada', () => expect(mensajeDeComprobante({ tipo: 'ok' })).toBeNull());
    it('coincide sin horas lo explica con los montos', () => {
        const m = mensajeDeComprobante(decidirComprobante({ ...base, montoLeido: 387_000 }))!;
        expect(m).toContain('387.000');
        expect(m).toContain('64.500');
        expect(m).toContain('Sepáralas');
    });
    it('sin nada que separar no ofrece separar', () => {
        const m = mensajeDeComprobante(decidirComprobante({ ...base, totalAPagar: 64_500, montoLeido: 30_000 }))!;
        expect(m).not.toContain('Sepáralas');
        expect(m).toContain('Corrige');
    });
});
