// bff/src/routes/mobile.routes.ts
//
// Config que la app nativa (Capacitor) chequea al arrancar, para poder pedir
// una actualización cuando haya un cambio incompatible (ej. contrato de un
// endpoint de pago).
//
//   GET /api/v1/mobile/app-config   (publico, sin auth — se pide antes de login)
//
// Fuente de verdad: variables de entorno del BFF, no una tabla. Bajar la
// versión mínima es una decisión rara (un breaking change ya publicado) y
// cambiar un env var en Render no exige deploy — no hace falta abrir una
// tabla ni RLS nueva para un valor que de todos modos es público por diseño
// (se lee sin sesión).
//
// Decisión de producto (docs/MOBILE_ROADMAP_EXECUTION.md, Fase 6.3 #4):
// NO forzar actualización todavía — este endpoint solo expone el dato. La
// pantalla bloqueante que lo consulte y corte el paso es N2, a propósito.
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/app-config', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
        minVersion: {
            ios: process.env.MOBILE_MIN_VERSION_IOS || '1.0.0',
            android: process.env.MOBILE_MIN_VERSION_ANDROID || '1.0.0',
        },
        // Para el aviso opcional de "hay una version nueva" (no bloqueante).
        latestVersion: {
            ios: process.env.MOBILE_LATEST_VERSION_IOS || process.env.MOBILE_MIN_VERSION_IOS || '1.0.0',
            android: process.env.MOBILE_LATEST_VERSION_ANDROID || process.env.MOBILE_MIN_VERSION_ANDROID || '1.0.0',
        },
    });
});

export default router;
