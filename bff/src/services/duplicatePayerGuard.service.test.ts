/**
 * duplicatePayerGuard y los cobros ÚNICOS (2026-10-10).
 *
 * Los cobros del alta (inscripción, seguro) nacen con period_year/period_month
 * del mes, igual que la mensualidad. El guard los confundía con «ese período»:
 *   · un seguro PAGADO sacaba de avisos/estado de cuenta la mensualidad
 *     pendiente del mismo mes;
 *   · la mensualidad pagada sacaba al seguro/inscripción pendientes (rama
 *     «certeza», que no miraba si el candidato era de una sola vez).
 *
 * Cero red: Supabase en memoria. Datos inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ tablas: {} as Record<string, Record<string, any>[]> }));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        const b: any = {
            select: () => b,
            eq: (col: string, v: any) => { filas = filas.filter((f) => f[col] === v); return b; },
            in: (col: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[col])); return b; },
            then: (ok: any, ko: any) => Promise.resolve({ data: filas, error: null }).then(ok, ko),
        };
        return b;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

import { esUnicaVez, findDuplicatePaymentIds } from './duplicatePayerGuard.service';

const ESCUELA = 'sch-1';
const base = {
    school_id: ESCUELA, child_id: 'c1', unregistered_athlete_id: null, user_id: null, parent_id: null,
    amount: 100000, due_date: '2026-10-10', period_year: 2026, period_month: 10,
};

beforeEach(() => {
    estado.tablas = { children: [{ id: 'c1', full_name: 'Niña De Prueba Uno' }], unregistered_athletes: [], payments: [] };
});

describe('esUnicaVez', () => {
    it('por categoría explícita o por concepto (seguro incluido)', () => {
        expect(esUnicaVez('Cualquier cosa', 'seguro')).toBe(true);
        expect(esUnicaVez('Cualquier cosa', 'clase_extra')).toBe(true);
        expect(esUnicaVez('Seguro de accidentes — Plan X', null)).toBe(true);
        expect(esUnicaVez('Mensualidad Octubre', null)).toBe(false);
        expect(esUnicaVez('Mensualidad Octubre', 'mensualidad')).toBe(false);
    });
});

describe('findDuplicatePaymentIds con cobros únicos', () => {
    it('un seguro pagado NO oculta la mensualidad pendiente del mismo mes', async () => {
        estado.tablas.payments = [
            { ...base, id: 'seg', status: 'paid', concept: 'Seguro de accidentes', payment_category: 'seguro' },
        ];
        const ids = await findDuplicatePaymentIds(ESCUELA, [
            { ...base, id: 'mens', concept: 'Mensualidad Octubre 2026', payment_category: null },
        ]);
        expect(ids.has('mens')).toBe(false);
    });

    it('la mensualidad pagada NO oculta la inscripción ni el seguro pendientes del mismo mes', async () => {
        estado.tablas.payments = [
            { ...base, id: 'mens', status: 'paid', concept: 'Mensualidad Octubre 2026', payment_category: 'mensualidad' },
        ];
        const ids = await findDuplicatePaymentIds(ESCUELA, [
            { ...base, id: 'insc', concept: 'Inscripción — Plan X', payment_category: 'inscripcion' },
            { ...base, id: 'seg', concept: 'Seguro de accidentes — Plan X', payment_category: 'seguro' },
            // Categoría solo deducible del concepto (llamadores que no la leen).
            { ...base, id: 'seg2', concept: 'Seguro de accidentes — Plan X' },
        ]);
        expect([...ids]).toEqual([]);
    });

    it('sigue excluyendo la mensualidad ya pagada del mismo sujeto y período', async () => {
        estado.tablas.payments = [
            { ...base, id: 'pagada', status: 'paid', concept: 'Mensualidad Octubre 2026', payment_category: null },
        ];
        const ids = await findDuplicatePaymentIds(ESCUELA, [
            { ...base, id: 'dup', concept: 'Mensualidad Octubre 2026', payment_category: null },
        ]);
        expect(ids.has('dup')).toBe(true);
    });
});
