import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBodyMetrics } from '@/hooks/useAthleteData';
import { postBodyMetrics } from '@/lib/athlete/queries';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  HeartPulse, Activity, Scale, Ruler, Plus, Calendar,
  Loader2, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

// ── Tipos ────────────────────────────────────────────────────
interface BodyMetric {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  source: 'trainer' | 'self';
  notes: string | null;
}

// ── Helpers ──────────────────────────────────────────────────
function trend(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return { icon: Minus, label: 'Sin cambio', color: 'text-muted-foreground', diff: 0 };
  if (diff > 0) return { icon: TrendingUp, label: `+${diff.toFixed(1)}`, color: 'text-red-500', diff };
  return { icon: TrendingDown, label: diff.toFixed(1), color: 'text-green-500', diff };
}

function latest(metrics: BodyMetric[], field: keyof BodyMetric) {
  return metrics.find(m => m[field] !== null)?.[field] ?? null;
}

// ── Formulario vacío ─────────────────────────────────────────
const emptyForm = {
  measured_at: new Date().toISOString().split('T')[0],
  weight_kg: '', height_cm: '', body_fat_pct: '',
  muscle_mass_kg: '', waist_cm: '', hip_cm: '',
  chest_cm: '', arm_cm: '', thigh_cm: '', notes: '',
};

