import { useState, useEffect } from 'react';
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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Users, Check, Pencil, X, Minus } from 'lucide-react';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SPORTS_LIST } from '@/lib/constants/sports';
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

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sport: '',
        level: 'beginner',
        max_students: 20 as number | '',
        location: '',
        price_monthly: 0 as number | '',
        coach_id: '', // Main coach (legacy)
        coach_ids: [] as string[], // Multiple coaches
        branch_ids: [] as string[], // Multiple branches
        status: 'active',
    });

    const [staff, setStaff] = useState<any[]>([]);
    const [branchesList, setBranchesList] = useState<any[]>([]);
    const [loadingInitialData, setLoadingInitialData] = useState(false);

    // Populate form if editing
    useEffect(() => {
        if (open && team) {
            setFormData({
                name: team.name || '',
                description: team.description || '',
                sport: team.sport || '',
                level: team.level || 'beginner',
                max_students: team.max_students || 20,
                location: team.location || '',
                price_monthly: team.price_monthly || 0,
                coach_id: team.coach_id || 'none',
                coach_ids: [] as string[],
                branch_ids: [] as string[],
                status: team.status || 'active',
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
                level: 'beginner',
                max_students: 20,
                location: '',
                price_monthly: 0,
                coach_id: '',
                coach_ids: [],
                branch_ids: [],
                status: 'active',
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
                level: 'beginner',
                max_students: 20,
                location: '',
                price_monthly: 0,
                coach_id: '',
                coach_ids: [],
                branch_ids: [],
                status: 'active',
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
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre del Equipo *</Label>
                        <Input
                            id="name"
                            placeholder="Ej: Selección de Fútbol Sub-15"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="sport">Deporte *</Label>
                            <Select
                                value={formData.sport}
                                onValueChange={(value) => setFormData({ ...formData, sport: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar deporte" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SPORTS_LIST.map((sport) => (
                                        <SelectItem key={sport} value={sport}>
                                            {sport}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="level">Nivel</Label>
                            <Select
                                value={formData.level}
                                onValueChange={(value: any) => setFormData({ ...formData, level: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="beginner">Principiante</SelectItem>
                                    <SelectItem value="intermediate">Intermedio</SelectItem>
                                    <SelectItem value="advanced">Avanzado</SelectItem>
                                </SelectContent>
                            </Select>
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
