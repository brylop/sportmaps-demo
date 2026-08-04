/**
 * Lo primero que ve una familia: qué mejoró y en qué se va a trabajar.
 *
 * Reemplaza el volcado de 51 métricas como pantalla de entrada. Un padre no
 * quiere el catálogo — quiere saber si su hijo avanzó y qué sigue. El detalle
 * completo queda un clic más abajo para quien lo quiera.
 */
import { ArrowDown, ArrowUp, Sparkles, Target } from 'lucide-react';
import {
  BAND_STYLE,
  categoryStyle,
  deltaTone,
  fmt,
  type MetricHighlight,
} from '@/lib/school/performanceDisplay';

interface MetricHighlightsProps {
  improved: MetricHighlight[];
  toWorkOn: MetricHighlight[];
  onSelect: (metricKey: string) => void;
}

function HighlightCard({ h, onSelect }: { h: MetricHighlight; onSelect: (k: string) => void }) {
  const style = categoryStyle(h.metric.category);
  const Icon = h.delta.improved === false ? ArrowDown : ArrowUp;

  return (
    <button
      type="button"
      onClick={() => onSelect(h.metric.metric_key)}
      className="rounded-xl border border-green-500/25 bg-green-500/[0.05] p-3.5 text-left
                 transition-colors hover:bg-green-500/[0.09]
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`h-1.5 w-1.5 rounded-sm shrink-0 ${style.swatch}`} aria-hidden="true" />
        <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground">
          {style.label}
        </span>
      </div>

      <div className="text-[12.5px] font-semibold leading-snug mb-1.5">
        {h.metric.display_name}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono font-bold text-xl tabular-nums">
          {fmt(h.current)}
          {h.metric.unit && (
            <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
              {h.metric.unit}
            </span>
          )}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${deltaTone(
            h.delta.improved
          )}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {h.delta.label}
        </span>
      </div>
    </button>
  );
}

export function MetricHighlights({ improved, toWorkOn, onSelect }: MetricHighlightsProps) {
  if (improved.length === 0 && toWorkOn.length === 0) return null;

  return (
    <div className="space-y-5">
      {improved.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold mb-2.5">
            <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            Lo que más mejoró
            <span className="font-medium text-[11px] text-muted-foreground">
              lo mejor de cada área
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {improved.map((h) => (
              <HighlightCard key={h.metric.metric_key} h={h} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}

      {toWorkOn.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-bold mb-2.5">
            <Target className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            En qué se va a trabajar
          </h3>
          <div className="border rounded-xl overflow-hidden divide-y">
            {toWorkOn.map((h) => {
              const band = h.band as keyof typeof BAND_STYLE;
              return (
                <button
                  key={h.metric.metric_key}
                  type="button"
                  onClick={() => onSelect(h.metric.metric_key)}
                  className="w-full flex items-center gap-3 p-3 bg-card text-left
                             hover:bg-accent/20 transition-colors
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${BAND_STYLE[band].dot}`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold truncate">
                      {h.metric.display_name}
                    </span>
                    {h.metric.parent_hint && (
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {h.metric.parent_hint}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${BAND_STYLE[band].chip}`}
                  >
                    {BAND_STYLE[band].label}
                  </span>
                  <span className="font-mono font-bold text-sm tabular-nums shrink-0">
                    {fmt(h.current)}
                    {h.metric.unit && (
                      <span className="text-[10px] font-medium text-muted-foreground ml-0.5">
                        {h.metric.unit}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
