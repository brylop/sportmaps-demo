/**
 * platform-invoicing.routes — Facturación SaaS SportMaps → escuelas.
 * Montado en /api/v1/platform/invoices.
 *
 * /send y /mark-paid son EXCLUSIVOS de super_admin: cruzan tenants (mandan
 * notificaciones o concilian la factura de CUALQUIER escuela). /pdf-url es
 * distinto a propósito — es el link que le llega a la propia escuela por
 * email/WhatsApp, así que además de super_admin se permite al owner/admin
 * DE ESA escuela ver su propio PDF.
 *
 * El toggle "activar facturación" y la lista de facturas NO pasan por acá:
 * el toggle es la RPC admin_set_saas_billing_enabled (llamada directo desde
 * el frontend, mismo patrón que admin_set_school_addon) y la lista es un
 * SELECT directo a school_subscription_invoices (RLS ya permite
 * is_school_admin()/is_super_admin()). Este router solo cubre lo que
 * requiere Node/service_role: generar el PDF, subirlo, mandar email+push, y
 * firmar la URL de descarga.
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { sendSaasInvoice, getSignedInvoicePdfUrl, markInvoicePaid } from '../services/saasInvoicing.service';

const router = Router();

router.use(requireAuth);

/**
 * requireSuperAdminStrict — igual razón que admin-support.routes.ts:
 * requireRole() tiene un escape hatch que deja pasar a 'owner'/'admin' de
 * CUALQUIER escuela. /send y /mark-paid cruzan tenants (acción sobre la
 * factura de cualquier escuela), así que el gate va explícito y sin ese
 * atajo.
 */
function requireSuperAdminStrict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (req.role !== 'super_admin') {
        return res.status(403).json({
            error: 'Acceso denegado. Esta acción es exclusiva de super_admin.',
            receivedRole: req.role,
        });
    }
    next();
}

const ParamId = z.object({ id: z.string().uuid() });

// ─── POST /:id/send — genera el PDF si falta y envía email + push (super_admin) ──
router.post('/:id/send', requireSuperAdminStrict, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const parse = ParamId.safeParse(req.params);
        if (!parse.success) return res.status(400).json({ error: 'invalid_id' });

        const result = await sendSaasInvoice(parse.data.id);
        if (!result.ok) {
            return res.status(500).json({ error: 'send_failed', detail: result.error });
        }
        return res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /:id/pdf-url — super_admin, o el owner/admin de la ESCUELA DUEÑA de la factura ──
router.get('/:id/pdf-url', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const parse = ParamId.safeParse(req.params);
        if (!parse.success) return res.status(400).json({ error: 'invalid_id' });

        const { data: invoice, error } = await supabase
            .from('school_subscription_invoices')
            .select('pdf_object_path, school_id')
            .eq('id', parse.data.id)
            .single();

        if (error || !invoice?.pdf_object_path) {
            return res.status(404).json({ error: 'pdf_not_generated' });
        }

        if (req.role !== 'super_admin') {
            const { data: membership } = await supabase
                .from('school_members')
                .select('role')
                .eq('school_id', invoice.school_id)
                .eq('profile_id', req.user.id)
                .eq('status', 'active')
                .in('role', ['owner', 'admin'])
                .maybeSingle();
            if (!membership) {
                return res.status(403).json({ error: 'forbidden_other_school' });
            }
        }

        const { data: signed, error: signErr } = await getSignedInvoicePdfUrl(invoice.pdf_object_path);
        if (signErr || !signed) {
            return res.status(500).json({ error: 'sign_failed', detail: signErr?.message });
        }

        return res.json({ ok: true, url: signed.signedUrl, expires_in: 600 });
    } catch (err) {
        next(err);
    }
});

// ─── POST /:id/mark-paid — conciliación manual, super_admin (sin pasarela conectada) ──
router.post('/:id/mark-paid', requireSuperAdminStrict, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const parse = ParamId.safeParse(req.params);
        if (!parse.success) return res.status(400).json({ error: 'invalid_id' });

        const { data, error } = await markInvoicePaid(parse.data.id, req.user.id);
        if (error) return res.status(500).json({ error: 'mark_paid_failed', detail: error.message });

        return res.json({ ok: true, invoice: data });
    } catch (err) {
        next(err);
    }
});

export default router;
