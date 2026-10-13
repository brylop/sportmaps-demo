/**
 * Cobros de UN atleta para el modal «Cobros y pagos» (spec cobros-multiples §9.1, F2).
 *
 *   GET /api/v1/athletes/:athleteType/:athleteId/open-charges
 *       Sección «Cobros pendientes»: saldo, desglose de descuentos en orden,
 *       en revisión / pago en curso, aviso del 50 % y sugerencias (pronto pago,
 *       varios meses). Reemplaza la lectura directa de RegisterCashPaymentModal.
 *   GET /api/v1/athletes/:athleteType/:athleteId/charge-suggestions
 *       Inscripciones con monto sugerido de mensualidad (D4), próximo mes sin
 *       cobro y excedentes `suggested`.
 *
 * athleteType ∈ child | adult | unregistered. El atleta debe ser de req.schoolId (404 si no).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { assertSchoolFinanceAdmin } from '../middlewares/assertSchoolFinanceAdmin';
import { cobrosRateLimit } from '../middlewares/cobrosRateLimit';
import { AthleteParamsSchema } from '../services/charge-batches.schemas';
import { cobrosAbiertos, sugerenciasDeCobro, verificarAtleta } from '../services/charge-batches.service';
import { responderError, validar } from './charge-batches.routes';

const router = Router();

// Sin router.use: este router se monta en /api/v1/athletes junto a bulkUpload,
// y un middleware global de auth aquí alcanzaría también esas rutas.
// El cupo de lectura del modal (120/min por usuario) va en el gate y no en el montaje,
// por la misma razón: así no alcanza a bulkUpload.
const gate = [
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => cobrosRateLimit.read(req, res, next),
    requireRole('owner', 'admin', 'school_admin'),
    assertSchoolFinanceAdmin,
];

async function conAtleta(req: Request, res: Response, fn: (a: { type: 'child' | 'adult' | 'unregistered'; id: string }) => Promise<unknown>) {
    const p = validar(AthleteParamsSchema, req.params, res);
    if (!p) return;
    try {
        const atleta = { type: p.athleteType, id: p.athleteId };
        await verificarAtleta(req.schoolId, atleta);
        return res.json(await fn(atleta));
    } catch (err) {
        return responderError(req, res, err);
    }
}

router.get('/:athleteType/:athleteId/open-charges', ...gate, (req: Request, res: Response) =>
    conAtleta(req, res, (a) => cobrosAbiertos(req.schoolId, a)));

router.get('/:athleteType/:athleteId/charge-suggestions', ...gate, (req: Request, res: Response) =>
    conAtleta(req, res, (a) => sugerenciasDeCobro(req.schoolId, a)));

export default router;
