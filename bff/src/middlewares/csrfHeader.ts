/**
 * csrfHeader — Defensa anti-CSRF basada en header custom.
 *
 * Por que: el BFF usa CORS con `credentials: true` y allowlist de dominios
 * (sportmaps.co + subdominios + previews). Si un subdominio se compromete
 * (e.g., blog.sportmaps.co en WordPress), un atacante con JS en ese
 * subdominio podria montar requests credenciados al BFF y abusar de la
 * sesion de un usuario logueado.
 *
 * Defensa: requerir un header custom `X-Requested-With: SportMaps` en
 * endpoints sensibles. El navegador NO incluye este header en requests
 * cross-origin a menos que el JS lo agregue explicitamente — los formularios
 * HTML clasicos (vector CSRF) tampoco. Asi solo nuestro frontend autorizado
 * (que conoce el header) puede invocar estos endpoints.
 *
 * Aplica a: endpoints que modifican estado sensible — payment-tokens,
 * recurring, me/data-export, me/data-deletion-request.
 *
 * Server-to-server (cron, edge functions): NO se les exige el header
 * porque tienen su propio canal de auth (x-cron-secret). El middleware
 * solo se aplica a rutas user-facing.
 */

import { Request, Response, NextFunction } from 'express';

const EXPECTED_HEADER = 'sportmaps';

export function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
    // GET / HEAD / OPTIONS son safe-by-spec, no aplica CSRF a state-changing
    // methods. Tampoco a preflight CORS.
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    const got = (req.get('x-requested-with') || '').trim().toLowerCase();
    if (got !== EXPECTED_HEADER) {
        res.status(403).json({ error: 'csrf_header_missing' });
        return;
    }
    next();
}
