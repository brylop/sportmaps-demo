/**
 * Plantillas SportMaps de futsal, voleibol, baloncesto, balonmano, fútbol 5 y
 * genérico (migración 20261013194057, generada desde
 * src/test/fixtures/plantillasEjercicios.ts).
 *
 * Por qué estas pruebas: las plantillas entran por SQL, sin pasar por el BFF.
 * Si una jugada trae una figura que el BFF no acepta, el coach la carga, la
 * edita y al guardar recibe un 422 que no entiende. Y si las coordenadas son
 * las de la cancha de fútbol 11, en futsal o voleibol los jugadores quedan
 * fuera de las líneas.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';
import { SPORTS, COURT_METERS, BOARD_W, BOARD_H } from '@/lib/school/tacticalSports';
import { isPointShape } from '@/lib/school/tacticalGeometry';
import { exerciseThumbnail } from '@/lib/school/exerciseLibrary';
import { TEMPLATES, MIGRATION_FILE, buildTemplatesSql } from './fixtures/plantillasEjercicios';
// Las MISMAS validaciones del BFF (lógica pura, sin Express ni Supabase).
import { validateExerciseInput } from '../../../bff/src/routes/school/exerciseShapes';
import { validateFrames } from '../../../bff/src/routes/school/footballShapes';

/** Zona libre alrededor de la cancha que se acepta (saque de voleibol, banda). */
const MARGIN_M = 2;

function courtBounds(sport: keyof typeof SPORTS) {
  const def = SPORTS[sport];
  const c = def.court;
  if (!def.frame) return { ...c };
  const mx = ((MARGIN_M * def.frame.sx) / BOARD_W) * 100;
  const my = ((MARGIN_M * def.frame.sy) / BOARD_H) * 100;
  return { x0: c.x0 - mx, y0: c.y0 - my, x1: c.x1 + mx, y1: c.y1 + my };
}

/** Todos los puntos de una jugada: jugadores, balón y extremos de figuras. */
function pointsOf(t: (typeof TEMPLATES)[number]): { x: number; y: number; what: string }[] {
  const out: { x: number; y: number; what: string }[] = [];
  t.board.players.forEach((p) => out.push({ x: p.x, y: p.y, what: `puesto ${p.slot_label}` }));
  t.board.frames.forEach((f) => {
    f.players.forEach((p) => out.push({ x: p.x, y: p.y, what: `${f.id} ${p.key}` }));
    if (f.ball) out.push({ ...f.ball, what: `${f.id} balón` });
    f.arrows.forEach((a) => {
      out.push({ x: a.x1, y: a.y1, what: `${f.id} ${a.type} origen` });
      out.push({ x: a.x2, y: a.y2, what: `${f.id} ${a.type} destino` });
    });
  });
  return out;
}

const EXPECTED_MIN: Record<string, number> = {
  futsal: 3, voleibol: 3, baloncesto: 3, balonmano: 3, futbol5: 2, generico: 2,
};

