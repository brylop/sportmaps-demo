import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SPORTS_CATALOG, type CategoriaGlobal } from '@/lib/constants/sportsCatalog';

/**
 * Autocomplete del catálogo de deportes. Source of truth: SPORTS_CATALOG.
 *
 * Reemplaza al <Select> plano: con 87 deportes la lista scrollable era inusable.
 * Mismo trigger que CityCombobox/BankCombobox para consistencia visual.
 *
 * El valor es el `nombre` en español (no el slug) para no romper los registros
 * que ya guardaron especialidad con SPORTS_LIST.
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

interface SportComboboxProps {
  /** Nombre del deporte en español (eg "Natación"). */
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
  id?: string;
  /** Marca el trigger con borde de error cuando el campo quedó inválido. */
  invalid?: boolean;
}

export function SportCombobox({
  value,
  onChange,
  placeholder = 'Busca un deporte...',
  triggerClassName,
  disabled = false,
  id,
  invalid = false,
}: SportComboboxProps) {
  const [open, setOpen] = useState(false);

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

  return (
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
            !value && 'text-muted-foreground',
            invalid && 'border-destructive focus-visible:ring-destructive',
            triggerClassName,
          )}
        >
          <Dumbbell className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="flex-1 truncate text-left">{value || placeholder}</span>
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
                    onSelect={() => {
                      onChange(o.nombre);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === o.nombre ? 'opacity-100' : 'opacity-0')} />
                    {o.nombre}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
