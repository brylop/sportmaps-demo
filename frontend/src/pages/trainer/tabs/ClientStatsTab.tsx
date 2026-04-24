import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus, Trash2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WellnessModule } from '@/components/wellness/WellnessModule';

const STATS_PRESETS = [
  { id: 'fcr', label: 'Frec. Cardíaca (Reposo)', defaultUnit: 'bpm' },
  { id: 'vo2max', label: 'VO2 Max', defaultUnit: 'ml/kg/min' },
  { id: 'bench1rm', label: 'Fuerza: Bench Press (1RM)', defaultUnit: 'kg' },
  { id: 'squat1rm', label: 'Fuerza: Sentadilla (1RM)', defaultUnit: 'kg' },
  { id: 'deadlift1rm', label: 'Fuerza: Peso Muerto (1RM)', defaultUnit: 'kg' },
];

export function ClientStatsTab({ clientId, clientName, onUpdate, stats }: { clientId: string, clientName: string, onUpdate: () => void, stats: any[] }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({ stat_type: 'fcr', value: '', unit: 'bpm', stat_date: new Date().toISOString().split('T')[0], notes: '' });

  const handleSave = async () => {
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, value: parseFloat(form.value) })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Guardado', description: 'Métrica añadida correctamente.' });
      setOpen(false);
      onUpdate();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (statId: string) => {
    if (!confirm('¿Eliminar esta métrica?')) return;
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/stats/${statId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!res.ok) throw new Error();
      onUpdate();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // Agrupar stats por tipo (excluyendo lo que ya va en WellnessModule si estuviera duplicado)
  const grouped = stats.reduce((acc, stat) => {
    if (!acc[stat.stat_type]) acc[stat.stat_type] = [];
    acc[stat.stat_type].push(stat);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-10">
      {/* 1. Módulo de Bienestar (Top) */}
      <section className="bg-muted/10 p-6 rounded-2xl border border-border/50">
        <WellnessModule clientId={clientId} clientName={clientName} isTrainer={true} />
      </section>

      <hr className="border-border/60" />

      {/* 2. Trazabilidad Biométrica / Marcas Deportivas (Bottom) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Marcas Deportivas y Pruebas
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Seguimiento de rendimiento físico específico</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 font-bold"><Plus className="w-4 h-4" /> Registrar Marca</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar Marca Deportiva</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de Prueba</label>
                  <Select value={form.stat_type} onValueChange={v => {
                    setForm({...form, stat_type: v, unit: STATS_PRESETS.find(s => s.id === v)?.defaultUnit || ''});
                  }}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATS_PRESETS.map(p => <SelectItem key={p.id} value={p.id} className="font-medium">{p.label}</SelectItem>)}
                      <SelectItem value="custom">Otro (Personalizado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor</label>
                    <Input type="number" step="0.1" value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unidad</label>
                    <Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha</label>
                  <Input type="date" value={form.stat_date} onChange={e => setForm({...form, stat_date: e.target.value})} className="font-bold" />
                </div>
                <Button className="w-full font-bold h-11" onClick={handleSave}>Guardar Marca</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl bg-muted/5">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm font-medium">Aún no has registrado marcas deportivas para este cliente.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(grouped).map(([type, items]: [string, any[]]) => {
              const sorted = [...items].sort((a, b) => new Date(a.stat_date).getTime() - new Date(b.stat_date).getTime());
              const latest = sorted[sorted.length - 1];
              const presetLabel = STATS_PRESETS.find(p => p.id === type)?.label || type;

              return (
                <Card key={type} className="border-border/60 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-muted/30 border-b">
                    <div className="font-bold text-sm capitalize flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      {presetLabel}
                    </div>
                    <Badge variant="secondary" className="font-black text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                      {latest.value} {latest.unit}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Mini Chart */}
                    {sorted.length > 1 && (
                      <div className="h-16 w-full px-2 mt-4 opacity-70">
                        <ResponsiveContainer>
                          <LineChart data={sorted}>
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 2, strokeWidth: 2, fill: 'white' }} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {/* History List */}
                    <div className="divide-y divide-border/40 text-sm mt-2">
                      {sorted.slice().reverse().map(stat => (
                        <div key={stat.id} className="flex justify-between items-center py-2.5 px-4 hover:bg-accent/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{stat.value} {stat.unit}</span>
                            <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted p-0.5 px-1 rounded">
                              {format(new Date(stat.stat_date + 'T12:00:00'), 'd MMM', { locale: es })}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => handleDelete(stat.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
