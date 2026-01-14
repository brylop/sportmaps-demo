import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, UserPlus, Users, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { classesAPI, Class } from '@/lib/api/classes';
import { studentsAPI, Student } from '@/lib/api/students';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EnrollStudentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schoolId: string;
}

export function EnrollStudentModal({ open, onClose, onSuccess, schoolId }: EnrollStudentModalProps) {
  const [step, setStep] = useState<'select-student' | 'select-class' | 'confirm'>('select-student');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsData, classesData] = await Promise.all([
        studentsAPI.getStudents({ school_id: schoolId, status: 'active', limit: 500 }),
        classesAPI.getClasses({ school_id: schoolId, status: 'active', limit: 500 }),
      ]);
      setStudents(studentsData);
      setClasses(classesData);
    } catch (error: any) {
      toast({
        title: 'Error al cargar datos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !selectedClass) return;

    try {
      setEnrolling(true);
      await classesAPI.enrollStudent(
        selectedClass.id,
        selectedStudent.id,
        selectedStudent.full_name
      );

      toast({
        title: '¡Inscripción exitosa!',
        description: `${selectedStudent.full_name} ha sido inscrito en ${selectedClass.name}`,
      });

      onSuccess();
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Error al inscribir',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleClose = () => {
    setStep('select-student');
    setSelectedStudent(null);
    setSelectedClass(null);
    setSearchQuery('');
    onClose();
  };

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (s.parent_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const availableClasses = classes.filter(c => c.enrolled_count < c.capacity);

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent>
          <div className=\"flex items-center justify-center p-8\">
            <Loader2 className=\"h-8 w-8 animate-spin text-primary\" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className=\"max-w-2xl max-h-[80vh] overflow-y-auto\">
        <DialogHeader>
          <DialogTitle className=\"flex items-center gap-2\">
            <UserPlus className=\"h-5 w-5 text-primary\" />
            Inscribir Estudiante en Clase
          </DialogTitle>
          <div className=\"flex gap-2 mt-2\">
            <Badge variant={step === 'select-student' ? 'default' : 'outline'}>
              1. Estudiante
            </Badge>
            <Badge variant={step === 'select-class' ? 'default' : 'outline'}>
              2. Clase
            </Badge>
            <Badge variant={step === 'confirm' ? 'default' : 'outline'}>
              3. Confirmar
            </Badge>
          </div>
        </DialogHeader>

        {step === 'select-student' && (
          <div className=\"space-y-4\">
            <div>
              <Label>Seleccionar Estudiante</Label>
              <div className=\"relative mt-2\">
                <Search className=\"absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground\" />
                <Input
                  placeholder=\"Buscar estudiante...\"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className=\"pl-10\"
                />
              </div>
            </div>

            <div className=\"max-h-[400px] overflow-y-auto space-y-2\">
              {filteredStudents.length === 0 ? (
                <div className=\"text-center py-8 text-muted-foreground\">
                  No se encontraron estudiantes activos
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                      selectedStudent?.id === student.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className=\"flex items-center justify-between\">
                      <div>
                        <p className=\"font-medium\">{student.full_name}</p>
                        <p className=\"text-sm text-muted-foreground\">
                          {student.grade ? `Grado ${student.grade}` : 'Sin grado'} • {student.parent_name || 'Sin padre/madre registrado'}
                        </p>
                      </div>
                      {selectedStudent?.id === student.id && (
                        <CheckCircle2 className=\"h-5 w-5 text-primary\" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'select-class' && (
          <div className=\"space-y-4\">
            <div className=\"bg-accent p-3 rounded-lg\">
              <p className=\"text-sm text-muted-foreground\">Inscribiendo a:</p>
              <p className=\"font-medium\">{selectedStudent?.full_name}</p>
            </div>

            <div>
              <Label>Seleccionar Clase</Label>
            </div>

            <div className=\"max-h-[400px] overflow-y-auto space-y-2\">
              {availableClasses.length === 0 ? (
                <div className=\"text-center py-8 text-muted-foreground\">
                  No hay clases disponibles con cupos
                </div>
              ) : (
                availableClasses.map((classItem) => (
                  <div
                    key={classItem.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                      selectedClass?.id === classItem.id ? 'bg-accent border-primary' : ''
                    }`}
                    onClick={() => setSelectedClass(classItem)}
                  >
                    <div className=\"flex items-center justify-between\">
                      <div className=\"flex-1\">
                        <p className=\"font-medium\">{classItem.name}</p>
                        <p className=\"text-sm text-muted-foreground\">
                          {classItem.sport} • {classItem.level}
                        </p>
                        <div className=\"flex items-center gap-2 mt-1\">
                          <Users className=\"h-3 w-3\" />
                          <span className=\"text-xs\">
                            {classItem.enrolled_count}/{classItem.capacity} inscritos
                          </span>
                        </div>
                      </div>
                      {selectedClass?.id === classItem.id && (
                        <CheckCircle2 className=\"h-5 w-5 text-primary\" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className=\"space-y-4\">
            <div className=\"text-center py-6 space-y-4\">
              <div className=\"mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center\">
                <CheckCircle2 className=\"h-8 w-8 text-primary\" />
              </div>
              <div>
                <p className=\"text-lg font-semibold\">Confirmar Inscripción</p>
                <p className=\"text-sm text-muted-foreground mt-2\">
                  ¿Deseas inscribir al siguiente estudiante?
                </p>
              </div>
            </div>

            <div className=\"bg-accent p-4 rounded-lg space-y-3\">
              <div>
                <p className=\"text-sm text-muted-foreground\">Estudiante:</p>
                <p className=\"font-medium\">{selectedStudent?.full_name}</p>
                <p className=\"text-sm\">{selectedStudent?.grade && `Grado ${selectedStudent.grade}`}</p>
              </div>
              <div className=\"border-t pt-3\">
                <p className=\"text-sm text-muted-foreground\">En la clase:</p>
                <p className=\"font-medium\">{selectedClass?.name}</p>
                <p className=\"text-sm\">{selectedClass?.sport} • {selectedClass?.level}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'select-student' && (
            <>
              <Button variant=\"outline\" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => setStep('select-class')}
                disabled={!selectedStudent}
              >
                Siguiente
              </Button>
            </>
          )}
          {step === 'select-class' && (
            <>
              <Button variant=\"outline\" onClick={() => setStep('select-student')}>
                Atrás
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!selectedClass}
              >
                Siguiente
              </Button>
            </>
          )}
          {step === 'confirm' && (
            <>
              <Button variant=\"outline\" onClick={() => setStep('select-class')} disabled={enrolling}>
                Atrás
              </Button>
              <Button onClick={handleEnroll} disabled={enrolling}>
                {enrolling ? (
                  <>
                    <Loader2 className=\"h-4 w-4 mr-2 animate-spin\" />
                    Inscribiendo...
                  </>
                ) : (
                  <>
                    <UserPlus className=\"h-4 w-4 mr-2\" />
                    Confirmar Inscripción
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
