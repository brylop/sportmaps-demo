import { describe, it, expect } from 'vitest';
import {
    armarCorrecciones, edicionVacia, claveCelda, estaPresente, fechasDeEquipo, filasSinResolver,
    necesitaElegirEquipo, presentesFinales, puedeGuardar, fechaCorta,
    type EquipoCruce, type FilaCruzada, type RosterEquipo,
} from '@/lib/attendanceSheetIntake';
import { bytesDeDataUrl } from '@/lib/prepararPlanilla';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const TEAM = '99999999-9999-4999-8999-999999999999';

const fila = (p: Partial<FilaCruzada>): FilaCruzada => ({
    nombreHoja: 'x', atletaId: null, atletaNombre: null, score: 1, estado: 'exacto', sugerencia: null, marcasPorFecha: {}, ...p,
});

const equipo = (): EquipoCruce => ({
    team_id: TEAM, team_name: 'Intermedio', fechas: ['2026-10-20', '2026-10-22'],
    cruce: {
        filas: [
            fila({ nombreHoja: 'Ana', atletaId: A, marcasPorFecha: { '2026-10-20': 'asistio', '2026-10-22': 'sin_marca' } }),
            fila({ nombreHoja: 'Beto', atletaId: B, marcasPorFecha: { '2026-10-20': 'dudosa', '2026-10-22': 'asistio' } }),
            fila({ nombreHoja: 'Carlitos', estado: 'no_encontrada', sugerencia: { id: C, nombre: 'Carlos', score: 0.7 }, marcasPorFecha: { '2026-10-20': 'asistio' } }),
            fila({ nombreHoja: 'Retirada', estado: 'ignorada', marcasPorFecha: { '2026-10-20': 'asistio' } }),
        ],
        porFecha: [],
    },
});
const roster: RosterEquipo = { teamId: TEAM, teamName: 'Intermedio', atletas: [{ id: A, nombre: 'Ana' }, { id: B, nombre: 'Beto' }, { id: C, nombre: 'Carlos' }] };

describe('grilla de planillas', () => {
    it('lee las fechas de la grilla ordenadas y sin repetir', () => {
        expect(fechasDeEquipo(equipo())).toEqual(['2026-10-20', '2026-10-22']);
    });

    it('solo asistio arranca marcado: sin marca y dudosa NO se marcan solas', () => {
        const e = equipo(); const ed = edicionVacia();
        expect(estaPresente(e, ed, A, '2026-10-20')).toBe(true);
        expect(estaPresente(e, ed, A, '2026-10-22')).toBe(false);
        expect(estaPresente(e, ed, B, '2026-10-20')).toBe(false);
        expect(estaPresente(e, ed, B, '2026-10-22')).toBe(true);
    });

    it('los toques del staff mandan sobre lo que dedujo el OCR', () => {
        const e = equipo();
        const ed = { ...edicionVacia(), toques: { [claveCelda('2026-10-20', B)]: true, [claveCelda('2026-10-20', A)]: false } };
        expect(presentesFinales(e, roster, ed)['2026-10-20']).toEqual([B]);
    });

    it('una fila no encontrada no cuenta hasta que el staff le asigna un deportista', () => {
        const e = equipo();
        expect(filasSinResolver(e).map((f) => f.nombreHoja)).toEqual(['Carlitos']);
        expect(presentesFinales(e, roster, edicionVacia())['2026-10-20']).toEqual([A]);
        const ed = { ...edicionVacia(), asignaciones: { Carlitos: C } };
        expect(presentesFinales(e, roster, ed)['2026-10-20']).toEqual([A, C]);
        expect(presentesFinales(e, roster, ed)['2026-10-22']).toEqual([B]);
    });

    it('armarCorrecciones manda ids por fecha y omite fechas sin presentes', () => {
        const e = equipo();
        const ed = { ...edicionVacia(), toques: { [claveCelda('2026-10-22', B)]: false } };
        const c = armarCorrecciones([e], [roster], { [TEAM]: ed });
        expect(c.porFecha).toEqual([{ teamId: TEAM, fecha: '2026-10-20', presentes: [A] }]);
        expect(armarCorrecciones([e], [roster], {}, TEAM).teamId).toBe(TEAM);
    });

    it('no deja guardar sin presentes', () => {
        const e = equipo();
        const ed = { ...edicionVacia(), toques: { [claveCelda('2026-10-20', A)]: false, [claveCelda('2026-10-22', B)]: false } };
        expect(puedeGuardar([e], [roster], { [TEAM]: ed })).toBe(false);
        expect(puedeGuardar([e], [roster], {})).toBe(true);
        expect(puedeGuardar([], [], {})).toBe(false);
    });

    it('pregunta el equipo cuando falta o la confianza no es alta', () => {
        const base = { teamId: TEAM, confianza: 'alta' as const, modo: 'foto' as const, equipos: [{ teamId: TEAM, teamName: 'x', fechas: [], noEncontradas: 0, ambiguas: 0, duplicados: 0 }] };
        expect(necesitaElegirEquipo(base)).toBe(false);
        expect(necesitaElegirEquipo({ ...base, confianza: 'media' })).toBe(true);
        expect(necesitaElegirEquipo({ ...base, equipos: [] })).toBe(true);
        expect(necesitaElegirEquipo({ ...base, modo: 'lista', equipos: [] })).toBe(false);
    });

    it('fechaCorta no corre el dia por la zona horaria', () => {
        expect(fechaCorta('2026-10-01')).toBe('1 oct');
        expect(fechaCorta('basura')).toBe('basura');
    });

    it('bytesDeDataUrl mide el archivo decodificado', () => {
        expect(bytesDeDataUrl('data:image/jpeg;base64,QUJD')).toBe(3);
        expect(bytesDeDataUrl('data:image/jpeg;base64,QUI=')).toBe(2);
    });
});
