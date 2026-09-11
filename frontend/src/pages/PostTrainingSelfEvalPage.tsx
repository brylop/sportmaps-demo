import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft, PartyPopper, Frown, Meh, Smile, Laugh, Angry,
  HandMetal, Target as TargetIcon, MessageSquare, Shield, Zap,
  Footprints, CircleDot, CheckCircle2, Pencil,
} from 'lucide-react';

/**
 * Autoevaluación post-entrenamiento — spec docs/specs/evaluacion-post-entrenamiento.md §5.1.
 * La llena el padre (o la atleta adulta) desde el deep-link de la notificación
 * que dispara el trigger post_training_notify_on_finalize al cerrar la sesión.
 */

const COMPREHENSION_OPTIONS = [
  { value: 1, label: 'Las comprendí y apliqué' },
  { value: 2, label: 'Solo las comprendí' },
  { value: 3, label: 'Las apliqué sin entender bien el concepto' },
  { value: 4, label: 'Ni las comprendí ni apliqué' },
];

const SATISFACTION_OPTIONS = [
  { value: 1, label: 'No me siento satisfecha', Icon: Angry },
  { value: 2, label: 'Me siento satisfecha', Icon: Meh },
  { value: 3, label: 'Me siento alegre y satisfecha', Icon: Laugh },
  { value: 4, label: 'Me siento alegre', Icon: Smile },
  { value: 5, label: 'No me siento satisfecha ni alegre', Icon: Frown },
];

const FOCUS_ICONS: Record<string, any> = {
  focus_pase_control: HandMetal,
  focus_recepcion_pase: HandMetal,
  focus_remate_gol: TargetIcon,
  focus_remate: TargetIcon,
  focus_comunicacion_cancha: MessageSquare,
  focus_comunicacion_campo: MessageSquare,
  focus_regate: Footprints,
  focus_marca_defensa: Shield,
  focus_acciones_defensivas: Shield,
  focus_intensidad_fisica: Zap,
  focus_intensidad_fisico: Zap,
  focus_toma_decision: TargetIcon,
  focus_liderazgo: HandMetal,
  focus_seguridad_tranquilidad: Shield,
  focus_finta_enganche: Footprints,
  focus_mirar_espalda_levantar: HandMetal,
  focus_presion_tras_perdida: Zap,
};

type Answers = {
  rpe_borg: number | null;
  task_comprehension: number | null;
  self_effort_pct: number | null;
  satisfaction: number | null;
  focus: string[];
  focus_other_text: string;
};

const EFFORT_STEPS = [50, 60, 70, 80, 90, 100];
const EFFORT_LABELS: Record<number, string> = {
  50: 'Me costó, di menos de la mitad',
  60: 'Di la mitad',
  70: 'Me esforcé moderadamente',
  80: 'Me esforcé bien',
  90: 'Me esforcé mucho',
  100: '¡Lo di todo!',
};

const BORG_LABELS: Record<number, string> = {
  0: 'Reposo', 1: 'Muy, muy ligero', 2: 'Muy ligero', 3: 'Ligero', 4: 'Algo pesado',
  5: 'Pesado', 6: 'Más pesado', 7: 'Muy pesado', 8: 'Muy, muy pesado', 9: 'Máximo', 10: 'Extremo',
};

function borgColor(n: number) {
  if (n <= 3) return 'from-sky-400 to-sky-500';
  if (n <= 6) return 'from-emerald-400 to-amber-400';
  if (n <= 8) return 'from-amber-400 to-orange-500';
  return 'from-orange-500 to-red-500';
}

