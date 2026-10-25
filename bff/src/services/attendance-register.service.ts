/**
 * attendance-register.service — guardar una sesión de asistencia de equipo.
 *
 * Es la lógica de `POST /api/v1/attendance/session` extraída tal cual a un
 * servicio reusable (docs/specs/asistencia-rapida-checkin.md v1.3: nada de
 * INSERT directo a attendance_records). La usan:
 *   · el handler HTTP (routes/attendance.ts) — comportamiento idéntico;
 *   · la asistencia por WhatsApp (whatsapp-asistencia-staff.service.ts).
 *
 * Qué hace: resuelve/crea la sesión del equipo para la fecha, upsertea cada
 * registro con el RPC `upsert_attendance_record` (check_in_method='manual') y,
 * por cada transición ausente↔presente, mueve el crédito del plan, consume
 * reservas y dispara `avisarHitoDePlan`. Registrar NUNCA falla por falta de saldo.
 *
 * Parámetros nuevos (solo los usa WhatsApp; el handler HTTP no los manda):
 *   · finalized         → la sesión NUEVA se inserta YA finalizada
 *                         (finalized_at/by). Para días pasados: los triggers de
 *                         descuento y de aviso post-entreno disparan en el UPDATE
 *                         false→true, no en un INSERT con true (así el cierre
 *                         diario no manda avisos viejos). No aplica a una sesión
 *                         que ya existía abierta: esa no se cierra acá.
 *   · descontarCreditos → por defecto `!finalized`: una carga histórica no
 *                         descuenta clases ni avisa a las familias.
 *   · notes             → origen, va a attendance_sessions.coach_notes al CREAR
 *                         la sesión ('whatsapp_foto' | 'whatsapp_lista').
 */
import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import {
    athleteKey, findCreditEnrollment, loadCreditEnrollment, avisarHitoDePlan, moveCredit,
    findFreeBookingOfDay, consumeBooking, releaseConsumedBooking, findTeamSessionOfDay,
    type AthleteRef, type CreditOutcome,
} from './attendance-credits';

export const MULTIPLE_SESSIONS_MSG =
    'Este equipo tiene varios bloques hoy. Elige el bloque específico antes de pasar lista.';

export interface RegistroAsistencia {
    childId?: string; userId?: string; unregisteredAthleteId?: string;
    status: string; enrollmentId?: string; isSecondary?: boolean;
}

export interface GuardarSesionParams {
    schoolId: string;
    teamId?: string;
    sessionId?: string;
    /** YYYY-MM-DD de trabajo, ya validada por quien llama (resolverFechaDeTrabajo). */
    date: string;
    esRetroactiva?: boolean;
    records: RegistroAsistencia[];
    /** auth.users.id de quien marca (req.user.id, o el coach que escribió por WhatsApp). */
    markedBy: string | null;
    finalized?: boolean;
    descontarCreditos?: boolean;
    notes?: string | null;
    /** Chequeo de pertenencia sobre una sesión existente (solo el handler HTTP lo necesita). */
    autorizarSesionExistente?: (s: { team_id: string | null; offering_id: string | null }) =>
        Promise<{ status: number; body: Record<string, unknown> } | null>;
}

export type GuardarSesionResultado =
    | { ok: true; sessionId: string; date: string; creditOutcomes: Record<string, CreditOutcome>; sesionCreada: boolean }
    | { ok: false; status: number; body: Record<string, unknown> };

