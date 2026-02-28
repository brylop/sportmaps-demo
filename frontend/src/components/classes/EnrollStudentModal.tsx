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
import { studentsAPI, Student } from '@/lib/api/students';
import { classesAPI, Class } from '@/lib/api/classes';
import { Search, Loader2, UserPlus, Check, Users, X } from 'lucide-react';

interface EnrollStudentModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    classItem: Class | null;
}

export function EnrollStudentModal({ open, onClose, onSuccess, classItem }: EnrollStudentModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [enrolling, setEnrolling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (open && classItem) {
            loadStudents();
            loadEnrolledStudents();
        }
    }, [open, classItem]);

    const loadStudents = async () => {
        try {
            setLoading(true);
            const data = await studentsAPI.getStudents({
                school_id: classItem?.school_id || 'demo-school',
                status: 'active',
                limit: 500
            });
            setStudents(data);
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
        if (!classItem) return;
        try {
            const enrolled = await classesAPI.getClassStudents(classItem.id);
            setEnrolledStudents(enrolled.map((e: any) => e.student?.id || e.student_id));
        } catch (error) {
            console.error('Error loading enrolled students:', error);
        }
    };

    const handleEnroll = async (student: Student) => {
        if (!classItem) return;

        try {
            setEnrolling(student.id);
            await classesAPI.enrollStudent(classItem.id, student.id, student.full_name);

            toast({
                title: '¡Estudiante inscrito!',
                description: `${student.full_name} ha sido inscrito en ${classItem.name}`,
            });

            setEnrolledStudents([...enrolledStudents, student.id]);
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

    const handleUnenroll = async (student: Student) => {
        if (!classItem) return;

        try {
            setEnrolling(student.id);
            await classesAPI.unenrollStudent(classItem.id, student.id);

            toast({
                title: 'Estudiante removido',
                description: `${student.full_name} ha sido removido de ${classItem.name}`,
            });

            setEnrolledStudents(enrolledStudents.filter(id => id !== student.id));
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

    const isEnrolled = (studentId: string) => enrolledStudents.includes(studentId);
    const isFull = classItem ? classItem.enrolled_count >= classItem.capacity : false;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-2xl sm:w-full max-h-[90dvh] p-4 sm:p-6 flex flex-col">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Inscribir Estudiantes
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-2">
                            <span>Inscribe o remueve estudiantes para este programa específico.</span>
                            {classItem && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="secondary">{classItem.name}</Badge>
                                    <Badge variant="outline">{classItem.sport}</Badge>
                                    <Badge className={enrolledStudents.length >= (classItem.capacity || 20) ? 'bg-red-500' : 'bg-green-500'}>
                                        <Users className="h-3 w-3 mr-1" />
                                        {enrolledStudents.length}/{classItem.capacity || 20}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar estudiante por nombre, email o grado..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Students List */}
                    <ScrollArea className="flex-1 pr-0 sm:pr-4 -mx-1 px-1">
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
                                        : 'No hay estudiantes registrados aún'
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
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-medium truncate text-sm sm:text-base">{student.full_name}</p>
                                                            {enrolled && (
                                                                <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap">
                                                                    <Check className="h-3 w-3 mr-1" />
                                                                    Inscrito
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1 flex-wrap">
                                                            {student.email && <span className="truncate max-w-[150px] sm:max-w-none">{student.email}</span>}
                                                            {student.grade && <span className="shrink-0">• {student.grade}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                                                        {enrolled ? (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleUnenroll(student)}
                                                                disabled={isCurrentlyEnrolling}
                                                                className="text-destructive border-destructive hover:bg-destructive/10 w-full sm:w-auto"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <X className="h-4 w-4 mr-1" />
                                                                        Remover
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleEnroll(student)}
                                                                disabled={isCurrentlyEnrolling || isFull}
                                                                className="w-full sm:w-auto"
                                                            >
                                                                {isCurrentlyEnrolling ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <UserPlus className="h-4 w-4 mr-1" />
                                                                        Inscribir
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
                            {enrolledStudents.length} inscrito{enrolledStudents.length !== 1 ? 's' : ''} en esta clase
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
