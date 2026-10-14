/**
 * crons-solo-en-render — los trabajos programados (cola de WhatsApp,
 * recordatorios, informes, cobros…) solo arrancan en un servidor de Render.
 *
 * Por qué (2026-10-13): todos los ambientes comparten UNA base (Supabase de
 * producción). Un BFF levantado en un computador para probar arrancaba los
 * crons y tomaba la cola de WhatsApp de producción con código viejo y otra
 * llave de cifrado: 5 comprobantes de Dynasty se perdieron con
 * `token_decrypt_failed` entre el 10 y el 13 de octubre. Los interruptores
 * `DISABLE_*` en `bff/.env` no alcanzaban: cada copia del repo o cada sesión
 * que levanta su propio BFF puede no tenerlos.
 *
 * Render pone `RENDER=true` en todos sus servicios. Dentro de Render siguen
 * mandando los `DISABLE_*` de cada servicio (dev y stg los tienen apagados).
 * Para probar un cron en local hay que pedirlo explícito con
 * `CRONS_LOCALES=true`, y nunca con la base de producción.
 */
export function debenCorrerLosCrons(env: NodeJS.ProcessEnv = process.env): boolean {
    // Render define RENDER=true y RENDER_SERVICE_ID en todo servicio; con
    // cualquiera de las dos basta, para no apagar producción si una falta.
    if (String(env.RENDER ?? '').toLowerCase() === 'true') return true;
    if (String(env.RENDER_SERVICE_ID ?? '').startsWith('srv-')) return true;
    return String(env.CRONS_LOCALES ?? '').toLowerCase() === 'true';
}
