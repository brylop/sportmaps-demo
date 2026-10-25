import { describe, it, expect } from 'vitest';
import { aCsv, armarQuery, razonLegible, rotuloModo, formatoCOP, type CambioPlan } from '@/lib/planChanges';

const cambio = (p: Partial<CambioPlan> = {}): CambioPlan => ({
    id: '1', mode: 'sombra', applied: false, direction: 'down', created_at: '2026-10-05T12:00:00Z', atleta: 'Ana Pérez',
    from_plan: 'Ilimitado', from_amount: 200000, to_plan: '8 clases', to_amount: 150000, clases_mes: 6, amount_paid: 0,
    debt_at_change: 150000, period_year: 2026, period_month: 9, razon: 'Tomó 6 clases en septiembre', ...p,
});

describe('plan-changes', () => {
    it('armarQuery: filtros validos, descarta fechas invalidas y no manda solo_con_deuda al resumen', () => {
        const f = { mode: 'sombra' as const, desde: '2026-09-01', hasta: 'mal', soloConDeuda: true };
        expect(armarQuery(f)).toBe('?mode=sombra&desde=2026-09-01&solo_con_deuda=true&limit=500');
        expect(armarQuery(f, { resumen: true })).toBe('?mode=sombra&desde=2026-09-01');
        expect(armarQuery({ mode: '', desde: '', hasta: '', soloConDeuda: false }, { resumen: true })).toBe('');
    });

    it('CSV: cabecera, comillas y neutraliza formulas', () => {
        const csv = aCsv([cambio({ atleta: '=HYPERLINK("x")', razon: 'dijo "hola", y siguió' })]);
        const [cab, fila] = csv.split('\r\n');
        expect(cab.startsWith('Deportista,Plan actual')).toBe(true);
        expect(fila.startsWith('"\'=HYPERLINK(""x"")",Ilimitado,200000,8 clases,150000,Baja,6,0,150000,septiembre 2026,')).toBe(true);
        expect(fila).toContain('"dijo ""hola"", y siguió"');
        expect(fila.endsWith('2026-10-05,Sombra')).toBe(true);
    });

    it('CSV vacio = solo cabecera', () => {
        expect(aCsv([]).split('\r\n')).toHaveLength(1);
    });

    it('razonLegible: respeta texto del BFF y explica codigos', () => {
        expect(razonLegible('Tomó 6 clases', 'down', 6)).toBe('Tomó 6 clases');
        expect(razonLegible('menos_clases', 'down', 1)).toBe('Tomó 1 clase en el mes: le corresponde un plan más bajo.');
        expect(razonLegible(null, 'up', null)).toContain('más alto');
    });

    it('rotuloModo: sombra, auto y sin datos', () => {
        expect(rotuloModo({ sombra: 4, auto: 0 }, 0).modo).toBe('sombra');
        expect(rotuloModo({ sombra: 4, auto: 1 }, 1).modo).toBe('auto');
        expect(rotuloModo({ sombra: 0, auto: 0 }, 0).modo).toBe('sin_datos');
        expect(rotuloModo(undefined, undefined).modo).toBe('sin_datos');
    });
    it('rotuloModo: el modo configurado de la escuela manda sobre lo deducido', () => {
        expect(rotuloModo({ sombra: 4, auto: 1 }, 1, 'sombra').modo).toBe('sombra');
        expect(rotuloModo({ sombra: 0, auto: 0 }, 0, 'apagado').modo).toBe('apagado');
        expect(rotuloModo({ sombra: 0, auto: 0 }, 0, 'auto').modo).toBe('auto');
        expect(rotuloModo({ sombra: 4, auto: 0 }, 0, null).modo).toBe('sombra');
    });

    it('formatoCOP', () => {
        expect(formatoCOP(null)).toBe('—');
        expect(formatoCOP(150000)).toContain('150.000');
    });
});
