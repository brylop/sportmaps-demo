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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { studentsAPI, Student } from '@/lib/api/students';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, UserPlus, Check, Users, Trash2 } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    price: number;
    max_sessions?: number | null;
}

interface EnrollPlanStudentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    schoolId: string;
    plan: Plan | null;
    offeringName: string;
}

export function EnrollPlanStudentModal({
    open,
    onClose,
    onSuccess,
    schoolId,
    plan,
    offeringName,
}: EnrollPlanStudentModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [enrollmentMap, setEnrollmentMap] = useState<Map<string, string>>(new Map()); // ✅ Mapeo student -> enrollment_id
    const [loading, setLoading] = useState(false);
    const [enrolling, setEnrolling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (open && schoolId) {
            loadStudents();
        }
    }, [open, schoolId]);

    useEffect(() => {
        if (plan?.id) {
            loadEnrolledInPlan();
        }
    }, [plan?.id, open]);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const data = await studentsAPI.getSchoolView(schoolId);
            
            // ✅ DEDUPLICAR por ID (solo la primera instancia)
            const uniqueStudents = Array.from(
                new Map(data.map((s: any) => [s.id, s])).values()
            ) as Student[];
            
            console.log(`Loaded ${data.length} records, ${uniqueStudents.length} unique students`);
            setStudents(uniqueStudents);
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

    // ✅ CAMBIO: Filtrar por status: 'active' y crear mapeo
    const loadEnrolledInPlan = async () => {
        if (!plan?.id) return;
        try {
            const { data, error } = await (supabase
                .from('enrollments') as any)
                .select('id, user_id, child_id')
                .eq('offering_plan_id', plan.id)
                .eq('status', 'active');  // ✅ AGREGAR FILTRO

            if (error) throw error;

            // ✅ Crear mapeo: studentId -> enrollmentId
            const map = new Map<string, string>();
            data?.forEach((enrollment: any) => {
                const studentId = enrollment.child_id ?? enrollment.user_id;
                if (studentId) {
                    map.set(studentId, enrollment.id);
                }
            });

            setEnrollmentMap(map);
        } catch (error) {
            console.error('Error loading plan enrollments:', error);
        }
    };

    const handleEnroll = async (student: any) => {
        if (!plan) {
            toast({
                title: 'Error',
                description: 'Información incompleta',
                variant: 'destructive',
            });
            return;
        }

        try {
            setEnrolling(student.id);
            const isAdult = student.athlete_type === 'adult';
            const { bffClient } = await import('@/lib/api/bffClient');

            // ✅ Inscribir en el plan
            const response = await bffClient.post<any>('/api/v1/enrollments', {
                ...(isAdult ? { user_id: student.id } : { child_id: student.id }),
                offering_plan_id: plan.id,
                school_id: schoolId,
                status: 'active',
            });

            const enrollmentData = response?.data;
            const enrollmentId = enrollmentData?.id;

            if (enrollmentId) {
                toast({
                    title: '¡Inscripción exitosa!',
                    description: `${student.full_name} ha sido inscrito en ${plan.name}.`,
                });

                // ✅ Actualizar mapeo localmente
                const newMap = new Map(enrollmentMap);
                newMap.set(student.id, enrollmentId);
                setEnrollmentMap(newMap);

                onSuccess();
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

    // ✅ CAMBIO: Usar el enrollmentId específico para remover
    const handleUnenroll = async (student: any) => {
        if (!plan) return;

        try {
            setEnrolling(student.id);
            const enrollmentId = enrollmentMap.get(student.id);

            if (!enrollmentId) {
                toast({
                    title: 'Error',
                    description: 'No se encontró el registro de inscripción',
                    variant: 'destructive',
                });
                return;
            }

            // ✅ Usar el enrollmentId específico para remover
            const { error } = await (supabase
                .from('enrollments') as any)
                .update({ status: 'cancelled' })
                .eq('id', enrollmentId)
                .eq('offering_plan_id', plan.id);

            if (error) throw error;

            toast({
                title: 'Inscripción cancelada',
                description: `${student.full_name} ha sido removido del plan ${plan.name}.`,
            });

            // ✅ Actualizar mapeo localmente
            const newMap = new Map(enrollmentMap);
            newMap.delete(student.id);
            setEnrollmentMap(newMap);

            onSuccess();
        } catch (error: any) {
            console.error('Error removing student:', error);
            toast({
                title: 'Error al remover',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
        }
    };

    // ✅ Filtrar por búsqueda
    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    // ✅ Separar en dos grupos (usar enrollmentMap)
    const availableStudents = filteredStudents.filter(
        s => !enrollmentMap.has(s.id)
    );

    const alreadyEnrolled = filteredStudents.filter(
        s => enrollmentMap.has(s.id)
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] z-[100]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Inscribir en Plan
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-2">
                            <p>Asigna este plan a estudiantes de tu escuela.</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                                <Badge variant="secondary" className="bg-primary/10 text-primary">
                                    {offeringName}
                                </Badge>
                                {plan && (
                                    <Badge variant="outline" className="font-bold">
                                        {plan.name} - ${new Intl.NumberFormat('es-CO').format(plan.price)}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-9"
                        />
                    </div>

                    {plan && (
                        <p className="text-[10px] text-muted-foreground px-1">
                            {enrollmentMap.size} estudiante{enrollmentMap.size !== 1 ? 's' : ''} inscrito{enrollmentMap.size !== 1 ? 's' : ''}
                        </p>
                    )}

                    <ScrollArea className="h-[400px] border rounded-md p-2">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                <p className="text-muted-foreground text-sm">Cargando estudiantes...</p>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                                <p className="text-muted-foreground text-sm">No hay estudiantes en la escuela</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Disponibles para inscribir */}
                                {availableStudents.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">
                                            Disponibles ({availableStudents.length})
                                        </p>
                                        {availableStudents.map((student) => {
                                            const isCurrentlyEnrolling = enrolling === student.id;
                                            return (
                                                <Card
                                                    key={student.id}
                                                    className="border-border/50 hover:border-primary/30 transition-colors"
                                                >
                                                    <CardContent className="p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-sm truncate">
                                                                        {student.full_name}
                                                                    </p>
                                                                    <MedicalAlertBadge medicalInfo={student.medical_info} />
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground truncate">
                                                                    {student.email || 'Sin email'}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleEnroll(student)}
                                                                disabled={isCurrentlyEnrolling}
                                                                className="h-8 gap-1.5 shrink-0"
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
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Ya inscritos */}
                                {alreadyEnrolled.length > 0 && (
                                    <>
                                        <p className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-4">
                                            Ya inscritos ({alreadyEnrolled.length})
                                        </p>
                                        {alreadyEnrolled.map((student) => {
                                            const isCurrentlyEnrolling = enrolling === student.id;
                                            return (
                                                <Card
                                                    key={student.id}
                                                    className="bg-muted/50 opacity-70 border-border/50"
                                                >
                                                    <CardContent className="p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-sm truncate">
                                                                        {student.full_name}
                                                                    </p>
                                                                    <MedicalAlertBadge medicalInfo={student.medical_info} />
                                                                </div>
                                                                <p className="text-[11px] text-muted-foreground truncate">
                                                                    {student.email || 'Sin email'}
                                                                </p>
                                                                {/* ✅ AGREGAR: Estadísticas */}
                                                                <p className="text-[10px] text-blue-600 font-medium mt-1">
                                                                    📅 Sesiones: 0/{plan.max_sessions || '∞'} usadas
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleUnenroll(student)}
                                                                disabled={isCurrentlyEnrolling}
                                                                className="h-8 gap-1.5 shrink-0 text-destructive border-destructive hover:bg-destructive/10"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        <span>Remover</span>
                                                                    </>
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </>
                                )}

                                {/* Sin resultados */}
                                {availableStudents.length === 0 && alreadyEnrolled.length === 0 && (
                                    <div className="text-center py-12">
                                        <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                                        <p className="text-muted-foreground text-sm">No hay resultados</p>
                                    </div>
                                )}
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
