import { describe, it, expect } from 'vitest';
import { bloquesDeSesion, cargaDeSemana, estadoDelDia, semanaActual, semanaDe, textoSemana } from './sesionesModel';

describe('Sesiones V2: el plan en palabras de la cancha', () => {
  it('semana de lunes a domingo', () => {
    const s = semanaDe('2026-10-08'); // jueves
    expect(s[0]).toBe('2026-10-05');
    expect(s[6]).toBe('2026-10-11');
    expect(semanaDe('2026-10-11')[0]).toBe('2026-10-05'); // domingo sigue en la misma semana
    expect(semanaDe('2026-10-08', 1)[0]).toBe('2026-10-12');
  });

  it('bloques: de session_blocks, o armados con calentamiento y ejercicios', () => {
    expect(bloquesDeSesion({ session_blocks: [{ id: 'x', name: 'Rondo', minutes: 15, activity: '4 contra 1' }] }))
      .toEqual([{ id: 'x', index: 0, nombre: 'Rondo', minutos: 15, texto: '4 contra 1' }]);
    const viejos = bloquesDeSesion({ session_blocks: [], warmup: 'Trote', drills: [{ name: 'Pases', duration: '20 min', focus: 'Precisión' }] });
    expect(viejos.map((b) => [b.nombre, b.minutos, b.index])).toEqual([['Calentamiento', null, null], ['Pases', 20, null]]);
  });

  it('carga Suave · Media · Alta desde el «qué tan duro» planeado', () => {
    expect(cargaDeSemana([{ planned_rpe: 3 }, { planned_rpe: 4 }])?.carga).toBe('Suave');
    expect(cargaDeSemana([{ planned_rpe: 6 }, { planned_rpe: null }])?.carga).toBe('Media');
    expect(cargaDeSemana([{ planned_rpe: 8 }])).toEqual({ carga: 'Alta', nivel: 3 });
    expect(cargaDeSemana([{ planned_rpe: null }])).toBeNull();
  });

  it('estado de cada día', () => {
    expect(estadoDelDia('2026-10-08', '2026-10-08', true, false, false)).toBe('Hoy');
    expect(estadoDelDia('2026-10-06', '2026-10-08', true, true, false)).toBe('Sin evaluar');
    expect(estadoDelDia('2026-10-05', '2026-10-08', true, true, true)).toBe('Hecho');
    expect(estadoDelDia('2026-10-07', '2026-10-08', true, false, false)).toBe('Sin lista');
    expect(estadoDelDia('2026-10-10', '2026-10-08', true, false, false)).toBe('Planeado');
    expect(estadoDelDia('2026-10-09', '2026-10-08', false, false, false)).toBe('');
  });

  it('semana actual del plan del mes', () => {
    const w = [
      { id: '1', number: 1, starts_on: '2026-10-01', ends_on: '2026-10-07', objective: null },
      { id: '2', number: 2, starts_on: '2026-10-08', ends_on: '2026-10-14', objective: null },
    ];
    expect(semanaActual(w, '2026-10-09')).toBe(1);
    expect(textoSemana(0, 1, w, '2026-10-09', 3)).toBe('Semana 1 · hecha');
    expect(textoSemana(0, 1, w, '2026-10-09', 0)).toBe('Semana 1 · sin listas');
    expect(textoSemana(0, 1, w, '2026-10-09')).toBe('Semana 1');
    expect(textoSemana(1, 1, w, '2026-10-09')).toBe('Semana 2 · esta semana');
  });
});

describe('mes del plan', () => {
  it('el del día del medio', async () => {
    const { mesDelPlan } = await import('./sesionesModel');
    expect(mesDelPlan('2026-08-31', '2026-09-28')).toBe('Septiembre');
  });
});
