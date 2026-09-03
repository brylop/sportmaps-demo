import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOMBIAN_EPS } from '@/lib/colombian-eps';

/**
 * Autocomplete de EPS colombianas. Source of truth: COLOMBIAN_EPS.
 * Mismo patrón que BankCombobox/CityCombobox para consistencia visual.
 */
interface EpsComboboxProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EpsCombobox({
  value,
  onChange,
  placeholder = 'Buscar EPS...',
  disabled = false,
}: EpsComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
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
          )}
        >
          <HeartPulse className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <span className="truncate">{value || placeholder}</span>
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
          <CommandInput placeholder="Buscar EPS..." className="text-sm h-[38px] w-full" />
          <CommandEmpty>No se encontró la EPS.</CommandEmpty>
          <div className="max-h-[260px] overflow-y-auto">
            <CommandGroup>
              {COLOMBIAN_EPS.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
