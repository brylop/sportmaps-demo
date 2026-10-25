/**
 * Pestañas tipo segmento de las pantallas V2 del deportista (mismo estilo que AcuPagosV2).
 * Sin ancho mínimo ni scroll horizontal: si no caben en una fila (360 px, zoom
 * 200 %), pasan a la siguiente y se reparten el ancho; una etiqueta larga parte
 * su texto antes que desbordar.
 */
import { cn } from '@/lib/utils';

export function SegmentedTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'min-h-touch min-w-0 flex-[1_1_auto] break-words rounded-lg px-2 py-1 text-sm leading-tight transition-colors',
            value === t.value ? 'bg-background font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
