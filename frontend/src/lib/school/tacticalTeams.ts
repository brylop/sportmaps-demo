/**
 * «Configuración de los equipos» de la pizarra (M6b de
 * docs/specs/pizarra-m6-paridad-tacticalpad.md; migración 20261015142003).
 *
 * Modelo PURO (sin React): tipos, valores por defecto, lectura tolerante del
 * jsonb `teams` de una jugada, contraste del número (WCAG 3:1) y quién es quién
 * entre los rivales. Espejo de bff/src/routes/school/tacticalTeamsShapes.ts.
 *
 * Regla de oro: una jugada SIN `teams` (null/undefined) se dibuja EXACTAMENTE
 * como siempre — cada render mira `teams` y, si no está, toma el camino viejo.
 * Estos valores por defecto solo arrancan el diálogo; no cambian nada hasta
 * que el coach toca «Listo».
 *
 * Privacidad: el equipo propio usa la plantilla REAL (nunca viaja en el
 * jsonb); los nombres de nuestros atletas se ven dentro de la escuela y en
 * una exportación pública solo si el coach prende «Mostrar nombres»
 * (`export_names`, apagado por defecto). El rival lleva solo número y alias.
 */
import type { TacticalArrow } from './footballQueries';

export const CHIP_STYLES = ['disc', 'jersey', 'stripes_v', 'stripes_h', 'silhouette'] as const;
export type TeamChipStyle = (typeof CHIP_STYLES)[number];
export const INNER_TEXTS = ['number', 'initials', 'none'] as const;
export type TeamInnerText = (typeof INNER_TEXTS)[number];
export const CAPTIONS = ['position', 'number', 'initials', 'name', 'none'] as const;
export type TeamCaption = (typeof CAPTIONS)[number];
export const CREST_SHAPES = ['shield', 'circle', 'square', 'diamond'] as const;
export type CrestShape = (typeof CREST_SHAPES)[number];
export const CREST_DESIGNS = ['plain', 'stripes', 'band', 'chevron', 'halves', 'cross', 'star'] as const;
export type CrestDesign = (typeof CREST_DESIGNS)[number];

export const CHIP_STYLE_LABEL: Record<TeamChipStyle, string> = {
  disc: 'Disco con número', jersey: 'Camiseta lisa', stripes_v: 'Rayas verticales', stripes_h: 'Rayas horizontales', silhouette: 'Silueta',
};
export const INNER_LABEL: Record<TeamInnerText, string> = { number: 'Número', initials: 'Iniciales', none: 'Nada' };
export const CAPTION_LABEL: Record<TeamCaption, string> = {
  position: 'Posición', number: 'Número', initials: 'Iniciales', name: 'Nombre', none: 'Nada',
};
export const CREST_SHAPE_LABEL: Record<CrestShape, string> = { shield: 'Escudo', circle: 'Círculo', square: 'Cuadro', diamond: 'Rombo' };
export const CREST_DESIGN_LABEL: Record<CrestDesign, string> = {
  plain: 'Liso', stripes: 'Rayas', band: 'Banda', chevron: 'Chevrón', halves: 'Mitades', cross: 'Cruz', star: 'Estrella',
};

export interface TeamColors { primary: string; secondary: string; number: string }
export type TeamCrest =
  | { kind: 'school_logo' }
  | { kind: 'generated'; shape: CrestShape; design: CrestDesign; initials: string };

export interface RivalRosterEntry { number: number; alias?: string }

export interface TacticalTeamConfig {
  name: string;
  crest: TeamCrest;
  colors: TeamColors;
  chip_style: TeamChipStyle;
  /** Lo que va DENTRO de la ficha. */
  inner: TeamInnerText;
  /** Lo que va DEBAJO de la ficha. */
  caption: TeamCaption;
  gk_distinct: boolean;
  gk_colors: TeamColors;
}
export interface TacticalAwayConfig extends TacticalTeamConfig {
  roster: RivalRosterEntry[];
  /** Rival de «Equipos almacenados» del que salió (si salió de uno). */
  rival_team_id: string | null;
}
export interface TacticalTeamsConfig {
  v: 1;
  home: TacticalTeamConfig;
  away: TacticalAwayConfig;
  /** Tamaño global de jugadores (propios y rivales): multiplica al de siempre. */
  player_scale: number;
  /** Tamaño global del material: multiplica al tamaño de cada objeto. */
  object_scale: number;
  /** Exportación pública (PNG/PDF/video/compartir) con nombres/iniciales de
   *  NUESTROS atletas. Apagado por defecto: sale número + posición. */
  export_names: boolean;
}

export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.6;
export const MAX_RIVAL_ROSTER = 30;
export const MAX_ALIAS = 16;
export const MAX_TEAM_NAME = 60;

// ─── Colores de siempre (lo que la pizarra dibuja hoy) ──────────────────────
/** Disco del equipo propio (degradé esmeralda) y del arquero (amarillo). */
export const LEGACY_HOME = { primary: '#10b981', secondary: '#047857', number: '#ffffff' } as const;
export const LEGACY_GK = { primary: '#eab308', secondary: '#a16207', number: '#ffffff' } as const;
export const LEGACY_RIVAL = { primary: '#dc2626', secondary: '#7f1d1d', number: '#ffffff' } as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v);

