import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Barra de filtros por tarjeta clicable que usamos encima de las tablas de gestión.
 * El patrón nació en SchoolFacilitiesPage (Reservas) y aquí queda unificado para
 * que todos los listados se vean y se comporten igual.
 */

export type StatFilterTone =
  | 'neutral'
  | 'primary'
  | 'emerald'
  | 'yellow'
  | 'rose'
  | 'blue'
  | 'violet'
  | 'orange';

const TONE_TEXT: Record<StatFilterTone, string> = {
  neutral: 'text-foreground',
  primary: 'text-primary',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  rose: 'text-rose-600 dark:text-rose-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
  orange: 'text-orange-600 dark:text-orange-400',
};

const TONE_BG: Record<StatFilterTone, string> = {
  neutral: 'bg-muted/20',
  primary: 'bg-primary/5',
  emerald: 'bg-emerald-500/5',
  yellow: 'bg-yellow-500/5',
  rose: 'bg-rose-500/5',
  blue: 'bg-blue-500/5',
  violet: 'bg-violet-500/5',
  orange: 'bg-orange-500/5',
};

export interface StatFilterItem<T extends string = string> {
  /** Valor del filtro. `null` = "todos" (sin filtrar). */
  key: T | null;
  label: string;
  value: number | string;
  tone?: StatFilterTone;
  /** Oculta la tarjeta sin tener que romper el arreglo con condicionales. */
  hidden?: boolean;
}

interface StatFilterBarProps<T extends string = string> {
  items: StatFilterItem<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Columnas en desktop. Por defecto se ajusta a la cantidad de tarjetas. */
  columns?: number;
  className?: string;
}

export function StatFilterBar<T extends string = string>({
  items,
  value,
  onChange,
  columns,
  className,
}: StatFilterBarProps<T>) {
  const visible = items.filter((i) => !i.hidden);
  if (visible.length === 0) return null;

  const cols = Math.min(columns ?? visible.length, 6);
  const gridCols: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
  };

  return (
    <div className={cn('grid grid-cols-2 gap-4', gridCols[cols] ?? 'md:grid-cols-5', className)}>
      {visible.map((s) => {
        const active = value === s.key;
        const tone = s.tone ?? 'neutral';
        return (
          <Card
            key={s.key ?? '__all__'}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            className={cn(
              'p-4 text-center border-2 transition-all cursor-pointer select-none active:scale-95 shadow-sm',
              active
                ? 'border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/10'
                : 'border-transparent opacity-70 hover:opacity-100 hover:border-border',
              TONE_BG[tone],
            )}
            onClick={() => onChange(active && s.key !== null ? null : s.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(active && s.key !== null ? null : s.key);
              }
            }}
          >
            <p className={cn('text-3xl font-black tracking-tight', TONE_TEXT[tone])}>{s.value}</p>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-1">
              {s.label}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