// ── Components ───────────────────────────────────────────────
function StepperInput({
  label, value, onChange, step = 1, min = 0, unit = '',
  icon: Icon, placeholder = '—'
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  step?: number;
  min?: number;
  unit?: string;
  icon?: any;
  placeholder?: string;
}) {
  const adjust = (delta: number) => {
    const current = value === '' ? 0 : parseFloat(value);
    const next = Math.max(min, current + delta);
    onChange(next.toFixed(1).replace(/\.0$/, ''));
  };

  return (
    <div className="grid gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
          {Icon && <Icon className="h-3 w-3 text-primary/70" />}
          {label}
        </Label>
        {unit && <span className="text-[10px] text-primary/60 font-mono bg-primary/5 px-1.5 py-0.5 rounded uppercase font-bold">{unit}</span>}
      </div>
      <div className="flex items-center gap-1 group">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl border-border/60 dark:border-border/30 hover:bg-primary/10 hover:text-primary transition-all active:scale-90 focus:ring-0 bg-background dark:bg-muted/10 font-bold"
          onClick={() => adjust(-step)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Input
          type="number"
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-9 text-center font-bold border-border/60 dark:border-border/30 focus-visible:ring-primary/20 bg-muted/20 dark:bg-muted/5 group-hover:bg-background transition-all rounded-xl shadow-inner-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-1 text-foreground"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-xl border-border/60 dark:border-border/30 hover:bg-primary/10 hover:text-primary transition-all active:scale-90 focus:ring-0 bg-background dark:bg-muted/10 font-bold"
          onClick={() => adjust(step)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
export default function AthleteWellnessPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useBodyMetrics(30);
  const metrics: BodyMetric[] = (data ?? []) as BodyMetric[];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const f = (val: string) => val === '' ? null : parseFloat(val);

  const handleSave = async () => {
    if (!form.measured_at) return;
    try {
      setSaving(true);
      await postBodyMetrics({
        measured_at:    form.measured_at,
        weight_kg:      f(form.weight_kg),
        height_cm:      f(form.height_cm),
        body_fat_pct:   f(form.body_fat_pct),
        muscle_mass_kg: f(form.muscle_mass_kg),
        waist_cm:       f(form.waist_cm),
        hip_cm:         f(form.hip_cm),
        chest_cm:       f(form.chest_cm),
        arm_cm:         f(form.arm_cm),
        thigh_cm:       f(form.thigh_cm),
        notes:          form.notes || null,
      });
      queryClient.invalidateQueries({ queryKey: ['athlete-body-metrics'] });
      toast({ title: 'Medición guardada ✅' });
      setForm(emptyForm);
      setDialogOpen(false);
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen text="Cargando bienestar..." />;

  // Últimas dos mediciones para calcular tendencias
  const last  = metrics[0] ?? null;
  const prev  = metrics[1] ?? null;

  const weightTrend  = trend(last?.weight_kg ?? null,  prev?.weight_kg ?? null);
  const fatTrend     = trend(last?.body_fat_pct ?? null, prev?.body_fat_pct ?? null);
  const muscleTrend  = trend(last?.muscle_mass_kg ?? null, prev?.muscle_mass_kg ?? null);

  // IMC
  const imc = (() => {
    const w = last?.weight_kg;
    const h = last?.height_cm;
    if (!w || !h) return null;
    const heightM = h > 3 ? h / 100 : h;
    return (w / Math.pow(heightM, 2)).toFixed(1);
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mi Bienestar</h1>
          <p className="text-muted-foreground mt-1">Tu salud y composición corporal</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Registrar medición
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle>Nueva medición</DialogTitle>
                  <DialogDescription>Registra tu composición corporal actual.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1.5 ml-1">
                    <Calendar className="h-3 w-3 text-primary/70" />
                    Fecha de medición
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-bold rounded-xl border-border/60 dark:border-border/30 bg-muted/20 dark:bg-muted/10 hover:bg-background transition-all h-10",
                          !form.measured_at && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4 text-primary/70" />
                        {form.measured_at ? (
                          format(new Date(form.measured_at + 'T12:00:00'), "PPP", { locale: es })
                        ) : (
                          <span>Seleccionar fecha</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={form.measured_at ? new Date(form.measured_at + 'T12:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            setForm({ ...form, measured_at: date.toISOString().split('T')[0] });
                          }
                        }}
                        initialFocus
                        className="rounded-xl"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <StepperInput
                    label="Peso" unit="kg" icon={Scale} step={0.1}
                    value={form.weight_kg} onChange={v => setForm({ ...form, weight_kg: v })}
                  />
                  <StepperInput
                    label="Talla" unit="cm" icon={Ruler} step={0.5}
                    value={form.height_cm} onChange={v => setForm({ ...form, height_cm: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <StepperInput
                    label="Grasa" unit="%" icon={HeartPulse} step={0.1}
                    value={form.body_fat_pct} onChange={v => setForm({ ...form, body_fat_pct: v })}
                  />
                  <StepperInput
                    label="Músculo" unit="kg" icon={Activity} step={0.1}
                    value={form.muscle_mass_kg} onChange={v => setForm({ ...form, muscle_mass_kg: v })}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-border/40">
                <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest text-center">Medidas corporales (cm)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
                  <StepperInput
                    label="Cintura" value={form.waist_cm} onChange={v => setForm({ ...form, waist_cm: v })} step={0.5}
                  />
                  <StepperInput
                    label="Cadera" value={form.hip_cm} onChange={v => setForm({ ...form, hip_cm: v })} step={0.5}
                  />
                  <StepperInput
                    label="Pecho" value={form.chest_cm} onChange={v => setForm({ ...form, chest_cm: v })} step={0.5}
                  />
                  <StepperInput
                    label="Brazo" value={form.arm_cm} onChange={v => setForm({ ...form, arm_cm: v })} step={0.5}
                  />
                  <StepperInput
                    label="Muslo" value={form.thigh_cm} onChange={v => setForm({ ...form, thigh_cm: v })} step={0.5}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Notas (opcional)</Label>
                <Textarea placeholder="Ej: Medido después de entrenar..."
                  className="rounded-xl border-border/40 bg-muted/10 min-h-[80px]"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.measured_at}>
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
                  : <><Plus className="h-4 w-4 mr-2" />Guardar</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumen actual */}
      {last ? (
        <div className="grid gap-4 md:grid-cols-4">
          {/* Peso */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">Peso actual</p>
              </div>
              <p className="text-2xl font-bold">{last.weight_kg ?? '—'} <span className="text-sm font-normal">kg</span></p>
              {weightTrend && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${weightTrend.color}`}>
                  <weightTrend.icon className="h-3 w-3" />
                  {weightTrend.label} kg vs anterior
                </p>
              )}
            </CardContent>
          </Card>

          {/* IMC */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">IMC</p>
              </div>
              <p className="text-2xl font-bold">{imc ?? '—'}</p>
              {imc && (
                <div className="mt-1">
                  {(() => {
                    const val = parseFloat(imc);
                    let status = { label: 'Normal', color: 'text-green-600 bg-green-500/10' };
                    if (val < 18.5) status = { label: 'Bajo peso', color: 'text-blue-500 bg-blue-500/10' };
                    else if (val < 25) status = { label: 'Normal', color: 'text-green-600 bg-green-500/10' };
                    else if (val < 30) status = { label: 'Sobrepeso', color: 'text-orange-500 bg-orange-500/10' };
                    else status = { label: 'Obesidad', color: 'text-red-500 bg-red-500/10' };

                    return (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* % Grasa */}
          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <HeartPulse className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">% Grasa</p>
              </div>
              <p className="text-2xl font-bold">{last.body_fat_pct ?? '—'} <span className="text-sm font-normal">%</span></p>
              {fatTrend && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${fatTrend.color}`}>
                  <fatTrend.icon className="h-3 w-3" />
                  {fatTrend.label}% vs anterior
                </p>
              )}
            </CardContent>
          </Card>

          {/* Masa muscular */}
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-xs text-muted-foreground">Masa muscular</p>
              </div>
              <p className="text-2xl font-bold">{last.muscle_mass_kg ?? '—'} <span className="text-sm font-normal">kg</span></p>
              {muscleTrend && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${muscleTrend.color}`}>
                  <muscleTrend.icon className="h-3 w-3" />
                  {muscleTrend.label} kg vs anterior
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium">Sin mediciones registradas</p>
            <p className="text-sm text-muted-foreground mt-1">Registra tu primera medición para ver tu evolución</p>
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Primera medición
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs: evolución + medidas + historial */}
      {metrics.length > 0 && (
        <Tabs defaultValue="evolution" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evolution">Evolución</TabsTrigger>
            <TabsTrigger value="measures">Medidas</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
          </TabsList>

          {/* Evolución peso */}
          <TabsContent value="evolution" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolución de Peso
                </CardTitle>
                <CardDescription>Últimas {metrics.filter(m => m.weight_kg).length} mediciones</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.filter(m => m.weight_kg).length > 1 ? (
                  <div className="h-40 flex items-end gap-2">
                    {metrics.filter(m => m.weight_kg).slice(0, 10).reverse().map((m, i) => {
                      const vals = metrics.filter(x => x.weight_kg).map(x => x.weight_kg as number);
                      const min = Math.min(...vals);
                      const max = Math.max(...vals);
                      const range = max - min || 1;
                      const pct = Math.max(10, ((m.weight_kg! - min) / range) * 100);
                      return (
                        <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{m.weight_kg}kg</span>
                          <div
                            className="w-full bg-primary/60 rounded-t"
                            style={{ height: `${pct}%` }}
                          />
                          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                            {new Date(m.measured_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Necesitas al menos 2 mediciones para ver la evolución.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medidas actuales */}
          <TabsContent value="measures">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-primary" />
                  Medidas Corporales
                </CardTitle>
                <CardDescription>
                  Última medición: {last ? new Date(last.measured_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  {last?.source === 'trainer' && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">💪 Medido por entrenador</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Cintura', value: last?.waist_cm,    unit: 'cm' },
                    { label: 'Cadera',  value: last?.hip_cm,      unit: 'cm' },
                    { label: 'Pecho',   value: last?.chest_cm,    unit: 'cm' },
                    { label: 'Brazo',   value: last?.arm_cm,      unit: 'cm' },
                    { label: 'Muslo',   value: last?.thigh_cm,    unit: 'cm' },
                    { label: 'Talla',   value: last?.height_cm,   unit: 'cm' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="p-3 rounded-lg border bg-card">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold mt-0.5">
                        {value != null ? `${value} ${unit}` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial completo */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Mediciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metrics.map((m, idx) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {new Date(m.measured_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        {idx === 0 && <Badge variant="secondary" className="text-[10px]">Última</Badge>}
                        {m.source === 'trainer' && <Badge variant="outline" className="text-[10px]">💪 Entrenador</Badge>}
                      </div>
                      {m.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{m.notes}"</p>}
                    </div>
                    <div className="text-right text-sm space-y-0.5">
                      {m.weight_kg    && <p className="font-semibold">{m.weight_kg} kg</p>}
                      {m.body_fat_pct && <p className="text-muted-foreground">{m.body_fat_pct}% grasa</p>}
                      {m.muscle_mass_kg && <p className="text-muted-foreground">{m.muscle_mass_kg} kg músculo</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
