/**
 * Lógica pura de la pantalla de mesociclos (src/lib/school/mesocyclePlanning.ts).
 *
 * Origen: Club Carmel 2026-10-02. (1) Un equipo con el mesociclo de septiembre
 * no podía crear el de octubre (solo se mostraba el último y no había
 * "Nuevo"). (2) El entrenador de arqueros no encontraba cómo cargar el
 * domingo: las semanas sin días no ofrecían nada, y su sesión del sábado,
 * creada antes del mesociclo, quedó guardada pero invisible.
 */

import { describe, it, expect } from 'vitest';
import {
    addDaysISO,
    datesBetween,
    pickDefaultMesocycle,
    suggestNextStart,
    suggestEnd,
    placeLooseSessions,
} from '../lib/school/mesocyclePlanning';

const sep = { id: 'sep', starts_on: '2026-09-05', ends_on: '2026-09-27' };
const oct = { id: 'oct', starts_on: '2026-10-03', ends_on: '2026-10-31' };

describe('addDaysISO / datesBetween', () => {
    it('cruza fin de mes y de año', () => {
        expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01');
        expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDaysISO('2026-10-03', -1)).toBe('2026-10-02');
    });

    it('la semana 1 de arqueros (sáb 3 a sáb 10) tiene 8 días e incluye el domingo 4', () => {
        const d = datesBetween('2026-10-03', '2026-10-10');
        expect(d).toHaveLength(8);
        expect(d[1]).toBe('2026-10-04');
    });

    it('un rango invertido da vacío y uno corrupto se topa', () => {
        expect(datesBetween('2026-10-10', '2026-10-03')).toEqual([]);
        expect(datesBetween('2026-01-01', '2026-12-31')).toHaveLength(31);
    });
});

describe('pickDefaultMesocycle', () => {
    it('abre el que contiene hoy', () => {
        expect(pickDefaultMesocycle([sep, oct], '2026-10-15')?.id).toBe('oct');
    });

    it('entre meses abre el PRÓXIMO, no el que ya terminó (2 de oct → octubre)', () => {
        expect(pickDefaultMesocycle([sep, oct], '2026-10-02')?.id).toBe('oct');
    });

    it('sin próximo, el último que terminó', () => {
        expect(pickDefaultMesocycle([sep], '2026-10-02')?.id).toBe('sep');
    });

    it('lista vacía → null', () => {
        expect(pickDefaultMesocycle([], '2026-10-02')).toBeNull();
    });
});

describe('suggestNextStart / suggestEnd', () => {
    it('el siguiente arranca el día después del último que termina', () => {
        expect(suggestNextStart([sep], '2026-09-20')).toBe('2026-09-28');
    });

    it('nunca sugiere una fecha pasada', () => {
        expect(suggestNextStart([sep], '2026-10-02')).toBe('2026-10-02');
    });

    it('sin mesociclos previos, hoy', () => {
        expect(suggestNextStart([], '2026-10-02')).toBe('2026-10-02');
    });

    it('fin sugerido = 4 semanas', () => {
        expect(suggestEnd('2026-10-03')).toBe('2026-10-30');
    });
});

describe('placeLooseSessions', () => {
    const weeks = [
        { id: 'w1', starts_on: '2026-10-03', ends_on: '2026-10-10' },
        { id: 'w2', starts_on: '2026-10-11', ends_on: '2026-10-17' },
    ];

    it('la sesión suelta del sábado de arqueros cae en su fecha, la enganchada no se toca', () => {
        const { byDate, outside } = placeLooseSessions([
            { id: 'sab', session_date: '2026-10-03', microcycle_day_id: null },
            { id: 'ya', session_date: '2026-10-04', microcycle_day_id: 'd1' },
        ], weeks);
        expect(byDate.get('2026-10-03')?.map((s) => s.id)).toEqual(['sab']);
        expect(byDate.has('2026-10-04')).toBe(false);
        expect(outside).toEqual([]);
    });

    it('dos sueltas el mismo día quedan juntas; una fuera del mesociclo va aparte', () => {
        const { byDate, outside } = placeLooseSessions([
            { id: 'a', session_date: '2026-10-04' },
            { id: 'b', session_date: '2026-10-04' },
            { id: 'vieja', session_date: '2026-09-19' },
        ], weeks);
        expect(byDate.get('2026-10-04')).toHaveLength(2);
        expect(outside.map((s) => s.id)).toEqual(['vieja']);
    });
});
