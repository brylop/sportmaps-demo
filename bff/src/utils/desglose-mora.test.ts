/**
 * Desglose de mora (2026-10-14): apply_late_fees suma el recargo DENTRO de
 * payments.amount; aquí solo se explica, nunca se suma otra vez.
 */
import { describe, expect, it } from 'vitest';
import { desgloseMora, fmtPesos, montoConMora, recargoMora, textoDesgloseMora } from './desglose-mora';

describe('desgloseMora', () => {
    it('sin mora (0, null, negativo, texto vacío) → null', () => {
        expect(desgloseMora(150000, 0)).toBeNull();
        expect(desgloseMora(150000, null)).toBeNull();
        expect(desgloseMora(150000, undefined)).toBeNull();
        expect(desgloseMora(150000, -5)).toBeNull();
        expect(desgloseMora(150000, '')).toBeNull();
    });

    it('con mora: la mensualidad es total - recargo (el total ya la incluye)', () => {
        expect(desgloseMora(165000, 15000)).toEqual({ mensualidad: 150000, recargo: 15000, total: 165000 });
        expect(desgloseMora(165000, '15000')).toEqual({ mensualidad: 150000, recargo: 15000, total: 165000 });
    });

    it('el recargo se recorta al total (un abono ya cubrió la mensualidad)', () => {
        expect(desgloseMora(10000, 15000)).toEqual({ mensualidad: 0, recargo: 10000, total: 10000 });
        expect(desgloseMora(0, 15000)).toBeNull();
    });

    it('recargoMora normaliza la columna', () => {
        expect(recargoMora('15000.00')).toBe(15000);
        expect(recargoMora(null)).toBe(0);
        expect(recargoMora('abc')).toBe(0);
    });
});

describe('textos', () => {
    it('línea del desglose', () => {
        expect(textoDesgloseMora({ mensualidad: 150000, recargo: 15000, total: 165000 }))
            .toBe('Mensualidad $150.000 · Recargo por mora $15.000 · Total $165.000');
    });

    it('variable de la plantilla de WhatsApp: igual que antes sin mora; con mora, lo dice', () => {
        expect(montoConMora(150000, 0)).toBe('$150.000');
        expect(montoConMora(165000, 15000)).toBe('$165.000, que incluye $15.000 de recargo por mora');
        // Sin paréntesis ni saltos de línea: pendiente_directo ya la pone entre paréntesis y Meta rechaza \n.
        expect(montoConMora(165000, 15000)).not.toMatch(/[()\n]/);
    });

    it('acepta el formateador del llamador', () => {
        const fmt = (n: number) => `COP ${n}`;
        expect(montoConMora(165000, 15000, fmt)).toBe('COP 165000, que incluye COP 15000 de recargo por mora');
        expect(fmtPesos(1234567.4)).toBe('$1.234.567');
    });
});
