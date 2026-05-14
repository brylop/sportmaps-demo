import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Cargar variables de entorno PRIMERO, antes de cualquier import que las use
dotenv.config();

import studentsRouter from './routes/students';
import createOneRouter from './routes/students-create-one.route';
import enrollmentsRouter from './routes/enrollments';
import reportsRouter from './routes/reports';
import wompiRouter from './routes/wompi';
import { webhookRouter as mpWebhookRouter, paymentsRouter as mpPaymentsRouter } from './routes/mercadopago';
import paymentProvidersRouter from './routes/payment-providers.routes';
import attendanceRouter from './routes/attendance';
import schoolContextRouter from './routes/school-context';
import offeringsRouter from './routes/offerings';
import sessionBookingsRouter from './routes/session-bookings';
import sportConfigsRouter from './routes/sport-configs';
import billingEventsRouter from './routes/billing-events';
import explorarRoutes from './routes/explorar.routes';
import favoritosRoutes from './routes/favoritos.routes';
import schoolStaffRouter from './routes/school-staff';
import paymentsRouter from './routes/payments.routes';
import adminPaymentsRouter from './routes/admin-payments.routes';
import paymentTokensRouter from './routes/payment-tokens.routes';
import recurringRouter from './routes/recurring.routes';
import { vendorPayoutsRouter, adminPayoutsRouter } from './routes/vendor-payouts.routes';
import vendorBankAccountsRouter from './routes/vendor-bank-accounts.routes';
import shippingRouter, { shippingWebhookRouter, vendorShippingRouter } from './routes/shipping.routes';
import { requireTrainerAuth, requireAthleteAuth } from './middlewares/authMiddleware';
import systemRouter from './routes/system';
import { initMaintenanceJobs } from './jobs/maintenance.job';
import organizerRouter from './routes/organizers.route';
import eventsRouter from './routes/events.route';
import templatesRouter from './routes/templates';
import pollsRouter from './routes/polls';
import schoolDelegationsRouter from './routes/school-delegations.route';
import marketplaceRouter from './routes/marketplace.routes';
import marketplaceCatalogRouter from './routes/marketplace-catalog.routes';
import marketplaceAdminRouter from './routes/marketplace-admin.routes';
import reviewsRouter from './routes/reviews.routes';
import marketplaceCheckoutRouter from './routes/marketplace-checkout.routes';
import vendorRouter from './routes/vendor.routes';
import vendorProductsRouter from './routes/vendor-products.routes';
import vendorServicesRouter from './routes/vendor-services.routes';
import marketplaceOrdersRouter from './routes/marketplace-orders.routes';
import ogPreviewRouter from './routes/og-preview.routes';
import certificatesRouter from './routes/certificates';
import joinQrRouter from './routes/join-qr';

import trainerProfileRouter from './routes/trainer/profile';
import trainerOnboardingRouter from './routes/trainer/onboarding';
import trainerWorkspaceRouter from './routes/trainer/workspace';
import trainerClientsRouter from './routes/trainer/clients';
import trainerAvailabilityRouter from './routes/trainer/availability';
import trainerRoutinesRouter from './routes/trainer/routines';
import trainerTrainingPlansRouter from './routes/trainer/training-plans';
import trainerWgerRouter from './routes/trainer/wger';
import trainerBiomechRouter from './routes/trainer/biomech';

import athleteStatsRouter from './routes/athlete/stats';
import athleteTrainingRouter from './routes/athlete/training';
import athleteBiomechRouter from './routes/athlete/biomech';
import bulkUploadRouter from './routes/athletes/bulkUpload';
import meRouter from './routes/me.routes';
import upgradeRequestsRouter from './routes/upgrade-requests.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario para express-rate-limit en entornos con proxy (Render, Vercel, Heroku)
app.set('trust proxy', 1);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 200 : 2000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en 15 minutos.' },
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Límite de operaciones de pago alcanzado. Intenta en 1 minuto.' },
});

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
    // Prevent profile leaking by disabling all caching for API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// CORS: allowlist explicito en lugar de wildcards amplios.
