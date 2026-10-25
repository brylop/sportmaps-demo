import { describe, it, expect } from 'vitest';
import {
  DOCUMENTOS_PROPIOS, asistenciaDelMes, edadDeportista, entrenosProximos, esCobroPropio, fechaCorta, fraseDeuda, mensajeErrorRpe, misConvocatorias,
  puedePagar, rachaDeEntrenos, respondeConvocatoria, unToqueAlcanza, valorRpe, cuandoFue, cargaSemanal,
} from './athleteV2Model';
import type { Transaction } from '@/components/parent/v2/pagosModel';

const HOY = new Date(2026, 9, 25, 10, 0); // domingo 25 de octubre de 2026

describe('mayor vs menor (decisión 6)', () => {
  it('18 años o más es mayor; 17 es menor; sin fecha, desconocida', () => {
    expect(edadDeportista('1992-11-18', HOY)).toBe('mayor');
    expect(edadDeportista('2008-10-25', HOY)).toBe('mayor'); // cumple 18 hoy
    expect(edadDeportista('2008-10-26', HOY)).toBe('menor'); // cumple 18 mañana
    expect(edadDeportista('2013-05-01', HOY)).toBe('menor');
    expect(edadDeportista(null, HOY)).toBe('desconocida');
  });

  it('el menor NUNCA paga, aunque tenga cobros a su nombre o figure como pagador', () => {
    const cobros = [{ parent_id: 'yo', user_id: 'yo' }, { parent_id: null, user_id: 'yo' }];
    expect(puedePagar('menor', 'yo', cobros)).toBe(false);
    expect(puedePagar('menor', 'yo', [])).toBe(false);
  });

  it('el mayor paga lo suyo, tenga o no cobros', () => {
    expect(puedePagar('mayor', 'yo', [])).toBe(true);
  });

  it('sin fecha de nacimiento solo paga si figura como pagador (parent_id = él)', () => {
    expect(puedePagar('desconocida', 'yo', [{ parent_id: null, user_id: 'yo' }])).toBe(false);
    expect(puedePagar('desconocida', 'yo', [{ parent_id: 'mamá', user_id: 'yo' }])).toBe(false);
    expect(puedePagar('desconocida', 'yo', [{ parent_id: 'yo', user_id: 'yo' }])).toBe(true);
    expect(puedePagar('desconocida', undefined, [{ parent_id: 'yo', user_id: 'yo' }])).toBe(false);
  });

  it('un cobro a su nombre que paga otra persona no es suyo', () => {
    expect(esCobroPropio({ parent_id: 'mamá', user_id: 'yo' }, 'yo')).toBe(false);
    expect(esCobroPropio({ parent_id: null, user_id: 'yo' }, 'yo')).toBe(true);
    expect(esCobroPropio({ parent_id: 'yo', user_id: null }, 'yo')).toBe(true);
  });

  it('adulto que también es acudiente: los cobros de sus hijos (child_id) no son suyos', () => {
    expect(esCobroPropio({ parent_id: 'yo', user_id: null, child_id: 'hijo' }, 'yo')).toBe(false);
    // inscripción vieja: user_id del padre junto al child_id
    expect(esCobroPropio({ parent_id: 'yo', user_id: 'yo', child_id: 'hijo' }, 'yo')).toBe(false);
    expect(esCobroPropio({ parent_id: null, user_id: 'yo', child_id: 'hijo' }, 'yo')).toBe(false);
    expect(esCobroPropio({ parent_id: 'yo', user_id: 'yo', child_id: null }, 'yo')).toBe(true);
  });

  it('sin fecha de nacimiento, tener hijos con cobros NO lo vuelve pagador', () => {
    expect(puedePagar('desconocida', 'yo', [{ parent_id: 'yo', user_id: null, child_id: 'hijo' }])).toBe(false);
    expect(puedePagar('desconocida', 'yo', [{ parent_id: 'yo', user_id: 'yo', child_id: 'hijo' }])).toBe(false);
    expect(puedePagar('desconocida', 'yo', [{ parent_id: 'yo', user_id: 'yo', child_id: 'hijo' }, { parent_id: 'yo', user_id: 'yo', child_id: null }])).toBe(true);
  });
});

