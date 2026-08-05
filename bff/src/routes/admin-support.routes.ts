/**
 * admin-support.routes — Consola de Soporte del super_admin.
 * Montado en /api/v1/admin/support.  Spec: docs/specs/consola-de-soporte-super-admin.md
 *
 * F0 (esta entrega) — SOLO LECTURA:
 *   GET /user-state?email=<x>   (o ?userId=<uuid>)
 *
 * Principio de diseño de la spec: **diagnóstico primero, acción después**.
 * Ninguna acción destructiva se ofrece sin mostrar antes el estado que la
 * justifica, y "eliminar cuenta" no vive aquí a propósito: es lo que el usuario
 * pide y casi nunca lo que necesita.
 *
 * F1/F2 (reenviar enlace, confirmar correo, contraseña temporal, reabrir
 * invitación) van en este mismo router pero como entrega aparte: exigen motivo
 * obligatorio, auditoría y rate limit por actor.
 */

import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { buildUserState } from '../services/support-diagnosis.service';

const router = Router();

router.use(requireAuth);

/**
 * requireSuperAdminStrict — NO se puede usar requireRole('super_admin') aquí.
 *
 * requireRole tiene un escape hatch (PRIVILEGED_ROLES) que deja pasar SIEMPRE a
 * 'owner', 'admin' y 'super_admin', aunque no estén en la lista. Es decir,
 * requireRole('super_admin') también autoriza a cualquier 'admin' — y hoy hay
 * cuentas 'admin' en la base (spiritfontibon@…, demo.admin@…) que no deben ver
 * el estado de acceso de terceros. Este endpoint expone datos de auth de otra
 * persona, así que el gate se escribe explícito.
 */
function requireSuperAdminStrict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (req.role !== 'super_admin') {
        return res.status(403).json({
            error: 'Acceso denegado. Esta consola es exclusiva de super_admin.',
            receivedRole: req.role,
        });
    }
    next();
}

router.use(requireSuperAdminStrict);

// ─── GET /api/v1/admin/support/user-state ─────────────────────────────────────
// Bloques A (acceso), B (pertenencia), C (duplicidad) y D (veredicto).
// No escribe nada: se puede desplegar sin riesgo.
router.get('/user-state', async (req: AuthenticatedRequest, res: Response) => {
    const email = (req.query.email as string | undefined)?.trim();
    const userId = (req.query.userId as string | undefined)?.trim();

    if (!email && !userId) {
        return res.status(400).json({ error: 'Indica ?email= o ?userId=.' });
    }

    try {
        const state = await buildUserState({ email, userId, scope: 'admin' });

        // El diagnóstico se consulta sobre la cuenta de otra persona: queda
        // registro de quién preguntó por quién. Solo identificadores — nunca
        // tokens ni contraseñas (§5 de la spec).
        req.log?.info(
            { actor: req.user.id, targetEmail: email ?? null, targetUserId: state.access.userId, verdict: state.verdict.level },
            'support/user-state consultado',
        );

        res.json(state);
    } catch (err: any) {
        req.log?.error({ err, email, userId }, 'Error construyendo user-state');
        res.status(500).json({ error: 'No se pudo construir el diagnóstico.' });
    }
});

export default router;
