import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export const LATAM_COUNTRIES = [
  { label: "Colombia", value: "+57", flag: "🇨🇴" },
  { label: "México", value: "+52", flag: "🇲🇽" },
  { label: "Brasil", value: "+55", flag: "🇧🇷" },
  { label: "Argentina", value: "+54", flag: "🇦🇷" },
  { label: "Chile", value: "+56", flag: "🇨🇱" },
  { label: "Perú", value: "+51", flag: "🇵🇪" },
  { label: "Ecuador", value: "+593", flag: "🇪🇨" },
  { label: "Panamá", value: "+507", flag: "🇵🇦" },
  { label: "Venezuela", value: "+58", flag: "🇻🇪" },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({ value, onChange, placeholder, className }: PhoneInputProps) {
  const [open, setOpen] = React.useState(false);

  // Parse value to find country and number
  const selectedCountry = React.useMemo(() => {
    return LATAM_COUNTRIES.find((c) => value.startsWith(c.value)) || LATAM_COUNTRIES[0];
  }, [value]);

  const rawNumber = value.startsWith(selectedCountry.value) 
    ? value.slice(selectedCountry.value.length) 
    : value;

  const handleCountryChange = (countryValue: string) => {
    const newCountry = LATAM_COUNTRIES.find(c => c.value === countryValue);
    if (newCountry) {
      onChange(newCountry.value + rawNumber);
    }
    setOpen(false);
  };

  const handleNumberChange = (newNumber: string) => {
    // Only allow digits
    const cleanNumber = newNumber.replace(/\D/g, "");
    onChange(selectedCountry.value + cleanNumber);
  };

  return (
    <div className={cn("flex gap-0 group h-11 bg-background/50 border border-border/40 rounded-xl overflow-hidden focus-within:border-primary/50 transition-colors", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            className="w-[90px] h-full rounded-none border-r border-border/40 px-3 hover:bg-primary/10 transition-colors"
          >
            <span className="text-lg mr-1.5">{selectedCountry.flag}</span>
            <span className="text-xs font-bold text-muted-foreground">{selectedCountry.value}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar país..." />
            <CommandList>
              <CommandEmpty>No se encontró el país.</CommandEmpty>
              <CommandGroup>
                {LATAM_COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.value}
                    value={country.label}
                    onSelect={() => handleCountryChange(country.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedCountry.value === country.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="mr-2">{country.flag}</span>
                    <span className="flex-1">{country.label}</span>
                    <span className="text-muted-foreground text-xs">{country.value}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        type="tel"
        value={rawNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder || "Número"}
        className="flex-1 h-full border-0 bg-transparent rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 text-base font-medium"
      />
    </div>
  );
}
