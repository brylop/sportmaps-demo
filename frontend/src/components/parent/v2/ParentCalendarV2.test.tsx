/**
 * Calendario del acudiente V2: agrupa por día, pestañas Próximos/Torneos y
 * solo el rol `parent` lo ve (los demás siguen con el calendario de siempre).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  buildAgenda, groupByDay, parseTeamSchedule, usesParentCalendarV2, dayLabel,
} from './parentCalendarModel';

const NOW = new Date(2026, 9, 8, 9, 0); // jueves 8 de octubre de 2026

const children = [
  { id: 'c1', name: 'Sofía', schoolId: 's1', teamIds: ['t11'] },
  { id: 'c2', name: 'Tomás', schoolId: 's1', teamIds: ['t8'] },
];
const teams = [
  { id: 't11', name: 'Fútbol Sub 11', schoolId: 's1', location: 'Cancha 2', coachName: 'Laura Gómez', schedule: [{ day: 'thursday', start_time: '16:00', end_time: '17:30' }] },
  { id: 't8', name: 'Fútbol Sub 8', schoolId: 's1', location: 'Cancha 1', coachName: 'Andrés Ruiz', schedule: [{ day: 6, time: '09:00', end: '10:00' }] },
];
const iso = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const events = [
  { id: 'e1', title: 'Contra Club Los Andes', description: 'Llevar el uniforme azul\nLlegar 30 min antes', event_type: 'match', start_time: iso(10, 10, 30), location: 'Cancha 2', team_id: 't11', school_id: 's1' },
  { id: 'e2', title: 'No hay entreno: festivo', event_type: 'other', start_time: iso(12, 0), all_day: true, team_id: null, school_id: 's1' },
];

describe('modelo del calendario del acudiente', () => {
  it('agrupa por día con «Hoy · jueves 8» y arma entrenos, partidos y avisos de todos los hijos', () => {
    const days = groupByDay(buildAgenda({ children, teams, events, now: NOW, days: 7 }), NOW);
    expect(days.map((d) => d.label)).toEqual(['Hoy · jueves 8', 'Sábado 10', 'Lunes 12']);
    expect(days[0].items[0]).toMatchObject({ title: 'Entreno · Sofía', subtitle: 'Fútbol Sub 11 · Cancha 2 · Profe Laura' });
    expect(days[1].items.map((i) => i.title)).toEqual(['Entreno · Tomás', 'Partido · Sofía']);
    expect(days[1].items[1]).toMatchObject({ tag: 'Partido', note: 'Llevar el uniforme azul', subtitle: 'Contra Club Los Andes · Cancha 2' });
    expect(days[2].items[0]).toMatchObject({ kind: 'notice', subtitle: 'Aviso de la escuela', allDay: true });
  });

  it('un aviso de festivo de la escuela borra el entreno del horario fijo ese día', () => {
    const lunes = [{ ...teams[0], schedule: [{ day: 'monday', start_time: '16:00' }] }];
    const items = buildAgenda({ children, teams: lunes, events, now: NOW, days: 7 });
    expect(items.filter((i) => i.kind === 'training')).toHaveLength(0);
  });

  it('si el profe publicó el entreno ese día no se duplica con el horario fijo', () => {
    const publicado = [{ id: 'e3', title: 'Entreno', event_type: 'training', start_time: iso(8, 16), team_id: 't11', school_id: 's1' }];
    const items = buildAgenda({ children, teams: [teams[0]], events: publicado, now: NOW, days: 1 });
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe('ev-e3');
  });

  it('el horario en texto libre se ignora en vez de inventar horas', () => {
    expect(parseTeamSchedule('Lun y Mié 4 pm')).toEqual([]);
    expect(parseTeamSchedule([{ day: 'lunes', start_time: '7:05' }])).toEqual([{ dow: 1, hh: 7, mm: 5 }]);
  });

  it('etiqueta de otro mes lleva el mes', () => {
    expect(dayLabel(new Date(2026, 10, 2), NOW)).toBe('Lunes 2 de noviembre');
  });

  it('solo el rol activo parent usa la vista V2', () => {
    expect(usesParentCalendarV2('parent', 'parent')).toBe(true);
    expect(usesParentCalendarV2(null, 'parent')).toBe(true);
    for (const r of ['coach', 'owner', 'admin', 'school_admin', 'athlete']) {
      expect(usesParentCalendarV2(r, 'parent')).toBe(false);
      expect(usesParentCalendarV2(null, r)).toBe(false);
    }
  });
});

// ─── Componente con datos simulados ─────────────────────────────────────────
vi.mock('./useParentCalendarData', () => ({
  AGENDA_DAYS: 14,
  useParentAgenda: () => ({ isLoading: false, isError: false, refetch: vi.fn(), data: { children: [], teams: [], events: [] } }),
  useParentTournaments: () => ({
    isLoading: false, isError: false, refetch: vi.fn(),
    data: {
      registered: [{ registrationId: 'r1', eventId: 'ev1', title: 'Copa Campestre Sub 11', eventDate: '2026-10-18', childName: 'Sofía', status: 'approved', paymentStatus: 'verified', liveUrl: '/torneo/copa-campestre/en-vivo' }],
      open: [{ eventId: 'ev2', title: 'Torneo de vacaciones Sub 8', eventDate: '2026-12-14', schoolName: null, childId: 'c2', childName: 'Tomás', price: 60000, priceUntil: null }],
    },
  }),
}));

import ParentCalendarV2 from './ParentCalendarV2';

describe('ParentCalendarV2', () => {
  it('Próximos vacío y pestaña Torneos con inscrito (en vivo) y abierto (inscribir)', () => {
    render(<MemoryRouter><ParentCalendarV2 /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Próximos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No hay nada en las próximas dos semanas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Torneos' }));
    expect(screen.getByRole('tab', { name: 'Torneos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Copa Campestre Sub 11')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver partidos y tabla en vivo/ })).toHaveAttribute('href', '/torneo/copa-campestre/en-vivo');
    const inscribir = screen.getByRole('link', { name: /Inscribir a Tomás/ });
    expect(inscribir).toHaveAttribute('href', '/tournaments/ev2/register');
    expect(inscribir.textContent).toMatch(/60\.000/);
    expect(screen.getByText('Cuando la escuela inscribe al equipo, el torneo aparece aquí solo.')).toBeInTheDocument();
  });
});
