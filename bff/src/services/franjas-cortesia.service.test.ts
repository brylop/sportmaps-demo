/**
 * Generador de franjas de cortesía desde teams.schedule: la parte pura (plan y
 * comparación con lo existente), sin base. Los horarios de prueba son los de
 * Dynasty medidos el 2026-10-06.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import {
    planificarFranjas, compararConExistentes, filaParaInsertar, esSinLimite, normalizarHora,
    CUPOS_SIN_LIMITE, type EquipoParaFranjas, type FranjaExistente,
} from './franjas-cortesia.service';
import { textoCupos, intercalarPorGrupo, type FranjaCortesia } from './whatsapp-clase-cortesia.service';

vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('./avisos-correo.service', () => ({ destinatariosDeEscuela: vi.fn(), enviarConReserva: vi.fn() }));

// Martes 2026-10-06. El lunes 2026-10-12 es festivo (Día de la Raza, trasladado).
const HOY = '2026-10-06';

const SENIORS: EquipoParaFranjas = {
    id: 't-seniors', name: 'SENIORS', active: true, admite_nuevos: true,
    schedule: [
        { day: 1, time: '20:00', end: '22:00', place: 'Coliseo Dynasty DC' },
        { day: 4, time: '20:00', end: '22:00', place: 'Coliseo Dynasty DC' },
    ],
};
const INTERMEDIO: EquipoParaFranjas = {
    id: 't-inter', name: 'INTERMEDIO', active: true, admite_nuevos: true,
    schedule: [
        { day: 2, time: '16:00', end: '18:00', group: 'Evolución', place: 'Cancha externa Nido del Colibrí' },
        { day: 6, time: '07:00', end: '09:00', group: 'Origen', place: 'Coliseo Dynasty DC' },
    ],
};

describe('planificarFranjas', () => {
    it('una franja por sesión semanal durante N semanas (default 3)', () => {
        const p = planificarFranjas([SENIORS], HOY);
        // 3 semanas desde el martes 06: jue 08, lun 12 (festivo), jue 15, lun 19, jue 22, lun 26.
        expect(p.franjas.map((f) => f.slot_date)).toEqual(['2026-10-08', '2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26']);
        expect(p.franjas[0]).toMatchObject({
            team_id: 't-seniors', label: 'SENIORS', start_time: '20:00', end_time: '22:00', location: 'Coliseo Dynasty DC',
        });
        expect(planificarFranjas([SENIORS], HOY, 1).franjas.map((f) => f.slot_date)).toEqual(['2026-10-08']);
    });

    it('day sigue la convención JS: 0 = domingo', () => {
        const dom: EquipoParaFranjas = { id: 't', name: 'X', schedule: [{ day: 0, time: '8:00' }] };
        const p = planificarFranjas([dom], HOY, 1);
        expect(p.franjas).toHaveLength(1);
        expect(p.franjas[0].slot_date).toBe('2026-10-11'); // domingo
        expect(p.franjas[0].start_time).toBe('08:00');
    });

    it('no crea en festivos de Colombia (salvo que se pida) y lo reporta', () => {
        const p = planificarFranjas([SENIORS], HOY);
        expect(p.franjas.some((f) => f.slot_date === '2026-10-12')).toBe(false);
        expect(p.festivosOmitidos).toEqual([{ fecha: '2026-10-12', label: 'SENIORS' }]);
        const con = planificarFranjas([SENIORS], HOY, 3, { incluirFestivos: true });
        expect(con.franjas.some((f) => f.slot_date === '2026-10-12')).toBe(true);
    });

    it('subgrupo en el label', () => {
        const p = planificarFranjas([INTERMEDIO], HOY, 1);
        expect(p.franjas.map((f) => f.label)).toEqual(['INTERMEDIO · Evolución', 'INTERMEDIO · Origen']);
    });

    it('excluye NO USAR, inactivos, cerrados a nuevos y sin horario', () => {
        const p = planificarFranjas([
            { ...SENIORS, id: 'a', name: 'MINIVOLLEY -BENJAMINES (DUPLICADO - NO USAR)' },
            { ...SENIORS, id: 'b', name: 'VIEJO', active: false },
            { ...SENIORS, id: 'c', name: 'JUVENIL MAYORES FEMENINO', admite_nuevos: false },
            { id: 'd', name: 'SIN HORARIO', schedule: null },
            { id: 'e', name: 'BASURA', schedule: '[{"day":9,"time":"x"}]' },
        ], HOY);
        expect(p.franjas).toHaveLength(0);
        expect(p.excluidos.map((e) => e.motivo)).toEqual([
            'marcado NO USAR', 'inactivo', 'no admite nuevos', 'sin horario cargado', 'sin horario cargado',
        ]);
    });

    it('dos subgrupos a la misma hora el mismo día: una sola franja y se reporta el choque', () => {
        const t: EquipoParaFranjas = { id: 't', name: 'MENORES', schedule: [
            { day: 3, time: '17:00', group: 'White' }, { day: 3, time: '17:00', group: 'Selección' },
        ] };
        const p = planificarFranjas([t], HOY, 1);
        expect(p.franjas).toHaveLength(1);
        expect(p.choques).toHaveLength(1);
    });

    it('acepta schedule como string JSON', () => {
        const p = planificarFranjas([{ ...SENIORS, schedule: JSON.stringify(SENIORS.schedule) }], HOY, 1);
        expect(p.franjas).toHaveLength(1);
    });
});

describe('compararConExistentes (idempotencia)', () => {
    const ventana = { desde: HOY, hasta: '2026-10-27' };
    const plan = planificarFranjas([SENIORS], HOY).franjas;
    const existente = (o: Partial<FranjaExistente>): FranjaExistente => ({
        id: 'x', team_id: 't-seniors', slot_date: '2026-10-08', start_time: '20:00:00',
        reserved_count: 0, is_open: true, generated_from_schedule: true, ...o,
    });

    it('correr dos veces no duplica: lo que ya está (con hora HH:MM:SS de la base) no se crea', () => {
        const ya = plan.map((f, i) => existente({ id: `e${i}`, slot_date: f.slot_date, start_time: `${f.start_time}:00` }));
        const r = compararConExistentes(plan, ya, ventana);
        expect(r.crear).toHaveLength(0);
        expect(r.yaExistian).toBe(plan.length);
        expect(r.cerrar).toHaveLength(0);
    });

    it('una cerrada a mano por la escuela no se reabre ni se duplica', () => {
        const r = compararConExistentes(plan, [existente({ is_open: false })], ventana);
        expect(r.crear.some((f) => f.slot_date === '2026-10-08')).toBe(false);
    });

    it('horario cambiado: cierra la generada obsoleta sin reservas; la que tiene reserva se conserva', () => {
        const r = compararConExistentes(plan, [
            existente({ id: 'vieja', slot_date: '2026-10-09', start_time: '19:00:00' }),
            existente({ id: 'reservada', slot_date: '2026-10-10', start_time: '19:00:00', reserved_count: 1 }),
            // Manual (no generada): nunca se toca aunque no esté en el plan.
            existente({ id: 'manual', slot_date: '2026-10-11', generated_from_schedule: false }),
        ], ventana);
        expect(r.cerrar.map((e) => e.id)).toEqual(['vieja']);
        expect(r.conservadasConReserva.map((e) => e.id)).toEqual(['reservada']);
    });
});

describe('sin límite de cupos', () => {
    it('la fila va con CUPOS_SIN_LIMITE, owner como created_by y marcada como generada', () => {
        const f = planificarFranjas([SENIORS], HOY).franjas[0];
        const fila = filaParaInsertar(f, 'school-1', 'owner-1', HOY);
        expect(fila).toMatchObject({ max_capacity: CUPOS_SIN_LIMITE, created_by: 'owner-1', generated_from_schedule: true, is_open: true });
    });

    it('repite la validación de create_school_trial_slot: fecha pasada o label vacío no', () => {
        const f = planificarFranjas([SENIORS], HOY).franjas[0];
        expect(() => filaParaInsertar({ ...f, slot_date: '2026-10-01' }, 's', null, HOY)).toThrow(/futura/);
        expect(() => filaParaInsertar({ ...f, label: '  ' }, 's', null, HOY)).toThrow(/Label/);
    });

    it('el bot no dice «998 cupos»: dice «cupos disponibles»; las manuales siguen con número', () => {
        expect(esSinLimite(CUPOS_SIN_LIMITE - 1)).toBe(true);
        expect(textoCupos(CUPOS_SIN_LIMITE - 1)).toBe('cupos disponibles');
        expect(textoCupos(Math.ceil(CUPOS_SIN_LIMITE / 2))).toBe('cupos disponibles');
        expect(textoCupos(5)).toBe('5 cupos');
        expect(textoCupos(1)).toBe('1 cupo');
    });
});

describe('oferta del bot intercalada por grupo', () => {
    const F = (id: string, grupo: string, fecha: string): FranjaCortesia => ({
        id, grupo, fecha, horaInicio: '16:00', horaFin: null, sede: null, cupos: 998,
    });
    it('la primera página muestra grupos distintos, en orden de su próxima franja', () => {
        const r = intercalarPorGrupo([
            F('a1', 'A', '2026-10-06'), F('a2', 'A', '2026-10-07'), F('b1', 'B', '2026-10-07'),
            F('a3', 'A', '2026-10-08'), F('c1', 'C', '2026-10-09'), F('b2', 'B', '2026-10-09'),
        ]);
        expect(r.map((f) => f.id)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'a3']);
    });
    it('normalizarHora', () => {
        expect(normalizarHora('7:05')).toBe('07:05');
        expect(normalizarHora('20:00:00')).toBe('20:00');
        expect(normalizarHora('25:00')).toBeNull();
    });
});
