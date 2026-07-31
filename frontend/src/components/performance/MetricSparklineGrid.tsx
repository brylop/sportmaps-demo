/**
 * Grilla de miniaturas: reemplaza la lista plana de chips.
 *
 * Con decenas de métricas activas, mostrarlas todas expandidas estiraba la
 * página sin fin, así que las categorías se pliegan: abierta la del métrica
 * seleccionada, el resto cerradas con su resumen a la vista. Buscar abre todo.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { hasTrendShape, Sparkline } from './Sparkline';
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

  /**
   * Abierta al montar solo la categoría de la métrica activa. A partir de ahí
   * el plegado es del usuario: derivarlo de la selección hacía que al elegir
   * una métrica de otra categoría se cerrara sola la sección donde estabas.
   */
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial =
      metrics.find((m) => m.metric_key === selected)?.category ?? metrics[0]?.category ?? 'other';
    return { [initial]: true };
  });

  const searching = query.trim().length > 0;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q ? metrics.filter((m) => m.display_name.toLowerCase().includes(q)) : metrics;

    return CATEGORY_ORDER.map((category) => ({
      category,
      style: categoryStyle(category),
      items: visible.filter((m) => (m.category ?? 'other') === category),
    })).filter((g) => g.items.length > 0);
  }, [metrics, query]);

  // Red de seguridad: si nada quedó abierto, abre la primera categoría con datos.
  const anyOpen = groups.some((g) => open[g.category]);
  const isOpen = (category: string) =>
    searching || (open[category] ?? (!anyOpen && category === groups[0]?.category));

  return (
    <div className="space-y-2.5">
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

      {groups.map(({ category, style, items }) => {
        const isSectionOpen = isOpen(category);
        return (
          <section key={category} className="rounded-xl border border-border/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [category]: !isSectionOpen }))}
              aria-expanded={isSectionOpen}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left
                         hover:bg-accent/20 transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span className={`h-2 w-2 rounded-sm shrink-0 ${style.swatch}`} aria-hidden="true" />
              <span className="text-[10.5px] font-bold uppercase tracking-widest">
                {style.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{items.length}</span>
              {items.some((m) => m.metric_key === selected) && !isSectionOpen && (
                <span className="text-[10px] font-bold text-primary">· seleccionada</span>
              )}
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 transition-transform
                            ${isSectionOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {isSectionOpen && (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-2 pt-0">
                {items.map((m) => {
                  const series = evolution[m.metric_key] ?? [];
                  const values = series.map((s) => s.value);
                  const last = values[values.length - 1];
                  const delta =
                    values.length >= 2
                      ? computeDelta(last, values[values.length - 2], m.higher_is_better)
                      : null;
                  const isSelected = selected === m.metric_key;
                  const showTrend = hasTrendShape(values);

                  return (
                    <button
                      key={m.metric_key}
                      type="button"
                      onClick={() => onSelect(m.metric_key)}
                      aria-pressed={isSelected}
                      className={`rounded-lg border p-2.5 text-left transition-colors
                                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
                                  ${
                                    isSelected
                                      ? 'border-primary/55 bg-primary/[0.06]'
                                      : 'border-border/60 bg-card hover:bg-accent/20'
                                  }`}
                    >
                      <div
                        className="text-[11px] font-semibold leading-snug line-clamp-2 min-h-[2.1em]"
                        title={m.display_name}
                      >
                        {m.display_name}
                      </div>

                      <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-sm tabular-nums">
                          {fmt(last)}
                          {m.unit && (
                            <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                              {m.unit}
                            </span>
                          )}
                        </span>
                        {delta && (
                          <span
                            className={`text-[10.5px] font-bold tabular-nums shrink-0 ${deltaTone(
                              delta.improved
                            )}`}
                          >
                            {delta.improved === null ? '=' : delta.label}
                          </span>
                        )}
                      </div>

                      {showTrend ? (
                        <Sparkline
                          values={values}
                          stroke={trendStroke(delta?.improved ?? null)}
                          ariaLabel={`${m.display_name}: ${values.length} mediciones, actual ${fmt(
                            last
                          )}${m.unit ? ` ${m.unit}` : ''}`}
                        />
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {values.length === 1 ? '1 medición' : `${values.length} mediciones`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
