import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, Plus, Target, CheckCircle2, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

// ── Constantes ────────────────────────────────────────────────────────────────

const GOAL_CATEGORIES = [
  { value: 'fuerza',       label: '💪 Fuerza'              },
  { value: 'resistencia',  label: '🏃 Resistencia'          },
  { value: 'composicion',  label: '⚖️ Composición corporal' },
  { value: 'tecnica',      label: '🎯 Técnica'              },
  { value: 'habito',       label: '🧠 Hábito'               },
  { value: 'otro',         label: '📊 Otro'                 },
];

const categoryConfig: Record<string, { emoji: string; color: string; bg: string }> = {
  fuerza:      { emoji: '💪', color: 'text-red-500',    bg: 'bg-red-500/10'    },
  resistencia: { emoji: '🏃', color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  composicion: { emoji: '⚖️', color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
  tecnica:     { emoji: '🎯', color: 'text-violet-500', bg: 'bg-violet-500/10' },
  habito:      { emoji: '🧠', color: 'text-teal-500',   bg: 'bg-teal-500/10'   },
  otro:        { emoji: '📊', color: 'text-slate-500',  bg: 'bg-slate-500/10'  },
};

// ── Componente ────────────────────────────────────────────────────────────────

export function ClientGoalsTab({
  clientId,
  goals,
  onUpdate,
}: {
  clientId: string;
  goals: any[];
  onUpdate: () => void;
}) {
  const { session } = useAuth();
  const { toast }   = useToast();
  const [open, setOpen]           = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({
    title:       '',
    description: '',
    target_date: '',
    progress:    0,
    status:      'in_progress',
    category:    'fuerza',
  });

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };

  const handleCreate = async () => {
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/goals`, {
        method: 'POST', headers,
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Objetivo creado' });
      setOpen(false);
      setForm({ title: '', description: '', target_date: '', progress: 0, status: 'in_progress', category: 'fuerza' });
      onUpdate();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleUpdateProgress = async (goal: any, newProgress: number) => {
    try {
      const isCompleted = newProgress === 100;
      await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/goals/${goal.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          ...goal,
          progress: newProgress,
          status: isCompleted ? 'completed' : 'in_progress',
        }),
      });
      onUpdate();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async (goalId: string) => {
    setDeletingId(goalId);
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/goals/${goalId}`, {
        method: 'DELETE', headers,
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Objetivo eliminado' });
      onUpdate();
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const activeGoals    = goals.filter(g => g.status !== 'completed');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Objetivos Deportivos</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Objetivo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Título del objetivo..."
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <Textarea
                placeholder="Descripción (opcional)..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha Límite</label>
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={e => setForm({ ...form, target_date: e.target.value })}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!form.title || !form.target_date}
              >
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* En progreso */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          En Progreso ({activeGoals.length})
        </h4>

        {activeGoals.length === 0 ? (
          <div className="text-sm text-muted-foreground border-dashed border p-6 rounded-xl text-center">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-20" />
            No hay objetivos activos.
          </div>
        ) : activeGoals.map(goal => {
          const cat = categoryConfig[goal.category] ?? categoryConfig.otro;
          const daysLeft = goal.target_date
            ? Math.ceil((new Date(goal.target_date + 'T12:00:00-05:00').getTime() - Date.now()) / 86400000)
            : null;

          return (
            <Card key={goal.id} className="border-primary/20 group">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-base flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        {goal.title}
                      </h5>
                      {goal.category && (
                        <Badge className={`text-[10px] font-bold ${cat.bg} ${cat.color} border-0`}>
                          {cat.emoji} {GOAL_CATEGORIES.find(c => c.value === goal.category)?.label.split(' ').slice(1).join(' ') ?? goal.category}
                        </Badge>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {daysLeft !== null && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        daysLeft <= 7 ? 'bg-red-500/10 text-red-500'
                        : daysLeft <= 15 ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {daysLeft > 0 ? `${daysLeft}d` : 'Vencido'}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                      disabled={deletingId === goal.id}
                      onClick={() => handleDelete(goal.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-muted-foreground">Progreso:</span>
                    <span className="font-bold">{goal.progress}%</span>
                  </div>
                  <Slider
                    defaultValue={[goal.progress]}
                    max={100}
                    step={5}
                    onValueCommit={([val]) => handleUpdateProgress(goal, val)}
                  />
                  {goal.progress === 100 && (
                    <p className="text-xs text-green-500">¡Alcanzado! Se moverá a completados al soltar.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completados */}
      {completedGoals.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Completados ({completedGoals.length})
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedGoals.map(goal => {
              const cat = categoryConfig[goal.category] ?? categoryConfig.otro;
              return (
                <div key={goal.id} className="p-3 border rounded-xl bg-green-500/5 flex gap-3 group">
                  <CheckCircle2 className="text-green-500 w-5 h-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm line-through decoration-green-500/30 truncate">
                        {goal.title}
                      </span>
                      {goal.category && (
                        <span className="text-[10px]">{cat.emoji}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(goal.updated_at).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    disabled={deletingId === goal.id}
                    onClick={() => handleDelete(goal.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="text-center p-10 border-2 border-dashed rounded-xl text-muted-foreground">
          <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Sin objetivos registrados</p>
          <p className="text-xs mt-1 opacity-60">Crea el primer objetivo para este cliente</p>
        </div>
      )}
    </div>
  );
}
