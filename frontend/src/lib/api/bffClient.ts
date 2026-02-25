/**
 * bffClient — Cliente HTTP para el Backend For Frontend (BFF)
 *
 * Responsabilidades:
 *   1. Adjuntar automáticamente el JWT de Supabase en cada request
 *   2. Manejar errores HTTP de forma centralizada
 *   3. Proveer tipos genéricos para las respuestas
 *
 * Uso:
 *   import { bffClient } from './bffClient';
 *   const data = await bffClient.post('/api/v1/students/bulk', { students });
 */

import { supabase } from '@/integrations/supabase/client';

const BFF_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3000';

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

async function getAuthHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new BFFError(401, 'No hay sesión activa. Por favor inicia sesión.');
    }

    return { Authorization: `Bearer ${session.access_token}` };
}

async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
): Promise<T> {
    const authHeader = await getAuthHeader();

    const response = await fetch(`${BFF_URL}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...authHeader,
        },
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

export const bffClient = {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
};

export { BFFError };
