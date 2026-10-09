/**
 * Pizarra táctica con animación por cuadros (T1): integración del tablero con
 * los cuadros, sin red (hooks de datos simulados). Cubre lo que no se ve en las
 * pruebas puras: que «+ Cuadro» copie el cuadro abierto, que guardar mande el
 * cuadro 1 a las columnas de siempre y la animación en `frames`, que una
 * jugada guardada con cuadros vuelva a abrir igual, el rastro fantasma y
 * deshacer/rehacer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { LineupDetail } from '@/lib/school/footballQueries';

const h = vi.hoisted(() => ({
  lineup: null as unknown,
  role: 'coach',
  save: vi.fn(),
}));

vi.mock('@/hooks/useFootballData', () => ({
  useFootballLineups: () => ({ data: h.lineup ? [{ id: 'L1' }] : [], isLoading: false }),
  useFootballLineup: () => ({ data: h.lineup ?? undefined, isLoading: false }),
  useSaveFootballLineup: () => ({ mutateAsync: h.save, isPending: false }),
  useTacticalPresets: () => ({ data: [] }),
  useCreateTacticalPreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTacticalPreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTacticalPreset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFootballEvents: () => ({ data: [] }),
  useFootballSeasonStats: () => ({ data: { team_id: 't1', stats: [] } }),
}));
vi.mock('@/hooks/usePerformanceData', () => ({
  useTeamPerformanceRoster: () => ({
    data: {
      sport_category_id: null, metrics: [], latest_values: {},
      subjects: [
        { subject_type: 'child', subject_id: 'a', full_name: 'Ana Pérez' },
        { subject_type: 'child', subject_id: 'b', full_name: 'Beto Ruiz' },
      ],
    },
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useSchoolContext', () => ({ useSchoolContext: () => ({ currentUserRole: h.role }) }));
vi.mock('@/hooks/useUnsavedChanges', () => ({ useUnsavedChanges: () => undefined }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { TacticalBoard } from '@/components/school/TacticalBoard';

const baseLineup = (over: Partial<LineupDetail> = {}): LineupDetail => ({
  id: 'L1', team_id: 't1', source_type: 'training_session', source_id: 's1', formation: null,
  arrows: [], created_by: 'u', created_at: '', updated_at: '',
  players: [
    { id: 'p1', subject_type: 'child', subject_id: 'a', role: 'starter', slot_label: 'Arquero', x: 50, y: 90, jersey_number: 1 },
    { id: 'p2', subject_type: 'child', subject_id: 'b', role: 'starter', slot_label: 'Delantero', x: 50, y: 20, jersey_number: 9 },
  ],
  ...over,
});

function renderBoard(mode: 'edit' | 'view' = 'edit') {
  return render(
    <TacticalBoard open onClose={vi.fn()} teamId="t1" teamName="Sub 11" sourceType="training_session"
      sourceId="s1" contextLabel="Entrenamiento" mode={mode} />,
  );
}

const thumbs = () => screen.queryAllByRole('listitem', { name: /^Cuadro \d+$/ });
const ctrl = (key: string, shift = false) => act(() => {
  fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey: shift });
});

beforeEach(() => {
  h.lineup = baseLineup();
  h.role = 'coach';
  h.save = vi.fn().mockResolvedValue({});
});

describe('TacticalBoard — cuadros', () => {
  it('una jugada vieja (sin frames) abre como un solo cuadro', () => {
    renderBoard();
    expect(thumbs()).toHaveLength(1);
    expect(screen.getByText(/Agrega cuadros/)).toBeTruthy();
  });

  it('«+ Cuadro» copia el cuadro abierto y lo abre', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    expect(thumbs()).toHaveLength(2);
    expect(screen.getByText('Cuadro 2 de 2')).toBeTruthy();
    expect(thumbs()[1].getAttribute('aria-current')).toBe('true');
  });

  it('guardar con un solo cuadro manda frames: null y las columnas de siempre', async () => {
    renderBoard();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' })); });
    expect(h.save).toHaveBeenCalledTimes(1);
    const payload = h.save.mock.calls[0][0];
    expect(payload.frames).toBeNull();
    expect(payload.players.filter((p: { role: string }) => p.role === 'starter')).toHaveLength(2);
  });

  it('guardar con cuadros manda la animación y el cuadro 1 en players/arrows', async () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' })); });
    const payload = h.save.mock.calls[0][0];
    expect(payload.frames).toHaveLength(2);
    expect(payload.frames[0].players).toEqual(expect.arrayContaining([
      { key: 'child:a', x: 50, y: 90 }, { key: 'child:b', x: 50, y: 20 },
    ]));
    const ana = payload.players.find((p: { subject_id: string }) => p.subject_id === 'a');
    expect(ana).toMatchObject({ role: 'starter', x: 50, y: 90, slot_label: 'Arquero', jersey_number: 1 });
  });

  it('una jugada guardada con cuadros vuelve a abrir con sus cuadros; en el cuadro 2 se ve el rastro', async () => {
    h.lineup = baseLineup({
      frames: [
        { id: 'f1', duration_ms: 1000, players: [{ key: 'child:a', x: 50, y: 90 }, { key: 'child:b', x: 50, y: 20 }], ball: null, arrows: [] },
        { id: 'f2', duration_ms: 1500, players: [{ key: 'child:a', x: 50, y: 90 }, { key: 'child:b', x: 80, y: 10 }], ball: { x: 40, y: 40 }, arrows: [] },
      ],
    });
    renderBoard();
    expect(thumbs()).toHaveLength(2);
    expect(document.querySelector('line[stroke-dasharray="3 3"]')).toBeNull();
    fireEvent.click(thumbs()[1]);
    expect(screen.getByText('Cuadro 2 de 2')).toBeTruthy();
    // Beto se movió entre el cuadro 1 y el 2: una línea fantasma; Ana no.
    expect(document.querySelectorAll('line[stroke-dasharray="3 3"]')).toHaveLength(1);
    // El balón del cuadro quedó como figura movible (la cuenta de Dibujar).
    expect(screen.getByRole('button', { name: 'Dibujar (1)' })).toBeTruthy();

    // Guardar parado en el cuadro 2: a players va el cuadro 1.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' })); });
    const payload = h.save.mock.calls[0][0];
    const beto = payload.players.find((p: { subject_id: string }) => p.subject_id === 'b');
    expect(beto).toMatchObject({ x: 50, y: 20, slot_label: 'Delantero' });
    expect(payload.arrows).toEqual([]);
    expect(payload.frames[1].players).toEqual(expect.arrayContaining([{ key: 'child:b', x: 80, y: 10 }]));
    expect(payload.frames[1].arrows).toEqual([{ type: 'ball', x1: 40, y1: 40, x2: 40, y2: 40 }]);
    expect(payload.frames[1].duration_ms).toBe(1500);
  });

  it('deshacer y rehacer (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    expect(thumbs()).toHaveLength(2);
    ctrl('z');
    expect(thumbs()).toHaveLength(1);
    ctrl('z', true);
    expect(thumbs()).toHaveLength(2);
    ctrl('z');
    expect(thumbs()).toHaveLength(1);
    ctrl('y');
    expect(thumbs()).toHaveLength(2);
  });

  it('quitar el cuadro abierto vuelve al anterior', () => {
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar este cuadro' }));
    expect(thumbs()).toHaveLength(1);
  });

  it('modo ver con cuadros: solo ▶ y la barra, sin miniaturas ni edición', () => {
    h.lineup = baseLineup({
      frames: [
        { id: 'f1', duration_ms: 1000, players: [{ key: 'child:a', x: 50, y: 90 }], ball: null, arrows: [] },
        { id: 'f2', duration_ms: 1000, players: [{ key: 'child:a', x: 30, y: 60 }], ball: null, arrows: [] },
      ],
    });
    renderBoard('view');
    expect(screen.getByRole('button', { name: 'Reproducir cuadros' })).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(thumbs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Guardar jugada' })).toBeNull();
  });
});
