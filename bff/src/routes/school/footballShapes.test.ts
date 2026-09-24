/**
 * validateArrows: la única validación de las figuras de la pizarra táctica
 * (jsonb `arrows` de alineaciones y team_tactical_presets). No hay constraint
 * SQL equivalente: lo que pase por acá se guarda y el frontend lo dibuja.
 *
 * Compat que se vigila: una flecha guardada antes de curva/zona/material no
 * trae `type`, `size`, `rot` ni `kind`, y tiene que seguir siendo válida.
 * Los campos nuevos son opcionales: ausentes = válidos; presentes = con sentido.
 *
 * Cero Express y cero base: la función vive en footballShapes.ts justamente
 * para importarla sin cargar el router ni el cliente de Supabase.
 */

import { describe, expect, it } from 'vitest';
import {
  validateArrows,
  VALID_SHAPE_TYPES,
  VALID_ARROW_COLORS,
  VALID_BALL_PATH_KINDS,
  SHAPE_SIZE_MIN,
  SHAPE_SIZE_MAX,
} from './footballShapes';

/** Flecha vieja mínima (sin type ni color): la forma que hay guardada desde
 *  antes de que existieran curva/zona/material. */
const base = { x1: 10, y1: 20, x2: 30, y2: 40 };

describe('validateArrows — compat con figuras viejas', () => {
  it('lista vacía → sin errores', () => {
    expect(validateArrows([])).toEqual([]);
  });

  it('figura vieja {x1,y1,x2,y2} sin type ni color → válida', () => {
    expect(validateArrows([base])).toEqual([]);
  });

  it("flecha explícita type 'arrow' color 'white' → válida", () => {
    expect(validateArrows([{ ...base, type: 'arrow', color: 'white' }])).toEqual([]);
  });
});

describe('validateArrows — type', () => {
  it.each([...VALID_SHAPE_TYPES])("acepta type '%s'", (type) => {
    expect(validateArrows([{ ...base, type }])).toEqual([]);
  });

  it("rechaza type 'triangulo' con un solo error que menciona type", () => {
    const errs = validateArrows([{ ...base, type: 'triangulo' }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/type/);
    expect(errs[0]).toContain('triangulo');
  });
});

describe('validateArrows — color', () => {
  it('la paleta tiene 9 colores', () => {
    expect(VALID_ARROW_COLORS).toHaveLength(9);
  });

  it.each([...VALID_ARROW_COLORS])("acepta color '%s'", (color) => {
    expect(validateArrows([{ ...base, color }])).toEqual([]);
  });

  it("rechaza color 'magenta'", () => {
    const errs = validateArrows([{ ...base, color: 'magenta' }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/color/);
  });
});

describe('validateArrows — size', () => {
  it('size ausente → válido', () => {
    expect(validateArrows([{ ...base, type: 'cone' }])).toEqual([]);
  });

  it.each([0.5, 1, 3, SHAPE_SIZE_MIN, SHAPE_SIZE_MAX])('acepta size %s', (size) => {
    expect(validateArrows([{ ...base, type: 'cone', size }])).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['0', 0],
    ['-1', -1],
    ['5', 5],
    ['"2" (string)', '2'],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('rechaza size %s', (_etiqueta, size) => {
    const errs = validateArrows([{ ...base, type: 'cone', size }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/size/);
  });
});

describe('validateArrows — rot', () => {
  it.each([0, 90, 359.5, -45])('acepta rot %s', (rot) => {
    expect(validateArrows([{ ...base, type: 'goal', rot }])).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['"90" (string)', '90'],
    ['NaN', NaN],
  ])('rechaza rot %s', (_etiqueta, rot) => {
    const errs = validateArrows([{ ...base, type: 'goal', rot }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/rot/);
  });
});

describe('validateArrows — kind (recorrido del balón)', () => {
  it('los kinds válidos son pase, remate y penal', () => {
    expect([...VALID_BALL_PATH_KINDS]).toEqual(['pase', 'remate', 'penal']);
  });

  it.each([...VALID_BALL_PATH_KINDS])("acepta kind '%s'", (kind) => {
    expect(validateArrows([{ ...base, type: 'ball_path', kind }])).toEqual([]);
  });

  it("rechaza kind 'centro'", () => {
    const errs = validateArrows([{ ...base, type: 'ball_path', kind: 'centro' }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/kind/);
  });
});

describe('validateArrows — coordenadas', () => {
  it.each(['x1', 'y1', 'x2', 'y2'] as const)('acepta %s en los bordes 0 y 100', (key) => {
    expect(validateArrows([{ ...base, [key]: 0 }])).toEqual([]);
    expect(validateArrows([{ ...base, [key]: 100 }])).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['-1 (por debajo)', -1],
    ['101 (por encima)', 101],
    ['"50" (string)', '50'],
    ['null', null],
    ['undefined (falta la clave)', undefined],
  ])('rechaza %s en cada clave, con un error que la nombra', (_etiqueta, valor) => {
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) {
      const errs = validateArrows([{ ...base, [key]: valor }]);
      expect(errs).toHaveLength(1);
      expect(errs[0]).toMatch(new RegExp(`^${key} `));
    }
  });

  it('una figura con las cuatro coordenadas malas produce un error por cada clave', () => {
    const errs = validateArrows([{ x1: -1, y1: 101, x2: '50', y2: null }]);
    expect(errs).toHaveLength(4);
    expect(errs.map((e) => e.split(' ')[0])).toEqual(['x1', 'y1', 'x2', 'y2']);
  });

  it('los errores de varias figuras se acumulan', () => {
    const errs = validateArrows([
      { ...base, type: 'triangulo' },
      base,
      { ...base, color: 'magenta' },
    ]);
    expect(errs).toHaveLength(2);
  });
});
