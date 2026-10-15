/**
 * M6f (docs/specs/pizarra-m6-paridad-tacticalpad.md §4 + fase M5 de
 * docs/specs/pizarra-multideporte-3d-ia.md): canchas de rugby, fútbol
 * americano, tenis, pádel, bádminton, vóley playa, hockey césped, hockey
 * sobre patines, netball, waterpolo y ultimate.
 *
 * Las medidas oficiales están escritas AQUÍ a mano (no se leen del código):
 * si alguien cambia COURT_METERS o un dibujo, esto lo detecta.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CourtBackground } from '@/components/school/courts/CourtBackground';
import { H_POSTS_M, NET_M, meters } from '@/components/school/courts/courtGeometry';
import { SPORTS, BOARD_W, BOARD_H, sportDef, type TacticalSport } from '@/lib/school/tacticalSports';
import { boardSportConfig, defaultBoardFormation } from '@/lib/school/tacticalBoardSport';
import { ballFor, cameraLabel, court3D, fixtureFor, toMeters } from '@/lib/school/tactical3d';
import { BOARD_SPORTS, LIBRARY_BOARD_SPORTS } from '@/lib/sports/sportCatalog';

/** Medidas oficiales (ancho × largo, metros) y su fuente. */
const OFFICIAL: Record<string, { w: number; l: number; src: string }> = {
  rugby: { w: 70, l: 120, src: 'World Rugby Law 1: 100 m + 2 in-goal de 10 m, 70 m de ancho' },
  futbol_americano: { w: 48.77, l: 109.73, src: 'NFL Rule 1: 53⅓ × 120 yd' },
  tenis: { w: 10.97, l: 23.77, src: 'ITF Rule 1' },
  padel: { w: 10, l: 20, src: 'FIP Reglamento de juego' },
  badminton: { w: 6.1, l: 13.4, src: 'BWF Law 1' },
  voley_playa: { w: 8, l: 16, src: 'FIVB Beach Rules 1' },
  hockey_cesped: { w: 55, l: 91.4, src: 'FIH Rules of Hockey' },
  hockey_patines: { w: 20, l: 40, src: 'World Skate Rink Hockey 2026 art. 1.8' },
  netball: { w: 15.25, l: 30.5, src: 'World Netball Rules' },
  waterpolo: { w: 20, l: 25, src: 'World Aquatics (piscina de competencia 25 × 20)' },
  ultimate: { w: 37, l: 100, src: 'WFDF Rules 2025-2028, Apéndice A' },
};
const NEW_SPORTS = Object.keys(OFFICIAL) as TacticalSport[];

/** Atributo numérico de la PRIMERA etiqueta que tenga `marker`. */
function outline(html: string) {
  const tag = html.match(/<rect[^>]*data-outline="true"[^>]*>/)?.[0];
  if (!tag) throw new Error('sin data-outline');
  const num = (a: string) => Number(tag.match(new RegExp(` ${a}="([^"]+)"`))?.[1]);
  return { x: num('x'), y: num('y'), width: num('width'), height: num('height') };
}

