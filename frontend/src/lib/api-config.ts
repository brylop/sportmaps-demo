/**
 * Resolucion centralizada de la URL del BFF.
 *
 * Soporta dos nombres de variable historicos para evitar bugs cuando uno
 * existe en Vercel pero el codigo lee el otro:
 *   - VITE_API_URL   (lo que casi todo el codigo asume)
 *   - VITE_BFF_URL   (lo que algunos sitios estan usando)
 *
 * Fallback final: http://localhost:3000 (dev local).
 *
 * Uso preferido: importar API_URL desde aqui en vez de leer
 * import.meta.env.VITE_API_URL directo.
 */

export const API_URL: string =
    (import.meta as any).env?.VITE_API_URL
    || (import.meta as any).env?.VITE_BFF_URL
    || 'http://localhost:3000';

if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[api-config] API_URL =', API_URL);
}