//
// El comodin previo `*.vercel.app` permitia requests credenciados desde
// CUALQUIER app hospedada en Vercel (millones), no solo nuestros previews.
// Una app comprometida en otro proyecto Vercel podia montar CSRF contra
// nuestro BFF con cookies de usuario.
//
// Ahora:
//   - Whitelist exacta (FRONTEND_URL + sportmaps.co + app.sportmaps.co).
//   - Subdominios *.sportmaps.co siguen permitidos (controlamos el DNS).
//   - Previews de Vercel: pattern restringido al proyecto via env
//     CORS_PREVIEW_PATTERN (regex). Ejemplo: ^sportmaps-[\w-]+\.vercel\.app$
//   - Origenes adicionales via CORS_EXTRA_ORIGINS (CSV).
const previewPattern = process.env.CORS_PREVIEW_PATTERN
    ? new RegExp(process.env.CORS_PREVIEW_PATTERN)
    : null;
const extraOrigins = new Set(
    (process.env.CORS_EXTRA_ORIGINS ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
);

app.use(cors({
    origin: (origin, callback) => {
        // Postman/curl/server-to-server no envian origin
        if (!origin) return callback(null, true);
        // Localhost en dev
        if (origin.startsWith('http://localhost:')) return callback(null, true);

        const allowedProductionDomain = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

        const exactAllowed =
            origin === allowedProductionDomain ||
            origin === 'https://sportmaps.co' ||
            origin === 'https://app.sportmaps.co' ||
            extraOrigins.has(origin);

        if (exactAllowed) return callback(null, true);

        // Subdominios de sportmaps.co (dev.sportmaps.co, staging.sportmaps.co, etc.).
        // Se valida URL parseada para evitar bypasses tipo "evil.sportmaps.co.attacker.io".
        try {
            const url = new URL(origin);
            if (url.hostname === 'sportmaps.co' || url.hostname.endsWith('.sportmaps.co')) {
                return callback(null, true);
            }
            if (previewPattern && previewPattern.test(url.hostname)) {
                return callback(null, true);
            }
        } catch {
            // origin malformado → bloquear
        }

        return callback(new Error('Bloqueado por CORS'));
    },
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(pinoHttp({
    customProps: (req) => ({ requestId: req.id }),
    // En producción no loguear bodies completos (pueden tener PII)
    serializers: {
        req: (req) => ({ method: req.method, url: req.url, id: req.id }),
        res: (res) => ({ statusCode: res.statusCode }),
    },
}));

// ── Archivos Estáticos ────────────────────────────────────────────────────────
app.use('/exercises', express.static(path.join(__dirname, '../public/exercises')));

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? '1.0.0',
    });
});

