import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_QTY_PER_LINE } from '@/lib/store/cart';

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** Disponible según el servidor; el + se apaga al llegar. */
  max?: number;
  min?: number;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** Stepper de cantidad con tope = disponible (y 20 por línea, contrato INVALID_QTY). */
export function QtyStepper({ value, onChange, max, min = 1, label, className, disabled }: Props) {
  const cap = Math.min(max ?? MAX_QTY_PER_LINE, MAX_QTY_PER_LINE);
  return (
    <div className={cn('inline-flex items-center rounded-lg border bg-background', className)}>
      <Button
        type="button" variant="ghost" size="icon" className="h-9 w-9"
        aria-label={`Quitar una unidad de ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite" data-testid="qty-value">{value}</span>
      <Button
        type="button" variant="ghost" size="icon" className="h-9 w-9"
        aria-label={`Agregar una unidad de ${label}`}
        disabled={disabled || value >= cap}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
