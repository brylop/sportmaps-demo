import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Chip de sede (multisede S1/S3 — docs/specs/multisede-selector-y-sede-del-atleta.md).
 *
 * El color es ESTABLE por id de sede: con la lista de sedes de la escuela se
 * asigna por la posición del id en la lista ordenada (dos sedes nunca chocan);
 * sin lista, por hash del id. Así Suba y Norte se ven igual en Deportistas, en
 * Cobros y en el selector del menú lateral.
 *
 * Sede NULL → «Sin sede» en gris (un cobro sin sede no se reparte entre sedes).
 */

// Paleta categórica con variante oscura: fondo suave + texto de contraste AA
// en claro y en oscuro. Sin verde ni rojo (se confunden con primary / destructive).
const PALETTE = [
  'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/40',
  'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/40',
  'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/40',
  'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/40',
  'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/40',
] as const;

const NO_BRANCH = 'bg-muted text-muted-foreground border-border';

/** Índice de color estable para una sede. */
export function branchColorIndex(branchId: string, branchIds?: readonly string[]): number {
  if (branchIds && branchIds.length > 0) {
    const idx = [...branchIds].sort().indexOf(branchId);
    if (idx >= 0) return idx % PALETTE.length;
  }
  let h = 0;
  for (let i = 0; i < branchId.length; i++) h = (h * 31 + branchId.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

/** Clases de color (fondo + texto + borde) de una sede; NULL = gris neutro. */
export function branchColorClasses(branchId: string | null | undefined, branchIds?: readonly string[]): string {
  return branchId ? PALETTE[branchColorIndex(branchId, branchIds)] : NO_BRANCH;
}

interface BranchChipProps {
  branchId: string | null | undefined;
  /** Nombre a mostrar. Si falta, se busca en `branches`. */
  name?: string | null;
  /** Sedes de la escuela (useSchoolContext().branches) para color sin choques. */
  branches?: readonly { id: string; name: string }[];
  className?: string;
  showIcon?: boolean;
}

export function BranchChip({ branchId, name, branches, className, showIcon = false }: BranchChipProps) {
  const ids = branches?.map((b) => b.id);
  const label = branchId
    ? (name || branches?.find((b) => b.id === branchId)?.name || 'Sede')
    : 'Sin sede';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0 h-5 text-[11px] font-medium whitespace-nowrap max-w-[10rem]',
        branchColorClasses(branchId, ids),
        className,
      )}
      title={label}
    >
      {showIcon && <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Punto de color de una sede (para el selector segmentado). */
export function BranchDot({ branchId, branches, className }: { branchId: string | null; branches?: readonly { id: string }[]; className?: string }) {
  if (!branchId) return null;
  const idx = branchColorIndex(branchId, branches?.map((b) => b.id));
  const DOTS = ['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'];
  return <span aria-hidden className={cn('inline-block h-2 w-2 rounded-full shrink-0', DOTS[idx], className)} />;
}
