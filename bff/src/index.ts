import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';

// Cargar variables de entorno PRIMERO, antes de cualquier import que las use
dotenv.config();

import studentsRouter from './routes/students';
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

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use('/api/v1/enrollments', generalLimiter, enrollmentsRouter);
app.use('/api/v1/reports', generalLimiter, reportsRouter);
app.use('/api/v1/webhooks/wompi', wompiRouter);
app.use('/api/v1/attendance', generalLimiter, attendanceRouter);
app.use('/api/v1/school/context', generalLimiter, schoolContextRouter);
app.use('/api/v1/offerings', generalLimiter, offeringsRouter);
app.use('/api/v1/sessions', generalLimiter, sessionBookingsRouter);
app.use('/api/v1/sport-configs', generalLimiter, sportConfigsRouter);
app.use('/api/v1/billing-events', generalLimiter, billingEventsRouter);
app.use('/api/explorar',  generalLimiter, explorarRoutes);
app.use('/api/favoritos', generalLimiter, favoritosRoutes);

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
});
