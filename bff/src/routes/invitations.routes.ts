import { Router, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

// Resend acepta hasta 100 correos por llamada a /emails/batch.
const RESEND_BATCH_LIMIT = 100;

const BulkSendSchema = z.object({
    // Selección explícita (la usa el botón "Invitar" de la pantalla de atletas).
    // Si viene, manda exactamente a esas invitaciones e ignora `filter`.
    invitation_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    // 'unsent'  → solo los que nunca salieron (lo normal para retomar una tanda)
    // 'pending' → todas las invitaciones pendientes, hayan salido o no
    filter: z.enum(['unsent', 'pending']).default('unsent'),
    limit: z.number().int().min(1).max(500).default(500),
    batchSize: z.number().int().min(1).max(RESEND_BATCH_LIMIT).default(RESEND_BATCH_LIMIT),
    // Pausa entre lotes. Con lotes de 100 sobra: 394 correos son 4 requests.
    delayMs: z.number().int().min(0).max(60_000).default(1500),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BatchItem {
    type: 'parent_invitation' | 'coach_invitation';
    to: string;
    data: Record<string, string>;
}

/**
 * Llama a la edge function send-email con un lote. Reintenta ante 429 (rate
 * limit) y 5xx con backoff exponencial. Un 4xx que no sea 429 no se reintenta:
 * es cuota agotada o payload inválido, y repetirlo no lo arregla.
 */
async function sendBatchWithRetry(
    batch: BatchItem[],
    maxAttempts = 3
): Promise<{ ok: boolean; attempts: number; results?: { to: string; id: string | null }[]; error?: string; status?: number }> {
    let lastError = '';
    let lastStatus = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify({ batch }),
            });

            const text = await response.text();
            lastStatus = response.status;

            if (response.ok) {
                const parsed = JSON.parse(text);
                return { ok: true, attempts: attempt, results: parsed.results || [] };
            }

            lastError = text;

            const retriable = response.status === 429 || response.status >= 500;
            if (!retriable || attempt === maxAttempts) {
                return { ok: false, attempts: attempt, error: text, status: response.status };
            }

            // backoff: 2s, 4s, 8s…
            await sleep(2000 * Math.pow(2, attempt - 1));
        } catch (err: any) {
            lastError = err?.message || String(err);
            if (attempt === maxAttempts) {
                return { ok: false, attempts: attempt, error: lastError, status: lastStatus };
            }
            await sleep(2000 * Math.pow(2, attempt - 1));
        }
    }

    return { ok: false, attempts: maxAttempts, error: lastError, status: lastStatus };
}

