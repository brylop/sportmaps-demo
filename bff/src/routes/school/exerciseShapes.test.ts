/**
 * Biblioteca de ejercicios (pizarra T3): validación de campos y de la jugada
 * { players, arrows, frames }. Sin Express ni base (exerciseShapes.ts es puro).
 */
import { describe, expect, it } from 'vitest';
import {
  validateBoard,
  validateExerciseInput,
  sanitizeSearch,
  MAX_FRAMES,
  MAX_BOARD_PLAYERS,
  MAX_TAGS,
} from './exerciseShapes';

const player = (label: string, x = 50, y = 50) => ({ key: `slot:${label}`, slot_label: label, x, y });
const frame = (id: string, extra: Record<string, unknown> = {}) => ({
  id, duration_ms: 1200, players: [{ key: 'slot:A', x: 10, y: 10 }], ball: { x: 10, y: 11 }, arrows: [], ...extra,
});
const arrow = { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20, color: 'white' };

describe('validateBoard', () => {
  it('null/undefined = jugada vacía válida', () => {
    expect(validateBoard(undefined)).toEqual({ errors: [], board: { players: [], arrows: [], frames: [] } });
    expect(validateBoard(null).errors).toEqual([]);
  });

  it('rechaza lo que no es objeto', () => {
    expect(validateBoard([]).errors.length).toBe(1);
    expect(validateBoard('x').errors.length).toBe(1);
  });

  it('acepta una jugada completa y la limpia', () => {
    const { errors, board } = validateBoard({
      players: [{ ...player(' A '), jersey_number: 7, extra: 'fuera' }],
      arrows: [{ ...arrow, basura: 1 }],
      frames: [frame('f1', { arrows: [arrow], otro: true })],
      ignorado: 'x',
    });
    expect(errors).toEqual([]);
    expect(board!.players[0]).toEqual({ key: 'slot: A', slot_label: 'A', x: 50, y: 50, jersey_number: 7 });
    expect(board!.arrows[0]).not.toHaveProperty('basura');
    expect(board!.frames[0]).not.toHaveProperty('otro');
    expect(Object.keys(board!)).toEqual(['players', 'arrows', 'frames']);
  });

  it('rechaza jugadores fuera de cancha, repetidos o sin etiqueta', () => {
    expect(validateBoard({ players: [player('A', 101, 5)] }).errors.length).toBeGreaterThan(0);
    expect(validateBoard({ players: [player('A'), player('A')] }).errors.some((e) => e.includes('repetido'))).toBe(true);
    expect(validateBoard({ players: [{ key: 'k', slot_label: '', x: 1, y: 1 }] }).errors.length).toBe(1);
    expect(validateBoard({ players: [{ ...player('A'), jersey_number: 100 }] }).errors.length).toBe(1);
  });

  it('tope de jugadores', () => {
    const many = Array.from({ length: MAX_BOARD_PLAYERS + 1 }, (_, i) => player(`P${i}`));
    expect(validateBoard({ players: many }).errors[0]).toContain('demasiados jugadores');
  });

  it('usa validateArrows para las figuras (de la jugada y de cada cuadro)', () => {
    expect(validateBoard({ arrows: [{ ...arrow, x1: 200 }] }).errors.length).toBeGreaterThan(0);
    const r = validateBoard({ frames: [frame('f1', { arrows: [{ ...arrow, color: 'fucsia' }] })] });
    expect(r.errors[0]).toMatch(/^cuadro 1: color/);
  });

  it(`tope de ${MAX_FRAMES} cuadros`, () => {
    const frames = Array.from({ length: MAX_FRAMES + 1 }, (_, i) => frame(`f${i}`));
    expect(validateBoard({ frames }).errors[0]).toContain('demasiados cuadros');
    expect(validateBoard({ frames: frames.slice(0, MAX_FRAMES) }).errors).toEqual([]);
  });

  it('valida duración, jugadores y balón de cada cuadro', () => {
    expect(validateBoard({ frames: [frame('f1', { duration_ms: 50 })] }).errors[0]).toContain('duration_ms');
    expect(validateBoard({ frames: [frame('f1', { players: [{ key: 'a', x: -1, y: 0 }] })] }).errors[0]).toContain('jugador inválido');
    expect(validateBoard({ frames: [frame('f1', { ball: { x: 5 } })] }).errors[0]).toContain('ball');
    expect(validateBoard({ frames: [frame('f1', { ball: null })] }).errors).toEqual([]);
    expect(validateBoard({ frames: [frame('', {})] }).errors[0]).toContain('id inválido');
    expect(validateBoard({ frames: ['x'] }).errors[0]).toContain('cuadro 1 inválido');
  });

  it('players/arrows/frames que no son lista', () => {
    expect(validateBoard({ players: {} }).errors).toEqual(['board.players debe ser una lista.']);
    expect(validateBoard({ frames: 'x' }).errors).toEqual(['board.frames debe ser una lista.']);
  });
});

