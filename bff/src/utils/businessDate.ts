/**
 * businessDate — la fecha de negocio SIEMPRE en la zona de la escuela, nunca en UTC.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * El BFF corre en Render con el reloj en UTC, y Colombia es UTC-5. Entre las 19:00 y
 * la medianoche hora Colombia, UTC ya pasó al día siguiente: `new Date().toISOString()`
 * devuelve MAÑANA.
 *
 * Eso no es un caso borde para una escuela deportiva — es la franja principal. Un
 * entrenamiento de las 8 p.m. quedaba registrado con la fecha del día siguiente, y como
 * el crédito de sesión es máximo uno por atleta por día, la cuenta se descuadraba. Lo
 * mismo con `payment_date` de un pago aprobado de noche y con `start_date` de una
 * inscripción hecha después de las 7.
 *
 * Auditoría 2026-08-03: 15 lugares del BFF derivaban "hoy" de UTC, conviviendo con 16
 * que ya usaban Colombia. Dos criterios de fecha dentro del mismo servicio.
 *
 * CÓMO SE USA
 *
 *   const hoy = todayInZone();                 // '2026-08-03' en hora Colombia
 *   const hoy = todayInZone(school.timezone);  // cuando exista multi-país
 *
 * `en-CA` no es decorativo: es el locale cuyo formato corto es exactamente YYYY-MM-DD,
 * que es lo que espera Postgres en una columna `date`.
 *
 * MULTI-PAÍS
 *
 * `schools` todavía no tiene columna de zona horaria, así que el default es Colombia y
 * el parámetro queda listo para el día que exista. Cuando llegue, esto es lo único que
 * hay que cablear: el resto del BFF ya pasa por acá.
 */

/** Zona de negocio por defecto. Todas las escuelas son colombianas al 2026-08-03. */
export const DEFAULT_BUSINESS_TZ = 'America/Bogota';

/** 'YYYY-MM-DD' de HOY en la zona indicada. */
export function todayInZone(timeZone: string = DEFAULT_BUSINESS_TZ): string {
    return formatDateInZone(new Date(), timeZone);
}

/** 'YYYY-MM-DD' de una fecha concreta, leída en la zona indicada. */
export function formatDateInZone(d: Date, timeZone: string = DEFAULT_BUSINESS_TZ): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}

/**
 * Suma días a un 'YYYY-MM-DD' sin pasar por Date: aritmética de calendario pura, sin
 * husos ni horario de verano de por medio. Sumar con `setDate` sobre un Date construido
 * desde string es de donde salen los corrimientos de un día.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = Date.UTC(y, m - 1, d);
    return new Date(base + days * 86_400_000).toISOString().split('T')[0];
}
