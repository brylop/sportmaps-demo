/**
 * Guard de la llave Wompi con la que el BFF abre un checkout de ESCUELA.
 *
 * Caso real (Dynasty, payment_mode='aggregator', comercio 1298966): el 2026-10-05
 * una familia entró por dev.sportmaps.co (referer en los logs de Supabase), el BFF
 * de dev devolvió SU llave de ENV — pub_test_, comercio sandbox 11981889 — y la
 * Edge Function wompi-sign firmó con el integrity secret de producción. Wompi creó
 * la transacción en el sandbox y respondió "La firma es inválida"
 * (tx=11981889-1791223373-75356). La base es UNA sola para dev/stg/prod, así que
 * cualquier BFF puede abrir el checkout de un cobro real.
 *
 * Reglas (la llave manda, no WOMPI_ENV — mismo criterio que DIN-9 para MP):
 *  1. Llaves de ENV ('env' = escuela en 'aggregator', una escuela REAL) con llave de
 *     prueba → rechazo, en cualquier ambiente. Un cobro real no se abre en sandbox.
 *  2. BFF de producción (NODE_ENV=production) con llave de prueba → rechazo, venga de
 *     donde venga.
 *  3. Llave de prueba en una cuenta propia marcada sandbox (Escuela Demo, 'direct')
 *     fuera de producción → permitido: es el único camino de prueba legítimo.
 */

export type FuenteLlave = 'school_direct' | 'vendor' | 'env' | undefined;

export type VeredictoLlaveCheckout =
    | { ok: true }
    | { ok: false; code: 'wompi_llave_prueba_escuela_real' | 'wompi_llave_prueba_en_produccion' | 'wompi_sin_llave'; motivo: string };

/** pub_test_ / prv_test_ son llaves del ambiente sandbox de Wompi. */
export function esLlaveDePruebaWompi(publicKey: string | null | undefined): boolean {
    return /^pub_test_/i.test(String(publicKey ?? '').trim());
}

export function validarLlaveCheckoutEscuela(
    r: { publicKey: string | null | undefined; source?: FuenteLlave },
    env: Record<string, string | undefined> = process.env,
): VeredictoLlaveCheckout {
    const publicKey = String(r.publicKey ?? '').trim();
    if (!publicKey) {
        return { ok: false, code: 'wompi_sin_llave', motivo: 'El BFF no tiene llave pública de Wompi para esta escuela.' };
    }
    if (!esLlaveDePruebaWompi(publicKey)) return { ok: true };

    if (r.source === 'env') {
        return {
            ok: false,
            code: 'wompi_llave_prueba_escuela_real',
            motivo: 'Llave de prueba (pub_test_) en las llaves de ENV, que son de una escuela real en aggregator.',
        };
    }
    if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
        return {
            ok: false,
            code: 'wompi_llave_prueba_en_produccion',
            motivo: 'Llave de prueba (pub_test_) en el BFF de producción.',
        };
    }
    return { ok: true };
}

/** Lo que ve la familia cuando el guard rechaza: claro y con salida. */
export const MENSAJE_CHECKOUT_NO_DISPONIBLE =
    'El pago en línea no está disponible desde aquí en este momento. '
    + 'Entra por app.sportmaps.co o paga por transferencia y sube tu comprobante.';
