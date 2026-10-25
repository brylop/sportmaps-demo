/**
 * Contratos de datos del Entrenador y Deportista V2 (docs/specs/entrenador-deportista-v2.md §3).
 *
 * B1 felicitaciones · B2 convocatoria con respuesta · B3 estado de pago para el
 * profe · B4 informes del deportista. Todo por `supabase.rpc` / RLS, sin BFF,
 * salvo el informe del entreno (lo arma el BFF).
 *
 * Toda función devuelve `{ data, error, noDisponible }` y NUNCA lanza:
 *   · noDisponible = true → la RPC/tabla todavía no existe en la base (las
 *     migraciones 20261025003634…3712 se aplican a mano). La pantalla OCULTA la
 *     sección; no muestra error.
 *   · error → mensaje para el usuario; `codigo` trae el código de negocio cuando
 *     lo hay (p. ej. 'KUDOS_DAILY_LIMIT').
 *
 * Las RPC no están en el types.ts generado hasta que se regenere: por eso el
 * `rpc as any` concentrado en `llamar()`.
 */
import { supabase } from '@/integrations/supabase/client';
import { bffClient, BFFError } from '@/lib/api/bffClient';

// ── Tipos comunes ────────────────────────────────────────────────────────────

export interface ResultadoContrato<T> {
  data: T | null;
  error: string | null;
  noDisponible: boolean;
  /** Código de negocio o SQLSTATE cuando aplica ('KUDOS_DAILY_LIMIT', '42501', …). */
  codigo?: string;
}

export type TipoSujeto = 'child' | 'profile' | 'unregistered';

/** Un deportista: exactamente uno de los tres ids. */
export type SujetoDeportista =
  | { childId: string; athleteUserId?: never; unregisteredAthleteId?: never }
  | { athleteUserId: string; childId?: never; unregisteredAthleteId?: never }
  | { unregisteredAthleteId: string; childId?: never; athleteUserId?: never };

/** Sujeto a partir de (subject_type, subject_id), como vienen de las RPC. */
export function sujetoDesde(tipo: TipoSujeto, id: string): SujetoDeportista {
  if (tipo === 'child') return { childId: id };
  if (tipo === 'profile') return { athleteUserId: id };
  return { unregisteredAthleteId: id };
}

const paramsSujeto = (s: SujetoDeportista) => ({
  p_child_id: s.childId ?? null,
  p_athlete_user_id: s.athleteUserId ?? null,
  p_unregistered_athlete_id: s.unregisteredAthleteId ?? null,
});

