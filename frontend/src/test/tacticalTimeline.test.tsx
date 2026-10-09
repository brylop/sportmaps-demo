/**
 * Línea de tiempo de la jugada animada (src/components/school/TacticalTimeline.tsx).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TacticalTimeline, TacticalFramePlayback, type TacticalTimelineProps } from '@/components/school/TacticalTimeline';
import { createPlaybackClock } from '@/lib/school/tacticalAnimation';
import { FULL_VIEW } from '@/lib/school/tacticalGeometry';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

const fr = (id: string, x: number, duration_ms = 1000): TacticalFrame => ({
  id, duration_ms, players: [{ key: 'athlete:1', x, y: 50 }], ball: null, arrows: [],
});

function setup(over: Partial<TacticalTimelineProps> = {}) {
  const props: TacticalTimelineProps = {
    mode: 'edit',
    frames: [fr('a', 10), fr('b', 50), fr('c', 90)],
    currentIndex: 1,
    playState: 'stopped',
    clock: createPlaybackClock(),
    totalMs: 2000,
    speed: 1,
    loop: false,
    onPlayPause: vi.fn(),
    onSeek: vi.fn(),
    onSpeedChange: vi.fn(),
    onLoopChange: vi.fn(),
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onDurationChange: vi.fn(),
    ...over,
  };
  render(<TacticalTimeline {...props} />);
  return props;
}

describe('TacticalTimeline — edición', () => {
  it('un botón numerado por cuadro; el abierto marcado', () => {
    setup();
    expect(screen.getByRole('listitem', { name: 'Cuadro 1' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Cuadro 2' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Cuadro 2 de 3')).toBeTruthy();
  });

  it('tocar un cuadro lo abre; + Cuadro, ←/→, quitar y tiempo llaman a su acción', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('listitem', { name: 'Cuadro 3' }));
    expect(p.onSelect).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: /Cuadro$/ }));
    expect(p.onAdd).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mover el cuadro a la izquierda' }));
    expect(p.onMove).toHaveBeenCalledWith(1, 0);
    fireEvent.click(screen.getByRole('button', { name: 'Mover el cuadro a la derecha' }));
    expect(p.onMove).toHaveBeenCalledWith(1, 2);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar este cuadro' }));
    expect(p.onDelete).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Tiempo para llegar a este cuadro' }), { target: { value: '2000' } });
    expect(p.onDurationChange).toHaveBeenCalledWith(1, 2000);
  });

  it('velocidad y Repetir', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: '2×' }));
    expect(p.onSpeedChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: /Repetir/ }));
    expect(p.onLoopChange).toHaveBeenCalledWith(true);
  });

  it('el cuadro 1 no tiene tiempo (no hay desde dónde llegar)', () => {
    setup({ currentIndex: 0 });
    expect(screen.queryByRole('combobox', { name: 'Tiempo para llegar a este cuadro' })).toBeNull();
  });

  it('con un solo cuadro: Reproducir deshabilitado y se explica cómo animar', () => {
    setup({ frames: [fr('a', 10)], currentIndex: 0, totalMs: 0 });
    expect((screen.getByRole('button', { name: 'Reproducir cuadros' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Agrega cuadros/)).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('reproduciendo: botón Pausa y la edición bloqueada', () => {
    setup({ playState: 'playing' });
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Cuadro$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Quitar este cuadro' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TacticalTimeline — modo ver', () => {
  it('con un cuadro no muestra nada', () => {
    const { container } = render(
      <TacticalTimeline mode="view" frames={[fr('a', 1)]} currentIndex={0} playState="stopped" clock={createPlaybackClock()}
        totalMs={0} speed={1} loop={false} onPlayPause={vi.fn()} onSpeedChange={vi.fn()} onLoopChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('con cuadros: solo ▶ y la barra de progreso, que sigue al reloj', () => {
    const clock = createPlaybackClock();
    render(
      <TacticalTimeline mode="view" frames={[fr('a', 1), fr('b', 2)]} currentIndex={0} playState="stopped" clock={clock}
        totalMs={1000} speed={1} loop={false} onPlayPause={vi.fn()} onSpeedChange={vi.fn()} onLoopChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Reproducir cuadros' })).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    act(() => clock.set(250));
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
  });
});

describe('TacticalFramePlayback', () => {
  it('dibuja a cada jugador en la posición interpolada del reloj', () => {
    const clock = createPlaybackClock();
    const renderPlayer = vi.fn((p: { key: string; x: number }) => <span key={p.key} data-testid="pin" data-x={p.x.toFixed(1)} />);
    render(
      <TacticalFramePlayback frames={[fr('a', 10), fr('b', 50)]} clock={clock} view={FULL_VIEW}
        renderPlayer={renderPlayer} renderShapes={() => null} />,
    );
    expect(screen.getByTestId('pin').getAttribute('data-x')).toBe('10.0');
    act(() => clock.set(500));
    expect(screen.getByTestId('pin').getAttribute('data-x')).toBe('30.0');
    act(() => clock.set(1000));
    expect(screen.getByTestId('pin').getAttribute('data-x')).toBe('50.0');
  });
});