export function initialsFrom(name: string, max = 3): string {
  const words = name.normalize('NFC').split(/[\s.\-_/]+/).filter(Boolean);
  const raw = words.length >= 2 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, max);
  return raw.replace(/[^\p{L}\p{N}]/gu, '').slice(0, max).toUpperCase();
}

export function defaultTeamsConfig(opts: { homeName?: string; hasSchoolLogo?: boolean } = {}): TacticalTeamsConfig {
  const homeName = (opts.homeName ?? '').trim().slice(0, MAX_TEAM_NAME) || 'Mi equipo';
  return {
    v: 1,
    home: {
      name: homeName,
      crest: opts.hasSchoolLogo ? { kind: 'school_logo' } : { kind: 'generated', shape: 'shield', design: 'plain', initials: initialsFrom(homeName) },
      colors: { ...LEGACY_HOME },
      chip_style: 'disc',
      inner: 'number',
      caption: 'position',
      gk_distinct: true,
      gk_colors: { ...LEGACY_GK },
    },
    away: {
      name: 'Rival',
      crest: { kind: 'generated', shape: 'shield', design: 'plain', initials: 'RIV' },
      colors: { ...LEGACY_RIVAL },
      chip_style: 'disc',
      inner: 'number',
      caption: 'none',
      gk_distinct: true,
      gk_colors: { primary: '#111827', secondary: '#374151', number: '#facc15' },
      roster: [],
      rival_team_id: null,
    },
    player_scale: 1,
    object_scale: 1,
    export_names: false,
  };
}

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback);
const clampScale = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, v)) : 1);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

function normColors(v: unknown, fb: TeamColors): TeamColors {
  const c = isObj(v) ? v : {};
  return {
    primary: isHex(c.primary) ? c.primary.toLowerCase() : fb.primary,
    secondary: isHex(c.secondary) ? c.secondary.toLowerCase() : fb.secondary,
    number: isHex(c.number) ? c.number.toLowerCase() : fb.number,
  };
}
function normCrest(v: unknown, fb: TeamCrest, allowLogo: boolean): TeamCrest {
  if (!isObj(v)) return fb;
  if (v.kind === 'school_logo') return allowLogo ? { kind: 'school_logo' } : fb;
  return {
    kind: 'generated',
    shape: pick(v.shape, CREST_SHAPES, 'shield'),
    design: pick(v.design, CREST_DESIGNS, 'plain'),
    initials: typeof v.initials === 'string' ? v.initials.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() : '',
  };
}
function normTeam(v: unknown, fb: TacticalTeamConfig, allowLogo: boolean): TacticalTeamConfig {
  const t = isObj(v) ? v : {};
  return {
    name: typeof t.name === 'string' ? t.name.slice(0, MAX_TEAM_NAME) : fb.name,
    crest: normCrest(t.crest, fb.crest, allowLogo),
    colors: normColors(t.colors, fb.colors),
    chip_style: pick(t.chip_style, CHIP_STYLES, fb.chip_style),
    inner: pick(t.inner, INNER_TEXTS, fb.inner),
    caption: pick(t.caption, CAPTIONS, fb.caption),
    gk_distinct: typeof t.gk_distinct === 'boolean' ? t.gk_distinct : fb.gk_distinct,
    gk_colors: normColors(t.gk_colors, fb.gk_colors),
  };
}
export function normRoster(v: unknown): RivalRosterEntry[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  const out: RivalRosterEntry[] = [];
  for (const r of v) {
    if (!isObj(r) || !Number.isInteger(r.number) || r.number < 0 || r.number > 99 || seen.has(r.number)) continue;
    seen.add(r.number);
    const alias = typeof r.alias === 'string' ? r.alias.trim().slice(0, MAX_ALIAS) : '';
    out.push(alias ? { number: r.number, alias } : { number: r.number });
    if (out.length >= MAX_RIVAL_ROSTER) break;
  }
  return out;
}

/** jsonb `teams` de una jugada → configuración completa, o null (= aspecto de
 *  siempre). Tolerante: un campo raro cae a su valor por defecto. */
export function normalizeTeamsConfig(raw: unknown): TacticalTeamsConfig | null {
  if (!isObj(raw)) return null;
  const d = defaultTeamsConfig();
  const awayRaw = isObj(raw.away) ? raw.away : {};
  return {
    v: 1,
    home: normTeam(raw.home, d.home, true),
    away: {
      ...normTeam(raw.away, d.away, false),
      roster: normRoster(awayRaw.roster),
      rival_team_id: typeof awayRaw.rival_team_id === 'string' ? awayRaw.rival_team_id : null,
    },
    player_scale: clampScale(raw.player_scale),
    object_scale: clampScale(raw.object_scale),
    export_names: raw.export_names === true,
  };
}

