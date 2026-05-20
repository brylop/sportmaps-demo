import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check, ChevronsUpDown, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOMBIAN_BANKS, BANK_LABEL } from '@/lib/colombian-banks';

/**
 * Autocomplete de bancos colombianos. Source of truth: COLOMBIAN_BANKS.
 *
 * Mismo trigger que CityCombobox para consistencia visual entre wizards.
 * Los bancos vienen agrupados (bancos tradicionales / fintech / billeteras
 * digitales). Cada CommandGroup respeta esos heading.
 */
interface BankComboboxProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  showLabel?: boolean;
  label?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function BankCombobox({
  value,
  onChange,
  placeholder = 'Selecciona tu banco...',
  showLabel = false,
  label = 'Banco',
  triggerClassName,
  disabled = false,
}: BankComboboxProps) {
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
            <CreditCard className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            {value ? BANK_LABEL[value] || value : placeholder}
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
            <CommandInput placeholder="Buscar banco..." className="text-sm h-[38px] w-full" />
            <CommandEmpty>No se encontró el banco.</CommandEmpty>
            <div className="max-h-[260px] overflow-y-auto">
              {COLOMBIAN_BANKS.map((g) => (
                <CommandGroup key={g.group} heading={g.group}>
                  {g.options.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`${o.label} ${g.group}`}
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
              ))}
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
