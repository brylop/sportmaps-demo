import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOMBIAN_CITIES, CITY_LABEL } from '@/lib/colombian-cities';

/**
 * Autocomplete de ciudades colombianas. Source of truth: COLOMBIAN_CITIES.
 *
 * Reemplaza al Input plano en cualquier formulario (onboarding escuela,
 * trainer, vendor, perfil). Mantiene la misma UX: trigger tipo Select,
 * popover con buscador, label "Ciudad · Departamento" para desambiguar.
 */
interface CityComboboxProps {
  /** Slug canonico (eg "bogota"). */
  value?: string | null;
  /** Devuelve el slug elegido. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Si true, muestra el label tipo "form" arriba. */
  showLabel?: boolean;
  /** Texto del label. Default "Ciudad". */
  label?: string;
  /** Aplica clases extra al trigger. */
  triggerClassName?: string;
  disabled?: boolean;
}

export function CityCombobox({
  value,
  onChange,
  placeholder = 'Selecciona tu ciudad...',
  showLabel = false,
  label = 'Ciudad',
  triggerClassName,
  disabled = false,
}: CityComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {showLabel && <label className="text-sm font-medium">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal bg-background border-input hover:bg-muted/50',
              !value && 'text-muted-foreground',
              triggerClassName,
            )}
          >
            <MapPin className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            {value ? CITY_LABEL[value] || value : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar ciudad..." className="text-sm h-[38px] w-full" />
            <CommandEmpty>No se encontró la ciudad.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {COLOMBIAN_CITIES.map((c) => (
                <CommandItem
                  key={c.value}
                  value={`${c.label} ${c.department}`}
                  onSelect={() => {
                    onChange(c.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === c.value ? 'opacity-100' : 'opacity-0')} />
                  <span>{c.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">· {c.department}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
