/**
 * Chip de estado en palabras (V2): «Vencido», «En revisión», «Pagado»,
 * «Vigente»… Nunca el estado técnico. Colores con variante oscura.
 */
import { cn } from '@/lib/utils';

export type TonoEstado = 'peligro' | 'aviso' | 'info' | 'ok' | 'neutro';

const TONO: Record<TonoEstado, string> = {
  peligro: 'bg-destructive/10 text-destructive',
  aviso: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  neutro: 'bg-muted text-muted-foreground',
};

export function ChipEstado({ label, tono, className }: { label: string; tono: TonoEstado; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', TONO[tono], className)}>{label}</span>
  );
}
