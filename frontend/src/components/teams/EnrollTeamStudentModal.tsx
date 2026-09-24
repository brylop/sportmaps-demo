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
import { useToast } from '@/hooks/use-toast';
import { MedicalAlertBadge } from '@/components/common/MedicalAlertBadge';
import { studentsAPI, Student } from '@/lib/api/students';
import { classesAPI } from '@/lib/api/classes';
import { supabase } from '@/integrations/supabase/client';
import { useEntitlements } from '@/hooks/useEntitlements';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Loader2, UserPlus, Check, Users, X, Wallet, ArrowRightLeft, Layers } from 'lucide-react';

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
    const [teamFee, setTeamFee] = useState<number | null>(null);
    const { toast } = useToast();
    const { allowSecondaryTeamEnrollment } = useEntitlements();
    // Atleta que YA está en otro equipo: en vez de dejar pasar el 409 del BFF
    // ("ya tiene una inscripción activa"), se le pregunta al usuario qué hacer.
    const [conflict, setConflict] = useState<{
        student: any;
        otherTeamName: string;
        hasPlan: boolean;
    } | null>(null);

    useEffect(() => {
        if (open && team) {
            loadStudents();
            loadEnrolledStudents();
            loadTeamFee();
        }
    }, [open, team]);

    /**
     * La mensualidad del equipo, para poder advertirla ANTES de inscribir.
     *
     * Inscribir a un atleta en un equipo con precio le genera un cobro, pero no
     * en el momento: `open_month` resuelve el monto con
     * COALESCE(enrollments.monthly_fee, offering_plans.price, teams.price_monthly,
     * children.monthly_fee) y toma cualquier inscripción activa con monto > 0.
     * El cobro nace en la apertura del mes, así que nada en la pantalla delataba
     * el efecto económico de un clic. Se avisa para todos los roles, no solo
     * para el entrenador: el admin también se enteraba solo al abrir el mes.
     */
    const loadTeamFee = async () => {
        if (!team?.id) return;
        const { data } = await supabase
            .from('teams')
            .select('price_monthly')
            .eq('id', team.id)
            .maybeSingle();
        setTeamFee(Number((data as any)?.price_monthly) || null);
    };

    const loadStudents = async () => {
        if (!team?.school_id) return;
        try {
            setLoading(true);
            const data = await studentsAPI.getSchoolView(team.school_id);
            
            // ✅ DEDUPLICAR por ID
            const uniqueStudents = Array.from(
                new Map(data.map((s: any) => [s.id, s])).values()
            ) as Student[];
            
            console.log(`Loaded ${data.length} records, ${uniqueStudents.length} unique students`);
            setStudents(uniqueStudents);
        } catch (error: any) {
            console.error('Error loading students:', error);
            toast({
                title: 'Error al cargar deportistas',
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
            // Los tres ejes de sujeto (child_id, user_id, unregistered_athlete_id)
            // son mutuamente excluyentes por fila — faltaba el tercero acá, así
            // que ningún atleta sin cuenta aparecía nunca como ya inscrito
            // (el badge "X/20" y el check "Inscrito" quedaban en 0 aunque el
            // equipo tuviera roster real).
            const { data, error } = await supabase
                .from('enrollments')
                .select('user_id, child_id, unregistered_athlete_id')
                .eq('team_id', team.id)
                .eq('status', 'active');

            if (error) throw error;
            setEnrolledStudentIds(data.map(e => e.child_id ?? e.user_id ?? e.unregistered_athlete_id).filter(Boolean) as string[]);
        } catch (error) {
            console.error('Error loading enrolled students:', error);
        }
    };

    // Los tres ejes son mutuamente excluyentes — antes esto solo distinguía
    // adult/child, así que un atleta sin cuenta (athlete_type='unregistered')
    // se mandaba como child_id, un id que la tabla children no reconoce.
    const subjectFieldFor = (student: any) =>
        student.athlete_type === 'adult' ? 'user_id' :
        student.athlete_type === 'unregistered' ? 'unregistered_athlete_id' :
        'child_id';

    /**
     * Inscribir. Si el atleta YA está en otro equipo, el BFF responde 409
     * ("ya tiene una inscripción activa en esta escuela") — regla deliberada,
     * de ella cuelga el cobro. Antes ese 409 llegaba crudo al toast y el
     * entrenador quedaba sin salida (Carmel, 2026-09-24: "EQUIPO ARQUERO" con
     * arqueros que ya están en su categoría por edad; y un coach con dos
     * categorías de pequeños que no podía pasar niños de una a la otra).
     *
     * Ahora se detecta ANTES de llamar, con `enrolled_team_id` de la vista
     * school_athletes, y se pregunta qué hacer:
     *  · Agregarlo también → segundo equipo, sin salir del actual. Solo si la
     *    escuela lo habilitó (allow_secondary_team_enrollment); el segundo
     *    equipo nunca cobra (el BFF lo crea con cuota 0 fijada a mano).
     *  · Moverlo → el mismo camino del editor de atletas, que sí maneja los
     *    cobros pendientes del equipo anterior.
     */
    const handleEnroll = async (student: any) => {
        if (!team) return;
        const otherTeamId: string | null = student.enrolled_team_id ?? null;
        if (otherTeamId && otherTeamId !== team.id) {
            setConflict({
                student,
                otherTeamName: student.team_name || 'otro equipo',
                hasPlan: !!student.offering_plan_id,
            });
            return;
        }
        await postEnrollment(student, false);
    };

    const postEnrollment = async (student: any, secondary: boolean) => {
        if (!team) return;

        try {
            setEnrolling(student.id);

            // Usar BFF para soportar los tres tipos de sujeto
            const { bffClient } = await import('@/lib/api/bffClient');
            await bffClient.post('/api/v1/enrollments', {
                [subjectFieldFor(student)]: student.id,
                team_id: team.id,
                ...(secondary ? { secondary: true } : {}),
            });

            toast(secondary
                ? {
                    title: 'Agregado al segundo equipo',
                    description: `${student.full_name} sigue en ${student.team_name || 'su equipo'} y ahora también está en ${team.name}. Este equipo no le genera cobro.`,
                }
                : {
                    title: '¡Deportista inscrito!',
                    description: `${student.full_name} ha sido inscrito en ${team.name}`,
                });

            setEnrolledStudentIds(prev => [...prev, student.id]);
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'Error al inscribir',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
            setConflict(null);
        }
    };

    /**
     * Mover = PUT /students/:id, el camino del editor de atletas: actualiza la
     * MISMA inscripción (no abre otra), cancela los cobros pendientes del
     * equipo anterior y emite el del nuevo si tiene cuota. Se manda la cuota
     * que el atleta ya tenía (team_monthly_fee de la vista) para no pisar una
     * beca. Solo se ofrece sin plan: con plan, el cobro lo define el plan y ese
     * cambio va por la ficha. La fecha de inicio la pone el BFF (hoy, en la
     * zona de la escuela). El BFF decide si el rol puede (coach solo con
     * coach_can_create_athletes o coach_can_edit_categories) y su mensaje llega
     * al toast tal cual.
     */
    const handleMove = async (student: any) => {
        if (!team) return;

        try {
            setEnrolling(student.id);

            const { bffClient } = await import('@/lib/api/bffClient');
            await bffClient.put(`/api/v1/students/${student.id}`, {
                athlete_type: student.athlete_type ?? 'child',
                enrollment: {
                    team_id: team.id,
                    team_monthly_fee: student.team_monthly_fee ?? null,
                },
            });

            toast({
                title: 'Deportista movido',
                description: `${student.full_name} pasó de ${student.team_name || 'su equipo anterior'} a ${team.name}.`,
            });

            setEnrolledStudentIds(prev => [...prev, student.id]);
            // Que un segundo clic no vuelva a preguntar: ya está en este equipo.
            setStudents(prev => prev.map(s => (
                s.id === student.id ? ({ ...s, enrolled_team_id: team.id, team_name: team.name } as any) : s
            )));
            onSuccess();
        } catch (error: any) {
            toast({
                title: 'No se pudo mover',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setEnrolling(null);
            setConflict(null);
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
                .or(`child_id.eq.${student.id},user_id.eq.${student.id},unregistered_athlete_id.eq.${student.id}`)
                .maybeSingle();

            if (enrollment?.id) {
                // El error se tiene que propagar. RLS solo deja escribir
                // enrollments a owner/admin, así que a un entrenador esta
                // actualización le falla — y antes el resultado se descartaba y
                // el toast de éxito salía igual: la UI decía "removido" y el
                // atleta seguía en el equipo.
                const { error: cancelError } = await supabase
                    .from('enrollments')
                    .update({ status: 'cancelled' })
                    .eq('id', enrollment.id);

                if (cancelError) throw cancelError;
            }

            toast({
                title: 'Deportista removido',
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

    const isEnrolled = (studentId: string) => enrolledStudentIds.includes(studentId);

    const matchesSearch = (s: Student) => {
        const q = searchQuery.toLowerCase();
        return (
            s.full_name.toLowerCase().includes(q) ||
            (s.email?.toLowerCase() || '').includes(q) ||
            (s.grade?.toLowerCase() || '').includes(q)
        );
    };

    // Inscritos arriba y no inscritos abajo. Ambas listas respetan la búsqueda:
    // con query vacío matchesSearch devuelve true, así que se muestran todos.
    const enrolledList = students
        .filter(s => isEnrolled(s.id) && matchesSearch(s))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    const availableList = students
        .filter(s => !isEnrolled(s.id) && matchesSearch(s))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    const filteredStudents = [...enrolledList, ...availableList];
    // Sin cupo declarado NO hay tope. El `|| 20` inventaba un techo de 20 y dejaba
    // todos los botones "Inscribir" deshabilitados en cualquier categoria que lo
    // pasara, sin manera de recuperarse desde la UI del entrenador.
    const isFull = team?.max_students ? enrolledStudentIds.length >= team.max_students : false;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            {/* Un solo scroll: TODO el diálogo, igual que EnrollPlanStudentModal.
                El intento anterior (flex-col + ScrollArea interno solo para la
                lista, buscador fijo arriba) dejaba DOS regiones de scroll
                compitiendo — a veces ninguna ganaba y la lista quedaba
                cortada sin ninguna barra visible. Este patrón simple ya está
                probado en el resto de la app. */}
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Inscribir Deportistas
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
                                        {team.max_students
                                            ? `${enrolledStudentIds.length}/${team.max_students}`
                                            : enrolledStudentIds.length}
                                    </Badge>
                                </div>
                            )}
                            {teamFee !== null && teamFee > 0 && (
                                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30
                                                bg-amber-500/[0.07] px-3 py-2 mt-1">
                                    <Wallet
                                        className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                                        aria-hidden="true"
                                    />
                                    <span className="text-xs leading-relaxed">
                                        Este equipo tiene una mensualidad de{' '}
                                        <strong className="font-semibold tabular-nums">
                                            {teamFee.toLocaleString('es-CO', {
                                                style: 'currency',
                                                currency: 'COP',
                                                maximumFractionDigits: 0,
                                            })}
                                        </strong>
                                        . Al inscribir, el cobro se genera en la apertura del mes
                                        (o la cuota propia del atleta, si tiene una asignada).
                                    </span>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar deportista por nombre, email o grado..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div>
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                <p className="text-muted-foreground">Cargando deportistas...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground">
                                    {searchQuery
                                        ? 'No se encontraron deportistas con esa búsqueda'
                                        : 'No hay deportistas registrados o vinculados a esta escuela aún.'
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
                                                                        <span className="hidden sm:inline">Inscribir</span>
                                                                        <span className="sm:hidden">+</span>
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
                    </div>
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

                {/* El atleta ya está en otro equipo: preguntar en vez de fallar. */}
                <AlertDialog open={!!conflict} onOpenChange={(isOpen) => { if (!isOpen && !enrolling) setConflict(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {conflict?.student.full_name} ya está en {conflict?.otherTeamName}
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                    {allowSecondaryTeamEnrollment ? (
                                        <p>
                                            Puedes <strong>agregarlo también</strong> a <strong>{team?.name}</strong>:
                                            queda en los dos equipos y este segundo equipo no le genera cobro.
                                            O puedes <strong>moverlo</strong>: sale de {conflict?.otherTeamName}.
                                        </p>
                                    ) : (
                                        <p>
                                            Un deportista tiene un solo equipo. Puedes <strong>moverlo</strong> a{' '}
                                            <strong>{team?.name}</strong>: sale de {conflict?.otherTeamName} y se
                                            anulan los cobros pendientes de ese equipo.
                                        </p>
                                    )}
                                    {conflict?.hasPlan && (
                                        <p>
                                            Este deportista tiene un plan asignado. Para moverlo, edítalo desde su
                                            ficha en Deportistas, que es donde se ajusta el cobro.
                                        </p>
                                    )}
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel disabled={!!enrolling}>Cancelar</AlertDialogCancel>
                            {!conflict?.hasPlan && (
                                <Button
                                    variant="outline"
                                    onClick={() => conflict && handleMove(conflict.student)}
                                    disabled={!!enrolling}
                                >
                                    {enrolling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
                                    Moverlo a {team?.name}
                                </Button>
                            )}
                            {allowSecondaryTeamEnrollment && (
                                <Button
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => conflict && postEnrollment(conflict.student, true)}
                                    disabled={!!enrolling}
                                >
                                    {enrolling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Layers className="h-4 w-4 mr-1" />}
                                    Agregarlo también
                                </Button>
                            )}
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
}
