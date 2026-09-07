import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Star } from 'lucide-react';

const INDICATORS = [
  { key: 'tecnica_individual', label: 'Técnica individual' },
  { key: 'toma_decisiones', label: 'Toma de decisiones' },
  { key: 'principios_juego', label: 'Principios de juego' },
  { key: 'condicion_fisica', label: 'Condición física' },
  { key: 'comportamiento_colectivo', label: 'Comportamiento colectivo' },
  { key: 'rendimiento_competitivo', label: 'Rendimiento competitivo' },
] as const;

const CHECKPOINTS = [
  { key: 'inicial', label: 'Inicial' },
  { key: 'semana_2', label: 'Sem. 2' },
  { key: 'semana_3', label: 'Sem. 3' },
  { key: 'semana_4', label: 'Sem. 4' },
  { key: 'final', label: 'Final' },
] as const;

/** metric_key en performance_entries para el modo 'individual' —
 *  prefijadas mesociclo_ para no repetir la colisión de duelos_ganados. */
const METRIC_KEY_BY_INDICATOR: Record<string, string> = {
  tecnica_individual: 'mesociclo_tecnica_individual',
  toma_decisiones: 'mesociclo_toma_decisiones',
  principios_juego: 'mesociclo_principios_juego',
  condicion_fisica: 'mesociclo_condicion_fisica',
  comportamiento_colectivo: 'mesociclo_comportamiento_colectivo',
  rendimiento_competitivo: 'mesociclo_rendimiento_competitivo',
};

interface RosterMember {
  id: string;
  full_name: string;
  athlete_type?: string;
}

interface MesocycleRubricTableProps {
  mesocycleId: string;
  schoolId: string;
  evaluationMode: 'team' | 'individual';
  roster: RosterMember[];
}

function subjectTypeFor(member: RosterMember): 'profile' | 'child' | 'unregistered' {
  if (member.athlete_type === 'adult') return 'profile';
  if (member.athlete_type === 'child') return 'child';
  return 'unregistered';
}

