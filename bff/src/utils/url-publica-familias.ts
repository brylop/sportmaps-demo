/**
 * url-publica-familias — las URLs que van DENTRO de un mensaje a familias
 * (correo o WhatsApp): el enlace de pago /p/:token, el PNG del QR y "ver mis
 * pagos".
 *
 * POR QUÉ NO SE LEE FRONTEND_URL
 *
 * El 2026-10-05 salieron 304 correos de estado de cuenta de Dynasty con el
 * botón «Ver y pagar» apuntando a LOCALHOST: el script se corrió desde un
 * computador de desarrollo y leyó `FRONTEND_URL` del .env local. Y aunque se
 * corra en Render, los TRES BFF (dev/stg/prod) comparten la base y corren los
 * mismos cron: el que gane la reserva manda el correo con SU FRONTEND_URL, así
 * que una familia real podía recibir un enlace a dev o a staging.
 *
 * Regla: los enlaces a familias salen de constantes de PRODUCCIÓN. Se pueden
 * sobrescribir (`FAMILIAS_APP_URL`, `FAMILIAS_BFF_URL`, o `--frontend`/`--bff`
 * en los scripts), pero siempre pasan por `urlPublicaSegura`, que rechaza
 * localhost, IPs privadas, `.local` y todo lo que no sea https.
 *
 * Por qué app.sportmaps.co/p/ y no sportmaps.co/p/ (la base aprobada en el
 * botón de las plantillas de Meta): el redirect de la landing sportmaps.co/p/*
 * → app no funciona al 2026-10-05 (307 a www.sportmaps.co/p/… y 404). El
 * correo no está atado a la base aprobada en Meta, así que va directo a la app.
 */

export const APP_PUBLICA_PROD = 'https://app.sportmaps.co';
export const BFF_PUBLICO_PROD = 'https://bffprod.sportmaps.co';

export class UrlNoPublicaError extends Error {
    constructor(public readonly url: string, que: string) {
        super(`${que} apunta a ${url || '(vacío)'}: los mensajes van a familias reales, se necesita una URL https pública.`);
        this.name = 'UrlNoPublicaError';
    }
}

/**
 * Valida y normaliza (sin "/" final) una URL base que va a familias.
 * Lanza UrlNoPublicaError si no es https pública.
 */
export function urlPublicaSegura(url: string | null | undefined, que = 'La URL'): string {
    const crudo = String(url ?? '').trim().replace(/\/+$/, '');
    let u: URL;
    try {
        u = new URL(crudo);
    } catch {
        throw new UrlNoPublicaError(crudo, que);
    }
    const host = u.hostname.toLowerCase();
    const privada = host === 'localhost'
        || host.endsWith('.localhost')
        || host.endsWith('.local')
        || host.endsWith('.internal')
        || host === '0.0.0.0'
        || host === '[::1]' || host === '::1'
        || /^127\./.test(host)
        || /^10\./.test(host)
        || /^192\.168\./.test(host)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
        || !host.includes('.');
    if (u.protocol !== 'https:' || privada) throw new UrlNoPublicaError(crudo, que);
    return crudo;
}

/** Base de la app para familias. Env opcional, siempre validada. */
export function appPublica(override?: string | null): string {
    return urlPublicaSegura(override || process.env.FAMILIAS_APP_URL || APP_PUBLICA_PROD, 'El enlace de la app');
}

/** Base del BFF de producción (sirve el PNG del QR). Env opcional, siempre validada. */
export function bffPublico(override?: string | null): string {
    return urlPublicaSegura(override || process.env.FAMILIAS_BFF_URL || BFF_PUBLICO_PROD, 'La URL del BFF');
}

export const enlaceDeCobro = (appBase: string, token: string) =>
    `${appBase}/p/${encodeURIComponent(token)}`;

export const urlQrDeCobro = (bffBase: string, token: string) =>
    `${bffBase}/api/v1/public/cobro/${encodeURIComponent(token)}/qr.png`;
