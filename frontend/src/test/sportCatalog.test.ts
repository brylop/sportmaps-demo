/**
 * Catálogo único de deportes (src/lib/sports/sportCatalog.ts, M1 de
 * docs/specs/pizarra-multideporte-3d-ia.md): resolveSport contra TODOS los
 * textos reales de la base, sinónimos, desconocidos, niveles de pizarra (D2),
 * hasTacticalBoard / isFootballSport (D3) y deportes de una escuela (D1).
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_SPORTS,
  LIBRARY_BOARD_SPORTS,
  SPORT_CATALOG,
  boardSportFromTeam,
  hasExerciseLibrary,
  hasTacticalBoard,
  isFootballSport,
  normalizeSportText,
  resolveSport,
  schoolBoardSports,
  teamBoardAccess,
} from '@/lib/sports/sportCatalog';
import { TACTICAL_SPORTS, isTacticalSport } from '@/lib/school/tacticalSports';
import { REAL_SPORT_TEXTS } from './fixtures/deportesReales';

describe('resolveSport: textos reales de la base (2026-10-14)', () => {
  it.each(REAL_SPORT_TEXTS.map((r) => [r.source, r.text, r] as const))('%s %j', (_src, text, r) => {
    const out = resolveSport(text);
    expect(out.key).toBe(r.key);
    expect(out.boardLevel).toBe(r.boardLevel);
    expect(out.tacticalSport).toBe(r.tacticalSport);
  });

  it('ningún texto de teams.sport queda sin mapear', () => {
    const teams = REAL_SPORT_TEXTS.filter((r) => r.source === 'teams.sport');
    expect(teams.length).toBeGreaterThanOrEqual(25);
    expect(teams.filter((r) => resolveSport(r.text).match === 'ninguno').map((r) => r.text)).toEqual([]);
  });

  it('niveles D2 de los equipos reales', () => {
    const level = (t: string) => resolveSport(t).boardLevel;
    for (const t of ['Fútbol', 'Voleibol', 'Baloncesto']) expect(level(t), t).toBe('completa');
    for (const t of ['Waterpolo', 'Tenis', 'Pádel']) expect(level(t), t).toBe('cancha');
    for (const t of [
      'Cheerleading All Stars', 'Natación', 'Gimnasia Artística', 'Karate', 'Patinaje de Velocidad en Línea', 'Golf',
      'Cheerleading All-Star', 'Porrismo', 'Patinaje', 'mma', 'Boxeo', 'Gimnasio', 'Atletismo', 'Lucha Libre',
      'Piragüismo Eslalon', 'CrossFit', 'Crosstraining', 'Piragüismo Esprint', 'Saltos Acuáticos', 'Cheerleading',
    ]) expect(level(t), t).toBe('ninguna');
  });

  it('porrismo = cheerleading en todas sus variantes', () => {
    for (const t of ['Porrismo', 'Cheerleading', 'Cheerleading All Stars', 'Cheerleading All-Star', 'cheerleading all-stars', 'CHEER']) {
      expect(resolveSport(t).key, t).toBe('cheerleading');
    }
  });

  it('las variantes de patinaje van juntas (menos el artístico)', () => {
    for (const t of ['Patinaje', 'Patinaje de Velocidad en Línea', 'Patinaje de carreras', 'patinaje en linea']) {
      expect(resolveSport(t).key, t).toBe('patinaje');
    }
    expect(resolveSport('Patinaje artístico').key).toBe('patinaje_artistico');
  });
});

describe('resolveSport: sinónimos y normalización', () => {
  const cases: [string, string][] = [
    // fútbol
    ['fútbol', 'futbol'], ['FUTBOL', 'futbol'], ['Soccer', 'futbol'], ['futbol_11', 'futbol'], ['Fútbol 11', 'futbol'],
    ['Fútbol 7', 'futbol7'], ['F7', 'futbol7'], ['fútbol-7', 'futbol7'], ['Fútbol 5', 'futbol5'], ['Minifutbol', 'futbol5'],
    // futsal
    ['Fútbol Sala', 'futsal'], ['futbol_sala', 'futsal'], ['Futsal', 'futsal'], ['Microfútbol', 'futsal'],
    ['micro-fútbol', 'futsal'], ['Fútbol de salón', 'futsal'],
    // voleibol
    ['Vóley', 'voleibol'], ['voley', 'voleibol'], ['Voleibol', 'voleibol'], ['Volleyball', 'voleibol'], ['VOLLEYBALL', 'voleibol'],
    ['Vóleibol', 'voleibol'], ['Volei', 'voleibol'],
    // baloncesto
    ['Básquet', 'baloncesto'], ['basket', 'baloncesto'], ['Basketball', 'baloncesto'], ['Básquetbol', 'baloncesto'], ['BALONCESTO', 'baloncesto'],
    // balonmano
    ['Balonmano', 'balonmano'], ['Handball', 'balonmano'], ['hand-ball', 'balonmano'],
    // cancha
    ['Waterpolo', 'waterpolo'], ['Water polo', 'waterpolo'], ['Tenis de campo', 'tenis'], ['Pádel', 'padel'], ['Paddle', 'padel'],
    ['Vóley playa', 'voley_playa'], ['voleibol_playa', 'voley_playa'], ['Beach volleyball', 'voley_playa'],
    // sin pizarra
    ['Natacion', 'natacion'], ['MMA (Artes Marciales Mixtas)', 'mma'], ['Karate Do', 'karate'], ['Tenis de mesa', 'tenis_mesa'],
    ['Multideportes', 'multideporte'],
    // con calificativo / cargo
    ['Voleibol — Metodólogo', 'voleibol'], ['Coordinadora de Tenis', 'tenis'], ['Fútbol — equipo mayores', 'futbol'],
  ];
  it.each(cases)('%j → %s', (text, key) => {
    expect(resolveSport(text).key).toBe(key);
  });

  it('el tenis de mesa no es tenis ni el vóley playa es voleibol de sala', () => {
    expect(resolveSport('Tenis de mesa').boardLevel).toBe('ninguna');
    expect(resolveSport('Vóley playa')).toMatchObject({ boardLevel: 'cancha', tacticalSport: 'voley_playa' });
    expect(hasTacticalBoard('Vóley playa')).toBe(true);
    expect(hasExerciseLibrary('Vóley playa')).toBe(false);
  });

  it('aproximado: contiene un deporte del catálogo', () => {
    const r = resolveSport('Fútbol formativo — Sub-8 a Sub-15');
    expect(r).toMatchObject({ key: 'futbol', match: 'aproximado', boardLevel: 'completa' });
    expect(resolveSport('Basket 3x3 femenino')).toMatchObject({ key: 'baloncesto', match: 'aproximado' });
  });

  it('normaliza tildes, mayúsculas, guiones y signos', () => {
    expect(normalizeSportText('  Piragüismo—Eslalon (A) ')).toBe('piraguismo eslalon a');
  });
});

describe('resolveSport: desconocidos', () => {
  it.each(['Poker', 'coach', 'Entrenador', 'Otro', 'Gerencia General', 'Quidditch', 'Hockeyh Sobre Hielo'])('%j → sin pizarra, para el reporte', (t) => {
    const r = resolveSport(t);
    expect(r).toMatchObject({ key: 'desconocido', boardLevel: 'ninguna', match: 'ninguno', label: t });
    expect(r.tacticalSport).toBeUndefined();
    expect(hasTacticalBoard(t)).toBe(false);
  });

  it('vacío o null → sin deporte', () => {
    for (const t of [null, undefined, '', '   ']) {
      expect(resolveSport(t)).toMatchObject({ key: 'desconocido', label: 'Sin deporte', boardLevel: 'ninguna', match: 'ninguno' });
    }
  });
});

describe('catálogo', () => {
  it('las canchas son las mismas de la pizarra', () => {
    expect([...BOARD_SPORTS]).toEqual([...TACTICAL_SPORTS]);
  });

  it('claves únicas; ningún sinónimo apunta a dos deportes', () => {
    const keys = SPORT_CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const owner = new Map<string, string>();
    for (const e of SPORT_CATALOG) {
      for (const a of e.aliases) {
        const k = normalizeSportText(a);
        if (owner.has(k)) expect(owner.get(k), a).toBe(e.key);
        owner.set(k, e.key);
      }
    }
  });

  it('D2: pizarra completa = fútbol 11/7/5, futsal, voleibol, baloncesto, balonmano', () => {
    expect(SPORT_CATALOG.filter((e) => e.boardLevel === 'completa').map((e) => e.key).sort()).toEqual(
      ['baloncesto', 'balonmano', 'futbol', 'futbol5', 'futbol7', 'futsal', 'voleibol'],
    );
    expect(SPORT_CATALOG.filter((e) => e.boardLevel === 'cancha').map((e) => e.key).sort()).toEqual(
      ['badminton', 'futbol_americano', 'hockey_cesped', 'hockey_patines', 'netball', 'padel', 'rugby', 'tenis', 'ultimate', 'voley_playa', 'waterpolo'],
    );
    for (const e of SPORT_CATALOG.filter((x) => x.boardLevel === 'completa')) expect(e.tacticalSport, e.key).toBeTruthy();
    // M6f: cada deporte de nivel «cancha» tiene SU cancha (la misma clave).
    for (const e of SPORT_CATALOG.filter((x) => x.boardLevel === 'cancha')) expect(e.tacticalSport, e.key).toBe(e.key);
    for (const e of SPORT_CATALOG.filter((x) => x.boardLevel === 'ninguna')) expect(e.tacticalSport, e.key).toBeUndefined();
  });

  it('biblioteca = canchas de nivel «completa» + genérico (EXERCISE_SPORTS del BFF, sin cambios)', () => {
    expect([...LIBRARY_BOARD_SPORTS]).toEqual(['futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano', 'generico']);
    for (const s of LIBRARY_BOARD_SPORTS) expect(BOARD_SPORTS as readonly string[]).toContain(s);
  });
});

describe('D3: hasTacticalBoard / isFootballSport / teamBoardAccess', () => {
  it('pizarra para los deportes completos; fútbol solo para fútbol 11/7/5', () => {
    for (const t of ['Fútbol', 'Fútbol 7', 'Futsal', 'Voleibol', 'Baloncesto', 'Balonmano']) {
      expect(hasTacticalBoard(t), t).toBe(true);
      expect(hasExerciseLibrary(t), t).toBe(true);
    }
    // M6f: nivel «cancha» abre la pizarra, pero sin biblioteca.
    for (const t of ['Tenis', 'Waterpolo', 'Pádel', 'Rugby', 'Netball']) {
      expect(hasTacticalBoard(t), t).toBe(true);
      expect(hasExerciseLibrary(t), t).toBe(false);
    }
    for (const t of ['Natación', 'Porrismo', 'Karate', 'Hockey', '']) {
      expect(hasTacticalBoard(t), t).toBe(false);
      expect(hasExerciseLibrary(t), t).toBe(false);
    }
    for (const t of ['Fútbol', 'fútbol', 'Futbol', 'Fútbol 7', 'Soccer']) expect(isFootballSport(t), t).toBe(true);
    for (const t of ['Futsal', 'Fútbol Sala', 'Voleibol', 'Baloncesto', 'Natación', '']) expect(isFootballSport(t), t).toBe(false);
  });

  it('isFootball coincide con el gate de antes para fútbol / fútbol', () => {
    // Antes: sport.toLowerCase() === 'futbol' || === 'fútbol'.
    for (const t of ['Fútbol', 'futbol', 'FÚTBOL', 'Futbol']) {
      const before = t.toLowerCase() === 'futbol' || t.toLowerCase() === 'fútbol';
      expect(teamBoardAccess({ sport: t }).isFootball, t).toBe(before);
    }
  });

  it('por equipo', () => {
    expect(teamBoardAccess({ sport: 'Fútbol', name: 'Fútbol 7 Sub 10' })).toEqual({ sport: 'futbol7', hasTacticalBoard: true, hasExerciseLibrary: true, isFootball: true });
    expect(teamBoardAccess({ sport: 'Voleibol', name: 'Sub 14 femenino' })).toEqual({ sport: 'voleibol', hasTacticalBoard: true, hasExerciseLibrary: true, isFootball: false });
    expect(teamBoardAccess({ sport: 'Natación', name: 'Iniciación' })).toEqual({ sport: 'generico', hasTacticalBoard: false, hasExerciseLibrary: false, isFootball: false });
    expect(teamBoardAccess({ sport: 'Tenis' })).toEqual({ sport: 'tenis', hasTacticalBoard: true, hasExerciseLibrary: false, isFootball: false });
    // Fútbol americano NO es fútbol (ni por el deporte ni por el nombre del equipo).
    expect(teamBoardAccess({ sport: 'Fútbol americano', name: 'Fútbol 7' })).toEqual({ sport: 'futbol_americano', hasTacticalBoard: true, hasExerciseLibrary: false, isFootball: false });
    expect(boardSportFromTeam({ sport: null, name: 'Fútbol americano Sub 16' })).toBe('futbol_americano');
    // Sin deporte: como antes, ni pizarra ni fútbol.
    expect(teamBoardAccess({ sport: null, name: 'Equipo A' })).toMatchObject({ hasTacticalBoard: false, isFootball: false });
  });
});

describe('D1: deportes de una escuela', () => {
  it('escuela solo de fútbol: Fútbol 11, 7 y 5 (las menores juegan 7 y 5) + Preparación física', () => {
    expect(schoolBoardSports({ teams: [{ sport: 'Fútbol', name: 'Sub 12' }, { sport: 'Fútbol', name: 'Sub 8' }], schoolSports: ['Fútbol'] }))
      .toEqual(['futbol', 'futbol7', 'futbol5', 'generico']);
    // Solo schools.sports, sin equipos: igual.
    expect(schoolBoardSports({ schoolSports: ['Fútbol'] })).toEqual(['futbol', 'futbol7', 'futbol5', 'generico']);
    // Un equipo F7 también trae las tres.
    expect(schoolBoardSports({ teams: [{ sport: 'Fútbol 7', name: 'Sub 9' }] })).toEqual(['futbol', 'futbol7', 'futbol5', 'generico']);
  });

  it('futsal solo si tiene equipos de futsal (fútbol no lo trae)', () => {
    expect(schoolBoardSports({ teams: [{ sport: 'Fútbol', name: 'Sub 12' }] })).not.toContain('futsal');
    expect(schoolBoardSports({ teams: [{ sport: 'Fútbol', name: 'Sub 12' }, { sport: 'Fútbol Sala', name: 'Sub 14' }] }))
      .toEqual(['futbol', 'futbol7', 'futbol5', 'futsal', 'generico']);
    // Escuela solo de futsal: no hereda fútbol 11/7/5.
    expect(schoolBoardSports({ teams: [{ sport: 'Futsal', name: 'Sub 14' }] })).toEqual(['futsal', 'generico']);
  });

  it('multideporte: une equipos y schools.sports; los de sin pizarra no suman', () => {
    expect(schoolBoardSports({
      teams: [{ sport: 'Voleibol' }, { sport: 'Natación' }, { sport: 'Karate' }],
      schoolSports: ['Baloncesto', 'Multideporte', 'Tenis', 'Patinaje'],
    })).toEqual(['voleibol', 'baloncesto', 'generico']);
    // M6f: los de nivel «cancha» abren pizarra pero NO suman a la biblioteca.
    expect(schoolBoardSports({ teams: [{ sport: 'Tenis' }, { sport: 'Rugby' }, { sport: 'Waterpolo' }] })).toEqual(['generico']);
  });

  it('sin deportes de pizarra: solo Preparación física', () => {
    expect(schoolBoardSports({ teams: [{ sport: 'Natación' }], schoolSports: ['Natación'] })).toEqual(['generico']);
    expect(schoolBoardSports({})).toEqual(['generico']);
  });
});

describe('M6f: sinónimos de los deportes de cancha', () => {
  const cases: [string, string][] = [
    ['Rugby', 'rugby'], ['rugby 7', 'rugby'], ['Rugby Sevens', 'rugby'], ['Rugby XV', 'rugby'],
    ['Fútbol americano', 'futbol_americano'], ['futbol_americano', 'futbol_americano'], ['American Football', 'futbol_americano'],
    ['Tenis', 'tenis'], ['Tenis de campo', 'tenis'], ['TENNIS', 'tenis'],
    ['Pádel', 'padel'], ['padel', 'padel'], ['Paddle tenis', 'padel'],
    ['Bádminton', 'badminton'], ['badminton', 'badminton'],
    ['Vóley playa', 'voley_playa'], ['Voleibol de playa', 'voley_playa'], ['vóley de playa', 'voley_playa'], ['Beach volley', 'voley_playa'],
    ['Hockey césped', 'hockey_cesped'], ['Hockey sobre hierba', 'hockey_cesped'], ['hockey_cesped', 'hockey_cesped'], ['Field hockey', 'hockey_cesped'],
    ['Hockey patines', 'hockey_patines'], ['Hockey sobre patines', 'hockey_patines'], ['Hockey en línea', 'hockey_patines'], ['Rink hockey', 'hockey_patines'], ['Hockey sala', 'hockey_patines'],
    ['Netball', 'netball'],
    ['Waterpolo', 'waterpolo'], ['Water-polo', 'waterpolo'], ['Polo acuático', 'waterpolo'],
    ['Ultimate', 'ultimate'], ['Ultimate frisbee', 'ultimate'], ['Disco volador', 'ultimate'],
  ];
  it.each(cases)('%j → %s con su cancha y sin biblioteca', (text, key) => {
    const r = resolveSport(text);
    expect(r).toMatchObject({ key, boardLevel: 'cancha', tacticalSport: key });
    expect(hasTacticalBoard(text)).toBe(true);
    expect(hasExerciseLibrary(text)).toBe(false);
  });

  it('textos REALES de la base que ahora abren pizarra (fixture deportesReales)', () => {
    const real = REAL_SPORT_TEXTS.map((r) => r.text);
    for (const t of ['Waterpolo', 'Tenis', 'Pádel', 'Tenis de campo', 'Rugby', 'Badminton', 'Hockey Sobre Cesped', 'Disco Volador', 'Tenis — formación competitiva', 'Coordinadora de Tenis']) {
      expect(real, t).toContain(t);
      expect(hasTacticalBoard(t), t).toBe(true);
      expect(isTacticalSport(resolveSport(t).tacticalSport), t).toBe(true);
    }
    // Rugby en silla de ruedas se juega en cancha de básquet: sin pizarra de rugby.
    expect(resolveSport('Deportiva De Rugby En Silla De Ruedas')).toMatchObject({ key: 'rugby_silla', boardLevel: 'ninguna' });
    expect(resolveSport('Hockeyh Sobre Hielo').key).toBe('desconocido');
  });
});

describe('lista que escoge el usuario (sportsCatalog.ts) → pizarra', () => {
  it('Frontón (Handball Mural) NO abre la pizarra de balonmano', () => {
    expect(resolveSport('Frontón (Handball Mural)')).toMatchObject({ key: 'fronton', boardLevel: 'ninguna', match: 'exacto' });
    expect(hasTacticalBoard('Frontón (Handball Mural)')).toBe(false);
    expect(resolveSport('Balonmano').boardLevel).toBe('completa');
  });

  it('todo deporte de la lista se reconoce (ninguno queda «desconocido»)', async () => {
    const { SPORTS_LIST } = await import('@/lib/constants/sportsCatalog');
    const sinMapear = SPORTS_LIST.filter((n) => resolveSport(n).match === 'ninguno');
    expect(sinMapear).toEqual([]);
  });

  it('Polo no se confunde con Waterpolo', () => {
    expect(resolveSport('Polo').boardLevel).toBe('ninguna');
    expect(resolveSport('Waterpolo')).toMatchObject({ boardLevel: 'cancha', tacticalSport: 'waterpolo' });
  });
});

describe('equipo SIN deporte: vale el nombre o la categoría', () => {
  it('«Tenis Sub 12» y «Escuela Pádel» abren su cancha, no la de fútbol', () => {
    expect(teamBoardAccess({ sport: null, name: 'Tenis Sub 12' })).toMatchObject({ sport: 'tenis', hasTacticalBoard: true, hasExerciseLibrary: false });
    expect(teamBoardAccess({ sport: '', name: 'Escuela Pádel' })).toMatchObject({ sport: 'padel', hasTacticalBoard: true });
  });
  it('fútbol 11/7/5 sin deporte escrito NO cambia (lo fija sportFromTeamLegacy); futsal sí abre su pizarra', () => {
    expect(teamBoardAccess({ sport: '', name: 'Fútbol 7 Sub 10' })).toMatchObject({ sport: 'futbol7', hasTacticalBoard: false });
    expect(teamBoardAccess({ sport: '', name: 'Futsal Sub 12' })).toMatchObject({ sport: 'futsal', hasTacticalBoard: true });
  });
  it('sin pista en el nombre sigue como antes (fútbol 11, sin pizarra)', () => {
    expect(teamBoardAccess({ sport: '', name: 'Sub 12' })).toMatchObject({ sport: 'futbol', hasTacticalBoard: false });
  });
  it('con deporte escrito, el nombre no lo pisa', () => {
    expect(teamBoardAccess({ sport: 'Natación', name: 'Tenis Sub 12' })).toMatchObject({ hasTacticalBoard: false });
  });
});

describe('teams.sport_modality manda sobre el nombre', () => {
  it('Fútbol + modalidad 7 / 5 / 11 → su cancha, aunque el nombre no diga nada', () => {
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'Sub 10', sport_modality: '7' })).toBe('futbol7');
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'Sub 8', sport_modality: '5' })).toBe('futbol5');
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'F7 Sub 10', sport_modality: '11' })).toBe('futbol');
  });
  it('sin modalidad (NULL o valor raro) se deduce del nombre, como antes', () => {
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'F7 Sub 10', sport_modality: null })).toBe('futbol7');
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'Sub 10', sport_modality: '9' })).toBe('futbol');
  });
  it('en otro deporte la modalidad no hace nada', () => {
    expect(boardSportFromTeam({ sport: 'Voleibol', name: 'Sub 14', sport_modality: '7' })).toBe('voleibol');
    expect(boardSportFromTeam({ sport: 'Natación', name: 'Sub 14', sport_modality: '7' })).toBe('generico');
  });
  it('Futsal en el nombre gana a la modalidad', () => {
    expect(boardSportFromTeam({ sport: 'Fútbol', name: 'Futsal Sub 12', sport_modality: '7' })).toBe('futsal');
  });
  it('la modalidad es de fútbol: teamBoardAccess la respeta y sigue siendo fútbol', () => {
    expect(teamBoardAccess({ sport: 'Fútbol', name: 'Sub 10', sport_modality: '5' })).toMatchObject({ sport: 'futbol5', hasTacticalBoard: true, isFootball: true });
  });
});
