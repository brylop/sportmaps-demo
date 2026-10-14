/**
 * Pizarra táctica: piezas que estaban desconectadas (docs/specs/pizarra-nivel-tacticalpad.md).
 *  - T4: el deporte del equipo manda la cancha (fútbol 11 por defecto, sin regresión).
 *  - T0: la métrica de uso (RPC log_tactical_board_event) se dispara UNA vez por acción;
 *        la apertura una sola vez aunque StrictMode monte dos veces.
 *  - Línea de tiempo: reordenar cuadros (◀ ▶ y arrastrar) entra al deshacer/rehacer.
 * Sin red: hooks de datos simulados y supabase.rpc espiado.
 */
import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { LineupDetail } from '@/lib/school/footballQueries';
import type { TacticalSport } from '@/lib/school/tacticalSports';

// La pizarra entera tarda en montar en jsdom (~1-2 s por render, más con la
// máquina cargada): el tope por defecto de 5 s daba falsos rojos.
vi.setConfig({ testTimeout: 30_000 });

const h = vi.hoisted(() => ({
  lineup: null as unknown,
  save: vi.fn(),
  rpc: vi.fn(),
  team: { sport: 'futbol', schoolId: 'school-1', isLoading: false } as { sport: string; schoolId: string | null; isLoading: boolean },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => h.rpc(...a) },
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
vi.mock('@/hooks/useTeamTacticalSport', () => ({ useTeamTacticalSport: () => h.team }));
vi.mock('@/hooks/useSchoolContext', () => ({ useSchoolContext: () => ({ currentUserRole: 'coach', schoolId: 'active-school' }) }));
vi.mock('@/hooks/useUnsavedChanges', () => ({ useUnsavedChanges: () => undefined }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));

import { TacticalBoard } from '@/components/school/TacticalBoard';
import { TacticalTimeline, type TacticalTimelineProps } from '@/components/school/TacticalTimeline';
import { createPlaybackClock } from '@/lib/school/tacticalAnimation';

const baseLineup = (over: Partial<LineupDetail> = {}): LineupDetail => ({
  id: 'L1', team_id: 't1', source_type: 'training_session', source_id: 's1', formation: null,
  arrows: [], created_by: 'u', created_at: '', updated_at: '',
  players: [
    { id: 'p1', subject_type: 'child', subject_id: 'a', role: 'starter', slot_label: 'Arquero', x: 50, y: 90, jersey_number: 1 },
    { id: 'p2', subject_type: 'child', subject_id: 'b', role: 'starter', slot_label: 'Delantero', x: 50, y: 20, jersey_number: 9 },
  ],
  ...over,
});

const threeFrames = () => baseLineup({
  frames: [
    { id: 'f1', duration_ms: 1000, players: [{ key: 'child:a', x: 50, y: 90 }], ball: null, arrows: [] },
    { id: 'f2', duration_ms: 1500, players: [{ key: 'child:a', x: 40, y: 70 }], ball: null, arrows: [] },
    { id: 'f3', duration_ms: 2500, players: [{ key: 'child:a', x: 30, y: 50 }], ball: null, arrows: [] },
  ],
});

type BoardProps = { sport?: TacticalSport | null; mode?: 'edit' | 'view' };
const board = ({ sport, mode = 'edit' }: BoardProps = {}) => (
  <TacticalBoard open onClose={vi.fn()} teamId="t1" teamName="Sub 11" sourceType="training_session"
    sourceId="s1" contextLabel="Entrenamiento" mode={mode} sport={sport} />
);

const thumbs = () => screen.queryAllByRole('listitem', { name: /^Cuadro \d+$/ });
const events = () => h.rpc.mock.calls
  .filter((c) => c[0] === 'log_tactical_board_event')
  .map((c) => (c[1] as { p_event: string }).p_event);
const ctrl = (key: string, shift = false) => act(() => {
  fireEvent.keyDown(window, { key, ctrlKey: true, shiftKey: shift });
});

beforeEach(() => {
  h.lineup = baseLineup();
  h.save = vi.fn().mockResolvedValue({});
  h.rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  h.team = { sport: 'futbol', schoolId: 'school-1', isLoading: false };
});

// ─── T4 ─────────────────────────────────────────────────────────────────────

describe('TacticalBoard — deporte del equipo (T4)', () => {
  it('sin deporte reconocible: la cancha de fútbol 11 de siempre', () => {
    render(board());
    expect(document.querySelector('#pitch-glow')).not.toBeNull();
    expect(document.querySelector('[data-court]')).toBeNull();
  });

  it('equipo de voleibol: dibuja la cancha de voleibol, no la de fútbol', () => {
    h.team = { sport: 'voleibol', schoolId: 'school-1', isLoading: false };
    render(board());
    expect(document.querySelector('[data-court="voleibol"]')).not.toBeNull();
    expect(document.querySelector('#pitch-glow')).toBeNull();
  });

  it('el deporte que pasa quien abre manda sobre el del equipo', () => {
    h.team = { sport: 'voleibol', schoolId: 'school-1', isLoading: false };
    render(board({ sport: 'baloncesto' }));
    expect(document.querySelector('[data-court="baloncesto"]')).not.toBeNull();
  });

  it('mientras se resuelve el deporte no se dibuja ninguna cancha (no parpadea fútbol)', () => {
    h.team = { sport: 'futbol', schoolId: null, isLoading: true };
    render(board());
    expect(document.querySelector('#pitch-glow')).toBeNull();
    expect(document.querySelector('[data-court]')).toBeNull();
  });

  it('la paleta de material es la del deporte (voleibol sin arcos)', () => {
    h.team = { sport: 'voleibol', schoolId: 'school-1', isLoading: false };
    render(board());
    fireEvent.click(screen.getByTitle(/^Material de entrenamiento/));
    // Texto exacto (las consultas por rol sobre la pizarra entera son lentas).
    expect(screen.getAllByText('Cono').length).toBeGreaterThan(0);
    expect(screen.queryByText('Arco')).toBeNull();
    expect(screen.queryByText('Arco chico')).toBeNull();
  }, 20_000);
});

// ─── T0 ─────────────────────────────────────────────────────────────────────

describe('TacticalBoard — métrica de uso (T0)', () => {
  it('«open» una sola vez por apertura, también con el doble montaje de StrictMode', () => {
    const { rerender } = render(<StrictMode>{board()}</StrictMode>);
    rerender(<StrictMode>{board()}</StrictMode>);
    expect(events()).toEqual(['open']);
    expect(h.rpc).toHaveBeenCalledWith('log_tactical_board_event', {
      p_school_id: 'school-1', p_event: 'open', p_team_id: 't1', p_source_type: 'training_session', p_sport: 'futbol',
    });
  });

  it('manda el deporte resuelto y la escuela del equipo', () => {
    h.team = { sport: 'futsal', schoolId: 'school-team', isLoading: false };
    render(board());
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_school_id: 'school-team', p_sport: 'futsal' });
  });

  it('sin escuela del equipo usa la escuela activa', () => {
    h.team = { sport: 'futbol', schoolId: null, isLoading: false };
    render(board());
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_school_id: 'active-school' });
  });

  it('no registra «open» hasta terminar de cargar', () => {
    h.team = { sport: 'futbol', schoolId: 'school-1', isLoading: true };
    const { rerender } = render(board());
    expect(events()).toEqual([]);
    h.team = { sport: 'futbol', schoolId: 'school-1', isLoading: false };
    rerender(board());
    expect(events()).toEqual(['open']);
  });

  it('«+ Cuadro» → frame_add, ▶ → play, Guardar → save: uno por acción', async () => {
    render(<StrictMode>{board()}</StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    expect(events()).toEqual(['open', 'frame_add']);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir cuadros' }));
    expect(events()).toEqual(['open', 'frame_add', 'play']);
    // Pausa y seguir no es otra reproducción.
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir cuadros' }));
    expect(events().filter((e) => e === 'play')).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' })); });
    expect(events()).toEqual(['open', 'frame_add', 'play', 'save']);
  });

  it('un guardado que falla no cuenta', async () => {
    h.save = vi.fn().mockRejectedValue(new Error('500'));
    render(board());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Guardar jugada' })); });
    expect(events()).toEqual(['open']);
  });

  it('el menú Exportar queda en la pizarra (en editar y en ver)', () => {
    const { unmount } = render(board());
    expect(screen.getByRole('button', { name: 'Exportar la jugada' })).toBeTruthy();
    unmount();
    render(board({ mode: 'view' }));
    expect(screen.getByRole('button', { name: 'Exportar la jugada' })).toBeTruthy();
  });

  it('la RPC caída no rompe la pizarra', () => {
    h.rpc = vi.fn().mockRejectedValue(new Error('offline'));
    render(board());
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    expect(thumbs()).toHaveLength(2);
  });
});

