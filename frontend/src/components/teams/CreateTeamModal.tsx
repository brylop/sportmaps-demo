import { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Users, Check, Pencil, X, Minus } from 'lucide-react';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useSportsCatalog, buscarDeporte } from '@/hooks/useSportsCatalog';
import { useSportCategories } from '@/hooks/useSportCategories';
import { useSchoolFeatures } from '@/hooks/useSchoolFeatures';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageUpload } from '@/components/common/ImageUpload';

/**
 * Nombre legible del grupo de categorias que trae el catalogo. Las llaves son
 * las del JSON de `sports_categories.categorias_oficiales`.
 */
function etiquetaGrupo(grupo: string): string {
    const conocidos: Record<string, string> = {
        categorias_edad: 'Por edad',
        categorias_edad_fifa: 'Por edad (FIFA)',
        niveles: 'Por nivel',
        modalidades: 'Modalidades',
        categorias_peso: 'Por peso',
        categorias_peso_masculino: 'Por peso - masculino',
        categorias_peso_femenino: 'Por peso - femenino',
        cinturones: 'Cinturones',
        divisiones: 'Divisiones',
        distancias: 'Distancias',
        pruebas: 'Pruebas',
        otras: 'Otras',
    };
    return conocidos[grupo] ?? grupo.replace(/_/g, ' ');
}

interface CreateTeamModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schoolId: string;
    branchId?: string | null;
    team?: any; // Add team for editing mode
}

