/**
 * Miniatura de tendencia. SVG plano — pesa mucho menos que un ResponsiveContainer
 * por tarjeta cuando hay decenas de métricas en pantalla.
 */
interface SparklineProps {
  values: number[];
  /** Color del trazo. Sigue la MEJORA, no el sentido del eje. */
  stroke: string;
  ariaLabel: string;
}

const W = 160;
const H = 36;
const PAD = 5;

/**
 * Con menos de 3 puntos no hay forma que dibujar: dos mediciones siempre dan
 * una recta, así que una grilla de métricas recién estrenadas se veía como
 * cincuenta diagonales idénticas. Por debajo de este umbral la tarjeta muestra
 * solo el valor y el delta, que es toda la información que existe.
 */
export const SPARKLINE_MIN_POINTS = 3;

export function hasTrendShape(values: number[]): boolean {
  return values.length >= SPARKLINE_MIN_POINTS;
}

export function Sparkline({ values, stroke, ariaLabel }: SparklineProps) {
  if (!hasTrendShape(values)) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (values.length - 1);
  // Serie constante: al centro. Antes caía al borde inferior y parecía una
  // barra de progreso llena.
  const y = (v: number) => (flat ? H / 2 : H - PAD - ((v - min) / (max - min)) * (H - PAD * 2));

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-1" role="img" aria-label={ariaLabel}>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(flat ? { strokeDasharray: '3 3', opacity: 0.55 } : {})}
      />
      <circle
        cx={x(values.length - 1)}
        cy={y(values[values.length - 1])}
        r={3.5}
        fill={stroke}
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </svg>
  );
}
