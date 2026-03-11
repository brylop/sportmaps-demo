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
import { useToast } from '@/hooks/use-toast';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { studentsAPI, Student } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, UserPlus, Check, Users, X } from 'lucide-react';

interface Team {
    id: string;
    name: string;
    sport?: string;
    max_students?: number;
    current_students?: number;
    school_id: string;
}

interface EnrollTeamStudentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    team: Team | null;
}

export function EnrollTeamStudentModal({ open, onClose, onSuccess, team }: EnrollTeamStudentModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [enrolling, setEnrolling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (open && team) {
            loadStudents();
            loadEnrolledStudents();
        }
    }, [open, team]);

    const loadStudents = async () => {
        if (!team?.school_id) return;
        try {
            setLoading(true);
            const data = await studentsAPI.getSchoolView(team.school_id);
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

    const loadEnrolledStudents = async () => {
        if (!team) return;
        try {
            const { data, error } = await supabase
                .from('enrollments')
                .select('user_id, child_id')
                .eq('team_id', team.id)
                .eq('status', 'active');

            if (error) throw error;
            setEnrolledStudentIds(data.map(e => e.child_id ?? e.user_id).filter(Boolean) as string[]);
        } catch (error) {
            console.error('Error loading enrolled students:', error);
        }
    };

    const handleEnroll = async (student: any) => {
        if (!team) return;

        try {
            setEnrolling(student.id);

            const isAdult = student.athlete_type === 'adult';

            // Usar BFF para soportar user_id y child_id
            const { bffClient } = await import('@/lib/api/bffClient');
            await bffClient.post('/api/v1/enrollments', {
                ...(isAdult
                    ? { user_id: student.id }
                    : { child_id: student.id }),
                team_id: team.id,
            });

            toast({
                title: '¡Estudiante inscrito!',
                description: `${student.full_name} ha sido inscrito en ${team.name}`,
            });

            setEnrolledStudentIds([...enrolledStudentIds, student.id]);
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'Error al inscribir',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
        }
    };

    const handleUnenroll = async (student: any) => {
        if (!team) return;

        try {
            setEnrolling(student.id);

            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('id')
                .eq('team_id', team.id)
                .eq('status', 'active')
                .or(`child_id.eq.${student.id},user_id.eq.${student.id}`)
                .maybeSingle();

            if (enrollment?.id) {
                await supabase
                    .from('enrollments')
                    .update({ status: 'inactive' })
                    .eq('id', enrollment.id);
            }

            toast({
                title: 'Estudiante removido',
                description: `${student.full_name} ha sido removido del equipo ${team.name}`,
            });

            setEnrolledStudentIds(enrolledStudentIds.filter(id => id !== student.id));
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'Error al remover',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
        }
    };

    const filteredStudents = students.filter(s =>
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (s.grade?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const isEnrolled = (studentId: string) => enrolledStudentIds.includes(studentId);
    const isFull = team ? enrolledStudentIds.length >= (team.max_students || 20) : false;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Inscribir Estudiantes
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-2">
                            <span>Gestiona los integrantes de este equipo.</span>
                            {team && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="secondary">{team.name}</Badge>
                                    <Badge variant="outline">{team.sport}</Badge>
                                    <Badge className={isFull ? 'bg-red-500' : 'bg-green-500'}>
                                        <Users className="h-3 w-3 mr-1" />
                                        {enrolledStudentIds.length}/{team.max_students || 20}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar estudiante por nombre, email o grado..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <ScrollArea className="h-[400px] pr-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                <p className="text-muted-foreground">Cargando estudiantes...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    {searchQuery
                                        ? 'No se encontraron estudiantes con esa búsqueda'
                                        : 'No hay estudiantes registrados o vinculados a esta escuela aún.'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredStudents.map((student) => {
                                    const enrolled = isEnrolled(student.id);
                                    const isCurrentlyEnrolling = enrolling === student.id;

                                    return (
                                        <Card
                                            key={student.id}
                                            className={`transition-all ${enrolled ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                                        >
                                            <CardContent className="p-3">
                                                <div className="flex items-start sm:items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium truncate text-sm sm:text-base">{student.full_name}</p>
                                                                <MedicalAlertBadge medicalInfo={student.medical_info} />
                                                            </div>
                                                            {enrolled && (
                                                                <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap w-fit">
                                                                    <Check className="h-3 w-3 mr-1" />
                                                                    Inscrito
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                                                            {student.email && <span className="truncate max-w-full">{student.email}</span>}
                                                            {student.grade && (
                                                                <span className="hidden sm:inline text-muted-foreground/50">• {student.grade}</span>
                                                            )}
                                                            {student.grade && (
                                                                <span className="sm:hidden">{student.grade}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {enrolled ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleUnenroll(student)}
                                                                disabled={isCurrentlyEnrolling}
                                                                className="text-destructive border-destructive hover:bg-destructive/10 h-8 sm:h-9"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <X className="h-4 w-4 mr-1" />
                                                                        <span>Remover</span>
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleEnroll(student)}
                                                                disabled={isCurrentlyEnrolling || isFull}
                                                                className="bg-green-600 hover:bg-green-700 h-8 sm:h-9"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <UserPlus className="h-4 w-4 mr-1" />
                                                                        <span className="hidden xs:inline">Inscribir</span>
                                                                        <span className="xs:hidden">+</span>
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
                    <div className="flex w-full justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                            {enrolledStudentIds.length} inscrito{enrolledStudentIds.length !== 1 ? 's' : ''} en este grupo
                        </p>
                        <Button variant="outline" onClick={onClose}>
                            Cerrar
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
