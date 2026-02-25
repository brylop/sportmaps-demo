import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';

// Cargar variables de entorno PRIMERO, antes de cualquier import que las use
dotenv.config();

import studentsRouter from './routes/students';
import enrollmentsRouter from './routes/enrollments';
import wompiRouter from './routes/wompi';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

app.use('/api/v1/students', studentsRouter);
app.use('/api/v1/enrollments', enrollmentsRouter);
app.use('/api/v1/webhooks/wompi', wompiRouter);

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