describe('mensajes de error del «¿Qué tan duro fue?»', () => {
  it('nunca devuelve el message crudo de PostgREST', () => {
    const crudo = { code: 'XX000', message: 'new row violates row-level security policy for table "performance_entries"' };
    expect(mensajeErrorRpe(crudo)).toBe('Inténtalo de nuevo en un momento.');
    expect(mensajeErrorRpe({ code: '55000', message: 'Ya pasaron 24 horas desde el cierre de la sesión.' })).toBe('Ya no se puede responder este entreno.');
    expect(mensajeErrorRpe({ code: '42501', message: 'No autorizado: solo puedes responder por vos misma.' })).toBe('No tienes permiso para responder este entreno.');
    expect(mensajeErrorRpe(new Error('fetch failed'))).toBe('Inténtalo de nuevo en un momento.');
  });
});

describe('convocatoria: responde el mayor, el menor solo la ve (decisión 8)', () => {
  it('respondeConvocatoria: el mayor y el que no tiene fecha de nacimiento responden; el menor no', () => {
    expect(respondeConvocatoria('mayor')).toBe(true);
    expect(respondeConvocatoria('desconocida')).toBe(true);
    expect(respondeConvocatoria('menor')).toBe(false);
  });

  it('my_callups: deja solo las propias (adulto o su ficha), no las de hijos', () => {
    const rows = [
      { lineup_id: 'l1', subject_type: 'profile', subject_id: 'yo', opponent: 'Club Arrayanes', match_date: '2026-10-31', kickoff_at: '2026-10-31T10:30:00', location: 'Coliseo', notes: 'Uniforme blanco', response: 'va' },
      { lineup_id: 'l2', subject_type: 'child', subject_id: 'hijo', opponent: 'Los Pinos', match_date: '2026-10-30' },
      { lineup_id: 'l3', subject_type: 'profile', subject_id: 'otro', match_date: '2026-10-29' },
      { lineup_id: 'l4', subject_type: 'unregistered', subject_id: 'ficha', opponent: 'Sur', match_date: '2026-11-02' },
    ];
    const r = misConvocatorias(rows, 'yo');
    expect(r.map((c) => c.lineupId)).toEqual(['l1', 'l4']);
    expect(r[0]).toMatchObject({ subjectType: 'profile', rival: 'Club Arrayanes', hora: '10:30', lugar: 'Coliseo', nota: 'Uniforme blanco', respuesta: 'va' });
    expect(misConvocatorias(null, 'yo')).toEqual([]);
  });

  it("my_callups: 'child' es siempre de un hijo (children no enlaza cuentas), aunque el id coincida con el suyo", () => {
    // Según el cuerpo de la RPC, 'child' solo sale de children.parent_id = auth.uid().
    const rows = [{ lineup_id: 'l9', subject_type: 'child', subject_id: 'yo', match_date: '2026-10-30' }];
    expect(misConvocatorias(rows, 'yo')).toEqual([]);
  });
});

describe('racha = entrenos ASISTIDOS seguidos (decisión 7)', () => {
  const r = (attendance_date: string, status: string) => ({ attendance_date, status });
  it('cuenta presentes y tarde desde el más reciente; una falta la corta', () => {
    expect(rachaDeEntrenos([
      r('2026-10-23', 'present'), r('2026-10-21', 'late'), r('2026-10-19', 'present'),
      r('2026-10-16', 'absent'), r('2026-10-14', 'present'),
    ])).toBe(3);
  });
  it('la excusa ni suma ni corta', () => {
    expect(rachaDeEntrenos([r('2026-10-23', 'present'), r('2026-10-21', 'excused'), r('2026-10-19', 'present')])).toBe(2);
  });
  it('si el último fue falta, la racha es 0; sin registros, 0', () => {
    expect(rachaDeEntrenos([r('2026-10-23', 'absent'), r('2026-10-21', 'present')])).toBe(0);
    expect(rachaDeEntrenos([])).toBe(0);
  });
  it('no depende del orden en que llegan', () => {
    expect(rachaDeEntrenos([r('2026-10-16', 'absent'), r('2026-10-23', 'present'), r('2026-10-19', 'present')])).toBe(2);
  });
  it('asistencia del mes sin contar excusas', () => {
    expect(asistenciaDelMes([
      r('2026-10-23', 'present'), r('2026-10-21', 'absent'), r('2026-10-19', 'excused'), r('2026-09-30', 'present'),
    ], HOY)).toEqual({ vino: 1, total: 2, mes: 'octubre' });
  });
});

