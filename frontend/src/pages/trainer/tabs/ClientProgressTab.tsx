import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ShieldCheck, Plus, TrendingUp, ChevronRight } from "lucide-react";
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RechartTooltip,
} from 'recharts';
import { BiomechResultCard, BiomechCapture } from '@/components/biomech/BiomechResultCard';

// ── Componente ────────────────────────────────────────────────────────────────

export function ClientProgressTab({
  clientId,
  type,
  onUpdate,
}: {
  clientId: string;
  type:     string;
  onUpdate: () => void;
}) {
  const { session }    = useAuth();
  const { toast }      = useToast();
  const { schoolId }   = useSchoolContext();
  const ent            = useEntitlements();
  const [progress,     setProgress]     = useState<any[]>([]);
  const [captures,     setCaptures]     = useState<BiomechCapture[]>([]);
  const [loadingCaptures, setLoadingCaptures] = useState(false);
  const [open,         setOpen]         = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';
  const [form, setForm] = useState({ skill_name: '', skill_level: 5, comments: '' });

  // ── Fetch progress ────────────────────────────────────────────────────────

  const fetchProgress = () => {
    let query = (supabase as any).from('academic_progress')
      .select('*')
      .eq(type === 'adult' ? 'user_id' : 'child_id', clientId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (schoolId) query = query.eq('school_id', schoolId);

    query.then(({ data }: any) => setProgress(data || []));
  };

  useEffect(() => {
    fetchProgress();
  }, [clientId, type, schoolId]);

  useEffect(() => {
    if (!clientId || !session?.access_token || !ent.addons?.biomech) return;
    setLoadingCaptures(true);
    fetch(`${EFF_URL}/api/v1/trainer/biomech/captures?client_id=${clientId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCaptures(data ?? []))
      .catch(() => {})
      .finally(() => setLoadingCaptures(false));
  }, [clientId, session, EFF_URL, ent.addons?.biomech]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Radar: último nivel por habilidad
  const radarData = useMemo(() => {
    const map: Record<string, number> = {};
    progress.forEach(p => {
      if (!map[p.skill_name]) map[p.skill_name] = p.skill_level;
    });
    return Object.entries(map).map(([subject, A]) => ({ subject, A, fullMark: 10 }));
  }, [progress]);

  // Evolución de la habilidad seleccionada
  const evolutionData = useMemo(() => {
    if (!selectedSkill) return [];
    return progress
      .filter(p => p.skill_name === selectedSkill)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(p => ({
        fecha: new Date(p.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        nivel: p.skill_level,
      }));
  }, [selectedSkill, progress]);

  // Habilidades únicas (última evaluación de cada una)
  const latestBySkill = useMemo(() => {
    const map = new Map<string, any>();
    progress.forEach(p => {
      if (!map.has(p.skill_name)) map.set(p.skill_name, p);
    });
    return [...map.values()].sort((a, b) => b.skill_level - a.skill_level);
  }, [progress]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      const res = await fetch(
        `${EFF_URL}/api/v1/trainer/clients/${clientId}/progress?type=${type}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) throw new Error();
      toast({ title: 'Habilidad evaluada' });
      setOpen(false);
      setForm({ skill_name: '', skill_level: 5, comments: '' });
      onUpdate();
      fetchProgress();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  // ── Level helpers ─────────────────────────────────────────────────────────

  function levelColor(level: number) {
    if (level >= 8) return 'text-green-500';
    if (level >= 5) return 'text-amber-500';
    return 'text-red-400';
  }

  function levelBg(level: number) {
    if (level >= 8) return 'bg-green-500';
    if (level >= 5) return 'bg-amber-500';
    return 'bg-red-400';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Progreso Técnico</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Evaluar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Evaluar Habilidad</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Habilidad</label>
                <Input
                  placeholder="Ej: Flexibilidad, Control de balón..."
                  value={form.skill_name}
                  onChange={e => setForm({ ...form, skill_name: e.target.value })}
                  list="skill-suggestions"
                />
                <datalist id="skill-suggestions">
                  {latestBySkill.map(s => (
                    <option key={s.skill_name} value={s.skill_name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <label className="font-medium">Nivel</label>
                  <span className={`font-black ${levelColor(form.skill_level)}`}>
                    {form.skill_level} / 10
                  </span>
                </div>
                <Slider
                  defaultValue={[form.skill_level]}
                  max={10} step={1}
                  onValueChange={([val]) => setForm({ ...form, skill_level: val })}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                  <span>Iniciando</span><span>Básico</span><span>Intermedio</span><span>Avanzado</span><span>Élite</span>
                </div>
              </div>
              <Textarea
                placeholder="Comentarios del progreso..."
                value={form.comments}
                onChange={e => setForm({ ...form, comments: e.target.value })}
              />
              <Button className="w-full" onClick={handleSave} disabled={!form.skill_name}>
                Guardar Evaluación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {progress.length === 0 ? (
        <div className="text-center p-10 border border-dashed rounded-xl text-muted-foreground">
          <ShieldCheck className="mx-auto h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm font-medium">Sin evaluaciones técnicas registradas</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Radar chart */}
          <Card className="border-border/50 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-center">Perfil de Habilidades</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] flex items-center p-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    name="Habilidades" dataKey="A"
                    stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Lista de habilidades */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
              Habilidades · toca para ver evolución
            </p>
            {latestBySkill.map(p => {
              const isSelected = selectedSkill === p.skill_name;
              const histCount  = progress.filter(r => r.skill_name === p.skill_name).length;
              return (
                <button
                  key={p.skill_name}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-primary/40 ${
                    isSelected ? 'bg-accent/50 border-primary/40' : 'bg-card border-border/40'
                  }`}
                  onClick={() => setSelectedSkill(isSelected ? null : p.skill_name)}
                >
                  {/* Nivel badge */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    p.skill_level >= 8 ? 'bg-green-500/10' : p.skill_level >= 5 ? 'bg-amber-500/10' : 'bg-red-400/10'
                  }`}>
                    <span className={`text-lg font-black leading-none ${levelColor(p.skill_level)}`}>
                      {p.skill_level}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.skill_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${levelBg(p.skill_level)}`}
                          style={{ width: `${(p.skill_level / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {histCount} eval{histCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'rotate-90 text-primary' : 'text-muted-foreground/40'}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Gráfica de evolución */}
      {selectedSkill && evolutionData.length >= 2 && (
        <Card className="border-border/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-black">Evolución — {selectedSkill}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={evolutionData} margin={{ left: -8, right: 8, top: 6, bottom: 0 }}>
                <XAxis dataKey="fecha" tick={{ fontSize: 9, opacity: 0.6 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 9, opacity: 0.6 }} tickLine={false} axisLine={false} width={20} />
                <RechartTooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                  formatter={(val: any) => [`${val}/10`, selectedSkill]}
                />
                <Line
                  type="monotone" dataKey="nivel"
                  stroke="hsl(var(--primary))" strokeWidth={2.5}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 6 }} animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {selectedSkill && evolutionData.length < 2 && (
        <p className="text-center text-xs text-muted-foreground">
          Necesitas al menos 2 evaluaciones de "{selectedSkill}" para ver la evolución.
        </p>
      )}

      {/* Biomecánica */}
      {ent.addons?.biomech && (
        <div className="space-y-4 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm">Biomecánica</h4>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                SportMaps Body
              </span>
            </div>
            {captures.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {captures.length} captura{captures.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loadingCaptures ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-primary" />
            </div>
          ) : captures.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground">
              <Activity className="mx-auto h-7 w-7 mb-2 opacity-30" />
              <p className="text-sm font-medium">Sin capturas biomecánicas</p>
              <p className="text-xs mt-1 opacity-60">
                Las capturas aparecen cuando el atleta completa un ejercicio con cámara requerida.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {captures.slice(0, 10).map(capture => (
                <BiomechResultCard
                  key={capture.id}
                  capture={capture}
                  showAnnotate
                  onAnnotate={(captureId) => console.log('Anotar captura:', captureId)}
                />
              ))}
              {captures.length > 10 && (
                <p className="text-center text-xs text-muted-foreground pt-1">
                  Mostrando las últimas 10 de {captures.length} capturas
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
