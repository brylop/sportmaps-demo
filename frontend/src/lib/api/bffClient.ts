/**
 * bffClient — Cliente HTTP para el Backend For Frontend (BFF)
 *
 * Responsabilidades:
 *   1. Adjuntar automáticamente el JWT de Supabase en cada request
 *   2. Inyectar el header `x-school-id` requerido por el authMiddleware del BFF
 *   3. Manejar errores HTTP de forma centralizada
 *   4. Proveer tipos genéricos para las respuestas
 *
 * Setup obligatorio en SchoolContext/Provider:
 *   import { bffClient } from '@/lib/api/bffClient';
 *   useEffect(() => {
 *     bffClient.setSchoolId(schoolId);   // llama esto cuando schoolId esté listo
 *   }, [schoolId]);
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * Resuelve la URL del BFF en runtime.
 * Mapea según hostname:
 *   - localhost/127.0.0.1 → http://localhost:3000
 *   - dev.sportmaps.co → sportmaps-bff-dev.onrender.com
 *   - resto → sportmaps-bff.onrender.com (prod)
 * VITE_BFF_URL override esta logica.
 */
function resolveBffUrl(): string {
    const configured = import.meta.env.VITE_BFF_URL;
    if (configured) return configured;

    if (typeof window === 'undefined') return 'http://localhost:3000';
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    // dev.sportmaps.co (develop branch) → BFF dev
    if (hostname === 'dev.sportmaps.co' || hostname.startsWith('dev.') || hostname.includes('preview') || hostname.includes('vercel.app')) {
        return 'https://sportmaps-bff-dev.onrender.com';
    }
    return 'https://sportmaps-bff.onrender.com';
}
export const BFF_URL = resolveBffUrl();

// ── Estado interno del módulo ─────────────────────────────────────────────────
// Se persiste a nivel de módulo — sobrevive re-renders sin React context.
let _schoolId: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────
class BFFError extends Error {
    constructor(
        public status: number,
        message: string,
        public body?: unknown,
    ) {
        super(message);
        this.name = 'BFFError';
    }
}

/**
 * Modo de autenticacion para una llamada al BFF:
 *  - 'required': debe haber sesion Supabase, si no, lanza 401 (default)
 *  - 'optional': adjunta JWT si hay sesion, no falla si no la hay (links publicos
 *                que tambien funcionan logueado, ej. confirmar asistencia)
 *  - 'public':   no toca auth (link 100% anonimo, ej. leer encuesta publica)
 */
export type AuthMode = 'required' | 'optional' | 'public';

async function buildHeaders(
    customHeaders?: Record<string, string>,
    authMode: AuthMode = 'required',
): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (authMode !== 'public') {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
            if (authMode === 'required') {
                throw new BFFError(401, 'No hay sesión activa. Por favor inicia sesión.');
            }
            // 'optional' sin sesion: continuar sin Authorization
        } else {
            headers['Authorization'] = `Bearer ${session.access_token}`;

            // CRÍTICO: el authMiddleware del BFF busca al miembro en school_members
            // filtrando por school_id. Sin este header, toma el primer registro activo
            // del usuario (puede ser incorrecto) o falla si hay ambigüedad.
            if (_schoolId) {
                headers['x-school-id'] = _schoolId;
            }
        }
    }

    if (customHeaders) {
        Object.assign(headers, customHeaders);
    }

    return headers;
}

async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>,
    authMode: AuthMode = 'required',
): Promise<T> {
    const headers = await buildHeaders(customHeaders, authMode);

    const response = await fetch(`${BFF_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let responseBody: unknown;
    try {
        responseBody = await response.json();
    } catch {
        responseBody = null;
    }

    // 207 Multi-Status = éxito parcial en bulk — NO lanzar error
    if (!response.ok && response.status !== 207) {
        const message =
            (responseBody as any)?.error ??
            (responseBody as any)?.message ??
            `Error ${response.status}`;
        throw new BFFError(response.status, message, responseBody);
    }

    return responseBody as T;
}

// ─────────────────────────────────────────────────────────────────────────────
export const bffClient = {
    /**
     * Registra el schoolId activo. Debe llamarse desde SchoolContext
     * cada vez que la escuela activa cambie.
     *
     * @example
     * // En tu SchoolProvider o useSchoolContext:
     * useEffect(() => {
     *   bffClient.setSchoolId(schoolId);
     * }, [schoolId]);
     */
    setSchoolId(id: string | null): void {
        _schoolId = id;
    },

    /** Retorna el schoolId configurado actualmente (útil para depuración). */
    getSchoolId(): string | null {
        return _schoolId;
    },

    get: <T>(path: string, headers?: Record<string, string>, authMode: AuthMode = 'required') =>
        request<T>('GET', path, undefined, headers, authMode),

    post: <T>(path: string, body: unknown, headers?: Record<string, string>, authMode: AuthMode = 'required') =>
        request<T>('POST', path, body, headers, authMode),

    put: <T>(path: string, body: unknown, headers?: Record<string, string>, authMode: AuthMode = 'required') =>
        request<T>('PUT', path, body, headers, authMode),

    patch: <T>(path: string, body: unknown, headers?: Record<string, string>, authMode: AuthMode = 'required') =>
        request<T>('PATCH', path, body, headers, authMode),

    delete: <T>(path: string, headers?: Record<string, string>, authMode: AuthMode = 'required') =>
        request<T>('DELETE', path, undefined, headers, authMode),

    request,
};

export { BFFError };
