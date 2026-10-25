/**
 * attendance-credits — lógica de créditos de sesión, reservas y avisos de hito
 * extraída de routes/attendance.ts (sin cambios de comportamiento) para que
 * tanto el handler HTTP como attendance-register.service.ts la compartan sin
 * import circular. routes/attendance.ts la re-exporta.
 */
import { supabase } from '../config/supabase';

function todayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export type AthleteRef = { childId?: string | null; userId?: string | null; unregisteredId?: string | null };

export type CreditEnrollment = {
  id: string; sessions_used: number; max_sessions: number | null;
  secondary_sessions_used: number; max_secondary_sessions: number | null;
  expires_at: string | null; plan_name: string | null;
};

/** Reserva del día que la asistencia puede consumir en vez de descontar otra clase. */
export type FreeBooking = {
  source: 'session_bookings' | 'facility_reservations';
  id: string;
  session_id: string | null;
  /** Hora del bloque, para poder decírselo al entrenador. */
  start_time: string | null;
};

export type CreditOutcome =
  | 'deducted'            // se descontó una clase
  | 'covered_by_booking'  // ya tenía reserva ese día: no se descuenta
  | 'returned'            // corrección a ausente: crédito devuelto
  | 'booking_released'    // corrección a ausente sobre una reserva: vuelve a confirmed
  | 'no_plan'             // equipo puro: no maneja sesiones
  | 'no_credits'          // plan agotado — la asistencia igual quedó registrada
  | 'expired'             // plan vencido — idem
  | 'unchanged';

export const PLAN_JOIN = 'offering_plans!enrollments_offering_plan_id_fkey(name, max_sessions, max_secondary_sessions)';

export function athleteFilter(a: AthleteRef): Record<string, string> {
  if (a.childId) return { child_id: a.childId };
  if (a.userId)  return { user_id: a.userId };
  return { unregistered_athlete_id: a.unregisteredId as string };
}

export function athleteKey(a: AthleteRef): string | null {
  return a.childId ?? a.userId ?? a.unregisteredId ?? null;
}

/**
 * Inscripciones pausadas por vacaciones/lesión el día `date`, para sacarlas del
 * roster: el pausado no le aparece al entrenador al pasar lista, y el día que
 * vuelve reaparece.
 *
 * OJO — son DOS reglas distintas y esta es la OPERATIVA:
 *   · COBRO     → granularidad de MES, vive en `open_month` vía month_from/
 *                 month_to. Un mes que ya se saltó sigue saltado.
 *   · OPERATIVA → granularidad de DÍA, esta. Sale de
 *                 `v_enrollment_pauses_effective`, cuya ventana se recorta en
 *                 `resumed_at`, así que el que vuelve de vacaciones el 12 sale
 *                 en la lista del 12 — no del mes siguiente.
 * Ver docs/specs/pausa-vacaciones-enrollments.md.
 *
 * Falla ABIERTA a propósito: si la consulta se cae, se devuelve un set vacío y
 * el pausado aparece en la lista. Un pausado de más en el roster es una
 * molestia; un roster vacío deja al entrenador sin poder pasar lista.
 */
export async function pausedEnrollmentIds(schoolId: string, date: string): Promise<Set<string>> {
  if (!schoolId) return new Set();
  const { data, error } = await supabase
    .from('v_enrollment_pauses_effective')
    .select('enrollment_id')
    .eq('school_id', schoolId)
    .lte('effective_from', date)
    .gt('effective_until', date);

  if (error) {
    console.error('[attendance] pausedEnrollmentIds fallo (se sigue sin filtrar):', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: any) => r.enrollment_id as string));
}

export function toCreditEnrollment(row: any): CreditEnrollment {
  const plan = row?.offering_plans;
  return {
    id: row.id,
    sessions_used: row.sessions_used ?? 0,
    max_sessions: plan?.max_sessions ?? null,
    secondary_sessions_used: row.secondary_sessions_used ?? 0,
    max_secondary_sessions: plan?.max_secondary_sessions ?? null,
    expires_at: row.expires_at ?? null,
    plan_name: plan?.name ?? null,
  };
}

/**
 * Traduce la respuesta de `move_session_credit` al shape de CreditEnrollment. Se
 * usa con spread sobre el crédito ya conocido, así que solo pisa lo que el RPC
 * devolvió con valor — un `plan_name` nulo no debe borrar el que ya teníamos.
 */
export function pickCreditFields(moved: any): Partial<CreditEnrollment> {
  const out: Partial<CreditEnrollment> = {
    sessions_used: moved?.sessions_used ?? 0,
    secondary_sessions_used: moved?.secondary_sessions_used ?? 0,
  };
  if (moved?.max_sessions !== undefined && moved?.max_sessions !== null) out.max_sessions = moved.max_sessions;
  if (moved?.max_secondary_sessions !== undefined && moved?.max_secondary_sessions !== null) out.max_secondary_sessions = moved.max_secondary_sessions;
  if (moved?.expires_at) out.expires_at = moved.expires_at;
  if (moved?.plan_name) out.plan_name = moved.plan_name;
  return out;
}