app.use('/api/v1/students', generalLimiter, studentsRouter);
app.use('/api/v1/students', generalLimiter, createOneRouter);
app.use('/api/v1/enrollments', generalLimiter, enrollmentsRouter);
app.use('/api/v1/reports', generalLimiter, reportsRouter);
app.use('/api/v1/webhooks/wompi', wompiRouter);
app.use('/api/v1/webhooks/mercadopago', mpWebhookRouter);
app.use('/api/v1/payments/mp', paymentLimiter, mpPaymentsRouter);
app.use('/api/v1/payment-providers', generalLimiter, paymentProvidersRouter);
app.use('/api/v1/attendance', generalLimiter, attendanceRouter);
app.use('/api/v1/school/context', generalLimiter, schoolContextRouter);
app.use('/api/v1/me', generalLimiter, meRouter);
app.use('/api/v1/upgrade-requests', generalLimiter, upgradeRequestsRouter);
app.use('/api/v1/offerings', generalLimiter, offeringsRouter);
app.use('/api/v1/sessions', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/session-bookings', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/sport-configs', generalLimiter, sportConfigsRouter);
app.use('/api/v1/billing-events', generalLimiter, billingEventsRouter);
app.use('/api/explorar',  generalLimiter, explorarRoutes);
app.use('/api/favoritos', generalLimiter, favoritosRoutes);
app.use('/api/v1/school-staff', generalLimiter, schoolStaffRouter);
app.use('/api/v1/payments', paymentLimiter, paymentsRouter);
app.use('/api/v1/admin/payments', generalLimiter, adminPaymentsRouter);
app.use('/api/v1/payment-tokens', generalLimiter, paymentTokensRouter);
app.use('/api/v1/recurring', paymentLimiter, recurringRouter);
app.use('/api/v1/vendor', generalLimiter, vendorPayoutsRouter);
app.use('/api/v1/vendor/bank-accounts', generalLimiter, vendorBankAccountsRouter);
// Shipping publico: /api/v1/shipping/{quote,carriers,tracking/:n}
app.use('/api/v1/shipping', generalLimiter, shippingRouter);
// Shipping vendor: /api/v1/vendor/shipping/settings y /api/v1/vendor/shipments
app.use('/api/v1', generalLimiter, vendorShippingRouter);
// Webhook publico del provider de envios
app.use('/api/v1/webhooks/shipping', shippingWebhookRouter);
app.use('/api/v1/admin', generalLimiter, adminPayoutsRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/organizer', generalLimiter, organizerRouter);
app.use('/api/v1/events', generalLimiter, eventsRouter);
app.use('/api/v1/school/delegations', generalLimiter, schoolDelegationsRouter);
app.use('/api/v1/templates', generalLimiter, templatesRouter);
app.use('/api/v1/polls', generalLimiter, pollsRouter);

// ── Marketplace routes ──────────────────────────────────────────────────────
app.use('/api/v1/marketplace', generalLimiter, marketplaceRouter);
app.use('/api/v1/marketplace', generalLimiter, marketplaceCatalogRouter);
app.use('/api/v1/admin', generalLimiter, marketplaceAdminRouter);
// Reviews + Q&A: rutas publicas y autenticadas mezcladas — el router las separa internamente
app.use('/api/v1', generalLimiter, reviewsRouter);
app.use('/api/v1/marketplace', paymentLimiter, marketplaceCheckoutRouter);
app.use('/api/v1/vendor', generalLimiter, vendorRouter);
app.use('/api/v1/vendor/products', generalLimiter, vendorProductsRouter);
app.use('/api/v1/vendor/services', generalLimiter, vendorServicesRouter);
app.use('/api/v1/marketplace/orders', paymentLimiter, marketplaceOrdersRouter);
app.use('/api/v1/certificates', generalLimiter, certificatesRouter);
app.use('/api/v1/join-qr', generalLimiter, joinQrRouter);

// ── Social sharing — OG meta tags for crawlers ──────────────────────────────
app.use('/share', ogPreviewRouter);

// ── Trainer routes ────────────────────────────────────────────────────────────
// Ruta pública (sin requireAuth): perfil público de un entrenador
app.use('/api/v1/trainer', generalLimiter, trainerProfileRouter);

// Rutas del catálogo (temporalmente sin auth para disparar carga)
app.use('/api/v1/trainer', generalLimiter, trainerWgerRouter);

// Rutas autenticadas del entrenador personal: usan requireTrainerAuth, NO requireAuth
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerOnboardingRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerWorkspaceRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerClientsRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerAvailabilityRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerRoutinesRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerTrainingPlansRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerBiomechRouter);

// Rutas autenticadas del atleta: usa requireAthleteAuth
app.use('/api/v1/athlete', generalLimiter, requireAthleteAuth, athleteStatsRouter);
app.use('/api/v1/athlete', generalLimiter, requireAthleteAuth, athleteTrainingRouter);
app.use('/api/v1/athlete', generalLimiter, requireAthleteAuth, athleteBiomechRouter);
app.use('/api/v1/athletes', bulkUploadRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// ── Error handler centralizado ────────────────────────────────────────────────
// IMPORTANTE: debe tener 4 parámetros para que Express lo reconozca como error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // pino-http adjunta req.log en cada request
    (req as any).log?.error({ err }, 'Unhandled error');

    const message = process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor.'
        : err.message;

    res.status(500).json({ error: message });
});

app.listen(PORT, () => {
    console.log(`🚀 BFF corriendo en http://localhost:${PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
    
    // Iniciar trabajos de mantenimiento programados
    initMaintenanceJobs();
});

