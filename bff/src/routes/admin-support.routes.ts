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
import { userClient } from '../utils/userClient';

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

// ─── GET /api/v1/admin/support/tickets ────────────────────────────────────
// Bandeja mínima (MOD-21 S0, sin panel de diagnóstico embebido todavía —
// eso es S2 completo). Sin asignar primero, luego lo más viejo; usa el
// mismo índice `support_tickets_inbox` de la migración.
router.get('/tickets', async (req: AuthenticatedRequest, res: Response) => {
    const client = userClient(req); // is_support_agent() debe resolver true vía RLS

    const { data, error } = await client
        .from('support_tickets')
        .select('id, requester_id, status, subject, category, priority, assignee_id, school_id, created_at, updated_at, first_response_at')
        .neq('status', 'resolved')
        .neq('status', 'closed')
        .order('assignee_id', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });

    if (error) {
        req.log?.error({ err: error }, 'admin/support/tickets: error listando bandeja');
        return res.status(500).json({ error: 'No se pudo cargar la bandeja de soporte.' });
    }

    // Nombre del solicitante en un solo viaje — la bandeja sin nombre no sirve.
    const requesterIds = [...new Set((data || []).map((t: any) => t.requester_id))];
    let names: Record<string, string> = {};
    if (requesterIds.length) {
        const { data: profiles } = await client.from('profiles').select('id, full_name, email').in('id', requesterIds);
        names = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || p.email || 'Sin nombre']));
    }

    res.json({
        tickets: (data || []).map((t: any) => ({ ...t, requesterName: names[t.requester_id] ?? null })),
    });
});

// ─── GET /api/v1/admin/support/tickets/:id/messages ───────────────────────
// Hilo completo, incluidas notas internas (el agente sí las ve).
router.get('/tickets/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
    const client = userClient(req);
    const { data, error } = await client
        .from('support_messages')
        .select('id, author_type, author_id, body, internal_note, created_at')
        .eq('ticket_id', req.params.id)
        .order('created_at', { ascending: true });

    if (error) {
        req.log?.error({ err: error, ticketId: req.params.id }, 'admin/support/tickets/:id/messages: error');
        return res.status(500).json({ error: 'No se pudo cargar la conversación.' });
    }
    res.json({ messages: data || [] });
});

export default router;
