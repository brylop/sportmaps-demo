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
import { Loader2, Plus, Users, Check, Pencil, X } from 'lucide-react';
import { SPORTS_LIST } from '@/lib/constants/sports';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';

interface CreateTeamModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schoolId: string;
    team?: any; // Add team for editing mode
}

export function CreateTeamModal({ open, onClose, onSuccess, schoolId, team }: CreateTeamModalProps) {
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
        status: 'active',
    });

    const [staff, setStaff] = useState<any[]>([]);
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
                status: team.status || 'active',
            });

            // If editing, fetch the coaches associations
            if (team.id) {
                fetchTeamCoaches(team.id);
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

                // Sync coaches
                await syncTeamCoaches(team.id, formData.coach_ids);

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
                    await syncTeamCoaches(createdTeam.id, formData.coach_ids);
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
                status: 'active',
            });
            onClose();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {loadingInitialData ? (
                                <div className="col-span-full flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : staff.length === 0 ? (
                                <p className="col-span-full text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/10">
                                    No hay personal activo disponible
                                </p>
                            ) : (
                                staff
                                    .filter(coach => !formData.coach_ids.includes(coach.id))
                                    .map((coach) => {
                                        const initials = coach.full_name
                                            .split(' ')
                                            .map((n: string) => n[0])
                                            .join('')
                                            .toUpperCase()
                                            .substring(0, 2);

                                        return (
                                            <div
                                                key={coach.id}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        coach_ids: [...prev.coach_ids, coach.id]
                                                    }));
                                                }}
                                                className="relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 border-transparent bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/20"
                                            >
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full text-xs font-bold shrink-0 bg-muted-foreground/20 text-muted-foreground">
                                                    {initials}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate text-foreground">
                                                        {coach.full_name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">Entrenador</p>
                                                </div>
                                            </div>
                                        );
                                    })
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
                            <Input
                                id="max_students"
                                type="number"
                                min="1"
                                value={formData.max_students}
                                onChange={(e) => setFormData({ ...formData, max_students: e.target.value === '' ? '' : parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price_monthly">Precio Mensual</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                                <Input
                                    id="price_monthly"
                                    type="number"
                                    min="0"
                                    step="1000"
                                    className="pl-7"
                                    value={formData.price_monthly}
                                    onChange={(e) => setFormData({ ...formData, price_monthly: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                />
                            </div>
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

                    <div className="space-y-2">
                        <Label htmlFor="location">Ubicación / Sede</Label>
                        <Input
                            id="location"
                            placeholder="Nombre de la cancha o lugar de entrenamiento"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
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
