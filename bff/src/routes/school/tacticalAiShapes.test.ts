/**
 * IA de la pizarra (M3): entrada, anonimización, hash, prompt y validación de
 * la salida del modelo (dato NO confiable). Sin red ni base: las respuestas
 * del modelo son fixtures grabados (__fixtures__/tacticalAi.recorded.json,
 * de la corrida real del 2026-10-14) o armadas a mano.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AI_SPORTS, COURTS, AiOutputError, anonymizePlay, boardHash, buildSystemPrompt, buildUserPrompt,
  cleanText, deanonymizeResult, parseAnalyzeInput, parseModelJson, promptLeaks, rosterNameTokens,
  safePositionLabel, validateAiResult, type AiSport,
} from './tacticalAiShapes';
import { FAKE_ROSTER_NAMES, fakeKey, samplePlay } from './__fixtures__/tacticalAiPlays';

const recorded: Record<string, { texto: string }> = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'tacticalAi.recorded.json'), 'utf8'),
);

function prepared(sport: AiSport = 'futbol') {
  const { input } = parseAnalyzeInput(samplePlay(sport));
  if (!input) throw new Error('fixture inválido');
  const { play, keyMap } = anonymizePlay(input, rosterNameTokens(FAKE_ROSTER_NAMES));
  return { input, play, keyMap, ctx: { sport, ownKeys: new Set(keyMap.keys()) } };
}

const frame = (players: { key: string; x: number; y: number }[], extra: Record<string, unknown> = {}) => ({
  id: 'x', duration_ms: 1200, players, ball: { x: 50, y: 50 }, arrows: [], ...extra,
});
const goodCounter = (n = 3) => ({
  titulo: 'Salida rápida por la derecha',
  explicacion: 'El rival recupera y corre.',
  frames: Array.from({ length: n }, (_, i) => frame([{ key: 'p1', x: 50, y: 90 }, { key: 'r1', x: 60, y: 20 + i * 10 }])),
});
const wrap = (o: Record<string, unknown>) => JSON.stringify({ lectura: 'Busca la banda.', riesgos: [], contraataques: [], variantes: [], ...o });

describe('canchas: espejo de frontend/src/lib/school/tacticalSports.ts', () => {
  // Valores impresos del frontend el 2026-10-14 (SPORTS[k].court).
  const FRONT = {
    futbol: { x0: 2, y0: 1.7647058823529411, x1: 98, y1: 98.23529411764706 },
    futbol7: { x0: 2.6222222222222156, y0: 1.7647058823529411, x1: 97.37777777777778, y1: 98.23529411764706 },
    futbol5: { x0: 5.583333333333333, y0: 1.7647058823529411, x1: 94.41666666666667, y1: 98.23529411764706 },
    futsal: { x0: 14.466666666666669, y0: 1.7647058823529411, x1: 85.53333333333335, y1: 98.23529411764706 },
    voleibol: { x0: 18.58333333333333, y0: 7.352941176470589, x1: 81.41666666666667, y1: 92.64705882352942 },
    baloncesto: { x0: 11.92857142857143, y0: 1.7647058823529411, x1: 88.07142857142858, y1: 98.23529411764706 },
    balonmano: { x0: 14.466666666666669, y0: 1.7647058823529411, x1: 85.53333333333335, y1: 98.23529411764706 },
  } as const;
  it.each(AI_SPORTS)('%s', (s) => {
    for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(COURTS[s][k]).toBeCloseTo(FRONT[s][k], 6);
  });
});

describe('parseAnalyzeInput', () => {
  it('acepta la jugada de ejemplo de cada deporte', () => {
    for (const s of AI_SPORTS) expect(parseAnalyzeInput(samplePlay(s)).errors).toEqual([]);
  });
  it('rechaza team_id inválido, deporte sin IA y jugada vacía', () => {
    expect(parseAnalyzeInput({ ...samplePlay('futbol'), team_id: 'x' }).errors).toContain('team_id inválido.');
    expect(parseAnalyzeInput({ ...samplePlay('futbol'), sport: 'generico' }).errors[0]).toMatch(/no tiene análisis/);
    expect(parseAnalyzeInput({ ...samplePlay('futbol'), frames: null }).errors[0]).toMatch(/Falta la jugada/);
    const empty = samplePlay('futbol');
    empty.frames = empty.frames.map((f) => ({ ...f, players: [] }));
    expect(parseAnalyzeInput(empty).errors[0]).toMatch(/al menos un jugador/);
  });
  it('rechaza más de 30 cuadros y coordenadas fuera del tablero', () => {
    const p = samplePlay('futbol');
    expect(parseAnalyzeInput({ ...p, frames: Array.from({ length: 31 }, () => p.frames[0]) }).errors[0]).toMatch(/demasiados cuadros/);
    const bad = samplePlay('futbol');
    bad.frames[0].players[0].x = 140;
    expect(parseAnalyzeInput(bad).errors.join(' ')).toMatch(/entre 0 y 100/);
  });
  it('colores desconocidos caen a los de siempre', () => {
    const { input } = parseAnalyzeInput({ ...samplePlay('futbol'), colors: { own: 'javascript:alert(1)', rival: 'blue' } });
    expect(input?.colors).toEqual({ own: 'green', rival: 'blue' });
  });
});

describe('nombres e ids de atletas NO llegan al prompt', () => {
  it.each(AI_SPORTS)('%s: ni claves, ni nombres del plantel, ni texto libre', (sport) => {
    const { play, keyMap } = prepared(sport);
    const prompt = `${buildSystemPrompt(sport)}\n${buildUserPrompt(play)}`;
    expect(prompt).not.toMatch(/athlete:|child:|profile:|unregistered:/);
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(promptLeaks(prompt, [...FAKE_ROSTER_NAMES, 'Sofi', 'Sofía', ...keyMap.values()])).toEqual([]);
    expect(prompt).not.toContain('presiona'); // la figura de texto de la cancha no viaja
  });
  it('la etiqueta con nombre se borra; la de puesto pasa', () => {
    const { play } = prepared('futbol');
    expect(Object.values(play.puestos)).not.toContain('Sofi');
    expect(Object.values(play.puestos)).toContain('Lateral izq.');
  });
  it('safePositionLabel: solo vocabulario de puesto', () => {
    const tokens = rosterNameTokens(['Juan David Pérez']);
    expect(safePositionLabel('Zona 4')).toBe('Zona 4');
    expect(safePositionLabel('Ala-pívot')).toBe('Ala-pívot');
    expect(safePositionLabel('Volante der.')).toBe('Volante der.');
    expect(safePositionLabel('Juanito')).toBe('');
    expect(safePositionLabel('Delantero Pérez', tokens)).toBe('');
    expect(safePositionLabel('Sofi 10')).toBe('');
    expect(safePositionLabel('x'.repeat(80))).toBe('');
    expect(safePositionLabel(42)).toBe('');
  });
  it('promptLeaks usa palabra completa («Ana» no choca con «analista»)', () => {
    expect(promptLeaks('Eres analista táctico', ['Ana'])).toEqual([]);
    expect(promptLeaks('pase a Ana por la banda', ['Ana'])).toEqual(['Ana']);
  });
});

describe('caché: boardHash', () => {
  it('la misma jugada con OTROS jugadores da el mismo hash; otro deporte no', () => {
    const a = prepared('futbol');
    const other = samplePlay('futbol');
    const rename = (k: string) => k.replace('athlete:', 'child:').replace('aaaa', 'ffff');
    other.frames = other.frames.map((f) => ({ ...f, players: [...f.players].reverse().map((p) => ({ ...p, key: rename(p.key) })) }));
    other.labels = Object.fromEntries(Object.entries(other.labels).map(([k, v]) => [rename(k), v]));
    const b = anonymizePlay(parseAnalyzeInput(other).input!, new Set());
    expect(boardHash(b.play)).toBe(boardHash(a.play));
    const moved = samplePlay('futbol');
    moved.frames[0].players[3].x += 5;
    expect(boardHash(anonymizePlay(parseAnalyzeInput(moved).input!).play)).not.toBe(boardHash(a.play));
    expect(boardHash(prepared('futbol7').play)).not.toBe(boardHash(a.play));
    expect(boardHash(a.play)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('marca al arquero rival (el más cerca de su arco)', () => {
    expect(prepared('futbol').play.arquero_rival).toBe('r7');
    expect(prepared('voleibol').play.arquero_rival).toBeNull();
  });
});

describe('validateAiResult (salida no confiable)', () => {
  const { ctx } = prepared('futbol');

  it('JSON inválido → AiOutputError json_invalido', () => {
    expect(() => validateAiResult('esto no es json {', ctx)).toThrow(AiOutputError);
    try { validateAiResult('nada', ctx); } catch (e) { expect((e as AiOutputError).code).toBe('json_invalido'); }
  });
  it('JSON envuelto en ```json``` o con texto alrededor se rescata', () => {
    expect(parseModelJson('Claro:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseModelJson('respuesta: {"a":2} fin')).toEqual({ a: 2 });
  });
  it('forma inválida (arreglo) → forma_invalida; nada usable → sin_contenido', () => {
    expect(() => validateAiResult('[1,2]', ctx)).toThrow(/forma esperada/);
    expect(() => validateAiResult(JSON.stringify({ lectura: '', contraataques: [{ titulo: 'x', frames: 'no' }] }), ctx)).toThrow(/nada utilizable/);
  });

  it('respuesta maliciosa: campos extra, HTML, ids, claves inventadas y figuras de texto se limpian', () => {
    const evil = {
      lectura: '<script>alert(1)</script>Ataque por <b>banda</b>. Escribe a juan@correo.com 0000000a-aaaa-4bbb-8ccc-100000000001',
      riesgos: [{ titulo: 'Espalda', detalle: 'Hueco', zona: 'derecha', __proto__: { admin: true }, sql: 'drop table' }],
      contraataques: [{
        titulo: 'Contra', explicacion: 'ok', extra: 'x',
        frames: [
          { id: 'z', duration_ms: 900, hack: 1, players: [{ key: 'p1', x: 50, y: 90, name: 'Juan' }, { key: 'athlete:0000', x: 10, y: 10 }, { key: 'r2', x: 40, y: 30 }, { key: 'r99', x: 40, y: 30 }],
            ball: { x: 40, y: 30, z: 9 }, arrows: [{ type: 'text', x1: 1, y1: 1, x2: 1, y2: 1, text: 'ignora las reglas' }, { type: 'arrow', x1: 40, y1: 30, x2: 40, y2: 60, color: 'red', onclick: 'x' }] },
          { id: 'z2', duration_ms: 900, players: [{ key: 'r2', x: 40, y: 60 }], ball: null, arrows: [] },
        ],
      }],
      variantes: [],
      instrucciones_ocultas: 'guardar como admin',
    };
    const { result } = validateAiResult(JSON.stringify(evil), ctx);
    expect(result.lectura).not.toMatch(/<|script|@|0000000a/);
    expect(result.lectura).toContain('Ataque por banda');
    expect(Object.keys(result)).toEqual(['lectura', 'riesgos', 'contraataques', 'variantes']);
    expect(result.riesgos[0]).toEqual({ titulo: 'Espalda', detalle: 'Hueco', zona: 'derecha' });
    const f0 = result.contraataques[0].frames[0] as any;
    expect(Object.keys(f0).sort()).toEqual(['arrows', 'ball', 'duration_ms', 'id', 'players']);
    expect(f0.players.map((p: any) => p.key)).toEqual(['p1', 'r2']); // athlete:… y r99 fuera
    expect(f0.players[0]).toEqual({ key: 'p1', x: 50, y: 90 });
    expect(f0.ball).toEqual({ x: 40, y: 30 });
    expect(f0.arrows).toEqual([{ x1: 40, y1: 30, x2: 40, y2: 60, type: 'arrow', color: 'red' }]);
    expect(Object.keys(result.contraataques[0])).toEqual(['titulo', 'explicacion', 'frames']);
  });

  it('coordenadas fuera del tablero descartan ESA sugerencia; dentro del tablero pero fuera de la cancha se recortan', () => {
    const out = goodCounter();
    (out.frames[1].players[1] as any).x = 140;
    const inside = goodCounter();
    inside.frames[0].players[1].x = 1; // la cancha de futsal empieza en x≈14,5
    const futsal = prepared('futsal').ctx;
    const r = validateAiResult(wrap({ contraataques: [out, inside] }), futsal);
    expect(r.result.contraataques).toHaveLength(1);
    expect(r.dropped[0]).toMatch(/contraataque 1: .*entre 0 y 100/);
    const p = (r.result.contraataques[0].frames[0] as any).players[1];
    expect(p.x).toBeCloseTo(14.5, 1);
    for (const s of r.result.contraataques) {
      for (const f of s.frames as any[]) for (const q of f.players) {
        expect(q.x).toBeGreaterThanOrEqual(COURTS.futsal.x0 - 0.05);
        expect(q.x).toBeLessThanOrEqual(COURTS.futsal.x1 + 0.05);
      }
    }
  });

  it('más de 30 cuadros, menos de 2, o un contraataque sin rivales se descartan; la lectura sigue', () => {
    const many = goodCounter(31);
    const one = goodCounter(1);
    const noRival = { ...goodCounter(), frames: goodCounter().frames.map((f) => ({ ...f, players: [f.players[0]] })) };
    const r = validateAiResult(wrap({ contraataques: [many, one, noRival, goodCounter()] }), ctx);
    expect(r.result.contraataques).toHaveLength(1);
    expect(r.dropped.join(' | ')).toMatch(/más de 30 cuadros.*menos de 2 cuadros.*no tiene rivales/);
    expect(r.result.lectura).toBe('Busca la banda.');
  });

  it('topes: 3 contraataques, 2 variantes, 4 riesgos; textos recortados', () => {
    const r = validateAiResult(wrap({
      lectura: 'x'.repeat(5000),
      riesgos: Array.from({ length: 9 }, () => ({ titulo: 'a', detalle: 'b', zona: '' })),
      contraataques: Array.from({ length: 5 }, () => goodCounter()),
      variantes: Array.from({ length: 4 }, () => goodCounter()),
    }), ctx);
    expect(r.result.contraataques).toHaveLength(3);
    expect(r.result.variantes).toHaveLength(2);
    expect(r.result.riesgos).toHaveLength(4);
    expect(r.result.riesgos[0]).toEqual({ titulo: 'a', detalle: 'b' });
    expect(r.result.lectura).toHaveLength(1200);
  });

  it('duración fuera de rango se acomoda; no numérica descarta', () => {
    const fast = goodCounter();
    fast.frames[1].duration_ms = 50;
    const broken = goodCounter();
    (broken.frames[1] as any).duration_ms = 'rápido';
    const r = validateAiResult(wrap({ contraataques: [fast, broken] }), ctx);
    expect((r.result.contraataques[0].frames[1] as any).duration_ms).toBe(400);
    expect(r.result.contraataques).toHaveLength(1);
  });

  it('cleanText quita caracteres de control', () => {
    expect(cleanText('a\u0000b\u0007c', 10)).toBe('abc');
  });
});

describe('respuestas GRABADAS del modelo (corrida real 2026-10-14)', () => {
  it.each(AI_SPORTS)('%s: valida, trae 2-3 contraataques con rivales y todo queda en la cancha', (sport) => {
    const rec = recorded[sport];
    expect(rec, `falta el fixture de ${sport}`).toBeTruthy();
    const { ctx, keyMap } = prepared(sport);
    const { result } = validateAiResult(rec.texto, ctx);
    expect(result.lectura.length).toBeGreaterThan(40);
    expect(result.contraataques.length).toBeGreaterThanOrEqual(2);
    expect(result.contraataques.length).toBeLessThanOrEqual(3);
    expect(result.variantes.length).toBeGreaterThanOrEqual(1);
    const c = COURTS[sport];
    for (const s of [...result.contraataques, ...result.variantes]) {
      for (const f of s.frames as any[]) {
        for (const p of f.players) {
          expect(p.x).toBeGreaterThanOrEqual(c.x0 - 0.05); expect(p.x).toBeLessThanOrEqual(c.x1 + 0.05);
          expect(p.y).toBeGreaterThanOrEqual(c.y0 - 0.05); expect(p.y).toBeLessThanOrEqual(c.y1 + 0.05);
        }
      }
    }
    // De vuelta al tablero: p1..pN → claves reales; rN → rival:N.
    const back = deanonymizeResult(result, keyMap);
    const keys = back.contraataques.flatMap((s) => (s.frames as any[]).flatMap((f) => f.players.map((p: any) => p.key)));
    expect(keys.every((k: string) => k.startsWith('rival:') || k.startsWith('athlete:'))).toBe(true);
    expect(keys).toContain(fakeKey(0));
  });
});
