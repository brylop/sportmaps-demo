import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Plus, Trash2, Edit } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const STATS_PRESETS = [
  { id: 'peso', label: 'Peso Corporal', defaultUnit: 'kg' },
  { id: 'altura', label: 'Altura', defaultUnit: 'cm' },
  { id: 'grasa', label: 'Grasa Corporal', defaultUnit: '%' },
  { id: 'fcr', label: 'Frec. Cardíaca (Reposo)', defaultUnit: 'bpm' },
  { id: 'vo2max', label: 'VO2 Max', defaultUnit: 'ml/kg/min' },
  { id: 'bench1rm', label: 'Fuerza: Bench Press (1RM)', defaultUnit: 'kg' },
  { id: 'squat1rm', label: 'Fuerza: Sentadilla (1RM)', defaultUnit: 'kg' },
];

export function ClientStatsTab({ clientId, onUpdate, stats }: { clientId: string, onUpdate: () => void, stats: any[] }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({ stat_type: 'peso', value: '', unit: 'kg', stat_date: new Date().toISOString().split('T')[0], notes: '' });

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

  // Agrupar stats por tipo
  const grouped = stats.reduce((acc, stat) => {
    if (!acc[stat.stat_type]) acc[stat.stat_type] = [];
    acc[stat.stat_type].push(stat);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Trazabilidad Biométrica</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Registrar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Métrica</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select value={form.stat_type} onValueChange={v => {
                  setForm({...form, stat_type: v, unit: STATS_PRESETS.find(s => s.id === v)?.defaultUnit || ''});
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATS_PRESETS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    <SelectItem value="custom">Otro (Personalizado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor</label>
                  <Input type="number" step="0.1" value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unidad</label>
                  <Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha</label>
                <Input type="date" value={form.stat_date} onChange={e => setForm({...form, stat_date: e.target.value})} />
              </div>
              <Button className="w-full" onClick={handleSave}>Guardar Métrica</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-lg">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Aún no has registrado métricas para este cliente.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(grouped).map(([type, items]) => {
            const sorted = items.sort((a, b) => new Date(a.stat_date).getTime() - new Date(b.stat_date).getTime());
            const latest = sorted[sorted.length - 1];
            const presetLabel = STATS_PRESETS.find(p => p.id === type)?.label || type;

            return (
              <Card key={type} className="border-border/50">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-muted/20 border-b">
                  <div className="font-semibold text-sm capitalize">{presetLabel}</div>
                  <Badge variant="secondary">{latest.value} {latest.unit}</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Mini Chart */}
                  {sorted.length > 1 && (
                    <div className="h-16 w-full px-2 mt-2 opacity-60">
                      <ResponsiveContainer>
                        <LineChart data={sorted}>
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* History List */}
                  <div className="divide-y text-sm mt-2">
                    {sorted.slice().reverse().map(stat => (
                      <div key={stat.id} className="flex justify-between items-center py-2 px-4 hover:bg-muted/30">
                        <div>
                          <span className="font-medium">{stat.value} {stat.unit}</span>
                          <span className="text-xs text-muted-foreground ml-2">{new Date(stat.stat_date).toLocaleDateString('es', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(stat.id)}>
                          <Trash2 className="h-3 w-3" />
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
  );
}
