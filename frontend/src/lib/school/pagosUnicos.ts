/**
 * Pagos únicos al inscribirse (inscripción y seguro de accidentes).
 *
 * Regla de producto: NO son planes. Son campos del plan mensual
 * (offering_plans.registration_fee / insurance_fee; vacío/0 = no se cobra) y se
 * cobran una sola vez en el alta vía emit_enrollment_fees (el seguro, máximo una
 * vez cada 12 meses por atleta).
 *
 * Espejo del BFF: bff/src/utils/pagosUnicos.ts (mismo patrón y mismo mensaje;
 * el BFF responde 400 con code PAGO_UNICO_NO_ES_PLAN).
 */

export const PAGO_UNICO_NOMBRE_RE = /(inscrip|matr[ií]cula|seguro|p[oó]liza)/i;

export const PAGO_UNICO_NO_ES_PLAN_MSG =
    'La inscripción y el seguro no son planes: son pagos únicos. Configúralos en los campos «Inscripción» y «Seguro» del plan mensual.';

export const PAGOS_UNICOS_AYUDA =
    'Se cobran una sola vez al inscribir al atleta en este plan, aparte de la mensualidad. Vacío = no se cobra. El seguro se cobra máximo una vez cada 12 meses por atleta.';

export function esNombreDePagoUnico(nombre: string | null | undefined): boolean {
    return !!nombre && PAGO_UNICO_NOMBRE_RE.test(nombre);
}

const normalizar = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Bloquear solo al crear (nombreOriginal null) o al RENOMBRAR: los planes que ya
 * existen con esos nombres siguen editables mientras no les cambien el nombre.
 */
export function bloquearNombreDePlan(nombreNuevo: string, nombreOriginal: string | null): boolean {
    if (!esNombreDePagoUnico(nombreNuevo)) return false;
    if (nombreOriginal !== null && normalizar(nombreOriginal) === normalizar(nombreNuevo)) return false;
    return true;
}

/** Texto del formulario → valor a guardar. '' y 0 → null («no se cobra»). */
export function montoPagoUnico(valor: string | null | undefined): number | null {
    const limpio = (valor ?? '').toString().trim();
    if (!limpio) return null;
    const n = Number(limpio);
    return Number.isFinite(n) && n > 0 ? n : null;
}

const fmtCOP = (n: number) => new Intl.NumberFormat('de-DE').format(n);

/** «+ $120.000 inscripción · + $150.000 seguro (único)»; '' si no cobra ninguno. */
export function resumenPagosUnicos(plan: {
    registration_fee?: number | string | null;
    insurance_fee?: number | string | null;
}): string {
    const reg = Number(plan.registration_fee ?? 0);
    const seg = Number(plan.insurance_fee ?? 0);
    const partes: string[] = [];
    if (reg > 0) partes.push(`+ $${fmtCOP(reg)} inscripción`);
    if (seg > 0) partes.push(`+ $${fmtCOP(seg)} seguro`);
    if (partes.length === 0) return '';
    return `${partes.join(' · ')} (único)`;
}

/** Tarifas mensuales activas (duración ~1 mes) a las que aplica «aplicar a todos». */
export function esTarifaMensualActiva(plan: { is_active?: boolean | null; duration_days?: number | null }): boolean {
    const d = plan.duration_days ?? 30;
    return plan.is_active !== false && d >= 28 && d <= 31;
}
