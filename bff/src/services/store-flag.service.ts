/**
 * Flag global de la tienda (spec blindaje-dinero-pagos-tienda-nomina §1.3).
 *
 * La fuente de verdad es la base: `public.store_enabled()` lee
 * `platform_config (key='store_enabled')`. Se reprende sin deploy con un UPDATE
 * de esa fila; el BFF lo nota en <= 60 s (caché en memoria).
 *
 * FAIL-CLOSED: cualquier cosa que no sea un `true` explícito de la RPC deja la
 * tienda APAGADA. En particular, mientras la migración M3 no esté aplicada la
 * función no existe (PGRST202 / 42883): se trata como apagada y se avisa una
 * sola vez en el log.
 *
 * Usa el cliente service role: la RPC solo devuelve un booleano.
 */

import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const CACHE_TTL_MS = 60_000;

let cached: { value: boolean; expiresAt: number } | null = null;
let inFlight: Promise<boolean> | null = null;
let warnedMissingFunction = false;

function isMissingFunctionError(err: { code?: string; message?: string } | null | undefined): boolean {
    if (!err) return false;
    if (err.code === 'PGRST202' || err.code === '42883') return true;
    return /function .*does not exist|could not find the function/i.test(err.message ?? '');
}

async function fetchStoreEnabled(): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('store_enabled');
        if (error) {
            if (isMissingFunctionError(error)) {
                if (!warnedMissingFunction) {
                    warnedMissingFunction = true;
                    console.warn('[store-flag] public.store_enabled() no existe todavía (migración M3 sin aplicar): la tienda se trata como APAGADA.');
                }
            } else {
                console.warn('[store-flag] Error leyendo store_enabled(); la tienda se trata como APAGADA:', error.message || error);
            }
            return false;
        }
        return data === true;
    } catch (err: any) {
        console.warn('[store-flag] Excepción leyendo store_enabled(); la tienda se trata como APAGADA:', err?.message || err);
        return false;
    }
}

/** ¿Está prendida la tienda? Cacheado 60 s. Nunca lanza: ante cualquier duda, false. */
export async function isStoreEnabled(): Promise<boolean> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.value;
    if (inFlight) return inFlight;

    inFlight = fetchStoreEnabled()
        .then((value) => {
            cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
            return value;
        })
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

export const STORE_DISABLED_BODY = {
    error: 'STORE_DISABLED',
    message: 'La tienda no está disponible por ahora.',
} as const;

/** Middleware: 503 STORE_DISABLED si la tienda está apagada. */
export async function requireStoreEnabled(_req: Request, res: Response, next: NextFunction) {
    if (await isStoreEnabled()) return next();
    return res.status(503).json(STORE_DISABLED_BODY);
}

/** Solo para pruebas: limpia la caché y el aviso de "función inexistente". */
export function __resetStoreFlagCache(): void {
    cached = null;
    inFlight = null;
    warnedMissingFunction = false;
}
