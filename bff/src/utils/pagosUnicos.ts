/**
 * Pagos únicos al inscribirse (inscripción y seguro de accidentes).
 *
 * Regla de producto: la inscripción y el seguro NO son planes. Son campos del
 * plan mensual (offering_plans.registration_fee / insurance_fee, NULL o 0 = no
 * se cobra) y emit_enrollment_fees los cobra una sola vez en el alta (el seguro,
 * máximo una vez cada 12 meses por atleta). Un plan llamado «Inscripción» o
 * «Seguro» cobraría como mensualidad recurrente: eso es lo que se bloquea acá.
 *
 * Espejo en frontend/src/lib/school/pagosUnicos.ts (mismo patrón y mensaje).
 */

export const PAGO_UNICO_NOMBRE_RE = /(inscrip|matr[ií]cula|seguro|p[oó]liza)/i;

export const PAGO_UNICO_NO_ES_PLAN_CODE = 'PAGO_UNICO_NO_ES_PLAN';

export const PAGO_UNICO_NO_ES_PLAN_MSG =
    'La inscripción y el seguro no son planes: son pagos únicos. Configúralos en los campos «Inscripción» y «Seguro» del plan mensual.';

export function esNombreDePagoUnico(nombre: string | null | undefined): boolean {
    return !!nombre && PAGO_UNICO_NOMBRE_RE.test(nombre);
}

const normalizar = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * ¿Bloquear este nombre? Solo al crear o al RENOMBRAR: los planes que ya existen
 * con esos nombres siguen editables mientras no les cambien el nombre.
 * `nombreActual` = null/undefined cuando se está creando.
 */
export function bloquearNombreDePlan(
    nombreNuevo: string | null | undefined,
    nombreActual?: string | null,
): boolean {
    if (nombreNuevo === undefined || nombreNuevo === null) return false; // PATCH sin nombre
    if (!esNombreDePagoUnico(nombreNuevo)) return false;
    if (nombreActual !== undefined && nombreActual !== null && normalizar(nombreActual) === normalizar(nombreNuevo)) {
        return false;
    }
    return true;
}

export const pagoUnicoNoEsPlanBody = () => ({
    error: PAGO_UNICO_NO_ES_PLAN_MSG,
    code: PAGO_UNICO_NO_ES_PLAN_CODE,
});
