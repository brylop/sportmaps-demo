// bff/src/config/firebase.ts
//
// Inicializacion lazy de firebase-admin para enviar push (FCM HTTP v1).
// Proyecto: sportmaps-b865b. firebase-admin v14 → API modular (subpaths).
//
// Resolucion de credenciales (en orden):
//   1. FIREBASE_SERVICE_ACCOUNT  → JSON del service account en BASE64 (Render).
//   2. FIREBASE_SERVICE_ACCOUNT_PATH → ruta a un .json local (dev).
//   3. GOOGLE_APPLICATION_CREDENTIALS → ruta estandar de Google (applicationDefault).
//
// Si NO hay ninguna, push queda DESHABILITADO (no se rompe el arranque del BFF):
// getMessaging() devuelve null y el push.service lo trata como no-op + warn.
//
// IMPORTANTE: el JSON del service account es SECRETO (Admin SDK ignora RLS).
// Nunca commitear el archivo ni loguear su contenido.

import { initializeApp, cert, applicationDefault, type App, type Credential } from 'firebase-admin/app';
import { getMessaging as adminGetMessaging, type Messaging } from 'firebase-admin/messaging';
import dotenv from 'dotenv';

dotenv.config();

let app: App | null = null;
let initTried = false;

function resolveCredential(): Credential | null {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (b64) {
        try {
            const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            return cert(json);
        } catch (err) {
            console.error('[firebase] FIREBASE_SERVICE_ACCOUNT no es base64(JSON) valido:', (err as Error).message);
            return null;
        }
    }

    // cert() acepta tambien una RUTA a un .json
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (path) {
        try {
            return cert(path);
        } catch (err) {
            console.error('[firebase] No se pudo leer FIREBASE_SERVICE_ACCOUNT_PATH:', (err as Error).message);
            return null;
        }
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return applicationDefault();
    }

    return null;
}

/** App admin singleton, o null si no hay credenciales configuradas. */
export function getFirebaseApp(): App | null {
    if (app) return app;
    if (initTried) return null; // ya fallo antes, no reintentar en cada request
    initTried = true;

    const credential = resolveCredential();
    if (!credential) {
        console.warn('[firebase] Sin credenciales (FIREBASE_SERVICE_ACCOUNT / _PATH). Push DESHABILITADO.');
        return null;
    }

    app = initializeApp({ credential });
    console.log('[firebase] Admin SDK inicializado (push habilitado).');
    return app;
}

/** Messaging del Admin SDK, o null si push no esta configurado. */
export function getMessaging(): Messaging | null {
    const a = getFirebaseApp();
    return a ? adminGetMessaging(a) : null;
}

export function isPushEnabled(): boolean {
    return getFirebaseApp() !== null;
}
