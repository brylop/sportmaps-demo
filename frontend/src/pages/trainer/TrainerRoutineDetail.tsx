import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoutineFormModal } from '@/components/trainer/RoutineFormModal';
import { SessionUsageDetailModal } from '@/components/trainer/SessionUsageDetailModal';
import {
  Loader2,
  ChevronLeft,
  Pencil,
  Trash2,
  Clock,
  Dumbbell,
  History,
  Target,
  Play,
  ArrowRight,
  Wind,
  Coffee,
  Zap,
  Heart,
  Timer,
  Flame,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { QuickUseRoutineModal } from '@/components/trainer/QuickUseRoutineModal';
import { useActiveWorkPage } from '@/hooks/useActiveWorkPage';

// Campos que renderiza cada tipo de bloque (mismo criterio que BlockBuilder)
const BLOCK_FIELDS: Record<string, string[]> = {
  warmup:      ['duration_minutes'],
  strength:    ['sets', 'reps', 'weight', 'rest_seconds'],
  cardio:      ['duration_minutes'],
  hiit:        ['sets', 'duration_minutes', 'rest_seconds'],
  flexibility: ['duration_minutes'],
  cooldown:    ['duration_minutes'],
};

const BLOCK_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  warmup:      { icon: Wind,     color: 'text-orange-500', label: 'Calentamiento' },
  strength:    { icon: Dumbbell, color: 'text-red-500',    label: 'Fuerza' },
  cardio:      { icon: Heart,    color: 'text-blue-500',   label: 'Cardio' },
  hiit:        { icon: Zap,      color: 'text-purple-500', label: 'HIIT' },
  flexibility: { icon: Timer,    color: 'text-green-500',  label: 'Flexibilidad' },
  cooldown:    { icon: Coffee,   color: 'text-indigo-500', label: 'Vuelta calma' },
};

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

