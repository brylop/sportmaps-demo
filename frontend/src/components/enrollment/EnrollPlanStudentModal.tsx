import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { studentsAPI, Student } from '@/lib/api/students';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, UserPlus, Check, Users, X, Info } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    sport?: string;
    max_students?: number;
    current_students?: number;
    school_id: string;
}

interface Plan {
    id: string;
    name: string;
    price: number;
}

interface EnrollPlanStudentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schoolId: string;
    plan: Plan | null;
    offeringName: string;
}

export function EnrollPlanStudentModal({ open, onClose, onSuccess, schoolId, plan, offeringName }: EnrollPlanStudentModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [enrolling, setEnrolling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (open && schoolId) {
            loadStudents();
            loadTeams();
        }
    }, [open, schoolId]);

    useEffect(() => {
        if (selectedTeamId) {
            loadEnrolledStudents();
        } else {
            setEnrolledStudentIds([]);
        }
    }, [selectedTeamId]);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const data = await studentsAPI.getSchoolView(schoolId);
            setStudents(data as any);
        } catch (error: any) {
            console.error('Error loading students:', error);
            toast({
                title: 'Error al cargar estudiantes',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const loadTeams = async () => {
        try {
            const { data, error } = await supabase
                .from('teams')
                .select('*')
                .eq('school_id', schoolId)
                .eq('status', 'active');

            if (error) throw error;
            setTeams(data || []);

            // Auto-select first team if only one
            if (data && data.length === 1) {
                setSelectedTeamId(data[0].id);
            }
        } catch (error) {
            console.error('Error loading teams:', error);
        }
    };

    const loadEnrolledStudents = async () => {
        if (!selectedTeamId) return;
        try {
            const { data, error } = await supabase
                .from('enrollments')
                .select('user_id, child_id')
                .eq('team_id', selectedTeamId)
                .eq('status', 'active');

            if (error) throw error;
            setEnrolledStudentIds(data.map(e => e.child_id ?? e.user_id).filter(Boolean) as string[]);
        } catch (error) {
            console.error('Error loading enrolled students:', error);
        }
    };

    const handleEnroll = async (student: any) => {
        if (!plan || !selectedTeamId) {
            toast({
                title: 'Información incompleta',
                description: 'Debes seleccionar un equipo primero.',
                variant: 'destructive',
            });
            return;
        }

        try {
            setEnrolling(student.id);

            const isAdult = student.athlete_type === 'adult';
            const { bffClient } = await import('@/lib/api/bffClient');

            let enrollmentId: string | null = null;

            // 1. Intentar inscribir en el equipo
            try {
                const enrollRes = await bffClient.post('/api/v1/enrollments', {
                    ...(isAdult
                        ? { user_id: student.id }
                        : { child_id: student.id }),
                    team_id: selectedTeamId,
                });
                enrollmentId = (enrollRes as any).data?.id;
            } catch (error: any) {
                // Si ya está inscrito, buscamos el ID del enrollment existente
                if (error.response?.status === 400 && error.response?.data?.error?.includes('Ya está inscrito')) {
                    const { data: existingEnroll } = await supabase
                        .from('enrollments')
                        .select('id')
                        .eq('team_id', selectedTeamId)
                        .eq(isAdult ? 'user_id' : 'child_id', student.id)
                        .maybeSingle();

                    enrollmentId = existingEnroll?.id || null;
                } else {
                    throw error;
                }
            }

            // 2. Asignar el plan
            if (enrollmentId) {
                await bffClient.post('/api/v1/enrollments/assign-plan', {
                    enrollment_id: enrollmentId,
                    offering_plan_id: plan.id,
                });

                toast({
                    title: '¡Inscripción exitosa!',
                    description: `${student.full_name} ha sido inscrito en el equipo y se le ha asignado el plan ${plan.name}.`,
                });

                setEnrolledStudentIds([...enrolledStudentIds, student.id]);
                onSuccess();
            } else {
                throw new Error('No se pudo determinar el ID de inscripción.');
            }
        } catch (error: any) {
            console.error('Error enrolling student:', error);
            toast({
                title: 'Error al inscribir',
                description: error.response?.data?.error || error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
        }
    };

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const isEnrolled = (studentId: string) => enrolledStudentIds.includes(studentId);
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const isFull = selectedTeam ? enrolledStudentIds.length >= (selectedTeam.max_students || 20) : false;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Inscribir en Tarifa
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-2">
                            <p>Asigna este plan a un deportista. Se creará una inscripción activa.</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="secondary" className="bg-primary/10 text-primary">
                                    {offeringName} - {plan?.name}
                                </Badge>
                                {plan && (
                                    <Badge variant="outline" className="font-bold">
                                        ${new Intl.NumberFormat('es-CO').format(plan.price)}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="team-select" className="text-sm font-semibold flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" /> Seleccionar Equipo
                        </Label>
                        <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                            <SelectTrigger id="team-select">
                                <SelectValue placeholder="Busca un equipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t.id} value={t.id}>
                                        {t.name} {t.sport ? `(${t.sport})` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedTeamId && (
                            <p className="text-[10px] text-muted-foreground ml-1">
                                {enrolledStudentIds.length}/{selectedTeam?.max_students || 20} cupos ocupados
                            </p>
                        )}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar deportista..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-9"
                        />
                    </div>

                    <ScrollArea className="h-[350px] pr-4 border rounded-md p-2">
                        {!selectedTeamId ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Info className="h-10 w-10 text-muted-foreground/30 mb-2" />
                                <p className="text-muted-foreground text-sm">Selecciona un equipo para ver los deportistas</p>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                <p className="text-muted-foreground text-sm">Cargando deportistas...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                                <p className="text-muted-foreground text-sm">No se encontraron deportistas</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredStudents.map((student) => {
                                    const enrolled = isEnrolled(student.id);
                                    const isCurrentlyEnrolling = enrolling === student.id;

                                    return (
                                        <Card
                                            key={student.id}
                                            className={`transition-all border-border/50 ${enrolled ? 'bg-muted/50 opacity-70' : 'hover:border-primary/30'}`}
                                        >
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-sm truncate">{student.full_name}</p>
                                                            <MedicalAlertBadge medicalInfo={student.medical_info} />
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground truncate">{student.email || 'Sin email'}</p>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {enrolled ? (
                                                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 gap-1 h-7">
                                                                <Check className="h-3 w-3" /> Inscrito
                                                            </Badge>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleEnroll(student)}
                                                                disabled={isCurrentlyEnrolling || isFull}
                                                                className="h-8 gap-1.5"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <UserPlus className="h-3.5 w-3.5" />
                                                                        <span>Inscribir</span>
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
