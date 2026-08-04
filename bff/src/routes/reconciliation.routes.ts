/**
 * reconciliation — Conciliación de pagos contra el extracto bancario (Fase 6).
 *
 * El frontend parsea el archivo (CSV/Excel) y manda las líneas ya canónicas;
 * el BFF normaliza la referencia (misma norma que el OCR), persiste el extracto
 * y dispara el cruce vía la RPC reconcile_statement (SECURITY DEFINER).
 *
 * Endpoints:
 *  - POST /api/v1/payments/reconciliation/upload   → sube extracto + concilia
 *  - GET  /api/v1/payments/reconciliation/dashboard → motivos de glosa
 *
 * Seguridad: solo owner / school_admin / admin global de la escuela. El cruce
 * corre con service_role dentro de la RPC; el actor autoriza (p_actor).
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { normalizeReference } from '../services/receipt-verdict';

const router = Router();

const LineSchema = z.object({
    occurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    amount: z.number().positive(),
    reference: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    counterparty: z.string().nullable().optional(),
});

const UploadSchema = z.object({
    bank: z.enum(['nequi', 'bancolombia', 'generic']).default('generic'),
    filename: z.string().optional(),
    periodYear: z.number().int().optional(),
    periodMonth: z.number().int().min(1).max(12).optional(),
    lines: z.array(LineSchema).min(1).max(5000),
});

// ── Autorización de escuela (owner / school_admin / admin) ─────────────────
async function isSchoolAuthorized(userId: string, schoolId: string): Promise<boolean> {
    const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
    if (profile?.role === 'admin') return true;

    const { data: school } = await supabase
        .from('schools').select('owner_id').eq('id', schoolId).maybeSingle();
    if (school?.owner_id === userId) return true;

    return profile?.role === 'school_admin' || profile?.role === 'owner';
}

// ── POST /upload — sube extracto y concilia ────────────────────────────────
router.post('/upload/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = String(req.params.schoolId);
    const parsed = UploadSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_body', details: parsed.error.issues });
    }
    if (!(await isSchoolAuthorized(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }

    const { bank, filename, periodYear, periodMonth, lines } = parsed.data;

    // Rango de fechas del extracto (acota qué pagos son conciliables).
    const dates = lines.map(l => l.occurredDate).filter(Boolean) as string[];
    const dateFrom = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    const dateTo = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    // 1. Cabecera
    const { data: stmt, error: stmtErr } = await supabase
        .from('bank_statements')
        .insert({
            school_id: schoolId,
            uploaded_by: req.user.id,
            bank,
            filename: filename ?? null,
            date_from: dateFrom,
            date_to: dateTo,
            period_year: periodYear ?? null,
            period_month: periodMonth ?? null,
            row_count: lines.length,
        })
        .select('id')
        .single();

    if (stmtErr || !stmt) {
        req.log?.error({ err: stmtErr }, 'reconciliation: error creando bank_statement');
        return res.status(500).json({ error: 'no se pudo registrar el extracto' });
    }

    // 2. Líneas (referencia normalizada con la MISMA norma que el OCR).
    const rows = lines.map(l => ({
        statement_id: stmt.id,
        school_id: schoolId,
        occurred_date: l.occurredDate ?? null,
        amount: l.amount,
        reference_norm: normalizeReference(l.reference ?? null),
        description: l.description ?? null,
        counterparty: l.counterparty ?? null,
    }));

    const { error: linesErr } = await supabase.from('bank_statement_lines').insert(rows);
    if (linesErr) {
        req.log?.error({ err: linesErr }, 'reconciliation: error insertando líneas');
        // Limpia la cabecera huérfana para poder reintentar.
        await supabase.from('bank_statements').delete().eq('id', stmt.id);
        return res.status(500).json({ error: 'no se pudieron registrar las líneas del extracto' });
    }

    // 3. Cruce (RPC SECURITY DEFINER, service_role). El actor autoriza.
    const { data: result, error: rpcErr } = await supabase.rpc('reconcile_statement', {
        p_actor: req.user.id,
        p_statement_id: stmt.id,
    });
    if (rpcErr) {
        req.log?.error({ err: rpcErr }, 'reconciliation: reconcile_statement falló');
        return res.status(500).json({ error: rpcErr.message });
    }

    return res.status(200).json({ statementId: stmt.id, summary: result });
});

// ── GET /dashboard — motivos de glosa por escuela/periodo ──────────────────
router.get('/dashboard/:schoolId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = String(req.params.schoolId);
    if (!(await isSchoolAuthorized(req.user.id, schoolId))) {
        return res.status(403).json({ error: 'forbidden' });
    }
    const from = typeof req.query.from === 'string' ? req.query.from : null;
    const to = typeof req.query.to === 'string' ? req.query.to : null;

    const { data, error } = await supabase.rpc('glosa_dashboard', {
        p_school_id: schoolId,
        p_from: from,
        p_to: to,
    });
    if (error) {
        req.log?.error({ err: error }, 'reconciliation: glosa_dashboard falló');
        return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ reasons: data ?? [] });
});

export default router;
