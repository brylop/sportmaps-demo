import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge } from 'lucide-react';

interface MicrocycleLoadPanelProps {
  microcycleId: string;
}

interface TrainingLoadSummaryRow {
  weekly_ua: number | null;
  sessions_with_rpe: number;
  training_days_count: number;
  adherence_pct: number | null;
  monotony: number | null;
  strain: number | null;
  acwr: number | null;
  days_of_history: number;
  matches_in_72h: number;
  rest_streak_days: number;
}

/** Semáforos por indicador, mismo patrón que `rateTone` de
 *  `AttendanceMonthCard.tsx` (función pura número → clase de color, sin
 *  componente compartido) — no se inventa un sistema nuevo. Umbrales
 *  citados, no inventados: monotonía >2.0 (Foster, 1998) y ACWR fuera de
 *  0.8-1.3 (Gabbett) son los de la literatura de sRPE, no un número propio. */
const adherenceTone = (pct: number) => (pct < 70 ? 'text-red-600' : pct < 85 ? 'text-yellow-600' : 'text-green-600');
const monotonyTone = (v: number) => (v > 2 ? 'text-red-600' : v > 1.5 ? 'text-yellow-600' : 'text-green-600');
const acwrTone = (v: number) => (v > 1.5 || v < 0.8 ? 'text-red-600' : v > 1.3 ? 'text-yellow-600' : 'text-green-600');

export function MicrocycleLoadPanel({ microcycleId }: MicrocycleLoadPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['training-load-summary', microcycleId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('training_load_summary', { p_microcycle_id: microcycleId })
        .single();
      if (error) throw error;
      return data as TrainingLoadSummaryRow;
    },
    enabled: !!microcycleId,
  });

  if (isLoading || !data) return null;

  const adherencePct = data.adherence_pct !== null ? Math.round(data.adherence_pct * 100) : null;

  return (
    <Card className="border-border/40 bg-background/50 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary" />
          Carga de la semana
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        <div className="space-y-0.5">
          <p className="text-muted-foreground">UA de la semana</p>
          <p className="font-semibold text-sm">{Number(data.weekly_ua ?? 0).toFixed(0)}</p>
        </div>

        <div className="space-y-0.5">
          <p className="text-muted-foreground">Adherencia</p>
          {adherencePct === null ? (
            <p className="text-muted-foreground">— sin días de entrenamiento esta semana</p>
          ) : (
            <p className={`font-semibold text-sm ${adherenceTone(adherencePct)}`}>{adherencePct}%</p>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-muted-foreground">Monotonía / strain</p>
          {data.monotony === null ? (
            <p className="text-muted-foreground">necesita 3+ sesiones con RPE esta semana</p>
          ) : (
            <p className={`font-semibold text-sm ${monotonyTone(data.monotony)}`}>
              {data.monotony.toFixed(1)} <span className="text-muted-foreground font-normal">· strain {Number(data.strain).toFixed(0)}</span>
            </p>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-muted-foreground">ACWR</p>
          {data.acwr === null ? (
            <p className="text-muted-foreground">faltan {Math.max(0, 28 - data.days_of_history)} días de historia</p>
          ) : (
            <p className={`font-semibold text-sm ${acwrTone(data.acwr)}`}>
              {data.acwr.toFixed(2)}
              {(data.acwr > 1.5 || data.acwr < 0.8) && (
                <span className="ml-1 font-normal text-[11px]">— riesgo alto (fuera de 0.8–1.3)</span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-0.5">
          <p className="text-muted-foreground">Racha sin descanso</p>
          <p className="font-semibold text-sm">{data.rest_streak_days} {data.rest_streak_days === 1 ? 'día' : 'días'}</p>
        </div>

        {data.matches_in_72h > 0 && (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Densidad competitiva</p>
            <Badge variant="destructive" className="text-[10px] h-5">
              {data.matches_in_72h} {data.matches_in_72h === 1 ? 'partido' : 'partidos'} a &lt;72h
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
