import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

// Cargar variables de entorno PRIMERO, antes de cualquier import que las use
dotenv.config();

import studentsRouter from './routes/students';
import createOneRouter from './routes/students-create-one.route';
import enrollmentsRouter from './routes/enrollments';
import reportsRouter from './routes/reports';
import wompiRouter from './routes/wompi';
import attendanceRouter from './routes/attendance';
import schoolContextRouter from './routes/school-context';
import offeringsRouter from './routes/offerings';
import sessionBookingsRouter from './routes/session-bookings';
import sportConfigsRouter from './routes/sport-configs';
import billingEventsRouter from './routes/billing-events';
import explorarRoutes from './routes/explorar.routes';
import favoritosRoutes from './routes/favoritos.routes';
import schoolStaffRouter from './routes/school-staff';
import epaycoRouter from './routes/epayco';
import epaycoWebhookRouter from './routes/epayco-webhook';
import { requireTrainerAuth } from './middlewares/authMiddleware';
import systemRouter from './routes/system';
import { initMaintenanceJobs } from './jobs/maintenance.job';
import organizerRouter from './routes/organizers.route';
import eventsRouter from './routes/events.route';
import templatesRouter from './routes/templates';
import pollsRouter from './routes/polls';
<<<<<<< HEAD
import schoolDelegationsRouter from './routes/school-delegations.route';
import marketplaceRouter from './routes/marketplace.routes';
import vendorRouter from './routes/vendor.routes';
import vendorProductsRouter from './routes/vendor-products.routes';
import vendorServicesRouter from './routes/vendor-services.routes';
import marketplaceOrdersRouter from './routes/marketplace-orders.routes';
import ogPreviewRouter from './routes/og-preview.routes';
=======
import trainerProfileRouter from './routes/trainer/profile';
import trainerOnboardingRouter from './routes/trainer/onboarding';
import trainerWorkspaceRouter from './routes/trainer/workspace';
import trainerClientsRouter from './routes/trainer/clients';
import trainerRoutinesRouter from './routes/trainer/routines';
>>>>>>> ce2eccf (feat: implement multi-class filtering and universal session splitting for personal trainers)

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario para express-rate-limit en entornos con proxy (Render, Vercel, Heroku)
app.set('trust proxy', 1);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
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

app.use(cors({

    origin: (origin, callback) => {
        // Permitir requests sin origin (como Postman o curl) o localhost en development
        if (!origin || origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }

        const allowedProductionDomain = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

        // Si el origen coincide exactamente con la URL principal,
        // termina en .vercel.app (Preview branches),
        // o es un subdominio de sportmaps.co (dev.sportmaps.co, staging.sportmaps.co, etc.)
        if (
            origin === allowedProductionDomain ||
            origin.endsWith('.vercel.app') ||
            origin.endsWith('.sportmaps.co') ||
            origin === 'https://sportmaps.co'
        ) {
            return callback(null, true);
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
app.use('/api/v1/attendance', generalLimiter, attendanceRouter);
app.use('/api/v1/school/context', generalLimiter, schoolContextRouter);
app.use('/api/v1/offerings', generalLimiter, offeringsRouter);
app.use('/api/v1/sessions', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/session-bookings', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/sport-configs', generalLimiter, sportConfigsRouter);
app.use('/api/v1/billing-events', generalLimiter, billingEventsRouter);
app.use('/api/explorar',  generalLimiter, explorarRoutes);
app.use('/api/favoritos', generalLimiter, favoritosRoutes);
app.use('/api/v1/school-staff', generalLimiter, schoolStaffRouter);
app.use('/api/v1/payments', paymentLimiter, epaycoRouter);
app.use('/api/v1/webhooks/epayco', epaycoWebhookRouter);
app.use('/api/v1/system', systemRouter);
app.use('/api/v1/organizer', generalLimiter, organizerRouter);
app.use('/api/v1/events', generalLimiter, eventsRouter);
app.use('/api/v1/school/delegations', generalLimiter, schoolDelegationsRouter);
app.use('/api/v1/templates', generalLimiter, templatesRouter);
app.use('/api/v1/polls', generalLimiter, pollsRouter);

<<<<<<< HEAD
// ── Marketplace routes ──────────────────────────────────────────────────────
app.use('/api/v1/marketplace', generalLimiter, marketplaceRouter);
app.use('/api/v1/vendor', generalLimiter, vendorRouter);
app.use('/api/v1/vendor/products', generalLimiter, vendorProductsRouter);
app.use('/api/v1/vendor/services', generalLimiter, vendorServicesRouter);
app.use('/api/v1/marketplace/orders', paymentLimiter, marketplaceOrdersRouter);

// ── Social sharing — OG meta tags for crawlers ──────────────────────────────
app.use('/share', ogPreviewRouter);
=======
// ── Trainer routes ────────────────────────────────────────────────────────────
// Ruta pública (sin requireAuth): perfil público de un entrenador
app.use('/api/v1/trainer', generalLimiter, trainerProfileRouter);

// Rutas autenticadas del entrenador personal: usan requireTrainerAuth, NO requireAuth
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerOnboardingRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerWorkspaceRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerClientsRouter);
app.use('/api/v1/trainer', generalLimiter, requireTrainerAuth, trainerRoutinesRouter);
>>>>>>> ce2eccf (feat: implement multi-class filtering and universal session splitting for personal trainers)

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

