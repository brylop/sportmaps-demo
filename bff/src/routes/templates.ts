import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { renderTemplate } from '../utils/template-renderer';
import { z } from 'zod';

const router = Router();

const RenderSchema = z.object({
    payment_id: z.string().uuid(),
    template_type: z.string(),
    channel: z.enum(['whatsapp', 'email']).default('whatsapp'),
    template_id: z.string().uuid().optional(),
});

const RenderBatchSchema = z.object({
    payment_ids: z.array(z.string().uuid()).min(1).max(50),
    template_type: z.string(),
    channel: z.enum(['whatsapp', 'email']).default('whatsapp'),
    template_id: z.string().uuid().optional(),
});

/**
 * POST /api/v1/templates/render
 * Renders a single payment template with real data.
 * Returns the message ready to send (body + recipient info).
 */
router.post('/render',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    async (req: Request, res: Response) => {
        try {
            const parsed = RenderSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const result = await renderTemplate({
                schoolId: req.schoolId,
                paymentId: parsed.data.payment_id,
                templateType: parsed.data.template_type,
                channel: parsed.data.channel,
                templateId: parsed.data.template_id,
            });

            res.json({ message: result });
        } catch (err: any) {
            req.log?.error({ err }, 'Error rendering template');
            res.status(500).json({ error: err.message || 'Error al renderizar plantilla' });
        }
    }
);

/**
 * POST /api/v1/templates/render-batch
 * Renders templates for multiple payments at once.
 * Used when sending bulk WhatsApp/email from the reminders page.
 */
router.post('/render-batch',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'school'),
    async (req: Request, res: Response) => {
        try {
            const parsed = RenderBatchSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const results = await Promise.all(
                parsed.data.payment_ids.map(async (paymentId) => {
                    try {
                        const rendered = await renderTemplate({
                            schoolId: req.schoolId,
                            paymentId,
                            templateType: parsed.data.template_type,
                            channel: parsed.data.channel,
                            templateId: parsed.data.template_id,
                        });
                        return { paymentId, success: true, message: rendered };
                    } catch (err: any) {
                        return { paymentId, success: false, error: err.message };
                    }
                })
            );

            res.json({ results });
        } catch (err: any) {
            req.log?.error({ err }, 'Error rendering batch templates');
            res.status(500).json({ error: err.message || 'Error al renderizar plantillas' });
        }
    }
);

export default router;
