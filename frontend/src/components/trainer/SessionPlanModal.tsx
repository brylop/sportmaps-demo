import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { BlockBuilder } from './BlockBuilder';
import { Loader2, Calendar, ClipboardCheck, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface SessionPlanModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientType: string;
  clientName: string;
  routineId?: string;
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export function SessionPlanModal({ 
  open, onClose, clientId, clientType, clientName, routineId: initialRoutineId, onSave, isLoading 
}: SessionPlanModalProps) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [activeTab, setActiveTab] = useState<'template' | 'scratch'>('template');
  const [routines, setRoutines] = useState<any[]>([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(initialRoutineId || '');

  const todayCO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  const [scratchData, setScratchData] = useState({
    name: '',
    session_date: todayCO,
    blocks: [],
    custom_notes: '',
  });

  const [templateDate, setTemplateDate] = useState(todayCO);

  useEffect(() => {
    if (open && activeTab === 'template') {
      fetchRoutines();
    }
  }, [open, activeTab]);

  useEffect(() => {
    if (initialRoutineId) setSelectedRoutineId(initialRoutineId);
  }, [initialRoutineId]);

  const fetchRoutines = async () => {
    setLoadingRoutines(true);
    try {
      const res = await fetch(`${BFF_URL}/api/v1/trainer/routines`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRoutines(data || []);
    } catch (err) {
      console.error('Error fetching routines:', err);
    } finally {
      setLoadingRoutines(false);
    }
  };

  const handleConfirm = async () => {
    if (activeTab === 'template') {
      if (!selectedRoutineId) return;
      await onSave({
        type: 'from_template',
        routine_id: selectedRoutineId,
        client_id: clientId,
        client_type: clientType,
        session_date: templateDate
      });
    } else {
      if (!scratchData.name || scratchData.blocks.length === 0) return;
      await onSave({
        type: 'from_scratch',
        ...scratchData,
        client_id: clientId,
        client_type: clientType
      });
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-primary/20">
        <DialogHeader className="p-6 border-b shrink-0 bg-primary/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Planificar Sesión</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Asignar entrenamiento para <span className="text-foreground font-black">{clientName}</span></p>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 border-b bg-muted/20 shrink-0">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="template" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Desde Biblioteca
              </TabsTrigger>
              <TabsTrigger value="scratch" className="gap-2">
                <Plus className="h-4 w-4" />
                Plan desde cero
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <TabsContent value="template" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase tracking-wider">1. Seleccionar Fecha</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="max-w-[220px] justify-start text-left font-normal">
                        {format(new Date(templateDate + 'T12:00:00'), 'PPP', { locale: es })}
                        <Calendar className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={new Date(templateDate + 'T12:00:00')}
                        onSelect={(date) => { if (date) setTemplateDate(format(date, 'yyyy-MM-dd')); }}
                        locale={es}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {templateDate > todayCO && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 max-w-sm">
                      <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <p className="text-[11px] text-amber-700 font-medium">
                        Esta rutina será visible para {clientName.split(' ')[0]} a partir del{' '}
                        <span className="font-black">
                          {new Date(templateDate + 'T12:00:00').toLocaleDateString('es-CO', {
                            weekday: 'short', day: 'numeric', month: 'short'
                          })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase tracking-wider">2. Elegir Rutina de la Biblioteca</Label>
                  {loadingRoutines ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : routines.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                      <p className="text-sm text-muted-foreground">Aún no tienes rutinas creadas.</p>
                      <Button variant="link" className="text-primary">Crear mi primera rutina</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {routines.map(routine => (
                        <Card 
                          key={routine.id}
                          className={`cursor-pointer transition-all border-2 ${selectedRoutineId === routine.id ? 'border-primary bg-primary/5 shadow-md' : 'hover:border-primary/50'}`}
                          onClick={() => setSelectedRoutineId(routine.id)}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-accent`}>
                                <ClipboardCheck className={`h-4 w-4 ${selectedRoutineId === routine.id ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>
                              <div>
                                <p className="text-sm font-bold">{routine.name}</p>
                                <div className="flex gap-2 items-center mt-1">
                                  <Badge variant="outline" className="text-[9px] py-0">{routine.category}</Badge>
                                  <span className="text-[10px] text-muted-foreground">{routine.estimated_minutes} min</span>
                                </div>
                              </div>
                            </div>
                            {selectedRoutineId === routine.id && (
                              <div className="h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="scratch" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Nombre del Plan</Label>
                    <Input 
                      placeholder="Ej: Sesión Express Pierna" 
                      value={scratchData.name}
                      onChange={(e) => setScratchData({ ...scratchData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider">Fecha de Sesión</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {format(new Date(scratchData.session_date + 'T12:00:00'), 'PPP', { locale: es })}
                          <Calendar className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={new Date(scratchData.session_date + 'T12:00:00')}
                          onSelect={(date) => { if (date) setScratchData({ ...scratchData, session_date: format(date, 'yyyy-MM-dd') }); }}
                          locale={es}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {scratchData.session_date > todayCO && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Calendar className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <p className="text-[11px] text-amber-700 font-medium">
                          Esta rutina será visible para {clientName.split(' ')[0]} a partir del{' '}
                          <span className="font-black">
                            {new Date(scratchData.session_date + 'T12:00:00').toLocaleDateString('es-CO', {
                              weekday: 'short', day: 'numeric', month: 'short'
                            })}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">Ejercicios de la Sesión</Label>
                  <BlockBuilder 
                    blocks={scratchData.blocks} 
                    onChange={(blocks) => setScratchData({ ...scratchData, blocks })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider">Notas Personalizadas</Label>
                  <Textarea 
                    placeholder="Instrucciones específicas para este cliente hoy..." 
                    className="min-h-[80px]"
                    value={scratchData.custom_notes}
                    onChange={(e) => setScratchData({ ...scratchData, custom_notes: e.target.value })}
                  />
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={isLoading} className="font-bold">Cancelar</Button>
            <Button 
              onClick={handleConfirm} 
              disabled={isLoading || (activeTab === 'template' ? !selectedRoutineId : (!scratchData.name || scratchData.blocks.length === 0))}
              className="px-8 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Confirmar Plan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper icons needed but might be missing in some stacks
function CheckCircle2(props: any) {
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
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
