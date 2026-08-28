import './instrument';
import * as Sentry from '@sentry/node';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Cargar variables de entorno PRIMERO, antes de cualquier import que las use
dotenv.config();

import studentsRouter from './routes/students';
import createOneRouter from './routes/students-create-one.route';
import enrollmentsRouter from './routes/enrollments';
import invitationsRouter from './routes/invitations.routes';
import reportsRouter from './routes/reports';
import wompiRouter from './routes/wompi';
import { webhookRouter as mpWebhookRouter, paymentsRouter as mpPaymentsRouter } from './routes/mercadopago';
import paymentProvidersRouter from './routes/payment-providers.routes';
import reconciliationRouter from './routes/reconciliation.routes';
import invoicingRouter from './routes/invoicing.routes';
import attendanceRouter from './routes/attendance';
import schoolContextRouter from './routes/school-context';
import offeringsRouter from './routes/offerings';
import sessionBookingsRouter from './routes/session-bookings';
import sportConfigsRouter from './routes/sport-configs';
import billingEventsRouter from './routes/billing-events';
import explorarRoutes from './routes/explorar.routes';
import favoritosRoutes from './routes/favoritos.routes';
import schoolStaffRouter from './routes/school-staff';
import facilitiesRouter from './routes/facilities';
import paymentsRouter from './routes/payments.routes';
import glosasRouter from './routes/glosas.routes';
import adminPaymentsRouter from './routes/admin-payments.routes';
import adminSupportRouter from './routes/admin-support.routes';
import supportRouter from './routes/support.routes';
import platformInvoicingRouter from './routes/platform-invoicing.routes';
import paymentTokensRouter from './routes/payment-tokens.routes';
import recurringRouter from './routes/recurring.routes';
import { vendorPayoutsRouter, adminPayoutsRouter } from './routes/vendor-payouts.routes';
import vendorBankAccountsRouter from './routes/vendor-bank-accounts.routes';
import shippingRouter, { shippingWebhookRouter, vendorShippingRouter } from './routes/shipping.routes';
import { requireTrainerAuth, requireAthleteAuth, requireAuth } from './middlewares/authMiddleware';
import { requireCsrfHeader } from './middlewares/csrfHeader';
import { requireOperationalSchool } from './middlewares/requireOperationalSchool';
import systemRouter from './routes/system';
import whatsappWebhookRouter from './routes/whatsapp';
import publicBookingRouter from './routes/public-booking.routes';
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
import equipmentActaRouter from './routes/equipment.route';
import joinQrRouter from './routes/join-qr';
import { assertMpEnvCoherente } from './services/mercadopago.service';
import admsRouter from './routes/access-adms';
import accessApiRouter from './routes/access-api';
import accessAdminRouter from './routes/access-admin.routes';
import bridgeRouter from './routes/bridge.routes';

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
import schoolPerformanceRouter from './routes/school/performance';
import schoolCompetitionResultsRouter from './routes/school/competition-results';
import schoolFootballRouter from './routes/school/football';
import schoolRoutinesRouter from './routes/school/routines';
import schoolReportsRouter from './routes/school/reports';
import athletePerformanceRouter from './routes/athlete/performance';
import bulkUploadRouter from './routes/athletes/bulkUpload';
import meRouter from './routes/me.routes';
import upgradeRequestsRouter from './routes/upgrade-requests.routes';
import schoolsRouter from './routes/schools.routes';
import customDomainsRouter from './routes/custom-domains.routes';
import devicesRouter from './routes/devices.routes';
import pwaRouter from './routes/pwa.routes';
import mobileRouter from './routes/mobile.routes';
import internalNotificationsRouter from './routes/internal-notifications.routes';

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

// El manifest y el icono de la PWA son publicos, de solo lectura y cacheados
// (5 min en proceso + 5 min en el navegador). Necesitan un limite MUCHO mas
// alto que el general: se piden desde cada dispositivo en cada arranque, y
// varias familias comparten IP en la wifi de la escuela. Con el cap general de
// 200/15min, Chrome recibiria un 429 en vez del manifest y la app dejaria de
// ser instalable sin mostrar ningun error.
const pwaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 2000 : 10000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'rate_limited' },
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Límite de operaciones de pago alcanzado. Intenta en 1 minuto.' },
});

