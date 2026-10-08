/**
 * Evaluación rápida (spec rediseno-seguimiento-deportivo.md F5).
 *
 * Botones grandes 1-5, el mismo patrón del rating post-entreno que los
 * entrenadores sí usan. Tipos y lectura de `evaluation` en ./evaluationMetrics.
 */
import { NumberStepper } from '@/components/ui/number-stepper';
import { cn } from '@/lib/utils';
import { computeMetricBand } from '@/lib/school/performanceQueries';
import { BAND_STYLE } from '@/lib/school/performanceDisplay';
import type { EvaluationMetric } from './evaluationMetrics';

interface QuickMetricInputProps {
  metric: EvaluationMetric;
  value: number | '' | undefined;
  onChange: (value: number | '') => void;
  /** 'lg' = modal individual; 'sm' = celda de la grilla del equipo. */
  size?: 'lg' | 'sm';
}

function choicesFor(metric: EvaluationMetric): { value: number; label: string }[] | null {
  if (metric.options && metric.options.length > 0 && metric.options.length <= 10) return metric.options;
  switch (metric.scale) {
    case 'scale_1_5':
      return [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }));
    case 'scale_1_10':
      return Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
    case 'yes_no':
      return [
        { value: 1, label: 'Sí' },
        { value: 0, label: 'No' },
      ];
    default:
      return null;
  }
}

export function QuickMetricInput({ metric, value, onChange, size = 'lg' }: QuickMetricInputProps) {
  const choices = choicesFor(metric);
  const band = computeMetricBand(value === undefined ? '' : value, metric.thresholds);

  if (!choices) {
    return (
      <div className="flex items-center gap-1.5">
        {band && (
          <span className={`h-1.5 w-1.5 rounded-full ${BAND_STYLE[band].dot}`} title={BAND_STYLE[band].label} aria-label={BAND_STYLE[band].label} />
        )}
        <div className={size === 'lg' ? 'w-36' : 'w-28'}>
          <NumberStepper
            value={value ?? ''}
            onChange={onChange}
            min={metric.min_value ?? 0}
            max={metric.max_value ?? undefined}
            step={1}
            unit={metric.unit ?? undefined}
          />
        </div>
      </div>
    );
  }

  const isWide = choices.length > 5;
  return (
    <div
      role="radiogroup"
      aria-label={metric.display_name}
      className={cn('flex flex-wrap gap-1.5', isWide && size === 'lg' && 'grid grid-cols-5')}
    >
      {choices.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? '' : c.value)}
            title={c.label}
            className={cn(
              'rounded-lg border-2 font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'lg' ? 'min-h-11 min-w-11 px-3 text-base' : 'min-h-8 min-w-8 px-2 text-xs',
              selected
                ? 'border-orange bg-orange text-white'
                : 'border-border text-muted-foreground hover:border-orange/60 hover:text-foreground'
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
