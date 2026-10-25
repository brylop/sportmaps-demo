import { describe, it, expect } from 'vitest';
import { ratingFromEffort } from '@/components/parent/v2/hijos/hijosUtils';
import {
  comoDesdeEffort,
  construirPendientes,
  EFFORT_DE,
  esRpcInexistente,
  fraseMomento,
  horarioDe,
  mapaEstadosPago,
  momentoDelDia,
  normalizarEstadoPago,
  nombreCorto,
  abreviaturaEquipo,
  pasosDelPlan,
  proximoDe,
  proximoPartido,
  resultadoDe,
  RUTAS_COACH_V2,
  sujetoDe,
  whatsappAcudiente,
  type EquipoHorario,
  type Partido,
} from './coachV2Logic';

// Jueves 8 de octubre de 2026.
const a = (h: number, m = 0) => new Date(2026, 9, 8, h, m);
const SUB11: EquipoHorario = {
  id: 't11', nombre: 'Sub 11', lugar: 'Cancha 2', deportistas: 22,
  franjas: [{ day: 2, time: '16:00', end: '17:30' }, { day: 4, time: '16:00', end: '17:30' }],
};
const SUB13: EquipoHorario = {
  id: 't13', nombre: 'Sub 13', lugar: 'Cancha 1', deportistas: 18,
  franjas: [{ day: 5, time: '15:00', end: '16:30' }],
};

describe('momento del día', () => {
  it('antes del entreno: «En 40 minutos…» y Tomar lista', () => {
    const m = momentoDelDia([SUB11, SUB13], a(15, 20), []);
    expect(m.tipo).toBe('antes');
    expect(fraseMomento(m).titulo).toBe('En 40 minutos entrenas a Sub 11.');
    expect(fraseMomento(m).detalle).toBe('Cancha 2 · 22 deportistas · 4:00 p. m.');
  });

  it('lejos del entreno dice la hora', () => {
    expect(fraseMomento(momentoDelDia([SUB11], a(9), [])).titulo).toBe('Hoy entrenas a Sub 11 a las 4:00 p. m.');
  });

  it('durante el entreno, sin lista cerrada: sigue siendo tomar lista', () => {
    expect(momentoDelDia([SUB11], a(16, 30), []).tipo).toBe('durante');
  });

  it('después del entreno con la lista cerrada y sin evaluar: evaluar con cuántos vinieron', () => {
    const s = { id: 's1', teamId: 't11', fecha: '2026-10-08', cerrada: true, evaluada: false };
    const m = momentoDelDia([SUB11], a(18), [s]);
    expect(m.tipo).toBe('despues');
    expect(fraseMomento(m, 19).titulo).toBe('Vinieron 19 de 22. ¿Cómo le fue a Sub 11?');
  });

  it('después del entreno sin lista: pregunta por la lista', () => {
    const m = momentoDelDia([SUB11], a(18), []);
    expect(m.tipo).toBe('despues');
    expect(fraseMomento(m).titulo).toBe('¿Ya tomaste la lista de Sub 11?');
  });

  it('ya evaluado: pasa al próximo (día libre de lo que queda)', () => {
    const s = { id: 's1', teamId: 't11', fecha: '2026-10-08', cerrada: true, evaluada: true };
    const m = momentoDelDia([SUB11, SUB13], a(18), [s]);
    expect(m.tipo).toBe('libre');
    expect(fraseMomento(m).detalle).toBe('Mañana: Sub 13 a las 3:00 p. m. en Cancha 1.');
  });

  it('día sin entreno', () => {
    const sabado = new Date(2026, 9, 10, 10, 0);
    const m = momentoDelDia([SUB11], sabado, []);
    expect(fraseMomento(m)).toEqual({ titulo: 'Hoy no entrenas.', detalle: 'El martes: Sub 11 a las 4:00 p. m. en Cancha 2.' });
  });
});

describe('el profe nunca ve plata (decisión 5)', () => {
  it('solo pasan los tres estados', () => {
    expect(normalizarEstadoPago('al_dia')).toBe('al_dia');
    expect(normalizarEstadoPago('vencido')).toBe('vencido');
    for (const malo of ['paid', 'overdue', 180000, '$180.000', 'Mensualidad octubre', null, undefined]) {
      expect(normalizarEstadoPago(malo)).toBeNull();
    }
  });

  it('el mapa descarta filas raras y no guarda montos', () => {
    const m = mapaEstadosPago([
      { athlete_key: 'c1', estado: 'pendiente', amount: 180000, concept: 'Mensualidad' },
      { athlete_key: 'c2', estado: '$90.000' },
      { athlete_key: 3, estado: 'al_dia' },
      null,
    ]);
    expect([...m.entries()]).toEqual([['c1', 'pendiente']]);
  });

  it('la forma real de team_payment_status (athlete_key «child:<id>» + subject_id)', () => {
    const m = mapaEstadosPago([{ subject_type: 'child', subject_id: 'c9', athlete_key: 'child:c9', athlete_name: 'Sofía', estado: 'vencido' }]);
    expect(m.get('c9')).toBe('vencido');
    expect(m.get('child:c9')).toBe('vencido');
  });
});

describe('Bien · Normal · Le costó ↔ coach_effort_rating', () => {
  it('ida y vuelta da lo mismo, y el acudiente lee lo mismo', () => {
    expect(EFFORT_DE).toEqual({ bien: 90, normal: 70, costo: 60 });
    for (const [k, v] of Object.entries(EFFORT_DE)) {
      expect(comoDesdeEffort(v)).toBe(k);
    }
    expect(ratingFromEffort(EFFORT_DE.bien)).toBe('Bien');
    expect(ratingFromEffort(EFFORT_DE.normal)).toBe('Normal');
    expect(ratingFromEffort(EFFORT_DE.costo)).toBe('Le costó');
  });
});

