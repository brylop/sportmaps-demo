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
import { useToast } from '@/hooks/use-toast';
import { Calendar, CalendarRange, ClipboardList, Pencil, Plus, Star, Target } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MesocycleFormDialog, type MesocycleFormSubmit } from './MesocycleFormDialog';
import { MesocycleRubricTable } from './MesocycleRubricTable';
import { SessionFormDialog } from './SessionFormDialog';

const DAY_TYPE_OPTIONS = [
  { value: 'entrenamiento', label: 'Entrenamiento' },
  { value: 'descanso', label: 'Descanso' },
  { value: 'partido', label: 'Partido' },
  { value: 'regenerativo', label: 'Regenerativo' },
  { value: 'activacion', label: 'Activación' },
] as const;

/** Divide el rango del mesociclo en EXACTAMENTE 4 semanas — como el Excel
 *  ("Semana 1..4"), no en bloques de 7 días sueltos. Un mes de 30/31 días no
 *  es múltiplo de 7: repartir el resto entre las primeras semanas evita una
 *  5ª semana "suelta" de 1-3 días que el Excel no contempla. Si el rango es
 *  más corto que 4 días, genera menos de 4 semanas en vez de semanas vacías. */
function buildWeeklyMicrocycles(startsOn: string, endsOn: string) {
  const start = new Date(startsOn + 'T00:00:00');
  const end = new Date(endsOn + 'T00:00:00');
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const baseLen = Math.floor(totalDays / 4);
  const remainder = totalDays % 4;

  const weeks: { number: number; starts_on: string; ends_on: string }[] = [];
  let cursor = new Date(start);
  for (let i = 0; i < 4; i++) {
    const len = baseLen + (i < remainder ? 1 : 0);
    if (len <= 0) break;
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + len - 1);
    weeks.push({
      number: i + 1,
      starts_on: cursor.toISOString().slice(0, 10),
      ends_on: weekEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(weekEnd);
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
}

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

/** Índice MD: distancia en días al partido anterior/siguiente dentro de la
 *  MISMA semana. No persiste (D3) — se calcula acá, sobre los días ya
 *  cargados. Un día entre dos partidos devuelve ambas etiquetas. */
function mdLabelsForDay(dayDate: string, allDays: { day_date: string; day_type: string }[]): string[] {
  const matchDates = allDays.filter((d) => d.day_type === 'partido').map((d) => d.day_date);
  if (matchDates.length === 0) return [];
  const target = new Date(dayDate).getTime();
  const labels: string[] = [];
  let closestBefore: number | null = null;
  let closestAfter: number | null = null;
  for (const m of matchDates) {
    const diffDays = Math.round((target - new Date(m).getTime()) / 86400000);
    if (diffDays === 0) return ['MD'];
    if (diffDays > 0 && (closestBefore === null || diffDays < closestBefore)) closestBefore = diffDays;
    if (diffDays < 0 && (closestAfter === null || -diffDays < closestAfter)) closestAfter = -diffDays;
  }
  if (closestBefore !== null) labels.push(`MD+${closestBefore}`);
  if (closestAfter !== null) labels.push(`MD-${closestAfter}`);
  return labels;
}

interface MesocycleSectionProps {
  teamId: string;
  schoolId: string;
  roster: { id: string; full_name: string; athlete_type?: string }[];
  sessions: any[];
  isFootball?: boolean;
  onEditSession: (session: any) => void;
}

export function MesocycleSection({ teamId, schoolId, roster, sessions, isFootball, onEditSession }: MesocycleSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  // Microciclo cuya semana está agregando un día ahora mismo (formulario inline, un solo día a la vez).
  const [addingDayFor, setAddingDayFor] = useState<string | null>(null);
  const [newDay, setNewDay] = useState({ day_date: '', day_type: 'entrenamiento', planned_rpe: '', planned_minutes: '', focus: '' });
  // Día para el que se está creando la sesión de contenido (SessionFormDialog, sin tocar el componente).
  const [sessionDialogDay, setSessionDialogDay] = useState<any | null>(null);

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

  const sessionsById = useMemo(() => {
    const m = new Map<string, any>();
    sessions.forEach((s) => m.set(s.id, s));
    return m;
  }, [sessions]);

  const createMesocycle = useMutation({
    mutationFn: async (input: MesocycleFormSubmit) => {
      const { data: newMesocycle, error } = await (supabase as any)
        .from('training_mesocycles')
        .insert({ ...input, school_id: schoolId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;

      // Auto-crea las semanas del mesociclo (D9/D10) — sin esto el coach
      // crea el contenedor y no tiene dónde cargar ninguna sesión.
      const weeks = buildWeeklyMicrocycles(input.starts_on, input.ends_on);
      const { error: weeksError } = await (supabase as any).from('training_microcycles').insert(
        weeks.map((w) => ({
          school_id: schoolId,
          team_id: teamId,
          mesocycle_id: newMesocycle.id,
          number: w.number,
          starts_on: w.starts_on,
          ends_on: w.ends_on,
          created_by: user?.id,
        })),
      );
      if (weeksError) throw weeksError;

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

  // Crea la sesión de contenido (objetivos/bloques/principios de juego, CAR-8)
  // para un día ya cargado, y liga session_id de vuelta al día. Reusa
  // SessionFormDialog tal cual está, sin modificarlo.
  const createSessionForDay = useMutation({
    mutationFn: async (data: any) => {
      const { data: session, error } = await (supabase as any)
        .from('training_sessions')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      const { error: linkError } = await (supabase as any)
        .from('training_microcycle_days')
        .update({ session_id: session.id })
        .eq('id', sessionDialogDay.id);
      if (linkError) throw linkError;
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

  const updateClosingReview = useMutation({
    mutationFn: async (closing_review: any) => {
      const { error } = await (supabase as any).from('training_mesocycles').update({ closing_review }).eq('id', mesocycle.id);
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
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setFormOpen(true)}>
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Button>
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
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="space-y-1.5">
                    {mcDays.map((day: any) => {
                      const session = day.session_id ? sessionsById.get(day.session_id) : null;
                      const mdLabels = mdLabelsForDay(day.day_date, mcDays);
                      return (
                        <div
                          key={day.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded-md border text-sm ${session ? 'cursor-pointer hover:bg-accent/40' : ''}`}
                          onClick={() => session && onEditSession(session)}
                        >
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
                            <span className="truncate text-muted-foreground">
                              {session?.objectives || day.focus || ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {day.planned_rpe != null && (
                              <span className="text-xs text-muted-foreground">RPE {day.planned_rpe}</span>
                            )}
                            {!session && day.day_type !== 'descanso' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] gap-1"
                                onClick={(e) => { e.stopPropagation(); setSessionDialogDay(day); }}
                              >
                                <ClipboardList className="w-3 h-3" />
                                Crear sesión
                              </Button>
                            )}
                          </div>
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
                      <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setAddingDayFor(mc.id)}>
                        <Plus className="w-3.5 h-3.5" />
                        Agregar día
                      </Button>
                    )}
                  </div>

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
                onBlur={(e) => updateClosingReview.mutate({ ...closing, strengths: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aspectos a mejorar</Label>
              <Textarea
                rows={2}
                defaultValue={closing.areas_to_improve || ''}
                onBlur={(e) => updateClosingReview.mutate({ ...closing, areas_to_improve: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notas para el próximo mesociclo</Label>
            <Textarea
              rows={2}
              defaultValue={closing.next_cycle_notes || ''}
              onBlur={(e) => updateClosingReview.mutate({ ...closing, next_cycle_notes: e.target.value })}
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

      {sessionDialogDay && (
        <SessionFormDialog
          open={!!sessionDialogDay}
          onOpenChange={(open) => { if (!open) setSessionDialogDay(null); }}
          onSubmit={(data) => createSessionForDay.mutate({ ...data, team_id: teamId, session_date: sessionDialogDay.day_date })}
          teamId={teamId}
          isFootball={isFootball}
          isLoading={createSessionForDay.isPending}
          session={{ session_date: sessionDialogDay.day_date }}
        />
      )}
    </div>
  );
}
