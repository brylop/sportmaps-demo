/**
 * authCache — cache en memoria para la resolucion de identidad del BFF.
 *
 * POR QUE EXISTE
 * Cada request autenticado hacia 3 viajes de red a Supabase ANTES de que
 * corriera el handler:
 *   1. supabase.auth.getUser(token)  → HTTP contra GoTrue
 *   2. SELECT role FROM profiles     → PostgREST
 *   3. SELECT ... FROM school_members → PostgREST
 * Medido en los logs de Render: endpoints con el handler practicamente vacio
 * (/payments/glosas/mine) tardaban 424-615 ms. Ese era el piso del middleware,
 * no del trabajo real. Con ~40 requests por carga de pagina son ~20 s de espera
 * repartidos por toda la app.
 *
 * POR QUE CACHE Y NO VERIFICACION LOCAL DEL JWT
 * Verificar la firma en proceso seria aun mas rapido, pero exige tener
 * SUPABASE_JWT_SECRET (o la JWKS) desplegado en Render, y este proyecto no lo
 * tiene configurado hoy. La cache no necesita config nueva y no cambia el
 * modelo de confianza: el token lo sigue validando Supabase — solo que una vez
 * por ventana en lugar de una vez por request.
 *
 * SEGURIDAD
 *  - Solo entran a la cache tokens que Supabase YA valido. Un token invalido
 *    nunca se cachea.
 *  - La entrada nunca sobrevive al `exp` del propio JWT: un token vencido no se
 *    acepta ni un segundo de mas.
 *  - TTL corto (60 s por defecto, AUTH_CACHE_TTL_MS para ajustarlo). Ese es el
 *    retardo maximo con el que se propaga un cambio de rol/membresia o una
 *    revocacion. Poner 0 desactiva la cache por completo.
 */

import crypto from 'crypto';

const TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 60_000);

// Tope de entradas. Evita que la memoria crezca sin control con muchos usuarios
// concurrentes; al llenarse se descarta la entrada mas vieja (FIFO por insercion,
// que en un Map de JS es el orden natural de iteracion).
const MAX_ENTRIES = 5_000;

type Entry<T> = { value: T; expiresAt: number };

class TtlCache<T> {
    private store = new Map<string, Entry<T>>();

    get(key: string): T | undefined {
        const hit = this.store.get(key);
        if (!hit) return undefined;
        if (Date.now() >= hit.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return hit.value;
    }

    set(key: string, value: T, expiresAt: number): void {
        if (TTL_MS <= 0) return;
        if (this.store.size >= MAX_ENTRIES) {
            const oldest = this.store.keys().next().value;
            if (oldest !== undefined) this.store.delete(oldest);
        }
        this.store.set(key, { value, expiresAt });
    }

    /** Invalida todo lo cacheado de un usuario (cambios de rol/membresia). */
    deleteByPrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
    }
}

/** No guardamos el token en claro como clave — solo su hash. */
const tokenKey = (token: string): string =>
    crypto.createHash('sha256').update(token).digest('hex');

/**
 * `exp` del JWT en ms. Lo leemos del payload SIN verificar firma, lo cual es
 * seguro porque solo se usa para ACORTAR la vida de la entrada, y unicamente
 * despues de que Supabase valido el token. Si no se puede leer, devolvemos 0
 * y el llamador se queda con el TTL normal.
 */
function jwtExpiryMs(token: string): number {
    try {
        const payload = token.split('.')[1];
        if (!payload) return 0;
        const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return typeof json?.exp === 'number' ? json.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

/** Vencimiento efectivo: lo que ocurra primero, el TTL o el `exp` del token. */
function effectiveExpiry(token: string): number {
    const byTtl = Date.now() + TTL_MS;
    const byJwt = jwtExpiryMs(token);
    return byJwt > 0 ? Math.min(byTtl, byJwt) : byTtl;
}

// ── Cache 1: token → usuario validado ────────────────────────────────────────
export type CachedUser = {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
};

const userCache = new TtlCache<CachedUser>();

/**
 * Envuelve `supabase.auth.getUser(token)`. `resolve` solo corre en miss.
 * Devuelve null si el token es invalido (y no cachea nada).
 */
export async function getCachedUser(
    token: string,
    resolve: () => Promise<CachedUser | null>,
): Promise<CachedUser | null> {
    const key = tokenKey(token);
    const hit = userCache.get(key);
    if (hit) return hit;

    const user = await resolve();
    if (!user) return null; // token invalido: jamas se cachea

    userCache.set(key, user, effectiveExpiry(token));
    return user;
}

// ── Cache 2: (usuario, escuela) → membresia resuelta ─────────────────────────
export type CachedMembership = {
    schoolId: string;
    branchId: string | null;
    role: string;
};

const membershipCache = new TtlCache<CachedMembership>();

const membershipKey = (userId: string, schoolId: string | undefined): string =>
    `${userId}::${schoolId ?? '*'}`;

/**
 * Cachea la resolucion de rol/escuela. `resolve` solo corre en miss.
 * Un null (sin membresia = 403) NO se cachea: si el usuario recien fue
 * agregado a la escuela, el siguiente request debe verlo de inmediato.
 */
export async function getCachedMembership(
    userId: string,
    schoolId: string | undefined,
    token: string,
    resolve: () => Promise<CachedMembership | null>,
): Promise<CachedMembership | null> {
    const key = membershipKey(userId, schoolId);
    const hit = membershipCache.get(key);
    if (hit) return hit;

    const membership = await resolve();
    if (!membership) return null;

    membershipCache.set(key, membership, effectiveExpiry(token));
    return membership;
}

/**
 * Purga lo cacheado de un usuario. Llamar desde los flujos que cambian rol o
 * membresia (aceptar invitacion, cambiar de rol, desactivar miembro) para no
 * esperar el TTL.
 */
export function invalidateUserAuthCache(userId: string): void {
    membershipCache.deleteByPrefix(`${userId}::`);
}
