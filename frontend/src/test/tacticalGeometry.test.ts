/**
 * Geometría pura de la pizarra táctica (src/lib/school/tacticalGeometry.ts).
 *
 * Por qué estas pruebas: todo lo que se GUARDA de la pizarra está en % de
 * cancha completa (0-100) y el SVG mide 300×340; la ventana visible (zoom al
 * área, modo arqueros) solo cambia qué parte se mira. Un error acá no revienta
 * nada a la vista: corre los conos a otra parte de la cancha, saca la animación
 * del balón de la línea que el coach dibujó, o pierde el tamaño/giro de un
 * objeto al releer una plantilla desde el jsonb. Son funciones puras: sin
 * React, sin red, sin base.
 */

import { describe, it, expect } from 'vitest';
import {
    FULL_VIEW,
    GK_VIEW,
    viewBoxOf,
    yToView,
    yFromView,
    curveControlPoint,
    ballPathPoint,
    BALL_PATH_BEND,
    hydrateShape,
    isPointShape,
    OBJECT_TYPES,
    OBJECT_BOX,
} from '../lib/school/tacticalGeometry';
import type { PitchView } from '../lib/school/tacticalGeometry';
import type { TacticalArrow } from '../lib/school/footballQueries';

/** Convierte "0 176.8 300 163.2" en números: 52*3.4 da 176.79999999999998 en
 *  flotante, así que el string no se compara literal. */
const parseViewBox = (vb: string) => vb.split(' ').map(Number);

describe('yToView / yFromView', () => {
    const muestras = [0, 12.5, 30, 52, 64.75, 100];

    it.each<[string, PitchView]>([
        ['FULL_VIEW', FULL_VIEW],
        ['GK_VIEW', GK_VIEW],
    ])('ida y vuelta exacta con %s', (_nombre, view) => {
        for (const y of muestras) {
            expect(yFromView(yToView(y, view), view)).toBeCloseTo(y, 12);
        }
    });

    it('en cancha completa la conversión es la identidad', () => {
        expect(yToView(30, FULL_VIEW)).toBe(30);
        expect(yFromView(30, FULL_VIEW)).toBe(30);
    });

    it('GK_VIEW: el borde superior de la ventana (y=52) queda en 0 y la línea de fondo (y=100) en 100', () => {
        expect(yToView(52, GK_VIEW)).toBe(0);
        expect(yToView(100, GK_VIEW)).toBe(100);
    });

    it('GK_VIEW: un punto del medio campo (y=30) queda fuera de la ventana (negativo)', () => {
        expect(yToView(30, GK_VIEW)).toBeLessThan(0);
    });

    it('GK_VIEW: el % de la ventana vuelve a la coordenada de cancha completa', () => {
        expect(yFromView(0, GK_VIEW)).toBe(52);
        expect(yFromView(100, GK_VIEW)).toBe(100);
        expect(yFromView(50, GK_VIEW)).toBe(76);
    });
});

describe('viewBoxOf', () => {
    it('FULL_VIEW es el SVG completo 300×340', () => {
        expect(viewBoxOf(FULL_VIEW)).toBe('0 0 300 340');
    });

    it('GK_VIEW arranca en 52*3.4 y mide 48*3.4 de alto', () => {
        const [x, y, w, h] = parseViewBox(viewBoxOf(GK_VIEW));
        expect(x).toBe(0);
        expect(y).toBeCloseTo(176.8, 10);
        expect(w).toBe(300);
        expect(h).toBeCloseTo(163.2, 10);
    });
});

describe('curveControlPoint', () => {
    const p1 = { x: 10, y: 20 };
    const p2 = { x: 40, y: 60 }; // dx=30, dy=40 → len=50
    const medio = { x: 25, y: 40 };

    it('con offsetFactor 0 devuelve el punto medio exacto', () => {
        expect(curveControlPoint(p1, p2, 0)).toEqual(medio);
    });

    it('queda a len*offsetFactor del punto medio, perpendicular al segmento', () => {
        const c = curveControlPoint(p1, p2); // factor por defecto 0.18
        const dist = Math.hypot(c.x - medio.x, c.y - medio.y);
        expect(dist).toBeCloseTo(50 * 0.18, 10);
        // Producto punto con la dirección del segmento = 0 → perpendicular.
        const dot = (c.x - medio.x) * (p2.x - p1.x) + (c.y - medio.y) * (p2.y - p1.y);
        expect(dot).toBeCloseTo(0, 10);
    });

    it('respeta un offsetFactor explícito', () => {
        const c = curveControlPoint(p1, p2, 0.12);
        expect(Math.hypot(c.x - medio.x, c.y - medio.y)).toBeCloseTo(50 * 0.12, 10);
    });

    it('segmento horizontal: la comba sale hacia +y', () => {
        const c = curveControlPoint({ x: 0, y: 0 }, { x: 10, y: 0 });
        expect(c.x).toBe(5);
        expect(c.y).toBeCloseTo(1.8, 10);
    });

    it('segmento degenerado (mismo punto) devuelve ese punto, sin NaN', () => {
        const c = curveControlPoint({ x: 7, y: 9 }, { x: 7, y: 9 });
        expect(c).toEqual({ x: 7, y: 9 });
    });
});

