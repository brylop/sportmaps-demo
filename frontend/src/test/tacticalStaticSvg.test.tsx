/**
 * Render estático de la pizarra (src/components/school/TacticalStaticSvg.tsx).
 *
 * Por qué estas pruebas: el PDF del mesociclo y las miniaturas rasterizan este
 * componente serializado (renderToStaticMarkup → <img> → <canvas>). Si una
 * figura deja de dibujarse, o el SVG pierde el xmlns / el patrón de la red /
 * las puntas de flecha, el PDF sale con la cancha vacía o rota sin ningún
 * error a la vista.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TacticalStaticSvg } from '@/components/school/TacticalStaticSvg';
import type { TacticalArrow } from '@/lib/school/footballQueries';

const ALL_SHAPES: TacticalArrow[] = [
    { type: 'arrow', x1: 10, y1: 10, x2: 20, y2: 20, color: 'yellow' },
    { type: 'curve', x1: 30, y1: 30, x2: 40, y2: 50, color: 'red' },
    { type: 'zone', x1: 50, y1: 50, x2: 70, y2: 60, color: 'blue' },
    { type: 'ball_path', x1: 20, y1: 80, x2: 50, y2: 40, kind: 'pase' },
    { type: 'ball_path', x1: 20, y1: 80, x2: 50, y2: 5, kind: 'remate' },
    { type: 'ball_path', x1: 50, y1: 85, x2: 50, y2: 98, kind: 'penal', color: 'pink' },
    { type: 'freehand', x1: 10, y1: 10, x2: 30, y2: 30, points: [10, 10, 15, 20, 20, 15, 30, 30], color: 'purple' },
    { type: 'text', x1: 50, y1: 50, x2: 50, y2: 50, text: 'Presión alta', color: 'black' },
    { type: 'cone', x1: 5, y1: 5, x2: 5, y2: 5 },
    { type: 'goal', x1: 50, y1: 97, x2: 50, y2: 97, rot: 180 },
    { type: 'ladder', x1: 80, y1: 40, x2: 80, y2: 40, size: 1.5 },
    { type: 'ball', x1: 50, y1: 50, x2: 50, y2: 50 },
];

describe('TacticalStaticSvg', () => {
    it('es un único <svg> raíz autocontenido con el viewBox de la cancha', () => {
        const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={[]} width={420} />);
        expect(html.startsWith('<svg')).toBe(true);
        expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(html).toContain('viewBox="0 0 300 340"');
        expect(html).toContain('width="420"');
        expect(html).toContain('height="476"'); // 420 × 340/300
        // La cancha (FootballPitchBackground) va anidada.
        expect(html).toContain('pitch-glow');
        // Puntas de flecha y red del arco definidas en el propio SVG.
        expect(html).toContain('id="arrowhead-white"');
        expect(html).toContain('id="tb-net"');
    });

    it('dibuja un elemento por cada tipo de figura', () => {
        const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={ALL_SHAPES} />);
        for (const t of ['arrow', 'curve', 'zone', 'ball_path', 'freehand', 'text', 'cone', 'goal', 'ladder', 'ball']) {
            expect(html, `falta la figura ${t}`).toContain(`data-shape="${t}"`);
        }
        expect(html.match(/data-shape="ball_path"/g)).toHaveLength(3);
        expect(html).toContain('Presión alta');
        expect(html).toContain('url(#arrowhead-yellow)');
        expect(html).toContain('url(#tb-net)'); // el arco usa la red
        expect(html).toContain('>P</text>'); // marca del penal
        // Color de la paleta, no el nombre.
        expect(html).toContain('#38bdf8'); // zona azul
    });

    it('acepta numéricos que llegan como string del jsonb (hydrateShape)', () => {
        const raw = { type: 'arrow', x1: '10', y1: '10', x2: '20', y2: '20' } as unknown as TacticalArrow;
        const html = renderToStaticMarkup(<TacticalStaticSvg players={[]} arrows={[raw]} />);
        expect(html).toContain('x1="30"');
        expect(html).toContain('y2="68"');
    });

    it('dibuja solo titulares: número de camiseta o iniciales, y la etiqueta', () => {
        const html = renderToStaticMarkup(
            <TacticalStaticSvg
                arrows={[]}
                players={[
                    { x: 50, y: 92, label: 'Arquero', jersey: 1, role: 'starter' },
                    { x: 30, y: 60, label: 'Juan Pérez', jersey: null },
                    { x: 70, y: 60, label: 'Suplente', jersey: 18, role: 'bench' },
                ]}
            />,
        );
        expect(html.match(/data-player="true"/g)).toHaveLength(2);
        expect(html).toContain('>1</text>');
        expect(html).toContain('>JP</text>');
        expect(html).not.toContain('Suplente');
        expect(html).toContain('cx="150"'); // 50 × 3
        expect(html).toContain('#eab308'); // arquero en amarillo
    });

    it('no tiene handlers ni áreas de toque', () => {
        const html = renderToStaticMarkup(<TacticalStaticSvg players={[{ x: 1, y: 1, jersey: 9 }]} arrows={ALL_SHAPES} />);
        expect(html).not.toMatch(/transparent/);
        expect(html).not.toMatch(/cursor-/);
    });
});
