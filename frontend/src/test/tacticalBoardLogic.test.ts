/**
 * Lógica pura del tablero táctico (src/lib/school/tacticalBoardLogic.ts).
 *
 * Cada bloque corresponde a una falla real encontrada en la auditoría de la
 * pizarra (2026-10-04): el pin que saltaba al reposicionarlo con zoom de
 * arqueros, la plantilla que perdía los marcadores sin jugador al guardarla,
 * y el guardado que reventaba con un jugador que ya no está en el roster.
 */
import { describe, it, expect } from 'vitest';
import {
  greedyNearestMatch,
  repositionedCenterPx,
  pitchPctFromPx,
  buildPresetSlots,
  applyPresetSlots,
  nearestEmptySlot,
  splitKnownKeys,
  SNAP_DISTANCE,
  type PlacedSlot,
  type EmptySlot,
} from '../lib/school/tacticalBoardLogic';
import { FULL_VIEW, GK_VIEW } from '../lib/school/tacticalGeometry';

const slot = (x: number, y: number, label = 'Medio', jersey: number | '' = ''): PlacedSlot => (
  { x, y, slot_label: label, labelIsCustom: false, jersey_number: jersey }
);

describe('greedyNearestMatch', () => {
  it('empareja cada punto con el más cercano sin repetir', () => {
    const from = [{ x: 10, y: 10 }, { x: 90, y: 90 }];
    const to = [{ x: 88, y: 92 }, { x: 12, y: 8 }];
    const m = greedyNearestMatch(from, to);
    expect(m).toHaveLength(2);
    expect(m.find((p) => p.from === from[0])?.to).toBe(to[1]);
    expect(m.find((p) => p.from === from[1])?.to).toBe(to[0]);
  });

  it('con más destinos que orígenes deja destinos sin emparejar', () => {
    const m = greedyNearestMatch([{ x: 0, y: 0 }], [{ x: 50, y: 50 }, { x: 1, y: 1 }]);
    expect(m).toHaveLength(1);
    expect(m[0].to).toEqual({ x: 1, y: 1 });
  });

  it('listas vacías → sin pares', () => {
    expect(greedyNearestMatch([], [{ x: 1, y: 1 }])).toEqual([]);
    expect(greedyNearestMatch([{ x: 1, y: 1 }], [])).toEqual([]);
  });
});

describe('repositionedCenterPx (B1: zoom de arqueros)', () => {
  const rect = { left: 100, top: 200, width: 400, height: 500 };

  it('cancha completa: y% se mapea directo al alto de la caja', () => {
    const c = repositionedCenterPx({ x: 50, y: 40 }, rect, { x: 0, y: 0 }, FULL_VIEW);
    expect(c.x).toBe(300);
    expect(c.y).toBe(200 + 0.4 * 500);
  });

  it('con zoom, el alto de la caja es solo la ventana 52-100: y=76 queda a mitad de caja', () => {
    // 76 está justo a la mitad de 52..100 → 50 % del alto de la caja.
    const c = repositionedCenterPx({ x: 50, y: 76 }, rect, { x: 0, y: 0 }, GK_VIEW);
    expect(c.y).toBe(200 + 0.5 * 500);
  });

  it('el delta se suma tal cual', () => {
    const c = repositionedCenterPx({ x: 0, y: 52 }, rect, { x: 7, y: -3 }, GK_VIEW);
    expect(c.x).toBe(107);
    expect(c.y).toBe(197);
  });

  it('ida y vuelta: soltar sin mover deja al jugador donde estaba (con y sin zoom)', () => {
    for (const view of [FULL_VIEW, GK_VIEW]) {
      const original = { x: 30, y: view === GK_VIEW ? 80 : 40 };
      const px = repositionedCenterPx(original, rect, { x: 0, y: 0 }, view);
      const back = pitchPctFromPx(px, rect, view);
      expect(back.x).toBeCloseTo(original.x, 6);
      expect(back.y).toBeCloseTo(original.y, 6);
      expect(back.inside).toBe(true);
    }
  });
});

describe('pitchPctFromPx', () => {
  const rect = { left: 0, top: 0, width: 200, height: 200 };
  it('marca fuera de la cancha y recorta a 0-100', () => {
    const r = pitchPctFromPx({ x: 250, y: -10 }, rect, FULL_VIEW);
    expect(r.inside).toBe(false);
    expect(r.x).toBe(100);
    expect(r.y).toBe(0);
  });
});