describe('pendientes', () => {
  const base = {
    sinEvaluar: [{ id: 's9', teamId: 't11', fecha: '2026-10-06', cerrada: true, evaluada: false, equipo: 'Sub 11' }],
    informes: [{ teamId: 't11', equipo: 'Sub 11', total: 22, listos: 16, publicados: 0, faltanNota: 6 }],
    mes: 10,
    partidos: [{ id: 'm1', teamId: 't11', equipo: 'Sub 11', rival: 'Club Los Andes', fecha: '2026-10-10', hora: '10:30 a. m.', convocado: false }],
    ocultos: [] as string[],
    hoy: a(10),
    rutas: RUTAS_COACH_V2,
  };

  it('evaluar, publicar (si la escuela deja) y convocar', () => {
    const p = construirPendientes({ ...base, puedePublicar: true });
    expect(p.map((x) => x.titulo)).toEqual([
      'Falta evaluar el entreno del martes 6',
      'Informe de octubre por publicar',
      'Convocar al partido del sábado',
    ]);
    expect(p[0].href).toBe('/coach/evaluar/s9');
    expect(p[2].detalle).toBe('Sub 11 contra Club Los Andes · 10:30 a. m.');
  });

  it('si la escuela no deja publicar al profe, no aparece el informe', () => {
    expect(construirPendientes({ ...base, puedePublicar: false }).some((x) => x.id.startsWith('inf:'))).toBe(false);
  });

  it('«Más tarde» los esconde; convocados no aparecen', () => {
    const p = construirPendientes({
      ...base, puedePublicar: true, ocultos: ['eval:s9'],
      partidos: [{ ...base.partidos[0], convocado: true }],
    });
    expect(p.map((x) => x.id)).toEqual(['inf:t11:10']);
  });
});

describe('utilidades', () => {
  it('RPC inexistente = PGRST202 o 404', () => {
    expect(esRpcInexistente({ code: 'PGRST202', message: 'x' })).toBe(true);
    expect(esRpcInexistente({ status: 404 })).toBe(true);
    expect(esRpcInexistente({ code: '42501', message: 'Sin permiso' })).toBe(false);
    expect(esRpcInexistente(null)).toBe(false);
  });

  it('sujetos de la convocatoria', () => {
    expect(sujetoDe({ id: 'c', tipo: 'child', userId: null })).toEqual({ subject_type: 'child', subject_id: 'c' });
    expect(sujetoDe({ id: 'p', tipo: 'adult', userId: 'u' })).toEqual({ subject_type: 'profile', subject_id: 'u' });
    expect(sujetoDe({ id: 'x', tipo: 'unregistered', userId: null })).toEqual({ subject_type: 'unregistered', subject_id: 'x' });
  });

  it('WhatsApp al acudiente con celular colombiano', () => {
    expect(whatsappAcudiente('300 123 4567', 'Sofía Rojas', 'Laura Gómez')).toBe(
      `https://wa.me/573001234567?text=${encodeURIComponent('Hola, soy Laura, profe de Sofía. ')}`,
    );
    expect(whatsappAcudiente('123', 'Sofía')).toBeNull();
  });

  it('nombres y abreviaturas', () => {
    expect(nombreCorto('Juan José Díaz')).toBe('Juan D.');
    expect(abreviaturaEquipo('Fútbol — Sub-15')).toBe('S15');
    expect(abreviaturaEquipo('Tenis — Adultos')).toBe('TA');
  });

  it('horario y próximo de la tarjeta', () => {
    expect(horarioDe(SUB11)).toBe('Martes y jueves · 4:00 p. m.');
    expect(proximoDe(SUB11, a(10))).toBe('Hoy');
    expect(proximoDe(SUB11, a(18))).toBe('Martes');
    expect(proximoDe(SUB13, a(18))).toBe('Mañana');
  });

  it('plan de hoy: bloques nuevos o ejercicios viejos', () => {
    expect(pasosDelPlan({ session_blocks: [{ name: 'Rondo', minutes: '15' }, { activity: 'Salida', minutes: 25 }] }))
      .toEqual([{ min: '15′', texto: 'Rondo' }, { min: '25′', texto: 'Salida' }]);
    expect(pasosDelPlan({ session_blocks: [], drills: [{ name: 'Saque' }], warmup: 'Trote' }))
      .toEqual([{ min: null, texto: 'Calentamiento: Trote' }, { min: null, texto: 'Saque' }]);
  });

  it('partidos: próximo y resultado desde nuestro lado', () => {
    const p = (x: Partial<Partido>): Partido => ({
      id: 'x', rival: 'Andes', fecha: '2026-10-10', kickoffAt: null, lugar: null, enCasa: true,
      golesLocal: null, golesVisita: null, estado: 'scheduled', tipo: null, nota: null, ...x,
    });
    expect(proximoPartido([p({ id: 'viejo', fecha: '2026-10-01', golesLocal: 1, golesVisita: 0 }), p({ id: 'nuevo' })], a(10))?.id).toBe('nuevo');
    expect(resultadoDe(p({ enCasa: false, golesLocal: 1, golesVisita: 3 }))).toEqual({ marcador: '3 – 1', frase: 'Ganamos a Andes', tono: 'gana' });
  });
});