export function CreateTeamModal({ open, onClose, onSuccess, schoolId, branchId, team }: CreateTeamModalProps) {
    const [creating, setCreating] = useState(false);
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { sports: sportConfigs } = useSchoolFeatures();

    // Catalogo de deportes desde la BD; la constante queda de respaldo.
    const { sports: catalogo, nombres: SPORTS_LIST } = useSportsCatalog();

    // Los deportes que ofrece el selector: los que la escuela tiene configurados
    // y, si no tiene ninguno, el catalogo completo.
    //
    // El orden importa y antes estaba al reves: este bloque vivia ARRIBA de la
    // linea que declara `SPORTS_LIST` con const. Cuando la escuela no tenia
    // sport_configs —el caso de casi todas— se evaluaba la rama del else y
    // caia en la zona muerta temporal: ReferenceError y el modal no abria.
    //
    // `sport_configs.sport` guarda el slug ('mma', 'futbol') pero `teams.sport`
    // guarda el nombre visible ('Fútbol'), que es lo que hay en las 120 filas de
    // hoy. Se resuelve el slug contra el catalogo para no sumar una tercera
    // forma de escribir el mismo deporte; si no esta en el catalogo (p. ej.
    // 'gimnasio', que es una instalacion y no un deporte) se deja tal cual.
    const sportsList = useMemo(() => {
        if (sportConfigs.length === 0) return SPORTS_LIST;
        return sportConfigs.map((sc) => {
            const norm = (s: string) =>
                s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/_/g, ' ').trim();
            const fila = catalogo.find((c) => norm(c.nombre) === norm(sc.sport) || c.slug === sc.sport);
            return fila?.nombre ?? sc.sport;
        });
    }, [sportConfigs, catalogo, SPORTS_LIST]);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sport: '',
        level: '',
        max_students: 20 as number | '',
        location: '',
        price_monthly: 0 as number | '',
        coach_id: '', // Main coach (legacy)
        coach_ids: [] as string[], // Multiple coaches
        branch_ids: [] as string[], // Multiple branches
        status: 'active',
        image_url: null as string | null,
    });

    // Alta de categoria en linea (solo escuelas de un deporte)
    const [creandoCategoria, setCreandoCategoria] = useState(false);
    const [catNombre, setCatNombre] = useState('');
    const [catMin, setCatMin] = useState('');
    const [catMax, setCatMax] = useState('');

    const [staff, setStaff] = useState<any[]>([]);
    const [branchesList, setBranchesList] = useState<any[]>([]);
    const [loadingInitialData, setLoadingInitialData] = useState(false);

    // ── Categorias del deporte seleccionado ─────────────────────────────────
    //
    // Antes esto leia UNA sola llave del catalogo (`categoriasCompetencia.niveles`)
    // y para todo lo demas caia en Principiante/Intermedio/Avanzado. El catalogo
    // guarda las categorias bajo la llave de su eje: `categorias_edad` en futbol,
    // `categorias_peso_masculino` en MMA, `modalidades` en patinaje. Resultado:
    // el selector mostraba la misma lista genérica en casi todos los deportes.
    //
    // Ahora sale de `school_sport_categories`, que devuelve las del catálogo
    // oficial de ESE deporte más las propias que agregó la escuela, cada una con
    // su grupo de origen. Es la misma fuente que «Deportes y categorías», así
    // que las dos pantallas no pueden divergir.
    const deporteSel = useMemo(
        () => buscarDeporte(catalogo, formData.sport),
        [catalogo, formData.sport],
    );
    const slugDeporte = deporteSel?.slug || null;

    const {
        adoptadas,
        sugeridas,
        agregar: agregarCategoria,
        isLoading: cargandoCategorias,
    } = useSportCategories(slugDeporte, schoolId);

    /** Eje del deporte: decide qué datos pide una categoría nueva. */
    const ejeDeporte = useMemo(
        () => sportConfigs.find((s) => s.sport === slugDeporte)?.categorization_axis ?? null,
        [sportConfigs, slugDeporte],
    );

    // Solo las escuelas de UN deporte administran categorías desde acá; las
    // multideporte lo hacen en «Deportes y categorías», que es donde se ven las
    // de todos los deportes juntas.
    const esMonodeporte = sportConfigs.length <= 1;

    /**
     * Agrupadas para el selector: primero las que la escuela usa, después las
     * oficiales por grupo. Sin separar, «Sub-15» y «Fútbol Playa» caen en la
     * misma lista y el selector se vuelve ilegible.
     */
    const gruposDeCategorias = useMemo(() => {
        const grupos: { titulo: string; items: { label: string; value: string }[] }[] = [];

        if (adoptadas.length > 0) {
            grupos.push({
                titulo: 'En uso',
                items: adoptadas.map((c) => ({
                    label: c.origen === 'propia' ? `${c.nombre} · propia` : c.nombre,
                    value: c.nombre,
                })),
            });
        }

        const porGrupo = new Map<string, { label: string; value: string }[]>();
        for (const c of sugeridas) {
            const g = c.detalle?.grupo ?? 'otras';
            if (!porGrupo.has(g)) porGrupo.set(g, []);
            porGrupo.get(g)!.push({ label: c.nombre, value: c.nombre });
        }
        for (const [g, items] of porGrupo) {
            grupos.push({ titulo: etiquetaGrupo(g), items });
        }

        return grupos;
    }, [adoptadas, sugeridas]);

    const hayCategorias = gruposDeCategorias.some((g) => g.items.length > 0);

    // Populate form if editing
    useEffect(() => {
        if (open && team) {
            setFormData({
                name: team.name || '',
                description: team.description || '',
                sport: team.sport || '',
                level: team.level || '',
                max_students: team.max_students || 20,
                location: team.location || '',
                price_monthly: team.price_monthly || 0,
                coach_id: team.coach_id || 'none',
                coach_ids: [] as string[],
                branch_ids: [] as string[],
                status: team.status || 'active',
                image_url: team.image_url || null,
            });

            // If editing, fetch the coaches and branches associations
            if (team.id) {
                fetchTeamCoaches(team.id);
                fetchTeamBranches(team.id);
            }
        } else if (open && !team) {
            // Reset for new team
            setFormData({
                name: '',
                description: '',
                sport: '',
                level: '',
                max_students: 20,
                location: '',
                price_monthly: 0,
                coach_id: '',
                coach_ids: [],
                branch_ids: [],
                status: 'active',
                image_url: null,
            });
        }
    }, [open, team]);

    const fetchTeamCoaches = async (teamId: string) => {
        try {
            const { data, error } = await (supabase as any)
                .from('team_coaches')
                .select('coach_id')
                .eq('team_id', teamId);

            if (error) throw error;
            if (data) {
                const ids = data.map(item => item.coach_id);
                setFormData(prev => ({ ...prev, coach_ids: ids }));
            }
        } catch (error) {
            console.error('Error fetching team coaches:', error);
        }
    };

    const fetchTeamBranches = async (teamId: string) => {
        try {
            const { data, error } = await (supabase as any)
                .from('team_branches')
                .select('branch_id')
                .eq('team_id', teamId);

            if (error) throw error;
            if (data) {
                const ids = data.map(item => item.branch_id);
                setFormData(prev => ({ ...prev, branch_ids: ids }));
            }
        } catch (error) {
            console.error('Error fetching team branches:', error);
        }
    };

    useEffect(() => {
        if (open && schoolId) {
            fetchInitialData();
        }
    }, [open, schoolId]);

    const fetchInitialData = async () => {
        try {
            setLoadingInitialData(true);

            // Fetch staff
            const { data: staffData } = await supabase
                .from('school_staff')
                .select('id, full_name')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            setStaff(staffData || []);

            // Fetch branches
            const { data: branchData } = await supabase
                .from('school_branches')
                .select('id, name, address, city')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            setBranchesList(branchData || []);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoadingInitialData(false);
        }
    };

    const syncTeamCoaches = async (teamId: string, coachIds: string[]) => {
        try {
            // Delete existing relations
            await (supabase as any)
                .from('team_coaches')
                .delete()
                .eq('team_id', teamId);

            // Insert new ones
            if (coachIds.length > 0) {
                const inserts = coachIds.map(id => ({
                    team_id: teamId,
                    coach_id: id,
                    school_id: schoolId
                }));
                const { error } = await (supabase as any).from('team_coaches').insert(inserts);
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error syncing team coaches:', error);
            throw error;
        }
    };

    const syncTeamBranches = async (teamId: string, branchIds: string[]) => {
        try {
            // Delete existing relations
            await (supabase as any)
                .from('team_branches')
                .delete()
                .eq('team_id', teamId);

            // Insert new ones
            if (branchIds.length > 0) {
                const inserts = branchIds.map(id => ({
                    team_id: teamId,
                    branch_id: id,
                    school_id: schoolId
                }));
                const { error } = await (supabase as any).from('team_branches').insert(inserts);
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error syncing team branches:', error);
            throw error;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!schoolId) {
            toast({
                title: 'Error',
                description: 'No se ha seleccionado una escuela. Completa el onboarding primero.',
                variant: 'destructive',
            });
            return;
        }

        if (!formData.name || !formData.sport) {
            toast({
                title: 'Campos requeridos',
                description: 'Por favor completa nombre y deporte',
                variant: 'destructive',
            });
            return;
        }

        try {
            setCreating(true);

            const teamData = {
                name: formData.name,
                description: formData.description,
                sport: formData.sport,
                level: formData.level,
                max_students: formData.max_students === '' ? null : Number(formData.max_students),
                location: formData.location,
                price_monthly: formData.price_monthly === '' ? 0 : Number(formData.price_monthly),
                coach_id: formData.coach_ids.length > 0 ? formData.coach_ids[0] : null, // Set first as main
                branch_id: formData.branch_ids.length > 0 ? formData.branch_ids[0] : (branchId || null), // Update branch_id for backward compatibility
                school_id: schoolId,
                status: formData.status,
                image_url: formData.image_url || null,
            };

            if (team?.id) {
                // Update existing team
                const { error } = await supabase
                    .from('teams')
                    .update(teamData)
                    .eq('id', team.id);

                if (error) throw error;

                // Sync coaches and branches
                await Promise.all([
                    syncTeamCoaches(team.id, formData.coach_ids),
                    syncTeamBranches(team.id, formData.branch_ids)
                ]);

                toast({
                    title: '¡Equipo actualizado!',
                    description: 'Los cambios se guardaron correctamente',
                });
            } else {
                // Create new team
                const { data: createdTeam, error } = await supabase
                    .from('teams')
                    .insert({
                        ...teamData,
                        current_students: 0
                    })
                    .select('id')
                    .single();

                if (error) throw error;

                if (createdTeam) {
                    await Promise.all([
                        syncTeamCoaches(createdTeam.id, formData.coach_ids),
                        syncTeamBranches(createdTeam.id, formData.branch_ids)
                    ]);
                }

                toast({
                    title: '¡Equipo creado!',
                    description: 'El equipo se creó correctamente',
                });
            }

            onSuccess();
            handleClose();
            queryClient.invalidateQueries({ queryKey: ['teams'] });
        } catch (error: any) {
            console.error('Error with team operation:', error);
            toast({
                title: 'Error de operación',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    const handleClose = () => {
        if (!creating) {
            setFormData({
                name: '',
                description: '',
                sport: '',
                level: '',
                max_students: 20,
                location: '',
                price_monthly: 0,
                coach_id: '',
                coach_ids: [] as string[],
                branch_ids: [] as string[],
                status: 'active',
                // Faltaba: al cerrar quedaba el logo del equipo anterior en el
                // estado. Lo tapaba el reset del useEffect de `open`, pero el
                // tipo no cerraba y el estado quedaba sucio igual.
                image_url: null,
            });
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {team ? 'Editar Equipo' : 'Nuevo Equipo'}
                    </DialogTitle>
                    <DialogDescription>
                        Configura los detalles del equipo y asigna uno o más entrenadores.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                            <Label className="text-xs font-semibold">Logo del Equipo</Label>
                            <ImageUpload
                                value={formData.image_url}
                                onChange={(url) => setFormData({ ...formData, image_url: url })}
                                onRemove={() => setFormData({ ...formData, image_url: null })}
                                bucket="school-assets"
                                path={`logos/${schoolId}`}
                                compact={true}
                                hideHint={true}
                                className="h-20 w-20"
                            />
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">
                                JPG, PNG o WebP<br />Max 5MB
                            </span>
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            <Label htmlFor="name">Nombre del Equipo *</Label>
                            <Input
                                id="name"
                                placeholder="Ej: Selección de Fútbol Sub-15"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sport">Deporte *</Label>
                            <Select
                                value={formData.sport}
                                onValueChange={(value) => {
                                    setFormData({ 
                                        ...formData, 
                                        sport: value,
                                        level: '' // Reset level when sport changes
                                    });
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar deporte" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sportsList.length > 0 ? (
                                        sportsList.map((sport) => (
                                            <SelectItem key={sport} value={sport}>
                                                {sport}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-center text-muted-foreground">
                                            No hay deportes configurados
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 min-h-[20px]">
                                <Label htmlFor="level">Categoria</Label>
                                {/* Escuelas de un solo deporte administran sus categorias
                                    aca; las multideporte, en "Deportes y categorias".
                                    Pide `ejeDeporte`: agregar escribe en sport_configs, y
                                    sin esa fila la RPC responde "activalo primero". Ofrecer
                                    un boton que siempre falla es peor que no ofrecerlo —
                                    hoy solo 2 escuelas tienen sport_configs. */}
                                {esMonodeporte && slugDeporte && ejeDeporte && ejeDeporte !== 'none' && (
                                    <button
                                        type="button"
                                        onClick={() => setCreandoCategoria((v) => !v)}
                                        className="text-xs text-primary hover:underline shrink-0"
                                    >
                                        {creandoCategoria ? 'Cancelar' : '+ Nueva categoria'}
                                    </button>
                                )}
                            </div>
                            <Select
                                value={formData.level}
                                onValueChange={(value: any) => setFormData({ ...formData, level: value })}
                                disabled={!slugDeporte}
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            !slugDeporte ? 'Elige un deporte primero'
                                                : cargandoCategorias ? 'Cargando...'
                                                    : 'Seleccionar categoria'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {hayCategorias ? (
                                        gruposDeCategorias.map((g) => (
                                            <SelectGroup key={g.titulo}>
                                                <SelectLabel className="text-[11px] uppercase tracking-wide">
                                                    {g.titulo}
                                                </SelectLabel>
                                                {g.items.map((it) => (
                                                    <SelectItem key={g.titulo + it.value} value={it.value}>
                                                        {it.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))
                                    ) : (
                                        // Respaldo para los deportes que todavia no tienen
                                        // categorias en el catalogo (ver ROADMAP: 7 variantes
                                        // de cheer, gimnasia y ciclismo).
                                        <>
                                            <SelectItem value="beginner">Principiante</SelectItem>
                                            <SelectItem value="intermediate">Intermedio</SelectItem>
                                            <SelectItem value="advanced">Avanzado</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>

                            {creandoCategoria && (
                                <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2">
                                    <p className="text-[11px] text-muted-foreground">
                                        {ejeDeporte === 'age' ? 'Este deporte se organiza por edad: indica el rango.'
                                            : ejeDeporte === 'weight' ? 'Este deporte se organiza por peso: indica el rango en kg.'
                                                : ejeDeporte === 'level' ? 'Este deporte se organiza por nivel (1 a 10).'
                                                    : 'Solo necesita el nombre.'}
                                    </p>
                                    <div className="flex flex-wrap items-end gap-2">
                                        <Input
                                            value={catNombre}
                                            onChange={(e) => setCatNombre(e.target.value)}
                                            placeholder={ejeDeporte === 'age' ? 'Sub-19' : 'Nombre'}
                                            className="h-8 w-[130px] text-sm"
                                        />
                                        {(ejeDeporte === 'age' || ejeDeporte === 'weight' || ejeDeporte === 'level') && (
                                            <>
                                                <Input
                                                    type="number" value={catMin}
                                                    onChange={(e) => setCatMin(e.target.value)}
                                                    placeholder="desde" className="h-8 w-[72px] text-sm"
                                                />
                                                <Input
                                                    type="number" value={catMax}
                                                    onChange={(e) => setCatMax(e.target.value)}
                                                    placeholder="hasta" className="h-8 w-[72px] text-sm"
                                                />
                                            </>
                                        )}
                                        <Button
                                            type="button" size="sm" variant="secondary" className="h-8"
                                            disabled={!catNombre.trim() || agregarCategoria.isPending}
                                            onClick={() =>
                                                agregarCategoria.mutate(
                                                    {
                                                        nombre: catNombre.trim(),
                                                        min: catMin === '' ? null : Number(catMin),
                                                        max: catMax === '' ? null : Number(catMax),
                                                    },
                                                    {
                                                        onSuccess: () => {
                                                            // Se selecciona sola: quien la crea la queria usar.
                                                            setFormData((f) => ({ ...f, level: catNombre.trim() }));
                                                            setCatNombre(''); setCatMin(''); setCatMax('');
                                                            setCreandoCategoria(false);
                                                        },
                                                    },
                                                )
                                            }
                                        >
                                            {agregarCategoria.isPending
                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                : 'Agregar'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción / Objetivos</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe los objetivos del equipo, requisitos, etc."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Entrenadores Asignados</Label>
                            {loadingInitialData ? (
                                <div className="flex items-center justify-center py-3 border rounded-md bg-muted/5">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                                    <span className="text-sm text-muted-foreground">Cargando personal...</span>
                                </div>
                            ) : staff.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-3 border rounded-md bg-muted/5">
                                    No hay personal activo disponible
                                </p>
                            ) : (
                                <Select
                                    value=""
                                    onValueChange={(value: string) => {
                                        if (value && !formData.coach_ids.includes(value)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                coach_ids: [...prev.coach_ids, value]
                                            }));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccione un entrenador para agregar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {staff
                                            .filter(coach => !formData.coach_ids.includes(coach.id))
                                            .map((coach) => (
                                                <SelectItem key={coach.id} value={coach.id}>
                                                    {coach.full_name}
                                                </SelectItem>
                                            ))
                                        }
                                        {staff.filter(coach => !formData.coach_ids.includes(coach.id)).length === 0 && (
                                            <div className="p-2 text-sm text-center text-muted-foreground">
                                                No hay más entrenadores disponibles
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        {formData.coach_ids.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                                {formData.coach_ids.map(id => {
                                    const c = staff.find(s => s.id === id);
                                    if (!c) return null;

                                    const initials = c.full_name
                                        .split(' ')
                                        .map((n: string) => n[0])
                                        .join('')
                                        .toUpperCase()
                                        .substring(0, 2);

                                    return (
                                        <div
                                            key={id}
                                            className="flex items-center gap-2 pl-1 pr-3 py-1 bg-primary/10 border border-primary/20 text-primary-foreground rounded-full animate-in zoom-in-95 duration-200"
                                        >
                                            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-[10px] font-bold">
                                                {initials}
                                            </div>
                                            <span className="text-sm font-medium text-foreground">{c.full_name}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        coach_ids: prev.coach_ids.filter(coachId => coachId !== id)
                                                    }));
                                                }}
                                                className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                            >
                                                <X className="h-3.5 w-3.5 text-foreground/80 hover:text-foreground" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_students">Capacidad Máxima</Label>
                            <NumberStepper
                                value={formData.max_students}
                                onChange={(val) => setFormData({ ...formData, max_students: val })}
                                min={1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price_monthly">Precio Mensual</Label>
                            <NumberStepper
                                value={formData.price_monthly}
                                onChange={(val) => setFormData({ ...formData, price_monthly: val })}
                                min={0}
                                step={10000}
                                unit="$"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Estado</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="inactive">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="location">Ubicación / Sede</Label>
                            {loadingInitialData ? (
                                <div className="flex items-center justify-center py-3 border rounded-md bg-muted/5">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                                    <span className="text-sm text-muted-foreground">Cargando sedes...</span>
                                </div>
                            ) : branchesList.length === 0 ? (
                                <Input
                                    id="location"
                                    placeholder="Nombre de la cancha o lugar de entrenamiento"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                />
                            ) : (
                                <Select
                                    value=""
                                    onValueChange={(value: string) => {
                                        if (value && !formData.branch_ids.includes(value)) {
                                            setFormData(prev => ({
                                                ...prev,
                                                branch_ids: [...prev.branch_ids, value]
                                            }));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccione una sede para agregar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {branchesList
                                            .filter(branch => !formData.branch_ids.includes(branch.id))
                                            .map((branch) => (
                                                <SelectItem key={branch.id} value={branch.id}>
                                                    {branch.name}
                                                </SelectItem>
                                            ))
                                        }
                                        {branchesList.filter(branch => !formData.branch_ids.includes(branch.id)).length === 0 && (
                                            <div className="p-2 text-sm text-center text-muted-foreground">
                                                No hay más sedes disponibles
                                            </div>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {formData.branch_ids.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                                {formData.branch_ids.map(id => {
                                    const b = branchesList.find(s => s.id === id);
                                    if (!b) return null;

                                    return (
                                        <TooltipProvider key={id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className="flex items-center gap-2 pl-3 pr-2 py-1 bg-secondary/20 border border-secondary/30 text-secondary-foreground rounded-full animate-in zoom-in-95 duration-200 cursor-help"
                                                    >
                                                        <span className="text-sm font-medium">{b.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    branch_ids: prev.branch_ids.filter(branchId => branchId !== id)
                                                                }));
                                                            }}
                                                            className="ml-1 hover:bg-secondary/40 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-1"
                                                        >
                                                            <X className="h-3.5 w-3.5 text-foreground/80 hover:text-foreground" />
                                                        </button>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="font-semibold text-xs border-b pb-1 mb-1">{b.name}</p>
                                                        <p className="text-xs">{b.address || 'Sin dirección registrada'}</p>
                                                        {b.city && <p className="text-[10px] opacity-70 italic">{b.city}</p>}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={creating}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={creating} className="bg-primary hover:bg-primary/90">
                            {creating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    {team ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                    {team ? 'Guardar Cambios' : 'Crear Equipo'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
