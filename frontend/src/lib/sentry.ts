import * as Sentry from '@sentry/capacitor';
import * as SentryReact from '@sentry/react';

/**
 * @sentry/capacitor envuelve @sentry/react (no lo reemplaza) — mismo código
 * sirve para web y para la app nativa: en el navegador se comporta igual
 * que @sentry/react solo, y dentro de Capacitor además reporta crashes
 * nativos (Swift/Kotlin), que @sentry/react por sí solo NO captura.
 *
 * Solo error monitoring — sin tracing/replay/logging/metrics (decisión: plan
 * gratis, alcance mínimo). Sin VITE_SENTRY_DSN (dev local, o mientras no esté
 * configurado en un ambiente) esto es un no-op silencioso.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init(
    {
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.VITE_APP_ENV || 'production',
      // No mandar PII del usuario ni bodies de HTTP — decisión tomada en el
      // plan de mobile (Sentry día 1, sendDefaultPii: false).
      dataCollection: {
        userInfo: false,
        httpBodies: [],
      },
      // Ruido conocido de html5-qrcode (fallback web de @capacitor/barcode-scanner
      // en /coach-attendance/scan): rechazos internos de la librería que no pasan
      // por nuestro try/catch y no afectan al usuario — el botón de escanear
      // vuelve a su estado normal en ambos casos.
      ignoreErrors: [
        'Permission dismissed',
        'Cannot stop, scanner is not running or paused.',
      ],
    },
    SentryReact.init,
  );
}
