import { describe, expect, it } from 'vitest';
import { branchShortLabel, needsStackedLayout } from './branchLabel';

describe('branchShortLabel', () => {
  it('quita el prefijo «Sede »', () => {
    expect(branchShortLabel('Sede Suba')).toBe('Suba');
    expect(branchShortLabel('sede   Norte ')).toBe('Norte');
  });
  it('conserva nombres sin prefijo y el caso límite «Sede»', () => {
    expect(branchShortLabel('Principal')).toBe('Principal');
    expect(branchShortLabel('Sede')).toBe('Sede');
  });
});

describe('needsStackedLayout', () => {
  it('Todas / Suba / Norte caben en segmentos', () => {
    expect(needsStackedLayout(['Todas', 'Suba', 'Norte'])).toBe(false);
  });
  it('un nombre largo pasa a lista vertical', () => {
    expect(needsStackedLayout(['Todas', 'Suba', 'Centro comercial Andino'])).toBe(true);
  });
});