describe('buildPresetSlots (B5: la plantilla no pierde marcadores)', () => {
  it('incluye jugadores puestos Y marcadores sin adoptar', () => {
    const placed = { 'child:a': slot(50, 50, 'Medio'), 'child:b': slot(20, 80, 'Defensa') };
    const empty: EmptySlot[] = [
      { id: 'p:0', slot_label: 'Delantero', x: 50, y: 10 },
      { id: 'p:1', slot_label: 'Arquero', x: 50, y: 95 },
    ];
    const out = buildPresetSlots(placed, empty);
    expect(out).toHaveLength(4);
    expect(out.map((s) => s.slot_label).sort()).toEqual(['Arquero', 'Defensa', 'Delantero', 'Medio']);
  });

  it('no arrastra campos de más (dorsal, labelIsCustom)', () => {
    const out = buildPresetSlots({ k: slot(1, 2, 'X', 9) }, []);
    expect(Object.keys(out[0]).sort()).toEqual(['slot_label', 'x', 'y']);
  });

  it('sin nada en cancha → lista vacía', () => {
    expect(buildPresetSlots({}, [])).toEqual([]);
  });
});

describe('applyPresetSlots', () => {
  const preset = [
    { slot_label: 'Arquero', x: '50', y: '95' },
    { slot_label: 'Defensa', x: 25, y: 70 },
    { slot_label: 'Delantero', x: 50, y: 10 },
  ];

  it('sin jugadores puestos: todos los slots son marcadores y `placed` no cambia', () => {
    const placed = {};
    const r = applyPresetSlots(placed, 'p1', preset);
    expect(r.placed).toBe(placed);
    expect(r.emptySlots).toHaveLength(3);
    expect(r.emptySlots[0]).toEqual({ id: 'p1:0', slot_label: 'Arquero', x: 50, y: 95 });
  });

  it('convierte x/y que llegan como string (numeric de Postgres)', () => {
    const r = applyPresetSlots({}, 'p1', preset);
    expect(typeof r.emptySlots[0].x).toBe('number');
  });

  it('reubica al jugador puesto en el slot más cercano, conserva el dorsal y deja el resto como marcadores', () => {
    const placed = { 'child:a': slot(48, 12, 'Medio', 9) };
    const r = applyPresetSlots(placed, 'p1', preset);
    expect(r.placed['child:a']).toEqual({ x: 50, y: 10, slot_label: 'Delantero', labelIsCustom: false, jersey_number: 9 });
    expect(r.emptySlots.map((s) => s.slot_label).sort()).toEqual(['Arquero', 'Defensa']);
  });

  it('no muta el `placed` original', () => {
    const placed = { 'child:a': slot(48, 12, 'Medio') };
    applyPresetSlots(placed, 'p1', preset);
    expect(placed['child:a'].slot_label).toBe('Medio');
  });

  it('plantilla vacía → no toca a los jugadores', () => {
    const placed = { 'child:a': slot(48, 12) };
    const r = applyPresetSlots(placed, 'p1', []);
    expect(r.placed).toBe(placed);
    expect(r.emptySlots).toEqual([]);
  });
});

describe('nearestEmptySlot', () => {
  const empty: EmptySlot[] = [
    { id: 'a', slot_label: 'A', x: 10, y: 10 },
    { id: 'b', slot_label: 'B', x: 50, y: 50 },
  ];
  it('devuelve el marcador dentro del radio de adopción', () => {
    expect(nearestEmptySlot(empty, 12, 11)?.id).toBe('a');
  });
  it('null si ninguno cae dentro de SNAP_DISTANCE', () => {
    expect(nearestEmptySlot(empty, 10 + SNAP_DISTANCE + 1, 10)).toBeNull();
  });
});

describe('splitKnownKeys (B3: jugador que ya no está en el roster)', () => {
  it('separa válidos de ausentes', () => {
    const known = new Map([['child:a', 1], ['child:b', 2]]);
    const r = splitKnownKeys(['child:a', 'child:x', 'child:b'], known);
    expect(r.valid).toEqual(['child:a', 'child:b']);
    expect(r.missing).toEqual(['child:x']);
  });
});
