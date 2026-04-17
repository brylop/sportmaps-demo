import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, User, Activity, ListTodo, Presentation, Dumbbell, ShieldCheck } from "lucide-react";

import { ClientResumenTab } from '@/pages/trainer/tabs/ClientResumenTab';
import { ClientStatsTab } from '@/pages/trainer/tabs/ClientStatsTab';
import { ClientGoalsTab } from '@/pages/trainer/tabs/ClientGoalsTab';
import { ClientTrainingTab } from '@/pages/trainer/tabs/ClientTrainingTab';
import { ClientProgressTab } from '@/pages/trainer/tabs/ClientProgressTab';
import { ClientPlanTab } from '@/pages/trainer/tabs/ClientPlanTab';

const EFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

export default function TrainerClientProfile() {
  const { clientId } = useParams<{ clientId: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type'); // 'adult', 'child', or 'unregistered'
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('resume');

  useEffect(() => {
    if (!clientId || clientId === 'null' || !type || !['adult', 'child', 'unregistered'].includes(type) || !session?.access_token) return;

    const fetchClientData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}?type=${type}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const data = await res.json();
        setClientData(data);
      } catch (err: any) {
        toast({ title: 'Error cargando cliente', description: err.message, variant: 'destructive' });
        navigate('/trainer/clients');
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [clientId, type, session, navigate, toast]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    );
  }

  if (!clientData) return null;

  const { enrollment, payments, attendance, stats, goals } = clientData;
  const isAdultLike = type === 'adult' || type === 'unregistered';
  const person = isAdultLike ? enrollment.profiles : enrollment.children;
  const name = person?.full_name || 'Desconocido';
  const avatar = person?.avatar_url || '';
  const planName = enrollment.offering_plans?.name || 'A demanda';

  const refreshAction = async () => {
    // Just retrigger data fetch simply
    const res = await fetch(`${EFF_URL}/api/v1/trainer/clients/${clientId}?type=${type}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (res.ok) {
      setClientData(await res.json());
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/trainer/clients')} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border">
              {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-primary" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-primary/5">{planName}</Badge>
                {enrollment.status === 'active' ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Activo</Badge>
                ) : (
                  <Badge variant="destructive">{enrollment.status}</Badge>
                )}
                {!isAdultLike && <Badge variant="secondary">Padre a cargo</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto p-1 mb-4 gap-1">
          <TabsTrigger value="resume" className="py-2.5 text-xs sm:text-sm"><Presentation className="w-4 h-4 mr-2 hidden sm:block" />Resumen</TabsTrigger>
          <TabsTrigger value="stats" className="py-2.5 text-xs sm:text-sm"><Activity className="w-4 h-4 mr-2 hidden sm:block" />Métricas</TabsTrigger>
          <TabsTrigger value="goals" className="py-2.5 text-xs sm:text-sm"><ListTodo className="w-4 h-4 mr-2 hidden sm:block" />Objetivos</TabsTrigger>
          <TabsTrigger value="training" className="py-2.5 text-xs sm:text-sm"><Dumbbell className="w-4 h-4 mr-2 hidden sm:block" />Sesiones</TabsTrigger>
          <TabsTrigger value="progress" className="py-2.5 text-xs sm:text-sm"><ShieldCheck className="w-4 h-4 mr-2 hidden sm:block" />Habilidades</TabsTrigger>
          <TabsTrigger value="plan" className="py-2.5 text-xs sm:text-sm text-muted-foreground">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="mt-0">
          <ClientResumenTab 
            data={clientData} 
            onNewEvaluation={() => setActiveTab('progress')}
            onNewSession={() => setActiveTab('training')}
          />
        </TabsContent>
        <TabsContent value="stats" className="mt-0">
          <ClientStatsTab clientId={clientId!} onUpdate={refreshAction} stats={stats} />
        </TabsContent>
        <TabsContent value="goals" className="mt-0">
          <ClientGoalsTab clientId={clientId!} goals={goals} onUpdate={refreshAction} />
        </TabsContent>
        <TabsContent value="training" className="mt-0">
          <ClientTrainingTab 
            clientId={clientId!} 
            clientType={type!} 
            clientName={name} 
            onUpdate={refreshAction} 
          />
        </TabsContent>
        <TabsContent value="progress" className="mt-0">
          <ClientProgressTab clientId={clientId!} type={type!} onUpdate={refreshAction} />
        </TabsContent>
        <TabsContent value="plan" className="mt-0">
          <ClientPlanTab enrollment={enrollment} payments={payments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
