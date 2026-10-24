import { describe, it, expect } from 'vitest';
import {
    normalizarEscalones, porcentajeRestante, decidirAvisos, aplicarDecision, armarMensaje,
    formatoHoras, clasesRestantes, fechaDeRenovacion, dentroDeHorarioDeCorreo,
} from './hour-bank-balance-notices.shared';

describe('normalizarEscalones', () => {
    it('ordena de mayor a menor, quita repetidos y valores fuera de 0..100', () => {
        expect(normalizarEscalones([20, 50, 0, 20, 150, -5, 'x', 12.5])).toEqual([50, 20, 0]);
    });
    it('lo que no es arreglo → sin avisos', () => {
        expect(normalizarEscalones(null)).toEqual([]);
        expect(normalizarEscalones('50,20')).toEqual([]);
        expect(normalizarEscalones([])).toEqual([]);
    });
});

describe('porcentajeRestante', () => {
    it('36 h incluidas, 29 h usadas → ~19,4 %', () => {
        expect(porcentajeRestante(2160, 29 * 60)).toBeCloseTo(19.44, 1);
    });
    it('nunca baja de 0 ni pasa de 100', () => {
        expect(porcentajeRestante(480, 600)).toBe(0);
        expect(porcentajeRestante(480, -50)).toBe(100);
    });
    it('sin horas incluidas → null', () => {
        expect(porcentajeRestante(0, 0)).toBeNull();
    });
});

describe('decidirAvisos', () => {
    const steps = [50, 20, 0];
    it('saldo alto: no avisa', () => {
        expect(decidirAvisos(steps, 80, {})).toEqual({ aEnviar: null, marcarEnSilencio: [], borrarMarcas: [] });
    });
    it('cruza el 50 %: avisa 50', () => {
        expect(decidirAvisos(steps, 48, {}).aEnviar).toBe(50);
    });
    it('un escalón sale UNA sola vez', () => {
        const d = decidirAvisos(steps, 48, { '50': '2026-10-05T00:00:00Z' });
        expect(d.aEnviar).toBeNull();
    });
    it('de 80 % a 15 % de golpe: avisa solo el 20 y deja el 50 marcado en silencio', () => {
        const d = decidirAvisos(steps, 15, {});
        expect(d.aEnviar).toBe(20);
        expect(d.marcarEnSilencio).toEqual([50]);
    });
    it('0 horas con 50 y 20 ya enviados: avisa el 0', () => {
        const d = decidirAvisos(steps, 0, { '50': 'a', '20': 'b' });
        expect(d.aEnviar).toBe(0);
        expect(d.marcarEnSilencio).toEqual([]);
    });
    it('recarga: si el saldo vuelve a subir por encima del umbral, se borra la marca', () => {
        const d = decidirAvisos(steps, 60, { '50': 'a', '20': 'b' });
        expect(d.borrarMarcas.sort()).toEqual([20, 50]);
        expect(d.aEnviar).toBeNull();
    });
    it('tras la recarga una segunda bajada vuelve a avisar', () => {
        let marcas = aplicarDecision({ '50': 'a', '20': 'b' }, decidirAvisos(steps, 60, { '50': 'a', '20': 'b' }), 'ahora');
        expect(marcas).toEqual({});
        const d = decidirAvisos(steps, 45, marcas);
        expect(d.aEnviar).toBe(50);
    });
    it('sin escalones configurados o sin horas: no hace nada', () => {
        expect(decidirAvisos([], 10, {}).aEnviar).toBeNull();
        expect(decidirAvisos(steps, null, {}).aEnviar).toBeNull();
    });
    it('un reintento con el mismo saldo no reenvía (marca ya aplicada)', () => {
        const d1 = decidirAvisos(steps, 18, {});
        const marcas = aplicarDecision({}, d1, 'ahora');
        const d2 = decidirAvisos(steps, 18, marcas);
        expect(d2.aEnviar).toBeNull();
        expect(d2.marcarEnSilencio).toEqual([]);
    });
});

