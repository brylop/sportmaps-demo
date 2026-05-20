import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  useAthleteTrainingToday, 
  useAthleteUnifiedStats,
  useAthleteTrainingHistory 
} from '@/hooks/useAthleteData';
import { createTrainingLog, deleteTrainingLog } from '@/lib/athlete/queries';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SessionExecution } from '@/components/athlete/SessionExecution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dumbbell, Calendar, Clock, Flame, Plus, Play, Trash2,
  Loader2, User, ChevronRight, Timer, CheckCircle2,
} from 'lucide-react';

const intensityConfig = {
  low:    { label: 'Baja',   color: 'border-green-500 text-green-500' },
  medium: { label: 'Media',  color: 'border-yellow-500 text-yellow-600' },
  high:   { label: 'Alta',   color: 'border-orange-500 text-orange-500' },
  max:    { label: 'Máxima', color: 'border-red-500 text-red-500' },
};

export default function TrainingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data ────────────────────────────────────────────────────
  const { data: today, isLoading: loadingToday } = useAthleteTrainingToday();
  const { data: stats, isLoading: statsLoading } = useAthleteUnifiedStats('all');
  const { data: history, isLoading: historyLoading } = useAthleteTrainingHistory(20);

  // ── Session execution modal ──────────────────────────────────
  const [executingSession, setExecutingSession] = useState<any | null>(null);
  const [viewingSession, setViewingSession] = useState<any | null>(null);

  // ── Free activity form ───────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    exercise_type: '',
    duration_minutes: '',
    intensity: 'medium' as 'low' | 'medium' | 'high' | 'max',
    calories_burned: '',
    notes: '',
    training_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()),
  });

  const todayCO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  const resetForm = () => setForm({
    exercise_type: '', duration_minutes: '', intensity: 'medium',
    calories_burned: '', notes: '', training_date: todayCO(),
  });

  const handleCreate = async () => {
    if (!user || !form.exercise_type || !form.duration_minutes) return;
    try {
      setSaving(true);
      await createTrainingLog({
        athlete_id: user.id,
        training_date: form.training_date,
        exercise_type: form.exercise_type,
        duration_minutes: parseInt(form.duration_minutes, 10),
        intensity: form.intensity,
        calories_burned: form.calories_burned ? parseInt(form.calories_burned, 10) : null,
        notes: form.notes || null,
      });
      queryClient.invalidateQueries({ queryKey: ['athlete-training-history'] });
      queryClient.invalidateQueries({ queryKey: ['athlete-training-today'] });
      toast({ title: 'Actividad registrada', description: 'Tu sesión ha sido guardada.' });
      resetForm();
      setDialogOpen(false);
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteTrainingLog(id);
      queryClient.invalidateQueries({ queryKey: ['athlete-training-history'] });
      toast({ title: 'Eliminado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (loadingToday && historyLoading) {
    return <LoadingSpinner fullScreen text="Cargando entrenamientos..." />;
  }

  const ptSessions = today?.pt_sessions ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entrenamientos</h1>
          <p className="text-muted-foreground mt-1">Tu plan de entrenamiento personalizado</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Actividad libre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Registrar actividad libre</DialogTitle>
                  <DialogDescription>Ejercicio fuera de tu plan asignado.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Tipo de ejercicio *</Label>
                <Input
                  placeholder="Ej: Correr, Natación, Pesas..."
                  value={form.exercise_type}
                  onChange={e => setForm({ ...form, exercise_type: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={form.training_date}
                    onChange={e => setForm({ ...form, training_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Duración (min) *</Label>
                  <Input type="number" min="1" placeholder="60" value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Intensidad</Label>
                  <Select value={form.intensity} onValueChange={v => setForm({ ...form, intensity: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Baja</SelectItem>
                      <SelectItem value="medium">🟡 Media</SelectItem>
                      <SelectItem value="high">🟠 Alta</SelectItem>
                      <SelectItem value="max">🔴 Máxima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Calorías (opcional)</Label>
                  <Input type="number" min="0" placeholder="350" value={form.calories_burned}
                    onChange={e => setForm({ ...form, calories_burned: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notas (opcional)</Label>
                <Textarea placeholder="Observaciones..." value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={saving || !form.exercise_type || !form.duration_minutes}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>


      {/* ── Stats unificadas ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sesiones</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '—' : (stats?.sessions_total ?? 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Calorías</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '—' : `${stats?.total_calories ?? 0} kcal`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tiempo total</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? '—' : `${stats?.total_minutes ?? 0} min`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sesiones asignadas hoy por el entrenador ── */}
      {ptSessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Sesiones de hoy
          </h2>
          {ptSessions.map(session => (
            <Card
              key={session.id}
              className={`border-2 transition-colors ${
                session.status === 'completed'
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-primary/40 bg-primary/5'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{session.name}</p>
                      {session.trainer_profiles && (
                        <p className="text-xs text-muted-foreground">
                          💪 {session.trainer_profiles.display_name}
                        </p>
                      )}
                      {session.custom_notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          "{session.custom_notes}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {session.status === 'completed' ? (
                      <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                        ✅ Completada
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setExecutingSession(session)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Iniciar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Historial PT + Actividad libre ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Historial de entrenamientos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (history ?? []).length === 0 ? (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay entrenamientos registrados</p>
              <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Registrar actividad
              </Button>
            </div>
          ) : (
            (history ?? []).map((item: any) => {
              const isPT = item._type === 'pt_session';
              const isClickable = isPT && item.status === 'completed';
              const Wrapper = isClickable ? 'button' : ('div' as any);

              return (
                <Wrapper
                  key={item.id}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border bg-card transition-colors text-left
                    ${isClickable ? 'hover:bg-accent/50 cursor-pointer group' : 'hover:bg-accent/50'}`}
                  {...(isClickable ? { onClick: () => setViewingSession(item) } : {})}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isPT ? 'bg-indigo-500/10' : 'bg-primary/10'}`}>
                      {isPT
                        ? <User className="h-5 w-5 text-indigo-500" />
                        : <Dumbbell className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {isPT ? item.name : item.exercise_type}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${isPT 
                            ? 'border-indigo-500/40 text-indigo-500' 
                            : 'border-primary/40 text-primary'}`}
                        >
                          {isPT ? '💪 Sesión PT' : '🏃 Libre'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {new Date(item._date + 'T12:00:00').toLocaleDateString('es-CO', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                        {isPT && item.status === 'completed' && (
                          <span className="ml-2 text-green-600 font-medium">✅ Completada</span>
                        )}
                        {!isPT && item.duration_minutes && (
                          <span className="ml-2">· {item.duration_minutes} min</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Lado derecho */}
                  <div className="flex items-center gap-3 shrink-0">
                    {!isPT && item.intensity && (
                      <Badge variant="outline" className={intensityConfig[item.intensity as keyof typeof intensityConfig]?.color}>
                        {intensityConfig[item.intensity as keyof typeof intensityConfig]?.label}
                      </Badge>
                    )}
                    {/* Botón eliminar solo para actividad libre */}
                    {!isPT && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará "{item.exercise_type}" del {new Date(item._date).toLocaleDateString('es-CO')}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {isPT && item.status === 'completed' && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                </Wrapper>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* ── Modal detalle de sesión completada ── */}
      {viewingSession && (
        <Dialog open={!!viewingSession} onOpenChange={() => setViewingSession(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">{viewingSession.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap gap-3 mt-1">
                <span className="flex items-center gap-1 text-xs">
                  <Calendar className="h-3 w-3" />
                  {new Date(viewingSession._date + 'T12:00:00').toLocaleDateString('es-CO', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </span>
                {viewingSession.trainer_name && (
                  <span className="text-xs">💪 {viewingSession.trainer_name}</span>
                )}
                {viewingSession.results?.actual_duration_minutes && (
                  <span className="flex items-center gap-1 text-xs">
                    <Timer className="h-3 w-3" />
                    {viewingSession.results.actual_duration_minutes} min
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">

              {/* Nota del entrenador */}
              {viewingSession.results?.performance_note && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                    📝 Feedback del entrenador
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "{viewingSession.results.performance_note}"
                  </p>
                </div>
              )}

              {/* Bloques con resultados */}
              {(viewingSession.blocks ?? []).length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Ejercicios realizados
                  </p>
                  {(viewingSession.blocks ?? []).map((block: any, idx: number) => {
                    const result = (viewingSession.results?.blocks_results ?? [])
                      .find((r: any) => r.block_index === idx);
                    const completed = result?.completed ?? false;

                    const typeLabel: Record<string, string> = {
                      strength: '💪 Fuerza', cardio: '❤️ Cardio',
                      hiit: '⚡ HIIT', flexibility: '🧘 Flexibilidad',
                      warmup: '🌡️ Calentamiento', cooldown: '☕ Vuelta calma',
                    };

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border ${
                          completed
                            ? 'bg-green-500/5 border-green-500/20'
                            : 'bg-muted/20 border-border/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="font-bold text-sm">{block.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">
                              {typeLabel[block.type] ?? block.type}
                              {block.sets && ` · ${block.sets} sets`}
                              {block.reps && ` × ${block.reps} reps`}
                              {block.duration_minutes && ` · ${block.duration_minutes} min`}
                            </p>
                          </div>
                          {completed
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            : <Clock       className="h-5 w-5 text-muted-foreground shrink-0" />}
                        </div>

                        {/* Resultado real */}
                        {result && block.type === 'strength' && (
                          <div className="flex gap-4 mt-2 pt-2 border-t border-border/20">
                            {result.actual_weight && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Peso</p>
                                <p className="text-base font-black text-primary">{result.actual_weight}</p>
                              </div>
                            )}
                            {result.actual_reps && (
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Reps</p>
                                <p className="text-base font-black">{result.actual_reps}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {result?.actual_rpe && block.type === 'hiit' && (
                          <div className="mt-2 pt-2 border-t border-border/20">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">RPE</p>
                            <p className="text-base font-black text-purple-500">
                              {result.actual_rpe}<span className="text-xs font-normal">/10</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Sesión sin bloques definidos</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Session execution modal ── */}
      {executingSession && (
        <SessionExecution
          session={executingSession}
          onClose={() => setExecutingSession(null)}
          onCompleted={() => {
            setExecutingSession(null);
            queryClient.invalidateQueries({ queryKey: ['athlete-training-today'] });
            queryClient.invalidateQueries({ queryKey: ['athlete-training-history'] });
          }}
        />
      )}
    </div>
  );
}
