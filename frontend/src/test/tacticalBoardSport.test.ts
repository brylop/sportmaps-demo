/**
 * T4: lo que la pizarra cambia según el deporte (lib/school/tacticalBoardSport.ts).
 * Fútbol 11 tiene que quedar EXACTAMENTE como antes de T4.
 */
import { describe, it, expect } from 'vitest';
import { boardMetersFor, boardSportConfig, defaultBoardFormation, FOOTBALL_BOARD_METERS } from '@/lib/school/tacticalBoardSport';
import { FORMATIONS, defaultFormationFor } from '@/lib/school/tacticalFormations';
import { OBJECT_TYPES } from '@/lib/school/tacticalGeometry';
import { SPORTS, TACTICAL_SPORTS, sportFromTeam } from '@/lib/school/tacticalSports';

describe('boardSportConfig', () => {
  it('fútbol 11 = la pizarra de siempre (formaciones, material, zonas, zoom, 90 m)', () => {
    const cfg = boardSportConfig('futbol');
    expect(cfg.formations).toBe(FORMATIONS);
    expect(cfg.objects).toEqual([...OBJECT_TYPES]);
    expect(cfg.allowGkZoom).toBe(true);
    expect(cfg.showZonesOption).toBe(true);
    expect(cfg.courtLengthMeters).toBe(90);
    expect(boardMetersFor(cfg, 90)).toBe(90);
  });

  it('sin deporte, null o desconocido → fútbol 11', () => {
    for (const s of [undefined, null, 'xyz' as never]) {
      expect(boardSportConfig(s).sport).toBe('futbol');
      expect(boardSportConfig(s).formations).toBe(FORMATIONS);
    }
  });

  it('cada deporte usa las formaciones y el material de su catálogo', () => {
    for (const s of TACTICAL_SPORTS.filter((k) => k !== 'futbol')) {
      const cfg = boardSportConfig(s);
      expect(cfg.formations).toBe(SPORTS[s].formations);
      expect(cfg.objects).toEqual(SPORTS[s].objects);
      expect(cfg.showZonesOption).toBe(false);
      expect(cfg.allowGkZoom).toBe(SPORTS[s].hasGoalkeeper);
    }
  });

  it('zoom de arqueros solo con arco: sí futsal/balonmano/F7, no voleibol/baloncesto/genérico', () => {
    expect(boardSportConfig('futsal').allowGkZoom).toBe(true);
    expect(boardSportConfig('balonmano').allowGkZoom).toBe(true);
    expect(boardSportConfig('futbol7').allowGkZoom).toBe(true);
    expect(boardSportConfig('voleibol').allowGkZoom).toBe(false);
    expect(boardSportConfig('baloncesto').allowGkZoom).toBe(false);
    expect(boardSportConfig('generico').allowGkZoom).toBe(false);
  });

  it('voleibol: sin arcos en la paleta', () => {
    const objs = boardSportConfig('voleibol').objects;
    expect(objs).not.toContain('goal');
    expect(objs).not.toContain('mini_goal');
  });

  it('la regla: «Largo cancha» es el largo real y el tablero mide un poco más (la cancha no llena el alto)', () => {
    const cfg = boardSportConfig('voleibol');
    expect(cfg.courtLengthMeters).toBe(18);
    const board = boardMetersFor(cfg, 18);
    expect(board).toBeGreaterThan(18);
    // La franja de la cancha en el tablero mide exactamente el largo real.
    const frac = (SPORTS.voleibol.court.y1 - SPORTS.voleibol.court.y0) / 100;
    expect(board * frac).toBeCloseTo(18, 6);
    expect(FOOTBALL_BOARD_METERS).toBe(90);
  });
});

describe('defaultBoardFormation', () => {
  it('fútbol 11: la regla de siempre (4-3-3 con 11+, si no F7)', () => {
    const cfg = boardSportConfig('futbol');
    expect(defaultBoardFormation(cfg, 14)).toBe(defaultFormationFor(14));
    expect(defaultBoardFormation(cfg, 8)).toBe(defaultFormationFor(8));
  });

  it('otro deporte: la primera formación de su catálogo', () => {
    expect(defaultBoardFormation(boardSportConfig('voleibol'), 12).key).toBe('vb-rotacion');
    expect(defaultBoardFormation(boardSportConfig('baloncesto'), 3).players).toBe(5);
  });
});

describe('deporte del equipo → config de la pizarra', () => {
  it('teams.sport reales', () => {
    expect(boardSportConfig(sportFromTeam({ sport: 'Fútbol' })).sport).toBe('futbol');
    expect(boardSportConfig(sportFromTeam({ sport: 'Voleibol' })).sport).toBe('voleibol');
    expect(boardSportConfig(sportFromTeam({ sport: 'Fútbol', name: 'F7 Sub 9' })).sport).toBe('futbol7');
    expect(boardSportConfig(sportFromTeam(null)).sport).toBe('futbol');
  });
});