describe('«¿Qué tan duro fue?» de un toque', () => {
  it('Suave · Normal · Duro → 3 · 5 · 8 de la escala de Borg', () => {
    expect([valorRpe('Suave'), valorRpe('Normal'), valorRpe('Duro')]).toEqual([3, 5, 8]);
  });
  it('si la escuela exige las otras preguntas, un toque no alcanza', () => {
    expect(unToqueAlcanza(['rpe_borg'])).toBe(true);
    expect(unToqueAlcanza([])).toBe(true);
    expect(unToqueAlcanza(['rpe_borg', 'task_comprehension', 'self_effort_pct', 'satisfaction'])).toBe(false);
  });
  it('cuándo fue', () => {
    expect(cuandoFue('2026-10-25', HOY)).toBe('hoy');
    expect(cuandoFue('2026-10-24', HOY)).toBe('ayer');
    expect(cuandoFue('2026-10-20', HOY)).toBe('el martes');
  });
  it('carga semanal promedia rpe_borg por semana', () => {
    const c = cargaSemanal([
      { metric_key: 'rpe_borg', value: 4, recorded_at: '2026-10-24T20:00:00' },
      { metric_key: 'rpe_borg', value: 6, recorded_at: '2026-10-22T20:00:00' },
      { metric_key: 'self_effort_pct', value: 90, recorded_at: '2026-10-22T20:00:00' },
    ], HOY);
    expect(c[3]).toEqual({ label: 'Esta semana', valor: 5 });
    expect(c[0].valor).toBeNull();
  });
});

describe('fecha corta de torneos (D7)', () => {
  it('«sáb 21 nov» sin corrimiento de zona; si no se entiende, la deja', () => {
    expect(fechaCorta('2026-11-21')).toBe('sáb 21 nov');
    expect(fechaCorta('2026-01-01T00:00:00Z')).toBe('jue 1 ene');
    expect(fechaCorta('pronto')).toBe('pronto');
    expect(fechaCorta(null)).toBe('');
  });
});

describe('frases y utilidades', () => {
  const t = (p: Partial<Transaction>): Transaction => ({ id: 'x', amount: 100, status: 'pending', reference: 'r', transaction_date: '2026-10-01', ...p });
  it('fraseDeuda', () => {
    expect(fraseDeuda([t({ payment_category: 'mensualidad', period_month: 10 })])).toBe('Falta tu mensualidad de octubre.');
    expect(fraseDeuda([t({ concept: 'Uniforme', payment_category: 'articulos' })])).toBe('Tienes un cobro pendiente: Uniforme.');
    expect(fraseDeuda([t({}), t({ id: 'y' })])).toBe('Tienes 2 cobros pendientes.');
  });
  it('documentos propios sin los del acudiente', () => {
    expect(DOCUMENTOS_PROPIOS.some((d) => d.tipo.startsWith('guardian_'))).toBe(false);
    expect(DOCUMENTOS_PROPIOS.some((d) => d.tipo === 'athlete_id_front')).toBe(true);
  });
  it('entrenos próximos desde el horario del equipo (uno de hoy cuenta hasta que termina)', () => {
    const eq = [{ teamId: 't', nombre: 'Golf Adultos', lugar: 'Cancha 2', profe: 'Andrés Gil', franjas: [{ day: 0, time: '09:00', end: '11:00' }, { day: 2, time: '18:30' }] }];
    const r = entrenosProximos(eq, HOY, 7);
    expect(r.map((e) => [e.fecha.getDate(), e.hora])).toEqual([[25, '09:00'], [27, '18:30']]);
    expect(entrenosProximos(eq, new Date(2026, 9, 25, 12, 0), 7).map((e) => e.fecha.getDate())).toEqual([27]);
  });
});