/** La inscripción con plan del atleta, o null si no maneja sesiones. */
/** ¿A esta inscripción le queda algo por consumir hoy, en la bolsa que toca? */
export function tieneSaldo(c: CreditEnrollment, isSecondary: boolean, today: string): boolean {
  if (c.expires_at && c.expires_at < today) return false;
  const usadas = isSecondary ? c.secondary_sessions_used : c.sessions_used;
  const tope   = isSecondary ? c.max_secondary_sessions  : c.max_sessions;
  return tope === null || usadas < tope;   // sin tope = ilimitado
}

/**
 * De cuál inscripción sale el crédito cuando el caller no dice cuál.
 *
 * Antes tomaba la más ANTIGUA (`created_at ASC limit 1`). Con dos inscripciones
 * activas con plan —el bug de doble inscripción reaparece cada tanto— eso
 * descontaba siempre de la vieja mientras la nueva, que es la que la familia
 * está pagando, no consumía nunca.
 *
 * Regla vigente (decidida 2026-08-16): **la que aún tiene saldo**. Es la que no
 * sorprende al entrenador — marcó presente y el atleta tenía clases, así que se
 * descontó de donde las tenía. Entre varias con saldo gana la que **vence
 * primero**: gastar antes lo que se vence antes es lo que menos plata le hace
 * perder a la familia.
 *
 * Si NINGUNA tiene saldo se devuelve igual la más antigua, para que el llamador
 * pueda distinguir `expired` de `no_credits` y decírselo al entrenador. Devolver
 * null acá sería reportar `no_plan`, que es mentira: plan hay, saldo no.
 *
 * ── Lo que esta heurística NO puede resolver ────────────────────────────────
 * El multideporte. Los dos casos reales que hay hoy en la base son atletas de
 * Club Campestre Demo con «Mensualidad Golf + Mensualidad Gimnasio» y
 * «Mensualidad Fútbol + Mensualidad Tenis»: las dos con saldo y sin
 * vencimiento, así que empatan y gana la más antigua. Adivinar desde acá cuál
 * corresponde a la disciplina de la sesión es imposible sin más contexto.
 *
 * Por eso el camino bueno es que el llamador mande `enrollmentId`: el roster ya
 * sabe cuál le está mostrando al entrenador. Equipo y sesión ya lo hacen. Esta
 * función es el respaldo para los que todavía no.
 */
export async function findCreditEnrollment(
  schoolId: string, athlete: AthleteRef, isSecondary = false, day?: string,
): Promise<CreditEnrollment | null> {
  const key = athleteKey(athlete);
  if (!key || !schoolId) return null;

  const { data } = await supabase
    .from('enrollments')
    .select(`id, sessions_used, secondary_sessions_used, expires_at, ${PLAN_JOIN}`)
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'active')
    .not('offering_plan_id', 'is', null)
    .order('created_at', { ascending: true });

  // Una inscripción en pausa no presta su crédito: se juzga con la fecha del
  // EVENTO, igual que el saldo más abajo, porque en una carga retroactiva
  // importa si estaba en vacaciones el día que entrenó, no si lo está hoy.
  const pausadas = await pausedEnrollmentIds(schoolId, day ?? todayString());
  const vivas = (data || []).filter((r: any) => !pausadas.has(r.id));

  const todas = vivas.map(toCreditEnrollment);
  if (!todas.length) return null;
  if (todas.length === 1) return todas[0];

  // En una carga retroactiva el saldo se juzga con la fecha del EVENTO: importa
  // si el plan estaba vigente el día que el atleta entrenó, no si lo está hoy.
  const conSaldo = todas.filter(c => tieneSaldo(c, isSecondary, day ?? todayString()));
  if (!conSaldo.length) return todas[0];   // la más antigua, para reportar el motivo

  // La que vence primero. `expires_at` nulo es "no vence": va al final.
  return conSaldo.sort((a, b) => (a.expires_at ?? '9999-12-31').localeCompare(b.expires_at ?? '9999-12-31'))[0];
}

/**
 * La inscripción exacta que pidió el caller. Se usa cuando la pantalla ya sabe
 * de cuál es el crédito — el roster lo resolvió y se lo mostró al entrenador —
 * en vez de dejar que `findCreditEnrollment` adivine por antigüedad.
 *
 * Filtra por `school_id` a propósito: el id viene del cliente y sin eso se
 * podría descontar de la inscripción de otra escuela.
 */
