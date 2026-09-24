/**
 * Glifos de la pizarra táctica: balón, silueta genérica de jugador y el ícono
 * de cada objeto de material. Todo dibujado a mano en SVG (nada de emoji: el
 * emoji cambia por plataforma y no escala ni gira parejo). Solo exporta
 * componentes (regla de Fast Refresh); colores y etiquetas viven en
 * lib/school/tacticalPalette.ts.
 */
import type { TacticalArrowColor } from '@/lib/school/footballQueries';
import type { ObjectType } from '@/lib/school/tacticalGeometry';
import { objectColor, type PinStyle } from '@/lib/school/tacticalPalette';

/** Balón dibujado, centrado en 0,0. */
export function BallGlyph({ r = 6 }: { r?: number }) {
  const k = r / 6;
  return (
    <g>
      <circle r={r} fill="#fafafa" stroke="#111827" strokeWidth={1 * k} />
      <polygon points={`0,${-2.4 * k} ${2.3 * k},${-0.7 * k} ${1.4 * k},${2 * k} ${-1.4 * k},${2 * k} ${-2.3 * k},${-0.7 * k}`} fill="#111827" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
        return <circle key={i} cx={Math.cos(a) * 4.3 * k} cy={Math.sin(a) * 4.3 * k} r={1.1 * k} fill="#111827" />;
      })}
    </g>
  );
}

/** Silueta genérica de jugador vista de frente, en una caja de 40×44. Es una
 *  FIGURA, no la persona: nunca lleva foto (decisión de producto 2026-09-24,
 *  consentimiento de menores). `jersey` = camiseta, `accent` = pantaloneta. */
export function SilhouetteGlyph({ jersey, accent = '#0f172a', number }: { jersey: string; accent?: string; number?: string | null }) {
  return (
    <g>
      <circle cx={20} cy={7} r={5.2} fill="#f1c9a5" stroke="#3f2a1d" strokeWidth={0.8} />
      <rect x={18} y={11.4} width={4} height={2.6} fill="#e0b48f" />
      <path d="M 12 15 L 28 15 L 33.5 22.5 L 29.5 25 L 27.5 21.8 L 27.5 30 L 12.5 30 L 12.5 21.8 L 10.5 25 L 6.5 22.5 Z" fill={jersey} stroke="#0f172a" strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M 12.5 30 L 27.5 30 L 27 36.5 L 21 36.5 L 20 33.5 L 19 36.5 L 13 36.5 Z" fill={accent} stroke="#0f172a" strokeWidth={0.7} />
      <rect x={14} y={36.5} width={4.2} height={6.5} rx={1.6} fill="#e0b48f" />
      <rect x={21.8} y={36.5} width={4.2} height={6.5} rx={1.6} fill="#e0b48f" />
      {number ? (
        <text x={20} y={26.5} textAnchor="middle" fontSize={8.5} fontWeight={900} fill="white" stroke="#0f172a" strokeWidth={0.6} paintOrder="stroke">{number}</text>
      ) : null}
    </g>
  );
}

/** Ícono de cada objeto. Se dibuja centrado en 0,0 y el <g> exterior lo
 *  lleva a (x,y), lo gira y lo escala -- así tamaño y rotación son un solo
 *  transform, igual para el ícono, su área de toque y su marco de selección.
 *  El arco usa el patrón `#tb-net` (lo define el <defs> de la capa de dibujo;
 *  en un SVG suelto sin ese patrón queda el fondo oscuro, sin la malla). */