export async function guardarSesionAsistencia(p: GuardarSesionParams): Promise<GuardarSesionResultado> {
    const { schoolId, teamId, sessionId, records, markedBy } = p;
    const today = p.date;
    let existingSessionId = sessionId;

    if (existingSessionId) {
        const { data: existing, error } = await supabase.from('attendance_sessions').select('id, finalized, team_id, offering_id').eq('id', existingSessionId).maybeSingle();
        if (error) throw error;
        if (existing?.finalized) return { ok: false, status: 409, body: { error: 'La sesión ya fue finalizada y no puede modificarse.', finalized: true } };
        if (p.autorizarSesionExistente && existing) {
            const denegado = await p.autorizarSesionExistente(existing as any);
            if (denegado) return { ok: false, ...denegado };
        }
    } else if (teamId) {
        const lookup = await findTeamSessionOfDay(teamId, today);
        if (lookup.kind === 'many') {
            return {
                ok: false, status: 409,
                body: { error: MULTIPLE_SESSIONS_MSG, reason: 'multiple_sessions_today', sessions: lookup.sessions },
            };
        }
        if (lookup.kind === 'one') {
            if (lookup.session.finalized)
                return {
                    ok: false, status: 409,
                    body: {
                        error: p.esRetroactiva
                            ? `La lista del ${today} ya fue cerrada. Para corregirla hay que reabrir la sesión primero.`
                            : 'La sesión de hoy ya fue finalizada.',
                        finalized: true,
                        reason: 'session_finalized',
                        sessionId: lookup.session.id,
                    },
                };
            existingSessionId = lookup.session.id;
        }
    }

    let finalSessionId = existingSessionId;
    let sesionCreada = false;
    if (!finalSessionId && teamId) {
        const { data: staffData } = await supabase
            .from('school_staff')
            .select('id')
            .eq('coach_auth_id', markedBy)
            .eq('school_id', schoolId)
            .maybeSingle();

        const insert: Record<string, unknown> = {
            school_id: schoolId,
            team_id: teamId,
            session_date: today,
            created_by: markedBy,
            coach_id: staffData?.id || null,
        };
        if (p.notes) insert.coach_notes = p.notes;
        if (p.finalized) {
            insert.finalized = true;
            insert.finalized_at = new Date().toISOString();
            insert.finalized_by = markedBy;
        }
        const { data: session, error } = await supabase.from('attendance_sessions')
            .insert(insert)
            .select('id, finalized').single();
        if (error) throw error;
        finalSessionId = session.id;
        sesionCreada = true;
    }
    if (!finalSessionId) return { ok: false, status: 404, body: { error: 'No se pudo encontrar o crear la sesión.' } };

    const upsertRecord = async (record: RegistroAsistencia) => {
        const { error } = await supabase.rpc('upsert_attendance_record', {
            p_school_id:       schoolId,
            p_session_id:      finalSessionId,
            p_attendance_date: today,
            p_status:          record.status,
            p_team_id:         teamId              || null,
            p_marked_by:       markedBy            || null,
            p_child_id:        record.childId      || null,
            p_user_id:         record.userId       || null,
            p_unregistered_id: record.unregisteredAthleteId || null,
        });
        if (error) throw error;
    };

    // Estado previo, para mover créditos por transición.
    const prevByAthlete: Record<string, string> = {};
    const { data: prevRecords } = await supabase
        .from('attendance_records')
        .select('status, child_id, user_id, unregistered_athlete_id')
        .eq('session_id', finalSessionId);
    for (const r of prevRecords || []) {
        const key = (r as any).child_id ?? (r as any).user_id ?? (r as any).unregistered_athlete_id;
        if (key) prevByAthlete[key] = (r as any).status;
    }

    for (const record of records) {
        await upsertRecord(record);
    }

    const creditOutcomes: Record<string, CreditOutcome> = {};
    const descontar = p.descontarCreditos ?? !p.finalized;

    for (const record of descontar ? records : []) {
        const athlete: AthleteRef = {
            childId: record.childId, userId: record.userId, unregisteredId: record.unregisteredAthleteId,
        };
        const key = athleteKey(athlete);
        if (!key) continue;

        const wasPresent   = prevByAthlete[key] === 'present';
        const isNowPresent = record.status === 'present';
        if (wasPresent === isNowPresent) continue;

        const isSecondary = record.isSecondary === true;

        // La inscripción que mandó la pantalla manda sobre la heurística.
        const credit = record.enrollmentId
            ? await loadCreditEnrollment(record.enrollmentId, schoolId)
            : await findCreditEnrollment(schoolId, athlete, isSecondary, today);
        if (!credit) { creditOutcomes[key] = 'no_plan'; continue; }

        if (isNowPresent) {
            const freeBooking = await findFreeBookingOfDay(schoolId, athlete, today, isSecondary, finalSessionId);
            if (freeBooking) {
                await consumeBooking(freeBooking);
                creditOutcomes[key] = 'covered_by_booking';
                continue;
            }
            if (credit.expires_at && credit.expires_at < today) {
                creditOutcomes[key] = 'expired';
                await avisarHitoDePlan(schoolId, athlete, 'vencida',
                    { fecha: today, plan: credit.plan_name, tope: credit.max_sessions });
                continue;
            }
            const usadas = isSecondary ? credit.secondary_sessions_used : credit.sessions_used;
            const tope   = isSecondary ? credit.max_secondary_sessions  : credit.max_sessions;
            if (tope !== null && usadas >= tope) {
                creditOutcomes[key] = 'no_credits';
                await avisarHitoDePlan(schoolId, athlete, 'excedida',
                    { fecha: today, plan: credit.plan_name, tope, usadas });
                continue;
            }
            const moved = await moveCredit(credit.id, 1, isSecondary);
            creditOutcomes[key] = moved?.moved ? 'deducted' : 'no_credits';
            if (moved?.moved && tope !== null && usadas + 1 >= tope) {
                await avisarHitoDePlan(schoolId, athlete, 'ultima',
                    { fecha: today, plan: credit.plan_name, tope, usadas: usadas + 1 });
            }
        } else {
            const released = await releaseConsumedBooking(schoolId, athlete, today, isSecondary, finalSessionId);
            if (released) { creditOutcomes[key] = 'booking_released'; continue; }
            const moved = await moveCredit(credit.id, -1, isSecondary);
            creditOutcomes[key] = moved?.moved ? 'returned' : 'unchanged';
        }
    }

    return { ok: true, sessionId: finalSessionId, date: today, creditOutcomes, sesionCreada };
}