export async function loadCreditEnrollment(enrollmentId: string, schoolId: string): Promise<CreditEnrollment | null> {
  if (!enrollmentId || !schoolId) return null;

  const { data } = await supabase
    .from('enrollments')
    .select(`id, sessions_used, secondary_sessions_used, expires_at, ${PLAN_JOIN}`)
    .eq('id', enrollmentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  return data ? toCreditEnrollment(data) : null;
}

/**
 * Avisa cuando el plan llega a un HITO. No en cada clase.
 *
 * Notificar cada asistencia sería ruido: 800 atletas por 3 clases semanales son
 * ~2.400 avisos por semana, y el que importa se pierde entre ellos. Lo que
 * sirve —y lo que deja constancia— son tres momentos:
 *
 *   · `ultima`   se consumió la última clase del plan. Llega ANTES del
 *                conflicto, que es cuando todavía se puede hacer algo.
 *   · `excedida` entrenó por encima del tope.
 *   · `vencida`  entrenó con el plan ya vencido.
 *
 * Los dos últimos son el registro que la escuela necesita cuando la familia
 * reclama «nadie me avisó». Sin esto, la discusión es memoria contra memoria.
 *
 * Nunca revienta la asistencia: si el aviso falla, la clase ya quedó registrada
 * y eso es lo que no se puede perder.
 */
export type HitoPlan = 'ultima' | 'excedida' | 'vencida';

export async function avisarHitoDePlan(
  schoolId: string, athlete: AthleteRef, hito: HitoPlan,
  ctx: { fecha: string; plan?: string | null; tope?: number | null; usadas?: number | null },
): Promise<void> {
  try {
    // A quién: el acudiente si es menor, el propio atleta si es adulto.
    let destinatario: string | null = null;
    if (athlete.childId) {
      const { data } = await supabase.from('children').select('parent_id').eq('id', athlete.childId).maybeSingle();
      destinatario = (data as any)?.parent_id ?? null;
    } else if (athlete.userId) {
      destinatario = athlete.userId;
    }
    // El atleta no registrado no tiene a quién avisarle. La escuela sí se entera:
    // el hito le queda igual en «Plan vs consumo».
    if (!destinatario) return;

    const nombrePlan = ctx.plan?.trim() || 'tu plan';
    const textos: Record<HitoPlan, { title: string; message: string }> = {
      ultima: {
        title: '⏳ Se acabaron las clases del plan',
        message: `Con la clase del ${ctx.fecha} se consumió la última de ${nombrePlan}`
               + `${ctx.tope ? ` (${ctx.tope} de ${ctx.tope})` : ''}. `
               + 'Renueva para seguir entrenando sin interrupciones.',
      },
      excedida: {
        title: '⚠️ Clase por encima del plan',
        message: `La clase del ${ctx.fecha} quedó por encima de las ${ctx.tope ?? ''} de ${nombrePlan}. `
               + 'Queda registrada y la escuela puede facturarla aparte.',
      },
      vencida: {
        title: '⚠️ Clase con el plan vencido',
        message: `La clase del ${ctx.fecha} se dictó con ${nombrePlan} ya vencido. `
               + 'Queda registrada y la escuela puede facturarla aparte.',
      },
    };

    await supabase.from('notifications').insert({
      user_id:   destinatario,
      school_id: schoolId,
      type:      'attendance',
      title:     textos[hito].title,
      message:   textos[hito].message,
      link:      '/attendance',
      metadata:  { hito, fecha: ctx.fecha, plan: ctx.plan ?? null, tope: ctx.tope ?? null, usadas: ctx.usadas ?? null },
    });
  } catch (err) {
    // Deliberado: un aviso que falla no puede tumbar la toma de asistencia.
    console.error('[asistencia] no se pudo emitir el aviso de hito:', (err as any)?.message ?? err);
  }
}

/**
 * Mueve el saldo. `delta` +1 consume, -1 devuelve. Pasa por el RPC porque el
 * read-modify-write desde acá hacía que dos reservas simultáneas consumieran un
 * solo crédito (el RPC toma SELECT … FOR UPDATE sobre la inscripción).
 */
export async function moveCredit(enrollmentId: string, delta: 1 | -1, isSecondary: boolean): Promise<any> {
  const { data, error } = await supabase.rpc('move_session_credit', {
    p_enrollment_id: enrollmentId,
    p_delta: delta,
    p_is_secondary: isSecondary,
  });
  if (error) throw error;
  return data;
}

/**
 * Busca una reserva de HOY que la asistencia pueda consumir. Prioridad: la de
 * esta misma sesión; si no, la más temprana libre del día en la misma bolsa.
 * Sin esto, reservar a las 6pm y ser marcado presente en la sesión de las 4pm
 * descontaba dos clases por un solo entrenamiento.
 */
export async function findFreeBookingOfDay(
  schoolId: string, athlete: AthleteRef, day: string,
  isSecondary: boolean, preferSessionId?: string | null,
): Promise<FreeBooking | null> {
  if (!schoolId || !athleteKey(athlete)) return null;

  const { data: bks } = await supabase
    .from('session_bookings')
    .select('id, session_id, attendance_sessions!inner(session_date, start_time)')
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'confirmed')
    .eq('is_secondary', isSecondary)
    .eq('attendance_sessions.session_date', day);

  const candidates: FreeBooking[] = (bks || []).map((b: any) => ({
    source: 'session_bookings' as const,
    id: b.id,
    session_id: b.session_id,
    start_time: b.attendance_sessions?.start_time ?? null,
  }));

  // Las reservas de instalación consumen la bolsa secundaria, nunca la principal.
  if (isSecondary && !athlete.unregisteredId) {
    const { data: res } = await supabase
      .from('facility_reservations')
      .select('id, start_time')
      .eq('school_id', schoolId)
      .match(athlete.childId ? { child_id: athlete.childId } : { user_id: athlete.userId as string })
      .eq('reservation_date', day)
      .eq('status', 'confirmed');

    for (const r of res || []) {
      candidates.push({ source: 'facility_reservations', id: (r as any).id, session_id: null, start_time: (r as any).start_time ?? null });
    }
  }

  if (!candidates.length) return null;

  const exact = preferSessionId ? candidates.find(c => c.session_id === preferSessionId) : null;
  if (exact) return exact;

  return candidates.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))[0];
}