describe('ballPathPoint', () => {
    const pase: TacticalArrow = { type: 'ball_path', kind: 'pase', x1: 20, y1: 50, x2: 80, y2: 30, color: 'white' };

    it("'pase' es una recta: t=0 y t=1 son los extremos, t=0.5 el punto medio", () => {
        expect(ballPathPoint(pase, 0)).toEqual({ x: 20, y: 50 });
        expect(ballPathPoint(pase, 1)).toEqual({ x: 80, y: 30 });
        expect(ballPathPoint(pase, 0.5)).toEqual({ x: 50, y: 40 });
    });

    it('un ball_path viejo sin kind se trata como pase (recta)', () => {
        const viejo: TacticalArrow = { type: 'ball_path', x1: 20, y1: 50, x2: 80, y2: 30 };
        expect(ballPathPoint(viejo, 0.5)).toEqual({ x: 50, y: 40 });
    });

    it.each(['remate', 'penal'] as const)("'%s': t=0 y t=1 dan los extremos exactos", (kind) => {
        const a: TacticalArrow = { type: 'ball_path', kind, x1: 12.5, y1: 30, x2: 77.25, y2: 92, color: 'red' };
        const ini = ballPathPoint(a, 0);
        const fin = ballPathPoint(a, 1);
        expect(ini.x).toBeCloseTo(12.5, 10);
        expect(ini.y).toBeCloseTo(30, 10);
        expect(fin.x).toBeCloseTo(77.25, 10);
        expect(fin.y).toBeCloseTo(92, 10);
    });

    it("'remate' horizontal: t=0.5 NO es el punto medio, está desplazado media comba y sigue en %", () => {
        // En SVG: p1=(60,170), p2=(240,170), len=180, comba=0.12*180=21.6 hacia +y.
        // B(0.5) = mid + 0.5*(c - mid) → y_svg = 170 + 10.8 → en % = 50 + 10.8/3.4.
        const remate: TacticalArrow = { type: 'ball_path', kind: 'remate', x1: 20, y1: 50, x2: 80, y2: 50, color: 'white' };
        const p = ballPathPoint(remate, 0.5);
        expect(p.x).toBeCloseTo(50, 10); // en %, no 150 (unidades SVG)
        expect(Math.abs(p.y - 50)).toBeGreaterThan(1);
        expect(p.y).toBeCloseTo(50 + (0.5 * BALL_PATH_BEND * 180) / 3.4, 10);
    });

    it("'remate' diagonal: coincide con la Bézier cuadrática evaluada a mano en espacio SVG", () => {
        const a: TacticalArrow = { type: 'ball_path', kind: 'remate', x1: 10, y1: 20, x2: 70, y2: 80, color: 'white' };
        // Misma construcción que dibuja el SVG, escrita aparte: escalar a
        // 300×340, control perpendicular al punto medio, y volver a %.
        const P1 = { x: a.x1 * 3, y: a.y1 * 3.4 };
        const P2 = { x: a.x2 * 3, y: a.y2 * 3.4 };
        const dx = P2.x - P1.x;
        const dy = P2.y - P1.y;
        const len = Math.hypot(dx, dy);
        const off = len * BALL_PATH_BEND;
        const C = { x: (P1.x + P2.x) / 2 - (dy / len) * off, y: (P1.y + P2.y) / 2 + (dx / len) * off };
        const aMano = (t: number) => {
            const mt = 1 - t;
            return {
                x: (mt * mt * P1.x + 2 * mt * t * C.x + t * t * P2.x) / 3,
                y: (mt * mt * P1.y + 2 * mt * t * C.y + t * t * P2.y) / 3.4,
            };
        };
        for (const t of [0.25, 0.5, 0.75]) {
            const p = ballPathPoint(a, t);
            const e = aMano(t);
            expect(p.x).toBeCloseTo(e.x, 10);
            expect(p.y).toBeCloseTo(e.y, 10);
        }
    });

    it('un recorrido dentro de la cancha se mantiene en % (0-100) en todo su trazo', () => {
        const a: TacticalArrow = { type: 'ball_path', kind: 'penal', x1: 30, y1: 40, x2: 60, y2: 70, color: 'white' };
        for (let i = 0; i <= 10; i++) {
            const p = ballPathPoint(a, i / 10);
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(100);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(100);
        }
    });
});

