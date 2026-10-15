/**
 * Validación de la «Configuración de los equipos» de la pizarra (M6b de
 * docs/specs/pizarra-m6-paridad-tacticalpad.md; migración 20261015142003):
 *
 *  - `teams` por jugada (match_lineups.teams / team_tactical_presets.teams)
 *  - el cuerpo de un rival guardado («Equipos almacenados», tactical_rival_teams)
 *
 * Lógica pura (sin Express ni base) para probarla en unidad. Espejo de
 * frontend/src/lib/school/tacticalTeams.ts: si se amplía un catálogo allá, se
 * amplía acá y en los CHECK de la migración.
 *
 * Privacidad: la plantilla del rival es SOLO número + alias. Un alias es un
 * apodo corto («Flaco», «El 9»), nunca el nombre completo de un menor de otra
 * escuela: máximo 16 caracteres, 2 palabras, sin arrobas ni dígitos largos
 * (teléfonos, documentos) ni correos.
 */

export const CHIP_STYLES = ['disc', 'jersey', 'stripes_v', 'stripes_h', 'silhouette'] as const;
export const INNER_TEXTS = ['number', 'initials', 'none'] as const;
export const CAPTIONS = ['position', 'number', 'initials', 'name', 'none'] as const;
export const CREST_SHAPES = ['shield', 'circle', 'square', 'diamond'] as const;
export const CREST_DESIGNS = ['plain', 'stripes', 'band', 'chevron', 'halves', 'cross', 'star'] as const;

export const MAX_RIVAL_ROSTER = 30;
export const MAX_ALIAS = 16;
export const MAX_ALIAS_WORDS = 2;
export const MAX_TEAM_NAME = 60;
export const MAX_SHORT_NAME = 4;
export const MAX_INITIALS = 3;
export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.6;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ALIAS_RE = /^[\p{L}\p{N} .'-]+$/u;
const SHORT_RE = /^[\p{L}\p{N}]+$/u;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v);

/** Un alias aceptable: corto, máximo 2 palabras, solo letras/números/espacio/.-'
 *  y sin más de 2 dígitos seguidos (un número de documento o de teléfono no es
 *  un apodo). Devuelve el motivo del rechazo o null. */
export function aliasProblem(alias: unknown): string | null {
  if (typeof alias !== 'string') return 'el alias debe ser texto';
  const a = alias.trim();
  if (a.length < 1) return 'el alias no puede estar vacío';
  if (a.length > MAX_ALIAS) return `el alias tiene máximo ${MAX_ALIAS} caracteres`;
  if (!ALIAS_RE.test(a)) return 'el alias solo admite letras, números, espacio, punto, guion y apóstrofo';
  if (a.split(/\s+/).length > MAX_ALIAS_WORDS) return `el alias tiene máximo ${MAX_ALIAS_WORDS} palabras (un apodo, no el nombre completo)`;
  if (/\d{3,}/.test(a)) return 'el alias no puede llevar números largos';
  return null;
}

export interface RivalRosterEntry { number: number; alias?: string }

export function validateRoster(roster: unknown): string[] {
  if (roster === undefined) return [];
  if (!Array.isArray(roster)) return ['roster debe ser una lista.'];
  if (roster.length > MAX_RIVAL_ROSTER) return [`roster: máximo ${MAX_RIVAL_ROSTER} jugadores.`];
  const errors: string[] = [];
  const seen = new Set<number>();
  roster.forEach((r, i) => {
    if (!isPlainObject(r)) { errors.push(`roster[${i}]: debe ser un objeto.`); return; }
    const extra = Object.keys(r).filter((k) => k !== 'number' && k !== 'alias');
    if (extra.length) errors.push(`roster[${i}]: solo se guardan número y alias (sobra: ${extra.join(', ')}).`);
    if (!Number.isInteger(r.number) || r.number < 0 || r.number > 99) errors.push(`roster[${i}]: el número va de 0 a 99.`);
    else if (seen.has(r.number)) errors.push(`roster[${i}]: número ${r.number} repetido.`);
    else seen.add(r.number);
    if (r.alias !== undefined && r.alias !== null && r.alias !== '') {
      const p = aliasProblem(r.alias);
      if (p) errors.push(`roster[${i}]: ${p}.`);
    }
  });
  return errors;
}

export function sanitizeRoster(roster: unknown): RivalRosterEntry[] {
  if (!Array.isArray(roster)) return [];
  return roster.map((r: any) => {
    const alias = typeof r.alias === 'string' ? r.alias.trim().replace(/\s+/g, ' ') : '';
    return alias ? { number: r.number, alias } : { number: r.number };
  });
}

