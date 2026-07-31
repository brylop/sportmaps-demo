/**
 * Miniatura de tendencia. SVG plano — pesa mucho menos que un ResponsiveContainer
 * por tarjeta cuando hay una docena de métricas en pantalla.
 */
interface SparklineProps {
  values: number[];
  /** Color del trazo. Sigue la MEJORA, no el sentido del eje. */
  stroke: string;
  ariaLabel: string;
}

const W = 160;
const H = 48;
const PAD = 6;

export function Sparkline({ values, stroke, ariaLabel }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div className="h-[48px] flex items-center text-[10px] text-muted-foreground">
        Una sola medición
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (values.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-1.5" role="img" aria-label={ariaLabel}>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={4}
        fill={stroke}
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </svg>
  );
}
