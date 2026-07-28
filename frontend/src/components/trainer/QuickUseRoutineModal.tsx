import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, User, Calendar as CalendarIcon, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolContext } from '@/hooks/useSchoolContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const BFF_URL = import.meta.env.VITE_BFF_URL || 'http://localhost:3000';

interface QuickUseRoutineModalProps {
  open: boolean;
  onClose: () => void;
  routineId: string;
  routineName: string;
  onSuccess?: () => void;
  /**
   * 'trainer' (default): asigna vía /api/v1/trainer/routines/:id/use, lista clientes PT.
   * 'school': asigna vía /api/v1/school/routines/:id/use, lista atletas del gimnasio (school_athletes).
   */
  useEndpoint?: 'trainer' | 'school';
}

// Forma normalizada de cliente/atleta usada por la UI, sin importar el origen
interface NormalizedClient {
  athleteId: string;
  clientType: string;
  enrollmentId: string | null;
  fullName: string;
  avatarUrl?: string | null;
}

export function QuickUseRoutineModal({
  open, onClose, routineId, routineName, onSuccess, useEndpoint = 'trainer',
}: QuickUseRoutineModalProps) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { schoolId } = useSchoolContext();
  const { toast } = useToast();

  const [clients, setClients] = useState<NormalizedClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<NormalizedClient | null>(null);
  const [sessionDate, setSessionDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && token) {
      fetchClients();
    }
  }, [open, token, useEndpoint]);

  const fetchClients = async () => {
    setLoadingClients(true);
    try {
      if (useEndpoint === 'school') {
        if (!schoolId) { setClients([]); return; }
        const { data, error } = await supabase
          .from('school_athletes')
          .select('id, full_name, avatar_url, enrollment_id, athlete_type, is_active')
          .eq('school_id', schoolId)
          .eq('is_active', true);
        if (error) throw error;
        setClients(
          (data || []).map((a: any) => ({
            athleteId:    a.id,
            clientType:   a.athlete_type === 'unregistered' ? 'unregistered' : (a.athlete_type === 'child' ? 'child' : 'registered'),
            // school_athletes solo expone enrollment_id para inscripciones por equipo (team_id);
            // en inscripciones por plan (el caso normal en gimnasios) queda null aquí a propósito —
            // fn_create_plan_from_routine auto-resuelve el enrollment_id correcto en ese caso.
            enrollmentId: a.enrollment_id ?? null,
            fullName:     a.full_name,
            avatarUrl:    a.avatar_url,
          }))
        );
      } else {
        const res = await fetch(`${BFF_URL}/api/v1/trainer/clients`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setClients(
          (Array.isArray(data) ? data : []).map((c: any) => ({
            athleteId:    c.athleteId,
            clientType:   c.clientType,
            enrollmentId: c.enrollment_id,
            fullName:     c.profile?.full_name || c.child?.full_name || 'Sin nombre',
            avatarUrl:    c.profile?.avatar_url || c.child?.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedClient) return;

    setIsSubmitting(true);
    try {
      const baseUrl = useEndpoint === 'school'
        ? `${BFF_URL}/api/v1/school/routines/${routineId}/use`
        : `${BFF_URL}/api/v1/trainer/routines/${routineId}/use`;

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: selectedClient.athleteId,
          client_type: selectedClient.clientType,
          session_date: sessionDate,
          enrollment_id: selectedClient.enrollmentId,
        })
      });

      if (!res.ok) throw new Error('Error al asignar');

      toast({ title: '✅ Rutina asignada con éxito' });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo asignar la rutina.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl border-primary/20 bg-background flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Usar Rutina Ahora</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 font-medium">Asignar <span className="text-foreground font-black tracking-tight">{routineName}</span> a un atleta</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
          {!selectedClient ? (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Paso 1: Selecciona el Atleta</Label>
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar atleta..." 
                  className="pl-9 bg-accent/20 border-border/40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {loadingClients ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center py-10 italic text-xs text-muted-foreground">No se encontraron atletas activos con inscripción.</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredClients.map((client) => (
                        <button
                          key={client.athleteId}
                          onClick={() => setSelectedClient(client)}
                          className="w-full flex items-center gap-4 p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all text-left group"
                        >
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                            <AvatarImage src={client.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                              {client.fullName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{client.fullName}</p>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-60">
                              {client.clientType === 'child' ? 'Menor' : client.clientType === 'unregistered' ? 'Invitado' : 'Adulto'}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                    <AvatarImage src={selectedClient.avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {selectedClient.fullName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-primary tracking-widest leading-none mb-1">Atleta Seleccionado</p>
                    <p className="font-black text-lg leading-tight">{selectedClient.fullName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)} className="text-[10px] uppercase font-bold hover:bg-primary/10">Cambiar</Button>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-3 w-3" /> Paso 2: Elige la Fecha de la Sesión
                </Label>
                <Input 
                  type="date" 
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="h-12 text-lg font-black bg-accent/20 border-border/40"
                />
              </div>

              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex gap-3 italic">
                <CheckCircle2 className="h-5 w-5 text-orange-600 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Esta rutina se copiará como un plan de sesión individual para el atleta. Podrás modificarla después.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <div className="flex justify-between w-full">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="font-bold">Cancelar</Button>
            {selectedClient && (
              <Button 
                onClick={handleConfirm} 
                className="px-8 bg-primary hover:bg-primary/90 font-black shadow-lg shadow-primary/20 gap-2 h-11"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar Asignación
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