export default function PostTrainingSelfEvalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const childIdParam = searchParams.get('child_id');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    rpe_borg: null, task_comprehension: null, self_effort_pct: null,
    satisfaction: null, focus: [], focus_other_text: '',
  });
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [result, setResult] = useState<{ saved: number; streak: number; month_avg_borg: number | null } | null>(null);

  // ── Sesión + equipo + escuela + deporte ────────────────────────────────────
  const { data: ctx, isLoading } = useQuery({
    queryKey: ['post-training-context', sessionId, childIdParam],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data: session, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id, school_id, team_id, session_date, finalized, teams(name), schools(category_id)')
        .eq('id', sessionId)
        .single();
      if (sErr || !session) throw sErr || new Error('Sesión no encontrada');

      const sportCategoryId = (session as any).schools?.category_id ?? null;
      const teamName = (session as any).teams?.name ?? null;

      // Resolver sujeto: child_id de la URL, o buscar entre los hijos del padre
      // presentes en esta sesión, o el propio usuario si es atleta adulta.
      let childId = childIdParam;
      let childName: string | null = null;

      if (childId) {
        const { data: c } = await supabase.from('children').select('id, full_name').eq('id', childId).maybeSingle();
        childName = c?.full_name ?? null;
      } else if (user?.id) {
        const { data: ownRecord } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .in('status', ['present', 'late'])
          .maybeSingle();

        if (!ownRecord) {
          const { data: kids } = await supabase
            .from('attendance_records')
            .select('child_id, children(id, full_name, parent_id)')
            .eq('session_id', sessionId)
            .in('status', ['present', 'late'])
            .not('child_id', 'is', null);
          const mine = ((kids ?? []) as any[]).find((k) => k.children?.parent_id === user.id);
          childId = mine?.child_id ?? null;
          childName = mine?.children?.full_name ?? null;
        }
      }

      // Catálogo del deporte (solo lo que usa esta pantalla).
      const { data: metrics } = await supabase
        .from('sport_metric_definitions')
        .select('metric_key, display_name, min_value, max_value, options, is_active, category')
        .eq('sport_category_id', sportCategoryId)
        .eq('is_active', true);

      const focusItems = ((metrics ?? []) as any[])
        .filter((m) => m.metric_key.startsWith('focus_') && !['focus_nada', 'focus_other'].includes(m.metric_key))
        .map((m) => ({ key: m.metric_key as string, label: m.display_name as string }));

      // Contador social: cuántas de las presentes ya respondieron (rpe_borg).
      const { data: present } = await supabase
        .from('attendance_records')
        .select('child_id, user_id')
        .eq('session_id', sessionId)
        .in('status', ['present', 'late']);

      const totalPresentes = (present ?? []).length;
      let yaRespondieron = 0;
      if (totalPresentes > 0) {
        const { count } = await supabase
          .from('performance_entries')
          .select('id', { count: 'exact', head: true })
          .eq('context_type', 'session')
          .eq('context_id', sessionId as string)
          .eq('metric_key', 'rpe_borg');
        yaRespondieron = count ?? 0;
      }

      return {
        session, teamName, sportCategoryId,
        subjectType: childId ? ('child' as const) : ('profile' as const),
        subjectId: childId || user?.id || null,
        childName,
        focusItems,
        totalPresentes, yaRespondieron,
      };
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!sessionId || !ctx?.subjectId) throw new Error('Falta información de la sesión.');
      const payload: Record<string, unknown> = {
        rpe_borg: answers.rpe_borg,
        task_comprehension: answers.task_comprehension,
        self_effort_pct: answers.self_effort_pct,
        satisfaction: answers.satisfaction,
      };
      if (answers.focus.length > 0) payload.focus = answers.focus;
      if (answers.focus.includes('focus_other') && answers.focus_other_text.trim()) {
        payload.focus_other_text = answers.focus_other_text.trim();
      }

      const { data, error } = await supabase.rpc('submit_post_training_self_eval', {
        p_session_id: sessionId,
        p_child_id: ctx.subjectType === 'child' ? ctx.subjectId : null,
        p_user_id: ctx.subjectType === 'profile' ? ctx.subjectId : null,
        p_answers: payload,
      });
      if (error) throw error;
      return data as { saved: number; streak: number; month_avg_borg: number | null };
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(6);
    },
    onError: (err: any) => {
      toast({ title: 'No se pudo guardar', description: err?.message ?? 'Intenta de nuevo.', variant: 'destructive' });
    },
  });

  const dots = [0, 1, 2, 3, 4];
  const canGoNext = useMemo(() => {
    if (step === 1) return answers.rpe_borg !== null;
    if (step === 2) return answers.task_comprehension !== null;
    if (step === 3) return answers.self_effort_pct !== null;
    if (step === 4) return answers.satisfaction !== null;
    return true;
  }, [step, answers]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  if (!ctx?.subjectId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold">No encontramos a qué deportista corresponde este entreno.</p>
        <Button variant="outline" onClick={() => navigate('/')}>Volver al inicio</Button>
      </div>
    );
  }

  const nombre = ctx.childName ?? 'Deportista';

  return (
    <div className="min-h-screen bg-background-light flex flex-col max-w-md mx-auto">
      {step > 0 && step < 6 && (
        <div className="flex items-center gap-3 px-6 pt-7 pb-1">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5 flex-1">
            {dots.map((d) => (
              <div key={d} className={`h-1.5 flex-1 rounded-full ${d < step ? 'bg-orange' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Paso 0 — Entrada */}
      {step === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center gap-5">
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
            {nombre.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">¡Hola {nombre}!</h1>
            <p className="text-muted-foreground mt-1">¿Cómo estuvo el entreno de hoy?</p>
          </div>
          <div className="flex flex-col gap-2 items-center">
            <span className="text-xs font-semibold bg-white border rounded-full px-4 py-2">
              {ctx.teamName ?? 'Tu equipo'} · {new Date(ctx.session.session_date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
            {ctx.totalPresentes > 0 && (
              <span className="text-xs font-semibold bg-orange/10 text-orange-dark rounded-full px-4 py-2">
                El equipo ya respondió {ctx.yaRespondieron} de {ctx.totalPresentes}
              </span>
            )}
          </div>
          <Button size="lg" className="w-full mt-4 bg-orange hover:bg-orange-dark text-white rounded-full h-14 text-base font-bold" onClick={() => setStep(1)}>
            Empezar
          </Button>
          <p className="text-xs text-muted-foreground">Menos de 30 segundos</p>
        </div>
      )}

      {/* Paso 1 — BORG */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center px-8 pt-4 gap-6">
          <div className="text-center">
            <p className="text-xs font-bold text-orange-dark uppercase tracking-wide">Pregunta 1 de 5</p>
            <h2 className="text-xl font-extrabold mt-1">¿Qué tan cansada terminaste?</h2>
          </div>
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${borgColor(answers.rpe_borg ?? 0)} flex items-center justify-center text-white text-4xl font-extrabold shadow-lg`}>
            {answers.rpe_borg ?? '–'}
          </div>
          <p className="text-sm font-semibold text-muted-foreground">
            {answers.rpe_borg !== null ? BORG_LABELS[answers.rpe_borg] : 'Desliza para elegir'}
          </p>
          <div className="w-full grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => n).map((n) => (
              <button
                key={n}
                onClick={() => setAnswers((a) => ({ ...a, rpe_borg: n }))}
                className={`h-10 rounded-lg text-xs font-bold border-2 ${answers.rpe_borg === n ? 'border-orange bg-orange text-white' : 'border-border bg-white text-muted-foreground'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button disabled={!canGoNext} className="w-full mt-auto mb-8 h-12 rounded-full bg-orange hover:bg-orange-dark" onClick={() => setStep(2)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* Paso 2 — Comprensión */}
      {step === 2 && (
        <div className="flex-1 flex flex-col px-6 pt-4 gap-4">
          <div className="text-center">
            <p className="text-xs font-bold text-orange-dark uppercase tracking-wide">Pregunta 2 de 5</p>
            <h2 className="text-xl font-extrabold mt-1">¿Entendiste los ejercicios de hoy?</h2>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            {COMPREHENSION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setAnswers((a) => ({ ...a, task_comprehension: opt.value })); setStep(3); }}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left font-semibold ${answers.task_comprehension === opt.value ? 'border-orange bg-orange/5 text-orange-dark' : 'border-border bg-white'}`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${answers.task_comprehension === opt.value ? 'text-orange' : 'text-muted-foreground/40'}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Paso 3 — Esfuerzo */}
      {step === 3 && (
        <div className="flex-1 flex flex-col items-center px-8 pt-4 gap-5">
          <div className="text-center">
            <p className="text-xs font-bold text-orange-dark uppercase tracking-wide">Pregunta 3 de 5</p>
            <h2 className="text-xl font-extrabold mt-1">¿Cuánto te esforzaste hoy?</h2>
          </div>
          <div className="text-5xl font-extrabold text-orange-dark">{answers.self_effort_pct ?? '--'}%</div>
          <p className="text-sm font-semibold text-muted-foreground text-center">
            {answers.self_effort_pct ? EFFORT_LABELS[answers.self_effort_pct] : 'Elige tu nivel'}
          </p>
          <div className="w-full flex items-end justify-center gap-2 h-40">
            {EFFORT_STEPS.map((v, i) => (
              <button
                key={v}
                onClick={() => setAnswers((a) => ({ ...a, self_effort_pct: v }))}
                className={`w-9 rounded-t-lg border-2 ${answers.self_effort_pct === v ? 'border-orange bg-gradient-to-t from-orange-dark to-orange' : 'border-border bg-muted/40'}`}
                style={{ height: `${35 + i * 13}%` }}
              />
            ))}
          </div>
          <div className="w-full flex justify-center gap-2 text-[10px] font-bold text-muted-foreground">
            {EFFORT_STEPS.map((v) => <span key={v} className="w-9 text-center">{v}</span>)}
          </div>
          <Button disabled={!canGoNext} className="w-full mt-auto mb-8 h-12 rounded-full bg-orange hover:bg-orange-dark" onClick={() => setStep(4)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* Paso 4 — Satisfacción */}
      {step === 4 && (
        <div className="flex-1 flex flex-col items-center px-6 pt-4 gap-5">
          <div className="text-center">
            <p className="text-xs font-bold text-orange-dark uppercase tracking-wide">Pregunta 4 de 5</p>
            <h2 className="text-xl font-extrabold mt-1">¿Cómo te sentiste al terminar?</h2>
          </div>
          <div className="flex items-center gap-2">
            {SATISFACTION_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => { setAnswers((a) => ({ ...a, satisfaction: value })); setStep(5); }}
                className={`rounded-full flex items-center justify-center transition-transform ${answers.satisfaction === value ? 'w-20 h-20 bg-gradient-to-br from-orange to-orange-dark text-white scale-105 shadow-lg' : 'w-12 h-12 bg-muted/50 text-muted-foreground'}`}
                title={label}
              >
                <Icon className={answers.satisfaction === value ? 'w-9 h-9' : 'w-5 h-5'} />
              </button>
            ))}
          </div>
          {answers.satisfaction && (
            <p className="text-sm font-semibold bg-orange/10 text-orange-dark rounded-full px-4 py-2 text-center">
              {SATISFACTION_OPTIONS.find((o) => o.value === answers.satisfaction)?.label}
            </p>
          )}
        </div>
      )}

      {/* Paso 5 — Aspectos a mejorar */}
      {step === 5 && (
        <div className="flex-1 flex flex-col px-6 pt-4 gap-4">
          <div className="text-center">
            <p className="text-xs font-bold text-orange-dark uppercase tracking-wide flex items-center justify-center gap-2">
              Pregunta 5 de 5 <span className="bg-muted rounded-full px-2 py-0.5 text-muted-foreground normal-case font-bold">opcional</span>
            </p>
            <h2 className="text-xl font-extrabold mt-1">¿Qué quieres mejorar la próxima vez?</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(ctx.focusItems ?? []).map(({ key, label }) => {
              const Icon = FOCUS_ICONS[key] ?? CircleDot;
              const selected = answers.focus.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => setAnswers((a) => ({
                    ...a,
                    focus: selected ? a.focus.filter((f) => f !== key) : [...a.focus, key],
                  }))}
                  className={`flex items-center gap-2 p-3 rounded-2xl border-2 text-sm font-semibold text-left ${selected ? 'border-orange bg-orange/5 text-orange-dark' : 'border-border bg-white'}`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${selected ? 'text-orange' : 'text-muted-foreground'}`} />
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowOtherInput(true);
                setAnswers((a) => (a.focus.includes('focus_other') ? a : { ...a, focus: [...a.focus, 'focus_other'] }));
              }}
              className={`col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed text-sm font-semibold ${answers.focus.includes('focus_other') ? 'border-orange text-orange-dark' : 'border-border text-muted-foreground'}`}
            >
              <Pencil className="w-4 h-4" /> Otro
            </button>
          </div>
          {showOtherInput && answers.focus.includes('focus_other') && (
            <Textarea
              placeholder="¿Qué te gustaría mejorar?"
              maxLength={200}
              value={answers.focus_other_text}
              onChange={(e) => setAnswers((a) => ({ ...a, focus_other_text: e.target.value }))}
              className="rounded-xl"
            />
          )}
          <button
            className="text-sm font-bold text-muted-foreground underline py-2"
            onClick={() => setAnswers((a) => ({ ...a, focus: [] }))}
          >
            Hoy nada
          </button>
          <Button
            disabled={submit.isPending}
            className="w-full mt-2 mb-8 h-12 rounded-full bg-orange hover:bg-orange-dark"
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? 'Guardando…' : 'Terminar'}
          </Button>
        </div>
      )}

      {/* Paso 6 — Cierre */}
      {step === 6 && result && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-5">
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center">
            <PartyPopper className="w-11 h-11 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">¡Listo!</h1>
          {result.streak > 1 && (
            <p className="text-sm font-bold bg-orange/10 text-orange-dark rounded-full px-4 py-2">
              Llevas {result.streak} entrenos seguidos respondiendo 🔥
            </p>
          )}
          <div className="w-full bg-white border rounded-3xl p-6 flex items-center justify-around shadow-sm">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Hoy terminaste en</p>
              <p className="text-3xl font-extrabold text-orange-dark">{answers.rpe_borg}</p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase">Promedio del mes</p>
              <p className="text-3xl font-extrabold text-primary">{result.month_avg_borg ?? '—'}</p>
            </div>
          </div>
          <Button className="w-full h-12 rounded-full bg-primary hover:bg-primary/90" onClick={() => navigate('/')}>
            Cerrar
          </Button>
        </div>
      )}
    </div>
  );
}
