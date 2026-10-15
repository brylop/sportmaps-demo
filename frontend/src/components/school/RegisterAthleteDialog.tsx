/**
 * «Inscribir atleta» — la escuela inscribe a un hijo de su escuela en un torneo
 * interno. Queda APROBADA; si el torneo tiene costo, se crea el cobro al
 * acudiente. Spec docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { registerAthleteBySchool } from '@/lib/api/tournaments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CategoriaOpcion {
  id: string;
  etiqueta: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  categorias: CategoriaOpcion[];
  /** false = torneo gratis: no hace falta pagador. */
  isPaid: boolean;
  /** Refresca la lista de inscritos después de inscribir. */
  onRegistered: () => void;
}

interface Atleta {
  id: string;
  full_name: string;
  parent_id: string | null;
}

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const LIMITE_BASE = 500;

function useDebounced<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

export function RegisterAthleteDialog({ open, onOpenChange, eventId, categorias, isPaid, onRegistered }: Props) {
  const { toast } = useToast();
  const { schoolId } = useSchoolContext();
  const [categoriaId, setCategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [inscribiendo, setInscribiendo] = useState<string | null>(null);

  // Una sola lectura (hasta 500 activos de la escuela); se filtra en el cliente
  // para no consultar la base en cada tecla.
  const { data: atletas, isLoading } = useQuery<Atleta[]>({
    queryKey: ['torneo-atletas-de-la-escuela', schoolId],
    enabled: open && !!schoolId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, parent_id')
        .eq('school_id', schoolId!)
        .eq('is_active', true)
        .order('full_name')
        .limit(LIMITE_BASE);
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const categoria = categoriaId || categorias[0]?.id || '';

  // Si la escuela tiene más de LIMITE atletas la lista base queda truncada y
  // filtrarla en el cliente no encontraría a los demás: ahí la búsqueda va al servidor.
  const truncada = (atletas?.length ?? 0) >= LIMITE_BASE;
  const termino = useDebounced(busqueda.trim(), 350);
  const { data: encontrados } = useQuery<Atleta[]>({
    queryKey: ['torneo-atletas-busqueda', schoolId, termino],
    enabled: open && !!schoolId && truncada && termino.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('id, full_name, parent_id')
        .eq('school_id', schoolId!)
        .eq('is_active', true)
        .ilike('full_name', `%${termino.replace(/[%_]/g, '')}%`)
        .order('full_name')
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Atleta[];
    },
  });

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (truncada && termino.length >= 2) return encontrados ?? [];
    const lista = atletas ?? [];
    return (q ? lista.filter((a) => sinTildes(a.full_name).includes(q)) : lista).slice(0, 50);
  }, [atletas, busqueda, truncada, termino, encontrados]);

  const inscribir = async (a: Atleta) => {
    if (!categoria) return;
    setInscribiendo(a.id);
    try {
      const r = await registerAthleteBySchool(eventId, { category_id: categoria, child_id: a.id });
      if (r.already_registered) {
        toast({ title: 'Ya estaba inscrito', description: `${a.full_name} ya está en esa categoría.` });
      } else {
        toast({
          title: 'Atleta inscrito',
          description: r.is_paid === false
            ? `${a.full_name} quedó inscrito. Se le avisó a la familia.`
            : `${a.full_name} quedó inscrito y se creó el cobro al acudiente. Se le avisó a la familia.`,
        });
      }
      onRegistered();
    } catch (e: any) {
      toast({ title: 'No se pudo inscribir', description: e?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setInscribiendo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscribir atleta</DialogTitle>
          <DialogDescription>
            La inscripción queda aprobada y la familia recibe un aviso.
            {isPaid ? ' Se crea el cobro al acudiente.' : ' El torneo es gratis: no se cobra.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <select className={selectCls} value={categoria} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buscar-atleta">Buscar atleta</Label>
            <Input id="buscar-atleta" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre del deportista" />
          </div>

          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : visibles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay atletas que coincidan.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
              {visibles.map((a) => {
                // Con cobro hace falta pagador: sin acudiente la RPC lo rechaza.
                const sinPagador = isPaid && !a.parent_id;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate">{a.full_name}</p>
                      {sinPagador && <Badge variant="outline" className="text-[10px] text-amber-600">Sin acudiente: asígnalo primero</Badge>}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sinPagador || inscribiendo !== null}
                      onClick={() => void inscribir(a)}
                    >
                      {inscribiendo === a.id ? 'Inscribiendo…' : 'Inscribir'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {truncada && termino.length < 2 && (
            <p className="text-xs text-muted-foreground">Tu escuela tiene muchos atletas: escribe al menos 2 letras para buscar entre todos.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
