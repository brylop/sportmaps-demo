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
  sanitizeArrows,
  validatePresetSlots,
  sanitizeSlots,
  MAX_SHAPES,
  MAX_PRESET_SLOTS,
  MAX_SLOT_LABEL,
  VALID_SHAPE_TYPES,
  VALID_ARROW_COLORS,
  VALID_BALL_PATH_KINDS,
  SHAPE_SIZE_MIN,
  SHAPE_SIZE_MAX,
  FREEHAND_MAX_POINTS,
  TEXT_MAX_LENGTH,
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
  /** Lápiz y texto traen su campo obligatorio (points / text); el resto, nada extra. */
  const extraFor = (type: string) =>
    type === 'freehand' ? { points: [10, 20, 20, 30, 30, 40] } : type === 'text' ? { text: 'Presión alta' } : {};

  it.each([...VALID_SHAPE_TYPES])("acepta type '%s'", (type) => {
    expect(validateArrows([{ ...base, type, ...extraFor(type) }])).toEqual([]);
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

describe('validateArrows — lápiz libre (freehand)', () => {
  const stroke = { ...base, type: 'freehand' };

  it('un trazo de 2+ puntos dentro de la cancha → válido', () => {
    expect(validateArrows([{ ...stroke, points: [10, 20, 30, 40] }])).toEqual([]);
  });

  it.each([
    ['sin points', undefined],
    ['un solo punto', [10, 20]],
    ['cantidad impar', [10, 20, 30]],
    ['no es arreglo', 'M 10 20'],
  ])('rechaza %s', (_label, points) => {
    expect(validateArrows([{ ...stroke, points }])).toHaveLength(1);
  });

  it('rechaza una coordenada fuera de 0-100 o no numérica', () => {
    expect(validateArrows([{ ...stroke, points: [10, 20, 101, 40] }])).toHaveLength(1);
    expect(validateArrows([{ ...stroke, points: [10, 20, '30', 40] }])).toHaveLength(1);
  });

  it(`acepta hasta ${FREEHAND_MAX_POINTS} puntos y rechaza uno más`, () => {
    const pts = (n: number) => Array.from({ length: n * 2 }, (_, i) => (i % 100));
    expect(validateArrows([{ ...stroke, points: pts(FREEHAND_MAX_POINTS) }])).toEqual([]);
    expect(validateArrows([{ ...stroke, points: pts(FREEHAND_MAX_POINTS + 1) }])).toHaveLength(1);
  });

  it('points en una figura que no es trazo → error', () => {
    expect(validateArrows([{ ...base, type: 'arrow', points: [10, 20, 30, 40] }])).toHaveLength(1);
  });
});

describe('validateArrows — texto', () => {
  const label = { ...base, type: 'text' };

  it('texto corto → válido, con tamaño', () => {
    expect(validateArrows([{ ...label, text: 'Cubrir al 10', size: 1.5 }])).toEqual([]);
  });

  it.each([['ausente', undefined], ['vacío', ''], ['solo espacios', '   '], ['no string', 42]])(
    'rechaza text %s',
    (_l, text) => {
      expect(validateArrows([{ ...label, text }])).toHaveLength(1);
    },
  );

  it(`rechaza más de ${TEXT_MAX_LENGTH} caracteres`, () => {
    expect(validateArrows([{ ...label, text: 'a'.repeat(TEXT_MAX_LENGTH) }])).toEqual([]);
    expect(validateArrows([{ ...label, text: 'a'.repeat(TEXT_MAX_LENGTH + 1) }])).toHaveLength(1);
  });

  it('text en una figura que no es texto → error', () => {
    expect(validateArrows([{ ...base, type: 'cone', text: 'hola' }])).toHaveLength(1);
  });
});

describe('validateArrows — robustez ante basura (auditoría de la pizarra)', () => {
  it.each<[string, unknown]>([
    ['null', null],
    ['un número', 7],
    ['un texto', 'flecha'],
    ['una lista', [1, 2]],
  ])('un elemento %s da un error claro en vez de reventar con TypeError', (_etiqueta, basura) => {
    expect(() => validateArrows([basura as any])).not.toThrow();
    const errs = validateArrows([basura as any]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/objeto/);
  });

  it('mezcla válidos e inválidos: solo reporta los inválidos', () => {
    expect(validateArrows([base, null as any, base])).toHaveLength(1);
  });

  it(`acepta exactamente ${MAX_SHAPES} figuras y rechaza ${MAX_SHAPES + 1}`, () => {
    expect(validateArrows(Array.from({ length: MAX_SHAPES }, () => base))).toEqual([]);
    const errs = validateArrows(Array.from({ length: MAX_SHAPES + 1 }, () => base));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/demasiadas/);
  });

  it.each([-360, 360])('acepta rot en el borde del rango (%s)', (rot) => {
    expect(validateArrows([{ ...base, type: 'goal', rot }])).toEqual([]);
  });

  it.each([361, -361, 1e9])('rechaza rot fuera de ±360 (%s)', (rot) => {
    const errs = validateArrows([{ ...base, type: 'goal', rot }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/rot/);
  });
});

describe('sanitizeArrows — solo se guardan los campos conocidos', () => {
  it('descarta campos inventados y conserva los del esquema', () => {
    const [out] = sanitizeArrows([
      { ...base, type: 'cone', color: 'red', size: 2, rot: 90, basura: 'x'.repeat(1000), __proto_extra: { a: 1 } },
    ]);
    expect(out).toEqual({ x1: 10, y1: 20, x2: 30, y2: 40, type: 'cone', color: 'red', size: 2, rot: 90 });
  });

  it('una figura vieja mínima queda igual (sin agregar type/color)', () => {
    expect(sanitizeArrows([base])).toEqual([base]);
  });

  it('freehand conserva points; el resto de tipos no arrastra points', () => {
    const pts = [10, 20, 20, 30];
    expect(sanitizeArrows([{ ...base, type: 'freehand', points: pts }])[0].points).toEqual(pts);
    expect(sanitizeArrows([{ ...base, type: 'cone', points: pts }])[0]).not.toHaveProperty('points');
  });

  it('text se guarda recortado y los demás tipos no arrastran text', () => {
    expect(sanitizeArrows([{ ...base, type: 'text', text: '  Presión alta  ' }])[0].text).toBe('Presión alta');
    expect(sanitizeArrows([{ ...base, type: 'cone', text: 'x' }])[0]).not.toHaveProperty('text');
  });

  it('ball_path conserva kind', () => {
    expect(sanitizeArrows([{ ...base, type: 'ball_path', kind: 'remate' }])[0].kind).toBe('remate');
  });
});

describe('validatePresetSlots', () => {
  const slot = { slot_label: 'Medio', x: 50, y: 50 };

  it('slots válidos → sin errores', () => {
    expect(validatePresetSlots([slot, { slot_label: 'Arquero', x: 0, y: 100 }])).toEqual([]);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['un número', 3],
    ['una lista', []],
  ])('un elemento %s da un error claro en vez de reventar', (_etiqueta, basura) => {
    expect(() => validatePresetSlots([basura as any])).not.toThrow();
    expect(validatePresetSlots([basura as any])).toHaveLength(1);
  });

  it('exige slot_label no vacío', () => {
    expect(validatePresetSlots([{ ...slot, slot_label: '   ' }])).toHaveLength(1);
    expect(validatePresetSlots([{ x: 1, y: 1 }])).toHaveLength(1);
  });

  it(`rechaza slot_label de más de ${MAX_SLOT_LABEL} caracteres`, () => {
    expect(validatePresetSlots([{ ...slot, slot_label: 'a'.repeat(MAX_SLOT_LABEL) }])).toEqual([]);
    expect(validatePresetSlots([{ ...slot, slot_label: 'a'.repeat(MAX_SLOT_LABEL + 1) }])).toHaveLength(1);
  });

  it.each([-1, 101, NaN, Infinity, '50' as any])('rechaza x/y fuera de rango o no numérico (%s)', (v) => {
    expect(validatePresetSlots([{ ...slot, x: v }])).toHaveLength(1);
    expect(validatePresetSlots([{ ...slot, y: v }])).toHaveLength(1);
  });

  it(`acepta ${MAX_PRESET_SLOTS} slots y rechaza ${MAX_PRESET_SLOTS + 1}`, () => {
    expect(validatePresetSlots(Array.from({ length: MAX_PRESET_SLOTS }, () => slot))).toEqual([]);
    expect(validatePresetSlots(Array.from({ length: MAX_PRESET_SLOTS + 1 }, () => slot))).toHaveLength(1);
  });
});

describe('sanitizeSlots', () => {
  it('deja solo slot_label (recortado) + x + y: nada de subject_id ni extras (D8)', () => {
    expect(sanitizeSlots([{ slot_label: '  Medio ', x: 1, y: 2, subject_id: 'abc', jersey_number: 9 }]))
      .toEqual([{ slot_label: 'Medio', x: 1, y: 2 }]);
  });
});
