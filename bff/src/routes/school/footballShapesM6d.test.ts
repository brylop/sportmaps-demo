/**
 * M6d (docs/specs/pizarra-m6-paridad-tacticalpad.md): estilos de línea, zonas
 * (rectángulo / elipse / polígono), relleno, foco sobre jugador y numeración de
 * movimientos. Todos los campos son OPCIONALES en el jsonb: una figura vieja
 * sigue siendo válida y sale igual del saneo.
 */
import { describe, expect, it } from 'vitest';
import {
  validateArrows,
  sanitizeArrows,
  validateFrames,
  sanitizeFrames,
  MAX_SHAPES,
  POLYGON_MAX_POINTS,
  VALID_LINE_STYLES,
  VALID_ZONE_FORMS,
} from './footballShapes';

const base = { x1: 10, y1: 10, x2: 40, y2: 50 };
const poly = (n: number, fill = 30) => Array.from({ length: n }, (_, i) => [10 + (i % 10) * 5, fill + Math.floor(i / 10) * 5]).flat();

describe('M6d — estilos de línea', () => {
  it.each([...VALID_LINE_STYLES])("acepta line '%s' en flecha y curva", (line) => {
    expect(validateArrows([{ ...base, type: 'arrow', line }])).toEqual([]);
    expect(validateArrows([{ ...base, type: 'curve', line }])).toEqual([]);
  });
  it('acepta line en una flecha vieja sin type (type ausente = flecha)', () => {
    expect(validateArrows([{ ...base, line: 'pass' }])).toEqual([]);
  });
  it('rechaza un estilo inventado', () => {
    expect(validateArrows([{ ...base, type: 'arrow', line: 'laser' }])[0]).toMatch(/line inválido/);
  });
  it('rechaza line en figuras que no son líneas', () => {
    expect(validateArrows([{ ...base, type: 'zone', line: 'pass' }])[0]).toMatch(/solo aplica a una flecha o curva/);
    expect(validateArrows([{ ...base, type: 'cone', line: 'shot' }])[0]).toMatch(/solo aplica/);
  });
  it('rechaza basura no string en line sin reventar', () => {
    expect(validateArrows([{ ...base, line: { $ne: 1 } }]).length).toBeGreaterThan(0);
  });
});

describe('M6d — zonas', () => {
  it.each([...VALID_ZONE_FORMS].filter((f) => f !== 'polygon'))("acepta zona '%s' con giro y relleno", (form) => {
    expect(validateArrows([{ ...base, type: 'zone', form, rot: 30, fill: 0.25 }])).toEqual([]);
  });
  it('acepta un polígono de 3 a 24 vértices', () => {
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: poly(3) }])).toEqual([]);
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: poly(POLYGON_MAX_POINTS) }])).toEqual([]);
  });
  it('rechaza polígonos de menos de 3 o más de 24 vértices', () => {
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: poly(2) }])[0]).toMatch(/al menos 3/);
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: poly(POLYGON_MAX_POINTS + 1) }])[0]).toMatch(/máximo 24/);
  });
  it('rechaza puntos maliciosos: fuera de rango, NaN, strings, impares, objetos', () => {
    const bad = [
      [10, 10, 20, 20, 30, 101],
      [10, 10, 20, 20, 30, -1],
      [10, 10, 20, 20, 30, Number.NaN],
      [10, 10, 20, 20, 30, '30'],
      [10, 10, 20, 20, 30],
      [10, 10, 20, 20, 30, { x: 1 }],
      [10, 10, 20, 20, 30, Number.POSITIVE_INFINITY],
    ];
    for (const points of bad) {
      expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points }]).length).toBeGreaterThan(0);
    }
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: 'M0 0' }]).length).toBeGreaterThan(0);
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon' }]).length).toBeGreaterThan(0);
  });
  it('un polígono gigante no pasa (freno al jsonb)', () => {
    expect(validateArrows([{ ...base, type: 'zone', form: 'polygon', points: poly(5000) }])[0]).toMatch(/máximo 24/);
  });
  it('points en un rectángulo o elipse sigue rechazado', () => {
    expect(validateArrows([{ ...base, type: 'zone', form: 'ellipse', points: poly(4) }])[0]).toMatch(/points solo aplica/);
    expect(validateArrows([{ ...base, type: 'zone', points: poly(4) }])[0]).toMatch(/points solo aplica/);
  });
  it('rechaza form inventado o fuera de una zona', () => {
    expect(validateArrows([{ ...base, type: 'zone', form: 'star' }])[0]).toMatch(/form de zona inválido/);
    expect(validateArrows([{ ...base, type: 'arrow', form: 'ellipse' }])[0]).toMatch(/form solo aplica/);
  });
  it('relleno: translúcido siempre (0.05–0.6) y solo en zonas', () => {
    expect(validateArrows([{ ...base, type: 'zone', fill: 1 }])[0]).toMatch(/fill inválido/);
    expect(validateArrows([{ ...base, type: 'zone', fill: 0 }])[0]).toMatch(/fill inválido/);
    expect(validateArrows([{ ...base, type: 'zone', fill: '0.3' }])[0]).toMatch(/fill inválido/);
    expect(validateArrows([{ ...base, type: 'arrow', fill: 0.3 }])[0]).toMatch(/fill solo aplica/);
  });
});