export default function TrainerRoutineDetail() {
  useActiveWorkPage();
  const { routineId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const isSchoolContext = window.location.pathname.startsWith('/school');

  const [routine, setRoutine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [selectedUsagePlan, setSelectedUsagePlan] = useState<any | null>(null);

  useEffect(() => {
    if (routineId) {
      fetchRoutineDetail();
      fetchUsageHistory();
    }
  }, [routineId]);

  const fetchRoutineDetail = async () => {
    setIsLoading(true);
    try {
      const url = isSchoolContext 
        ? `${BFF_URL}/api/v1/school/routines/${routineId}` 
        : `${BFF_URL}/api/v1/trainer/routines/${routineId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRoutine(data);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo cargar la rutina.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsageHistory = async () => {
    if (isSchoolContext) {
      setUsageHistory([]);
      return;
    }
    try {
      const res = await fetch(
        `${BFF_URL}/api/v1/trainer/session-plans?routine_id=${routineId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setUsageHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching usage history:', err);
    }
  };

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const url = isSchoolContext
        ? `${BFF_URL}/api/v1/school/routines/${routineId}`
        : `${BFF_URL}/api/v1/trainer/routines/${routineId}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error('Error al actualizar');
      toast({ title: '✅ Rutina actualizada' });
      fetchRoutineDetail();
      setIsModalOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo actualizar.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar esta rutina?')) return;
    try {
      const url = isSchoolContext
        ? `${BFF_URL}/api/v1/school/routines/${routineId}`
        : `${BFF_URL}/api/v1/trainer/routines/${routineId}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Rutina eliminada' });
      navigate(isSchoolContext ? '/school/routines' : '/trainer/routines');
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo eliminar la rutina.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Cargando detalles...</p>
      </div>
    );
  }

  if (!routine) return <div className="p-12 text-center">Rutina no encontrada.</div>;

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate(isSchoolContext ? '/school/routines' : '/trainer/routines')} 
          className="gap-2 -ml-2 text-muted-foreground hover:bg-transparent hover:text-primary transition-colors font-bold"
        >
          <ChevronLeft className="h-4 w-4" />
          VOLVER AL PANEL
        </Button>
        <div className="flex gap-2">
          {routine.scope !== 'global' && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-10 border-primary/20 hover:bg-primary/5"
                onClick={() => setIsModalOpen(true)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="gap-2 h-10 shadow-lg shadow-destructive/20"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Main Content: Routine Structure */}
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 font-bold uppercase tracking-widest text-[10px]">
                  {routine.category}
                </Badge>
                <Badge variant="outline" className="font-bold uppercase tracking-widest text-[10px]">
                  {routine.difficulty}
                </Badge>
              </div>
              <h1 className="text-4xl font-black tracking-tighter leading-none">{routine.name}</h1>
              {routine.description && (
                <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl mt-4">
                  {routine.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-border/40 bg-muted/5 rounded-2xl px-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Duración</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.estimated_minutes} min</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:border-x border-border/40 md:px-6">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ejercicios</span>
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.blocks?.length || 0} bloques</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 md:border-r border-border/40 md:pr-6">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Usos totales</span>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.times_used} veces</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Calorías Est.</span>
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <span className="text-xl font-black text-orange-600">
                    {routine.estimated_calories > 0 ? `${routine.estimated_calories} kcal` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {routine.warmup && (
              <div className="bg-muted/20 border border-border/40 rounded-2xl p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                  <Wind className="h-4 w-4" /> Calentamiento
                </h3>
                <p className="text-muted-foreground leading-relaxed italic text-sm">{routine.warmup}</p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" /> Bloques de Entrenamiento
              </h3>
              <div className="space-y-4">
                {routine.blocks?.map((block: any, idx: number) => {
                  const blockCfg    = BLOCK_ICONS[block.type] ?? BLOCK_ICONS.strength;
                  const BlockIcon   = blockCfg.icon;
                  const blockFields = BLOCK_FIELDS[block.type] ?? BLOCK_FIELDS.strength;

                  return (
                    <Card key={idx} className="border-border/40 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors bg-card/40">
                      <CardContent className="p-0 flex items-stretch">
                        <div className="w-12 bg-muted/30 flex items-center justify-center font-black text-lg text-muted-foreground border-r border-border/40 group-hover:bg-primary/5 transition-colors">
                          {idx + 1}
                        </div>
                        <div className="flex-1 p-5 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-lg leading-none">{block.name}</h4>
                              <div className={`flex items-center gap-1 mt-1.5 ${blockCfg.color}`}>
                                <BlockIcon className="h-3 w-3" />
                                <span className="text-[9px] font-black uppercase tracking-widest">{blockCfg.label}</span>
                              </div>
                            </div>
                            <div className="flex gap-4">
                              {blockFields.includes('sets') && block.sets && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sets</span>
                                  <span className="font-black text-lg">{block.sets}</span>
                                </div>
                              )}
                              {blockFields.includes('reps') && block.reps && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Reps</span>
                                  <span className="font-black text-lg">{block.reps}</span>
                                </div>
                              )}
                              {blockFields.includes('duration_minutes') && block.duration_minutes && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Dur.</span>
                                  <span className="font-black text-lg">{block.duration_minutes}<span className="text-xs font-normal"> min</span></span>
                                </div>
                              )}
                              {blockFields.includes('rest_seconds') && block.rest_seconds && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Desc.</span>
                                  <span className="font-black text-lg">{block.rest_seconds}<span className="text-xs font-normal"> s</span></span>
                                </div>
                              )}
                              {blockFields.includes('weight') && block.weight && block.weight !== '0' && (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Peso</span>
                                  <span className="font-black text-lg">
                                    {/^\d+(\.\d+)?$/.test(String(block.weight).trim())
                                      ? <>{block.weight}<span className="text-xs font-normal"> {block.weight_unit ?? 'kg'}</span></>
                                      : block.weight
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {block.notes && (
                            <div className="text-xs text-muted-foreground bg-accent/40 p-3 rounded-lg border border-border/10 italic">
                              "{block.notes}"
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {routine.cooldown && (
              <div className="bg-muted/20 border border-border/40 rounded-2xl p-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Coffee className="h-4 w-4" /> Vuelta a la Calma
                </h3>
                <p className="text-muted-foreground leading-relaxed italic text-sm">{routine.cooldown}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Metadata & History */}
        <div className="w-full md:w-[320px] space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest">Acción Rápida</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground italic mb-2">
                Asigna esta rutina a un cliente para planificar su próxima sesión.
              </p>
              <Button 
                className="w-full gap-2 h-14 font-black text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                onClick={() => setIsUseModalOpen(true)}
              >
                <Play className="h-5 w-5 fill-current" />
                USAR AHORA
              </Button>
            </CardContent>
          </Card>

          {!isSchoolContext && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <History className="h-3 w-3" /> Historial de Uso
              </h3>
              {usageHistory.length === 0 ? (
                <div className="p-6 text-center border rounded-2xl bg-accent/5">
                  <p className="text-xs text-muted-foreground font-medium italic">Esta rutina aún no ha sido asignada a ningún cliente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usageHistory.slice(0, 5).map((plan, i) => {
                    const initials = plan.client_name?.charAt(0)?.toUpperCase() ?? '?';
                    const isCompleted = plan.status === 'completed';
                    return (
                      <Card
                        key={i}
                        className="border-border/50 cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
                        onClick={() => setSelectedUsagePlan(plan)}
                      >
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-sm shrink-0">
                              {plan.client_avatar
                                ? <img src={plan.client_avatar} alt={plan.client_name} className="h-full w-full object-cover rounded-full" />
                                : initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold leading-none truncate">{plan.client_name}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(plan.session_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isCompleted && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-green-600 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                ✓ Completada
                              </span>
                            )}
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              {usageHistory.length > 5 && (
                <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest opacity-50">
                  Ver historial completo
                </Button>
              )}
            </div>
          )}

          <div className="p-6 bg-accent/20 rounded-2xl space-y-3">
            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              <span>Creado</span>
              <span>{new Date(routine.created_at).toLocaleDateString()}</span>
            </div>
            <Separator className="bg-border/20" />
            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              <span>Tipo</span>
              <span>{isSchoolContext ? (routine.scope === 'global' ? 'Catálogo SportMaps' : 'Rutina del Gym') : 'Plantilla Reutilizable'}</span>
            </div>
          </div>
        </div>
      </div>

      <RoutineFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        routine={routine}
        onSave={handleSave}
        isLoading={isSaving}
        context={isSchoolContext ? 'school' : 'trainer'}
      />

      <QuickUseRoutineModal
        open={isUseModalOpen}
        onClose={() => setIsUseModalOpen(false)}
        routineId={routine.id}
        routineName={routine.name}
        onSuccess={() => {
          fetchUsageHistory();
          fetchRoutineDetail();
        }}
        useEndpoint={isSchoolContext ? 'school' : 'trainer'}
      />

      <SessionUsageDetailModal
        open={!!selectedUsagePlan}
        onClose={() => setSelectedUsagePlan(null)}
        plan={selectedUsagePlan}
      />
    </div>
  );
}
