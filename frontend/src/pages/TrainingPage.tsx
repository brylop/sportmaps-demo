import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useAthleteTrainingToday,
  useTrainingLogs,
  useTrainingAggregates,
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
  Loader2, User, ChevronRight,
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
  const aggregates = useTrainingAggregates();
  const { data: trainings, isLoading: loadingLogs } = useTrainingLogs();

  // ── Session execution modal ──────────────────────────────────
  const [executingSession, setExecutingSession] = useState<any | null>(null);

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
    training_date: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => setForm({
    exercise_type: '', duration_minutes: '', intensity: 'medium',
    calories_burned: '', notes: '', training_date: new Date().toISOString().split('T')[0],
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
      queryClient.invalidateQueries({ queryKey: ['training-logs'] });
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
      queryClient.invalidateQueries({ queryKey: ['training-logs'] });
      toast({ title: 'Eliminado' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (loadingToday && loadingLogs) {
    return <LoadingSpinner fullScreen text="Cargando entrenamientos..." />;
  }

  const logs = trainings ?? [];
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
                  {aggregates.isLoading ? '—' : aggregates.totalSessions}
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
                  {aggregates.isLoading ? '—' : `${aggregates.totalCalories} kcal`}
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
                  {aggregates.isLoading ? '—' : `${aggregates.totalMinutes} min`}
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

      {/* ── Historial libre ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Actividad libre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logs.map(log => (
            <div
              key={log.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{log.exercise_type}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                    <span>{new Date(log.training_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                    <span>•</span>
                    <span>{log.duration_minutes} min</span>
                    {log.calories_burned && (
                      <><span>•</span><span>{log.calories_burned} kcal</span></>
                    )}
                  </div>
                  {log.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{log.notes}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="outline" className={intensityConfig[log.intensity].color}>
                  {intensityConfig[log.intensity].label}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      {deletingId === log.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar actividad?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará "{log.exercise_type}" del {new Date(log.training_date).toLocaleDateString('es-CO')}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(log.id)}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay actividad libre registrada</p>
              <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Registrar actividad
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Session execution modal ── */}
      {executingSession && (
        <SessionExecution
          session={executingSession}
          onClose={() => setExecutingSession(null)}
          onCompleted={() => {
            setExecutingSession(null);
            queryClient.invalidateQueries({ queryKey: ['athlete-training-today'] });
          }}
        />
      )}
    </div>
  );
}
