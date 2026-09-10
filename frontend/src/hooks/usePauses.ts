/**
 * Pausa de inscripción por vacaciones / lesión.
 * Spec: docs/specs/pausa-vacaciones-enrollments.md
 *
 * ── POR QUÉ ESTO LLAMA A SUPABASE DIRECTO Y NO AL BFF ──────────────────────
 * Las RPCs de pausa autorizan con `auth.uid()`. El BFF usa el service role, y
 * ahí `auth.uid()` es NULL: la guarda `IF v_caller IS NOT NULL AND NOT (...)`
 * de cada RPC pasaría de largo, o sea que rutear esto por el BFF le APAGA la
 * autorización. Peor con `request_enrollment_pause`, que además deriva el
 * parentesco de `auth.uid()` y por el BFF fallaría siempre.
 * Con el JWT del usuario, el gate de la RPC ES el gate real. Mismo camino que
 * `set_school_athlete_status` y `create_invitation`.
 * (Ver docs/gotchas-tecnicos.md → "Llamar una RPC desde el BFF le apaga su
 * propia autorización".)
 *
 * ── LAS DOS REGLAS, QUE NO SON LA MISMA ────────────────────────────────────
 *  · COBRO     → granularidad de MES (month_from/month_to). Un mes que ya se
 *                saltó sigue saltado aunque el atleta vuelva antes.
 *  · OPERATIVA → granularidad de DÍA (v_enrollment_pauses_effective, recortada
 *                en resumed_at). Es la que decide si sale en la lista de
 *                asistencia; el que vuelve el 12 reaparece el 12.
 * El badge de la UI usa la OPERATIVA (¿está en pausa ahora?), y el diálogo
 * muestra los meses de la de COBRO (¿qué no se cobra?).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/error-translator';

export type PauseReason = 'vacation' | 'injury' | 'other';

export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  vacation: '🏖️ Vacaciones',
  injury: '🩹 Lesión',
  other: 'Otro motivo',
};

export interface PauseRequest {
  id: string;
  school_id: string;
  enrollment_id: string;
  child_id: string | null;
  user_id: string | null;
  unregistered_athlete_id: string | null;
  reason: PauseReason;
  reason_note: string | null;
  month_from: string;
  month_to: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  source: 'parent' | 'athlete' | 'admin';
  requested_by: string | null;
  requested_at: string;
  payments_cancelled: number | null;
  payments_ambiguos: number | null;
}

export interface EffectivePause {
  request_id: string;
  enrollment_id: string;
  reason: PauseReason;
  reason_note: string | null;
  month_from: string;
  month_to: string;
  effective_from: string;
  effective_until: string;
}

export interface PausePreview {
  meses: string[];
  payments_a_anular: number;
  payments_ambiguos: number;
}

/** Día 1 del mes de una fecha `YYYY-MM-DD`, que es lo que exige el CHECK
 *  `pause_dia_uno` de la tabla. */
export function primerDiaDelMes(ym: string): string {
  return `${ym.slice(0, 7)}-01`;
}

/** `2026-07-01` → `07/2026`, para hablarle al usuario en meses y no en fechas. */
export function mesLegible(fecha: string): string {
  const [y, m] = fecha.split('-');
  return `${m}/${y}`;
}

/**
 * Los próximos N meses como opciones `YYYY-MM`, arrancando en el mes actual:
 * `pause_validar` rechaza un mes que ya pasó. Compartido por el diálogo del
 * admin y el del acudiente para que ofrezcan exactamente el mismo rango.
 */
export function opcionesDeMes(cantidad = 13): { value: string; label: string }[] {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: mesLegible(`${value}-01`) };
  });
}

/**
 * Pausas vigentes **o programadas** de la escuela, por enrollment_id — para el
 * badge. Sale de la vista y no de `enrollments.paused_*` porque la vista
 * recorta la ventana en `resumed_at`: un reactivado anticipadamente no debe
 * seguir apareciendo en pausa.
 *
 * OJO con el filtro: se traen las que NO terminaron (`effective_until > hoy`),
 * incluidas las que arrancan el mes que viene. Filtrar además por
 * `effective_from <= hoy` dejaba sin badge al que se acaba de pausar para
 * julio estando en junio — el admin confirmaba, no veía nada y parecía que la
 * acción había fallado. `vigente` distingue los dos casos para la UI.
 */
export function useActivePauses(schoolId: string | null | undefined) {
  const hoy = new Date().toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: ['active-pauses', schoolId, hoy],
    enabled: !!schoolId,
    queryFn: async (): Promise<EffectivePause[]> => {
      const { data, error } = await supabase
        .from('v_enrollment_pauses_effective' as any)
        .select('request_id, enrollment_id, reason, reason_note, month_from, month_to, effective_from, effective_until')
        .eq('school_id', schoolId)
        .gt('effective_until', hoy);
      if (error) throw error;
      return (data ?? []) as unknown as EffectivePause[];
    },
  });

  const byEnrollment = new Map<string, EffectivePause & { vigente: boolean }>(
    (query.data ?? []).map((p) => [p.enrollment_id, { ...p, vigente: p.effective_from <= hoy }])
  );

  return { ...query, byEnrollment };
}