// ─── Contraste (WCAG 2.x) ───────────────────────────────────────────────────

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
export function relativeLuminance(hex: string): number {
  const h = isHex(hex) ? hex : '#000000';
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Mínimo para texto grande / elementos gráficos (WCAG 1.4.11). */
export const MIN_CONTRAST = 3;
const LIGHT = '#ffffff';
const DARK = '#0f172a';

/** El color del número si se lee sobre TODOS los fondos (≥ 3:1); si no, el
 *  que mejor se lea entre blanco y casi negro. */
export function readableOn(preferred: string, backgrounds: string[]): string {
  const minOf = (c: string) => Math.min(...backgrounds.map((b) => contrastRatio(c, b)));
  if (isHex(preferred) && minOf(preferred) >= MIN_CONTRAST) return preferred.toLowerCase();
  return minOf(LIGHT) >= minOf(DARK) ? LIGHT : DARK;
}
/** Contorno del número: el opuesto (claro sobre oscuro y al revés). */
export const outlineFor = (textColor: string) => (relativeLuminance(textColor) > 0.4 ? DARK : LIGHT);

// ─── Aspecto resuelto de una ficha ──────────────────────────────────────────

export interface ChipLook {
  style: TeamChipStyle;
  fill: string;
  accent: string;
  /** Número ya corregido por contraste. */
  text: string;
  /** Contorno del número. */
  outline: string;
}

export function chipLook(team: TacticalTeamConfig, isGK: boolean): ChipLook {
  const c = isGK && team.gk_distinct ? team.gk_colors : team.colors;
  // Con rayas el número va sobre un parche liso del color principal: basta
  // con contrastar contra ese color.
  const text = readableOn(c.number, [c.primary]);
  return { style: team.chip_style, fill: c.primary, accent: c.secondary, text, outline: outlineFor(text) };
}

/** «Juan Pablo Pérez» → «Juan P.» (nombre corto, para la etiqueta). */
export function shortName(full: string): string {
  const w = full.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '';
  const first = w[0].length > 10 ? `${w[0].slice(0, 9)}…` : w[0];
  return w.length > 1 ? `${first} ${w[1][0].toUpperCase()}.` : first;
}
export function personInitials(full: string): string {
  return full.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export interface ChipSubject {
  /** Dorsal (null = sin dorsal). */
  number: string | null;
  /** Nombre real (propios, solo dentro de la escuela) o alias (rival). */
  name?: string | null;
  /** Etiqueta de posición (slot_label). */
  position?: string | null;
}

/** Texto DENTRO de la ficha. Sin dorsal cae a iniciales (como hoy). */
export function chipInnerText(team: TacticalTeamConfig, s: ChipSubject): string {
  if (team.inner === 'none') return '';
  const ini = s.name ? personInitials(s.name) : personInitials(s.position ?? '');
  if (team.inner === 'initials') return ini;
  return s.number ?? ini;
}

/** Texto DEBAJO de la ficha. `allowNames=false` (exportación pública sin
 *  «Mostrar nombres») convierte nombre/iniciales en la posición. */
export function chipCaption(team: TacticalTeamConfig, s: ChipSubject, allowNames = true): string {
  let mode = team.caption;
  if (!allowNames && (mode === 'name' || mode === 'initials')) mode = 'position';
  switch (mode) {
    case 'none': return '';
    case 'number': return s.number ?? '';
    case 'initials': return s.name ? personInitials(s.name) : '';
    case 'name': return s.name ? shortName(s.name) : (s.position ?? '');
    default: return s.position ?? '';
  }
}

// ─── Rivales en la cancha ───────────────────────────────────────────────────

export interface RivalSlot {
  /** 0, 1, 2… en el orden en que se pusieron. */
  ordinal: number;
  isGK: boolean;
  number: string;
  alias: string;
}

/** Banda de la cancha (% de alto desde arriba) donde el rival más adelantado
 *  hacia el arco de arriba se toma como su arquero. */
export const RIVAL_GK_BAND = 20;

/** Índice de figura → datos del rival. El rival i lleva la fila i de su
 *  plantilla (o el número i+1 si no hay plantilla). Su arquero: el rival más
 *  cerca del arco de arriba si está dentro de RIVAL_GK_BAND, y solo en
 *  deportes con arquero. */
export function rivalSlots(arrows: TacticalArrow[], teams: TacticalTeamsConfig, hasGoalkeeper = true): Map<number, RivalSlot> {
  const out = new Map<number, RivalSlot>();
  let gkIndex = -1;
  let gkY = Infinity;
  let ordinal = 0;
  arrows.forEach((a, i) => {
    if (a.type !== 'opponent') return;
    const entry = teams.away.roster[ordinal];
    out.set(i, { ordinal, isGK: false, number: String(entry ? entry.number : ordinal + 1), alias: entry?.alias ?? '' });
    if (hasGoalkeeper && a.y1 <= RIVAL_GK_BAND && a.y1 < gkY) { gkY = a.y1; gkIndex = i; }
    ordinal++;
  });
  if (gkIndex >= 0) out.get(gkIndex)!.isGK = true;
  return out;
}

/** Escala de un objeto de un punto: los rivales son jugadores. */
export const pointScale = (teams: TacticalTeamsConfig | null | undefined, type: string | undefined) =>
  !teams ? 1 : type === 'opponent' ? teams.player_scale : teams.object_scale;
