/**
 * M6b «Configuración de los equipos»: modelo y valores por defecto, contraste
 * WCAG, rivales en la cancha y render de cada estilo de ficha. La regla de oro:
 * sin `teams` la pizarra se dibuja EXACTAMENTE como antes (snapshot contra la
 * misma línea base de T4).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';
import { CrestGlyph, RivalChip, TeamChipGlyph } from '@/components/school/tacticalTeamGlyphs';
import { ObjectIcon } from '@/components/school/tacticalGlyphs';
import { teamPlayerMarkup } from '@/lib/export/tacticalImage';
import { frameToStatic } from '@/lib/export/tacticalInterpolation';
import { teamVisual, playerVisual } from '@/lib/school/tactical3d';
import {
  CHIP_STYLES, CREST_DESIGNS, CREST_SHAPES, chipCaption, chipInnerText, chipLook, contrastRatio, defaultTeamsConfig,
  normalizeTeamsConfig, pointScale, readableOn, rivalSlots, shortName, type TacticalTeamsConfig,
} from '@/lib/school/tacticalTeams';
import { rivalInputFrom, applyRivalTeam } from '@/lib/school/tacticalRivalTeams';
import type { TacticalArrow } from '@/lib/school/footballQueries';

const PLAYERS = [
  { x: 50, y: 92, label: 'Arquero', jersey: 1 },
  { x: 30, y: 60, label: 'Juan Pérez' },
];
const ARROWS: TacticalArrow[] = [
  { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20, color: 'yellow' },
  { type: 'cone', x1: 5, y1: 5, x2: 5, y2: 5 },
];
const cfg = (patch: Partial<TacticalTeamsConfig> = {}): TacticalTeamsConfig => ({ ...defaultTeamsConfig({ homeName: 'Sub 12' }), ...patch });

describe('sin teams = exactamente lo de hoy', () => {
  const baseline = readFileSync(resolve(__dirname, 'fixtures/tacticalStaticSvg.futbol.baseline.svg'), 'utf8');
  it('TacticalStaticSvg con teams undefined o null es idéntico a la línea base', () => {
    expect(renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} width={360} />)).toBe(baseline);
    expect(renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} width={360} teams={null} />)).toBe(baseline);
    expect(renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={ARROWS} width={360} teams={undefined} />)).toBe(baseline);
  });
  it('el rival suelto sigue siendo el disco rojo con «R»', () => {
    const html = renderToStaticMarkup(<svg><ObjectIcon type="opponent" x={10} y={10} /></svg>);
    expect(html).toContain('fill="#dc2626"');
    expect(html).toContain('>R</text>');
  });
  it('normalizeTeamsConfig de algo que no es objeto = null (aspecto de siempre)', () => {
    for (const raw of [null, undefined, 'x', 3, []]) expect(normalizeTeamsConfig(raw)).toBeNull();
  });
  it('pointScale sin teams = 1', () => {
    expect(pointScale(null, 'cone')).toBe(1);
    expect(pointScale(cfg({ object_scale: 1.4, player_scale: 0.8 }), 'cone')).toBe(1.4);
    expect(pointScale(cfg({ object_scale: 1.4, player_scale: 0.8 }), 'opponent')).toBe(0.8);
  });
});

describe('modelo y valores por defecto', () => {
  it('los defaults reproducen los colores de siempre', () => {
    const d = defaultTeamsConfig({ homeName: 'Sub 12' });
    expect(d.home.colors.primary).toBe('#10b981');
    expect(d.home.gk_colors.primary).toBe('#eab308');
    expect(d.away.colors.primary).toBe('#dc2626');
    expect(d.home.caption).toBe('position');
    expect(d.export_names).toBe(false);
    expect(d.home.crest).toEqual({ kind: 'generated', shape: 'shield', design: 'plain', initials: 'S1' });
    expect(defaultTeamsConfig({ hasSchoolLogo: true }).home.crest).toEqual({ kind: 'school_logo' });
  });
  it('normaliza lo raro sin romper: hex inválido, estilos fuera de catálogo, escalas, plantilla', () => {
    const n = normalizeTeamsConfig({
      home: { colors: { primary: 'rojo', secondary: '#ABCDEF' }, chip_style: 'foto', caption: 'name' },
      away: { crest: { kind: 'school_logo' }, roster: [{ number: 9, alias: 'Flaco' }, { number: 9 }, { number: 120 }, 'x'] },
      player_scale: 9, object_scale: -1, export_names: 'si',
    })!;
    expect(n.home.colors.primary).toBe('#10b981');
    expect(n.home.colors.secondary).toBe('#abcdef');
    expect(n.home.chip_style).toBe('disc');
    expect(n.home.caption).toBe('name');
    expect(n.away.crest.kind).toBe('generated'); // el rival nunca usa el logo de la escuela
    expect(n.away.roster).toEqual([{ number: 9, alias: 'Flaco' }]);
    expect(n.player_scale).toBe(1.6);
    expect(n.object_scale).toBe(0.6);
    expect(n.export_names).toBe(false);
  });
  it('textos: dentro y debajo, con y sin permiso de nombres', () => {
    const t = { ...cfg().home, caption: 'name' as const };
    const s = { number: '7', name: 'Juan Pablo Pérez', position: 'Extremo' };
    expect(chipInnerText(t, s)).toBe('7');
    expect(chipInnerText({ ...t, inner: 'initials' }, s)).toBe('JP');
    expect(chipInnerText(t, { ...s, number: null })).toBe('JP'); // sin dorsal: iniciales, como hoy
    expect(chipInnerText({ ...t, inner: 'none' }, s)).toBe('');
    expect(chipCaption(t, s)).toBe('Juan P.');
    expect(chipCaption(t, s, false)).toBe('Extremo'); // exportación sin «Mostrar nombres»
    expect(chipCaption({ ...t, caption: 'initials' }, s, false)).toBe('Extremo');
    expect(chipCaption({ ...t, caption: 'number' }, s)).toBe('7');
    expect(chipCaption({ ...t, caption: 'none' }, s)).toBe('');
    expect(shortName('Ana')).toBe('Ana');
  });
});

describe('contraste (WCAG ≥ 3:1)', () => {
  it('razón conocida: blanco/negro = 21', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
  it('respeta el color del coach si se lee', () => {
    expect(readableOn('#facc15', ['#111827'])).toBe('#facc15');
  });
  it('corrige un número que no se lee (amarillo sobre blanco → oscuro; azul oscuro sobre negro → blanco)', () => {
    expect(readableOn('#fde68a', ['#ffffff'])).toBe('#0f172a');
    expect(readableOn('#1e3a8a', ['#000000'])).toBe('#ffffff');
  });
  it('rayas: el número va sobre un parche del color principal y se lee contra él', () => {
    const t = { ...cfg().home, chip_style: 'stripes_v' as const, colors: { primary: '#ffffff', secondary: '#000000', number: '#ffffff' } };
    const look = chipLook(t, false);
    expect(contrastRatio(look.text, look.fill)).toBeGreaterThanOrEqual(3);
    expect(look.text).not.toBe('#ffffff'); // blanco sobre blanco no se leía
    const html = renderToStaticMarkup(<svg><TeamChipGlyph look={look} text="7" /></svg>);
    expect(html).toContain('r="6.6"'); // el parche liso
  });
  it('arquero distinto toma sus colores; sin la opción, los del equipo', () => {
    const t = cfg().home;
    expect(chipLook(t, true).fill).toBe('#eab308');
    expect(chipLook({ ...t, gk_distinct: false }, true).fill).toBe('#10b981');
  });
});

describe('rivales en la cancha', () => {
  const arrows: TacticalArrow[] = [
    { type: 'opponent', x1: 50, y1: 40, x2: 50, y2: 40 },
    { type: 'cone', x1: 5, y1: 5, x2: 5, y2: 5 },
    { type: 'opponent', x1: 50, y1: 6, x2: 50, y2: 6 },
    { type: 'opponent', x1: 30, y1: 30, x2: 30, y2: 30 },
  ];
  it('numera por orden con la plantilla y reconoce al arquero junto al arco de arriba', () => {
    const t = cfg();
    t.away.roster = [{ number: 4, alias: 'Muro' }, { number: 1 }];
    const m = rivalSlots(arrows, t);
    expect([...m.keys()]).toEqual([0, 2, 3]);
    expect(m.get(0)).toMatchObject({ ordinal: 0, number: '4', alias: 'Muro', isGK: false });
    expect(m.get(2)).toMatchObject({ number: '1', isGK: true });
    expect(m.get(3)).toMatchObject({ number: '3', alias: '' }); // sin fila: ordinal + 1
  });
  it('sin arquero en el deporte, nadie es arquero', () => {
    expect([...rivalSlots(arrows, cfg(), false).values()].some((s) => s.isGK)).toBe(false);
  });
  it('el SVG estático pinta al rival con sus colores y número', () => {
    const t = cfg();
    t.away = { ...t.away, colors: { primary: '#123456', secondary: '#fde68a', number: '#ffffff' }, chip_style: 'stripes_v' };
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={arrows} teams={t} />);
    expect(html).toContain('fill="#123456"');
    expect(html).toContain('fill="#fde68a"');
    expect(html).not.toContain('>R</text>');
    expect(html.match(/data-chip="stripes_v"/g)).toHaveLength(3);
  });
});

describe('render de cada estilo', () => {
  it.each(CHIP_STYLES)('%s', (style) => {
    const t = { ...cfg().home, chip_style: style, colors: { primary: '#0033aa', secondary: '#ffcc00', number: '#ffffff' } };
    const html = renderToStaticMarkup(<svg><TeamChipGlyph look={chipLook(t, false)} text="10" /></svg>);
    expect(html).toContain(`data-chip="${style}"`);
    expect(html).toContain('10');
    expect(html).toContain('#0033aa');
    if (style !== 'disc') expect(html).toContain('#ffcc00');
    expect(html).not.toMatch(/NaN|undefined|clip-path/);
  });
  it('jugadores propios en el SVG estático: estilo, color, número y etiqueta', () => {
    const t = cfg();
    t.home = { ...t.home, chip_style: 'jersey', colors: { primary: '#7c3aed', secondary: '#ffffff', number: '#ffffff' } };
    const html = renderToStaticMarkup(<TacticalStaticSvg players={PLAYERS} arrows={[]} teams={t} />);
    expect(html.match(/data-chip="jersey"/g)).toHaveLength(2);
    expect(html).toContain('#7c3aed'); // jugador de campo
    expect(html).toContain('#eab308'); // arquero distinto
    expect(html).toContain('>Arquero</text>');
  });
  it('tamaño global: el radio del disco se escala', () => {
    const t = cfg({ player_scale: 1.5 });
    const html = renderToStaticMarkup(<TacticalStaticSvg players={[PLAYERS[1]]} arrows={[]} teams={t} />);
    expect(html).toContain('r="16.5"');
  });
  it('escudos genéricos: cada forma y diseño, sin imágenes', () => {
    for (const shape of CREST_SHAPES) for (const design of CREST_DESIGNS) {
      const html = renderToStaticMarkup(<CrestGlyph crest={{ kind: 'generated', shape, design, initials: 'JFC' }} primary="#dc2626" secondary="#fde68a" numberColor="#111827" />);
      expect(html).toContain('JFC');
      expect(html).not.toContain('<image');
    }
  });
  it('escudo propio con el logo de la escuela', () => {
    const html = renderToStaticMarkup(<CrestGlyph crest={{ kind: 'school_logo' }} primary="#000000" secondary="#fff" numberColor="#fff" logoUrl="https://x.test/logo.png" />);
    expect(html).toContain('href="https://x.test/logo.png"');
  });
  it('RivalChip sin fila de plantilla no rompe', () => {
    expect(renderToStaticMarkup(<svg><RivalChip teams={cfg()} slot={undefined} /></svg>)).toContain('data-chip="disc"');
  });
});

describe('exportar y 3D', () => {
  it('frameToStatic lleva el nombre solo si se lo pasan', () => {
    const f = { id: 'f', duration_ms: 1000, players: [{ key: 'profile:1', x: 1, y: 2 }], ball: null, arrows: [] };
    expect(frameToStatic(f, { 'profile:1': 'Medio' }, {}).players[0].name).toBeUndefined();
    expect(frameToStatic(f, { 'profile:1': 'Medio' }, {}, { 'profile:1': 'Ana Ruiz' }).players[0].name).toBe('Ana Ruiz');
  });
  it('ficha suelta del video/GIF: SVG autocontenido con el color del equipo', () => {
    const t = cfg();
    t.home = { ...t.home, colors: { primary: '#0ea5e9', secondary: '#0c4a6e', number: '#ffffff' } };
    const svg = teamPlayerMarkup(t, { label: 'Medio', jersey: 8 }, 4);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('#0ea5e9');
    expect(svg).toContain('>8</text>');
  });
  it('3D: la figura toma camiseta, pantaloneta y dorsal del equipo', () => {
    const t = cfg();
    t.home = { ...t.home, colors: { primary: '#ffffff', secondary: '#1d4ed8', number: '#ffffff' } };
    const v = teamVisual(playerVisual('k', { labels: { k: 'Medio' }, jerseys: { k: 8 }, sport: 'futbol' }), t.home);
    expect(v).toMatchObject({ color: '#ffffff', shorts: '#1d4ed8', number: '8' });
    expect(v.numberColor).toBe('#0f172a'); // blanco sobre blanco no se lee
  });
});

describe('Equipos almacenados (mapeo)', () => {
  it('rival de la jugada → cuerpo del POST y de vuelta', () => {
    const t = cfg();
    t.away = { ...t.away, name: 'Jaguar F.C.', crest: { kind: 'generated', shape: 'circle', design: 'stripes', initials: 'JFC' }, chip_style: 'stripes_h', roster: [{ number: 9, alias: 'Flaco' }] };
    const body = rivalInputFrom(t.away);
    expect(body).toEqual({
      name: 'Jaguar F.C.', short_name: 'JFC', color_primary: '#dc2626', color_secondary: '#7f1d1d', color_number: '#ffffff',
      crest: { kind: 'generated', shape: 'circle', design: 'stripes', initials: 'JFC' }, chip_style: 'stripes_h', roster: [{ number: 9, alias: 'Flaco' }],
    });
    const back = applyRivalTeam(cfg().away, { ...body, id: 'r1', school_id: 's' });
    expect(back).toMatchObject({ name: 'Jaguar F.C.', chip_style: 'stripes_h', rival_team_id: 'r1', roster: [{ number: 9, alias: 'Flaco' }] });
  });
});
