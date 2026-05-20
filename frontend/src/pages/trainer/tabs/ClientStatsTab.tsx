import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Plus, Trash2, Trophy, ChevronDown, ChevronRight,
  BarChart3, Zap,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { WellnessModule } from '@/components/wellness/WellnessModule';
import {
  groupPRsByMuscle, getDisplayName,
  MUSCLE_GROUP_CONFIG, type MuscleGroup,
} from '@/lib/trainer/muscleGroups';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface StatRow {
  id: string;
  stat_type: string;
  value: number;
  unit: string;
  stat_date: string;
  notes?: string;
}

interface UnifiedPR {
  stat_type: string;       // base sin prefijo rpe_ (ej: 'fuerza_press_banca')
  best_value: number;
  unit: string;
  latest_rpe: number | null;
  total_sets: number;
  pr_date: string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATS_PRESETS = [
  { id: 'fcr',         label: 'Frec. Cardíaca (Reposo)',    defaultUnit: 'bpm'       },
  { id: 'vo2max',      label: 'VO2 Max',                    defaultUnit: 'ml/kg/min' },
  { id: 'bench1rm',    label: 'Fuerza: Bench Press (1RM)',  defaultUnit: 'kg'        },
  { id: 'squat1rm',    label: 'Fuerza: Sentadilla (1RM)',   defaultUnit: 'kg'        },
  { id: 'deadlift1rm', label: 'Fuerza: Peso Muerto (1RM)',  defaultUnit: 'kg'        },
];

const PT_PREFIXES = [
  'fuerza_', 'cardio_', 'hiit_', 'flexibilidad_',
  'calentamiento_', 'rpe_fuerza_', 'rpe_hiit_',
  'duracion_sesion', 'calorias_sesion',
];

const SESSION_METRICS = new Set(['duracion_sesion', 'calorias_sesion']);

const ROUTINE_TYPE_FILTERS = [
  { key: 'all',          label: 'Todos',          prefix: null              },
  { key: 'fuerza',       label: '💪 Fuerza',       prefix: 'fuerza_'        },
  { key: 'cardio',       label: '❤️ Cardio',        prefix: 'cardio_'       },
  { key: 'hiit',         label: '⚡ HIIT',          prefix: 'hiit_'         },
  { key: 'flexibilidad', label: '🧘 Flexibilidad',  prefix: 'flexibilidad_' },
  { key: 'calentamiento',label: '🌡️ Calentamiento', prefix: 'calentamiento_'},
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPTGenerated(statType: string): boolean {
  return PT_PREFIXES.some(p => statType.startsWith(p));
}

function baseStatType(statType: string): string {
  if (statType.startsWith('rpe_fuerza_')) return statType.replace(/^rpe_fuerza_/, 'fuerza_');
  if (statType.startsWith('rpe_hiit_'))   return statType.replace(/^rpe_hiit_/, 'hiit_');
  return statType;
}

function computeUnifiedPRs(rows: StatRow[]): UnifiedPR[] {
  const rpeRows  = rows.filter(r => r.stat_type.startsWith('rpe_'));
  const mainRows = rows.filter(r => !r.stat_type.startsWith('rpe_') && !SESSION_METRICS.has(r.stat_type));

  const prMap = new Map<string, UnifiedPR>();

  for (const row of mainRows) {
    const base     = baseStatType(row.stat_type);
    const existing = prMap.get(base);
    if (!existing || row.value > existing.best_value) {
      prMap.set(base, {
        stat_type:  base,
        best_value: row.value,
        unit:       row.unit,
        latest_rpe: existing?.latest_rpe ?? null,
        total_sets: (existing?.total_sets ?? 0) + 1,
        pr_date:    row.stat_date,
      });
    } else {
      existing.total_sets += 1;
    }
  }

  // RPE más reciente por ejercicio
  for (const rpe of rpeRows) {
    const base  = baseStatType(rpe.stat_type);
    const entry = prMap.get(base);
    if (!entry) continue;
    const latestRpeRow = rpeRows
      .filter(r => baseStatType(r.stat_type) === base)
      .sort((a, b) => b.stat_date.localeCompare(a.stat_date))[0];
    if (latestRpeRow) entry.latest_rpe = latestRpeRow.value;
  }

  return [...prMap.values()];
}

// ── Gráfica dual: peso + RPE ──────────────────────────────────────────────────

function EvolutionChart({ statType, allStats }: { statType: string; allStats: StatRow[] }) {
  const mainSeries = useMemo(() =>
    allStats
      .filter(s => s.stat_type === statType)
      .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
      .map(s => ({
        fecha: new Date(s.stat_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        valor: s.value,
        unit:  s.unit,
      }))
  , [statType, allStats]);

  const rpeStatType = statType.startsWith('fuerza_')
    ? statType.replace(/^fuerza_/, 'rpe_fuerza_')
    : statType.startsWith('hiit_')
      ? statType.replace(/^hiit_/, 'rpe_hiit_')
      : null;

  const rpeSeries = useMemo(() => {
    if (!rpeStatType) return [];
    return allStats
      .filter(s => s.stat_type === rpeStatType)
      .sort((a, b) => a.stat_date.localeCompare(b.stat_date))
      .map(s => ({
        fecha: new Date(s.stat_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        rpe: s.value,
      }));
  }, [rpeStatType, allStats]);

  const hasMain = mainSeries.length >= 2;
  const hasRPE  = rpeSeries.length > 0;

  if (!hasMain && !hasRPE) {
    return (
      <p className="text-center text-xs text-muted-foreground py-4">
        Necesitas al menos 2 registros para ver la evolución.
      </p>
    );
  }

  const unitLabel = mainSeries[0]?.unit ?? '';
  const mainLabel =
    unitLabel === 'kg'  ? 'Peso levantado (kg)' :
    unitLabel === 'min' ? 'Duración (min)' :
    unitLabel === 'rpe' ? 'RPE' : `Valor (${unitLabel})`;

  return (
    <div className="space-y-5">

      {/* Gráfica principal */}
      {hasMain && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {mainLabel}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={mainSeries} margin={{ left: -8, right: 8, top: 6, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 9, opacity: 0.55 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, opacity: 0.55 }} tickLine={false} axisLine={false} width={30} />
              <RechartTooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                formatter={(val: any) => [`${val} ${unitLabel}`, getDisplayName(statType)]}
              />
              <Line
                type="monotone" dataKey="valor"
                stroke="hsl(var(--primary))" strokeWidth={2.5}
                dot={{ r: 3.5, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 5 }} animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfica RPE */}
      {hasRPE && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Esfuerzo percibido (RPE)
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground">Escala 1 – 10</p>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={rpeSeries} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 9, opacity: 0.55 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fontSize: 9, opacity: 0.55 }} tickLine={false} axisLine={false} width={20} />
              <ReferenceLine y={7} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.4} />
              <RechartTooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
                formatter={(val: any) => [`RPE ${val}/10`, 'Esfuerzo']}
              />
              <Bar dataKey="rpe" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-muted-foreground/60 text-center">
            Línea roja = zona de alta intensidad (RPE ≥ 7)
          </p>
        </div>
      )}
    </div>
  );
}

// ── Fila de PR con métricas unificadas ───────────────────────────────────────

function PRRow({ pr, cfg, isSelected, onClick }: {
  pr:         UnifiedPR;
  cfg:        typeof MUSCLE_GROUP_CONFIG[MuscleGroup];
  isSelected: boolean;
  onClick:    () => void;
}) {
  const unitSuffix: Record<string, string> = { kg: 'kg', min: 'min', rpe: '/10', rep: 'reps' };

  return (
    <button
      className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors ${isSelected ? 'bg-accent/50' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{getDisplayName(pr.stat_type)}</p>
        <p className="text-[10px] text-muted-foreground">
          {pr.total_sets} registro{pr.total_sets !== 1 ? 's' : ''}
          {pr.pr_date && ` · PR: ${new Date(pr.pr_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        {/* Valor principal */}
        <div className="text-right">
          <p className={`text-lg font-black ${cfg.color} leading-none`}>
            {pr.best_value}
            <span className="text-xs font-normal text-muted-foreground ml-0.5">
              {unitSuffix[pr.unit] ?? pr.unit}
            </span>
          </p>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
            {pr.unit === 'kg' ? 'Mejor peso' : pr.unit === 'min' ? 'Duración' : 'Mejor'}
          </p>
        </div>

        {/* RPE badge */}
        {pr.latest_rpe !== null && (
          <>
            <div className="w-px h-8 bg-border/40" />
            <div className="text-right">
              <p className={`text-lg font-black leading-none ${
                pr.latest_rpe >= 8 ? 'text-red-500' : pr.latest_rpe >= 6 ? 'text-amber-500' : 'text-green-500'
              }`}>
                {pr.latest_rpe}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">/10</span>
              </p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">RPE</p>
            </div>
          </>
        )}
      </div>
    </button>
  );
}

// ── Acordeón por grupo muscular ───────────────────────────────────────────────

function MuscleAccordion({ ptStats, routineFilter, selectedExercise, onSelectExercise }: {
  ptStats:          StatRow[];
  routineFilter:    string;
  selectedExercise: string;
  onSelectExercise: (s: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const filteredStats = useMemo(() => {
    if (routineFilter === 'all') return ptStats;
    const filter = ROUTINE_TYPE_FILTERS.find(f => f.key === routineFilter);
    if (!filter?.prefix) return ptStats;
    // Para fuerza: incluir también rpe_fuerza_ para unificación correcta
    if (filter.prefix === 'fuerza_') {
      return ptStats.filter(s => s.stat_type.startsWith('fuerza_') || s.stat_type.startsWith('rpe_fuerza_'));
    }
    return ptStats.filter(s => s.stat_type.startsWith(filter.prefix!));
  }, [ptStats, routineFilter]);

  const prs     = useMemo(() => computeUnifiedPRs(filteredStats), [filteredStats]);
  const grouped = useMemo(() => groupPRsByMuscle(prs), [prs]);

  useMemo(() => {
    if (grouped.size > 0 && openGroups.size === 0) {
      const first = grouped.keys().next().value;
      if (first) setOpenGroups(new Set([first]));
    }
  }, [grouped.size]);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) { next.delete(group); } else { next.add(group); }
      return next;
    });
  };

  if (prs.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/5">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-20" />
        <p className="text-sm text-muted-foreground">
          {routineFilter === 'all' ? 'Completa sesiones para ver records' : 'Sin datos para este tipo de rutina'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([group, groupPrs]) => {
        const cfg    = MUSCLE_GROUP_CONFIG[group as MuscleGroup];
        const isOpen = openGroups.has(group);
        return (
          <div key={group} className={`rounded-xl border overflow-hidden ${cfg.border}`}>
            <button
              className={`w-full flex items-center justify-between px-4 py-3 ${cfg.bg} hover:opacity-90 transition-opacity text-left`}
              onClick={() => toggleGroup(group)}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{cfg.emoji}</span>
                <span className={`text-sm font-black ${cfg.color}`}>{cfg.label}</span>
                <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 ${cfg.bg} ${cfg.color}`}>
                  {groupPrs.length}
                </Badge>
              </div>
              {isOpen ? <ChevronDown className={`h-4 w-4 ${cfg.color}`} /> : <ChevronRight className={`h-4 w-4 ${cfg.color}`} />}
            </button>
            {isOpen && (
              <div className="divide-y divide-border/30 bg-card">
                {groupPrs.map(pr => (
                  <PRRow
                    key={pr.stat_type}
                    pr={pr} cfg={cfg}
                    isSelected={selectedExercise === pr.stat_type}
                    onClick={() => onSelectExercise(selectedExercise === pr.stat_type ? '' : pr.stat_type)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ClientStatsTab({ clientId, clientName, onUpdate, stats, clientType }: {
  clientId:   string;
  clientName: string;
  onUpdate:   () => void;
  stats:      StatRow[];
  clientType: string;
}) {
  const { session } = useAuth();
  const { toast }   = useToast();
  const [open, setOpen]                         = useState(false);
  const [routineFilter, setRoutineFilter]       = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [form, setForm] = useState({
    stat_type: 'fcr', value: '', unit: 'bpm',
    stat_date: new Date().toISOString().split('T')[0], notes: '',
  });

  const ptStats = useMemo(() =>
    stats.filter(s => isPTGenerated(s.stat_type) && !SESSION_METRICS.has(s.stat_type))
  , [stats]);

  const manualStats = useMemo(() => stats.filter(s => !isPTGenerated(s.stat_type)), [stats]);

  const groupedManual = useMemo(() =>
    manualStats.reduce((acc, stat) => {
      if (!acc[stat.stat_type]) acc[stat.stat_type] = [];
      acc[stat.stat_type].push(stat);
      return acc;
    }, {} as Record<string, StatRow[]>)
  , [manualStats]);

  const activeFilters = useMemo(() =>
    ROUTINE_TYPE_FILTERS.filter(f => {
      if (f.key === 'all') return true;
      if (!f.prefix) return false;
      return ptStats.some(s => s.stat_type.startsWith(f.prefix!));
    })
  , [ptStats]);

  const handleSave = async () => {
    try {
      const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}/stats?type=${clientType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ...form, value: parseFloat(form.value) }),
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
      const res = await fetch(
        `${EFF_URL}/api/v1/trainer/clients/${clientId}/stats/${statId}?type=${clientType}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error();
      onUpdate();
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-10">

      {/* Bienestar */}
      <section className="bg-muted/10 p-6 rounded-2xl border border-border/50">
        <WellnessModule clientId={clientId} clientName={clientName} isTrainer={true} />
      </section>

      <hr className="border-border/60" />

      {/* Records PT */}
      {ptStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="text-xl font-bold tracking-tight">Records por Sesiones PT</h3>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-5 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Mejor marca (kg / min)
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />
              RPE — esfuerzo 1–10
            </span>
          </div>

          {/* Filtros */}
          {activeFilters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setRoutineFilter(f.key); setSelectedExercise(''); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    routineFilter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <MuscleAccordion
            ptStats={ptStats}
            routineFilter={routineFilter}
            selectedExercise={selectedExercise}
            onSelectExercise={setSelectedExercise}
          />

          {/* Panel de evolución */}
          {selectedExercise && (
            <Card className="border-border/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-black">{getDisplayName(selectedExercise)}</CardTitle>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Evolución histórica</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-muted-foreground text-xs h-7" onClick={() => setSelectedExercise('')}>
                    × Cerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <EvolutionChart statType={selectedExercise} allStats={ptStats} />
              </CardContent>
            </Card>
          )}

          {!selectedExercise && (
            <p className="text-xs text-center text-muted-foreground">
              Toca un ejercicio para ver su evolución
            </p>
          )}
        </div>
      )}

      <hr className="border-border/60" />

      {/* Marcas manuales */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Marcas Deportivas y Pruebas
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Pruebas físicas registradas manualmente</p>
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
                  <Select value={form.stat_type} onValueChange={v => setForm({ ...form, stat_type: v, unit: STATS_PRESETS.find(s => s.id === v)?.defaultUnit || '' })}>
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
                    <Input type="number" step="0.1" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Unidad</label>
                    <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha</label>
                  <Input type="date" value={form.stat_date} onChange={e => setForm({ ...form, stat_date: e.target.value })} className="font-bold" />
                </div>
                <Button className="w-full font-bold h-11" onClick={handleSave}>Guardar Marca</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(groupedManual).length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed rounded-xl bg-muted/5">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm font-medium">Aún no has registrado marcas para este cliente.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupedManual).map(([type, items]) => {
              const sorted      = [...items].sort((a, b) => new Date(a.stat_date).getTime() - new Date(b.stat_date).getTime());
              const latest      = sorted[sorted.length - 1];
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
                    {sorted.length > 1 && (
                      <div className="h-16 w-full px-2 mt-4 opacity-70">
                        <ResponsiveContainer>
                          <LineChart data={sorted}>
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 2, strokeWidth: 2, fill: 'white' }} isAnimationActive={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
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
