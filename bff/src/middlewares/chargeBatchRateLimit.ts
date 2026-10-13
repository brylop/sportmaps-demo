/**
 * Límites del modal «Cobros y pagos» (spec cobros-multiples Q11, §9.3).
 *
 *  · Por usuario: 10 operaciones confirmadas (POST /charge-batches) cada 10 min.
 *  · Por escuela: 2.000 cobros creados por hora (suma de atletas × líneas).
 *
 * Va DESPUÉS de la validación zod (necesita el cuerpo para contar filas) y
 * ANTES de la RPC. Un reintento con el mismo `client_request_id` no gasta cupo:
 * es el mismo lote (la RPC devuelve `duplicated: true`) y castigarlo dejaría al
 * personal sin poder confirmar tras un corte de red.
 *
 * Patrón de storeRateLimit.ts (429 con código propio), pero con ventana
 * deslizante en memoria y peso por request, que express-rate-limit no da.
 * Memoria por proceso: con 3 BFFs el tope efectivo es hasta 3× — aceptable para
 * un freno de abuso; la defensa dura de tamaño son los topes de Q10 (zod + RPC).
 */
import type { NextFunction, Request, Response } from 'express';

export const LOTES_POR_USUARIO = 10;
export const VENTANA_LOTES_MS = 10 * 60 * 1000;
export const FILAS_POR_ESCUELA_HORA = 2000;
export const VENTANA_FILAS_MS = 60 * 60 * 1000;

interface Evento { t: number; peso: number; req: string }

export interface ChargeBatchLimiter {
    /** Middleware: espera `res.locals.filasDelLote` y `res.locals.clientRequestId`. */
    middleware: (req: Request, res: Response, next: NextFunction) => void;
    reset: () => void;
}

export function createChargeBatchRateLimit(opts: {
    lotesPorUsuario?: number;
    filasPorEscuela?: number;
    ahora?: () => number;
} = {}): ChargeBatchLimiter {
    const maxLotes = opts.lotesPorUsuario ?? LOTES_POR_USUARIO;
    const maxFilas = opts.filasPorEscuela ?? FILAS_POR_ESCUELA_HORA;
    const ahora = opts.ahora ?? (() => Date.now());
    const porUsuario = new Map<string, Evento[]>();
    const porEscuela = new Map<string, Evento[]>();

    const vivos = (m: Map<string, Evento[]>, k: string, ventana: number, t: number) => {
        const lista = (m.get(k) ?? []).filter((e) => t - e.t < ventana);
        m.set(k, lista);
        return lista;
    };

    const middleware = (req: Request, res: Response, next: NextFunction) => {
        const t = ahora();
        const userId = req.user?.id ?? 'anon';
        const schoolId = req.schoolId ?? 'sin-escuela';
        const filas = Number(res.locals.filasDelLote ?? 0);
        const reqId = String(res.locals.clientRequestId ?? '');

        const lotes = vivos(porUsuario, userId, VENTANA_LOTES_MS, t);
        const filasEsc = vivos(porEscuela, schoolId, VENTANA_FILAS_MS, t);

        // Reintento del mismo lote: no cuenta.
        if (reqId && lotes.some((e) => e.req === reqId)) return next();

        if (lotes.length >= maxLotes) {
            res.status(429).json({
                error: 'Hiciste muchas operaciones de cobro seguidas. Espera unos minutos e intenta de nuevo.',
                code: 'RATE_LIMITED',
            });
            return;
        }
        const usadas = filasEsc.reduce((s, e) => s + e.peso, 0);
        if (usadas + filas > maxFilas) {
            res.status(429).json({
                error: `La escuela ya generó ${usadas} cobros en la última hora (máximo ${maxFilas}). Intenta más tarde o divide el lote.`,
                code: 'RATE_LIMITED',
            });
            return;
        }
        lotes.push({ t, peso: 1, req: reqId });
        if (filas > 0) filasEsc.push({ t, peso: filas, req: reqId });
        next();
    };

    return {
        middleware,
        reset: () => { porUsuario.clear(); porEscuela.clear(); },
    };
}

/** Instancia única del proceso. */
export const chargeBatchRateLimit = createChargeBatchRateLimit();