interface ErrorPostgrest {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

/** ¿El error dice que la función/tabla no existe todavía? */
export function esNoDisponible(error: ErrorPostgrest | null | undefined, status?: number): boolean {
  if (!error) return false;
  if (status === 404) return true;
  const code = error.code ?? '';
  // PGRST202: función no está en el cache de esquema · PGRST205: tabla no está ·
  // 42883: función no existe · 42P01: relación no existe.
  if (['PGRST202', 'PGRST205', '42883', '42P01'].includes(code)) return true;
  return /could not find the function|schema cache/i.test(error.message ?? '');
}

/** Mensajes para el usuario (tú, español de Colombia). */
function mensajeDe(error: ErrorPostgrest): { mensaje: string; codigo?: string } {
  const msg = error.message ?? '';
  if (msg.includes('KUDOS_DAILY_LIMIT')) {
    return { mensaje: 'Ya felicitaste a este deportista hoy. Mañana puedes volver a hacerlo.', codigo: 'KUDOS_DAILY_LIMIT' };
  }
  if (error.code === '42501') return { mensaje: 'No tienes permiso para hacer esto.', codigo: '42501' };
  if (error.code === '55000') return { mensaje: 'Este partido ya no recibe respuestas.', codigo: '55000' };
  if (error.code === 'P0002') return { mensaje: msg || 'No encontramos lo que buscas.', codigo: 'P0002' };
  if (error.code === '22023') return { mensaje: msg || 'Revisa los datos.', codigo: '22023' };
  return { mensaje: 'Algo salió mal. Intenta de nuevo.', codigo: error.code };
}

async function llamar<T>(fn: string, args: Record<string, unknown> = {}): Promise<ResultadoContrato<T>> {
  try {
    const { data, error, status } = await (supabase.rpc as any)(fn, args);
    if (error) {
      if (esNoDisponible(error, status)) return { data: null, error: null, noDisponible: true };
      const { mensaje, codigo } = mensajeDe(error);
      return { data: null, error: mensaje, noDisponible: false, codigo };
    }
    return { data: (data ?? null) as T, error: null, noDisponible: false };
  } catch (e: any) {
    return { data: null, error: e?.message ?? 'Sin conexión.', noDisponible: false };
  }
}

// ── B1 · Felicitaciones ──────────────────────────────────────────────────────

export interface Felicitacion {
  id: string;
  message: string;
  coach_name: string;
  created_at: string;
}

/** El staff felicita (1 por deportista por día → codigo 'KUDOS_DAILY_LIMIT'). Devuelve el id. */
export function darFelicitacion(
  schoolId: string,
  sujeto: SujetoDeportista,
  mensaje: string,
): Promise<ResultadoContrato<string>> {
  return llamar<string>('give_kudos', { p_school_id: schoolId, p_message: mensaje.trim(), ...paramsSujeto(sujeto) });
}

/** Felicitaciones de un deportista (acudiente, el deportista y el staff). */
export async function listarFelicitaciones(
  sujeto: SujetoDeportista,
  limite = 20,
): Promise<ResultadoContrato<Felicitacion[]>> {
  const r = await llamar<Felicitacion[]>('list_kudos', { ...paramsSujeto(sujeto), p_limit: limite });
  return r.data ? r : { ...r, data: r.error || r.noDisponible ? null : [] };
}

// ── B2 · Convocatoria con respuesta ──────────────────────────────────────────

export type RespuestaConvocatoria = 'va' | 'no_va';

export interface MiConvocatoria {
  lineup_id: string;
  match_id: string;
  school_id: string;
  team_id: string;
  team_name: string | null;
  subject_type: TipoSujeto;
  subject_id: string;
  athlete_name: string | null;
  role: 'starter' | 'bench';
  opponent: string;
  match_date: string;
  kickoff_at: string | null;
  location: string | null;
  is_home: boolean | null;
  notes: string | null;
  response: RespuestaConvocatoria | null;
  responded_at: string | null;
}

export interface EstadoConvocado {
  subject_type: TipoSujeto;
  subject_id: string;
  athlete_name: string;
  role: 'starter' | 'bench';
  /** false = nadie con cuenta puede responder por él (menor sin acudiente vinculado, ficha sin cuenta). */
  has_account: boolean;
  response: RespuestaConvocatoria | null;
  responded_at: string | null;
}

/** «Va / No va». Responde el acudiente del menor, el deportista adulto o la cuenta de la ficha. */
export function responderConvocatoria(
  lineupId: string,
  sujeto: SujetoDeportista,
  respuesta: RespuestaConvocatoria,
): Promise<ResultadoContrato<{ lineup_id: string; subject_type: TipoSujeto; subject_id: string; response: RespuestaConvocatoria; responded_at: string }>> {
  return llamar('respond_callup', { p_lineup_id: lineupId, p_response: respuesta, ...paramsSujeto(sujeto) });
}

/** Convocatorias de partidos que no han pasado: de mis hijos, mías y de mi ficha. */
export async function misConvocatorias(): Promise<ResultadoContrato<MiConvocatoria[]>> {
  const r = await llamar<MiConvocatoria[]>('my_callups');
  return r.data ? r : { ...r, data: r.error || r.noDisponible ? null : [] };
}

/** Para el profe: quién va, quién no y quién no ha respondido. */
export async function estadoConvocatoria(lineupId: string): Promise<ResultadoContrato<EstadoConvocado[]>> {
  const r = await llamar<EstadoConvocado[]>('callup_status', { p_lineup_id: lineupId });
  return r.data ? r : { ...r, data: r.error || r.noDisponible ? null : [] };
}

// ── B3 · Estado de pago para el profe (sin montos) ───────────────────────────

export type EstadoPago = 'al_dia' | 'pendiente' | 'vencido';

export interface EstadoPagoDeportista {
  subject_type: TipoSujeto;
  subject_id: string;
  /** 'child:<uuid>' | 'profile:<uuid>' | 'unregistered:<uuid>' */
  athlete_key: string;
  athlete_name: string;
  estado: EstadoPago;
}

export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  al_dia: 'Al día',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
};