describe('validateExerciseInput', () => {
  it('POST exige name', () => {
    expect(validateExerciseInput({}, false).errors).toContain('name es requerido.');
    expect(validateExerciseInput({ name: '   ' }, false).errors).toContain('name es requerido.');
  });

  it('PUT parcial acepta solo lo que viene', () => {
    const { errors, fields } = validateExerciseInput({ minutes: 20 }, true);
    expect(errors).toEqual([]);
    expect(fields).toEqual({ minutes: 20 });
  });

  it('nunca deja pasar school_id, created_by, is_template ni times_used', () => {
    const { fields } = validateExerciseInput(
      { name: 'Rondo', school_id: 'x', created_by: 'y', is_template: true, times_used: 99 }, false,
    );
    expect(fields).not.toHaveProperty('school_id');
    expect(fields).not.toHaveProperty('created_by');
    expect(fields).not.toHaveProperty('is_template');
    expect(fields).not.toHaveProperty('times_used');
  });

  it('minutos entre 1 y 240 (acepta "15" del formulario)', () => {
    expect(validateExerciseInput({ name: 'a', minutes: 0 }, false).errors.length).toBe(1);
    expect(validateExerciseInput({ name: 'a', minutes: 241 }, false).errors.length).toBe(1);
    expect(validateExerciseInput({ name: 'a', minutes: 1.5 }, false).errors.length).toBe(1);
    expect(validateExerciseInput({ name: 'a', minutes: '15' }, false).fields.minutes).toBe(15);
    expect(validateExerciseInput({ name: 'a', minutes: '' }, false).fields.minutes).toBeNull();
  });

  it('deporte del catálogo', () => {
    expect(validateExerciseInput({ name: 'a', sport: 'futsal' }, false).errors).toEqual([]);
    expect(validateExerciseInput({ name: 'a', sport: 'rugby' }, false).errors[0]).toContain('sport inválido');
  });

  it('etiquetas: limpias, sin repetir, con tope', () => {
    expect(validateExerciseInput({ name: 'a', tags: [' Rondo', 'rondo', '', 'Pase'] }, false).fields.tags).toEqual(['rondo', 'pase']);
    const many = Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`);
    expect(validateExerciseInput({ name: 'a', tags: many }, false).errors[0]).toContain('demasiadas etiquetas');
    expect(validateExerciseInput({ name: 'a', tags: 'rondo' }, false).errors[0]).toContain('lista');
  });

  it('textos vacíos quedan en null y los largos se rechazan', () => {
    expect(validateExerciseInput({ name: 'a', objective: '  ' }, false).fields.objective).toBeNull();
    expect(validateExerciseInput({ name: 'a', age_group: 'x'.repeat(61) }, false).errors.length).toBe(1);
  });

  it('errores de la jugada salen con prefijo', () => {
    const r = validateExerciseInput({ name: 'a', board: { frames: 'x' } }, false);
    expect(r.errors).toEqual(['jugada: board.frames debe ser una lista.']);
  });
});

describe('sanitizeSearch', () => {
  it('saca caracteres que rompen el filtro or() de PostgREST', () => {
    expect(sanitizeSearch('rondo,(name.eq.x)*%')).toBe('rondo name.eq.x');
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch('a'.repeat(100)).length).toBe(60);
  });
});
