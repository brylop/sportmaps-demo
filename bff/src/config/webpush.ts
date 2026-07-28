// bff/src/config/webpush.ts
//
// Init de `web-push` (VAPID) para el canal Web Push del despachador unificado.
// Lee VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT del env (Render).
//
// El VAPID_PUBLIC_KEY debe ser IDÉNTICO al VITE_VAPID_PUBLIC_KEY del frontend
// (Vercel) — si difieren, el navegador rechaza el push en silencio.
//
// Si falta cualquiera de las 3 vars, web push queda DESHABILITADO (no-op seguro,
// igual criterio que firebase.ts): isWebPushConfigured() = false.

import webpush from 'web-push';
import dotenv from 'dotenv';

dotenv.config();

let configured = false;
let tried = false;

/** True si VAPID está configurado. Idempotente (setVapidDetails una sola vez). */
export function isWebPushConfigured(): boolean {
    if (tried) return configured;
    tried = true;

    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!pub || !priv || !subject) {
        console.warn('[webpush] VAPID incompleto (VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT). Web push DESHABILITADO.');
        return false;
    }

    try {
        webpush.setVapidDetails(subject, pub, priv);
        configured = true;
        console.log('[webpush] VAPID configurado (web push habilitado).');
    } catch (err) {
        console.error('[webpush] setVapidDetails falló:', (err as Error).message);
        configured = false;
    }
    return configured;
}

export { webpush };