describe('aplicarDecision', () => {
    it('no muta la entrada y marca enviado + silencio', () => {
        const entrada = { '50': 'x' };
        const out = aplicarDecision(entrada, { aEnviar: 20, marcarEnSilencio: [50], borrarMarcas: [] }, 'T');
        expect(entrada).toEqual({ '50': 'x' });
        expect(out).toEqual({ '50': 'T', '20': 'T' });
    });
});

describe('formatoHoras / clasesRestantes', () => {
    it('formatea', () => {
        expect(formatoHoras(0)).toBe('0 h');
        expect(formatoHoras(45)).toBe('45 min');
        expect(formatoHoras(120)).toBe('2 h');
        expect(formatoHoras(150)).toBe('2 h 30 min');
    });
    it('clases enteras que caben', () => {
        expect(clasesRestantes(216, 120)).toBe(1);
        expect(clasesRestantes(360, 120)).toBe(3);
        expect(clasesRestantes(-10, 120)).toBe(0);
        expect(clasesRestantes(100, 0)).toBe(0);
    });
});

describe('armarMensaje', () => {
    const base = { atleta: 'Camila', incluidoMinutos: 2160, bloqueMinutos: 120, seRenueva: '1 de noviembre', momento: 'cierre' as const };
    it('50 %: dice cuánto queda y cuándo se renueva', () => {
        const m = armarMensaje({ ...base, escalon: 50, restanteMinutos: 1080 });
        expect(m.cuerpo).toContain('18 h');
        expect(m.cuerpo).toContain('1 de noviembre');
        expect(m.severidad).toBe('info');
    });
    it('20 %: cuenta las clases que alcanzan (N sale del bloque, no se escribe a mano)', () => {
        const m = armarMensaje({ ...base, escalon: 20, restanteMinutos: 432 });
        expect(m.titulo).toContain('7 h 12 min');
        expect(m.cuerpo).toContain('3 clases más');
        expect(m.severidad).toBe('aviso');
    });
    it('20 % en la ENTRADA dice que acaba de entrar', () => {
        const m = armarMensaje({ ...base, escalon: 20, restanteMinutos: 432, momento: 'entrada' });
        expect(m.cuerpo).toContain('acaba de entrar');
    });
    it('menos de un bloque: dice que ya no alcanza para una clase completa', () => {
        const m = armarMensaje({ ...base, escalon: 10, restanteMinutos: 90 });
        expect(m.cuerpo).toContain('no alcanza para una clase completa');
    });
    it('0 %: crítico, y NO promete bloqueo si no está encendido', () => {
        const m = armarMensaje({ ...base, escalon: 0, restanteMinutos: 0 });
        expect(m.severidad).toBe('critico');
        expect(m.cuerpo).toContain('usó las 36 h');
        expect(m.cuerpo).not.toContain('no abrirá');
    });
    it('0 % con bloqueo encendido lo anuncia', () => {
        const m = armarMensaje({ ...base, escalon: 0, restanteMinutos: 0, conBloqueo: true });
        expect(m.cuerpo).toContain('no abrirá');
    });
});

describe('fechaDeRenovacion', () => {
    it('día 1 del mes siguiente al fin del período', () => {
        expect(fechaDeRenovacion('2026-10-31', '2026-10-20')).toBe('1 de noviembre');
        expect(fechaDeRenovacion('2026-12-31', '2026-12-20')).toBe('1 de enero');
    });
    it('sin fin de período usa el mes de hoy', () => {
        expect(fechaDeRenovacion(null, '2026-10-20')).toBe('1 de noviembre');
    });
});

describe('dentroDeHorarioDeCorreo', () => {
    it('8:00–19:59 hora Colombia', () => {
        expect(dentroDeHorarioDeCorreo(new Date('2026-10-23T13:00:00Z'))).toBe(true);  // 8:00
        expect(dentroDeHorarioDeCorreo(new Date('2026-10-23T12:59:00Z'))).toBe(false); // 7:59
        expect(dentroDeHorarioDeCorreo(new Date('2026-10-24T00:59:00Z'))).toBe(true);  // 19:59
        expect(dentroDeHorarioDeCorreo(new Date('2026-10-24T01:00:00Z'))).toBe(false); // 20:00
    });
});