/** Solicitudes pendientes de la escuela — la bandeja del admin. */
export function usePendingPauseRequests(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ['pause-requests', 'pending', schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<PauseRequest[]> => {
      const { data, error } = await supabase
        .from('enrollment_pause_requests' as any)
        .select('*')
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PauseRequest[];
    },
  });
}

export function usePauseActions(schoolId: string | null | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /** Invalida todo lo que la pausa mueve: el badge, la bandeja, la lista de
   *  atletas (cambia la cartera) y los cobros. */
  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['active-pauses', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['pause-requests', 'pending', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['school-students'] });
    queryClient.invalidateQueries({ queryKey: ['school-payments'] });
  };

  /**
   * Qué va a pasar, ANTES de confirmar. Sale de la RPC y no del navegador a
   * propósito: hay 11 divergencias censadas de cálculos monetarios hechos en
   * el front (docs/censo-calculos-monetarios.md).
   */
  const preview = async (
    enrollmentId: string, monthFrom: string, monthTo: string
  ): Promise<PausePreview> => {
    const { data, error } = await (supabase.rpc as any)('preview_enrollment_pause', {
      p_enrollment_id: enrollmentId,
      p_month_from: primerDiaDelMes(monthFrom),
      p_month_to: primerDiaDelMes(monthTo),
    });
    if (error) throw error;
    return data as PausePreview;
  };

  /** El botón del admin: hace toda la acción de una (marca, anula cobros). */
  const pausar = useMutation({
    mutationFn: async (args: {
      enrollmentId: string; reason: PauseReason;
      monthFrom: string; monthTo: string; note?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('pause_enrollment_directly', {
        p_enrollment_id: args.enrollmentId,
        p_reason: args.reason,
        p_month_from: primerDiaDelMes(args.monthFrom),
        p_month_to: primerDiaDelMes(args.monthTo),
        p_note: args.note || null,
      });
      if (error) throw error;
      return data as { meses_pausados: number; payments_cancelled: number; payments_ambiguos: number };
    },
    onSuccess: (res) => {
      invalidar();
      const anulados = Number(res?.payments_cancelled ?? 0);
      const dudosos = Number(res?.payments_ambiguos ?? 0);
      toast({
        title: '🏖️ Atleta en pausa',
        description: [
          `No se cobrarán ${res?.meses_pausados ?? 0} mes(es).`,
          anulados ? `Se anularon ${anulados} cobro(s) pendiente(s).` : null,
          // Los "ambiguos" son la bolsa payment_category NULL + one_time, donde
          // viven los cobros registrados a mano. No se anulan solos porque ahí
          // también hay torneos y artículos; el admin tiene que mirarlos.
          dudosos ? `⚠️ Quedaron ${dudosos} cobro(s) de categoría dudosa sin anular: hay que revisarlos a mano.` : null,
        ].filter(Boolean).join(' '),
      });
    },
    onError: (e: any) => toast({
      title: 'No se pudo pausar', description: getUserFriendlyError(e), variant: 'destructive',
    }),
  });

  /** Volvió de vacaciones: reaparece en todo, hoy mismo. */
  const reactivar = useMutation({
    mutationFn: async (args: { enrollmentId: string; note?: string }) => {
      const { data, error } = await (supabase.rpc as any)('resume_enrollment', {
        p_enrollment_id: args.enrollmentId,
        p_note: args.note || null,
      });
      if (error) throw error;
      return data as { days_extended: number; mes_en_curso_sin_cobro: boolean };
    },
    onSuccess: (res) => {
      invalidar();
      toast({
        title: '✅ Atleta reactivado',
        description: [
          'Vuelve a aparecer en la lista de asistencia desde hoy.',
          Number(res?.days_extended ?? 0) > 0
            ? `Se le corrió la vigencia ${res.days_extended} día(s).`
            : null,
          // Honestidad sobre la plata: la ventana de cobro es mensual, así que
          // el mes en el que vuelve ya quedó decidido y no se re-emite.
          res?.mes_en_curso_sin_cobro
            ? 'El mes en curso sigue sin cobro; si hay que cobrarlo, se registra a mano.'
            : null,
        ].filter(Boolean).join(' '),
      });
    },
    onError: (e: any) => toast({
      title: 'No se pudo reactivar', description: getUserFriendlyError(e), variant: 'destructive',
    }),
  });

  const aprobar = useMutation({
    mutationFn: async (args: { requestId: string; note?: string }) => {
      const { data, error } = await (supabase.rpc as any)('approve_enrollment_pause', {
        p_request_id: args.requestId,
        p_review_note: args.note || null,
      });
      if (error) throw error;
      return data as { meses_pausados: number; payments_cancelled: number; payments_ambiguos: number };
    },
    onSuccess: (res) => {
      invalidar();
      const dudosos = Number(res?.payments_ambiguos ?? 0);
      toast({
        title: '✅ Pausa aprobada',
        description: [
          `No se cobrarán ${res?.meses_pausados ?? 0} mes(es).`,
          Number(res?.payments_cancelled ?? 0) ? `Se anularon ${res.payments_cancelled} cobro(s).` : null,
          dudosos ? `⚠️ ${dudosos} cobro(s) de categoría dudosa quedaron sin anular.` : null,
        ].filter(Boolean).join(' '),
      });
    },
    onError: (e: any) => toast({
      title: 'No se pudo aprobar', description: getUserFriendlyError(e), variant: 'destructive',
    }),
  });

  const rechazar = useMutation({
    mutationFn: async (args: { requestId: string; note?: string }) => {
      const { error } = await (supabase.rpc as any)('reject_enrollment_pause', {
        p_request_id: args.requestId,
        p_review_note: args.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: 'Solicitud rechazada', description: 'Se le avisó a quien la pidió.' });
    },
    onError: (e: any) => toast({
      title: 'No se pudo rechazar', description: getUserFriendlyError(e), variant: 'destructive',
    }),
  });

  return { preview, pausar, reactivar, aprobar, rechazar };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lado ACUDIENTE / atleta adulto
// ─────────────────────────────────────────────────────────────────────────────

export interface PauseConfig {
  enabled: boolean;
  parent_can_request: boolean;
  max_months: number;
  enrollment_active: boolean;
}

/**
 * Config de pausa de la escuela de una inscripción.
 *
 * Va por RPC y NO leyendo `school_settings` directo: la policy de lectura de esa
 * tabla es `school_id = ANY(user_school_ids())`, y ese helper no contempla al
 * acudiente (solo school_members y school_staff). Hoy funcionaría de casualidad
 * —379 de 379 acudientes tienen fila de membresía— pero al que le faltara, el
 * botón desaparecería sin que nadie se enterara. Ver migración 20260910114047.
 */
export function usePauseConfig(enrollmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['pause-config', enrollmentId],
    enabled: !!enrollmentId,
    // La config de una escuela no cambia entre renders de una pantalla.
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PauseConfig> => {
      const { data, error } = await (supabase.rpc as any)('pause_config_for_enrollment', {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      return data as PauseConfig;
    },
  });
}

/**
 * Las solicitudes del acudiente sobre las inscripciones que le importan
 * (pendientes y aprobadas). La RLS ya lo acota a sus hijos / a sí mismo, así que
 * no hace falta filtrar por identidad acá.
 */
export function useMyPauseRequests(enrollmentIds: string[]) {
  const ids = [...new Set(enrollmentIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['my-pause-requests', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<PauseRequest[]> => {
      const { data, error } = await supabase
        .from('enrollment_pause_requests' as any)
        .select('*')
        .in('enrollment_id', ids)
        .in('status', ['pending', 'approved'])
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PauseRequest[];
    },
  });
}

export function useParentPauseActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['my-pause-requests'] });
    queryClient.invalidateQueries({ queryKey: ['children'] });
  };

  /** Pide la pausa. NO la aplica: queda pendiente y la escuela decide. */
  const solicitar = useMutation({
    mutationFn: async (args: {
      enrollmentId: string; reason: PauseReason;
      monthFrom: string; monthTo: string; note?: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)('request_enrollment_pause', {
        p_enrollment_id: args.enrollmentId,
        p_reason: args.reason,
        p_month_from: primerDiaDelMes(args.monthFrom),
        p_month_to: primerDiaDelMes(args.monthTo),
        p_reason_note: args.note || null,
      });
      if (error) throw error;
      return data as { request_id: string; meses: number };
    },
    onSuccess: (res) => {
      invalidar();
      toast({
        title: '📩 Solicitud enviada',
        description: `Pediste ${res?.meses ?? 0} mes(es) de pausa. La escuela la tiene que aprobar; te avisamos cuando responda.`,
      });
    },
    onError: (e: any) => toast({
      title: 'No se pudo enviar la solicitud',
      description: getUserFriendlyError(e),
      variant: 'destructive',
    }),
  });

  const retirar = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await (supabase.rpc as any)('cancel_enrollment_pause_request', {
        p_request_id: requestId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      toast({ title: 'Solicitud retirada' });
    },
    onError: (e: any) => toast({
      title: 'No se pudo retirar', description: getUserFriendlyError(e), variant: 'destructive',
    }),
  });

  return { solicitar, retirar };
}