/**
 * Marca la reserva como usada. Es el candado que impide que la reserva de la
 * mañana absorba también la asistencia de la tarde: una reserva se consume una
 * sola vez.
 *
 * `facility_reservations` no se toca — su `status` es un enum/text con valores
 * propios y no admite 'attended'. Ahí el emparejamiento vale como guard pero sin
 * candado; el riesgo es acotado porque el slot de instalación es exclusivo
 * (`facility_reservations_unique_active_slot`), o sea una reserva por bloque.
 */
export async function consumeBooking(booking: FreeBooking): Promise<void> {
  if (booking.source !== 'session_bookings') return;
  await supabase.from('session_bookings')
    .update({ status: 'attended', updated_at: new Date().toISOString() })
    .eq('id', booking.id);
}

/** Devuelve a 'confirmed' la reserva que esta asistencia había consumido. */
export async function releaseConsumedBooking(
  schoolId: string, athlete: AthleteRef, day: string, isSecondary: boolean, sessionId?: string | null,
): Promise<boolean> {
  if (!schoolId || !athleteKey(athlete)) return false;

  let q = supabase
    .from('session_bookings')
    .select('id, session_id, attendance_sessions!inner(session_date)')
    .eq('school_id', schoolId)
    .match(athleteFilter(athlete))
    .eq('status', 'attended')
    .eq('is_secondary', isSecondary)
    .eq('attendance_sessions.session_date', day);

  if (sessionId) q = q.eq('session_id', sessionId);

  const { data } = await q.limit(1);
  const row = (data || [])[0];
  if (!row) return false;

  await supabase.from('session_bookings')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', (row as any).id);
  return true;
}


// ─────────────────────────────────────────────────────────────────────────────
// La sesión del equipo para un día NO es única.
//
// El índice único es (team_id, session_date, coalesce(start_time,'00:00')), así
// que un equipo con dos bloques reservables el mismo día tiene DOS filas. Las
// tres rutas de equipo resolvían con `.maybeSingle()`, que ante dos filas lanza
// PGRST116 y le devolvía al entrenador un 500 pelado: ese día el equipo entero
// se quedaba sin poder pasar lista. La rama de `offering` ya lo resolvía bien
// (409 `multiple_sessions_today`); esto lleva el mismo criterio a los equipos.
// ─────────────────────────────────────────────────────────────────────────────
export type TeamSessionRow = { id: string; finalized: boolean | null; start_time: string | null };
export type TeamSessionLookup =
  | { kind: 'none' }
  | { kind: 'one';  session: any }
  | { kind: 'many'; sessions: TeamSessionRow[] };

export async function findTeamSessionOfDay(
  teamId: string,
  date: string,
  columns = 'id, finalized, start_time',
): Promise<TeamSessionLookup> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(columns)
    .eq('team_id', teamId)
    .eq('session_date', date)
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) throw error;

  const rows = (data || []) as any[];
  if (rows.length === 0) return { kind: 'none' };
  if (rows.length === 1) return { kind: 'one', session: rows[0] };

  // Un bloque sin hora es la clase del día de toda la vida. Si hay exactamente
  // uno así, no hay ambigüedad: los demás son bloques reservables con horario.
  const sinHora = rows.filter(r => !r.start_time);
  if (sinHora.length === 1) return { kind: 'one', session: sinHora[0] };

  return { kind: 'many', sessions: rows as TeamSessionRow[] };
}