describe('M6d — foco y numeración', () => {
  it('acepta el foco (spotlight) con tamaño y color', () => {
    expect(validateArrows([{ x1: 50, y1: 50, x2: 50, y2: 50, type: 'spotlight', size: 1.5, color: 'yellow' }])).toEqual([]);
  });
  it('acepta seq 1..99 en flecha, curva y recorrido del balón', () => {
    expect(validateArrows([{ ...base, type: 'arrow', seq: 1 }, { ...base, type: 'curve', seq: 99 }, { ...base, type: 'ball_path', kind: 'pase', seq: 3 }])).toEqual([]);
  });
  it('rechaza seq fuera de rango, decimal o en otra figura', () => {
    expect(validateArrows([{ ...base, seq: 0 }])[0]).toMatch(/seq inválido/);
    expect(validateArrows([{ ...base, seq: 100 }])[0]).toMatch(/seq inválido/);
    expect(validateArrows([{ ...base, seq: 1.5 }])[0]).toMatch(/seq inválido/);
    expect(validateArrows([{ ...base, seq: '2' }])[0]).toMatch(/seq inválido/);
    expect(validateArrows([{ ...base, type: 'zone', seq: 2 }])[0]).toMatch(/seq solo aplica/);
  });
});

describe('M6d — saneo y compat', () => {
  it('una figura vieja sale idéntica del saneo (sin campos nuevos)', () => {
    const old = [{ x1: 1, y1: 2, x2: 3, y2: 4 }, { ...base, type: 'zone', color: 'red' }, { ...base, type: 'curve', color: 'blue' }];
    expect(sanitizeArrows(old)).toEqual(old);
  });
  it('conserva los campos nuevos y tira los inventados', () => {
    const pts = poly(5);
    const [arrow, zone] = sanitizeArrows([
      { ...base, type: 'arrow', line: 'dribble', seq: 2, hack: 'x' },
      { ...base, type: 'zone', form: 'polygon', points: pts, fill: 0.3, rot: 10, evil: true },
    ]);
    expect(arrow).toEqual({ ...base, type: 'arrow', line: 'dribble', seq: 2 });
    expect(zone).toEqual({ ...base, type: 'zone', form: 'polygon', points: pts, fill: 0.3, rot: 10 });
  });
  it('el tope de 300 figuras sigue igual con los tipos nuevos', () => {
    const many = Array.from({ length: MAX_SHAPES + 1 }, () => ({ ...base, type: 'zone', form: 'polygon', points: poly(3) }));
    expect(validateArrows(many)[0]).toMatch(/máximo 300/);
    expect(validateArrows(many.slice(0, MAX_SHAPES))).toEqual([]);
  });
  it('los cuadros de una jugada animada validan y sanean los campos nuevos', () => {
    const frames = [{
      id: 'f1', duration_ms: 1000, players: [], ball: null,
      arrows: [{ ...base, type: 'arrow', line: 'shot', seq: 1 }, { ...base, type: 'zone', form: 'ellipse', fill: 0.2 }],
    }];
    expect(validateFrames(frames)).toEqual([]);
    expect(sanitizeFrames(frames)[0].arrows).toEqual(frames[0].arrows);
    const bad = [{ ...frames[0], arrows: [{ ...base, type: 'zone', form: 'polygon', points: [1, 2] }] }];
    expect(validateFrames(bad)[0]).toMatch(/cuadro 1: points inválido/);
  });
});

describe('M6d — configuración de cancha (pseudo-figura court)', () => {
  const court = (c: unknown) => ({ type: 'court', x1: 0, y1: 0, x2: 0, y2: 0, court: c });
  it('acepta una configuración completa y una vacía', () => {
    expect(validateArrows([court({
      tpl: 'lanes_thirds', goals: false, cam: 'half_bottom', orient: 'h', surface: 'whiteboard',
      grass: '#1f8a3f', lines: '#FFFFFF', outline: '#111827',
    })])).toEqual([]);
    expect(validateArrows([court({})])).toEqual([]);
  });
  it('solo una por jugada', () => {
    expect(validateArrows([court({}), court({ tpl: 'thirds' })])[0]).toMatch(/solo puede haber una/);
  });
  it('rechaza valores inventados, colores no hex y campos extra', () => {
    expect(validateArrows([court({ tpl: 'pentagrama' })])[0]).toMatch(/plantilla/);
    expect(validateArrows([court({ cam: 'drone' })])[0]).toMatch(/cámara/);
    expect(validateArrows([court({ orient: 'diagonal' })])[0]).toMatch(/orientación/);
    expect(validateArrows([court({ surface: 'lava' })])[0]).toMatch(/piso/);
    expect(validateArrows([court({ goals: 'si' })])[0]).toMatch(/goals/);
    expect(validateArrows([court({ grass: 'red' })])[0]).toMatch(/#rrggbb/);
    expect(validateArrows([court({ lines: 'url(javascript:alert(1))' })])[0]).toMatch(/#rrggbb/);
    expect(validateArrows([court({ outline: '#12345' })])[0]).toMatch(/#rrggbb/);
    expect(validateArrows([court({ evil: 1 })])[0]).toMatch(/campo desconocido/);
    expect(validateArrows([court(null)])[0]).toMatch(/court inválido/);
    expect(validateArrows([court([1, 2])])[0]).toMatch(/court inválido/);
    expect(validateArrows([{ type: 'court', x1: 0, y1: 0, x2: 0, y2: 0 }])[0]).toMatch(/court inválido/);
  });
  it('court en otra figura se rechaza', () => {
    expect(validateArrows([{ ...base, type: 'arrow', court: {} }])[0]).toMatch(/court solo aplica/);
  });
  it('el saneo deja solo las claves conocidas', () => {
    const [c] = sanitizeArrows([court({ tpl: 'grid3x3', cam: 'full' })]);
    expect(c).toEqual({ type: 'court', x1: 0, y1: 0, x2: 0, y2: 0, court: { tpl: 'grid3x3', cam: 'full' } });
  });
});
