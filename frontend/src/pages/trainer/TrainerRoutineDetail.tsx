import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoutineFormModal } from '@/components/trainer/RoutineFormModal';
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
  Coffee
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { QuickUseRoutineModal } from '@/components/trainer/QuickUseRoutineModal';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

export default function TrainerRoutineDetail() {
  const { routineId } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [routine, setRoutine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUseModalOpen, setIsUseModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);

  useEffect(() => {
    if (routineId) {
      fetchRoutineDetail();
      fetchUsageHistory();
    }
  }, [routineId]);

  const fetchRoutineDetail = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/routines/${routineId}`, {
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
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/session-plans?routine_id=${routineId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsageHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching usage history:', err);
    }
  };

  const handleSave = async (formData: any) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/routines/${routineId}`, {
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
          onClick={() => navigate('/trainer/routines')} 
          className="gap-2 -ml-2 text-muted-foreground hover:bg-transparent hover:text-primary transition-colors font-bold"
        >
          <ChevronLeft className="h-4 w-4" />
          VOLVER AL PANEL
        </Button>
        <div className="flex gap-2">
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
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
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

            <div className="grid grid-cols-3 gap-4 py-6 border-y border-border/40 bg-muted/5 rounded-2xl px-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Duración</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.estimated_minutes} min</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 border-x border-border/40 px-6">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ejercicios</span>
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.blocks?.length || 0} bloques</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Usos totales</span>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <span className="text-xl font-black">{routine.times_used} veces</span>
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
                {routine.blocks?.map((block: any, idx: number) => (
                  <Card key={idx} className="border-border/40 shadow-sm overflow-hidden group hover:border-primary/30 transition-colors bg-card/40">
                    <CardContent className="p-0 flex items-stretch">
                      <div className="w-12 bg-muted/30 flex items-center justify-center font-black text-lg text-muted-foreground border-r border-border/40 group-hover:bg-primary/5 transition-colors">
                        {idx + 1}
                      </div>
                      <div className="flex-1 p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-lg leading-none">{block.name}</h4>
                            <Badge variant="outline" className="mt-2 text-[9px] uppercase font-bold tracking-wider opacity-60">
                              {block.type}
                            </Badge>
                          </div>
                          <div className="flex gap-4">
                            {block.sets && (
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Sets</span>
                                <span className="font-black text-lg">{block.sets}</span>
                              </div>
                            )}
                            {block.reps && (
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Reps</span>
                                <span className="font-black text-lg">{block.reps}</span>
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
                ))}
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
                {usageHistory.slice(0, 5).map((plan, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center font-bold text-xs uppercase tracking-tighter">
                          {plan.client_type === 'adult' ? 'A' : 'C'}
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-none">Asignado</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(plan.session_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {usageHistory.length > 5 && (
              <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest opacity-50">
                Ver historial completo
              </Button>
            )}
          </div>

          <div className="p-6 bg-accent/20 rounded-2xl space-y-3">
            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              <span>Creado</span>
              <span>{new Date(routine.created_at).toLocaleDateString()}</span>
            </div>
            <Separator className="bg-border/20" />
            <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              <span>Tipo</span>
              <span>Plantilla Reutilizable</span>
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
      />

      <QuickUseRoutineModal 
        open={isUseModalOpen}
        onClose={() => setIsUseModalOpen(false)}
        routineId={routine.id}
        routineName={routine.name}
        onSuccess={() => {
          fetchUsageHistory();
          fetchRoutineDetail(); // To update total uses
        }}
      />
    </div>
  );
}