describe('M6f: canchas nuevas en 2D', () => {
  it('son 11 y todas son canchas de la pizarra sin biblioteca', () => {
    expect(NEW_SPORTS).toHaveLength(11);
    for (const s of NEW_SPORTS) {
      expect(BOARD_SPORTS as readonly string[], s).toContain(s);
      expect(LIBRARY_BOARD_SPORTS as readonly string[], s).not.toContain(s);
    }
  });

  it.each(NEW_SPORTS)('%s: se dibuja (renderToStaticMarkup) con su data-court y sin NaN', (s) => {
    const html = renderToStaticMarkup(<CourtBackground sport={s} />);
    expect(html.startsWith('<svg')).toBe(true);
    expect(html).toContain(`data-court="${s}"`);
    expect(html).toContain(`viewBox="0 0 ${BOARD_W} ${BOARD_H}"`);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    // Zoom a media cancha (modo arqueros / «media cancha»): misma figura, otra ventana.
    const half = renderToStaticMarkup(<CourtBackground sport={s} viewBox={`0 ${BOARD_H / 2} ${BOARD_W} ${BOARD_H / 2}`} />);
    expect(half).toContain(`viewBox="0 ${BOARD_H / 2} ${BOARD_W} ${BOARD_H / 2}"`);
  });

  it.each(NEW_SPORTS)('%s: proporción real (ancho y largo a ±1 % de la medida oficial)', (s) => {
    const o = OFFICIAL[s];
    const f = SPORTS[s].frame!;
    expect(Math.abs(f.widthM - o.w) / o.w, `${s} ancho (${o.src})`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(f.lengthM - o.l) / o.l, `${s} largo (${o.src})`).toBeLessThanOrEqual(0.01);
    // El rectángulo DIBUJADO, pasado a metros con la escala del marco.
    const r = outline(renderToStaticMarkup(<CourtBackground sport={s} />));
    expect(Math.abs(r.width / f.sx - o.w) / o.w, `${s} ancho dibujado`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(r.height / f.sy - o.l) / o.l, `${s} largo dibujado`).toBeLessThanOrEqual(0.01);
    // Proporción real con el estiramiento acotado de siempre (≤ 1,3× a lo ancho).
    expect(f.sx / f.sy).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(f.sx / f.sy).toBeLessThanOrEqual(1.3 + 1e-9);
    // Centrada en el tablero (lo guardado es agnóstico del deporte).
    expect(r.x + r.width / 2).toBeCloseTo(BOARD_W / 2, 6);
    expect(r.y + r.height / 2).toBeCloseTo(BOARD_H / 2, 6);
  });

  it('cada cancha nueva se ve distinta de todas las demás', () => {
    const htmls = NEW_SPORTS.map((s) => renderToStaticMarkup(<CourtBackground sport={s} />));
    expect(new Set(htmls).size).toBe(NEW_SPORTS.length);
  });

  it('líneas reglamentarias en su lugar', () => {
    // Tenis: líneas de saque a 6,40 m de la red; bandas de individuales a 1,37 m.
    {
      const f = SPORTS.tenis.frame!;
      const m = meters(f);
      const html = renderToStaticMarkup(<CourtBackground sport="tenis" />);
      expect(html).toContain(`y1="${m.Y(23.77 / 2 - 6.4)}"`);
      expect(html).toContain(`x1="${m.X(1.37)}"`);
      // Postes de la red a 0,914 m por fuera de la banda de dobles.
      expect(html).toContain(`cx="${m.X(-NET_M.tenis.postOutside)}"`);
    }
    // Pádel: líneas de saque a 6,95 m de la red (3,05 m de la pared).
    {
      const m = meters(SPORTS.padel.frame!);
      expect(renderToStaticMarkup(<CourtBackground sport="padel" />)).toContain(`y1="${m.Y(10 - 6.95)}"`);
    }
    // Bádminton: saque corto a 1,98 m de la red, saque largo de dobles a 0,76 m del fondo.
    {
      const m = meters(SPORTS.badminton.frame!);
      const html = renderToStaticMarkup(<CourtBackground sport="badminton" />);
      expect(html).toContain(`y1="${m.Y(6.7 - 1.98)}"`);
      expect(html).toContain(`y1="${m.Y(0.76)}"`);
    }
    // Rugby: línea de ensayo a 10 m del fondo, de 22 m y palos sobre la de ensayo.
    {
      const m = meters(SPORTS.rugby.frame!);
      const html = renderToStaticMarkup(<CourtBackground sport="rugby" />);
      expect(html).toContain(`y1="${m.Y(10)}"`);
      expect(html).toContain(`y1="${m.Y(32)}"`);
      expect(html).toContain(`x1="${m.X(35 - H_POSTS_M.rugby.width / 2)}" y1="${m.Y(10)}"`);
    }
    // Fútbol americano: zonas de anotación de 10 yd.
    {
      const m = meters(SPORTS.futbol_americano.frame!);
      const html = renderToStaticMarkup(<CourtBackground sport="futbol_americano" />);
      expect(html.match(/data-endzone="true"/g)).toHaveLength(2);
      expect(html).toContain(`y1="${m.Y(10 * 0.9144)}"`);
    }
    // Netball: tercios; hockey patines: área de 9 m; waterpolo: 2 m y 5 m; ultimate: zonas de 18 m.
    expect(renderToStaticMarkup(<CourtBackground sport="netball" />).match(/data-third="true"/g)).toHaveLength(2);
    {
      const m = meters(SPORTS.hockey_patines.frame!);
      const html = renderToStaticMarkup(<CourtBackground sport="hockey_patines" />);
      expect(html).toContain(`width="${m.X(10 + 4.5) - m.X(10 - 4.5)}"`);
    }
    {
      const html = renderToStaticMarkup(<CourtBackground sport="waterpolo" />);
      expect(html).toContain('data-wp-line="2"');
      expect(html).toContain('data-wp-line="5"');
      expect(html).toContain('data-wp-line="6"');
    }
    {
      const m = meters(SPORTS.ultimate.frame!);
      expect(renderToStaticMarkup(<CourtBackground sport="ultimate" />)).toContain(`y1="${m.Y(18)}"`);
    }
  });
});

