import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useTrainingLogs, useTrainingAggregates } from '@/hooks/useAthleteData';
import { createTrainingLog, deleteTrainingLog } from '@/lib/athlete/queries';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Calendar, Clock, Flame, Plus, Play, Trash2, Loader2 } from 'lucide-react';

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
  const { data: trainings, isLoading } = useTrainingLogs();
  const aggregates = useTrainingAggregates();

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

  const resetForm = () => {
    setForm({
      exercise_type: '',
      duration_minutes: '',
      intensity: 'medium',
      calories_burned: '',
      notes: '',
      training_date: new Date().toISOString().split('T')[0],
    });
  };

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
      toast({ title: 'Entrenamiento registrado', description: 'Tu sesión ha sido guardada correctamente.' });
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      console.error('Error creating training log:', err);
      toast({ title: 'Error', description: 'No se pudo guardar el entrenamiento.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteTrainingLog(id);
      queryClient.invalidateQueries({ queryKey: ['training-logs'] });
      toast({ title: 'Eliminado', description: 'El entrenamiento ha sido eliminado.' });
    } catch (err) {
      console.error('Error deleting training log:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando entrenamientos..." />;
  }

  const logs = trainings || [];
  const todayTraining = logs.find(
    t => t.training_date === new Date().toISOString().split('T')[0]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Entrenamientos</h1>
          <p className="text-muted-foreground mt-1 font-poppins">
            Tu plan de entrenamiento personalizado
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar Entrenamiento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Entrenamiento</DialogTitle>
              <DialogDescription>
                Ingresa los detalles de tu sesión de entrenamiento.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Tipo de ejercicio *</Label>
                <Input
                  placeholder="Ej: Fútbol, Cardio, Pesas..."
                  value={form.exercise_type}
                  onChange={e => setForm({ ...form, exercise_type: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={form.training_date}
                    onChange={e => setForm({ ...form, training_date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Duración (min) *</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="60"
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: e.target.value })}
                  />
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
                  <Input
                    type="number"
                    min="0"
                    placeholder="350"
                    value={form.calories_burned}
                    onChange={e => setForm({ ...form, calories_burned: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  placeholder="Observaciones sobre tu sesión..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving || !form.exercise_type || !form.duration_minutes}
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today's Training Card */}
      {todayTraining && (
        <Card className="border-primary border-2 bg-gradient-to-br from-primary/10 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-poppins">Entrenamiento de hoy</p>
                <h2 className="text-2xl font-bold font-poppins mt-1">{todayTraining.exercise_type}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {todayTraining.duration_minutes} min
                  </span>
                  <Badge variant="outline" className={intensityConfig[todayTraining.intensity].color}>
                    {intensityConfig[todayTraining.intensity].label}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sesiones totales</p>
                <p className="text-2xl font-bold font-poppins">{aggregates.totalSessions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(35,97%,55%)]/10">
                <Flame className="h-6 w-6 text-[hsl(35,97%,55%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calorías quemadas</p>
                <p className="text-2xl font-bold font-poppins">{aggregates.totalCalories} kcal</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tiempo total</p>
                <p className="text-2xl font-bold font-poppins">{aggregates.totalMinutes} min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Training List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <Calendar className="h-5 w-5 text-primary" />
            Historial de Entrenamientos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold font-poppins">{log.exercise_type}</h3>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>{new Date(log.training_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                    <span>•</span>
                    <span>{log.duration_minutes} min</span>
                    {log.calories_burned && (
                      <>
                        <span>•</span>
                        <span>{log.calories_burned} kcal</span>
                      </>
                    )}
                  </div>
                  {log.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{log.notes}"</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={intensityConfig[log.intensity].color}>
                  {intensityConfig[log.intensity].label}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      {deletingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar entrenamiento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará "{log.exercise_type}" del {new Date(log.training_date).toLocaleDateString('es-CO')}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(log.id)}>
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}

          {logs.length === 0 && (
            <div className="text-center py-8">
              <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-poppins">
                No hay entrenamientos registrados
              </p>
              <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Registrar mi primer entrenamiento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
