/**
 * M6a (docs/specs/pizarra-m6-paridad-tacticalpad.md): catálogo completo de
 * formaciones por deporte.
 *
 *  - lo pedido existe en cada deporte (fútbol 11, 7, 5, futsal, voleibol,
 *    baloncesto, balonmano);
 *  - cada formación trae los jugadores del deporte, dentro de la cancha, sin
 *    dos puntos encimados, con etiquetas únicas (las nuevas) y su familia;
 *  - SIN REGRESIÓN: las formaciones de antes conservan clave, etiqueta y
 *    coordenadas (fixtures/formacionesHistoricas.json, sacado del código
 *    anterior a M6a);
 *  - voleibol: las seis rotaciones de 5-1, 4-2 y 6-2 en recepción y defensa,
 *    con el líbero por el central de atrás.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FORMATIONS } from '@/lib/school/tacticalFormations';
import { SPORTS, TACTICAL_SPORTS, volleyZone, type TacticalSport } from '@/lib/school/tacticalSports';
import { boardSportConfig } from '@/lib/school/tacticalBoardSport';
import { isGoalkeeperLabel } from '@/lib/school/tacticalPalette';
import { GROUP_ORDER } from '@/lib/school/tacticalFormationGallery';

type Snap = { key: string; label: string; players: number; slots: { x: number; y: number; label: string }[] };
const LEGACY = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/formacionesHistoricas.json'), 'utf-8'),
) as Record<string, Snap[]>;
const legacyKeys = (sport: string) => new Set((LEGACY[sport] ?? []).map((f) => f.key));

const labelsOf = (sport: TacticalSport) => boardSportConfig(sport).formations.map((f) => f.label);
const keysOf = (sport: TacticalSport) => boardSportConfig(sport).formations.map((f) => f.key);

describe('M6a: lo pedido está en el catálogo', () => {
  it('fútbol 11: las 17 pedidas + históricas y variantes', () => {
    const keys = keysOf('futbol');
    for (const k of [
      '4-3-3', '4-4-2', '3-5-2', '4-5-1', '4-2-3-1', '3-4-3', '4-3-1-2', '4-3-2-1', '3-4-2-1', '3-4-1-2',
      '4-2-2-2', '4-1-2-1-2', '4-1-4-1', '5-3-2', '5-4-1', '3-6-1', '4-4-1-1',
      // ampliación «todas las alineaciones»
      '4-1-3-2', '4-2-4', '3-4-3-rombo', '3-3-4', '5-2-3', '5-2-1-2', '4-6-0', '3-2-2-3', '2-3-5', '3-2-5', '4-2-3-1-estrecho',
    ]) expect(keys, k).toContain(k);
    expect(labelsOf('futbol')).toContain('4-1-2-1-2 (rombo)');
    expect(FORMATIONS.filter((f) => f.players === 11).length).toBeGreaterThanOrEqual(35);
  });

  it('fútbol 7, fútbol 5 y futsal', () => {
    expect(labelsOf('futbol7')).toEqual(expect.arrayContaining(['2-3-1', '3-2-1', '3-3', '2-1-2-1', '3-1-2', '2-2-2']));
    for (const s of ['futbol5', 'futsal'] as const) {
      expect(labelsOf(s)).toEqual(expect.arrayContaining(['1-2-1 (rombo)', '2-2 (cuadrado)', '3-1', '4-0', '1-1-2']));
    }
    expect(keysOf('futsal')).toContain('fs-5x4');
  });

  it('voleibol: 5-1, 4-2 y 6-2 en las 6 rotaciones (recepción y defensa) + defensas', () => {
    const keys = keysOf('voleibol');
    for (const sys of ['5-1', '4-2', '6-2']) {
      for (let r = 1; r <= 6; r++) {
        expect(keys).toContain(`vb-${sys}-r${r}-recepcion`);
        expect(keys).toContain(`vb-${sys}-r${r}-defensa`);
      }
    }
    expect(keys).toEqual(expect.arrayContaining(['vb-def-2-1-3', 'vb-def-2-0-4', 'vb-def-rotacional']));
  });

  it('baloncesto: individual, zonas, presiones y ataques', () => {
    expect(labelsOf('baloncesto')).toEqual(expect.arrayContaining([
      'Individual (hombre a hombre)', 'Zona 2-3', 'Zona 3-2', 'Zona 1-3-1', 'Presión 1-2-2 (3/4)',
      '5 abierto', '4 fuera, 1 dentro', 'Cuernos (horns)',
    ]));
  });

  it('balonmano: defensas 6-0, 5-1, 4-2, 3-2-1, 3-3 y ataques 3-3, 2-4', () => {
    expect(labelsOf('balonmano')).toEqual(expect.arrayContaining([
      'Defensa 6-0', 'Defensa 5-1', 'Defensa 4-2', 'Defensa 3-2-1', 'Defensa 3-3', 'Ataque 3-3', 'Ataque 2-4',
    ]));
  });
});

describe.each([...TACTICAL_SPORTS])('M6a: %s, cada formación', (sport) => {
  const cfg = boardSportConfig(sport);
  const def = SPORTS[sport];
  const old = legacyKeys(sport === 'futbol' ? 'football' : sport);

  it.each(cfg.formations.map((f) => [f.label, f] as const))('%s', (_l, f) => {
    // Jugadores del deporte (la pizarra de fútbol 11 trae también la F7 de siempre).
    const expected = sport === 'futbol' && f.key === 'f7-2-3-1' ? 7 : def.playersPerSide;
    expect(f.players).toBe(expected);
    expect(f.slots).toHaveLength(expected);
    // Dentro de la cancha.
    for (const s of f.slots) {
      expect(s.x, `${f.key}/${s.label}`).toBeGreaterThanOrEqual(def.court.x0 - 0.5);
      expect(s.x, `${f.key}/${s.label}`).toBeLessThanOrEqual(def.court.x1 + 0.5);
      expect(s.y, `${f.key}/${s.label}`).toBeGreaterThanOrEqual(def.court.y0 - 0.5);
      expect(s.y, `${f.key}/${s.label}`).toBeLessThanOrEqual(def.court.y1 + 0.5);
    }
    // Sin fichas encimadas: entre centros, ≥ 20 unidades del viewBox 300×340
    // en las nuevas (la ficha mide ~22) y ≥ 6 en las de antes.
    const minD = old.has(f.key) ? 6 : 20;
    for (let i = 0; i < f.slots.length; i++) {
      for (let j = i + 1; j < f.slots.length; j++) {
        const a = f.slots[i];
        const b = f.slots[j];
        const d = Math.hypot((a.x - b.x) * 3, (a.y - b.y) * 3.4);
        expect(d, `${f.key}: ${a.label} y ${b.label} encimados`).toBeGreaterThanOrEqual(minD);
      }
    }
    // Arquero: el primero y el más atrás, salvo portero-jugador.
    if (def.hasGoalkeeper && !f.flyingKeeper) {
      expect(isGoalkeeperLabel(f.slots[0].label), `${f.key}: el primero no es el arquero`).toBe(true);
    }
    if (!old.has(f.key)) {
      // Lo nuevo: etiquetas únicas, familia conocida y descripción de una línea.
      expect(new Set(f.slots.map((s) => s.label)).size, `${f.key}: etiquetas repetidas`).toBe(f.slots.length);
      expect(f.group, f.key).toBeTruthy();
      expect(GROUP_ORDER, `${f.key}: familia ${f.group}`).toContain(f.group);
      expect(f.description?.length ?? 0).toBeGreaterThan(15);
      expect(f.description ?? '').not.toMatch(/\n/);
    }
  });

  it('claves únicas', () => {
    expect(new Set(cfg.formations.map((f) => f.key)).size).toBe(cfg.formations.length);
  });
});

describe('M6a: sin regresión (snapshot de antes de M6a)', () => {
  it('fútbol (tacticalFormations.FORMATIONS): mismas claves, etiquetas y coordenadas, y el 4-3-3 sigue primero', () => {
    for (const snap of LEGACY.football) {
      const f = FORMATIONS.find((x) => x.key === snap.key);
      expect(f, snap.key).toBeDefined();
      expect({ key: f!.key, label: f!.label, players: f!.players, slots: f!.slots }).toEqual(snap);
    }
    expect(FORMATIONS[0].key).toBe('4-3-3');
  });

  it.each(Object.keys(LEGACY).filter((k) => k !== 'football'))('%s: mismas claves, etiquetas y coordenadas', (sport) => {
    const now = SPORTS[sport as TacticalSport].formations;
    for (const snap of LEGACY[sport]) {
      const f = now.find((x) => x.key === snap.key);
      expect(f, `${sport}/${snap.key}`).toBeDefined();
      expect({ key: f!.key, label: f!.label, players: f!.players, slots: f!.slots }).toEqual(snap);
    }
    // La primera sigue siendo la misma (es la de arranque de la cancha vacía).
    expect(now[0].key).toBe(LEGACY[sport][0].key);
  });
});

describe('M6a: rotaciones de voleibol', () => {
  it('zona del jugador por rotación (sentido horario: 1 → 6 → 5 …)', () => {
    expect(volleyZone(0, 1)).toBe(1);
    expect(volleyZone(0, 2)).toBe(6);
    expect(volleyZone(0, 4)).toBe(4);
    expect(volleyZone(1, 1)).toBe(2);
    expect(volleyZone(5, 2)).toBe(5);
  });

  const vb = SPORTS.voleibol.formations;
  const rotations = vb.filter((f) => /^vb-(5-1|4-2|6-2)-r\d-/.test(f.key));

  it('36 rotaciones; cada una con un solo líbero, un armador que arma y un central adelante', () => {
    expect(rotations).toHaveLength(36);
    for (const f of rotations) {
      const labels = f.slots.map((s) => s.label);
      expect(labels.filter((l) => l === 'Líbero'), f.key).toHaveLength(1);
      expect(labels.filter((l) => l === 'Central'), f.key).toHaveLength(1);
      expect(labels.filter((l) => l === 'Armador'), f.key).toHaveLength(1);
      expect(labels.filter((l) => l.startsWith('Punta')), f.key).toHaveLength(2);
    }
  });

  it('5-1: opuesto siempre; 6-2: arma el de atrás y el de adelante es opuesto', () => {
    for (const f of rotations.filter((x) => x.key.startsWith('vb-5-1') || x.key.startsWith('vb-6-2'))) {
      expect(f.slots.map((s) => s.label), f.key).toContain('Opuesto');
    }
    // 6-2 R1: el armador 1 está en zona 1 (atrás) → arma él.
    const r1 = vb.find((f) => f.key === 'vb-6-2-r1-recepcion')!;
    const setter = r1.slots.find((s) => s.label === 'Armador')!;
    const opp = r1.slots.find((s) => s.label === 'Opuesto')!;
    // Atrás = más lejos de la red (la red es la mitad de la cancha).
    expect(setter.y).toBeGreaterThan(opp.y);
  });

  it('todo el equipo en su mitad (la de abajo) en recepción y defensa', () => {
    const mid = (SPORTS.voleibol.court.y0 + SPORTS.voleibol.court.y1) / 2;
    for (const f of rotations) for (const s of f.slots) expect(s.y, `${f.key}/${s.label}`).toBeGreaterThan(mid);
  });

  it('en recepción reciben tres (dos puntas y el líbero) en la línea de recepción', () => {
    const f = vb.find((x) => x.key === 'vb-5-1-r1-recepcion')!;
    const net = (SPORTS.voleibol.court.y0 + SPORTS.voleibol.court.y1) / 2;
    const back = f.slots.filter((s) => s.y > net + (SPORTS.voleibol.court.y1 - net) * 0.35);
    expect(back.map((s) => s.label)).toEqual(expect.arrayContaining(['Líbero']));
  });
});
