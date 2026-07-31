/**
 * Grilla de miniaturas: reemplaza la lista plana de chips.
 *
 * Cada métrica con datos muestra su valor actual, su variación y su tendencia,
 * agrupadas por categoría. Un vistazo basta para ver el perfil completo del
 * atleta; el clic abre el gráfico grande.
 */
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Sparkline } from './Sparkline';
import {
  CATEGORY_ORDER,
  categoryStyle,
  computeDelta,
  deltaTone,
  fmt,
  trendStroke,
  type DisplayMetric,
  type SeriesPoint,
} from '@/lib/school/performanceDisplay';

interface MetricSparklineGridProps {
  metrics: DisplayMetric[];
  evolution: Record<string, SeriesPoint[]>;
  selected: string;
  onSelect: (metricKey: string) => void;
}

/** A partir de este número de métricas la grilla necesita buscador. */
const SEARCH_THRESHOLD = 8;

export function MetricSparklineGrid({
  metrics,
  evolution,
  selected,
  onSelect,
}: MetricSparklineGridProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? metrics.filter((m) => m.display_name.toLowerCase().includes(q))
      : metrics;

    return CATEGORY_ORDER.map((category) => ({
      category,
      style: categoryStyle(category),
      items: visible.filter((m) => (m.category ?? 'other') === category),
    })).filter((g) => g.items.length > 0);
  }, [metrics, query]);

  return (
    <div className="space-y-4">
      {metrics.length >= SEARCH_THRESHOLD && (
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${metrics.length} métricas con datos…`}
            aria-label="Buscar métrica"
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-xs
                       placeholder:text-muted-foreground
                       focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Ninguna métrica coincide con «{query}».
        </p>
      )}

      {groups.map(({ category, style, items }) => (
        <section key={category}>
          <h4 className="flex items-center gap-2 mb-2 text-[10.5px] font-bold uppercase tracking-widest">
            <span className={`h-2 w-2 rounded-sm ${style.swatch}`} aria-hidden="true" />
            {style.label}
            <span className="font-semibold normal-case tracking-normal text-[11px] text-muted-foreground">
              {items.length} con datos
            </span>
          </h4>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
            {items.map((m) => {
              const series = evolution[m.metric_key] ?? [];
              const values = series.map((s) => s.value);
              const last = values[values.length - 1];
              const delta =
                values.length >= 2
                  ? computeDelta(last, values[values.length - 2], m.higher_is_better)
                  : null;
              const isSelected = selected === m.metric_key;

              return (
                <button
                  key={m.metric_key}
                  type="button"
                  onClick={() => onSelect(m.metric_key)}
                  aria-pressed={isSelected}
                  className={`rounded-xl border p-3 text-left transition-colors
                              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                              ${
                                isSelected
                                  ? 'border-primary/55 bg-primary/[0.06]'
                                  : 'border-border/60 bg-card hover:bg-accent/20'
                              }`}
                >
                  <div className="text-[11.5px] font-semibold truncate" title={m.display_name}>
                    {m.display_name}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 mt-0.5">
                    <span className="font-mono font-bold text-base tabular-nums">
                      {fmt(last)}
                      {m.unit && (
                        <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                          {m.unit}
                        </span>
                      )}
                    </span>
                    {delta && (
                      <span
                        className={`text-[11px] font-bold tabular-nums ${deltaTone(delta.improved)}`}
                      >
                        {delta.improved === null ? '=' : delta.label}
                      </span>
                    )}
                  </div>

                  <Sparkline
                    values={values}
                    stroke={trendStroke(delta?.improved ?? null)}
                    ariaLabel={`${m.display_name}: ${values.length} mediciones, valor actual ${fmt(
                      last
                    )}${m.unit ? ` ${m.unit}` : ''}${
                      delta
                        ? delta.improved === null
                          ? ', sin cambio'
                          : delta.improved
                          ? ', mejoró'
                          : ', retrocedió'
                        : ''
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
