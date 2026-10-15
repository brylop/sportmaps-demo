/**
 * M6b: validación pura de la configuración de equipos y de los rivales
 * guardados (tacticalTeamsShapes.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  aliasProblem, isMissingTeamsColumn, sanitizeTeamsConfig, validateRivalTeamBody, validateRoster, validateTeamsConfig,
  MAX_RIVAL_ROSTER,
} from './tacticalTeamsShapes';

const colors = (p = '#10b981') => ({ primary: p, secondary: '#047857', number: '#FFFFFF' });
const team = (extra: Record<string, unknown> = {}) => ({
  name: 'Mi equipo', crest: { kind: 'generated', shape: 'shield', design: 'plain', initials: 'me' },
  colors: colors(), chip_style: 'disc', inner: 'number', caption: 'position', gk_distinct: true, gk_colors: colors('#eab308'), ...extra,
});
const config = (extra: Record<string, unknown> = {}) => ({
  v: 1, home: team({ crest: { kind: 'school_logo' } }), away: { ...team({ name: 'Jaguar FC' }), roster: [{ number: 9, alias: 'Flaco' }], rival_team_id: null },
  player_scale: 1, object_scale: 1.2, export_names: false, ...extra,
});

describe('alias del rival (solo apodos, nunca nombres completos)', () => {
  it.each([['Flaco'], ['El 9'], ["D'Artagnan"], ['Ñoño'], ['Pibe-2']])('acepta «%s»', (a) => expect(aliasProblem(a)).toBeNull());
  it.each([
    ['Ana Paz Gil', /2 palabras/],
    ['Juan Carlos Pérez', /16|2 palabras/],
    ['NombreLarguisimoDeVerdad', /16/],
    ['a@b.co', /solo admite/],
    ['3001234567', /números largos/],
    ['', /vacío/],
    ['<script>', /solo admite/],
  ])('rechaza «%s»', (a, re) => expect(aliasProblem(a)).toMatch(re));
  it('no es texto', () => expect(aliasProblem(9)).toMatch(/texto/));
});

describe('plantilla del rival', () => {
  it('acepta hasta 30 con número y alias', () => {
    const roster = Array.from({ length: MAX_RIVAL_ROSTER }, (_, i) => ({ number: i + 1, alias: `J${i}` }));
    expect(validateRoster(roster)).toEqual([]);
  });
  it('rechaza 31', () => {
    const roster = Array.from({ length: 31 }, (_, i) => ({ number: i }));
    expect(validateRoster(roster)[0]).toMatch(/máximo 30/);
  });
  it('rechaza campos extra (nada de fecha de nacimiento ni documento)', () => {
    expect(validateRoster([{ number: 3, alias: 'Tito', birthdate: '2014-01-01' }])[0]).toMatch(/solo se guardan número y alias/);
  });
  it('rechaza números fuera de 0-99, repetidos o no enteros', () => {
    expect(validateRoster([{ number: 100 }]).join()).toMatch(/0 a 99/);
    expect(validateRoster([{ number: 2.5 }]).join()).toMatch(/0 a 99/);
    expect(validateRoster([{ number: 4 }, { number: 4 }]).join()).toMatch(/repetido/);
  });
});

describe('teams por jugada', () => {
  it('undefined y null son válidos (no tocar / aspecto de siempre)', () => {
    expect(validateTeamsConfig(undefined)).toEqual([]);
    expect(validateTeamsConfig(null)).toEqual([]);
    expect(sanitizeTeamsConfig(null)).toBeNull();
  });
  it('acepta una configuración completa y la sanea (hex en minúscula, sin claves extra)', () => {
    const raw = { ...config(), hacker: 1, home: { ...config().home, extra: 'x' } };
    expect(validateTeamsConfig(raw)).toEqual([]);
    const s = sanitizeTeamsConfig(raw) as any;
    expect(s.hacker).toBeUndefined();
    expect(s.home.extra).toBeUndefined();
    expect(s.home.colors.number).toBe('#ffffff');
    expect(s.away.crest.initials).toBe('ME');
    expect(s.away.roster).toEqual([{ number: 9, alias: 'Flaco' }]);
  });
  it('rechaza colores que no son hex', () => {
    const bad = config({ home: team({ colors: { primary: 'red', secondary: '#000', number: '#fff' } }) });
    const errs = validateTeamsConfig(bad).join(' ');
    expect(errs).toMatch(/home\.colors\.primary/);
    expect(errs).toMatch(/home\.colors\.secondary/);
  });
  it('rechaza escudos con imagen y el logo de la escuela en el rival', () => {
    expect(validateTeamsConfig(config({ home: team({ crest: { kind: 'generated', shape: 'shield', design: 'plain', url: 'https://x/y.png' } }) })).join()).toMatch(/imágenes/);
    expect(validateTeamsConfig(config({ away: { ...config().away, crest: { kind: 'school_logo' } } })).join()).toMatch(/no usa el logo/);
  });
  it('rechaza estilos, textos y escalas fuera del catálogo', () => {
    const errs = validateTeamsConfig(config({ player_scale: 3, home: team({ chip_style: 'foto', caption: 'cedula' }) })).join(' ');
    expect(errs).toMatch(/player_scale/);
    expect(errs).toMatch(/chip_style/);
    expect(errs).toMatch(/caption/);
  });
  it('el equipo propio NO lleva plantilla en el jsonb (usa la real)', () => {
    expect(validateTeamsConfig(config({ home: team({ roster: [{ number: 1 }] }) })).join()).toMatch(/plantilla real/);
  });
  it('detecta la columna teams faltante', () => {
    expect(isMissingTeamsColumn({ code: '42703', message: 'column match_lineups.teams does not exist' })).toBe(true);
    expect(isMissingTeamsColumn({ code: 'PGRST204', message: "Could not find the 'teams' column" })).toBe(true);
    expect(isMissingTeamsColumn({ code: '42703', message: 'column frames does not exist' })).toBe(false);
  });
});

describe('cuerpo de un rival guardado', () => {
  const body = {
    name: '  Jaguar   F.C. ', short_name: 'jag', color_primary: '#DC2626', color_secondary: '#fde68a', color_number: '#111827',
    crest: { kind: 'generated', shape: 'circle', design: 'stripes', initials: 'JFC' }, chip_style: 'stripes_v',
    roster: [{ number: 1, alias: 'Muro' }, { number: 10 }],
  };
  it('POST válido, saneado', () => {
    const { errors, value } = validateRivalTeamBody(body);
    expect(errors).toEqual([]);
    expect(value).toMatchObject({ name: 'Jaguar F.C.', short_name: 'JAG', color_primary: '#dc2626', chip_style: 'stripes_v' });
    expect(value.roster).toEqual([{ number: 1, alias: 'Muro' }, { number: 10 }]);
  });
  it('POST sin nombre ni colores', () => {
    const errs = validateRivalTeamBody({}).errors.join(' ');
    expect(errs).toMatch(/name/);
    expect(errs).toMatch(/color_primary/);
  });
  it('rechaza campos no permitidos (school_id, created_by)', () => {
    expect(validateRivalTeamBody({ ...body, school_id: 'x', created_by: 'y' }).errors.join()).toMatch(/no permitidos: school_id, created_by/);
  });
  it('PATCH parcial y vacío', () => {
    expect(validateRivalTeamBody({ color_primary: '#000000' }, true)).toEqual({ errors: [], value: { color_primary: '#000000' } });
    expect(validateRivalTeamBody({}, true).errors[0]).toMatch(/Nada/);
  });
  it('rechaza un alias con nombre completo', () => {
    expect(validateRivalTeamBody({ ...body, roster: [{ number: 7, alias: 'María José Gómez' }] }).errors.join()).toMatch(/2 palabras/);
  });
});
