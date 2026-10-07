/**
 * wompi-link-con-monto — link de pago de Wompi con el VALOR EXACTO de un cobro.
 *
 * Por qué (2026-10-06): Dynasty publica un link estático de Wompi
 * (https://checkout.wompi.co/l/Hj5s7R) donde la familia ESCRIBE el valor y
 * después manda el comprobante para que la escuela concilie a mano. Lo que se
 * quiere es lo que hace cualquier tienda: «Aquí está tu link de pago, tienes 1
 * hora para pagar», con el monto ya puesto, y que al aprobarse el pago se
 * aplique solo.
 *
 * Cómo: Web Checkout de Wompi por URL (GET https://checkout.wompi.co/p/?…) con
 * amount-in-cents, reference SCH-* y signature:integrity, más expiration-time.
 * Verificado en docs.wompi.co el 2026-10-06. Se eligió sobre
 * POST /v1/payment_links porque:
 *   · la transacción conserva NUESTRA referencia SCH-*, y el webhook
 *     (/api/v1/webhooks/wompi/webhook → handleSchoolPayment) ya concilia por
 *     payment_links.wompi_reference: marca el cobro 'paid', crea el split y
 *     avisa a la escuela (notify_school_payment_paid) y al acudiente
 *     (notify_parent_payment_paid). Un payment link de la API crea
 *     transacciones con referencia de Wompi, que el webhook hoy ignora;
 *   · solo pide llave pública + secreto de integridad (no la privada);
 *   · no crea nada en Wompi: el link es una URL firmada, sin llamada de red.
 * El monto va dentro de la firma: si alguien lo cambia en la URL, Wompi
 * rechaza la transacción.
 *
 * Reglas (las mismas del pago en línea de /p/:token, ver
 * cobro-enlace-publico.service prepararCheckoutDeCobro): monto calculado en el
 * servidor (payments.amount + online_fee_pct de la escuela), solo cobros
 * pending/overdue sin revisión, pasarela por resolveProvider (fail-closed),
 * nunca sandbox ni llaves de ENV salvo los flags PAGO_PUBLICO_PERMITE_SANDBOX /
 * PAGO_PUBLICO_PERMITE_LLAVES_ENV. Sin credenciales → { ok:false,
 * code:'sin_pago_en_linea' } y quien llama sigue ofreciendo lo de antes (el
 * link estático de la escuela / la transferencia).
 *
 * Idempotente entre los 3 BFF: una sola payment_links 'pending' por cobro
 * (índice único). Dos llamadas seguidas devuelven la MISMA referencia; la URL
 * puede variar solo en expiration-time.
 *
 * Nunca lanza.
 */

import { emitirTokenCobro, leerCobroPorId, prepararCheckoutDeCobro, MINUTOS_LINK_CON_MONTO } from './cobro-enlace-publico.service';
import { appPublica, enlaceDeCobro } from '../utils/url-publica-familias';

export type LinkWompiConMonto =
    | {
        ok: true;
        /** URL de Wompi con el monto fijo, lista para mandar por WhatsApp. */
        url: string;
        /** Referencia SCH-* (la que concilia el webhook). */
        reference: string;
        /** Lo que paga la familia: monto del cobro + recargo en línea. */
        total: number;
        base: number;
        recargo: number;
        /** Hasta cuándo sirve el link (ISO UTC). */
        venceEn: string;
        /** Minutos de vigencia que se pidieron (para el texto «tienes X para pagar»). */
        minutos: number;
        /** true = se reusó la sesión 'pending' que ya existía para el cobro. */
        reused: boolean;
        /** Página pública del cobro (/p/:token): a donde vuelve tras pagar. */
        paginaCobro: string | null;
    }
    | { ok: false; code: string; error: string };

/**
 * Link de Wompi con el monto exacto del cobro `paymentId`.
 *
 * @param opts.minutos vigencia del link (por defecto 60).
 */
export async function crearLinkWompiConMonto(
    paymentId: string,
    opts: { minutos?: number } = {},
): Promise<LinkWompiConMonto> {
    const minutos = Math.max(5, Math.floor(opts.minutos ?? MINUTOS_LINK_CON_MONTO));
    try {
        const p = await leerCobroPorId(paymentId);
        if (!p) return { ok: false, code: 'no_existe', error: 'El cobro no existe.' };

        const out = await prepararCheckoutDeCobro(p, { minutosUrl: minutos });
        if (!out.ok) return { ok: false, code: out.code, error: out.error };

        // Vuelta tras pagar: la página pública del cobro, que muestra «Pagado» en
        // cuanto llega el webhook. redirect-url no entra en la firma.
        const token = await emitirTokenCobro(paymentId);
        let paginaCobro: string | null = null;
        try {
            paginaCobro = token ? enlaceDeCobro(appPublica(), token) : null;
        } catch {
            paginaCobro = null;
        }
        const url = paginaCobro
            ? `${out.checkoutUrl}&redirect-url=${encodeURIComponent(paginaCobro)}`
            : out.checkoutUrl;

        return {
            ok: true,
            url,
            reference: out.reference,
            total: out.total,
            base: out.base,
            recargo: out.recargo,
            venceEn: out.checkoutUrlVenceEn,
            minutos,
            reused: out.reused,
            paginaCobro,
        };
    } catch (e: any) {
        console.warn('[wompi-link-con-monto] no se pudo crear el link', { paymentId, error: e?.message });
        return { ok: false, code: 'error', error: 'No pudimos generar el link de pago.' };
    }
}