// Cap especifico para alta/baja de tarjetas — anti card-testing fraud.
// Un atacante con cuenta valida que prueba numeros robados con micropagos
// puede crear muchos tokens rapidamente; este limit corta ese vector.
const cardAlterLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = (req as any).user?.id;
        return userId ? `card-alter-user-${userId}` : `card-alter-ip-${req.ip}`;
    },
    message: { error: 'Demasiadas operaciones sobre tus tarjetas guardadas. Intenta en 1 hora.' },
});

// ── Middlewares globales ──────────────────────────────────────────────────────
//
// helmet: setea cabeceras de seguridad sanas por defecto (HSTS, nosniff,
// frameguard DENY, X-DNS-Prefetch-Control, etc.).
//   - crossOriginEmbedderPolicy desactivado: rompe iframes legitimos (Wompi).
//   - contentSecurityPolicy desactivado: el BFF sirve JSON, no HTML — CSP
//     lo controla el frontend (Vercel).
//   - hsts: 1 anio, includeSubDomains. Solo aplica si servimos sobre HTTPS
//     (Render lo hace).
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
}));

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
// El `verify` callback guarda el RAW body para validar firmas HMAC sobre los
// bytes exactos (necesario para el webhook de WhatsApp: X-Hub-Signature-256).
// ANTES de express.json() — protocolo texto plano del F22
app.use('/', admsRouter);

app.use(express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
    },
}));
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

// Bloqueo por fin del periodo de prueba. Va ANTES de todos los routers para que
// no queden huecos por ruta olvidada: solo intercepta mutaciones y respeta una
// allowlist (webhooks, /me, /admin, pagos de familias). Los GET siempre pasan.
app.use('/api/v1', requireOperationalSchool);

app.use('/api/v1/students', generalLimiter, studentsRouter);
app.use('/api/v1/students', generalLimiter, createOneRouter);
app.use('/api/v1/enrollments', generalLimiter, enrollmentsRouter);
app.use('/api/v1/invitations', generalLimiter, invitationsRouter);
app.use('/api/v1/reports', generalLimiter, reportsRouter);
app.use('/api/v1/webhooks/wompi', wompiRouter);
// Webhook único multi-tenant de WhatsApp Cloud API (Bloque 6). Sin generalLimiter:
// Meta puede ráfagar; el control real es la firma HMAC + idempotencia por wa_message_id.
app.use('/api/v1/webhooks/whatsapp', whatsappWebhookRouter);

// Link público de agendamiento de instalaciones — sin requireAuth, rate-limit propio
const publicBookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.' },
});
app.use('/api/v1/public/booking', publicBookingLimiter, publicBookingRouter);

