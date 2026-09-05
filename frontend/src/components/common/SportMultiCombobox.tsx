import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, Dumbbell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SPORTS_CATALOG, type CategoriaGlobal } from '@/lib/constants/sportsCatalog';

/**
 * Autocomplete multi-select del catálogo de deportes. Mismo source of truth
 * que SportCombobox (SPORTS_CATALOG) — hermano multi de ese componente, para
 * "qué deportes dicta este entrenador" (StaffFormDialog.tsx). El valor es el
 * `nombre` en español de cada deporte, igual que SportCombobox, para que
 * ambos campos (specialty legado y sports nuevo) usen el mismo formato.
 */

const GROUP_LABELS: Record<CategoriaGlobal, string> = {
  olimpicos_verano: 'Olímpicos de verano',
  olimpicos_invierno: 'Olímpicos de invierno',
  paralimpicos: 'Paralímpicos',
  reconocidos_COI_no_olimpicos: 'Reconocidos por el COI',
  no_olimpicos_federacion_internacional: 'Con federación internacional',
  deportes_mentales_y_estrategia: 'Mentales y de estrategia',
  deportes_motorizados: 'Motorizados',
  artes_marciales_y_combate: 'Artes marciales y combate',
  deportes_de_naturaleza: 'Naturaleza y aventura',
};

const GROUP_ORDER: CategoriaGlobal[] = [
  'olimpicos_verano',
  'artes_marciales_y_combate',
  'no_olimpicos_federacion_internacional',
  'reconocidos_COI_no_olimpicos',
  'deportes_de_naturaleza',
  'deportes_mentales_y_estrategia',
  'deportes_motorizados',
  'olimpicos_invierno',
  'paralimpicos',
];

interface SportMultiComboboxProps {
  /** Nombres de deporte en español seleccionados (eg ["Natación", "Atletismo"]). */
  value?: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
}

export function SportMultiCombobox({
  value,
  onChange,
  placeholder = 'Busca uno o más deportes...',
  triggerClassName,
  disabled = false,
  id,
  invalid = false,
}: SportMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = value ?? [];

  const groups = useMemo(() => {
    const byGroup = new Map<CategoriaGlobal, { nombre: string; nombreIngles: string }[]>();
    for (const sport of SPORTS_CATALOG) {
      const bucket = byGroup.get(sport.categoriaGlobal) || [];
      bucket.push({ nombre: sport.nombre, nombreIngles: sport.nombreIngles });
      byGroup.set(sport.categoriaGlobal, bucket);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      key: g,
      heading: GROUP_LABELS[g],
      options: (byGroup.get(g) || []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }));
  }, []);

  const toggle = (nombre: string) => {
    onChange(
      selected.includes(nombre)
        ? selected.filter((s) => s !== nombre)
        : [...selected, nombre],
    );
  };

  const remove = (nombre: string) => onChange(selected.filter((s) => s !== nombre));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal bg-background border-input hover:bg-muted/50',
              selected.length === 0 && 'text-muted-foreground',
              invalid && 'border-destructive focus-visible:ring-destructive',
              triggerClassName,
            )}
          >
            <Dumbbell className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <span className="flex-1 truncate text-left">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? selected[0]
                  : `${selected.length} deportes seleccionados`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <Command>
            <CommandInput placeholder="Buscar deporte..." className="text-sm h-[38px] w-full" />
            <CommandEmpty>No se encontró el deporte.</CommandEmpty>
            <div className="max-h-[260px] overflow-y-auto">
              {groups.map((g) => (
                <CommandGroup key={g.key} heading={g.heading}>
                  {g.options.map((o) => (
                    <CommandItem
                      key={o.nombre}
                      // Incluye el nombre en inglés para que buscar "swimming" encuentre "Natación".
                      value={`${o.nombre} ${o.nombreIngles}`}
                      onSelect={() => toggle(o.nombre)}
                    >
                      <Check className={cn('mr-2 h-4 w-4', selected.includes(o.nombre) ? 'opacity-100' : 'opacity-0')} />
                      {o.nombre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((nombre) => (
            <Badge key={nombre} variant="secondary" className="gap-1 pr-1">
              {nombre}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(nombre)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                  aria-label={`Quitar ${nombre}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
