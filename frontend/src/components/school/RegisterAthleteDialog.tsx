/**
 * «Inscribir atleta» — la escuela inscribe a un deportista de su escuela (hijo o
 * atleta adulto) en un torneo interno. Queda APROBADA; si el torneo tiene costo,
 * se crea el cobro al acudiente (o al propio atleta adulto). Spec
 * docs/specs/torneos-inscripcion-escuela-y-pago-2026-10-15.md.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { registerAthleteBySchool, type IndividualRegistration } from '@/lib/api/tournaments';
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
  /** Torneo con costo cuyo único medio es efectivo: la app no registra ese pago. */
  soloEfectivo?: boolean;
  /** Inscritos vigentes del torneo, para marcar a quien ya está en la categoría elegida. */
  inscritos?: Pick<IndividualRegistration, 'category_id' | 'child_id' | 'user_id'>[];
  /** Refresca la lista de inscritos después de inscribir. */
  onRegistered: () => void;
}

interface Atleta {
  id: string;
  full_name: string;
  /** Acudiente del hijo; en un adulto es el propio atleta (es su pagador). */
  parent_id: string | null;
  tipo: 'hijo' | 'adulto';
}

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const LIMITE_BASE = 500;

/** ¿Este atleta ya figura inscrito (no cancelado) en esa categoría? */
export function yaInscrito(
  a: Pick<Atleta, 'id' | 'tipo'>,
  categoriaId: string,
  inscritos: Props['inscritos'],
): boolean {
  return (inscritos ?? []).some((r) =>
    r.category_id === categoriaId && (a.tipo === 'hijo' ? r.child_id === a.id : !r.child_id && r.user_id === a.id));
}

function useDebounced<T>(valor: T, ms: number): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

export function RegisterAthleteDialog({
  open, onOpenChange, eventId, categorias, isPaid, soloEfectivo = false, inscritos, onRegistered,
}: Props) {
  const { toast } = useToast();
  const { schoolId } = useSchoolContext();
  const [categoriaId, setCategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [inscribiendo, setInscribiendo] = useState<string | null>(null);

  // Una sola lectura (hasta 500 activos de la escuela); se filtra en el cliente
  // para no consultar la base en cada tecla.
  const { data: hijos, isLoading } = useQuery<Atleta[]>({
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
      return ((data ?? []) as Omit<Atleta, 'tipo'>[]).map((h) => ({ ...h, tipo: 'hijo' as const }));
    },
  });

  // Atletas adultos: la membresía vive en school_members y el nombre en profiles
  // (profile_id apunta a auth.users, no a profiles: no hay JOIN directo).
  const { data: adultos, isLoading: cargandoAdultos } = useQuery<Atleta[]>({
    queryKey: ['torneo-adultos-de-la-escuela', schoolId],
    enabled: open && !!schoolId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: miembros, error } = await supabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', schoolId!)
        .eq('role', 'athlete')
        .eq('status', 'active')
        .limit(LIMITE_BASE);
      if (error) throw error;
      const ids = (miembros ?? []).map((m: { profile_id: string }) => m.profile_id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data: perfiles, error: e2 } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      if (e2) throw e2;
      return ((perfiles ?? []) as { id: string; full_name: string | null }[])
        .filter((p) => !!p.full_name)
        .map((p) => ({ id: p.id, full_name: p.full_name as string, parent_id: p.id, tipo: 'adulto' as const }));
    },
  });

  const categoria = categoriaId || categorias[0]?.id || '';

  // Si la escuela tiene más de LIMITE hijos la lista base queda truncada y
  // filtrarla en el cliente no encontraría a los demás: ahí la búsqueda va al servidor.
  const truncada = (hijos?.length ?? 0) >= LIMITE_BASE;
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
      return ((data ?? []) as Omit<Atleta, 'tipo'>[]).map((h) => ({ ...h, tipo: 'hijo' as const }));
    },
  });

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    const filtra = (lista: Atleta[]) => (q ? lista.filter((a) => sinTildes(a.full_name).includes(q)) : lista);
    const hijosVisibles = truncada && termino.length >= 2 ? (encontrados ?? []) : filtra(hijos ?? []);
    return [...hijosVisibles, ...filtra(adultos ?? [])]
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'es'))
      .slice(0, 50);
  }, [hijos, adultos, busqueda, truncada, termino, encontrados]);

  const inscribir = async (a: Atleta) => {
    if (!categoria) return;
    setInscribiendo(a.id);
    try {
      const r = await registerAthleteBySchool(
        eventId,
        a.tipo === 'hijo'
          ? { category_id: categoria, child_id: a.id }
          : { category_id: categoria, athlete_user_id: a.id },
      );
      if (r.already_registered) {
        toast({ title: 'Ya estaba inscrito', description: `${a.full_name} ya está en esa categoría.` });
      } else {
        const adulto = a.tipo === 'adulto';
        const aviso = `Se le avisó ${adulto ? 'al atleta' : 'a la familia'}.`;
        toast({
          title: 'Atleta inscrito',
          description: r.is_paid === false
            ? `${a.full_name} quedó inscrito. ${aviso}`
            : `${a.full_name} quedó inscrito y se creó el cobro ${adulto ? 'al atleta' : 'al acudiente'}. ${aviso}${soloEfectivo ? ' El torneo solo acepta efectivo: registra el pago en Pagos cuando lo reciba la escuela.' : ''}`,
        });
      }
      onRegistered();
    } catch (e: any) {
      toast({ title: 'No se pudo inscribir', description: e?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    } finally {
      setInscribiendo(null);
    }
  };

  const cargando = isLoading || cargandoAdultos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inscribir atleta</DialogTitle>
          <DialogDescription>
            La inscripción queda aprobada y la familia recibe un aviso.
            {isPaid ? ' Se crea el cobro al acudiente.' : ' El torneo es gratis: no se cobra.'}
            {isPaid && soloEfectivo ? ' Solo se acepta efectivo: cuando paguen en la escuela, regístralo en Pagos.' : ''}
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

          {cargando ? (
            <Skeleton className="h-32 w-full" />
          ) : visibles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay atletas que coincidan.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
              {visibles.map((a) => {
                // Con cobro hace falta pagador: sin acudiente la RPC lo rechaza.
                const sinPagador = isPaid && !a.parent_id;
                const inscrito = yaInscrito(a, categoria, inscritos);
                return (
                  <div key={`${a.tipo}-${a.id}`} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate">{a.full_name}</p>
                      <div className="flex flex-wrap gap-1">
                        {a.tipo === 'adulto' && <Badge variant="secondary" className="text-[10px]">Adulto</Badge>}
                        {inscrito && <Badge variant="outline" className="text-[10px] text-emerald-700">Ya inscrito en esta categoría</Badge>}
                        {sinPagador && !inscrito && <Badge variant="outline" className="text-[10px] text-amber-600">Sin acudiente: asígnalo primero</Badge>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sinPagador || inscrito || inscribiendo !== null}
                      onClick={() => void inscribir(a)}
                    >
                      {inscribiendo === a.id ? 'Inscribiendo…' : inscrito ? 'Inscrito' : 'Inscribir'}
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