app.use('/api/v1/webhooks/mercadopago', mpWebhookRouter);
app.use('/api/v1/payments/mp', paymentLimiter, mpPaymentsRouter);
app.use('/api/v1/payment-providers', generalLimiter, paymentProvidersRouter);
app.use('/api/v1/invoicing', generalLimiter, invoicingRouter);
app.use('/api/v1/attendance', generalLimiter, attendanceRouter);
app.use('/api/v1/school/context', generalLimiter, schoolContextRouter);
app.use('/api/v1/me', generalLimiter, meRouter);
app.use('/api/v1/equipment/assignments', generalLimiter, equipmentActaRouter);
app.use('/api/v1/upgrade-requests', generalLimiter, upgradeRequestsRouter);
// Schools: branding (white-label), settings. Rate-limit propio del router
// (10/hora por escuela en branding). generalLimiter actua como segundo cap.
app.use('/api/v1/schools', generalLimiter, schoolsRouter);
// Dominios propios (Fase 5 — Enterprise) — montado tambien bajo /schools
// para alinear con el modelo "recurso de la escuela".
app.use('/api/v1/schools', generalLimiter, customDomainsRouter);
// Devices (Fase 6.1 — base mobile). Web/PWA tambien lo usa para tracking
// de adopcion. CSRF se aplica dentro del router para state-changing.
app.use('/api/v1/devices', generalLimiter, devicesRouter);
// Manifest dinamico de la PWA. PUBLICO y sin auth: el navegador lo pide antes
// de que exista sesion, y Vercel le reescribe /manifest.webmanifest hacia aca.
app.use('/api/v1/pwa', pwaLimiter, pwaRouter);
// Config de version minima que la app nativa chequea al arrancar. PUBLICO y
// sin auth, mismo motivo que el manifest: se pide antes de que exista sesion.
app.use('/api/v1/mobile', pwaLimiter, mobileRouter);
// Endpoint INTERNO del despachador de notificaciones (lo llama pg_net desde la
// DB). Sin JWT: se valida por header secreto (fail-closed). Sin generalLimiter:
// el disparo es 1 por notificación y el claim es idempotente por lease.
app.use('/internal/notifications', internalNotificationsRouter);
app.use('/api/v1/offerings', generalLimiter, offeringsRouter);
app.use('/api/v1/sessions', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/session-bookings', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/sport-configs', generalLimiter, sportConfigsRouter);
app.use('/api/v1/billing-events', generalLimiter, billingEventsRouter);
app.use('/api/explorar',  generalLimiter, explorarRoutes);
app.use('/api/favoritos', generalLimiter, favoritosRoutes);
app.use('/api/v1/school-staff', generalLimiter, schoolStaffRouter);
app.use('/api/v1/facilities', generalLimiter, facilitiesRouter);
// Glosas: montado ANTES de /api/v1/payments para que la ruta más específica gane.
app.use('/api/v1/payments/glosas', paymentLimiter, glosasRouter);
app.use('/api/v1/payments/reconciliation', paymentLimiter, reconciliationRouter);
app.use('/api/v1/payments', paymentLimiter, paymentsRouter);
app.use('/api/v1/admin/payments', generalLimiter, adminPaymentsRouter);
// payment-tokens y recurring: state-changing → CSRF header + cap especifico
app.use('/api/v1/payment-tokens', cardAlterLimiter, requireCsrfHeader, paymentTokensRouter);
app.use('/api/v1/recurring', paymentLimiter, requireCsrfHeader, recurringRouter);
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
app.use('/api/v1/school', generalLimiter, schoolPerformanceRouter);
app.use('/api/v1/school', generalLimiter, schoolCompetitionResultsRouter);
app.use('/api/v1/school', generalLimiter, schoolFootballRouter);
app.use('/api/v1/school', generalLimiter, requireAuth, schoolRoutinesRouter);
app.use('/api/v1/school', generalLimiter, schoolReportsRouter);
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
app.use('/api/v1/access', generalLimiter, accessApiRouter);
// Canal para scripts locales (SDK pyzk, ej. scripts/gymrm-door-bridge/) que
// ejecutan open_door por fuera de ADMS — no lleva requireAuth, se valida por
// X-Bridge-Api-Key dentro del router (ver bridge.routes.ts).
app.use('/bridge', generalLimiter, bridgeRouter);
app.use('/api/v1/admin/access-logs', generalLimiter, accessAdminRouter);
// Consola de soporte (super_admin) — F0 solo lectura.
app.use('/api/v1/admin/support', generalLimiter, adminSupportRouter);
app.use('/api/v1/support', generalLimiter, supportRouter);
// Facturación SaaS SportMaps → escuelas (super_admin).
app.use('/api/v1/platform/invoices', generalLimiter, platformInvoicingRouter);

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
app.use('/api/v1/athlete', generalLimiter, requireAthleteAuth, athletePerformanceRouter);
app.use('/api/v1/athletes', bulkUploadRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint no encontrado.' });
});

// Después de todas las rutas, antes de cualquier otro error handler — no-op
// si SENTRY_DSN no está seteado (Sentry.init nunca corrió en instrument.ts).
Sentry.setupExpressErrorHandler(app);

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

// DIN-9 · Fail-fast ANTES de aceptar tráfico: si `MP_ENV` dice sandbox y la
// credencial de MercadoPago es `APP_USR-` (producción), un pago «de prueba»
// cobra plata de verdad. MP no tiene host de sandbox, así que manda la
// credencial. Se aborta el arranque en vez de descubrirlo con el primer cobro.
try {
    assertMpEnvCoherente();
} catch (err: any) {
    console.error('\n❌ Configuración de MercadoPago incoherente — el BFF no arranca.\n');
    console.error(`   ${err.message}\n`);
    process.exit(1);
}

app.listen(PORT, () => {
    console.log(`🚀 BFF corriendo en http://localhost:${PORT}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
    
    // Iniciar trabajos de mantenimiento programados
    initMaintenanceJobs();
});

