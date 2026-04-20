import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ListTodo, Plus, Target, CheckCircle2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export function ClientGoalsTab({ clientId, goals, onUpdate }: { clientId: string, goals: any[], onUpdate: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({ title: '', description: '', target_date: '', progress: 0, status: 'in_progress' });

  const handleCreate = async () => {
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Objetivo creado' });
      setOpen(false);
      onUpdate();
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const handleUpdateProgress = async (goal: any, newProgress: number) => {
    try {
      const isCompleted = newProgress === 100;
      await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...goal, progress: newProgress, status: isCompleted ? 'completed' : 'in_progress' })
      });
      onUpdate();
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  const activeGoals = goals.filter(g => g.status !== 'completed');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Objetivos Deportivos</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Nuevo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Objetivo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <Input placeholder="Título del objetivo..." value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              <Textarea placeholder="Descripción (opcional)..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <div className="space-y-2">
                <label className="text-sm">Fecha Límite</label>
                <Input type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!form.title || !form.target_date}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">EN PROGRESO ({activeGoals.length})</h4>
        {activeGoals.length === 0 && <p className="text-sm text-muted-foreground border-dashed border p-4 rounded-xl text-center">No hay objetivos activos.</p>}
        {activeGoals.map(goal => (
          <Card key={goal.id} className="border-primary/20">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h5 className="font-bold text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> {goal.title}
                  </h5>
                  {goal.description && <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>}
                </div>
                <Badge variant="outline" className="bg-primary/5">Hasta {new Date(goal.target_date).toLocaleDateString()}</Badge>
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground">Progreso actual:</span>
                  <span className="font-bold">{goal.progress}%</span>
                </div>
                <Slider 
                  defaultValue={[goal.progress]} max={100} step={5}
                  onValueCommit={([val]) => handleUpdateProgress(goal, val)} 
                />
                {goal.progress === 100 && <p className="text-xs text-green-500 mt-1">¡Alcanzado! Se moverá a completados al soltar.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {completedGoals.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-medium text-muted-foreground">COMPLETADOS ({completedGoals.length})</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {completedGoals.map(goal => (
              <div key={goal.id} className="p-3 border rounded-lg bg-green-500/5 flex gap-3 opacity-80">
                <CheckCircle2 className="text-green-500 w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm line-through decoration-green-500/30">{goal.title}</div>
                  <div className="text-xs text-muted-foreground">Alcanzado el {new Date(goal.achieved_date || goal.updated_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
