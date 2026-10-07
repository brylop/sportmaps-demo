import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { listPatients } from '@/lib/clinical/api';
import type { ClinicalPatient } from '@/lib/clinical/types';
import { cn } from '@/lib/utils';

interface PatientPickerProps {
  value: string | null;
  onChange: (patientId: string | null, patient: ClinicalPatient | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

const STATUS_ORDER: Record<ClinicalPatient['status'], number> = { activo: 0, alta: 1, archivado: 2 };
const STATUS_HINT: Record<ClinicalPatient['status'], string> = { activo: '', alta: 'De alta', archivado: 'Archivado' };

/** Combobox de pacientes del profesional (activos primero) con búsqueda. */
export function PatientPicker({ value, onChange, disabled, placeholder = 'Buscar paciente…' }: PatientPickerProps) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['clinical', 'patients'], queryFn: listPatients });

  const patients = useMemo(
    () => [...(q.data ?? [])].sort((a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.full_name.localeCompare(b.full_name, 'es')),
    [q.data],
  );
  const selected = patients.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.full_name : q.isLoading ? 'Cargando pacientes…' : placeholder}
          </span>
          {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin opacity-50" /> : <ChevronsUpDown className="h-4 w-4 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Nombre o documento" />
          <CommandList>
            {q.isError ? (
              <div className="p-3 text-sm text-destructive">No se pudieron cargar los pacientes.</div>
            ) : (
              <CommandEmpty>Sin resultados.</CommandEmpty>
            )}
            <CommandGroup>
              {selected && (
                <CommandItem value="__quitar__ quitar paciente" onSelect={() => { onChange(null, null); setOpen(false); }}>
                  <span className="text-muted-foreground">Quitar paciente</span>
                </CommandItem>
              )}
              {patients.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.full_name} ${p.document_number ?? ''} ${p.id}`}
                  onSelect={() => { onChange(p.id, p); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.full_name}</span>
                  {p.document_number && <span className="ml-2 text-xs text-muted-foreground">{p.document_number}</span>}
                  {STATUS_HINT[p.status] && <span className="ml-2 text-xs text-muted-foreground">{STATUS_HINT[p.status]}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default PatientPicker;
