/**
 * Descuentos y ajustes (spec cobros-multiples §7.5, §9.1 rev. 2, F2).
 *
 *   GET  /api/v1/payment-adjustments?from&to&reason   informe para el dueño — admin + contador
 *   POST /api/v1/payment-adjustments/:id/revert       «Quitar descuento» — solo admin
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { assertSchoolFinanceAdmin, assertSchoolFinanceReader } from '../middlewares/assertSchoolFinanceAdmin';
import { cobrosRateLimit } from '../middlewares/cobrosRateLimit';
import { AdjustmentsQuerySchema, RevertSchema } from '../services/charge-batches.schemas';
import { informeDeAjustes, revertPaymentAdjustment } from '../services/charge-batches.service';
import { responderError, validar } from './charge-batches.routes';

const router = Router();
// Cupo por usuario: GET (informe) → lectura 120/min; revert → escritura 20/min.
router.use(requireAuth, (req: Request, res: Response, next: NextFunction) => cobrosRateLimit.porRequest(req, res, next));

router.get(
    '/',
    requireRole('owner', 'admin', 'school_admin', 'accountant'),
    assertSchoolFinanceReader,
    async (req: Request, res: Response) => {
        const q = validar(AdjustmentsQuerySchema, req.query, res);
        if (!q) return;
        try {
            return res.json(await informeDeAjustes(req.schoolId, q));
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

const IdParam = z.object({ id: z.string().uuid('Identificador de descuento inválido') });

router.post(
    '/:id/revert',
    requireRole('owner', 'admin', 'school_admin'),
    assertSchoolFinanceAdmin,
    async (req: Request, res: Response) => {
        const p = validar(IdParam, req.params, res);
        if (!p) return;
        const body = validar(RevertSchema, req.body, res);
        if (!body) return;
        try {
            const data = await revertPaymentAdjustment(req.schoolId, req.user.id, p.id, body.reason);
            req.log?.info?.({ evento: 'payment_adjustment_reverted', school_id: req.schoolId, actor: req.user.id, adjustment_id: p.id }, 'payment_adjustment_reverted');
            return res.json(data);
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

export default router;
