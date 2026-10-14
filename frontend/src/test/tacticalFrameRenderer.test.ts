import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El pintor de cuadros del video/GIF dibuja la cancha del deporte del equipo
 * (T4): con sport='voleibol' el fondo es la cancha de voleibol, no la de fútbol.
 */

const { markups } = vi.hoisted(() => ({ markups: [] as string[] }));
vi.mock('@/lib/export/tacticalExportUtils', async (orig) => ({
  ...(await orig<typeof import('@/lib/export/tacticalExportUtils')>()),
  svgMarkupToImage: async (m: string) => {
    markups.push(m);
    return {} as HTMLImageElement;
  },
}));

import { createTacticalFrameRenderer } from '@/lib/export/tacticalFrameRenderer';
import { SPORTS } from '@/lib/school/tacticalSports';
import type { TacticalFrame } from '@/lib/school/tacticalFrames';

const fr = (id: string, x: number): TacticalFrame => ({ id, duration_ms: 800, players: [{ key: 'slot:A', x, y: 50 }], ball: null, arrows: [] });

// jsdom no tiene canvas 2D: un contexto falso que acepta todo.
const fakeCtx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined : () => undefined), set: () => true });

describe('createTacticalFrameRenderer · deporte', () => {
  beforeEach(() => {
    markups.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D);
  });

  it("con sport='voleibol' el fondo es la cancha de voleibol; sin deporte, la de fútbol", async () => {
    const volley = await createTacticalFrameRenderer({ frames: [fr('a', 20), fr('b', 80)], width: 360, holdStartMs: 0, holdEndMs: 0, sport: 'voleibol' });
    const volleyMarkup = markups[0];
    markups.length = 0;
    const football = await createTacticalFrameRenderer({ frames: [fr('a', 20), fr('b', 80)], width: 360, holdStartMs: 0, holdEndMs: 0 });
    const footballMarkup = markups[0];

    const court = SPORTS.voleibol.colors.court;
    expect(volleyMarkup).toContain(court);
    expect(footballMarkup).not.toContain(court);
    expect(volleyMarkup).not.toBe(footballMarkup);
    expect(volley.length).toBe(800);
    expect(() => volley.draw(400)).not.toThrow();
    volley.dispose();
    football.dispose();
    expect(volley.canvas.width).toBe(0);
  });
});
