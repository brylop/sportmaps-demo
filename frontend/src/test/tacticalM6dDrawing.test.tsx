/**
 * M6d — herramientas de dibujo y «Campo»: geometría pura (onda de conducción,
 * doble línea de disparo, polígonos, toque de zonas giradas, numeración, foco),
 * cámaras/viewBox con la inversión de coordenadas al arrastrar, la
 * pseudo-figura `court` y el render de cada estilo en TacticalStaticSvg.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TacticalArrow } from '@/lib/school/footballQueries';
import {
  buildPolygonZone, decorateNewShape, isM6dShape, lineCenterSvg, lineStylesIn, moveVertex, moveZone, nextSeq, offsetPolyline,
  pointInPolygon, polylineLength, renumber, seqAnchorSvg, snapToNearest, styledLineGeometry, wavyPoints, zoneBorderNear,
  zoneContains, DEFAULT_DRAW_OPTIONS, LINE_STYLES, POLYGON_MAX_POINTS,
} from '@/lib/school/tacticalDrawing';
import {
  CAMERA_VIEW, courtOf, drawableShapes, isDefaultCourt, keepCourtOnly, mapBoardPoint, normalizeCourt, resolveCourtLook,
  staticViewBox, templatesFor, viewForCourt, withCourt, COURT_TEMPLATES, inkForSurface,
} from '@/lib/school/tacticalCourt';
import { eraserHits, hydrateShape, viewBoxOf, yFromView, yToView, GK_VIEW } from '@/lib/school/tacticalGeometry';
import { pitchPctFromPx, repositionedCenterPx } from '@/lib/school/tacticalBoardLogic';
import { closesPolygon } from '@/lib/school/useTacticalDrawTools';
import { TacticalStaticSvg, staticSvgHeight } from '@/components/school/TacticalStaticSvg';
import { CourtBackground } from '@/components/school/courts/CourtBackground';
import { SPORTS } from '@/lib/school/tacticalSports';

const line = (extra: Partial<TacticalArrow> = {}): TacticalArrow => ({ type: 'arrow', x1: 20, y1: 80, x2: 60, y2: 30, ...extra });

describe('líneas con estilo', () => {
  it('la conducción ondula alrededor de la recta y termina en la punta', () => {
    const center = lineCenterSvg(line());
    const wave = wavyPoints(center);
    expect(wave.length).toBeGreaterThan(10);
    // Se aparta de la recta (hay onda) pero nunca más que la amplitud.
    const a = center[0];
    const b = center[center.length - 1];
    const dist = (p: { x: number; y: number }) => Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / Math.hypot(b.x - a.x, b.y - a.y);
    const offs = wave.map(dist);
    expect(Math.max(...offs)).toBeGreaterThan(1.5);
    expect(Math.max(...offs)).toBeLessThanOrEqual(2.61);
    expect(wave[wave.length - 1].x).toBeCloseTo(b.x);
    expect(wave[wave.length - 1].y).toBeCloseTo(b.y);
    // Es más larga que la recta (zigzag/onda real).
    expect(polylineLength(wave)).toBeGreaterThan(polylineLength(center) * 1.05);
  });
  it('la curva con estilo sigue la misma comba que la curva de siempre', () => {
    const c = lineCenterSvg(line({ type: 'curve' }));
    expect(c.length).toBe(33);
    expect(c[0]).toEqual({ x: 60, y: 272 });
    expect(c[32].x).toBeCloseTo(180);
    expect(c[32].y).toBeCloseTo(102);
  });
  it('el disparo son dos líneas paralelas a 1,9 de la central', () => {
    const g = styledLineGeometry(line(), 'shot');
    expect(g.paths).toHaveLength(2);
    const off = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2);
    expect(off[0].x).toBeCloseTo(0);
    expect(off[0].y).toBeCloseTo(2);
  });
  it('pase discontinuo, carrera continua y todas con punta', () => {
    const pass = styledLineGeometry(line(), 'pass');
    const run = styledLineGeometry(line(), 'run');
    expect(pass.dash).toBe('6 4');
    expect(run.dash).toBeUndefined();
    for (const s of LINE_STYLES) expect(styledLineGeometry(line(), s).head.size).toBeGreaterThan(0);
  });
  it('una línea de largo cero no revienta', () => {
    for (const s of LINE_STYLES) expect(() => styledLineGeometry(line({ x2: 20, y2: 80 }), s)).not.toThrow();
  });
});

describe('zonas', () => {
  const rect: TacticalArrow = { type: 'zone', form: 'rect', x1: 40, y1: 40, x2: 60, y2: 50 };
  it('rectángulo: adentro/afuera y el borde', () => {
    expect(zoneContains(rect, { x: 50, y: 45 })).toBe(true);
    expect(zoneContains(rect, { x: 65, y: 45 })).toBe(false);
    expect(zoneBorderNear(rect, { x: 40.5, y: 45 }, 1.5)).toBe(true);
    expect(zoneBorderNear(rect, { x: 50, y: 45 }, 1.5)).toBe(false); // el centro no es borde: no roba el toque al jugador
  });
  it('rectángulo girado 90°: el hit-test gira con él', () => {
    const r90 = { ...rect, rot: 90 };
    // 20 de ancho × 10 de alto en %: girado, la punta de la derecha queda afuera.
    expect(zoneContains(rect, { x: 58, y: 45 })).toBe(true);
    expect(zoneContains(r90, { x: 58, y: 45 })).toBe(false);
    // y aparece arriba del centro (lo que era el ancho ahora es alto, en espacio SVG).
    expect(zoneContains(r90, { x: 50, y: 40 })).toBe(true);
  });
  it('elipse: las esquinas de su caja quedan afuera', () => {
    const e = { ...rect, form: 'ellipse' as const };
    expect(zoneContains(e, { x: 50, y: 45 })).toBe(true);
    expect(zoneContains(e, { x: 41, y: 41 })).toBe(false);
    expect(zoneContains(rect, { x: 41, y: 41 })).toBe(true);
  });
  it('polígono: punto en polígono, borde y caja', () => {
    const z = buildPolygonZone([{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 25, y: 40 }], 'red')!;
    expect(z).toMatchObject({ type: 'zone', form: 'polygon', x1: 10, y1: 10, x2: 40, y2: 40, points: [10, 10, 40, 10, 25, 40] });
    expect(zoneContains(z, { x: 25, y: 20 })).toBe(true);
    expect(zoneContains(z, { x: 12, y: 35 })).toBe(false);
    expect(zoneBorderNear(z, { x: 25, y: 10.5 }, 1)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBe(true);
    expect(eraserHits(z, { x: 25, y: 10 }, 1)).toBe(true);
    expect(eraserHits(z, { x: 25, y: 20 }, 1)).toBe(false);
  });
  it('polígono: menos de 3 vértices no se crea; más de 24 se recorta; redondea y acota a la cancha', () => {
    expect(buildPolygonZone([{ x: 1, y: 1 }, { x: 2, y: 2 }], 'red')).toBeNull();
    const many = Array.from({ length: 40 }, (_, i) => ({ x: i, y: (i * 7) % 100 }));
    expect(buildPolygonZone(many, 'red')!.points!.length).toBe(POLYGON_MAX_POINTS * 2);
    expect(buildPolygonZone([{ x: -5, y: 10.123 }, { x: 120, y: 10 }, { x: 50, y: 50 }], 'red')!.points).toEqual([0, 10.12, 100, 10, 50, 50]);
  });
  it('cerrar tocando el primer vértice', () => {
    const pts = [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 25, y: 40 }];
    expect(closesPolygon(pts, { x: 11, y: 11 })).toBe(true);
    expect(closesPolygon(pts, { x: 30, y: 30 })).toBe(false);
    expect(closesPolygon(pts.slice(0, 2), { x: 10, y: 10 })).toBe(false);
  });
  it('mover una zona no la saca de la cancha y mueve los vértices', () => {
    const z = buildPolygonZone([{ x: 90, y: 10 }, { x: 98, y: 10 }, { x: 95, y: 20 }], 'red')!;
    const moved = moveZone(z, 10, 5);
    expect(moved.x2).toBe(100);
    expect(moved.points).toEqual([92, 15, 100, 15, 97, 25]);
    expect(moveZone(rect, -100, 0).x1).toBe(0);
    const v = moveVertex(z, 2, { x: 50, y: 60 });
    expect(v).toMatchObject({ x1: 50, y2: 60 });
  });
});

describe('foco y numeración', () => {
  it('el foco se pega al jugador cercano y no a uno lejano', () => {
    const players = [{ x: 30, y: 30 }, { x: 70, y: 70 }];
    expect(snapToNearest({ x: 32, y: 31 }, players)).toEqual({ x: 30, y: 30 });
    expect(snapToNearest({ x: 50, y: 50 }, players)).toEqual({ x: 50, y: 50 });
  });
  it('numera en orden y renumera sin huecos', () => {
    const shapes: TacticalArrow[] = [line({ seq: 1 }), line(), line({ seq: 4 })];
    expect(nextSeq(shapes)).toBe(5);
    expect(nextSeq([])).toBe(1);
    expect(renumber(shapes).map((s) => s.seq)).toEqual([1, undefined, 2]);
    const a = seqAnchorSvg(line());
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
  });
  it('decorateNewShape: sin opciones = la figura de siempre; con opciones agrega estilo, forma y número', () => {
    const base = line();
    expect(decorateNewShape(base, undefined, [])).toEqual(base);
    expect(decorateNewShape(base, DEFAULT_DRAW_OPTIONS, [])).toEqual(base);
    expect(decorateNewShape(base, { ...DEFAULT_DRAW_OPTIONS, lineStyle: 'dribble', autoNumber: true }, [line({ seq: 2 })]))
      .toEqual({ ...base, line: 'dribble', seq: 3 });
    expect(decorateNewShape({ ...base, type: 'zone' }, { ...DEFAULT_DRAW_OPTIONS, zoneForm: 'ellipse' }, []).form).toBe('ellipse');
    // El estilo no se pega a un recorrido de balón ni a una zona.
    expect(decorateNewShape({ ...base, type: 'ball_path', kind: 'pase' }, { ...DEFAULT_DRAW_OPTIONS, lineStyle: 'pass' }, []).line).toBeUndefined();
  });
  it('isM6dShape: las figuras viejas siguen por el camino viejo', () => {
    expect(isM6dShape(line())).toBe(false);
    expect(isM6dShape({ type: 'zone', x1: 1, y1: 1, x2: 2, y2: 2 })).toBe(false);
    expect(isM6dShape(line({ line: 'pass' }))).toBe(true);
    expect(isM6dShape({ type: 'spotlight', x1: 1, y1: 1, x2: 1, y2: 1 })).toBe(true);
    expect(lineStylesIn([line({ line: 'shot' }), line({ line: 'pass' }), line({ line: 'shot' })])).toEqual(['pass', 'shot']);
  });
  it('hydrateShape conserva los campos nuevos (numeric de Postgres como string)', () => {
    const raw = { type: 'zone', form: 'polygon', points: ['1', '2', '3', '4', '5', '6'], fill: '0.3', seq: '2', x1: '1', y1: 2, x2: 5, y2: 6 } as unknown as TacticalArrow;
    expect(hydrateShape(raw)).toMatchObject({ form: 'polygon', points: [1, 2, 3, 4, 5, 6], fill: 0.3, seq: 2, x1: 1 });
  });
});

describe('«Campo»: pseudo-figura court', () => {
  it('la configuración de siempre no agrega nada (jugadas viejas intactas)', () => {
    const arrows = [line()];
    expect(withCourt(arrows, {})).toBe(arrows);
    expect(withCourt(arrows, { cam: 'full', goals: true })).toBe(arrows);
    expect(isDefaultCourt({ cam: 'full' })).toBe(true);
  });
  it('pone, reemplaza en su lugar y quita', () => {
    const a = withCourt([line(), line()], { tpl: 'thirds' });
    expect(a).toHaveLength(3);
    expect(courtOf(a)).toEqual({ tpl: 'thirds' });
    const b = withCourt(a, { tpl: 'lanes5', cam: 'half_bottom' });
    expect(b).toHaveLength(3);
    expect(b[2].court).toEqual({ tpl: 'lanes5', cam: 'half_bottom' });
    expect(withCourt(b, {})).toHaveLength(2);
    expect(drawableShapes(b)).toHaveLength(2);
    expect(keepCourtOnly(b)).toHaveLength(1);
    expect(normalizeCourt({ tpl: 'inventada' as string })).toEqual({});
    expect(eraserHits(b[2], { x: 0, y: 0 }, 50)).toBe(false);
  });
  it('pizarra blanca: lo blanco se dibuja en negro; el material conserva su color', () => {
    const arrows: TacticalArrow[] = [line(), line({ color: 'red' }), { type: 'cone', x1: 1, y1: 1, x2: 1, y2: 1 }, { type: 'zone', x1: 1, y1: 1, x2: 5, y2: 5, color: 'white' }];
    const ink = inkForSurface({ surface: 'whiteboard' }, arrows);
    expect(ink.map((a) => a.color)).toEqual(['black', 'red', undefined, 'black']);
    expect(inkForSurface({ surface: 'wood' }, arrows)).toBe(arrows);
  });
  it('plantillas por deporte: carriles y half-spaces solo en canchas de fútbol', () => {
    expect(templatesFor('futbol').length).toBe(COURT_TEMPLATES.length);
    expect(templatesFor('baloncesto').some((t) => t.id === 'half_spaces')).toBe(false);
    expect(templatesFor('baloncesto').some((t) => t.id === 'grid3x3')).toBe(true);
  });
  it('colores: piso, césped y líneas pisan los del deporte en ese orden', () => {
    const base = SPORTS.futsal.colors;
    expect(resolveCourtLook(base, {}).court).toBe(base.court);
    expect(resolveCourtLook(base, { surface: 'wood' }).court).toBe('#d6a66e');
    expect(resolveCourtLook(base, { surface: 'wood', grass: '#123456' }).court).toBe('#123456');
    expect(resolveCourtLook(base, { surface: 'whiteboard' }).line).toBe('#334155');
    expect(resolveCourtLook(base, { surface: 'whiteboard', lines: '#ff0000' }).line).toBe('#ff0000');
    expect(resolveCourtLook(base, { tpl: 'no_lines' }).hideLines).toBe(true);
  });
});

describe('cámaras: ventana visible e inversión de coordenadas al arrastrar', () => {
  it('cada cámara es una ventana vertical de la cancha completa', () => {
    expect(viewForCourt({})).toEqual({ y0: 0, y1: 100 });
    expect(viewForCourt({ cam: 'half_bottom' })).toEqual(CAMERA_VIEW.half_bottom);
    expect(viewForCourt({ cam: 'area' })).toEqual(GK_VIEW);
    expect(viewForCourt({ cam: 'area' }, false)).toEqual({ y0: 0, y1: 100 }); // sin arco: no hay área
    expect(viewBoxOf(CAMERA_VIEW.half_top)).toBe(`0 0 300 ${54 * 3.4}`);
  });
  it.each(Object.entries(CAMERA_VIEW))('cámara %s: pantalla → cancha → pantalla vuelve al mismo punto', (_k, v) => {
    for (const y of [v.y0, (v.y0 + v.y1) / 2, v.y1]) {
      expect(yFromView(yToView(y, v), v)).toBeCloseTo(y, 9);
    }
    // Soltar en el centro de la caja visible = el centro de la ventana, en cancha completa.
    const rect = { left: 100, top: 50, width: 300, height: 300 * ((v.y1 - v.y0) * 3.4) / 300 };
    const drop = pitchPctFromPx({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect, v);
    expect(drop.inside).toBe(true);
    expect(drop.x).toBeCloseTo(50);
    expect(drop.y).toBeCloseTo((v.y0 + v.y1) / 2);
    // Arrastrar 0 px no mueve a nadie (la ida y vuelta es exacta).
    const placed = { x: 30, y: Math.min(v.y1, v.y0 + 10) };
    const c = repositionedCenterPx(placed, rect, { x: 0, y: 0 }, v);
    const back = pitchPctFromPx(c, rect, v);
    expect(back.x).toBeCloseTo(placed.x);
    expect(back.y).toBeCloseTo(placed.y);
  });
  it('orientación horizontal (render estático): el arco rival queda a la derecha', () => {
    expect(staticViewBox({ orient: 'h' })).toEqual({ x: 0, y: 0, w: 340, h: 300 });
    expect(mapBoardPoint({ orient: 'h' }, 150, 0)).toEqual({ x: 340, y: 150 }); // arco rival (arriba) → derecha
    expect(mapBoardPoint({ orient: 'h' }, 0, 340)).toEqual({ x: 0, y: 0 });
    expect(staticViewBox({ orient: 'h', cam: 'half_bottom' })).toEqual({ x: 0, y: 0, w: 54 * 3.4, h: 300 });
    expect(staticViewBox({ cam: 'half_bottom' })).toEqual({ x: 0, y: 46 * 3.4, w: 300, h: 54 * 3.4 });
  });
});

describe('render de cada estilo y del «Campo» en TacticalStaticSvg', () => {
  it.each(LINE_STYLES)('estilo %s: dibujo + leyenda', (style) => {
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={[line({ line: style }), line({ type: 'curve', line: style, x1: 70 })]} width={300} />);
    expect(html.match(new RegExp(`data-line="${style}"`, 'g'))).toHaveLength(2);
    expect(html).toContain('data-legend="lines"');
    expect(html).toContain(style === 'dribble' ? 'Conducción' : style === 'shot' ? 'Disparo' : style === 'pass' ? 'Pase' : 'Carrera sin balón');
  });
  it('zonas, foco y números', () => {
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[{ x: 50, y: 50, label: 'Volante' }]} arrows={[
      { type: 'zone', form: 'ellipse', x1: 20, y1: 20, x2: 40, y2: 30, rot: 30, fill: 0.3, color: 'blue' },
      buildPolygonZone([{ x: 10, y: 60 }, { x: 30, y: 60 }, { x: 20, y: 80 }], 'red')!,
      { type: 'spotlight', x1: 50, y1: 50, x2: 50, y2: 50 },
      line({ seq: 1 }), line({ seq: 2, line: 'pass', x1: 70 }),
    ]} />);
    expect(html).toContain('data-form="ellipse"');
    expect(html).toContain('rotate(30');
    expect(html).toContain('fill-opacity="0.3"');
    expect(html).toContain('data-form="polygon"');
    expect(html).toContain('data-shape="spotlight"');
    expect(html).toContain('data-seq="1"');
    expect(html).toContain('data-seq="2"');
  });
  it('cámara media cancha + piso de madera + plantilla: viewBox, alto y fondo', () => {
    const arrows = withCourt([line()], { cam: 'half_bottom', surface: 'wood', tpl: 'lanes_thirds' });
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={arrows} width={300} sport="futsal" />);
    expect(html).toContain(`viewBox="0 ${46 * 3.4} 300 ${54 * 3.4}"`);
    expect(html).toContain(`height="${Math.round((300 * 54 * 3.4) / 300)}"`);
    expect(staticSvgHeight(arrows, 300)).toBe(Math.round(54 * 3.4));
    expect(html).toContain('#d6a66e');
    expect(html).toContain('data-court-template="lanes_thirds"');
    expect(html).not.toContain('data-shape="court"');
  });
  it('horizontal: cancha girada, jugadores y textos derechos', () => {
    const arrows = withCourt([{ type: 'text', x1: 50, y1: 50, x2: 50, y2: 50, text: 'Presión' }], { orient: 'h' });
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[{ x: 50, y: 0, label: 'Delantero' }]} arrows={arrows} width={340} />);
    expect(html).toContain('viewBox="0 0 340 300"');
    expect(html).toContain('matrix(0 1 -1 0 340 0)');
    expect(html).toContain('rotate(-90 150 170)'); // el texto se endereza
    expect(html).toContain('cx="340" cy="150"'); // jugador del arco rival, a la derecha
  });
  it('pizarra blanca: líneas oscuras y sin las líneas reglamentarias en «Sin líneas»', () => {
    const white = renderToStaticMarkup(<CourtBackground sport="futbol" court={{ surface: 'whiteboard' }} />);
    expect(white).toContain('#ffffff');
    expect(white).toContain('stroke="#334155"');
    const none = renderToStaticMarkup(<CourtBackground sport="futbol7" court={{ tpl: 'no_lines' }} />);
    const normal = renderToStaticMarkup(<CourtBackground sport="futbol7" />);
    expect(none.length).toBeLessThan(normal.length);
    expect(none).toContain('data-court-template="no_lines"');
  });
  it('todas las plantillas dibujan en todos los deportes sin reventar', () => {
    for (const sport of Object.keys(SPORTS) as (keyof typeof SPORTS)[]) {
      for (const t of templatesFor(sport)) {
        const html = renderToStaticMarkup(<CourtBackground sport={sport} court={{ tpl: t.id }} />);
        expect(html).toContain(`data-court-template="${t.id}"`);
      }
    }
  });
});
