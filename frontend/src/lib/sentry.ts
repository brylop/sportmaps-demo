import * as Sentry from '@sentry/react';

/**
 * Solo error monitoring — sin tracing/replay/logging/metrics (decisión: plan
 * gratis, alcance mínimo). Sin VITE_SENTRY_DSN (dev local, o mientras no esté
 * configurado en un ambiente) esto es un no-op silencioso.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.VITE_APP_ENV || 'production',
    // No mandar PII del usuario ni bodies de HTTP — decisión tomada en el
    // plan de mobile (Sentry día 1, sendDefaultPii: false).
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  });
}