// ─── Fecha de trabajo (movida de routes/attendance.ts sin cambios) ───
// ─────────────────────────────────────────────────────────────────────────────
// Carga retroactiva — decisiones de producto del 2026-08-16
//
// Hasta hoy la asistencia solo se podía tomar del día en curso: las tres rutas
// de escritura calculaban la fecha adentro y no había forma de mandarla. El
// entrenador que olvidaba un martes no tenía cómo completarlo, y terminábamos
// cargándolo nosotros por SQL.
//
//   · Quién   → el entrenador hasta 7 días atrás (default de plataforma; cada
//               escuela lo cambia en school_settings.coach_attendance_retro_days,
//               mig 20260926124337 — Carmel lo tiene en 90 para completar agosto
//               2026); la administración sin tope. La regla de fondo: quien
//               responde por la plata puede reescribir más lejos que quien solo
//               pasa lista.
//   · Créditos→ se descuentan evaluando el saldo COMO ESTABA ESE DÍA (el plan
//               vencido se compara contra la fecha del evento, no contra hoy).
//               Sin saldo, la asistencia se registra igual y se avisa — misma
//               regla que en el día corriente.
//   · Cerrado → una sesión finalizada se puede reabrir solo si su fecha cae
//               dentro de la ventana de quien lo pide.
//
// No hay columna que marque el registro como retroactivo: la trazabilidad va
// por `security_audit_log`, que guarda quién, cuándo y para qué fecha.
// ─────────────────────────────────────────────────────────────────────────────
/** Default de plataforma. `school_settings.coach_attendance_retro_days` lo cambia por escuela. */
export const RETRO_DIAS_COACH = 7;

/** Roles que pueden reescribir cualquier fecha. `req.role` sale de school_members. */
export const ROLES_SIN_TOPE = ['owner', 'super_admin', 'admin', 'school_admin', 'school'];

/**
 * Ventana retroactiva del entrenador para ESTA escuela. Se consulta solo cuando
 * hace falta (coach + fecha distinta de hoy). Ante cualquier duda —sin escuela,
 * error de lectura, valor raro— vuelve al default de plataforma: nunca abre más
 * de lo que la escuela configuró.
 */
export async function retroDiasCoachDeEscuela(schoolId: string | undefined | null): Promise<number> {
  if (!schoolId) return RETRO_DIAS_COACH;
  const { data, error } = await supabase
    .from('school_settings')
    .select('coach_attendance_retro_days')
    .eq('school_id', schoolId)
    .maybeSingle();
  const n = Number((data as any)?.coach_attendance_retro_days);
  if (error || !Number.isInteger(n) || n < 0) return RETRO_DIAS_COACH;
  return n;
}

export type FechaResuelta =
  | { ok: true; date: string; esRetroactiva: boolean }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Traduce la fecha pedida a la fecha de negocio con la que se va a escribir, y
 * decide si quien la pide tiene permiso para esa fecha.
 *
 * Sin `pedida` se comporta como siempre: hoy. Así ninguna llamada vieja cambia
 * de significado por este agregado.
 */
export async function resolverFechaDeTrabajo(
  pedida: string | undefined | null,
  rol: string,
  schoolId?: string | null,
): Promise<FechaResuelta> {
  const hoy = todayInZone();
  if (!pedida || pedida === hoy) return { ok: true, date: hoy, esRetroactiva: false };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(pedida)) {
    return { ok: false, status: 400, body: { error: 'La fecha debe venir como YYYY-MM-DD.' } };
  }
  if (pedida > hoy) {
    return {
      ok: false, status: 400,
      body: { error: 'No se puede pasar lista de un día que todavía no llegó.', reason: 'future_date' },
    };
  }

  if (ROLES_SIN_TOPE.includes(rol)) return { ok: true, date: pedida, esRetroactiva: true };

  // El coach: solo dentro de la ventana de SU escuela. La resta se hace sobre
  // la fecha de negocio, no sobre Date.now(), para no volver a mezclar UTC con
  // Colombia.
  const retroDias = await retroDiasCoachDeEscuela(schoolId);
  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - retroDias);
  const limiteStr = limite.toISOString().slice(0, 10);

  if (pedida < limiteStr) {
    return {
      ok: false, status: 403,
      body: {
        error: `Como entrenador puedes completar hasta ${retroDias} días atrás (desde el ${limiteStr}). `
             + 'Para una fecha más antigua, pídeselo a la administración de la escuela.',
        reason: 'retro_window_exceeded',
        limite: limiteStr,
        dias_permitidos: retroDias,
      },
    };
  }
  return { ok: true, date: pedida, esRetroactiva: true };
}
