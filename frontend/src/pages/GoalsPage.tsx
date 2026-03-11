import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
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
import { useAthleteGoals, AthleteGoal } from '@/hooks/useAthleteData';
import { createGoal, updateGoal, deleteGoal } from '@/lib/athlete/queries';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Target, Plus, CheckCircle2, Clock, TrendingUp, Trash2, Loader2 } from 'lucide-react';

export default function GoalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: goals, isLoading } = useAthleteGoals();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    target_date: '',
  });

  const resetForm = () => setForm({ title: '', description: '', target_date: '' });

  const handleCreate = async () => {
    if (!user || !form.title) return;
    try {
      setSaving(true);
      await createGoal({
        athlete_id: user.id,
        title: form.title,
        description: form.description || null,
        target_date: form.target_date || null,
      });
      queryClient.invalidateQueries({ queryKey: ['athlete-goals'] });
      toast({ title: 'Objetivo creado', description: 'Tu nueva meta ha sido registrada.' });
      resetForm();
      setDialogOpen(false);
    } catch (err) {
      console.error('Error creating goal:', err);
      toast({ title: 'Error', description: 'No se pudo crear el objetivo.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleProgressUpdate = async (id: string, progress: number) => {
    try {
      setUpdatingId(id);
      const status = progress >= 100 ? 'completed' : 'active';
      await updateGoal(id, { progress, status });
      queryClient.invalidateQueries({ queryKey: ['athlete-goals'] });
      if (progress >= 100) {
        toast({ title: '🎉 ¡Objetivo completado!', description: 'Felicidades por alcanzar tu meta.' });
      }
    } catch (err) {
      console.error('Error updating goal:', err);
      toast({ title: 'Error', description: 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await deleteGoal(id);
      queryClient.invalidateQueries({ queryKey: ['athlete-goals'] });
      toast({ title: 'Eliminado', description: 'El objetivo ha sido eliminado.' });
    } catch (err) {
      console.error('Error deleting goal:', err);
      toast({ title: 'Error', description: 'No se pudo eliminar.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="Cargando objetivos..." />;
  }

  const list = goals || [];
  const activeGoals = list.filter(g => g.status === 'active' || g.status === 'pending');
  const completedGoals = list.filter(g => g.status === 'completed');

  const getStatusBadge = (status: AthleteGoal['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-[hsl(119,60%,32%)] text-white">Completado</Badge>;
      case 'active':
        return <Badge className="bg-[hsl(35,97%,55%)] text-white">En progreso</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Mis Objetivos</h1>
          <p className="text-muted-foreground mt-1 font-poppins">
            Establece y rastrea tus metas deportivas
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Objetivo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Objetivo</DialogTitle>
              <DialogDescription>
                Define una meta deportiva para mantener tu motivación.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Título del objetivo *</Label>
                <Input
                  placeholder="Ej: Correr 5K en menos de 25 min"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  placeholder="Detalla tu meta y cómo planeas alcanzarla..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha meta (opcional)</Label>
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm({ ...form, target_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving || !form.title}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Crear objetivo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Objetivos</p>
                <p className="text-2xl font-bold font-poppins">{list.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(119,60%,32%)]/10">
                <CheckCircle2 className="h-6 w-6 text-[hsl(119,60%,32%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold font-poppins">{completedGoals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-[hsl(35,97%,55%)]/10">
                <Clock className="h-6 w-6 text-[hsl(35,97%,55%)]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En Progreso</p>
                <p className="text-2xl font-bold font-poppins">{activeGoals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-poppins">
            <TrendingUp className="h-5 w-5 text-primary" />
            Mis Metas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {list.map((goal) => (
            <div
              key={goal.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold font-poppins">{goal.title}</h3>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(goal.status)}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        {deletingId === goal.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar objetivo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará "{goal.title}" de forma permanente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(goal.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Progress slider */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">
                    {updatingId === goal.id ? <Loader2 className="h-3 w-3 animate-spin inline" /> : `${goal.progress}%`}
                  </span>
                </div>
                <Slider
                  value={[goal.progress]}
                  max={100}
                  step={5}
                  className="w-full"
                  onValueCommit={(value) => handleProgressUpdate(goal.id, value[0])}
                  disabled={goal.status === 'completed'}
                />
                <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${goal.progress}%`,
                      backgroundColor: goal.status === 'completed'
                        ? 'hsl(119, 60%, 32%)'
                        : 'hsl(35, 97%, 55%)',
                    }}
                  />
                </div>
              </div>

              {goal.target_date && (
                <p className="text-xs text-muted-foreground mt-2">
                  Meta: {new Date(goal.target_date).toLocaleDateString('es-CO', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              )}
            </div>
          ))}

          {list.length === 0 && (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-poppins">
                Aún no has establecido objetivos
              </p>
              <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Crear mi primer objetivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
