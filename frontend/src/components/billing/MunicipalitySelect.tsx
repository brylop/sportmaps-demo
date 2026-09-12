/**
 * MunicipalitySelect — municipio colombiano con su código DANE.
 *
 * Reemplaza los dos campos de texto libre (departamento y ciudad) que había
 * antes. No es cosmético: la factura electrónica viaja con
 * `municipality_code`, y mientras el dato fuera texto escrito a mano nadie
 * podía usarlo — el adaptador mandaba el municipio de la escuela para TODOS
 * los clientes, así que a una familia de Medellín le salía la factura
 * diciendo Bogotá.
 *
 * El catálogo (1.122 municipios) es el mismo que publica Factus en sus tablas
 * de referencia, así que los códigos son exactamente los que su API acepta.
 * Se carga con import() dinámico para no sumar 50 KB al bundle de quien nunca
 * abre este formulario.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Municipio { c: string; n: string; d: string }

export interface MunicipalityValue {
    /** Código DANE de 5 dígitos, con el cero inicial (ej. 05001 Medellín). */
    code: string;
    /** Nombre del municipio, para mostrar. */
    name: string;
    /** Nombre del departamento. */
    department: string;
}

export function MunicipalitySelect({
    value,
    onChange,
    invalid,
}: {
    value: MunicipalityValue | null;
    onChange: (v: MunicipalityValue) => void;
    invalid?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [municipios, setMunicipios] = useState<Municipio[] | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // El catálogo se trae solo cuando el usuario abre el selector.
    useEffect(() => {
        if (!open || municipios) return;
        let cancelled = false;
        import('@/data/dane-municipios.json')
            .then((m) => { if (!cancelled) setMunicipios((m.default ?? m) as Municipio[]); })
            .catch(() => { if (!cancelled) setMunicipios([]); });
        return () => { cancelled = true; };
    }, [open, municipios]);

    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 50);
    }, [open]);

    const resultados = useMemo(() => {
        if (!municipios) return [];
        const q = query.trim().toLowerCase();
        // Sin búsqueda no se pintan 1.122 filas: se muestran las ciudades
        // principales, que cubren la mayoría de los casos reales.
        if (!q) {
            const principales = ['11001', '05001', '76001', '08001', '68001', '13001', '66001', '54001', '52001', '73001'];
            return municipios.filter((m) => principales.includes(m.c));
        }
        // Sin acentos: "bogota" tiene que encontrar "Bogotá".
        const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const nq = norm(q);
        return municipios
            .filter((m) => norm(m.n).includes(nq) || norm(m.d).includes(nq) || m.c.startsWith(nq))
            .slice(0, 60);
    }, [municipios, query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid}
                    className={cn(
                        'w-full justify-between font-normal',
                        !value && 'text-muted-foreground',
                        invalid && 'border-destructive',
                    )}
                >
                    <span className="truncate flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 opacity-60" />
                        {value ? `${value.name} — ${value.department}` : 'Busca tu municipio'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                <Input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Escribe el municipio o el departamento…"
                    className="h-9 mb-2"
                />
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                    {municipios === null ? (
                        <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando municipios…
                        </p>
                    ) : resultados.length === 0 ? (
                        <p className="p-3 text-center text-xs text-muted-foreground">
                            Sin resultados para “{query}”.
                        </p>
                    ) : (
                        <>
                            {!query.trim() && (
                                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Principales ciudades
                                </p>
                            )}
                            {resultados.map((m) => (
                                <button
                                    key={m.c}
                                    type="button"
                                    onClick={() => {
                                        onChange({ code: m.c, name: m.n, department: m.d });
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between gap-2',
                                        value?.code === m.c && 'bg-primary/10 text-primary font-semibold',
                                    )}
                                >
                                    <span className="truncate">
                                        {m.n}
                                        <span className="text-[11px] text-muted-foreground ml-1.5">{m.d}</span>
                                    </span>
                                    {value?.code === m.c && <Check className="h-4 w-4 shrink-0" />}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
