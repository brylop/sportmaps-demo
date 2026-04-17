import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ShieldCheck, Plus } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export function ClientProgressTab({ clientId, type, onUpdate }: { clientId: string, type: string, onUpdate: () => void }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [progress, setProgress] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({ skill_name: '', skill_level: 5, comments: '' });

  useEffect(() => {
    supabase.from('academic_progress')
      .select('*')
      .eq(type === 'adult' ? 'user_id' : 'child_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({data}) => setProgress(data || []));
  }, [clientId, type]);

  const handleSave = async () => {
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/progress?type=${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Habilidad evaluada' });
      setOpen(false);
      onUpdate();
      
      // refetch
      supabase.from('academic_progress')
        .select('*')
        .eq(type === 'adult' ? 'user_id' : 'child_id', clientId)
        .order('created_at', { ascending: false })
        .limit(30)
        .then(({data}) => setProgress(data || []));
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
  };

  // Group latest skills by name for Radar chart
  const radarDataMap = progress.reduce((acc, curr) => {
    if (!acc[curr.skill_name]) acc[curr.skill_name] = curr.skill_level;
    return acc;
  }, {} as Record<string, number>);

  const radarData = Object.entries(radarDataMap).map(([subject, A]) => ({ subject, A, fullMark: 10 }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Progreso Técnico</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Evaluar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Evaluar Habilidad</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm">Nombre de Habilidad</label>
                <Input placeholder="Ej: Control de balón, Flexibilidad..." value={form.skill_name} onChange={e => setForm({...form, skill_name: e.target.value})} />
              </div>
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <label className="text-sm">Nivel Evaluado</label>
                  <span className="font-bold text-primary">{form.skill_level} / 10</span>
                </div>
                <Slider defaultValue={[form.skill_level]} max={10} step={1} onValueChange={([val]) => setForm({...form, skill_level: val})} />
              </div>
              <Textarea placeholder="Comentarios del progreso..." value={form.comments} onChange={e => setForm({...form, comments: e.target.value})} />
              <Button className="w-full" onClick={handleSave} disabled={!form.skill_name}>Guardar Evaluación</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {progress.length === 0 ? (
        <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground"><ShieldCheck className="mx-auto h-8 w-8 mb-2 opacity-50" /> Sin evaluaciones técnicas registradas</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-border/50 bg-primary/5">
            <CardHeader className="pb-2"><CardTitle className="text-base text-center">Perfil de Habilidades</CardTitle></CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center p-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar name="Habilidades" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">ÚLTIMAS EVALUACIONES</h4>
            {progress.slice(0, 8).map(p => (
              <Card key={p.id} className="border-border/50">
                <CardContent className="p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm">{p.skill_name}</span>
                    <span className="font-bold text-primary text-sm">{p.skill_level} / 10</span>
                  </div>
                  {p.comments && <p className="text-xs text-muted-foreground line-clamp-2">{p.comments}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(p.created_at).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
