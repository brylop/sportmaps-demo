/**
 * POST /api/v1/webhooks/resend-inbound — avisos del banco reenviados por la
 * escuela, recibidos por Resend Inbound (evento `email.received`).
 *
 * 1. Firma Svix sobre el cuerpo CRUDO (req.rawBody, lo guarda express.json).
 *    Sin firma válida → 401 y no se toca nada.
 * 2. Todo lo demás (dirección → escuela, flag, MIME crudo, DKIM, parser,
 *    cruce) está en `procesarEventoResend`.
 * 3. 200 para todo lo que ya se decidió (incluido «rechazado» o «ignorado»:
 *    reintentar no lo cambia). 500 solo ante falla de infraestructura, para
 *    que Resend reintente; la idempotencia hace seguro el reintento.
 *
 * Variables: RESEND_INBOUND_WEBHOOK_SECRET (whsec_…), RESEND_INBOUND_API_KEY,
 * BANK_INBOUND_DOMAIN. Spec: docs/specs/conciliacion-correo-banco-dkim.md
 */

import { Router, Request, Response } from 'express';
import { verificarFirmaSvix } from '../services/banco-correo-dkim.service';
import { procesarEventoResend, type DepsProceso } from '../services/banco-correo-cruce.service';
import { fuenteResend, repoAvisosSupabase } from '../services/banco-correo-repo.service';

export function crearRouterResendInbound(deps: () => DepsProceso | null): Router {
    const router = Router();

    router.post('/', async (req: Request, res: Response) => {
        const raw = (req as any).rawBody as Buffer | undefined;
        const firmaOk = !!raw && verificarFirmaSvix(raw, {
            id: req.header('svix-id'),
            timestamp: req.header('svix-timestamp'),
            signature: req.header('svix-signature'),
        }, process.env.RESEND_INBOUND_WEBHOOK_SECRET);
        if (!firmaOk) {
            req.log?.warn('resend-inbound: firma Svix inválida o ausente');
            return res.status(401).json({ error: 'invalid_signature' });
        }

        const d = deps();
        if (!d) {
            req.log?.error('resend-inbound: BANK_INBOUND_DOMAIN no configurado');
            return res.status(503).json({ error: 'not_configured' });
        }

        try {
            const r = await procesarEventoResend(req.body, d);
            // Sin PII en el log: ni montos ni nombres, solo el desenlace.
            req.log?.info({ resultado: r.resultado, motivo: (r as any).motivo, estado: (r as any).estado }, 'resend-inbound');
            return res.status(200).json({ resultado: r.resultado });
        } catch (err: any) {
            req.log?.error({ err: err?.message ?? String(err) }, 'resend-inbound: falla al procesar');
            return res.status(500).json({ error: 'processing_failed' });
        }
    });

    return router;
}

export default crearRouterResendInbound(() => {
    const dominio = process.env.BANK_INBOUND_DOMAIN?.trim();
    if (!dominio) return null;
    return { repo: repoAvisosSupabase, fuente: fuenteResend, dominioEntrada: dominio };
});
