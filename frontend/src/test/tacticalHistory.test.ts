/**
 * Deshacer/rehacer de la pizarra (lib/school/tacticalHistory.ts) con el
 * reorden de cuadros (moveFrame): reordenar es un paso que se deshace.
 */
import { describe, it, expect } from 'vitest';
import { emptyHistory, historyCommit, historyRedo, historySetBase, historyUndo, HISTORY_CAP } from '@/lib/school/tacticalHistory';
import { moveFrame } from '@/lib/school/tacticalAnimation';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

const f = (id: string): TacticalFrame => ({ id, duration_ms: 1000, players: [], ball: null, arrows: [] });
interface Snap { frames: TacticalFrame[]; frameIndex: number }
const key = (s: Snap) => JSON.stringify([s.frames.map((x) => x.id), s.frameIndex]);
const ids = (s: Snap | null) => s?.frames.map((x) => x.id);

describe('historial + reordenar cuadros', () => {
  it('reordenar entra al historial: deshacer y rehacer devuelven el orden', () => {
    const h = emptyHistory<Snap>();
    const start: Snap = { frames: [f('a'), f('b'), f('c')], frameIndex: 2 };
    historySetBase(h, start, key(start));

    const moved: Snap = { frames: moveFrame(start.frames, 2, 0), frameIndex: 0 };
    expect(ids(moved)).toEqual(['c', 'a', 'b']);
    expect(historyCommit(h, moved, key(moved))).toBe(true);

    const back = historyUndo(h, key);
    expect(ids(back)).toEqual(['a', 'b', 'c']);
    expect(back?.frameIndex).toBe(2);

    const again = historyRedo(h, key);
    expect(ids(again)).toEqual(['c', 'a', 'b']);
    expect(historyRedo(h, key)).toBeNull();
  });

  it('mover un cuadro a su mismo lugar no es un paso', () => {
    const h = emptyHistory<Snap>();
    const start: Snap = { frames: [f('a'), f('b')], frameIndex: 0 };
    historySetBase(h, start, key(start));
    const same: Snap = { frames: moveFrame(start.frames, 1, 1), frameIndex: 0 };
    expect(same.frames).toBe(start.frames);
    expect(historyCommit(h, same, key(same))).toBe(false);
    expect(historyUndo(h, key)).toBeNull();
  });

  it('un cambio nuevo después de deshacer borra el rehacer', () => {
    const h = emptyHistory<Snap>();
    const s0: Snap = { frames: [f('a'), f('b'), f('c')], frameIndex: 0 };
    historySetBase(h, s0, key(s0));
    const s1: Snap = { frames: moveFrame(s0.frames, 0, 1), frameIndex: 1 };
    historyCommit(h, s1, key(s1));
    historyUndo(h, key);
    const s2: Snap = { frames: moveFrame(s0.frames, 0, 2), frameIndex: 2 };
    expect(historyCommit(h, s2, key(s2))).toBe(true);
    expect(historyRedo(h, key)).toBeNull();
    expect(ids(historyUndo(h, key))).toEqual(['a', 'b', 'c']);
  });

  it('sin base no anota nada (la carga no es un paso)', () => {
    const h = emptyHistory<Snap>();
    const s: Snap = { frames: [f('a')], frameIndex: 0 };
    expect(historyCommit(h, s, key(s))).toBe(false);
    expect(historyUndo(h, key)).toBeNull();
  });

  it('respeta el tope de pasos', () => {
    const h = emptyHistory<number>();
    historySetBase(h, 0, '0');
    for (let i = 1; i <= HISTORY_CAP + 10; i++) historyCommit(h, i, String(i));
    expect(h.undo).toHaveLength(HISTORY_CAP);
    expect(h.undo[0]).toBe(10);
  });
});
