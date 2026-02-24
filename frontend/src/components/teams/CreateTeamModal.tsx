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
import { Loader2, Plus, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
        max_students: 20,
        location: '',
        price_monthly: 0,
        coach_id: '',
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
                status: team.status || 'active',
            });
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
                status: 'active',
            });
        }
    }, [open, team]);

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
                max_students: formData.max_students,
                location: formData.location,
                price_monthly: formData.price_monthly,
                coach_id: formData.coach_id === 'none' ? null : (formData.coach_id || null),
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

                toast({
                    title: '¡Equipo actualizado!',
                    description: 'Los cambios se guardaron correctamente',
                });
            } else {
                // Create new team
                const { error } = await supabase
                    .from('teams')
                    .insert({
                        ...teamData,
                        current_students: 0
                    });

                if (error) throw error;

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
                        Nuevo Equipo
                    </DialogTitle>
                    <DialogDescription>
                        Configura los detalles del nuevo equipo. Este formulario sigue el estándar de Programas.
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
                            <Input
                                id="sport"
                                placeholder="Ej: Fútbol, Voleibol"
                                value={formData.sport}
                                onChange={(e) => setFormData({ ...formData, sport: e.target.value })}
                                required
                            />
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="coach_id">Entrenador Responsable</Label>
                            <Select
                                value={formData.coach_id || 'none'}
                                onValueChange={(value) => setFormData({ ...formData, coach_id: value })}
                            >
                                <SelectTrigger id="coach_id">
                                    <SelectValue placeholder={loadingInitialData ? "Cargando..." : "Seleccionar entrenador"} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin asignar</SelectItem>
                                    {staff.map((coach) => (
                                        <SelectItem key={coach.id} value={coach.id}>
                                            {coach.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_students">Capacidad Máxima</Label>
                            <Input
                                id="max_students"
                                type="number"
                                min="1"
                                value={formData.max_students}
                                onChange={(e) => setFormData({ ...formData, max_students: parseInt(e.target.value) || 20 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price_monthly">Precio Sugerido ($)</Label>
                            <Input
                                id="price_monthly"
                                type="number"
                                min="0"
                                step="1000"
                                value={formData.price_monthly}
                                onChange={(e) => setFormData({ ...formData, price_monthly: parseFloat(e.target.value) || 0 })}
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
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Crear Equipo
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
