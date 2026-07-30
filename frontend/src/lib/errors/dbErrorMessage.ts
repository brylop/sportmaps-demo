/**
 * Traduce errores de Postgres/PostgREST a mensajes que una persona entiende.
 *
 * Nació de esto en pantalla:
 *   "No se pudo enviar la invitación: duplicate key value violates unique
 *    constraint ux_invitations_pending_unique"
 *
 * El nombre de una constraint no le dice nada a quien administra una escuela, y
 * encima esconde la acción que sí resolvería el problema. Cada entrada de este
 * mapa debe decir qué pasó **y** qué hacer al respecto.
 */

const BY_CONSTRAINT: Record<string, string> = {
    ux_invitations_pending_unique:
        'Ya existe una invitación pendiente para ese correo y ese atleta. Edítala desde la lista para cambiarle el equipo o el plan, en vez de crear una nueva.',
    uq_enrollment_child_plan:
        'Este atleta ya está inscrito en ese plan. Si quieres cambiarlo, retira el plan actual primero.',
    uq_enrollment_child_team:
        'Este atleta ya está inscrito en ese equipo.',
    uq_enrollment_user_plan:
        'Este deportista ya está inscrito en ese plan.',
    uq_enrollment_user_team:
        'Este deportista ya está inscrito en ese equipo.',
    uniq_payment_active_period_per_child:
        'Ya existe un cobro activo para este atleta en ese periodo. Revísalo en Gestión de Pagos antes de generar otro.',
};

/** Errores por código, cuando no se puede identificar la constraint. */
const BY_CODE: Record<string, string> = {
    '23505': 'Ese registro ya existe.',
    '23503': 'No se puede completar: hay información relacionada que debe existir primero.',
    '23514': 'Alguno de los datos no cumple las reglas de validación.',
    '42501': 'No tienes permisos para realizar esta acción.',
    'PGRST116': 'No se encontró el registro.',
};

export function dbErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
    if (!error) return fallback;

    const err = error as { message?: string; code?: string; details?: string; hint?: string };
    const raw = [err?.message, err?.details, err?.hint].filter(Boolean).join(' ');

    if (!raw) return typeof error === 'string' ? error : fallback;

    // 1. Por nombre de constraint — el mensaje más específico gana
    for (const [constraint, message] of Object.entries(BY_CONSTRAINT)) {
        if (raw.includes(constraint)) return message;
    }

    // 2. Los RAISE EXCEPTION de nuestras RPCs ya vienen redactados para humanos;
    //    se reconocen porque no traen jerga de Postgres. Va ANTES del mapa por
    //    código: si no, un mensaje nuestro con código 23505 quedaría sepultado
    //    bajo un genérico "Ese registro ya existe".
    const esJergaDeDb = /duplicate key|violates|constraint|relation |column |syntax error|null value in/i.test(raw);
    if (!esJergaDeDb) return raw;

    // 3. Por código de error, cuando no se pudo identificar nada mejor
    if (err?.code && BY_CODE[err.code]) return BY_CODE[err.code];

    return fallback;
}