function validateColors(c: unknown, path: string): string[] {
  if (!isPlainObject(c)) return [`${path}: debe ser un objeto {primary, secondary, number}.`];
  const out: string[] = [];
  for (const k of ['primary', 'secondary', 'number'] as const) {
    if (!isHexColor(c[k])) out.push(`${path}.${k}: color inválido (formato #RRGGBB).`);
  }
  return out;
}

export function validateCrest(c: unknown, path = 'crest'): string[] {
  if (!isPlainObject(c)) return [`${path}: debe ser un objeto.`];
  if ('url' in c || 'image' in c || 'src' in c) return [`${path}: no se aceptan imágenes; usa un escudo genérico.`];
  if (c.kind === 'school_logo') return Object.keys(c).length === 1 ? [] : [`${path}: school_logo no lleva más campos.`];
  const out: string[] = [];
  if (c.kind !== undefined && c.kind !== 'generated') out.push(`${path}.kind inválido.`);
  if (!(CREST_SHAPES as readonly string[]).includes(c.shape)) out.push(`${path}.shape inválido.`);
  if (!(CREST_DESIGNS as readonly string[]).includes(c.design)) out.push(`${path}.design inválido.`);
  if (c.initials !== undefined && c.initials !== '') {
    if (typeof c.initials !== 'string' || c.initials.length > MAX_INITIALS || !SHORT_RE.test(c.initials)) {
      out.push(`${path}.initials: hasta ${MAX_INITIALS} letras o números.`);
    }
  }
  return out;
}

function sanitizeCrest(c: Record<string, any>) {
  if (c.kind === 'school_logo') return { kind: 'school_logo' };
  return { kind: 'generated', shape: c.shape, design: c.design, initials: typeof c.initials === 'string' ? c.initials.toUpperCase() : '' };
}

function validateTeam(t: unknown, side: 'home' | 'away'): string[] {
  const path = `teams.${side}`;
  if (!isPlainObject(t)) return [`${path}: debe ser un objeto.`];
  const out: string[] = [];
  if (typeof t.name !== 'string' || t.name.trim().length > MAX_TEAM_NAME) out.push(`${path}.name: texto de máximo ${MAX_TEAM_NAME}.`);
  out.push(...validateCrest(t.crest, `${path}.crest`));
  if (side === 'away' && isPlainObject(t.crest) && t.crest.kind === 'school_logo') out.push(`${path}.crest: el rival no usa el logo de la escuela.`);
  out.push(...validateColors(t.colors, `${path}.colors`));
  out.push(...validateColors(t.gk_colors, `${path}.gk_colors`));
  if (!(CHIP_STYLES as readonly string[]).includes(t.chip_style)) out.push(`${path}.chip_style inválido.`);
  if (!(INNER_TEXTS as readonly string[]).includes(t.inner)) out.push(`${path}.inner inválido.`);
  if (!(CAPTIONS as readonly string[]).includes(t.caption)) out.push(`${path}.caption inválido.`);
  if (typeof t.gk_distinct !== 'boolean') out.push(`${path}.gk_distinct debe ser true/false.`);
  if (side === 'away') {
    out.push(...validateRoster(t.roster ?? []).map((e) => `${path}.${e}`));
    if (t.rival_team_id != null && (typeof t.rival_team_id !== 'string' || !UUID_RE.test(t.rival_team_id))) out.push(`${path}.rival_team_id inválido.`);
  } else if (t.roster !== undefined) {
    // La plantilla propia es la real del equipo: nunca viaja en el jsonb.
    out.push(`${path}.roster: el equipo propio usa su plantilla real.`);
  }
  return out;
}

/** `teams` del body de una alineación o jugada guardada. undefined = no tocar;
 *  null = volver al aspecto de siempre. */
export function validateTeamsConfig(teams: unknown): string[] {
  if (teams === undefined || teams === null) return [];
  if (!isPlainObject(teams)) return ['teams debe ser un objeto.'];
  const out: string[] = [];
  if (teams.v !== 1) out.push('teams.v debe ser 1.');
  out.push(...validateTeam(teams.home, 'home'), ...validateTeam(teams.away, 'away'));
  for (const k of ['player_scale', 'object_scale'] as const) {
    if (typeof teams[k] !== 'number' || !Number.isFinite(teams[k]) || teams[k] < SCALE_MIN || teams[k] > SCALE_MAX) {
      out.push(`teams.${k}: entre ${SCALE_MIN} y ${SCALE_MAX}.`);
    }
  }
  if (typeof teams.export_names !== 'boolean') out.push('teams.export_names debe ser true/false.');
  return out;
}