describe('M6f: catálogo de la pizarra', () => {
  it.each(NEW_SPORTS)('%s: jugadores, posición de arranque dentro de la cancha y material', (s) => {
    const d = sportDef(s);
    expect(d.key).toBe(s);
    expect(d.formations.length).toBeGreaterThanOrEqual(1);
    const cfg = boardSportConfig(s);
    expect(cfg.courtLengthMeters).toBeCloseTo(OFFICIAL[s].l, 1);
    expect(defaultBoardFormation(cfg, 20).players).toBe(d.playersPerSide);
    expect(d.objects).toContain('ball');
  });

  it('arquero solo donde hay arquero', () => {
    for (const s of ['hockey_cesped', 'hockey_patines', 'waterpolo'] as const) expect(sportDef(s).hasGoalkeeper, s).toBe(true);
    for (const s of ['rugby', 'futbol_americano', 'tenis', 'padel', 'badminton', 'voley_playa', 'netball', 'ultimate'] as const) {
      expect(sportDef(s).hasGoalkeeper, s).toBe(false);
      expect(sportDef(s).objects, s).not.toContain('goal');
    }
  });
});

describe('M6f: 3D', () => {
  it.each(NEW_SPORTS)('%s: medidas reales y coordenadas del tablero → metros', (s) => {
    const c = court3D(s);
    const o = OFFICIAL[s];
    expect(Math.abs(c.widthM - o.w) / o.w).toBeLessThanOrEqual(0.01);
    expect(Math.abs(c.lengthM - o.l) / o.l).toBeLessThanOrEqual(0.01);
    const r = SPORTS[s].court;
    // Esquinas de la cancha (en % del tablero) → ±ancho/2, ±largo/2.
    const tl = toMeters(c, r.x0, r.y0);
    const br = toMeters(c, r.x1, r.y1);
    expect(tl.x).toBeCloseTo(-c.widthM / 2, 6);
    expect(tl.z).toBeCloseTo(-c.lengthM / 2, 6);
    expect(br.x).toBeCloseTo(c.widthM / 2, 6);
    expect(br.z).toBeCloseTo(c.lengthM / 2, 6);
    expect(toMeters(c, 50, 50)).toEqual({ x: 0, z: 0 });
  });

  it('postes, redes y arcos por deporte (data-driven)', () => {
    expect(fixtureFor('tenis')).toEqual({ kind: 'net', net: { height: 0.914, meshHeight: 0.914, postOutside: 0.914, antennas: false } });
    expect(fixtureFor('padel')).toMatchObject({ kind: 'net', net: { height: 0.88, postOutside: 0 } });
    expect(fixtureFor('badminton')).toMatchObject({ kind: 'net', net: { height: 1.524, meshHeight: 0.76 } });
    expect(fixtureFor('voley_playa')).toMatchObject({ kind: 'net', net: { height: 2.43, antennas: true } });
    expect(fixtureFor('rugby')).toEqual({ kind: 'hposts', width: 5.6, crossbar: 3, height: 11, lineFromEnd: 10 });
    expect(fixtureFor('futbol_americano')).toMatchObject({ kind: 'hposts', width: 5.64, crossbar: 3.05, lineFromEnd: 0 });
    expect(fixtureFor('hockey_cesped')).toEqual({ kind: 'goals', width: 3.66, height: 2.14 });
    expect(fixtureFor('hockey_patines')).toEqual({ kind: 'goals', width: 1.7, height: 1.05, lineFromEnd: 3 });
    expect(fixtureFor('waterpolo')).toEqual({ kind: 'goals', width: 3, height: 0.9 });
    expect(fixtureFor('netball')).toMatchObject({ kind: 'rings', height: 3.05 });
    expect(fixtureFor('ultimate').kind).toBe('none');
    // El voleibol de sala no cambia.
    expect(fixtureFor('voleibol')).toEqual({ kind: 'net', net: { height: 2.43, meshHeight: 1, postOutside: 1, antennas: true } });
  });

  it('balón/objeto de cada deporte', () => {
    expect(ballFor('rugby').style).toBe('oval');
    expect(ballFor('futbol_americano').style).toBe('oval');
    expect(ballFor('tenis').style).toBe('tennis');
    expect(ballFor('padel').style).toBe('tennis');
    expect(ballFor('badminton').style).toBe('shuttlecock');
    expect(ballFor('hockey_cesped').style).toBe('hockey');
    expect(ballFor('hockey_patines').style).toBe('hockey');
    expect(ballFor('waterpolo').style).toBe('waterpolo');
    expect(ballFor('ultimate').style).toBe('disc');
    expect(ballFor('voley_playa').style).toBe('volleyball');
  });

  it('etiqueta de la cámara de fondo', () => {
    expect(cameraLabel('detras', 'rugby')).toBe('Detrás de los palos');
    expect(cameraLabel('detras', 'hockey_cesped')).toBe('Detrás del arco');
    expect(cameraLabel('detras', 'netball')).toBe('Detrás del aro');
    expect(cameraLabel('detras', 'tenis')).toBe('Detrás de la cancha');
  });
});

describe('espejo del catálogo en el BFF', () => {
  it('bff/src/lib/sportCatalog.ts es idéntico al del frontend', () => {
    const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(read(resolve(__dirname, '../../../bff/src/lib/sportCatalog.ts'))).toBe(read(resolve(__dirname, '../lib/sports/sportCatalog.ts')));
  });
});
