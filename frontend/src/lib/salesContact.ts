/**
 * Contacto comercial único de SportMaps.
 *
 * Se configura con `VITE_SALES_WHATSAPP` (Vercel → Environment Variables).
 * Cuando la variable no está definida el literal de abajo ES el número que ve
 * el usuario en producción — no es "solo un fallback de desarrollo".
 *
 * El BFF tiene su propia copia en `SALES_WHATSAPP` (Render), usada en el 402
 * `trial_expired` de `requireOperationalSchool`. Mantener ambas iguales.
 */

/** Solo dígitos con indicativo país, como lo espera wa.me. */
export const SALES_WHATSAPP = (
    import.meta.env.VITE_SALES_WHATSAPP || '573202683539'
).replace(/\D/g, '');

/** El mismo número en formato legible: `+57 320 268 3539`. */
export const SALES_PHONE_DISPLAY =
    SALES_WHATSAPP.length === 12 && SALES_WHATSAPP.startsWith('57')
        ? `+57 ${SALES_WHATSAPP.slice(2, 5)} ${SALES_WHATSAPP.slice(5, 8)} ${SALES_WHATSAPP.slice(8)}`
        : `+${SALES_WHATSAPP}`;

/** Enlace `tel:` para teléfonos clicables (footer, páginas legales). */
export const SALES_PHONE_TEL = `tel:+${SALES_WHATSAPP}`;

/** Construye el enlace de WhatsApp, con mensaje pre-poblado opcional. */
export function salesWhatsappLink(message?: string): string {
    const base = `https://wa.me/${SALES_WHATSAPP}`;
    return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Abre WhatsApp en una pestaña nueva con el mensaje pre-poblado. */
export function openSalesWhatsapp(message?: string) {
    window.open(salesWhatsappLink(message), '_blank');
}