function sanitizeTeam(t: Record<string, any>, side: 'home' | 'away') {
  const colors = (c: any) => ({ primary: c.primary.toLowerCase(), secondary: c.secondary.toLowerCase(), number: c.number.toLowerCase() });
  const base = {
    name: String(t.name).trim(),
    crest: sanitizeCrest(t.crest),
    colors: colors(t.colors),
    chip_style: t.chip_style,
    inner: t.inner,
    caption: t.caption,
    gk_distinct: t.gk_distinct,
    gk_colors: colors(t.gk_colors),
  };
  if (side === 'home') return base;
  return { ...base, roster: sanitizeRoster(t.roster ?? []), rival_team_id: t.rival_team_id ?? null };
}

/** Solo las claves conocidas (descarta cualquier campo extra que mande el cliente). */
export function sanitizeTeamsConfig(teams: Record<string, any> | null): Record<string, unknown> | null {
  if (teams === null) return null;
  return {
    v: 1,
    home: sanitizeTeam(teams.home, 'home'),
    away: sanitizeTeam(teams.away, 'away'),
    player_scale: Math.round(teams.player_scale * 100) / 100,
    object_scale: Math.round(teams.object_scale * 100) / 100,
    export_names: teams.export_names,
  };
}

/** La columna `teams` todavía no existe en la base (migración sin aplicar). */
export function isMissingTeamsColumn(err: unknown): boolean {
  if (!isPlainObject(err)) return false;
  const code = String(err.code ?? '');
  const msg = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`;
  return (code === '42703' || code === 'PGRST204') && /\bteams\b/.test(msg);
}

// ─── Rival guardado («Equipos almacenados») ─────────────────────────────────

export interface RivalTeamInput {
  name: string;
  short_name: string | null;
  color_primary: string;
  color_secondary: string;
  color_number: string;
  crest: Record<string, unknown>;
  chip_style: string;
  roster: RivalRosterEntry[];
}

/** POST (partial=false) o PATCH (partial=true) de un rival guardado. */
export function validateRivalTeamBody(body: unknown, partial = false): { errors: string[]; value: Partial<RivalTeamInput> } {
  if (!isPlainObject(body)) return { errors: ['El cuerpo debe ser un objeto.'], value: {} };
  const errors: string[] = [];
  const value: Partial<RivalTeamInput> = {};
  const has = (k: string) => body[k] !== undefined;
  const allowed = ['name', 'short_name', 'color_primary', 'color_secondary', 'color_number', 'crest', 'chip_style', 'roster'];
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) errors.push(`Campos no permitidos: ${extra.join(', ')}.`);

  if (has('name') || !partial) {
    const n = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (n.length < 1 || n.length > MAX_TEAM_NAME) errors.push(`name: obligatorio, máximo ${MAX_TEAM_NAME} caracteres.`);
    else value.name = n;
  }
  if (has('short_name')) {
    const s = body.short_name;
    if (s === null || s === '') value.short_name = null;
    else if (typeof s !== 'string' || s.length > MAX_SHORT_NAME || !SHORT_RE.test(s)) errors.push(`short_name: hasta ${MAX_SHORT_NAME} letras o números.`);
    else value.short_name = s.toUpperCase();
  } else if (!partial) value.short_name = null;
  for (const k of ['color_primary', 'color_secondary', 'color_number'] as const) {
    if (has(k) || !partial) {
      if (!isHexColor(body[k])) errors.push(`${k}: color inválido (formato #RRGGBB).`);
      else value[k] = (body[k] as string).toLowerCase();
    }
  }
  if (has('crest') || !partial) {
    const crestErr = validateCrest(body.crest);
    if (isPlainObject(body.crest) && body.crest.kind === 'school_logo') crestErr.push('crest: el rival no usa el logo de la escuela.');
    if (crestErr.length) errors.push(...crestErr);
    else value.crest = sanitizeCrest(body.crest);
  }
  if (has('chip_style') || !partial) {
    if (!(CHIP_STYLES as readonly string[]).includes(body.chip_style)) errors.push('chip_style inválido.');
    else value.chip_style = body.chip_style;
  }
  if (has('roster') || !partial) {
    const rErr = validateRoster(body.roster ?? []);
    if (rErr.length) errors.push(...rErr);
    else value.roster = sanitizeRoster(body.roster ?? []);
  }
  if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push('Nada que actualizar.');
  return { errors, value };
}