// ─── Reordenar cuadros ──────────────────────────────────────────────────────

describe('TacticalBoard — reordenar cuadros + deshacer', () => {
  const titleOf = (i: number) => thumbs()[i].getAttribute('title') ?? '';

  it('◀ mueve el cuadro abierto, queda abierto, y Ctrl+Z / Ctrl+Y lo deshacen y rehacen', () => {
    h.lineup = threeFrames();
    render(board());
    fireEvent.click(thumbs()[2]);
    expect(screen.getByText('Cuadro 3 de 3')).toBeTruthy();
    expect(titleOf(1)).toContain('1,5 s');

    fireEvent.click(screen.getByRole('button', { name: 'Mover el cuadro a la izquierda' }));
    expect(screen.getByText('Cuadro 2 de 3')).toBeTruthy();
    expect(titleOf(1)).toContain('2,5 s');
    expect(titleOf(2)).toContain('1,5 s');
    expect(thumbs()[1].getAttribute('aria-current')).toBe('true');

    ctrl('z');
    expect(titleOf(1)).toContain('1,5 s');
    expect(titleOf(2)).toContain('2,5 s');
    ctrl('y');
    expect(titleOf(1)).toContain('2,5 s');
  });

  it('arrastrar el cuadro 3 sobre el 1 lo pone primero y entra al historial', () => {
    h.lineup = threeFrames();
    render(board());
    const store: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => { store[k] = v; },
      getData: (k: string) => store[k] ?? '',
      effectAllowed: 'all', dropEffect: 'none',
    };
    fireEvent.dragStart(thumbs()[2], { dataTransfer });
    fireEvent.dragOver(thumbs()[0], { dataTransfer });
    fireEvent.drop(thumbs()[0], { dataTransfer });
    // El viejo cuadro 1 (posición inicial) pasó a ser el 2: ahora muestra su duración.
    expect(titleOf(1)).toContain('1 s');
    expect(titleOf(2)).toContain('1,5 s');
    ctrl('z');
    expect(titleOf(1)).toContain('1,5 s');
    expect(titleOf(2)).toContain('2,5 s');
  });
});

