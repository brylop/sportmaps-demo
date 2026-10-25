/**
 * Piezas compartidas de las pantallas internas de un hijo (acudiente V2):
 * contenedor, cabecera con el nombre, selector de hijo y «ver más».
 *
 * El «Volver» lo pone el layout (VolverAcudiente). Solo con la reversa
 * (VITE_ACUDIENTE_V2=false) cada pantalla vuelve a mostrar el suyo.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ACUDIENTE_V2 } from '@/lib/feature-flags';
import { cn } from '@/lib/utils';
import { firstName, initials } from '@/components/parent/v2/hijos/hijosUtils';
import type { HijoBasico } from './useHijoDetalle';

/** Ancho y aire comunes: una columna en celular, más aire en escritorio. */
export function PaginaHijo({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('mx-auto w-full space-y-4 pb-6 md:space-y-5', wide ? 'max-w-page' : 'max-w-page-narrow')}>
      {children}
    </div>
  );
}

/** «Volver» propio, solo con la reversa del acudiente V2 (si no, lo pone el layout). */
export function VolverLegado({ to, label }: { to: string; label: string }) {
  if (ACUDIENTE_V2) return null;
  return (
    <Link
      to={to}
      className="inline-flex min-h-touch items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** Píldoras para cambiar de hijo. Con un solo hijo no se muestra. */
export function SelectorHijo({
  hijos,
  selectedId,
  onSelect,
}: {
  hijos: HijoBasico[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (hijos.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Elige a tu hijo" className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
      {hijos.map((h) => {
        const sel = h.id === selectedId;
        return (
          <button
            key={h.id}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onSelect(h.id)}
            className={cn(
              'min-h-touch shrink-0 rounded-full border px-4 text-sm font-medium transition-colors motion-safe:active:scale-[0.97]',
              sel ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {firstName(h.full_name)}
          </button>
        );
      })}
    </div>
  );
}

/** Cabecera: avatar + una frase como título + una línea de apoyo. */
export function CabeceraHijo({
  hijo,
  titulo,
  sub,
  accion,
}: {
  hijo?: HijoBasico | null;
  titulo: string;
  sub?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {hijo && (
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={hijo.avatar_url || ''} alt="" className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{initials(hijo.full_name)}</AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold md:text-2xl">{titulo}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  );
}

/** Bloque plegable «ver más»: lo secundario queda a un toque, sin estorbar. */
export function VerMas({
  titulo,
  sub,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  sub?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border bg-card text-card-foreground">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-touch w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{titulo}</span>
          {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && <div className="border-t p-4">{children}</div>}
    </section>
  );
}

/** Cifra corta con su etiqueta (asistencia, partidos del mes…). */
export function Cifra({ valor, etiqueta, className }: { valor: ReactNode; etiqueta: string; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-muted/60 px-3 py-2.5', className)}>
      <p className="text-lg font-semibold tabular-nums leading-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
    </div>
  );
}
