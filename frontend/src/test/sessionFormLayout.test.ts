/**
 * D3 (M1 de docs/specs/pizarra-multideporte-3d-ia.md): qué abre cada deporte
 * en Métricas y Rendimiento (TrainingPlansPage → teamBoardAccess) y en el
 * formulario de la sesión (SessionFormDialog → sessionFormLayout).
 * Fútbol: exactamente lo de antes de M1.
 */
import { describe, expect, it } from 'vitest';
import { sessionFormLayout } from '@/lib/school/sessionFormLayout';
import { teamBoardAccess } from '@/lib/sports/sportCatalog';

/** Lo que hace TrainingPlansPage con el equipo elegido. */
const gate = (team: { sport: string; name?: string }, session: Parameters<typeof sessionFormLayout>[0]['session'] = null) => {
  const a = teamBoardAccess(team);
  return {
    page: {
      blockBoardButton: a.hasTacticalBoard, // «Tablero táctico» en cada bloque de la sesión
      footballPanorama: a.isFootball, // botón «Fútbol» (partidos, goles, tarjetas)
    },
    form: sessionFormLayout({ isFootball: a.isFootball, hasTacticalBoard: a.hasTacticalBoard, teamSport: a.sport, session }),
  };
};

// Lo que veía un equipo de fútbol antes de M1 (isFootball = true).
const FOOTBALL_BEFORE = {
  page: { blockBoardButton: true, footballPanorama: true },
  form: {
    editor: 'blocks',
    showBoardButtons: true,
    showLibraryButton: true,
    showGamePrinciples: true,
    showWarmup: false,
    showEvaluation: true,
    showGoalkeeperComponent: true,
    blockTemplate: 'futbol',
  },
};
// Lo que veía cualquier otro deporte antes de M1 (isFootball = false).
const OTHER_BEFORE = {
  page: { blockBoardButton: false, footballPanorama: false },
  form: {
    editor: 'drills',
    showBoardButtons: false,
    showLibraryButton: false,
    showGamePrinciples: false,
    showWarmup: true,
    showEvaluation: false,
    showGoalkeeperComponent: false,
    blockTemplate: 'generico',
  },
};

describe('fútbol: cero regresión', () => {
  it.each(['Fútbol', 'futbol', 'FÚTBOL'])('%s', (sport) => {
    expect(gate({ sport, name: 'Sub 12' })).toEqual(FOOTBALL_BEFORE);
    // Una sesión vieja con ejercicios sueltos sigue abriendo en bloques (como antes).
    expect(gate({ sport }, { drills: [{ name: 'Rondo' }], session_blocks: null }).form.editor).toBe('blocks');
  });

  it('el llamador viejo que solo pasa isFootball ve lo mismo', () => {
    expect(sessionFormLayout({ isFootball: true })).toEqual(FOOTBALL_BEFORE.form);
    expect(sessionFormLayout({ isFootball: false })).toEqual(OTHER_BEFORE.form);
  });
});

describe('deportes de pizarra que no son fútbol', () => {
  it.each(['Voleibol', 'Baloncesto'])('%s: pizarra y biblioteca en bloques, sin lo futbolero', (sport) => {
    const g = gate({ sport });
    expect(g.page).toEqual({ blockBoardButton: true, footballPanorama: false });
    expect(g.form).toEqual({
      editor: 'blocks',
      showBoardButtons: true,
      showLibraryButton: true,
      showGamePrinciples: false,
      showWarmup: true,
      showEvaluation: false,
      showGoalkeeperComponent: false,
      blockTemplate: 'generico',
    });
  });

  it.each(['Balonmano', 'Futsal'])('%s: además «Arqueros» en el componente del bloque (hay portero)', (sport) => {
    expect(gate({ sport }).form.showGoalkeeperComponent).toBe(true);
    expect(gate({ sport }).page.footballPanorama).toBe(false);
  });

  it('una sesión vieja de voleibol con ejercicios sueltos se sigue editando como ejercicios', () => {
    const g = gate({ sport: 'Voleibol' }, { drills: [{ name: 'Saque flotado', focus: '', duration: '' }], session_blocks: [] });
    expect(g.form.editor).toBe('drills');
    expect(g.form.showBoardButtons).toBe(false);
    // …pero una con bloques abre en bloques.
    expect(gate({ sport: 'Voleibol' }, { drills: [], session_blocks: [{ name: 'Parte principal' }] }).form.editor).toBe('blocks');
  });
});

describe('deportes sin pizarra: exactamente lo de antes', () => {
  it.each(['Natación', 'Karate', 'Porrismo', 'Patinaje', 'Hockey sobre hielo', 'Deporte inventado'])('%s', (sport) => {
    expect(gate({ sport })).toEqual(OTHER_BEFORE);
  });
});

describe('M6f: deportes de nivel «cancha» → pizarra SIN biblioteca', () => {
  it.each([
    'Tenis', 'Waterpolo', 'Pádel', 'Rugby', 'Fútbol americano', 'Bádminton', 'Vóley playa',
    'Hockey sobre césped', 'Hockey patines', 'Netball', 'Ultimate',
  ])('%s: «Tablero táctico» sí, «Desde la biblioteca» no', (sport) => {
    const a = teamBoardAccess({ sport });
    expect(a).toMatchObject({ hasTacticalBoard: true, hasExerciseLibrary: false, isFootball: false });
    const g = gate({ sport });
    expect(g.page).toEqual({ blockBoardButton: true, footballPanorama: false });
    expect(g.form.editor).toBe('blocks');
    expect(g.form.showBoardButtons).toBe(true);
    expect(g.form.showLibraryButton).toBe(false);
    expect(g.form.showEvaluation).toBe(false);
  });

  it('hockey y waterpolo (con portero) ofrecen «Arqueros»; tenis no', () => {
    expect(gate({ sport: 'Waterpolo' }).form.showGoalkeeperComponent).toBe(true);
    expect(gate({ sport: 'Hockey sobre césped' }).form.showGoalkeeperComponent).toBe(true);
    expect(gate({ sport: 'Tenis' }).form.showGoalkeeperComponent).toBe(false);
  });

  it.each(['Fútbol', 'Fútbol 7', 'Futsal', 'Voleibol', 'Baloncesto', 'Balonmano'])('%s (completa): biblioteca igual que antes', (sport) => {
    expect(teamBoardAccess({ sport }).hasExerciseLibrary).toBe(true);
    expect(gate({ sport }).form.showLibraryButton).toBe(true);
  });

  it('llamador viejo sin teamSport: la biblioteca va con el tablero (sin cambio)', () => {
    expect(sessionFormLayout({ isFootball: false, hasTacticalBoard: true }).showLibraryButton).toBe(true);
    expect(sessionFormLayout({ isFootball: false, hasTacticalBoard: true, teamSport: 'tenis' }).showLibraryButton).toBe(false);
  });
});
