/** Segunda ronda del QA en navegador: horario en la semana (D6), plan vigente (D7), agenda personal (D11). */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { entrenosDelHorario, listasEntre, planVigente } from './sesionesModel';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/bffClient', () => ({ bffClient: { get } }));

import { agendaPersonalDelDia, agendaPersonalSinAcceso, _olvidarAgendaPersonal } from './agendaPersonal';

describe('D6 · la semana usa el horario del equipo', () => {
  const equipos = [
    { id: 'f', name: 'Fútbol — Sub-15', franjas: [{ day: 2, time: '15:30' }, { day: 4, time: '15:30' }] }, // mar y jue
    { id: 't', name: 'Tenis — Adultos', franjas: [{ day: 6, time: '08:00' }] },
  ];
  it('martes y jueves hay entreno de Fútbol con la hora; lunes no', () => {
    expect(entrenosDelHorario('2026-10-20', equipos)).toEqual([{ teamId: 'f', nombre: 'Fútbol — Sub-15', hora: '3:30 p. m.' }]); // martes
    expect(entrenosDelHorario('2026-10-22', equipos)).toEqual([{ teamId: 'f', nombre: 'Fútbol — Sub-15', hora: '3:30 p. m.' }]); // jueves
    expect(entrenosDelHorario('2026-10-24', equipos)).toEqual([{ teamId: 't', nombre: 'Tenis — Adultos', hora: '8:00 a. m.' }]); // sábado
    expect(entrenosDelHorario('2026-10-19', equipos)).toEqual([]); // lunes
  });
});

describe('D7 · plan del mes', () => {
  const planes = [
    { id: 'sep', starts_on: '2026-08-31', ends_on: '2026-09-27' },
    { id: 'nov', starts_on: '2026-11-02', ends_on: '2026-11-29' },
  ];
  it('un plan terminado no es el del mes; si hay uno próximo, ese', () => {
    expect(planVigente([planes[0]], '2026-10-25')).toBeNull();
    expect(planVigente(planes, '2026-10-25')?.id).toBe('nov');
    expect(planVigente(planes, '2026-09-10')?.id).toBe('sep');
  });
  it('hechos = listas tomadas por semana', () => {
    const claves = ['t1|2026-10-06', 't1|2026-10-08', 't2|2026-10-15'];
    expect(listasEntre(claves, '2026-10-05', '2026-10-11')).toBe(2);
    expect(listasEntre(claves, '2026-10-19', '2026-10-25')).toBe(0);
  });
});

describe('D11 · agenda de entrenador personal', () => {
  beforeEach(() => { get.mockReset(); _olvidarAgendaPersonal(); });

  it('un coach sin workspace recibe 403 una vez y no se vuelve a llamar en la sesión', async () => {
    get.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    // Hoy y Asistencia a la vez: una sola llamada.
    const [a, b] = await Promise.all([agendaPersonalDelDia('2026-10-25'), agendaPersonalDelDia('2026-10-25')]);
    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
    expect(agendaPersonalSinAcceso()).toBe(true);
    await agendaPersonalDelDia('2026-10-26');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('un error de red no se recuerda como «sin acceso»', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('fetch'), { status: 0 }));
    expect(await agendaPersonalDelDia('2026-10-25')).toBeNull();
    expect(agendaPersonalSinAcceso()).toBe(false);
    get.mockResolvedValueOnce({ sessions: [{ id: 's1' }] });
    expect(await agendaPersonalDelDia('2026-10-25')).toEqual({ sessions: [{ id: 's1' }] });
  });
});