describe('hydrateShape', () => {
    it('convierte strings numéricos (numeric de Postgres) a números y conserva size y rot', () => {
        const crudo = { type: 'cone', x1: '12.5', y1: '40', x2: '12.5', y2: '40', color: 'red', size: '2', rot: '90' } as unknown as TacticalArrow;
        expect(hydrateShape(crudo)).toStrictEqual({
            type: 'cone', x1: 12.5, y1: 40, x2: 12.5, y2: 40, color: 'red', size: 2, rot: 90,
        });
    });

    it('conserva kind cuando viene', () => {
        const a: TacticalArrow = { type: 'ball_path', x1: 1, y1: 2, x2: 3, y2: 4, color: 'white', kind: 'remate' };
        expect(hydrateShape(a)).toStrictEqual({ type: 'ball_path', x1: 1, y1: 2, x2: 3, y2: 4, color: 'white', kind: 'remate' });
    });

    it('NO agrega size/rot/kind cuando no vienen', () => {
        const a: TacticalArrow = { type: 'arrow', x1: 10, y1: 20, x2: 30, y2: 40, color: 'yellow' };
        const out = hydrateShape(a);
        expect(out).toStrictEqual({ type: 'arrow', x1: 10, y1: 20, x2: 30, y2: 40, color: 'yellow' });
        expect(Object.keys(out)).toEqual(['type', 'x1', 'y1', 'x2', 'y2', 'color']);
    });

    it('una figura vieja sin type sale con type undefined y sin claves nuevas', () => {
        const vieja = { x1: 10, y1: 20, x2: 30, y2: 40, color: 'white' } as TacticalArrow;
        const out = hydrateShape(vieja);
        expect(out.type).toBeUndefined();
        expect(out).toStrictEqual({ type: undefined, x1: 10, y1: 20, x2: 30, y2: 40, color: 'white' });
        expect('size' in out).toBe(false);
        expect('rot' in out).toBe(false);
        expect('kind' in out).toBe(false);
    });

    it('size null (jsonb) se trata como ausente', () => {
        const a = { type: 'ball', x1: 5, y1: 5, x2: 5, y2: 5, color: 'white', size: null } as unknown as TacticalArrow;
        expect('size' in hydrateShape(a)).toBe(false);
    });

    it('devuelve un objeto nuevo, no muta la entrada', () => {
        const a = { type: 'cone', x1: '1', y1: '2', x2: '1', y2: '2', color: 'red' } as unknown as TacticalArrow;
        const out = hydrateShape(a);
        expect(out).not.toBe(a);
        expect(a.x1).toBe('1');
    });
});

describe('isPointShape', () => {
    it.each([...OBJECT_TYPES])('true para el objeto de un punto %s', (t) => {
        expect(isPointShape(t)).toBe(true);
    });

    it.each(['arrow', 'curve', 'zone', 'ball_path'] as const)('false para la figura de dos puntos %s', (t) => {
        expect(isPointShape(t)).toBe(false);
    });

    it('false para undefined (figura vieja sin type)', () => {
        expect(isPointShape(undefined)).toBe(false);
    });
});

describe('OBJECT_TYPES / OBJECT_BOX', () => {
    it('OBJECT_TYPES no tiene duplicados', () => {
        expect(new Set(OBJECT_TYPES).size).toBe(OBJECT_TYPES.length);
    });

    it('OBJECT_BOX tiene exactamente una entrada por cada OBJECT_TYPES', () => {
        expect(Object.keys(OBJECT_BOX).sort()).toEqual([...OBJECT_TYPES].sort());
    });

    it.each([...OBJECT_TYPES])('la caja de %s tiene ancho y alto positivos', (t) => {
        expect(OBJECT_BOX[t].w).toBeGreaterThan(0);
        expect(OBJECT_BOX[t].h).toBeGreaterThan(0);
    });
});