export async function estadoPagoEquipo(teamId: string): Promise<ResultadoContrato<EstadoPagoDeportista[]>> {
  const r = await llamar<EstadoPagoDeportista[]>('team_payment_status', { p_team_id: teamId });
  return r.data ? r : { ...r, data: r.error || r.noDisponible ? null : [] };
}

// ── B4 · Informes del deportista ─────────────────────────────────────────────

export interface InformeMensualItem {
  id: string;
  subject_type: TipoSujeto;
  subject_id: string;
  period_year: number;
  period_month: number;
  published_at: string | null;
  viewed_at: string | null;
}

/**
 * Los informes mensuales PUBLICADOS del deportista que llama: los suyos como
 * adulto (subject_type 'profile') y los de su ficha vinculada ('unregistered').
 * Se filtra por sujeto a propósito: si además es acudiente o staff, la RLS le
 * dejaría ver otros informes que no son «suyos».
 * El detalle y el «visto» usan lo de siempre: getAthleteReportDetail /
 * markReportViewed de lib/school/reportsQueries.ts.
 */
export async function misInformesDeportista(): Promise<ResultadoContrato<InformeMensualItem[]>> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { data: null, error: 'No hay sesión activa.', noDisponible: false };

    // Fichas vinculadas a mi cuenta (unregistered_athletes no es legible para el
    // deportista por RLS; la RPC solo devuelve los ids propios). Si aún no
    // existe, se sigue solo con los informes de adulto.
    const fichas = await llamar<string[]>('my_linked_unregistered_ids');
    const ids = fichas.data ?? [];

    const filtro = ids.length
      ? `and(subject_type.eq.profile,subject_id.eq.${uid}),and(subject_type.eq.unregistered,subject_id.in.(${ids.join(',')}))`
      : `and(subject_type.eq.profile,subject_id.eq.${uid})`;

    const { data, error, status } = await (supabase.from as any)('athlete_reports')
      .select('id, subject_type, subject_id, period_year, period_month, published_at, viewed_at')
      .eq('status', 'publicado')
      .or(filtro)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (error) {
      if (esNoDisponible(error, status)) return { data: null, error: null, noDisponible: true };
      return { data: null, error: mensajeDe(error).mensaje, noDisponible: false, codigo: error.code };
    }
    return { data: (data ?? []) as InformeMensualItem[], error: null, noDisponible: false };
  } catch (e: any) {
    return { data: null, error: e?.message ?? 'Sin conexión.', noDisponible: false };
  }
}

/** Respuesta de GET /school/reports/team/:teamId/preview-for-parent (sin child_id = para mí). */
export interface InformeEntrenoDeportista {
  team_snapshot: unknown;
  child_metrics: unknown[];
  child_name: string;
  coach_note: string | null;
}

/**
 * El informe del entreno (grupal, con mi dato encima) para el deportista. 404 =
 * el informe del mes aún no se publicó → data null sin error. 403 = no está
 * inscrito activo en ese equipo.
 */
export async function informeEntrenoDeportista(
  teamId: string,
  year: number,
  month: number,
): Promise<ResultadoContrato<InformeEntrenoDeportista>> {
  try {
    const data = await bffClient.get<InformeEntrenoDeportista>(
      `/api/v1/school/reports/team/${teamId}/preview-for-parent?year=${year}&month=${month}`,
    );
    return { data, error: null, noDisponible: false };
  } catch (e: any) {
    if (e instanceof BFFError && e.status === 404) return { data: null, error: null, noDisponible: false };
    // 400 = BFF anterior al cambio (exigía child_id): todavía no desplegado.
    if (e instanceof BFFError && e.status === 400) return { data: null, error: null, noDisponible: true };
    if (e instanceof BFFError && e.status === 403) {
      return { data: null, error: 'No estás inscrito en este equipo.', noDisponible: false, codigo: '403' };
    }
    return { data: null, error: 'No pudimos cargar el informe. Intenta de nuevo.', noDisponible: false };
  }
}
