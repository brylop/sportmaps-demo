/**
 * Cambios de plan por clases tomadas (modo sombra / auto) — spec whatsapp-conversacion-v2-dynasty §3.7-3.8.
 *
 * Autorización: requireAuth + gate de la escuela (`req.schoolId`): GET = dueño/admin/school_admin
 * o contador (solo lectura); POST = dueño/admin. Coach, acudiente y atleta: 403.
 * Si la migración aún no está aplicada, los GET responden 200 con `disponible:false` (no 500).
 *
 * ── GET /api/v1/plan-changes?mode=sombra|auto&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&solo_con_deuda=true&limit=500
 *   (school_id opcional: si viene y no coincide con la escuela activa → 403)
 *   200 {
 *     disponible: boolean, motivo?: string,
 *     items: [{
 *       id, school_id, enrollment_id, mode:'sombra'|'auto', applied:boolean, source,
 *       direction:'up'|'down'|'same_price', created_at,
 *       atleta: string,                        // nombre (o 'Atleta')
 *       child_id|null, unregistered_athlete_id|null,
 *       from_plan_id, from_plan, from_amount, to_plan_id, to_plan, to_amount,
 *       clases_mes, amount_paid, debt_at_change,
 *       period_year, period_month,             // mes cuyas clases se contaron
 *       razon, changed_by
 *     }],
 *     total: number                            // = items.length (tope `limit`)
 *   }
 *
 * ── GET /api/v1/plan-changes/resumen?mode=&desde=&hasta=
 *   200 { disponible, up, down, same_price, total,
 *         down_con_deuda,                      // direction='down' y debt_at_change>0
 *         por_modo: { sombra: n, auto: n }, aplicados: n }
 *
 * ── POST /api/v1/plan-changes/correr-sombra   body { year?: int, month?: 1-12, dry_run?: boolean (def. true) }
 *   Sin year/month = mes anterior (Bogotá). dry_run=true NO escribe y simula aunque la escuela
 *   esté 'apagado'. dry_run=false registra SOLO filas de sombra (nunca cambia el plan, aunque la
 *   escuela esté en 'auto') y exige que la escuela tenga modo sombra/auto.
 *   200 { disponible, motivo_no_disponible?, dry_run, year, month, inscripciones_evaluadas,
 *         descartes: { <motivo>: n }, resumen: { up, down, same_price, down_con_deuda },
 *         escritas, ya_registradas, errores,
 *         propuestas: [{ enrollment_id, atleta, from_plan, to_plan, from_amount, to_amount, clases_mes,
 *                        amount_paid, debt_at_change, direction, razon, period_year, period_month }] }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/authMiddleware';
import { assertSchoolFinanceAdmin, assertSchoolFinanceReader } from '../middlewares/assertSchoolFinanceAdmin';
import { supabase } from '../config/supabase';
import { esFaltaDeEsquema, nombrePlan, leerAjustesPlanAsistencia } from '../services/plan-por-asistencia.service';
import { runPlanPorAsistencia } from '../jobs/plan-por-asistencia.job';

const router = Router();
router.use(requireAuth);

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ListaQuery = z.object({
    school_id: z.string().uuid().optional(),
    mode: z.enum(['sombra', 'auto']).optional(),
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
    solo_con_deuda: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500),
});
const CorrerBody = z.object({
    year: z.number().int().min(2024).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
    dry_run: z.boolean().default(true),
}).refine((b) => (b.year == null) === (b.month == null), { message: 'Indica año y mes juntos, o ninguno.' });

function escuelaOk(req: Request, res: Response, schoolIdQuery?: string): boolean {
    if (schoolIdQuery && schoolIdQuery !== req.schoolId) {
        res.status(403).json({ error: 'La escuela no coincide con la activa.', code: 'ESCUELA_DISTINTA' });
        return false;
    }
    return true;
}

const TABLA_NOMBRE = { child_id: 'children', unregistered_athlete_id: 'unregistered_athletes' } as const;
const trozos = <T>(xs: T[], n = 150): T[][] => { const o: T[][] = []; for (let i = 0; i < xs.length; i += n) o.push(xs.slice(i, i + n)); return o; };

router.get('/', assertSchoolFinanceReader, async (req: Request, res: Response) => {
    const q = ListaQuery.safeParse(req.query);
    if (!q.success) return res.status(422).json({ error: 'Parámetros inválidos.', code: 'VALIDACION' });
    if (!escuelaOk(req, res, q.data.school_id)) return;
    try {
        let qb = supabase.from('enrollment_plan_changes')
            .select('id, school_id, enrollment_id, child_id, unregistered_athlete_id, from_plan_id, to_plan_id, from_amount, to_amount, clases_mes, amount_paid, period_year, period_month, debt_at_change, direction, source, mode, applied, razon, changed_by, created_at')
            .eq('school_id', req.schoolId).order('created_at', { ascending: false }).limit(q.data.limit);
        if (q.data.mode) qb = qb.eq('mode', q.data.mode);
        if (q.data.desde) qb = qb.gte('created_at', `${q.data.desde}T00:00:00-05:00`);
        if (q.data.hasta) qb = qb.lt('created_at', `${q.data.hasta}T23:59:59.999-05:00`);
        if (q.data.solo_con_deuda === 'true') qb = qb.gt('debt_at_change', 0);
        const { data, error } = await qb;
        if (error) {
            if (esFaltaDeEsquema(error)) return res.json({ disponible: false, motivo: 'migracion_pendiente', items: [], total: 0 });
            throw error;
        }
        const filas = (data ?? []) as any[];

        // Nombres y planes en lote.
        const planIds = [...new Set(filas.flatMap((f) => [f.from_plan_id, f.to_plan_id]).filter(Boolean))];
        const planes = new Map<string, string>();
        for (const t of trozos(planIds)) {
            const { data: pl } = await supabase.from('offering_plans').select('id, name').in('id', t);
            for (const p of (pl ?? []) as any[]) planes.set(p.id, nombrePlan({ name: p.name ?? '' }));
        }
        const nombres = new Map<string, string>();
        for (const col of ['child_id', 'unregistered_athlete_id'] as const) {
            const ids = [...new Set(filas.map((f) => f[col]).filter(Boolean))] as string[];
            for (const t of trozos(ids)) {
                const { data: ns } = await supabase.from(TABLA_NOMBRE[col]).select('id, full_name').in('id', t);
                for (const n of (ns ?? []) as any[]) nombres.set(`${col}:${n.id}`, n.full_name ?? 'Atleta');
            }
        }
        const items = filas.map((f) => ({
            ...f,
            from_amount: f.from_amount != null ? Number(f.from_amount) : null,
            to_amount: f.to_amount != null ? Number(f.to_amount) : null,
            amount_paid: f.amount_paid != null ? Number(f.amount_paid) : null,
            debt_at_change: Number(f.debt_at_change ?? 0),
            atleta: nombres.get(`child_id:${f.child_id}`) ?? nombres.get(`unregistered_athlete_id:${f.unregistered_athlete_id}`) ?? 'Atleta',
            from_plan: planes.get(f.from_plan_id) ?? null,
            to_plan: planes.get(f.to_plan_id) ?? null,
        }));
        return res.json({ disponible: true, items, total: items.length });
    } catch (err) {
        req.log?.error?.({ err }, 'plan-changes: no se pudo listar');
        return res.status(500).json({ error: 'No se pudo cargar la lista.', code: 'ERROR_INTERNO' });
    }
});

router.get('/resumen', assertSchoolFinanceReader, async (req: Request, res: Response) => {
    const q = ListaQuery.pick({ school_id: true, mode: true, desde: true, hasta: true }).safeParse(req.query);
    if (!q.success) return res.status(422).json({ error: 'Parámetros inválidos.', code: 'VALIDACION' });
    if (!escuelaOk(req, res, q.data.school_id)) return;
    try {
        let qb = supabase.from('enrollment_plan_changes')
            .select('direction, debt_at_change, mode, applied').eq('school_id', req.schoolId).limit(10000);
        if (q.data.mode) qb = qb.eq('mode', q.data.mode);
        if (q.data.desde) qb = qb.gte('created_at', `${q.data.desde}T00:00:00-05:00`);
        if (q.data.hasta) qb = qb.lt('created_at', `${q.data.hasta}T23:59:59.999-05:00`);
        const { data, error } = await qb;
        if (error) {
            if (esFaltaDeEsquema(error)) return res.json({ disponible: false, motivo: 'migracion_pendiente' });
            throw error;
        }
        const f = (data ?? []) as any[];
        // Modo REAL de la escuela (leerAjustes solo devuelve las que están en sombra/auto: ausente = apagado).
        const ajustes = await leerAjustesPlanAsistencia([req.schoolId as string]).catch(() => null);
        const modoEscuela = ajustes?.disponible ? (ajustes.porEscuela.get(req.schoolId as string)?.modo ?? 'apagado') : null;
        return res.json({
            disponible: true,
            modo_escuela: modoEscuela,
            up: f.filter((x) => x.direction === 'up').length,
            down: f.filter((x) => x.direction === 'down').length,
            same_price: f.filter((x) => x.direction === 'same_price').length,
            total: f.length,
            down_con_deuda: f.filter((x) => x.direction === 'down' && Number(x.debt_at_change) > 0).length,
            por_modo: { sombra: f.filter((x) => x.mode === 'sombra').length, auto: f.filter((x) => x.mode === 'auto').length },
            aplicados: f.filter((x) => x.applied).length,
        });
    } catch (err) {
        req.log?.error?.({ err }, 'plan-changes: no se pudo resumir');
        return res.status(500).json({ error: 'No se pudo cargar el resumen.', code: 'ERROR_INTERNO' });
    }
});

router.post('/correr-sombra', assertSchoolFinanceAdmin, async (req: Request, res: Response) => {
    const b = CorrerBody.safeParse(req.body ?? {});
    if (!b.success) return res.status(422).json({ error: b.error.issues[0]?.message ?? 'Datos inválidos.', code: 'VALIDACION' });
    try {
        const r = await runPlanPorAsistencia({
            year: b.data.year, month: b.data.month, schoolIds: [req.schoolId],
            dryRun: b.data.dry_run, modoSimulado: 'sombra', soloSombra: true,
        });
        const { propuestas, ...resto } = r;
        return res.json({
            ...resto,
            propuestas: propuestas.map((p) => ({
                enrollment_id: p.enrollment_id, atleta: p.atleta, from_plan: p.from_plan, to_plan: p.to_plan,
                from_amount: p.from_amount, to_amount: p.to_amount, clases_mes: p.clases_mes, amount_paid: p.amount_paid,
                debt_at_change: p.debt_at_change, direction: p.direction, razon: p.razon,
                period_year: p.period_year, period_month: p.period_month,
            })),
        });
    } catch (err) {
        req.log?.error?.({ err }, 'plan-changes: no se pudo correr');
        return res.status(500).json({ error: 'No se pudo calcular.', code: 'ERROR_INTERNO' });
    }
});

export default router;
