import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Calendar, CheckCircle2, Clock, Dumbbell, FileText,
  Timer, ArrowRight, User, Wind, Coffee, Zap, Heart,
} from 'lucide-react';

// ── Mapeo de tipo de bloque → icono + color ──────────────────────────────────
const BLOCK_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  warmup:      { icon: Wind,     color: 'text-orange-500', label: 'Calentamiento' },
  strength:    { icon: Dumbbell, color: 'text-red-500',    label: 'Fuerza' },
  cardio:      { icon: Heart,    color: 'text-blue-500',   label: 'Cardio' },
  hiit:        { icon: Zap,      color: 'text-purple-500', label: 'HIIT' },
  flexibility: { icon: Timer,    color: 'text-green-500',  label: 'Flexibilidad' },
  cooldown:    { icon: Coffee,   color: 'text-indigo-500', label: 'Vuelta calma' },
};

// Campos que usa cada tipo de bloque (igual que BlockBuilder)
const BLOCK_FIELDS: Record<string, string[]> = {
  warmup:      ['duration_minutes'],
  strength:    ['sets', 'reps', 'weight', 'rest_seconds'],
  cardio:      ['duration_minutes'],
  hiit:        ['sets', 'duration_minutes', 'rest_seconds'],
  flexibility: ['duration_minutes'],
  cooldown:    ['duration_minutes'],
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  assigned:  { label: 'Asignado',  color: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Completado', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  draft:     { label: 'Borrador',  color: 'bg-muted text-muted-foreground border-border/50' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface SessionUsageDetailModalProps {
  open: boolean;
  onClose: () => void;
  plan: {
    id: string;
    name: string;
    session_date: string;
    status: string;
    client_id: string;
    client_type: string;
    client_name: string;
    client_avatar?: string | null;
    blocks: any[];
    custom_notes?: string | null;
    results?: any;
  } | null;
}

export function SessionUsageDetailModal({ open, onClose, plan }: SessionUsageDetailModalProps) {
  const navigate = useNavigate();

  if (!plan) return null;

  const isCompleted = plan.status === 'completed';
  const statusCfg   = STATUS_CONFIG[plan.status] ?? STATUS_CONFIG.draft;
  const initials    = plan.client_name?.charAt(0)?.toUpperCase() ?? '?';

  const handleGoToClient = () => {
    onClose();
    navigate(`/trainer/clients/${plan.client_id}?type=${plan.client_type}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden border-border/50 shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader className="p-6 border-b bg-muted/20 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-lg shrink-0">
                {plan.client_avatar
                  ? <img src={plan.client_avatar} alt={plan.client_name} className="h-full w-full object-cover rounded-full" />
                  : initials}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold leading-tight">
                  {plan.name}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <User className="h-3 w-3" /> {plan.client_name}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(plan.session_date).toLocaleDateString('es-CO', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] font-bold uppercase shrink-0 ${statusCfg.color}`}>
              {statusCfg.label}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* ── Resultados (si completada) ─────────────────────────────── */}
            {isCompleted && plan.results && (
              <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-2xl space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Resultados de la Sesión
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {plan.results.actual_duration_minutes && (
                    <div className="p-3 bg-white/50 rounded-xl border border-green-500/10">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Duración real</p>
                      <p className="text-xl font-black text-green-700 flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-4 w-4" />
                        {plan.results.actual_duration_minutes} <span className="text-xs font-medium text-muted-foreground">min</span>
                      </p>
                    </div>
                  )}
                  {plan.results.calories_burned && (
                    <div className="p-3 bg-white/50 rounded-xl border border-green-500/10">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Calorías</p>
                      <p className="text-xl font-black text-green-700 mt-0.5">
                        {plan.results.calories_burned} <span className="text-xs font-medium text-muted-foreground">kcal</span>
                      </p>
                    </div>
                  )}
                </div>
                {plan.results.performance_note && (
                  <div className="p-3 bg-white/50 rounded-xl border border-green-500/10 italic text-sm text-muted-foreground">
                    "{plan.results.performance_note}"
                  </div>
                )}
              </div>
            )}

            {/* ── Notas personalizadas ───────────────────────────────────── */}
            {plan.custom_notes && (
              <div className="p-4 bg-muted/30 rounded-2xl border border-border/40 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Notas del Plan
                </h3>
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{plan.custom_notes}"</p>
              </div>
            )}

            {/* ── Bloques de ejercicios ──────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Dumbbell className="h-3.5 w-3.5" />
                Ejercicios asignados
                <span className="font-normal normal-case text-muted-foreground/60">
                  ({plan.blocks?.length ?? 0} bloques)
                </span>
              </h3>

              {(plan.blocks ?? []).map((block: any, idx: number) => {
                const cfg    = BLOCK_ICONS[block.type] ?? BLOCK_ICONS.strength;
                const Icon   = cfg.icon;
                const fields = BLOCK_FIELDS[block.type] ?? BLOCK_FIELDS.strength;

                return (
                  <div
                    key={idx}
                    className="flex items-stretch gap-0 rounded-xl border border-border/40 overflow-hidden bg-card/60"
                  >
                    {/* Número */}
                    <div className="w-10 bg-muted/30 flex items-center justify-center font-black text-muted-foreground text-sm border-r border-border/40">
                      {idx + 1}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold leading-tight">{block.name || '—'}</h4>
                          <div className={`flex items-center gap-1 mt-0.5 ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{cfg.label}</span>
                          </div>
                        </div>

                        {/* Métricas clave */}
                        <div className="flex items-center gap-4">
                          {fields.includes('sets') && block.sets && (
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Sets</p>
                              <p className="text-lg font-black leading-tight">{block.sets}</p>
                            </div>
                          )}
                          {fields.includes('reps') && block.reps && (
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Reps</p>
                              <p className="text-lg font-black leading-tight">{block.reps}</p>
                            </div>
                          )}
                          {fields.includes('duration_minutes') && block.duration_minutes && (
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Dur.</p>
                              <p className="text-lg font-black leading-tight">{block.duration_minutes}<span className="text-xs font-normal"> min</span></p>
                            </div>
                          )}
                          {fields.includes('rest_seconds') && block.rest_seconds && (
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Desc.</p>
                              <p className="text-lg font-black leading-tight">{block.rest_seconds}<span className="text-xs font-normal"> s</span></p>
                            </div>
                          )}
                          {fields.includes('weight') && block.weight && block.weight !== '0' && parseFloat(block.weight) > 0 && (
                            <div className="text-center">
                              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Peso</p>
                              <p className="text-lg font-black leading-tight">
                                {/^\d+(\.\d+)?$/.test(String(block.weight).trim())
                                  ? <>{block.weight}<span className="text-xs font-normal"> {block.weight_unit ?? 'kg'}</span></>
                                  : block.weight
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {block.notes && (
                        <p className="text-xs text-muted-foreground italic bg-accent/30 px-3 py-2 rounded-lg border border-border/20">
                          "{block.notes}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {(!plan.blocks || plan.blocks.length === 0) && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay bloques registrados en esta sesión.
                </div>
              )}
            </div>

          </div>
        </ScrollArea>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="p-4 border-t bg-muted/10 flex items-center justify-between shrink-0">
          <Button variant="ghost" onClick={onClose} className="font-bold text-muted-foreground">
            Cerrar
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-primary/20 hover:bg-primary/5 font-bold"
            onClick={handleGoToClient}
          >
            Ver perfil del cliente
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
