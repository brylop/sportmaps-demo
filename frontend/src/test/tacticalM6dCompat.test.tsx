/**
 * M6d — retrocompatibilidad: una jugada guardada ANTES de los estilos de línea,
 * las zonas nuevas, el foco, la numeración y el diálogo «Campo» se dibuja
 * EXACTAMENTE igual (mismo SVG, byte a byte). La línea base se generó con el
 * código de c88f43a3 (antes de M6d), ver fixtures/m6dOldPlays.tsx.
 */
import { describe, it, expect } from 'vitest';
import baseline from './fixtures/m6dOldPlays.baseline.json';
import { renderOldPlays } from './fixtures/m6dOldPlays';

describe('M6d — las jugadas viejas se ven igual (línea base previa a M6d)', () => {
  const now = renderOldPlays();
  it.each(Object.keys(baseline as Record<string, string>))('%s', (name) => {
    expect(now[name]).toBe((baseline as Record<string, string>)[name]);
  });
  it('la línea base cubre todos los casos', () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(baseline).sort());
  });
});