// ── POST /api/v1/invitations/bulk-send ───────────────────────────────────────
// Reenvía las invitaciones pendientes de la escuela en lotes, dejando registro
// en email_sends para poder reintentar solo las que fallaron.
router.post(
    '/bulk-send',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = BulkSendSchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;
            if (!schoolId) {
                return res.status(400).json({ error: 'No se pudo resolver la escuela del usuario' });
            }

            const { filter, limit, batchSize, delayMs, invitation_ids } = parsed.data;

            const { data: school } = await supabase
                .from('schools')
                .select('name')
                .eq('id', schoolId)
                .maybeSingle();

            const schoolName = school?.name || 'tu academia';

            // 1. Invitaciones pendientes con correo
            //    El filtro por school_id no es cosmético: impide que un admin
            //    mande correos a invitaciones de otra escuela pasando sus ids.
            let query = supabase
                .from('invitations')
                .select('id, email, role_to_assign, child_name')
                .eq('school_id', schoolId)
                .eq('status', 'pending')
                .not('email', 'is', null);

            if (invitation_ids?.length) {
                query = query.in('id', invitation_ids);
            }

            const { data: invitations, error: invError } = await query.order('created_at', { ascending: true });

            if (invError) throw invError;

            let targets = (invitations || []).filter((inv: any) => (inv.email || '').trim() !== '');

            // 2. Excluir las que YA salieron (a menos que se pida reenviar a todas
            //    o que el llamador haya elegido destinatarios explícitamente)
            if (filter === 'unsent' && !invitation_ids?.length) {
                const { data: alreadySent, error: sentError } = await supabase
                    .from('email_sends')
                    .select('invitation_id')
                    .eq('school_id', schoolId)
                    .eq('status', 'sent')
                    .not('invitation_id', 'is', null);

                if (sentError) throw sentError;

                const sentIds = new Set((alreadySent || []).map((row: any) => row.invitation_id));
                targets = targets.filter((inv: any) => !sentIds.has(inv.id));
            }

            targets = targets.slice(0, limit);

            if (targets.length === 0) {
                return res.json({
                    message: filter === 'unsent'
                        ? 'No hay invitaciones pendientes sin enviar'
                        : 'No hay invitaciones pendientes',
                    total: 0, sent: 0, failed: 0, batches: 0,
                });
            }

            // 3. Enviar por lotes
            const batchId = randomUUID();
            const logRows: any[] = [];
            let sent = 0;
            let failed = 0;
            let batches = 0;
            let abortedReason: string | null = null;

            for (let i = 0; i < targets.length; i += batchSize) {
                const slice = targets.slice(i, i + batchSize);

                const batch: BatchItem[] = slice.map((inv: any) => {
                    const isCoach = inv.role_to_assign === 'coach';
                    const registrationUrl =
                        `${FRONTEND_URL}/register?email=${encodeURIComponent(inv.email)}` +
                        `&role=${inv.role_to_assign}&invite=${inv.id}`;

                    return {
                        type: isCoach ? 'coach_invitation' : 'parent_invitation',
                        to: inv.email,
                        data: {
                            schoolName,
                            childName: inv.child_name || '',
                            coachName: inv.child_name || '',
                            registrationUrl,
                        },
                    };
                });

                const result = await sendBatchWithRetry(batch);
                batches += 1;

                if (result.ok) {
                    const byEmail = new Map((result.results || []).map((r) => [r.to, r.id]));
                    slice.forEach((inv: any) => {
                        sent += 1;
                        logRows.push({
                            school_id: schoolId,
                            invitation_id: inv.id,
                            to_email: inv.email,
                            email_type: inv.role_to_assign === 'coach' ? 'coach_invitation' : 'parent_invitation',
                            provider_message_id: byEmail.get(inv.email) ?? null,
                            status: 'sent',
                            attempts: result.attempts,
                            batch_id: batchId,
                        });
                    });
                } else {
                    slice.forEach((inv: any) => {
                        failed += 1;
                        logRows.push({
                            school_id: schoolId,
                            invitation_id: inv.id,
                            to_email: inv.email,
                            email_type: inv.role_to_assign === 'coach' ? 'coach_invitation' : 'parent_invitation',
                            status: 'failed',
                            error: (result.error || '').slice(0, 1000),
                            attempts: result.attempts,
                            batch_id: batchId,
                        });
                    });

                    // Cuota agotada: seguir mandando lotes solo quema intentos.
                    // (Resend responde 4xx no-429 cuando se pasó el límite del plan.)
                    if (result.status && result.status !== 429 && result.status < 500) {
                        abortedReason = `Resend rechazó el lote (${result.status}). Se detuvo el envío para no gastar intentos.`;
                        break;
                    }
                }

                if (i + batchSize < targets.length && delayMs > 0) {
                    await sleep(delayMs);
                }
            }

            // 4. Registrar todo (el log nunca debe tumbar el envío)
            if (logRows.length > 0) {
                const { error: logError } = await supabase.from('email_sends').insert(logRows);
                if (logError) console.error('No se pudo escribir email_sends:', logError);
            }

            return res.json({
                message: abortedReason || `Envío completado: ${sent} enviados, ${failed} fallidos`,
                total: targets.length,
                sent,
                failed,
                batches,
                batch_id: batchId,
                aborted: Boolean(abortedReason),
            });
        } catch (err: any) {
            console.error('Error en bulk-send de invitaciones:', err);
            return res.status(500).json({ error: err.message || 'Error enviando invitaciones' });
        }
    }
);

// ── GET /api/v1/invitations/send-status ──────────────────────────────────────
// Resumen para la UI: cuántas pendientes, cuántas ya salieron, cuántas fallaron.
router.get(
    '/send-status',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { schoolId } = req;
            if (!schoolId) {
                return res.status(400).json({ error: 'No se pudo resolver la escuela del usuario' });
            }

            const { data: invitations } = await supabase
                .from('invitations')
                .select('id')
                .eq('school_id', schoolId)
                .eq('status', 'pending')
                .not('email', 'is', null);

            const { data: sends } = await supabase
                .from('email_sends')
                .select('invitation_id, status')
                .eq('school_id', schoolId)
                .not('invitation_id', 'is', null);

            const pendingIds = new Set((invitations || []).map((i: any) => i.id));
            const sentIds = new Set(
                (sends || []).filter((s: any) => s.status === 'sent').map((s: any) => s.invitation_id)
            );
            const failedIds = new Set(
                (sends || [])
                    .filter((s: any) => s.status === 'failed' && !sentIds.has(s.invitation_id))
                    .map((s: any) => s.invitation_id)
            );

            let enviadas = 0;
            let fallidas = 0;
            let sinIntentar = 0;
            pendingIds.forEach((id) => {
                if (sentIds.has(id)) enviadas += 1;
                else if (failedIds.has(id)) fallidas += 1;
                else sinIntentar += 1;
            });

            return res.json({
                pendientes: pendingIds.size,
                enviadas,
                fallidas,
                sin_intentar: sinIntentar,
            });
        } catch (err: any) {
            console.error('Error en send-status:', err);
            return res.status(500).json({ error: err.message || 'Error consultando estado de envíos' });
        }
    }
);

export default router;