export function ObjectIcon({ type, x, y, size = 1, rot = 0, color, pinStyle = 'disc' }: {
  type: ObjectType; x: number; y: number; size?: number; rot?: number; color?: TacticalArrowColor; pinStyle?: PinStyle;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${size})`}>
      {renderObjectBody(type, color, pinStyle)}
    </g>
  );
}

function renderObjectBody(type: ObjectType, color: TacticalArrowColor | undefined, pinStyle: PinStyle) {
  switch (type) {
    case 'cone':
      return (
        <g>
          <ellipse cy={6} rx={6.5} ry={2} fill="#1c1917" opacity={0.5} />
          <polygon points="0,-8 -5.5,6 5.5,6" fill={objectColor(color, '#f97316')} stroke="#7c2d12" strokeWidth={0.8} strokeLinejoin="round" />
          <line x1={-2.7} y1={0.5} x2={2.7} y2={0.5} stroke="white" strokeWidth={1.5} opacity={0.9} />
        </g>
      );
    case 'marker':
      return (
        <g>
          <ellipse rx={5.8} ry={2.8} fill={objectColor(color, '#facc15')} stroke="#111827" strokeWidth={0.6} />
          <ellipse rx={2.3} ry={1.1} fill="#111827" opacity={0.35} />
        </g>
      );
    case 'ball':
      return <BallGlyph r={6} />;
    case 'goal':
    case 'mini_goal': {
      const w = type === 'goal' ? 30 : 16;
      const d = type === 'goal' ? 9 : 5.5;
      const post = type === 'goal' ? '#f8fafc' : objectColor(color, '#f8fafc');
      return (
        <g>
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#0f172a" opacity={0.35} />
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="url(#tb-net)" stroke={post} strokeWidth={1.1} />
          {/* Boca del arco (línea de gol) hacia ARRIBA: puesto sobre nuestra
              línea de fondo mira a la cancha; para el arco de arriba se gira 180°. */}
          <line x1={-w / 2} y1={-d / 2} x2={w / 2} y2={-d / 2} stroke={post} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={-w / 2} cy={-d / 2} r={1.7} fill={post} stroke="#111827" strokeWidth={0.5} />
          <circle cx={w / 2} cy={-d / 2} r={1.7} fill={post} stroke="#111827" strokeWidth={0.5} />
        </g>
      );
    }
    case 'hurdle':
      return (
        <g>
          <line x1={-6.5} y1={4} x2={-6.5} y2={-3} stroke="#f8fafc" strokeWidth={1.6} strokeLinecap="round" />
          <line x1={6.5} y1={4} x2={6.5} y2={-3} stroke="#f8fafc" strokeWidth={1.6} strokeLinecap="round" />
          <line x1={-7.5} y1={-3} x2={7.5} y2={-3} stroke={objectColor(color, '#facc15')} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      );
    case 'ring':
      return (
        <g>
          <circle r={6.5} fill="none" stroke="#111827" strokeWidth={3.2} opacity={0.35} />
          <circle r={6.5} fill="none" stroke={objectColor(color, '#facc15')} strokeWidth={2.4} />
        </g>
      );
    case 'ladder': {
      const c = objectColor(color, '#facc15');
      return (
        <g stroke={c} strokeWidth={1.4} strokeLinecap="round">
          <line x1={-4.5} y1={-16.5} x2={-4.5} y2={16.5} />
          <line x1={4.5} y1={-16.5} x2={4.5} y2={16.5} />
          {[-16.5, -11, -5.5, 0, 5.5, 11, 16.5].map((yy) => (
            <line key={yy} x1={-4.5} y1={yy} x2={4.5} y2={yy} strokeWidth={1.1} />
          ))}
        </g>
      );
    }
    case 'pole': {
      const c = objectColor(color, '#ef4444');
      return (
        <g>
          <ellipse cy={8.5} rx={2.8} ry={1.3} fill="#1c1917" opacity={0.6} />
          <line x1={0} y1={8.5} x2={0} y2={-8} stroke={c} strokeWidth={2.2} strokeLinecap="round" />
          <line x1={0} y1={2.5} x2={0} y2={-2.5} stroke="white" strokeWidth={2.2} opacity={0.9} />
          <circle cy={-8} r={1.8} fill={c} stroke="#111827" strokeWidth={0.5} />
        </g>
      );
    }
    case 'mannequin':
      return (
        <g>
          <ellipse cy={10.5} rx={6} ry={2} fill="#1c1917" opacity={0.5} />
          <g transform="translate(-9 -10.5) scale(0.45)">
            <SilhouetteGlyph jersey={objectColor(color, '#facc15')} accent="#1e3a8a" />
          </g>
        </g>
      );
    case 'opponent':
      return pinStyle === 'silhouette' ? (
        <g transform="translate(-10 -11) scale(0.5)">
          <SilhouetteGlyph jersey="#dc2626" accent="#111827" number="R" />
        </g>
      ) : (
        <g>
          <circle r={7} fill="#dc2626" stroke="white" strokeWidth={1.5} />
          <text y={3} textAnchor="middle" fontSize={8} fontWeight={800} fill="white">R</text>
        </g>
      );
    default:
      return null;
  }
}