export function MesocycleRubricTable({ mesocycleId, schoolId, evaluationMode, roster }: MesocycleRubricTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(roster[0]?.id ?? '');

  // Modo 'team': training_mesocycle_evaluations (mesocycle_id, indicator, checkpoint).
  const { data: teamScores } = useQuery({
    queryKey: ['mesocycle-evaluations', mesocycleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('training_mesocycle_evaluations')
        .select('indicator, checkpoint, score')
        .eq('mesocycle_id', mesocycleId);
      if (error) throw error;
      return data as { indicator: string; checkpoint: string; score: number }[];
    },
    enabled: evaluationMode === 'team' && !!mesocycleId,
  });

  // Modo 'individual': performance_entries con context_type='evaluation', context_id=mesocycleId.
  const selectedMember = roster.find((m) => m.id === selectedAthleteId) || roster[0];
  const { data: individualScores } = useQuery({
    queryKey: ['mesocycle-individual-evaluations', mesocycleId, selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await (supabase as any)
        .from('performance_entries')
        .select('metric_key, value, notes, recorded_at')
        .eq('context_type', 'evaluation')
        .eq('context_id', mesocycleId)
        .eq('subject_type', subjectTypeFor(selectedMember))
        .eq('subject_id', selectedMember.id)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      return data as { metric_key: string; value: number; notes: string | null; recorded_at: string }[];
    },
    enabled: evaluationMode === 'individual' && !!mesocycleId && !!selectedMember,
  });

  const teamScoreMap = useMemo(() => {
    const m = new Map<string, number>();
    (teamScores || []).forEach((r) => m.set(`${r.indicator}__${r.checkpoint}`, r.score));
    return m;
  }, [teamScores]);

  // Modo individual no tiene 5 columnas de checkpoint: cada guardado es una
  // fila nueva de performance_entries (recorded_at = el corte real), así que
  // el historial completo ya lo muestra "Evolución" (AthleteEvolutionModal,
  // ya construido) leyendo la misma tabla. Acá solo se ve/edita el más reciente.
  const individualScoreMap = useMemo(() => {
    const m = new Map<string, { value: number; notes: string | null }>();
    (individualScores || []).forEach((r) => m.set(r.metric_key, { value: r.value, notes: r.notes }));
    return m;
  }, [individualScores]);

  const saveTeamScore = useMutation({
    mutationFn: async ({ indicator, checkpoint, score }: { indicator: string; checkpoint: string; score: number }) => {
      const { error } = await (supabase as any).from('training_mesocycle_evaluations').upsert(
        {
          school_id: schoolId,
          mesocycle_id: mesocycleId,
          indicator,
          checkpoint,
          score,
          created_by: user?.id,
        },
        { onConflict: 'mesocycle_id,indicator,checkpoint' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-evaluations', mesocycleId] });
    },
    onError: (error: any) => {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    },
  });

  const saveIndividualScore = useMutation({
    mutationFn: async ({ indicator, score }: { indicator: string; score: number }) => {
      if (!selectedMember) return;
      const { error } = await (supabase as any).from('performance_entries').insert({
        school_id: schoolId,
        subject_type: subjectTypeFor(selectedMember),
        subject_id: selectedMember.id,
        metric_key: METRIC_KEY_BY_INDICATOR[indicator],
        value: score,
        context_type: 'evaluation',
        context_id: mesocycleId,
        recorded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mesocycle-individual-evaluations', mesocycleId, selectedMember?.id] });
    },
    onError: (error: any) => {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          Rúbrica del Mesociclo
        </CardTitle>
        <CardDescription>
          {evaluationMode === 'team'
            ? 'Desarrollo del equipo en 6 indicadores, a lo largo de 5 cortes.'
            : 'Desarrollo individual — cada guardado queda en el historial del atleta (botón "Evolución" en el roster).'}
        </CardDescription>
        {evaluationMode === 'individual' && (
          <Select value={selectedAthleteId || selectedMember?.id} onValueChange={setSelectedAthleteId}>
            <SelectTrigger className="w-full sm:w-64 mt-2">
              <SelectValue placeholder="Selecciona un atleta" />
            </SelectTrigger>
            <SelectContent>
              {roster.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {evaluationMode === 'team' ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left p-2 font-medium text-muted-foreground">Indicador</th>
                {CHECKPOINTS.map((cp) => (
                  <th key={cp.key} className="p-2 font-medium text-muted-foreground text-center w-20">
                    {cp.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INDICATORS.map((ind) => (
                <tr key={ind.key} className="border-t">
                  <td className="p-2 font-medium">{ind.label}</td>
                  {CHECKPOINTS.map((cp) => {
                    const key = `${ind.key}__${cp.key}`;
                    return (
                      <td key={cp.key} className="p-1.5 text-center">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          className="h-8 w-16 text-center mx-auto"
                          defaultValue={teamScoreMap.get(key) ?? ''}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 1 && val <= 10) {
                              saveTeamScore.mutate({ indicator: ind.key, checkpoint: cp.key, score: val });
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : selectedMember ? (
          <div className="space-y-2">
            {INDICATORS.map((ind) => {
              const metricKey = METRIC_KEY_BY_INDICATOR[ind.key];
              const current = individualScoreMap.get(metricKey);
              return (
                <div key={ind.key} className="flex items-center justify-between gap-3 p-2 rounded-lg border bg-muted/30">
                  <span className="text-sm font-medium">{ind.label}</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="h-8 w-20 text-center"
                    defaultValue={current?.value ?? ''}
                    onBlur={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val <= 10) {
                        saveIndividualScore.mutate({ indicator: ind.key, score: val });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Sin deportistas en el roster.</p>
        )}
      </CardContent>
    </Card>
  );
}
