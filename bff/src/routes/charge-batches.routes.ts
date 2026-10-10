/**
 * Modal «Cobros y pagos» — operaciones (spec docs/specs/cobros-multiples.md §9.1, F2).
 *
 *   POST /api/v1/charge-batches/preview         vista previa (no escribe)
 *   POST /api/v1/charge-batches                 confirma: crea cobros, ajustes y pagos (una transacción)
 *   GET  /api/v1/charge-batches                 historial («Operaciones») — admin + contador
 *   GET  /api/v1/charge-batches/targets         atletas activos de un equipo / categoría / plan
 *   GET  /api/v1/charge-batches/athlete-search  buscador + duplicados antes de «+ Atleta nuevo»
 *   GET  /api/v1/charge-batches/:id             detalle con el estado actual de cada cobro — admin + contador
 *   POST /api/v1/charge-batches/:id/annul       anula lo anulable del lote (Q12)
 *
 * Autorización: requireRole (filtro grueso) + assertSchoolFinanceAdmin /
 * assertSchoolFinanceReader (el gate real: rol EN ESTA escuela). Coach,
 * reporter, acudiente y atleta: 403. La RPC re-valida `p_actor`.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { assertSchoolFinanceAdmin, assertSchoolFinanceReader } from '../middlewares/assertSchoolFinanceAdmin';
import { chargeBatchRateLimit } from '../middlewares/chargeBatchRateLimit';
import { cobrosRateLimit } from '../middlewares/cobrosRateLimit';
import {
    ChargeBatchRequestSchema, ChargeBatchCreateSchema, AnnulSchema, ListQuerySchema,
    TargetsQuerySchema, AthleteSearchQuerySchema, primerError, filasDeLaOperacion,
    type ChargeBatchRequest,
} from '../services/charge-batches.schemas';
import {
    CobrosError, verificarPertenencia, previewChargeBatch, createChargeBatch, annulChargeBatch,
    listarLotes, detalleLote, atletasDelGrupo,
} from '../services/charge-batches.service';
import { buscarCoincidencias } from '../services/athlete-duplicates.service';

const router = Router();

const ADMIN_ROLES = ['owner', 'admin', 'school_admin'] as const;
const LECTURA_ROLES = [...ADMIN_ROLES, 'accountant'] as const;

/** Respuesta uniforme de error: CobrosError → su status; lo demás → 500 sin detalles internos. */
export function responderError(req: Request, res: Response, err: unknown) {
    if (err instanceof CobrosError) {
        return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
    }
    req.log?.error?.({ err }, 'charge-batches: error inesperado');
    return res.status(500).json({ error: 'No se pudo completar la operación. Intenta de nuevo.', code: 'ERROR_INTERNO' });
}