describe('TacticalTimeline — arrastrar para reordenar', () => {
  const frames = [
    { id: 'a', duration_ms: 1000, players: [], ball: null, arrows: [] },
    { id: 'b', duration_ms: 1000, players: [], ball: null, arrows: [] },
    { id: 'c', duration_ms: 1000, players: [], ball: null, arrows: [] },
  ];
  const props = (over: Partial<TacticalTimelineProps> = {}): TacticalTimelineProps => ({
    mode: 'edit', frames, currentIndex: 0, playState: 'stopped', clock: createPlaybackClock(), totalMs: 2000,
    speed: 1, loop: false, onPlayPause: vi.fn(), onSpeedChange: vi.fn(), onLoopChange: vi.fn(),
    onSelect: vi.fn(), onAdd: vi.fn(), onDelete: vi.fn(), onMove: vi.fn(), onDurationChange: vi.fn(),
    ...over,
  });
  const dt = () => {
    const store: Record<string, string> = {};
    return { setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? '', effectAllowed: 'all', dropEffect: 'none' };
  };

  it('soltar sobre otro cuadro llama onMove(origen, destino) y marca el destino mientras pasa', () => {
    const p = props();
    render(<TacticalTimeline {...p} />);
    const items = screen.getAllByRole('listitem');
    const d = dt();
    fireEvent.dragStart(items[0], { dataTransfer: d });
    fireEvent.dragOver(items[2], { dataTransfer: d });
    expect(items[2].getAttribute('data-drop-target')).toBe('true');
    fireEvent.drop(items[2], { dataTransfer: d });
    expect(p.onMove).toHaveBeenCalledWith(0, 2);
    expect(items[2].getAttribute('data-drop-target')).toBeNull();
  });

  it('ignora lo que no es un cuadro de esta línea de tiempo y no reordena mientras reproduce', () => {
    const p = props();
    const { rerender } = render(<TacticalTimeline {...p} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.drop(items[1], { dataTransfer: dt() }); // archivo/texto de afuera
    expect(p.onMove).not.toHaveBeenCalled();

    rerender(<TacticalTimeline {...p} playState="playing" />);
    const d = dt();
    fireEvent.dragStart(items[0], { dataTransfer: d });
    fireEvent.drop(items[1], { dataTransfer: d });
    expect(p.onMove).not.toHaveBeenCalled();
  });

  it('◀ ▶ de 44 px para celular (h-11 / min-w-11)', () => {
    render(<TacticalTimeline {...props({ currentIndex: 1 })} />);
    for (const name of ['Mover el cuadro a la izquierda', 'Mover el cuadro a la derecha']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.className).toContain('h-11');
      expect(btn.className).toContain('min-w-11');
    }
  });
});
