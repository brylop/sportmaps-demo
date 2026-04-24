import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dumbbell, Plus, Flame, Clock, Calendar, Sparkles, ClipboardList, CheckCircle2, History as HistoryIcon } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { SessionPlanCard } from '@/components/trainer/SessionPlanCard';
import { SessionPlanModal } from '@/components/trainer/SessionPlanModal';
import { CompleteSessionModal } from '@/components/trainer/CompleteSessionModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClientTrainingTabProps {
  clientId: string;
  clientType: string;
  clientName: string;
  onUpdate: () => void;
}

export function ClientTrainingTab({ clientId, clientType, clientName, onUpdate }: ClientTrainingTabProps) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { toast } = useToast();
  
  // Existing Training Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [openLogModal, setOpenLogModal] = useState(false);
  
  // New Session Plans
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [openPlanModal, setOpenPlanModal] = useState(false);
  const [openCompleteModal, setOpenCompleteModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

  const [logForm, setLogForm] = useState({ 
    training_date: new Date().toISOString().split('T')[0], 
    exercise_type: 'Fuerza', 
    duration_minutes: '60', 
    intensity: 'media', 
    calories_burned: '', 
    notes: '' 
  });

  useEffect(() => {
    fetchLogs();
    fetchPlans();
  }, [clientId]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('training_logs')
      .select('*')
      .eq('athlete_id', clientId)
      .order('training_date', { ascending: false })
      .limit(20);
    setLogs(data || []);
  };

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      // Usamos any para evitar recursión de tipos si la tabla no está en el esquema generado aún
      const { data, error } = await (supabase as any)
        .from('trainer_session_plans')
        .select('*')
        .eq('client_id', clientId)
        .order('session_date', { ascending: false });
      
      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSaveLog = async () => {
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/clients/${clientId}/training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || session?.access_token}` },
        body: JSON.stringify({
          ...logForm, 
          duration_minutes: parseInt(logForm.duration_minutes), 
          calories_burned: logForm.calories_burned ? parseInt(logForm.calories_burned) : null
        })
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Entrenamiento guardado' });
      setOpenLogModal(false);
      fetchLogs();
      onUpdate();
    } catch { 
      toast({ title: 'Error', variant: 'destructive' }); 
    }
  };

  const handleSavePlan = async (data: any) => {
    setIsSaving(true);
    try {
      let res;
      if (data.type === 'from_template') {
        res = await fetch(`${BFF_URL}/api/v1/trainer/routines/${data.routine_id}/use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            client_id: data.client_id,
            client_type: data.client_type,
            session_date: data.session_date
          })
        });
      } else {
        res = await fetch(`${BFF_URL}/api/v1/trainer/session-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data)
        });
      }

      if (!res.ok) throw new Error();
      toast({ title: '✅ Planificado con éxito' });
      fetchPlans();
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo crear el plan.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteSession = async (results: any) => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/session-plans/${selectedPlan.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ results })
      });

      if (!res.ok) throw new Error();
      toast({ title: '✅ Sesión completada y guardada' });
      fetchPlans();
      fetchLogs(); // RPC genera un log también
      onUpdate();
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo completar la sesión.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/session-plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Plan eliminado' });
      fetchPlans();
    } catch (err) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const logColors: any = { 
    baja: 'bg-green-500/10 text-green-500', 
    media: 'bg-amber-500/10 text-amber-500', 
    alta: 'bg-orange-500/10 text-orange-500', 
    maxima: 'bg-red-500/10 text-red-500' 
  };

  const nextPlans = plans.filter(p => p.status === 'assigned' || p.status === 'draft');
  const pastPlans = plans.filter(p => p.status === 'completed' || p.status === 'cancelled');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* SECCIÓN 1: PLANIFICACIÓN */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Próximas Sesiones</h3>
              <p className="text-xs text-muted-foreground font-medium">Entrenamientos planificados y por realizar</p>
            </div>
          </div>
          <Button 
            size="sm" 
            className="gap-2 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20"
            onClick={() => setOpenPlanModal(true)}
          >
            <Calendar className="w-4 h-4" /> Planificar Nueva
          </Button>
        </div>

        <div className="space-y-3">
          {loadingPlans ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
            </div>
          ) : nextPlans.length === 0 ? (
            <div className="text-center p-10 border-2 border-dashed rounded-2xl bg-accent/5">
              <Sparkles className="mx-auto h-8 w-8 mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm font-bold text-muted-foreground">No hay sesiones planificadas</p>
              <Button 
                variant="link" 
                className="text-primary font-bold"
                onClick={() => setOpenPlanModal(true)}
              >
                Comenzar planificación
              </Button>
            </div>
          ) : (
            nextPlans.map(plan => (
              <SessionPlanCard 
                key={plan.id}
                plan={plan}
                onComplete={(p) => { setSelectedPlan(p); setOpenCompleteModal(true); }}
                onEdit={(p) => { setSelectedPlan(p); setOpenPlanModal(true); }} // V2: Editar plan
                onDelete={handleDeletePlan}
              />
            ))
          )}
        </div>
      </div>

      <Separator />

      {/* SECCIÓN 2: HISTORIAL Y LOGS */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-muted/30 rounded-lg">
              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black tracking-tight">Historial de Sesiones</h3>
          </div>
          <Dialog open={openLogModal} onOpenChange={setOpenLogModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-border/40 hover:bg-muted/30 font-bold">
                <Plus className="w-4 h-4" /> Registrar Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader><DialogTitle className="text-xl font-bold">Registrar Entrenamiento Manual</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Fecha</label>
                    <Input type="date" value={logForm.training_date} onChange={e => setLogForm({...logForm, training_date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Tipo principal</label>
                    <Input placeholder="Ej: Fuerza" value={logForm.exercise_type} onChange={e => setLogForm({...logForm, exercise_type: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Duración (min)</label>
                    <Input type="number" value={logForm.duration_minutes} onChange={e => setLogForm({...logForm, duration_minutes: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Intensidad</label>
                    <Select value={logForm.intensity} onValueChange={v => setLogForm({...logForm, intensity: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="maxima">Máxima</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">Calorías quemadas (opcional)</label>
                  <Input type="number" value={logForm.calories_burned} onChange={e => setLogForm({...logForm, calories_burned: e.target.value})} />
                </div>
                <Textarea placeholder="Notas de la sesión..." value={logForm.notes} onChange={e => setLogForm({...logForm, notes: e.target.value})} className="rounded-xl min-h-[100px]" />
                <Button className="w-full bg-primary hover:bg-primary/90 font-bold h-12 shadow-lg shadow-primary/20" onClick={handleSaveLog}>Guardar Sesión</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="bg-accent/20 p-1 mb-4 h-10">
            <TabsTrigger value="all" className="text-xs font-bold uppercase">Todos los Logs</TabsTrigger>
            <TabsTrigger value="planned" className="text-xs font-bold uppercase">Solo Planes Finalizados</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3">
            {logs.length === 0 && (
              <div className="text-center p-12 border-2 border-dashed rounded-3xl text-muted-foreground bg-accent/5">
                <Dumbbell className="mx-auto h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Sin sesiones registradas aún</p>
              </div>
            )}
            {logs.map(log => (
              <Card key={log.id} className="border-border/50 group hover:border-primary/30 transition-all shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-accent/20 w-14 h-14 border shrink-0">
                      <span className="text-[9px] uppercase font-black text-muted-foreground">
                        {new Date(log.training_date).toLocaleDateString('es-CO', { month: 'short' })}
                      </span>
                      <span className="text-xl font-black">{new Date(log.training_date).getDate()}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg leading-tight uppercase tracking-tight">{log.exercise_type}</h4>
                        <Badge variant="secondary" className={`text-[10px] font-black uppercase tracking-wider ${logColors[log.intensity] || 'bg-secondary'}`}>
                          {log.intensity}
                        </Badge>
                      </div>
                      {log.notes && <p className="text-xs text-muted-foreground leading-relaxed italic pr-4">"{log.notes}"</p>}
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 sm:gap-1 text-xs shrink-0 bg-muted/20 px-3 py-2 sm:p-0 rounded-xl sm:bg-transparent">
                    <div className="flex items-center gap-1.5 font-black text-muted-foreground whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" /> {log.duration_minutes} MIN
                    </div>
                    {log.calories_burned && (
                      <div className="flex items-center gap-1.5 font-black text-primary whitespace-nowrap">
                        <Flame className="w-3.5 h-3.5" /> {log.calories_burned} KCAL
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="planned" className="space-y-3">
            {pastPlans.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed rounded-3xl text-muted-foreground">
                <p className="text-xs font-bold uppercase tracking-widest opacity-50">No hay planes completados aún</p>
              </div>
            ) : (
              pastPlans.map(plan => (
                <SessionPlanCard
                  key={plan.id}
                  plan={plan}
                  onComplete={() => {}}
                  onEdit={() => {}}
                  onDelete={handleDeletePlan}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* MODALES */}
      <SessionPlanModal 
        open={openPlanModal}
        onClose={() => setOpenPlanModal(false)}
        clientId={clientId}
        clientType={clientType}
        clientName={clientName}
        onSave={handleSavePlan}
        isLoading={isSaving}
      />

      <CompleteSessionModal 
        open={openCompleteModal}
        onClose={() => setOpenCompleteModal(false)}
        plan={selectedPlan}
        onCompleted={handleCompleteSession}
        isLoading={isSaving}
      />
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  )
}

function Separator() {
  return <div className="h-px bg-border/50 w-full my-8" />;
}
