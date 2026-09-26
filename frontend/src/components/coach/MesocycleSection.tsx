import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Calendar, CalendarRange, ClipboardList, Copy, Pencil, Plus, Star, Target, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MesocycleFormDialog, type MesocycleFormSubmit } from './MesocycleFormDialog';
import { MesocycleRubricTable } from './MesocycleRubricTable';
import { SessionFormDialog } from './SessionFormDialog';
import { WeeklyLoadPanel } from './WeeklyLoadPanel';
import { StandaloneMicrocyclesPanel } from './StandaloneMicrocyclesPanel';
import { MesocycleExportButton } from './MesocycleExportButton';

const DAY_TYPE_OPTIONS = [
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'partido', label: 'Partido' },
  { value: 'regenerativo', label: 'Regenerativo' },
  { value: 'activacion', label: 'Activación' },
] as const;

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

interface MesocycleSectionProps {
  teamId: string;
  schoolId: string;
  roster: { id: string; full_name: string; athlete_type?: string }[];
  sessions: any[];
  isFootball?: boolean;
  /** Solo para el título del tablero táctico dentro del SessionFormDialog de un día. */
  teamName?: string;
  onEditSession: (session: any) => void;
}

export function MesocycleSection({ teamId, schoolId, roster, sessions, isFootball, teamName, onEditSession }: MesocycleSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  // Microciclo cuya semana está agregando un día ahora mismo (formulario inline, un solo día a la vez).
  const [addingDayFor, setAddingDayFor] = useState<string | null>(null);
  const [newDay, setNewDay] = useState({ day_date: '', day_type: 'entrenamiento', planned_rpe: '', planned_minutes: '', focus: '' });
  // Día para el que se está creando la sesión de contenido (SessionFormDialog, sin tocar el componente).
  const [sessionDialogDay, setSessionDialogDay] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Objeto ESTABLE para el prop `session` de SessionFormDialog: si en vez de esto
  // se arma un literal `{ session_date: ... }` inline en el JSX, cambia de
  // referencia en CADA render de MesocycleSection (no solo cuando cambia el día
  // elegido). SessionFormDialog resetea blocks/drills/evaluation en un
  // useEffect con `session` en las dependencias -- con una referencia nueva en
  // cada render, cualquier re-render incidental de este componente (ej. un
  // refetch de fondo de las queries del mesociclo) vuelve a disparar ESE
  // efecto y borra el `id` que openBlockTacticalBoard le acababa de generar al
  // bloque, justo en la ventana de un tick antes de que el setTimeout abra el
  // tablero -- el guard `blocks[tacticalBlockIndex]?.id` de TacticalBoard da
  // false, el tablero nunca llega a montar, y tacticalBlockIndex queda
  // trabado en un índice no-null para siempre (nunca se llama a su onClose):
  // el diálogo de sesión de ESE día queda oculto de por vida (open = open &&
  // tacticalBlockIndex === null), y como sessionDialogDay nunca vuelve a
  // null, es la MISMA instancia de SessionFormDialog la que se reutiliza para
  // cualquier otro día -- "Crear sesión" deja de abrir nada, para cualquier
  // día, hasta recargar la página. Memoizado por día, esta referencia solo
  // cambia cuando el coach realmente abre un día distinto.
  const sessionDialogSession = useMemo(
    () => (sessionDialogDay ? { session_date: sessionDialogDay.day_date } : undefined),
    [sessionDialogDay],
  );

  const { data: mesocycle, isLoading: loadingMesocycle } = useQuery({
    queryKey: ['mesocycle-current', teamId],
    queryFn: async () => {
      // El más reciente del equipo, sin exigir que "hoy" caiga dentro del
      // rango — un mesociclo recién creado (o uno futuro, planeado con
      // anticipación) tiene que aparecer igual, no solo el que está "activo
      // hoy" en el calendario.
      const { data, error } = await (supabase as any)
        .from('training_mesocycles')
        .select('*')
        .eq('team_id', teamId)
        .order('starts_on', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!teamId,
  });

  const { data: microcycles } = useQuery({
    queryKey: ['microcycles', mesocycle?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('training_microcycles')
        .select('*')
        .eq('mesocycle_id', mesocycle.id)
        .order('starts_on', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!mesocycle?.id,
  });

  const { data: days } = useQuery({
    queryKey: ['microcycle-days', mesocycle?.id],
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

  // Índice MD: distancia en días al partido anterior/siguiente del EQUIPO,
  // sin importar en qué microciclo esté cargado ese partido (H1 — antes se
  // calculaba solo contra los partidos de la misma semana, y un lunes no
  // veía el partido del domingo si vivía en el microciclo anterior).
  // training_days_md_labels() lo resuelve en la base contra todo el
  // historial del equipo, RPC 20260921115743.
  const { data: mdLabelsByDate } = useQuery({
    queryKey: ['md-labels', teamId, (days || []).map((d: any) => d.day_date).join(',')],
    queryFn: async () => {
      const dayDates = (days || []).map((d: any) => d.day_date);
      const { data, error } = await (supabase as any).rpc('training_days_md_labels', {
        p_team_id: teamId,
        p_day_dates: dayDates,
      });
      if (error) throw error;
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => { map[r.day_date] = r.md_labels || []; });
      return map;
    },
    enabled: !!days && days.length > 0,
  });

  // Por día, no por id de sesión (§8.2 corregido: un día admite cualquier
  // cantidad de sesiones — gimnasio AM + cancha PM es un caso normal — así
  // que el enganche vive en training_sessions.microcycle_day_id, no al revés).
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

  const createMesocycle = useMutation({
    mutationFn: async (input: MesocycleFormSubmit) => {
      // RPC transaccional (mesociclo + sus 4 semanas en la MISMA transacción
      // de la función) — antes eran dos inserts sueltos desde el cliente: si
      // el segundo (las semanas) chocaba con UNIQUE(team_id, starts_on) por
      // reintentar sobre el mismo equipo/fechas, el mesociclo quedaba
      // igual commiteado, sin semanas y sin forma de agregar sesiones.
      const { data: newMesocycle, error } = await (supabase as any).rpc('create_mesocycle_with_weeks', {
        p_school_id: schoolId,
        p_team_id: teamId,
        p_starts_on: input.starts_on,
        p_ends_on: input.ends_on,
        p_general_objective: input.general_objective ?? null,
        p_game_model: input.game_model ?? null,
        p_n_sessions_planned: input.n_sessions_planned ?? null,
        p_session_duration_minutes: input.session_duration_minutes ?? null,
        p_evaluation_mode: input.evaluation_mode ?? 'team',
      });
      if (error) throw error;

      return newMesocycle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-current', teamId] });
      toast({ title: '✅ Mesociclo creado', description: 'Semanas generadas automáticamente.' });
      setFormOpen(false);
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMesocycle = useMutation({
    mutationFn: async (input: MesocycleFormSubmit) => {
      const { error } = await (supabase as any)
        .from('training_mesocycles')
        .update(input)
        .eq('id', mesocycle.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-current', teamId] });
      toast({ title: '✅ Mesociclo actualizado' });
      setFormOpen(false);
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  // Antes no existía forma de borrar un mesociclo mal creado desde la UI —
  // el único recurso del coach era crear uno nuevo, y eso fue lo que disparó
  // el bug de mesociclos fantasma sin semanas (20260918124721). RPC en vez
  // de un DELETE directo: training_microcycles.mesocycle_id es
  // ON DELETE SET NULL (D10, a propósito), así que un DELETE simple sobre
  // training_mesocycles deja las semanas huérfanas SIN borrar, todavía
  // ocupando UNIQUE(team_id, starts_on) — no resolvía el problema que lo
  // motivó. delete_mesocycle_cascade() (20260921120611) borra semanas y
  // mesociclo en la misma transacción. Las sesiones de contenido
  // (training_sessions) NO se borran, solo pierden el enganche al día.
  const deleteMesocycle = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc('delete_mesocycle_cascade', { p_mesocycle_id: mesocycle.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-current', teamId] });
      toast({ title: 'Mesociclo eliminado' });
      setConfirmDelete(false);
    },
    onError: (error: any) => toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' }),
  });

  const createDay = useMutation({
    mutationFn: async ({ microcycleId, day }: { microcycleId: string; day: typeof newDay }) => {
      const { error } = await (supabase as any).from('training_microcycle_days').insert({
        school_id: schoolId,
        microcycle_id: microcycleId,
        day_date: day.day_date,
        day_type: day.day_type,
        planned_rpe: day.planned_rpe ? Number(day.planned_rpe) : null,
        planned_minutes: day.planned_minutes ? Number(day.planned_minutes) : null,
        focus: day.focus || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microcycle-days', mesocycle?.id] });
      setAddingDayFor(null);
      setNewDay({ day_date: '', day_type: 'entrenamiento', planned_rpe: '', planned_minutes: '', focus: '' });
    },
    onError: (error: any) => toast({ title: 'Error al agregar el día', description: error.message, variant: 'destructive' }),
  });

  // PER-4 (spec §4 F4): duplicar la semana anterior como punto de partida
  // editable, no un catálogo cerrado — copia día/tipo/RPE/minutos/foco, NUNCA
  // sesiones de contenido (esas las escribe el coach de cero para la semana
  // nueva). No pisa un día que el coach ya haya cargado a mano en destino
  // (ON CONFLICT DO NOTHING del lado de la RPC).
  const duplicatePreviousWeek = useMutation({
    mutationFn: async ({ sourceMicrocycleId, targetMicrocycleId }: { sourceMicrocycleId: string; targetMicrocycleId: string }) => {
      const { data, error } = await (supabase as any).rpc('duplicate_microcycle_days', {
        p_source_microcycle_id: sourceMicrocycleId,
        p_target_microcycle_id: targetMicrocycleId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (copiedCount) => {
      queryClient.invalidateQueries({ queryKey: ['microcycle-days', mesocycle?.id] });
      toast({
        title: copiedCount > 0 ? `✅ ${copiedCount} día(s) copiados` : 'Sin días para copiar',
        description: copiedCount > 0 ? 'Editalos como punto de partida para esta semana.' : 'La semana anterior no tenía días cargados.',
      });
    },
    onError: (error: any) => toast({ title: 'Error al duplicar la semana', description: error.message, variant: 'destructive' }),
  });

  // Crea la sesión de contenido (objetivos/bloques/principios de juego, CAR-8)
  // ya enganchada al día — un solo INSERT, sin el segundo UPDATE que antes
  // enganchaba de vuelta desde training_microcycle_days.session_id (§8.2:
  // esa segunda escritura sin transacción era la causa raíz de las sesiones
  // huérfanas del 18-sep). Reusa SessionFormDialog tal cual, sin modificarlo.
  const createSessionForDay = useMutation({
    mutationFn: async ({ dayId, ...data }: { dayId: string; [key: string]: any }) => {
      const targetDayId = dayId || sessionDialogDay?.id;
      if (!targetDayId) {
        throw new Error('No se pudo identificar el día del mesociclo para esta sesión. Cerrá el formulario y volvé a intentar desde "Crear sesión".');
      }
      // school_id es NOT NULL con RLS que lo exige (deriva sin versionar
      // encontrada y documentada el 25-sep, migración 20260925135425).
      const { data: session, error } = await (supabase as any)
        .from('training_sessions')
        .insert({ ...data, microcycle_day_id: targetDayId, school_id: schoolId })
        .select()
        .single();
      if (error) throw error;
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microcycle-days', mesocycle?.id] });
      queryClient.invalidateQueries({ queryKey: ['training-sessions', teamId] });
      toast({ title: '✅ Sesión creada y ligada al día' });
      setSessionDialogDay(null);
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  const updateMicrocycleClosing = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; objective_compliance?: string; collective_performance?: string; improvement_notes?: string }) => {
      const { error } = await (supabase as any).from('training_microcycles').update(fields).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['microcycles', mesocycle?.id] }),
    onError: (error: any) => toast({ title: 'Error al guardar el cierre semanal', description: error.message, variant: 'destructive' }),
  });

  // RPC (merge_mesocycle_closing_review, 20260923215537) en vez de mandar el
  // objeto `closing` completo mergeado en el cliente: closing_review es UNA
  // sola columna jsonb para las 3 cajas de texto (Fortalezas/A mejorar/
  // Notas), y `closing` se capturaba por closure al renderizar -- si el
  // coach llenaba dos campos seguido (tabular de un textarea al siguiente),
  // el segundo guardado podía salir antes de que el primero terminara su
  // ida-vuelta + refetch, pisando el valor recién guardado con el viejo. El
  // merge ahora pasa en la base (closing_review || patch), así cada blur
  // solo manda SU campo, sin depender de conocer el resto.
  const updateClosingReview = useMutation({
    mutationFn: async (patch: Record<string, string>) => {
      const { error } = await (supabase as any).rpc('merge_mesocycle_closing_review', {
        p_mesocycle_id: mesocycle.id,
        p_patch: patch,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-current', teamId] });
      toast({ title: '✅ Cierre del mesociclo guardado' });
    },
    onError: (error: any) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  });

  if (loadingMesocycle) return null;

  if (!mesocycle) {
    return (
      <>
        {/* D10: un equipo puede tener semanas sueltas sin haber creado nunca
            el mesociclo que las agrupe — antes no tenían ninguna vista. */}
        <StandaloneMicrocyclesPanel
          teamId={teamId}
          schoolId={schoolId}
          sessions={sessions}
          isFootball={isFootball}
          onEditSession={onEditSession}
        />
        <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
          <CardContent className="pt-6 text-center">
            <CalendarRange className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="text-lg font-semibold mb-2">Sin mesociclo activo</h3>
            <p className="text-muted-foreground mb-4">
              Planifica el mes — período, objetivo y modelo de juego — antes de cargar sesiones sueltas.
            </p>
            <Button className="gap-2" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4" />
              Crear Mesociclo
            </Button>
          </CardContent>
        </Card>
        <MesocycleFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={(data) => createMesocycle.mutate(data)}
          teamId={teamId}
          isLoading={createMesocycle.isPending}
        />
      </>
    );
  }

  const closing = mesocycle.closing_review || {};

  return (
    <div className="space-y-4">
      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-primary" />
                Mesociclo — {new Date(mesocycle.starts_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                {' → '}
                {new Date(mesocycle.ends_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              </CardTitle>
              {mesocycle.general_objective && (
                <CardDescription className="mt-1 flex items-start gap-1.5">
                  <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {mesocycle.general_objective}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <MesocycleExportButton mesocycleId={mesocycle.id} mesocycle={mesocycle} teamName={teamName || 'Equipo'} />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        </CardHeader>
        {mesocycle.game_model && (
          <CardContent className="pt-0">
            <Badge variant="secondary" className="mb-1.5">Modelo de juego</Badge>
            <p className="text-sm text-muted-foreground">{mesocycle.game_model}</p>
          </CardContent>
        )}
      </Card>

      {microcycles && microcycles.length > 0 && (
        <Accordion type="multiple" defaultValue={[microcycles[0]?.id]} className="rounded-lg border bg-background/50">
          {microcycles.map((mc: any, idx: number) => {
            const mcDays = (days || []).filter((d: any) => d.microcycle_id === mc.id);
            // Adherencia (spec §3.3): días de entrenamiento con al menos una
            // sesión que registró RPE, sobre el total de días de
            // entrenamiento de la semana. Es la única métrica que dice si el
            // módulo se está usando o quedó vacío (R1) — nunca se mostraba
            // en ningún lado.
            const trainingDays = mcDays.filter((d: any) => d.day_type === 'entrenamiento');
            const daysWithRpe = trainingDays.filter((d: any) =>
              (sessionsByDayId.get(d.id) || []).some((s: any) => s.evaluation?.rpe != null),
            );
            return (
              <AccordionItem key={mc.id} value={mc.id} className="px-3">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">Semana {idx + 1}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {new Date(mc.starts_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(mc.ends_on).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                    {trainingDays.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                        Adherencia {daysWithRpe.length}/{trainingDays.length}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="space-y-1.5">
                    {mcDays.map((day: any) => {
                      // Un día admite cualquier cantidad de sesiones (§8.2 —
                      // ej. gimnasio AM + cancha PM), no una sola.
                      const daySessions = sessionsByDayId.get(day.id) || [];
                      const mdLabels = mdLabelsByDate?.[day.day_date] || [];
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
                              {mdLabels.map((l) => (
                                <Badge key={l} variant="outline" className="text-[10px] h-5 shrink-0">
                                  {l}
                                </Badge>
                              ))}
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

                    {addingDayFor === mc.id ? (
                      <div className="flex flex-wrap items-end gap-2 p-2 rounded-md border bg-muted/30">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Fecha</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className={`h-8 w-36 justify-start text-left font-normal text-xs bg-background border-input ${!newDay.day_date ? 'text-muted-foreground' : ''}`}
                              >
                                <Calendar className="mr-1.5 h-3.5 w-3.5 opacity-75 shrink-0" />
                                {newDay.day_date ? format(new Date(newDay.day_date + 'T12:00:00'), 'd MMM', { locale: es }) : <span>Elegir</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={newDay.day_date ? new Date(newDay.day_date + 'T12:00:00') : undefined}
                                onSelect={(date) => date && setNewDay({ ...newDay, day_date: format(date, 'yyyy-MM-dd') })}
                                locale={es}
                                initialFocus
                                fromDate={new Date(mc.starts_on + 'T00:00:00')}
                                toDate={new Date(mc.ends_on + 'T00:00:00')}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Tipo</Label>
                          <Select value={newDay.day_type} onValueChange={(v) => setNewDay({ ...newDay, day_type: v })}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DAY_TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Intensidad (0-10)</Label>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            className="h-8 w-24"
                            value={newDay.planned_rpe}
                            onChange={(e) => setNewDay({ ...newDay, planned_rpe: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Duración (min)</Label>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-24"
                            value={newDay.planned_minutes}
                            onChange={(e) => setNewDay({ ...newDay, planned_minutes: e.target.value })}
                          />
                        </div>
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!newDay.day_date || createDay.isPending}
                          onClick={() => createDay.mutate({ microcycleId: mc.id, day: newDay })}
                        >
                          Guardar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddingDayFor(null)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setAddingDayFor(mc.id)}>
                          <Plus className="w-3.5 h-3.5" />
                          Agregar día
                        </Button>
                        {idx > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            disabled={duplicatePreviousWeek.isPending}
                            onClick={() => duplicatePreviousWeek.mutate({ sourceMicrocycleId: microcycles[idx - 1].id, targetMicrocycleId: mc.id })}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicar semana anterior
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <WeeklyLoadPanel microcycleId={mc.id} />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t">
                    <div className="space-y-1">
                      <Label className="text-xs">Cumplimiento de objetivos</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        defaultValue={mc.objective_compliance || ''}
                        onBlur={(e) => updateMicrocycleClosing.mutate({ id: mc.id, objective_compliance: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rendimiento colectivo</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        defaultValue={mc.collective_performance || ''}
                        onBlur={(e) => updateMicrocycleClosing.mutate({ id: mc.id, collective_performance: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Aspectos a mejorar</Label>
                      <Textarea
                        rows={2}
                        className="text-xs"
                        defaultValue={mc.improvement_notes || ''}
                        onBlur={(e) => updateMicrocycleClosing.mutate({ id: mc.id, improvement_notes: e.target.value })}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            Cierre del Mesociclo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fortalezas</Label>
              <Textarea
                rows={2}
                defaultValue={closing.strengths || ''}
                onBlur={(e) => updateClosingReview.mutate({ strengths: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aspectos a mejorar</Label>
              <Textarea
                rows={2}
                defaultValue={closing.areas_to_improve || ''}
                onBlur={(e) => updateClosingReview.mutate({ areas_to_improve: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas para el próximo mesociclo</Label>
            <Textarea
              rows={2}
              defaultValue={closing.next_cycle_notes || ''}
              onBlur={(e) => updateClosingReview.mutate({ next_cycle_notes: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <MesocycleRubricTable
        mesocycleId={mesocycle.id}
        schoolId={schoolId}
        evaluationMode={mesocycle.evaluation_mode}
        roster={roster}
      />

      <MesocycleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => (mesocycle ? updateMesocycle.mutate(data) : createMesocycle.mutate(data))}
        teamId={teamId}
        isLoading={createMesocycle.isPending || updateMesocycle.isPending}
        mesocycle={mesocycle}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este mesociclo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran sus semanas, días y la rúbrica de evaluación. Las sesiones de contenido ya
              creadas NO se eliminan, solo pierden el enganche al día. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMesocycle.isPending}
              onClick={() => deleteMesocycle.mutate()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sessionDialogDay && (
        <SessionFormDialog
          open={!!sessionDialogDay}
          onOpenChange={(open) => { if (!open) setSessionDialogDay(null); }}
          onSubmit={(data) => createSessionForDay.mutate({ ...data, team_id: teamId, session_date: sessionDialogDay.day_date, dayId: sessionDialogDay.id })}
          teamId={teamId}
          teamName={teamName}
          isFootball={isFootball}
          isLoading={createSessionForDay.isPending}
          session={sessionDialogSession}
        />
      )}
    </div>
  );
}
