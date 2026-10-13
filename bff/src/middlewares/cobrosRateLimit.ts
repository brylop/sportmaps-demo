/**
 * Límites de petición del modal «Cobros y pagos» (charge-batches, payment-adjustments,
 * open-charges, charge-suggestions).
 *
 * Antes estas rutas colgaban del `paymentLimiter` global (20/min por IP, compartido con
 * MercadoPago, glosas y conciliación). El modal hace una vista previa ~1 s después de
 * cada edición, más el buscador de atletas y los destinos por grupo: UN usuario del
 * staff llegaba al 429 en uso normal, y una oficina con IP compartida se bloqueaba
 * entera. Además la llave era `req.ip`, que detrás de Cloudflare + Render es la IP del
 * borde de Cloudflare (ver storeRateLimit.ts y access-adms.ts::clientIp).
 *
 * Ahora, tres cupos independientes POR USUARIO autenticado (IP real de respaldo):
 *  · lectura  (GET: destinos, buscador, cobros abiertos, sugerencias, historial,
 *    detalle, informe de ajustes) ............................ 120/min
 *  · preview  (POST /charge-batches/preview, no escribe) ........ 60/min
 *  · escritura (confirmar lote, anular, quitar descuento) ....... 20/min
 *    — encima siguen los topes de negocio de chargeBatchRateLimit.ts
 *      (10 lotes/10 min por usuario, 2.000 cobros/hora por escuela).
 *
 * Va DESPUÉS de requireAuth (necesita `req.user.id`). La llave lleva prefijo de cupo y
 * de tipo (`u:` usuario / `ip:` IP), así un id de usuario nunca choca con una IP ni
 * un cupo con otro. Memoria por proceso: con 3 BFFs el tope efectivo es hasta 3×.
 * 429 con `code: 'RATE_LIMITED'` y `Retry-After` (lo pone express-rate-limit).
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { ipKeyGenerator, MemoryStore } from 'express-rate-limit';
import { storeClientIp } from './storeRateLimit';

export const COBROS_READ_LIMIT_PER_MIN = 120;
export const COBROS_PREVIEW_LIMIT_PER_MIN = 60;
export const COBROS_WRITE_LIMIT_PER_MIN = 20;

export type CupoCobros = 'read' | 'preview' | 'write';

type ReqLike = Pick<Request, 'headers' | 'ip'> & { user?: { id?: string } | null; socket?: { remoteAddress?: string } };

/** Llave del limitador: usuario autenticado; si no hay, IP real del cliente (Cloudflare). */
export function cobrosRateLimitKey(cupo: CupoCobros, req: ReqLike): string {
    const userId = req.user?.id;
    if (userId) return `cobros-${cupo}-u:${userId}`;
    return `cobros-${cupo}-ip:${ipKeyGenerator(storeClientIp(req))}`;
}

/** ¿Qué cupo gasta esta request? GET/HEAD → lectura; POST …/preview → preview; resto → escritura. */
export function cupoDeLaRequest(req: Pick<Request, 'method' | 'originalUrl'>): CupoCobros {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'read';
    const path = (req.originalUrl || '').split('?')[0].replace(/\/+$/, '');
    if (method === 'POST' && path.endsWith('/charge-batches/preview')) return 'preview';
    return 'write';
}

function limiter(cupo: CupoCobros, max: number, store: MemoryStore) {
    return rateLimit({
        windowMs: 60 * 1000,
        store,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => cobrosRateLimitKey(cupo, req as ReqLike),
        handler: (_req, res) => {
            res.status(429).json({
                error: 'Espera un momento… hiciste muchas solicitudes seguidas.',
                code: 'RATE_LIMITED',
            });
        },
    });
}

export interface CobrosRateLimit {
    read: RequestHandler;
    preview: RequestHandler;
    write: RequestHandler;
    /** Elige el cupo según método y ruta (ver cupoDeLaRequest). */
    porRequest: RequestHandler;
    /** Vacía los contadores (pruebas). */
    reset: () => Promise<void>;
}

/** Fábrica: cada instancia tiene sus contadores. En las rutas se usa la instancia única de abajo. */
export function createCobrosRateLimit(opts: { readMax?: number; previewMax?: number; writeMax?: number } = {}): CobrosRateLimit {
    const stores = [new MemoryStore(), new MemoryStore(), new MemoryStore()];
    const read = limiter('read', opts.readMax ?? COBROS_READ_LIMIT_PER_MIN, stores[0]);
    const preview = limiter('preview', opts.previewMax ?? COBROS_PREVIEW_LIMIT_PER_MIN, stores[1]);
    const write = limiter('write', opts.writeMax ?? COBROS_WRITE_LIMIT_PER_MIN, stores[2]);
    const porCupo = { read, preview, write };
    return {
        read,
        preview,
        write,
        porRequest: (req: Request, res: Response, next: NextFunction) => porCupo[cupoDeLaRequest(req)](req, res, next),
        reset: async () => { await Promise.all(stores.map((s) => s.resetAll())); },
    };
}

/** Instancia única del proceso (compartida por los tres routers del modal). */
export const cobrosRateLimit = createCobrosRateLimit();
