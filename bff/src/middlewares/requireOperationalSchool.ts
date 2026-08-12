// ============================================================================
// requireOperationalSchool — bloqueo por fin del periodo de prueba
//
// Por qué en el BFF y no solo en el frontend: el gate del navegador se evita
// con un curl. El BFF usa service_role, así que para la mayoría de tablas es
// el ÚNICO gate real (ver docs/…coach_permissions). Esto lo cierra server-side.
//
// Reglas:
//   · Solo intercepta métodos de mutación. Los GET siempre pasan — "bloqueado"
//     nunca significa "sin datos": la escuela puede leer y exportar lo suyo.
//   · La verdad la decide school_is_operational(school_id) en la BD, que ya
//     exime cuentas demo/test y las que tienen blocking_exempt (caso Dynasty).
//   · Sin x-school-id no hay contexto de escuela → pasa (marketplace, vendors).
//   · Responde 402 con code='trial_expired' para que el frontend muestre la
//     pantalla de "hablemos" en vez de un error genérico.
//   · Si la consulta falla, PASA (fail-open deliberado): un problema de red no
//     puede convertirse en un apagón de escritura para todo el parque.
// ============================================================================
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rutas que nunca se bloquean.
 *
 * Criterio: (a) infraestructura que no es "uso del producto" — webhooks de
 * pasarela, health; (b) lo que el bloqueado necesita para entender el bloqueo y
 * salir de él (/me, upgrade-requests, support); (c) el panel de super admin,
 * que es justo quien tiene que poder desbloquear.
 *
 * Los pagos NO están acá: decisión del dueño del producto (2026-08-12) —
 * la escuela inhabilitada queda inhabilitada para TODOS sus usuarios por igual,
 * incluidos los padres. Consecuencia a tener presente: un padre con una cuota
 * pendiente en una escuela bloqueada recibe 402 al intentar pagarla.
 *
 * Los webhooks siguen pasando a propósito: son server-to-server y sin
 * x-school-id, y si un pago ya salió de la pasarela hay que poder registrarlo
 * para no perder plata que el padre ya entregó.
 */
const SIEMPRE_PERMITIDO = [
    '/api/v1/webhooks',
    '/api/v1/system',
    '/api/v1/me',
    '/api/v1/admin',
    '/api/v1/upgrade-requests',
    '/api/v1/support',
    '/api/v1/public',
    '/api/v1/devices',           // registro de push del dispositivo
    '/api/v1/school/context',
];

// Cache corto: el status cambia por cron diario o por acción de super admin,
// así que 60 s es holgado y evita un round-trip por cada escritura.
const TTL_MS = 60_000;
const cache = new Map<string, { operational: boolean; exp: number }>();

/** Invalida el cache de una escuela (usar tras reactivar / exentar). */
export function invalidateOperationalCache(schoolId?: string) {
    if (schoolId) cache.delete(schoolId);
    else cache.clear();
}

async function isOperational(schoolId: string, req: Request): Promise<boolean> {
    const hit = cache.get(schoolId);
    if (hit && hit.exp > Date.now()) return hit.operational;

    const { data, error } = await supabase.rpc('school_is_operational', { p_school_id: schoolId });

    if (error) {
        // Fail-open a propósito — ver cabecera del archivo.
        req.log?.error({ err: error, schoolId }, 'school_is_operational falló; se permite la escritura');
        return true;
    }

    const operational = data !== false;
    cache.set(schoolId, { operational, exp: Date.now() + TTL_MS });
    return operational;
}

export const requireOperationalSchool = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        if (!MUTATIONS.has(req.method)) return next();

        const ruta = req.originalUrl.split('?')[0];
        if (SIEMPRE_PERMITIDO.some((p) => ruta.startsWith(p))) return next();

        const schoolId = (req.headers['x-school-id'] as string | undefined)?.trim();
        if (!schoolId) return next();

        if (await isOperational(schoolId, req)) return next();

        req.log?.warn({ schoolId, ruta, method: req.method }, 'Escritura bloqueada: periodo de prueba vencido');

        return res.status(402).json({
            error: 'Tu periodo de prueba terminó. Reactiva tu plan para seguir registrando información.',
            code: 'trial_expired',
            school_id: schoolId,
            contact: {
                whatsapp: process.env.SALES_WHATSAPP ?? '+57 320 268 3539',
                email: process.env.SALES_EMAIL ?? 'comercial@sportmaps.co',
            },
        });
    } catch (err) {
        next(err);
    }
};
