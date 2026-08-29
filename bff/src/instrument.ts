// Debe ser el PRIMER import de index.ts — Sentry necesita instrumentar los
// módulos (express, http, etc.) antes de que index.ts los importe.
import dotenv from 'dotenv';
dotenv.config();

import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
        // Solo error monitoring (decisión: plan gratis, alcance mínimo) — sin
        // tracing/profiling. No mandar PII del usuario ni bodies de HTTP.
        dataCollection: {
            userInfo: false,
            httpBodies: [],
        },
    });
}