/** zod → 422 con el primer mensaje en español y la lista completa para el modal. */
export function validar<T>(schema: z.ZodType<T>, valor: unknown, res: Response): T | null {
    const r = schema.safeParse(valor);
    if (!r.success) {
        res.status(422).json({
            error: primerError(r.error),
            code: 'VALIDACION',
            issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
        return null;
    }
    return r.data;
}

/** H4 / Q6: las horas adicionales solo las factura el dueño. */
function exigirDuenoSiHayExcedente(req: Request, b: ChargeBatchRequest) {
    if (b.lines.some((l) => l.category === 'excedente') && req.nivelFinanzas !== 'dueno') {
        throw new CobrosError(403, 'SOLO_DUENO_EXCEDENTE', 'Solo el dueño de la escuela puede facturar horas adicionales.');
    }
}

// Después de requireAuth: el cupo es POR USUARIO (lectura 120/min, preview 60/min,
// escritura 20/min — ver cobrosRateLimit.ts). Confirmar suma además chargeBatchRateLimit.
router.use(requireAuth, (req: Request, res: Response, next: NextFunction) => cobrosRateLimit.porRequest(req, res, next));

// ─── Vista previa ────────────────────────────────────────────────────────────
router.post(
    '/preview',
    requireRole(...ADMIN_ROLES),
    assertSchoolFinanceAdmin,
    async (req: Request, res: Response) => {
        const body = validar(ChargeBatchRequestSchema, req.body, res);
        if (!body) return;
        try {
            exigirDuenoSiHayExcedente(req, body);
            await verificarPertenencia(req.schoolId, body);
            const data = await previewChargeBatch(req.schoolId, req.user.id, body);
            return res.json(data);
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

// ─── Confirmar ───────────────────────────────────────────────────────────────
router.post(
    '/',
    requireRole(...ADMIN_ROLES),
    assertSchoolFinanceAdmin,
    (req: Request, res: Response, next: NextFunction) => {
        const body = validar(ChargeBatchCreateSchema, req.body, res);
        if (!body) return;
        res.locals.body = body;
        res.locals.filasDelLote = filasDeLaOperacion(body);
        res.locals.clientRequestId = body.client_request_id;
        next();
    },
    (req: Request, res: Response, next: NextFunction) => chargeBatchRateLimit.middleware(req, res, next),
    async (req: Request, res: Response) => {
        const body = res.locals.body as z.infer<typeof ChargeBatchCreateSchema>;
        const inicio = Date.now();
        try {
            exigirDuenoSiHayExcedente(req, body);
            await verificarPertenencia(req.schoolId, body);
            const data = await createChargeBatch(req.schoolId, req.user.id, body);
            // §9.3: log estructurado sin nombres de menores.
            req.log?.info?.({
                evento: 'charge_batch_created',
                school_id: req.schoolId,
                actor: req.user.id,
                batch_id: data.batch_id ?? null,
                duplicated: data.duplicated === true,
                mode: body.mode,
                athletes: body.athletes.length + (body.new_athlete ? 1 : 0),
                lines: body.lines.length,
                pending: body.pending.length,
                rows_created: data.rows_created ?? null,
                total_amount: data.total_amount ?? null,
                ms: Date.now() - inicio,
            }, 'charge_batch_created');
            return res.status(200).json(data);
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

// ─── Historial ───────────────────────────────────────────────────────────────
router.get(
    '/',
    requireRole(...LECTURA_ROLES),
    assertSchoolFinanceReader,
    async (req: Request, res: Response) => {
        const q = validar(ListQuerySchema, req.query, res);
        if (!q) return;
        try {
            return res.json(await listarLotes(req.schoolId, q.cursor, q.limit));
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

// ─── Destinos por grupo (antes de /:id) ─────────────────────────────────────
router.get(
    '/targets',
    requireRole(...ADMIN_ROLES),
    assertSchoolFinanceAdmin,
    async (req: Request, res: Response) => {
        const q = validar(TargetsQuerySchema, req.query, res);
        if (!q) return;
        try {
            const r = await atletasDelGrupo(req.schoolId, q.kind, q.id, q.include_paused);
            const sinAcudiente = r.athletes.filter((a: any) => a.has_guardian === false).length;
            return res.json({ ...r, count: r.athletes.length, without_guardian: sinAcudiente });
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

// ─── Buscador / duplicados («+ Atleta nuevo») ───────────────────────────────
router.get(
    '/athlete-search',
    requireRole(...ADMIN_ROLES),
    assertSchoolFinanceAdmin,
    async (req: Request, res: Response) => {
        const q = validar(AthleteSearchQuerySchema, req.query, res);
        if (!q) return;
        try {
            const items = await buscarCoincidencias(
                req.schoolId,
                { fullName: q.q, docNumber: q.doc, phone: q.phone },
                { modo: 'buscador', limite: 20 },
            );
            return res.json({
                items,
                // ¿Hay un duplicado real? (documento o nombre). El teléfono solo es informativo.
                has_duplicate: items.some((i) => i.es_duplicado),
            });
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

const IdParam = z.object({ id: z.string().uuid('Identificador de operación inválido') });

// ─── Detalle ─────────────────────────────────────────────────────────────────
router.get(
    '/:id',
    requireRole(...LECTURA_ROLES),
    assertSchoolFinanceReader,
    async (req: Request, res: Response) => {
        const p = validar(IdParam, req.params, res);
        if (!p) return;
        try {
            return res.json(await detalleLote(req.schoolId, p.id));
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

// ─── Anular ──────────────────────────────────────────────────────────────────
router.post(
    '/:id/annul',
    requireRole(...ADMIN_ROLES),
    assertSchoolFinanceAdmin,
    async (req: Request, res: Response) => {
        const p = validar(IdParam, req.params, res);
        if (!p) return;
        const body = validar(AnnulSchema, req.body, res);
        if (!body) return;
        try {
            const data = await annulChargeBatch(req.schoolId, req.user.id, p.id, body.reason, body.expected_count);
            req.log?.info?.({ evento: 'charge_batch_annulled', school_id: req.schoolId, actor: req.user.id, batch_id: p.id, annulled: data.annulled ?? null }, 'charge_batch_annulled');
            return res.json(data);
        } catch (err) {
            return responderError(req, res, err);
        }
    },
);

export default router;