describe('plantillas de la biblioteca para otros deportes', () => {
  it('cubre los deportes que no tenían plantillas', () => {
    const count: Record<string, number> = {};
    TEMPLATES.forEach((t) => { count[t.sport] = (count[t.sport] ?? 0) + 1; });
    for (const [sport, min] of Object.entries(EXPECTED_MIN)) {
      expect(count[sport] ?? 0, sport).toBeGreaterThanOrEqual(min);
    }
    expect(count.futbol ?? 0).toBe(0);
    expect(count.futbol7 ?? 0).toBe(0);
  });

  it('ids únicos y sin chocar con las 12 plantillas de fútbol (…001 a …012)', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toMatch(/^5b1b0000-0000-4000-8000-\d{12}$/);
      expect(Number(id.slice(-12))).toBeGreaterThan(12);
    });
    const names = TEMPLATES.map((t) => `${t.sport}|${t.name.toLowerCase()}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it('la migración es exactamente lo que genera el fixture', () => {
    const sql = readFileSync(resolve(process.cwd(), '..', MIGRATION_FILE), 'utf8').replace(/\r\n/g, '\n');
    expect(sql).toBe(buildTemplatesSql());
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(sql).toContain('WHERE NOT EXISTS');
  });

  describe.each(TEMPLATES.map((t) => [`${t.sport} · ${t.name}`, t] as const))('%s', (_label, t) => {
    it('pasa validateExerciseInput del BFF sin perder nada al sanear', () => {
      const { errors, fields } = validateExerciseInput({ ...t, id: undefined }, false);
      expect(errors).toEqual([]);
      // Lo que se guarda por SQL es lo mismo que guardaría el BFF.
      expect(fields.board).toEqual(t.board);
      expect(fields.tags).toEqual(t.tags);
      expect(fields.sport).toBe(t.sport);
    });

    it('pasa validateFrames (jugada animada de 2 a 4 cuadros)', () => {
      expect(validateFrames(t.board.frames)).toEqual([]);
      expect(t.board.frames.length).toBeGreaterThanOrEqual(2);
      expect(t.board.frames.length).toBeLessThanOrEqual(4);
    });

    it('cada cuadro trae a todos los puestos y el primero coincide con board', () => {
      const keys = t.board.players.map((p) => p.key);
      keys.forEach((k, i) => expect(k).toBe(`slot#${i}`));
      t.board.frames.forEach((f) => expect(f.players.map((p) => p.key)).toEqual(keys));
      const f1 = t.board.frames[0];
      expect(f1.players.map((p) => [p.x, p.y])).toEqual(t.board.players.map((p) => [p.x, p.y]));
      expect(t.board.arrows).toEqual(f1.arrows);
      expect(t.board.players.length).toBeLessThanOrEqual(SPORTS[t.sport].playersPerSide);
    });

    it('todo cae dentro de la cancha de su deporte (o a menos de 2 m de la línea)', () => {
      expect(COURT_METERS[t.sport as keyof typeof COURT_METERS]).toBeDefined();
      const b = courtBounds(t.sport);
      for (const p of pointsOf(t)) {
        expect(p.x, `${p.what} x=${p.x}`).toBeGreaterThanOrEqual(b.x0);
        expect(p.x, `${p.what} x=${p.x}`).toBeLessThanOrEqual(b.x1);
        expect(p.y, `${p.what} y=${p.y}`).toBeGreaterThanOrEqual(b.y0);
        expect(p.y, `${p.what} y=${p.y}`).toBeLessThanOrEqual(b.y1);
      }
    });

    it('solo usa material que la paleta de ese deporte ofrece', () => {
      const allowed = SPORTS[t.sport].objects as readonly string[];
      t.board.frames.flatMap((f) => f.arrows).forEach((a) => {
        if (isPointShape(a.type)) expect(allowed, `${a.type} en ${t.sport}`).toContain(a.type);
      });
    });

    it('textos completos, en español de Colombia y etiquetas en minúscula', () => {
      expect(t.objective.length).toBeGreaterThan(20);
      expect(t.description.length).toBeGreaterThan(80);
      expect(t.materials.length).toBeGreaterThan(3);
      expect(t.minutes).toBeGreaterThanOrEqual(5);
      expect(t.age_group).toMatch(/^Sub-\d+ en adelante$/);
      t.tags.forEach((tag) => expect(tag).toBe(tag.toLowerCase().trim()));
      const text = [t.name, t.objective, t.description, t.materials].join(' ');
      expect(text).not.toMatch(/\b(vos|che)\b/i);
    });

    it('se dibuja con TacticalStaticSvg en su cancha (miniatura y cada cuadro)', () => {
      const thumb = exerciseThumbnail(t.board);
      const html = renderToStaticMarkup(<TacticalStaticSvg sport={t.sport} players={thumb.players} arrows={thumb.arrows} />);
      expect(html.startsWith('<svg')).toBe(true);
      expect(html).toContain(`data-court="${t.sport}"`);
      for (const f of t.board.frames) {
        const players = f.players.map((p) => ({ x: p.x, y: p.y, label: t.board.players.find((b) => b.key === p.key)?.slot_label }));
        const out = renderToStaticMarkup(<TacticalStaticSvg sport={t.sport} players={players} arrows={f.arrows} />);
        const shapes = out.match(/data-shape="/g)?.length ?? 0;
        expect(shapes, f.id).toBe(f.arrows.length);
      }
    });
  });
});
