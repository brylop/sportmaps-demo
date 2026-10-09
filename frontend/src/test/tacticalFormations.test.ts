/**
 * Formaciones fijas de la pizarra (src/lib/school/tacticalFormations.ts, F2 de
 * docs/specs/rediseno-seguimiento-deportivo.md): la cancha que arranca llena.
 */
import { describe, it, expect } from 'vitest';
import {
  FORMATIONS, formationByKey, defaultFormationFor, placeInFormation,
  sortRosterForFormation, formationAsPresetSlots,
} from '@/lib/school/tacticalFormations';
import { suggestLabel } from '@/lib/school/footballDisplay';

describe('catálogo de formaciones', () => {
  it.each(FORMATIONS.map((f) => [f.label, f] as const))('%s: tantas posiciones como jugadores, todas dentro de la cancha', (_l, f) => {
    expect(f.slots).toHaveLength(f.players);
    for (const s of f.slots) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(100);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(100);
      expect(s.label.trim()).not.toBe('');
    }
  });

  it.each(FORMATIONS.map((f) => [f.label, f] as const))('%s: un solo arquero, y es el primero (abajo, en el arco propio)', (_l, f) => {
    const gks = f.slots.filter((s) => s.label === 'Arquero');
    expect(gks).toHaveLength(1);
    expect(f.slots[0].label).toBe('Arquero');
    expect(f.slots[0].y).toBe(Math.max(...f.slots.map((s) => s.y)));
  });

  it.each(FORMATIONS.map((f) => [f.label, f] as const))('%s: dos jugadores no comparten el mismo punto', (_l, f) => {
    const keys = new Set(f.slots.map((s) => `${s.x}:${s.y}`));
    expect(keys.size).toBe(f.slots.length);
  });

  it('las líneas caen en la misma franja que suggestLabel (mover a alguien no le cambia la línea)', () => {
    const f = formationByKey('4-3-3');
    expect(suggestLabel(f.slots[0].y)).toBe('Arquero');
    const zagueros = f.slots.filter((s) => s.label === 'Central');
    for (const z of zagueros) expect(suggestLabel(z.y)).toBe('Defensa');
  });

  it('claves únicas', () => {
    expect(new Set(FORMATIONS.map((f) => f.key)).size).toBe(FORMATIONS.length);
  });
});

describe('formationByKey / defaultFormationFor', () => {
  it('encuentra por clave', () => {
    expect(formationByKey('3-5-2').key).toBe('3-5-2');
  });
  it('11 o más en el roster → 4-3-3; menos → fútbol 7', () => {
    expect(defaultFormationFor(11).key).toBe('4-3-3');
    expect(defaultFormationFor(25).key).toBe('4-3-3');
    expect(defaultFormationFor(10).key).toBe('f7-2-3-1');
    expect(defaultFormationFor(0).key).toBe('f7-2-3-1');
  });
});

describe('placeInFormation', () => {
  const f = formationByKey('4-4-2');

  it('reparte en orden: el primero al arco', () => {
    const keys = Array.from({ length: 11 }, (_, i) => `athlete:${i}`);
    const r = placeInFormation(keys, f);
    expect(Object.keys(r.placed)).toHaveLength(11);
    expect(r.placed['athlete:0']).toMatchObject({ x: f.slots[0].x, y: f.slots[0].y, slot_label: 'Arquero', labelIsCustom: false, jersey_number: '' });
    expect(r.emptySlots).toEqual([]);
  });

  it('faltan jugadores → las posiciones sin nadie quedan como marcadores', () => {
    const r = placeInFormation(['a', 'b', 'c'], f);
    expect(Object.keys(r.placed)).toEqual(['a', 'b', 'c']);
    expect(r.emptySlots).toHaveLength(8);
    expect(r.emptySlots[0]).toMatchObject({ id: 'formation:4-4-2:3', slot_label: f.slots[3].label });
  });

  it('sobran jugadores → los de más no se ubican', () => {
    const keys = Array.from({ length: 15 }, (_, i) => `k${i}`);
    const r = placeInFormation(keys, f);
    expect(Object.keys(r.placed)).toHaveLength(11);
    expect(r.placed.k14).toBeUndefined();
  });

  it('cancha vacía de roster → solo marcadores', () => {
    const r = placeInFormation([], f);
    expect(r.placed).toEqual({});
    expect(r.emptySlots).toHaveLength(11);
  });
});

describe('sortRosterForFormation', () => {
  it('orden alfabético en español (tildes y ñ), sin mutar el original', () => {
    const roster = [{ full_name: 'Ñoño' }, { full_name: 'Óscar' }, { full_name: 'Nicolás' }, { full_name: 'ana' }, { full_name: 'Zoe' }];
    const sorted = sortRosterForFormation(roster).map((r) => r.full_name);
    expect(sorted).toEqual(['ana', 'Nicolás', 'Ñoño', 'Óscar', 'Zoe']);
    expect(roster[0].full_name).toBe('Ñoño');
  });
});

describe('formationAsPresetSlots', () => {
  it('mismo formato que una jugada guardada', () => {
    const f = formationByKey('f7-2-3-1');
    const slots = formationAsPresetSlots(f);
    expect(slots).toHaveLength(f.players);
    expect(slots[0]).toEqual({ slot_label: f.slots[0].label, x: f.slots[0].x, y: f.slots[0].y });
  });
});
