import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Dumbbell, Clock, Flame, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface AthleteVisibleRoutinesProps {
  /**
   * Opcional: úsalo cuando este componente se monta desde el perfil de un HIJO
   * (ej. ChildProgressPage / AcademicProgressPage), para que el padre vea las
   * rutinas visibles del hijo en vez de las propias.
   */
  childId?: string;
}

/**
 * Muestra las rutinas marcadas "visible_to_athletes" de TODAS las escuelas
 * donde el atleta (o su hijo) tiene una inscripción activa — sin importar
 * cuál escuela esté "activa" en el contexto de navegación (useSchoolContext),
 * porque un atleta puede pertenecer simultáneamente a un gimnasio y a un PT,
 * o a varios gimnasios a la vez. Mismo patrón que ya usa
 * useAthleteTrainingToday() para las sesiones PT de hoy.
 */
export function AthleteVisibleRoutines({ childId }: AthleteVisibleRoutinesProps) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();

  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const queryClient = useQueryClient();
  const [assignDate, setAssignDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  );
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedRoutine) return;
    setAssigning(true);
    try {
      const res = await fetch(
        `${BFF_URL}/api/v1/athlete/training/routines/${selectedRoutine.id}/self-assign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            client_id: childId ?? session?.user?.id,
            client_type: childId ? 'child' : 'registered',
            session_date: assignDate,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'No se pudo asignar la rutina.');

      toast({ title: '✅ Rutina asignada', description: `Programada para ${assignDate}.` });
      queryClient.invalidateQueries({ queryKey: ['athlete-training-today'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-training-history'] });
      setSelectedRoutine(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'No se pudo asignar la rutina.', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchRoutines();
    }
  }, [token, childId]);

  const fetchRoutines = async () => {
    setLoading(true);
    try {
      const url = new URL(`${BFF_URL}/api/v1/athlete/training/routines-visible`);
      if (childId) url.searchParams.set('child_id', childId);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al cargar rutinas');
      const data = await res.json();
      setRoutines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudieron cargar las rutinas.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando biblioteca de rutinas...</p>
      </div>
    );
  }

  if (routines.length === 0) {
    return null; // No mostrar nada si no hay rutinas visibles
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold tracking-tight">Biblioteca de Rutinas</h3>
      </div>
      <p className="text-xs text-muted-foreground">Rutinas compartidas por tus coaches para consulta libre</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {routines.map((routine) => (
          <Card 
            key={routine.id}
            className="group relative overflow-hidden bg-card border border-border/40 hover:border-primary/20 transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer flex flex-col justify-between"
            onClick={() => setSelectedRoutine(routine)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest mb-1.5 bg-primary/5 text-primary/80 border-primary/20">
                    {routine.category || 'General'}
                  </Badge>
                  <h4 className="font-bold text-sm group-hover:text-primary transition-colors line-clamp-1">{routine.name}</h4>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {routine.estimated_minutes || 45} min
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" /> {routine.estimated_calories || 0} kcal
                </span>
                <span className="text-[10px] font-bold capitalize">
                  {routine.difficulty || 'Intermedio'}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* modal de detalle de la rutina */}
      <Dialog open={!!selectedRoutine} onOpenChange={() => setSelectedRoutine(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl border-primary/20">
          {selectedRoutine && (
            <>
              <DialogHeader className="p-6 border-b shrink-0 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight">{selectedRoutine.name}</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-wider mt-0.5 text-primary">
                      {selectedRoutine.category} · {selectedRoutine.difficulty}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                  {selectedRoutine.description && (
                    <div className="space-y-1.5">
                      <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción</h5>
                      <p className="text-sm font-medium text-foreground leading-relaxed">{selectedRoutine.description}</p>
                    </div>
                  )}

                  <div className="flex gap-4 p-4 bg-muted/20 rounded-2xl border border-border/40">
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-center">
                      <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground font-bold uppercase">Duración</span>
                      <span className="text-lg font-black">{selectedRoutine.estimated_minutes || 45} min</span>
                    </div>
                    <div className="h-10 w-[1px] bg-border/60 self-center" />
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-center">
                      <Flame className="h-5 w-5 text-orange-500 mb-1" />
                      <span className="text-xs text-muted-foreground font-bold uppercase">Calorías</span>
                      <span className="text-lg font-black">{selectedRoutine.estimated_calories || 0} kcal</span>
                    </div>
                  </div>

                  {selectedRoutine.warmup && (
                    <div className="space-y-1.5 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                      <h5 className="text-xs font-black uppercase tracking-widest text-primary">Calentamiento</h5>
                      <p className="text-xs font-semibold leading-relaxed">{selectedRoutine.warmup}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Bloques de Entrenamiento ({selectedRoutine.blocks?.length || 0})</h5>
                    <div className="space-y-3">
                      {selectedRoutine.blocks?.map((block: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-2xl bg-card border border-border/40 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-primary uppercase">Bloque {idx + 1}</span>
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-muted/20 border-border/40 capitalize">
                              {block.type}
                            </Badge>
                          </div>
                          <h6 className="font-bold text-sm">{block.name}</h6>
                          <div className="grid grid-cols-3 gap-2 text-center bg-muted/10 p-2 rounded-xl border border-border/20 text-xs">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Series</p>
                              <p className="font-black text-sm">{block.sets || 0}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                {block.reps ? 'Reps' : (block.duration_minutes ? 'Duración' : 'Reps')}
                              </p>
                              <p className="font-black text-sm">
                                {block.reps ?? (block.duration_minutes ? `${block.duration_minutes}m` : '—')}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Descanso</p>
                              <p className="font-black text-sm">{block.rest_seconds || 0}s</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedRoutine.cooldown && (
                    <div className="space-y-1.5 p-4 rounded-2xl bg-accent/20 border border-border/40">
                      <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vuelta a la Calma</h5>
                      <p className="text-xs font-semibold leading-relaxed">{selectedRoutine.cooldown}</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="p-4 border-t bg-muted/20 shrink-0 flex-col gap-3 sm:flex-col">
                <div className="w-full flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0">Fecha</Label>
                  <Input
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    className="h-9 flex-1"
                  />
                </div>
                <div className="w-full flex gap-2">
                  <Button variant="outline" className="flex-1 font-bold" onClick={() => setSelectedRoutine(null)}>
                    Cerrar
                  </Button>
                  <Button
                    className="flex-1 font-bold gap-2 bg-primary hover:bg-primary/90"
                    onClick={handleAssign}
                    disabled={assigning}
                  >
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {childId ? 'Asignar a mi hijo' : 'Asignar a mis entrenamientos'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
