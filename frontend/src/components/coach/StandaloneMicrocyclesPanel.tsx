import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { CalendarRange, ClipboardList } from 'lucide-react';
import { SessionFormDialog } from './SessionFormDialog';

const DAY_TYPE_LABEL: Record<string, string> = {
  descanso: 'Descanso',
  entrenamiento: 'Entrenamiento',
  partido: 'Partido',
  regenerativo: 'Regenerativo',
  activacion: 'Activación',
};

const DAY_TYPE_BADGE: Record<string, string> = {
  descanso: 'bg-muted text-muted-foreground border-muted-foreground/20',
  entrenamiento: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25',
  partido: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
  regenerativo: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25',
  activacion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
};

interface StandaloneMicrocyclesPanelProps {
  teamId: string;
  schoolId: string;
  sessions: any[];
  isFootball?: boolean;
  onEditSession: (session: any) => void;
}

/** Cubre el hueco de D10 (docs/specs/periodizacion-microciclos-y-carga.md §8.8):
 *  training_microcycles.mesocycle_id es NULLABLE a propósito -- un equipo
 *  puede tener semanas sueltas, sin haber creado nunca el mesociclo (el mes)
 *  que las contenga. MesocycleSection solo agrupa las semanas que SÍ cuelgan
 *  de un mesociclo; este panel es la vista para las que no. */
export function StandaloneMicrocyclesPanel({ teamId, schoolId, sessions, isFootball, onEditSession }: StandaloneMicrocyclesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sessionDialogDay, setSessionDialogDay] = useState<any | null>(null);

  const { data: microcycles } = useQuery({
    queryKey: ['standalone-microcycles', teamId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('training_microcycles')
        .select('*')
        .eq('team_id', teamId)
        .is('mesocycle_id', null)
        .order('starts_on', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const { data: days } = useQuery({
    queryKey: ['standalone-microcycle-days', teamId],
    queryFn: async () => {
      const ids = (microcycles || []).map((m: any) => m.id);
      if (ids.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from('training_microcycle_days')
        .select('*')
        .in('microcycle_id', ids)
        .order('day_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!microcycles && microcycles.length > 0,
  });

  // Mismo patrón que MesocycleSection: un día admite cualquier cantidad de
  // sesiones (gimnasio AM + cancha PM es normal), así que el enganche vive
  // en training_sessions.microcycle_day_id, no al revés.
  const sessionsByDayId = useMemo(() => {
    const m = new Map<string, any[]>();
    sessions.forEach((s) => {
      if (!s.microcycle_day_id) return;
      const list = m.get(s.microcycle_day_id) || [];
      list.push(s);
      m.set(s.microcycle_day_id, list);
    });
    return m;
  }, [sessions]);

  // Referencia ESTABLE por día (no un literal inline): SessionFormDialog
  // resetea su estado en un useEffect que depende de `session` por
  // identidad -- una referencia nueva en cada render de este panel
  // reabriría ese efecto de fondo y podría pisar lo que el coach ya cargó.
  const sessionDialogSession = useMemo(
    () => (sessionDialogDay ? { session_date: sessionDialogDay.day_date } : undefined),
    [sessionDialogDay],
  );

  const createSessionForDay = useMutation({
    mutationFn: async ({ dayId, ...data }: { dayId: string; [key: string]: any }) => {
      // school_id es NOT NULL con RLS que lo exige (migración 20260925135425)
      // -- un insert sin esto falla con 403.
      const { data: session, error } = await (supabase as any)
        .from('training_sessions')
        .insert({ ...data, microcycle_day_id: dayId, school_id: schoolId })
        .select()
        .single();
      if (error) throw error;
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standalone-microcycle-days', teamId] });
      queryClient.invalidateQueries({ queryKey: ['training-sessions', teamId] });
      toast({ title: '✅ Sesión creada y ligada al día' });
      setSessionDialogDay(null);
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  if (!microcycles || microcycles.length === 0) return null;

  return (
    <div className="space-y-4">
      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            Semanas sueltas
          </CardTitle>
          <CardDescription>
            Microciclos cargados sin un mesociclo (el mes) que los agrupe.
          </CardDescription>
        </CardHeader>
      </Card>

      <Accordion type="multiple" defaultValue={[microcycles[0]?.id]} className="rounded-lg border bg-background/50">
        {microcycles.map((mc: any) => {
          const mcDays = (days || []).filter((d: any) => d.microcycle_id === mc.id);
          return (
            <AccordionItem key={mc.id} value={mc.id} className="px-3">
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{mc.objective || 'Semana suelta'}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {new Date(mc.starts_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(mc.ends_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-1.5">
                {mcDays.map((day: any) => {
                  const daySessions = sessionsByDayId.get(day.id) || [];
                  return (
                    <div key={day.id} className="rounded-md border overflow-hidden">
                      <div className="flex items-center justify-between gap-2 p-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">
                            {new Date(day.day_date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })}
                          </span>
                          <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${DAY_TYPE_BADGE[day.day_type] || ''}`}>
                            {DAY_TYPE_LABEL[day.day_type] || day.day_type}
                          </Badge>
                          {daySessions.length === 0 && (
                            <span className="truncate text-muted-foreground">{day.focus || ''}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {day.planned_rpe != null && (
                            <span className="text-xs text-muted-foreground">RPE {day.planned_rpe}</span>
                          )}
                          {day.day_type !== 'descanso' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] gap-1"
                              onClick={() => setSessionDialogDay(day)}
                            >
                              <ClipboardList className="w-3 h-3" />
                              {daySessions.length === 0 ? 'Crear sesión' : 'Agregar otra'}
                            </Button>
                          )}
                        </div>
                      </div>
                      {daySessions.map((session: any) => (
                        <div
                          key={session.id}
                          className="flex items-center gap-2 px-2 py-1.5 text-xs border-t bg-muted/20 cursor-pointer hover:bg-accent/40"
                          onClick={() => onEditSession(session)}
                        >
                          <ClipboardList className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate text-muted-foreground">{session.objectives}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {mcDays.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">Sin días cargados en esta semana.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {sessionDialogDay && (
        <SessionFormDialog
          open={!!sessionDialogDay}
          onOpenChange={(open) => { if (!open) setSessionDialogDay(null); }}
          onSubmit={(data) => createSessionForDay.mutate({ ...data, team_id: teamId, session_date: sessionDialogDay.day_date, dayId: sessionDialogDay.id })}
          teamId={teamId}
          isFootball={isFootball}
          isLoading={createSessionForDay.isPending}
          session={sessionDialogSession}
        />
      )}
    </div>
  );
}
