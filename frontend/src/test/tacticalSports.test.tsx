/**
 * Catálogo de deportes de la pizarra (T4, docs/specs/pizarra-nivel-tacticalpad.md):
 * src/lib/school/tacticalSports.ts + src/components/school/courts/*.
 *
 * Por qué estas pruebas: el deporte decide el fondo, las formaciones de
 * arranque y el material de la paleta. Un deporte sin fondo deja la pizarra en
 * blanco; una formación con menos jugadores, o fuera de la cancha, arranca
 * rota; y si el fútbol 11 cambiara un solo byte, las miniaturas y los PDF de
 * jugadas viejas saldrían distintos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  BOARD_H,
  BOARD_W,
  SPORTS,
  SPORT_OPTIONS,
  TACTICAL_SPORTS,
  isTacticalSport,
  sportDef,
  sportFromTeam,
  type TacticalSport,
} from '@/lib/school/tacticalSports';
import { OBJECT_TYPES } from '@/lib/school/tacticalGeometry';
import { isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import { CourtBackground } from '@/components/school/courts/CourtBackground';
import { FootballPitchBackground } from '@/components/school/FootballPitchBackground';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';

describe('catálogo de deportes', () => {
  it('trae los 8 deportes con nombre en español y el mismo viewBox', () => {
    expect([...TACTICAL_SPORTS].sort()).toEqual(
      ['baloncesto', 'balonmano', 'futbol', 'futbol5', 'futbol7', 'futsal', 'generico', 'voleibol'].sort(),
    );
    for (const s of TACTICAL_SPORTS) {
      const d = SPORTS[s];
      expect(d.key).toBe(s);
      expect(d.label.length).toBeGreaterThan(2);
      expect(d.viewBox).toBe(`0 0 ${BOARD_W} ${BOARD_H}`);
    }
    expect(SPORT_OPTIONS.map((o) => o.value)).toEqual([...TACTICAL_SPORTS]);
  });

  it('jugadores por lado reglamentarios', () => {
    const expected: Record<TacticalSport, number> = {
      futbol: 11, futbol7: 7, futbol5: 5, futsal: 5, voleibol: 6, baloncesto: 5, balonmano: 7, generico: 6,
    };
    for (const s of TACTICAL_SPORTS) expect(SPORTS[s].playersPerSide, s).toBe(expected[s]);
  });

  it.each([...TACTICAL_SPORTS])('%s: formaciones completas, dentro de 0-100 y dentro de la cancha', (s) => {
    const d = SPORTS[s];
    expect(d.formations.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const f of d.formations) {
      expect(keys.has(f.key), `clave repetida ${f.key}`).toBe(false);
      keys.add(f.key);
      expect(f.players).toBe(d.playersPerSide);
      expect(f.slots).toHaveLength(d.playersPerSide);
      for (const slot of f.slots) {
        expect(slot.label.trim().length).toBeGreaterThan(0);
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(100);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(100);
        // Dentro del rectángulo de juego (con 0,5 % de tolerancia por redondeo).
        expect(slot.x).toBeGreaterThanOrEqual(d.court.x0 - 0.5);
        expect(slot.x).toBeLessThanOrEqual(d.court.x1 + 0.5);
        expect(slot.y).toBeGreaterThanOrEqual(d.court.y0 - 0.5);
        expect(slot.y).toBeLessThanOrEqual(d.court.y1 + 0.5);
      }
      // Arquero solo donde hay arquero, y entonces exactamente uno, en la mitad propia.
      const gks = f.slots.filter((x) => isGoalkeeperLabel(x.label));
      if (d.hasGoalkeeper) {
        expect(gks, `${s}/${f.key} sin arquero`).toHaveLength(1);
        expect(gks[0].y).toBeGreaterThan(50);
      } else {
        expect(gks).toHaveLength(0);
      }
    }
  });

  it('cancha centrada y dentro del tablero; fútbol 11 sin marco propio', () => {
    expect(SPORTS.futbol.frame).toBeNull();
    for (const s of TACTICAL_SPORTS) {
      const d = SPORTS[s];
      expect(d.court.x0).toBeGreaterThanOrEqual(0);
      expect(d.court.x1).toBeLessThanOrEqual(100);
      expect(d.court.y0).toBeGreaterThanOrEqual(0);
      expect(d.court.y1).toBeLessThanOrEqual(100);
      expect(d.court.x0 + d.court.x1).toBeCloseTo(100, 5);
      const f = d.frame;
      if (!f) continue;
      // Proporción real con estiramiento acotado (≤ 1,3× a lo ancho).
      expect(f.sx / f.sy).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(f.sx / f.sy).toBeLessThanOrEqual(1.3 + 1e-9);
      expect(f.w).toBeCloseTo(f.widthM * f.sx, 6);
      expect(f.h).toBeCloseTo(f.lengthM * f.sy, 6);
    }
  });

  it('el material es un subconjunto ordenado de OBJECT_TYPES', () => {
    for (const s of TACTICAL_SPORTS) {
      const objs = SPORTS[s].objects;
      expect(objs.length).toBeGreaterThan(0);
      const idx = objs.map((o) => (OBJECT_TYPES as readonly string[]).indexOf(o));
      expect(idx.every((i) => i >= 0), s).toBe(true);
      expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    }
    // Sin arcos donde no hay arco.
    for (const s of ['voleibol', 'baloncesto'] as const) {
      expect(SPORTS[s].objects).not.toContain('goal');
      expect(SPORTS[s].objects).not.toContain('mini_goal');
    }
    expect(SPORTS.balonmano.objects).toContain('goal');
    expect(SPORTS.futbol.objects).toEqual([...OBJECT_TYPES]);
  });

  it('sportDef e isTacticalSport caen a fútbol con valores desconocidos', () => {
    expect(isTacticalSport('futsal')).toBe(true);
    expect(isTacticalSport('Futsal')).toBe(false);
    expect(isTacticalSport(null)).toBe(false);
    expect(sportDef(null).key).toBe('futbol');
    expect(sportDef('voleibol').key).toBe('voleibol');
    expect(sportDef('xyz' as TacticalSport).key).toBe('futbol');
  });
});

describe('sportFromTeam', () => {
  const cases: [Parameters<typeof sportFromTeam>[0], TacticalSport][] = [
    // Nombres visibles reales de teams.sport.
    [{ sport: 'Fútbol' }, 'futbol'],
    [{ sport: 'Futbol' }, 'futbol'],
    [{ sport: 'Voleibol' }, 'voleibol'],
    [{ sport: 'Baloncesto' }, 'baloncesto'],
    [{ sport: 'Balonmano' }, 'balonmano'],
    [{ sport: 'Fútbol Sala' }, 'futsal'],
    [{ sport: 'Futsal' }, 'futsal'],
    [{ sport: 'Microfútbol' }, 'futsal'],
    // Slugs y variantes.
    [{ sport: 'futbol_sala' }, 'futsal'],
    [{ sport: 'voleibol_playa' }, 'voleibol'],
    [{ sport: 'basketball' }, 'baloncesto'],
    [{ sport: 'Básquetbol' }, 'baloncesto'],
    [{ sport: 'Handball' }, 'balonmano'],
    [{ sport: 'Volleyball' }, 'voleibol'],
    [{ sport: 'Soccer' }, 'futbol'],
    // Modalidad escrita en el equipo o la categoría.
    [{ sport: 'Fútbol', name: 'Fútbol 7 Sub 10' }, 'futbol7'],
    [{ sport: 'Fútbol', name: 'Pre-infantil F7' }, 'futbol7'],
    [{ sport: 'Fútbol', category_name: '7 vs 7' }, 'futbol7'],
    [{ sport: 'Fútbol', name: 'Fútbol 5 mixto' }, 'futbol5'],
    [{ sport: 'Fútbol 7' }, 'futbol7'],
    [{ sport: 'Fútbol', name: 'Futsal Sub 12' }, 'futsal'],
    [{ sport: 'Fútbol', name: 'Fútbol 11 Juvenil' }, 'futbol'],
    // "Sub 7" / "Sub-5" son edades, no modalidad.
    [{ sport: 'Fútbol', name: 'Sub 7' }, 'futbol'],
    [{ sport: 'Fútbol', category_name: 'Sub-5' }, 'futbol'],
    [{ sport: 'Fútbol', name: 'Categoría 2017' }, 'futbol'],
    // Deportes sin cancha propia → genérico.
    [{ sport: 'Natación' }, 'generico'],
    [{ sport: 'Cheerleading All Stars' }, 'generico'],
    [{ sport: 'Tenis', name: 'Fútbol de los sábados' }, 'generico'],
    // Sin deporte: se mira el nombre; sin nada, fútbol (comportamiento histórico).
    [{ sport: null, name: 'Voleibol femenino' }, 'voleibol'],
    [{ sport: '', name: 'Equipo A' }, 'futbol'],
    [{}, 'futbol'],
    [null, 'futbol'],
  ];
  it.each(cases)('%j → %s', (team, expected) => {
    expect(sportFromTeam(team)).toBe(expected);
  });
});

describe('fondos de cancha', () => {
  it.each([...TACTICAL_SPORTS])('%s: tiene fondo y respeta viewBox/props de FootballPitchBackground', (s) => {
    const html = renderToStaticMarkup(<CourtBackground sport={s} />);
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain('viewBox="0 0 300 340"');
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain('aria-hidden="true"');
    if (s !== 'futbol') expect(html).toContain(`data-court="${s}"`);
    // El zoom (modo arqueros) pasa una ventana del mismo dibujo.
    const zoom = renderToStaticMarkup(<CourtBackground sport={s} viewBox="0 176.8 300 163.2" />);
    expect(zoom).toContain('viewBox="0 176.8 300 163.2"');
    expect(zoom).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('fútbol 11 es exactamente FootballPitchBackground', () => {
    expect(renderToStaticMarkup(<CourtBackground sport="futbol" />)).toBe(renderToStaticMarkup(<FootballPitchBackground />));
    expect(renderToStaticMarkup(<CourtBackground sport={null} />)).toBe(renderToStaticMarkup(<FootballPitchBackground />));
    expect(renderToStaticMarkup(<CourtBackground sport="futbol" viewBox="0 0 300 100" />)).toBe(
      renderToStaticMarkup(<FootballPitchBackground viewBox="0 0 300 100" />),
    );
  });

  it('cada deporte se ve distinto (no hay dos fondos iguales)', () => {
    const htmls = TACTICAL_SPORTS.map((s) => renderToStaticMarkup(<CourtBackground sport={s} />));
    expect(new Set(htmls).size).toBe(TACTICAL_SPORTS.length);
  });

  it('marcas reglamentarias clave', () => {
    const vb = renderToStaticMarkup(<CourtBackground sport="voleibol" />);
    for (const n of ['1', '2', '3', '4', '5', '6']) expect(vb).toContain(`>${n}</text>`); // zonas
    const bm = renderToStaticMarkup(<CourtBackground sport="balonmano" />);
    expect(bm).toContain('stroke-dasharray="5 4"'); // 9 m discontinua
    const bk = renderToStaticMarkup(<CourtBackground sport="baloncesto" />);
    expect(bk).toContain('#f97316'); // aro
  });
});

describe('TacticalStaticSvg por deporte', () => {
  const PLAYERS = [
    { x: 50, y: 92, label: 'Arquero', jersey: 1 },
    { x: 30, y: 60, label: 'Juan Pérez' },
  ];
  const ARROWS = [
    { type: 'arrow' as const, x1: 10, y1: 10, x2: 20, y2: 20, color: 'yellow' as const },
    { type: 'cone' as const, x1: 5, y1: 5, x2: 5, y2: 5 },
  ];

  it('fútbol: salida idéntica a la de antes de T4 (sin sport y con sport="futbol")', () => {
    const baseline = readFileSync(resolve(__dirname, 'fixtures/tacticalStaticSvg.futbol.baseline.svg'), 'utf8');
    expect(renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} width={360} />)).toBe(baseline);
    expect(renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} width={360} sport="futbol" />)).toBe(baseline);
  });

  it.each(TACTICAL_SPORTS.filter((s) => s !== 'futbol'))('%s: cancha del deporte + jugadores y figuras encima', (s) => {
    const html = renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} sport={s} />);
    expect(html).toContain(`data-court="${s}"`);
    expect(html).not.toContain('pitch-glow'); // no se cuela la de fútbol
    expect(html.match(/data-player="true"/g)).toHaveLength(2);
    expect(html).toContain('data-shape="arrow"');
    expect(html).toContain('data-shape="cone"');
    // La cancha va ANTES (debajo) de jugadores y figuras.
    expect(html.indexOf('data-court')).toBeLessThan(html.indexOf('data-layer="players"'));
    expect(html).not.toMatch(/NaN|undefined/);
  });
});
