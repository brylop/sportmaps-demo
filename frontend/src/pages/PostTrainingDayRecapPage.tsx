import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PartyPopper, ArrowLeft, MessageCircle } from 'lucide-react';

/**
 * Resumen del día puntual — spec docs/specs/evaluacion-post-entrenamiento.md §7.
 * Deep-link de la notificación que dispara el trigger
 * post_training_check_daily_recap cuando ya existen, para la misma sesión y
 * deportista, tanto la autoevaluación del padre como el rating del coach.
 * A diferencia de PostTrainingSelfEvalPage (paso 6, solo al terminar de
 * responder), esta pantalla es re-visitable en cualquier momento.
 */

const COMPREHENSION_LABELS: Record<number, string> = {
  1: 'Las comprendió y aplicó',
  2: 'Solo las comprendió',
  3: 'Las aplicó sin entender bien el concepto',
  4: 'Ni las comprendió ni aplicó',
};

const SATISFACTION_LABELS: Record<number, string> = {
  1: 'No se sintió satisfecha',
  2: 'Se sintió satisfecha',
  3: 'Se sintió alegre y satisfecha',
  4: 'Se sintió alegre',
  5: 'No se sintió satisfecha ni alegre',
};

function borgColor(n: number) {
  if (n <= 3) return 'from-sky-400 to-sky-500';
  if (n <= 6) return 'from-emerald-400 to-amber-400';
  if (n <= 8) return 'from-amber-400 to-orange-500';
  return 'from-orange-500 to-red-500';
}

export default function PostTrainingDayRecapPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const childIdParam = searchParams.get('child_id');
  const navigate = useNavigate();
  const { user } = useAuth();

  const subjectType = childIdParam ? ('child' as const) : ('profile' as const);
  const subjectId = childIdParam || user?.id || null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['post-training-day-recap', sessionId, subjectType, subjectId],
    enabled: !!sessionId && !!subjectId,
    queryFn: async () => {
      const { data: session, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id, session_date, teams(name)')
        .eq('id', sessionId)
        .single();
      if (sErr || !session) throw sErr || new Error('Sesión no encontrada');

      const nombre = childIdParam
        ? (await supabase.from('children').select('full_name').eq('id', childIdParam).maybeSingle()).data?.full_name ?? 'Tu deportista'
        : null;

      const { data: entries, error: eErr } = await supabase
        .from('performance_entries')
        .select('metric_key, value, notes')
        .eq('context_type', 'session')
        .eq('context_id', sessionId as string)
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId as string);
      if (eErr) throw eErr;

      const byKey: Record<string, { value: number; notes: string | null }> = {};
      for (const e of entries ?? []) byKey[e.metric_key] = { value: Number(e.value), notes: e.notes };

      const focusKeys = Object.keys(byKey).filter((k) => k.startsWith('focus_'));
      let focusLabels: string[] = [];
      if (focusKeys.length > 0) {
        const { data: defs } = await supabase
          .from('sport_metric_definitions')
          .select('metric_key, display_name')
          .in('metric_key', focusKeys);
        focusLabels = (defs ?? []).map((d) => d.display_name);
      }

      const { data: sessionRow } = await supabase
        .from('attendance_sessions')
        .select('coach_notes')
        .eq('id', sessionId)
        .single();

      return {
        teamName: (session as any).teams?.name ?? null,
        sessionDate: session.session_date,
        nombre,
        rpeBorg: byKey.rpe_borg?.value ?? null,
        taskComprehension: byKey.task_comprehension?.value ?? null,
        selfEffortPct: byKey.self_effort_pct?.value ?? null,
        satisfaction: byKey.satisfaction?.value ?? null,
        coachEffortRating: byKey.coach_effort_rating?.value ?? null,
        focusLabels,
        coachNotes: sessionRow?.coach_notes ?? null,
        hasBoth: byKey.rpe_borg !== undefined && byKey.coach_effort_rating !== undefined,
      };
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">No encontramos el resumen de este entreno.</p>
        <Button variant="outline" onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    );
  }

  const fecha = new Date(data.sessionDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-background-light flex flex-col max-w-md mx-auto">
      <div className="flex items-center gap-3 px-6 pt-7 pb-1">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-xs font-bold text-orange-dark uppercase tracking-wide">Resumen del día</p>
          <p className="text-sm font-semibold text-muted-foreground capitalize">{data.teamName ?? 'Entreno'} · {fecha}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-6 gap-5">
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <PartyPopper className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold">Así le fue hoy a {data.nombre ?? 'tu deportista'}</h1>
          {!data.hasBoth && (
            <p className="text-xs text-muted-foreground">Todavía falta una parte de este resumen; vuelve pronto.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {data.rpeBorg !== null && (
            <div className="bg-white border rounded-2xl p-4 flex flex-col items-center gap-1">
              <p className="text-xs font-bold text-muted-foreground uppercase">Fatiga (BORG)</p>
              <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${borgColor(data.rpeBorg)} flex items-center justify-center text-white text-xl font-extrabold`}>
                {data.rpeBorg}
              </div>
            </div>
          )}
          {data.coachEffortRating !== null && (
            <div className="bg-white border rounded-2xl p-4 flex flex-col items-center gap-1">
              <p className="text-xs font-bold text-muted-foreground uppercase text-center">Esfuerzo según el coach</p>
              <p className="text-2xl font-extrabold text-orange-dark">{data.coachEffortRating}%</p>
            </div>
          )}
          {data.taskComprehension !== null && (
            <div className="bg-white border rounded-2xl p-4 col-span-2">
              <p className="text-xs font-bold text-muted-foreground uppercase">Comprensión de los ejercicios</p>
              <p className="text-sm font-semibold mt-1">{COMPREHENSION_LABELS[data.taskComprehension] ?? data.taskComprehension}</p>
            </div>
          )}
          {data.selfEffortPct !== null && (
            <div className="bg-white border rounded-2xl p-4 flex flex-col items-center gap-1">
              <p className="text-xs font-bold text-muted-foreground uppercase text-center">Esfuerzo propio</p>
              <p className="text-2xl font-extrabold text-primary">{data.selfEffortPct}%</p>
            </div>
          )}
          {data.satisfaction !== null && (
            <div className="bg-white border rounded-2xl p-4 flex flex-col items-center justify-center gap-1">
              <p className="text-xs font-bold text-muted-foreground uppercase text-center">Cómo se sintió</p>
              <p className="text-xs font-semibold text-center">{SATISFACTION_LABELS[data.satisfaction] ?? data.satisfaction}</p>
            </div>
          )}
        </div>

        {data.focusLabels.length > 0 && (
          <div className="bg-white border rounded-2xl p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Quiere mejorar</p>
            <div className="flex flex-wrap gap-2">
              {data.focusLabels.map((f) => (
                <span key={f} className="text-xs font-semibold bg-orange/10 text-orange-dark rounded-full px-3 py-1">{f}</span>
              ))}
            </div>
          </div>
        )}

        {data.coachNotes && (
          <div className="bg-white border rounded-2xl p-4 flex gap-2">
            <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm">{data.coachNotes}</p>
          </div>
        )}

        <Button className="w-full mt-auto h-12 rounded-full bg-primary hover:bg-primary/90" onClick={() => navigate('/')}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}
