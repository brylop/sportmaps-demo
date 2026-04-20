import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schemas ──────────────────────────────────────────────────────────────────

const CreateSessionSchema = z.object({
    paymentId: z.string().uuid(),
    enrollmentId: z.string().uuid().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const EPAYCO_APIFY_URL = 'https://apify.epayco.co';

async function getEpaycoToken(): Promise<string> {
    const publicKey = process.env.EPAYCO_PUBLIC_KEY;
    const privateKey = process.env.EPAYCO_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        throw new Error('Credenciales de ePayco no configuradas en el servidor.');
    }

    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

    const res = await fetch(`${EPAYCO_APIFY_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`ePayco login failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    // ePayco returns { token: "...", ... }
    if (!data.token) {
        throw new Error('ePayco login response missing token');
    }
    return data.token;
}

// ── POST /create-session ─────────────────────────────────────────────────────
// Crea una sesión de pago en ePayco y registra el payment_link en Supabase.
// El frontend recibe SOLO el sessionId (temporal) — nunca claves ni montos editables.
router.post(
    '/create-session',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'parent', 'athlete'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            // 1. Validar entrada
            const parsed = CreateSessionSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Datos inválidos',
                    details: parsed.error.issues,
                });
            }

            const { paymentId, enrollmentId } = parsed.data;
            const { schoolId } = req;

            // 2. Obtener el pago de la BD
            const { data: payment, error: paymentErr } = await supabase
                .from('payments')
                .select('id, amount, status, concept, child_id, user_id, school_id')
                .eq('id', paymentId)
                .eq('school_id', schoolId)
                .single();

            if (paymentErr || !payment) {
                return res.status(404).json({ error: 'Pago no encontrado.' });
            }

            // 3. Verificar estado del pago
            if (!['pending', 'overdue'].includes(payment.status)) {
                return res.status(400).json({
                    error: `Este pago no se puede procesar (estado actual: ${payment.status}).`,
                });
            }

            // 4. Obtener school_settings → verificar si ePayco está habilitado
            const { data: settings } = await supabase
                .from('school_settings')
                .select('epayco_enabled, online_fee_pct, fee_payer')
                .eq('school_id', schoolId)
                .single();

            if (!settings?.epayco_enabled) {
                return res.status(400).json({
                    error: 'Los pagos online no están habilitados para esta escuela.',
                });
            }

            const feePct = Number(settings.online_fee_pct ?? 3);

            // 5. Verificar que no exista un payment_link activo (pending y no expirado)
            const { data: existingLink } = await supabase
                .from('payment_links')
                .select('id, status, expires_at')
                .eq('payment_id', paymentId)
                .eq('status', 'pending')
                .gte('expires_at', new Date().toISOString())
                .maybeSingle();

            if (existingLink) {
                return res.status(409).json({
                    error: 'Ya existe un enlace de pago activo para este pago.',
                });
            }

            // 6. Calcular montos — NUNCA desde el frontend
            const baseAmount = Number(payment.amount);
            const sportmapsFee = Math.round(baseAmount * (feePct / 100));
            const grossAmount = baseAmount + sportmapsFee;

            // 7. Autenticarse con ePayco APIFY
            const epaycoToken = await getEpaycoToken();

            // 8. URL de confirmación y respuesta
            const bffUrl = process.env.BFF_URL || 'https://sportmaps-bff.onrender.com';
            const frontendUrl = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

            // 9. Crear sesión de checkout en ePayco
            const sessionRes = await fetch(`${EPAYCO_APIFY_URL}/payment/session/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${epaycoToken}`,
                },
                body: JSON.stringify({
                    checkout_version: '2',
                    name: payment.concept || 'Pago SportMaps',
                    description: `Pago ${payment.concept || ''} — SportMaps`,
                    currency: 'COP',
                    amount: String(grossAmount),
                    tax: '0',
                    tax_base: String(grossAmount),
                    invoice: paymentId,
                    confirmation: `${bffUrl}/api/v1/webhooks/epayco`,
                    response: `${frontendUrl}/pagos/confirmacion`,
                    extras: {
                        extra1: paymentId,
                        extra2: schoolId,
                        extra3: enrollmentId || '',
                    },
                }),
            });

            if (!sessionRes.ok) {
                const errBody = await sessionRes.text();
                req.log?.error({ errBody }, 'ePayco session create failed');
                return res.status(502).json({
                    error: 'No se pudo crear la sesión de pago con ePayco.',
                });
            }

            const sessionData = await sessionRes.json();
            const sessionId = sessionData.data?.sessionId || sessionData.sessionId;

            if (!sessionId) {
                req.log?.error({ sessionData }, 'ePayco session response missing sessionId');
                return res.status(502).json({
                    error: 'ePayco no retornó un ID de sesión válido.',
                });
            }

            // 10. Generar token único para el payment_link
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

            // 11. Insertar payment_link en Supabase
            const { error: linkErr } = await supabase
                .from('payment_links')
                .insert({
                    payment_id: paymentId,
                    school_id: schoolId,
                    token,
                    epayco_session_id: sessionId,
                    gross_amount: grossAmount,
                    base_amount: baseAmount,
                    sportmaps_fee: sportmapsFee,
                    fee_pct: feePct,
                    status: 'pending',
                    expires_at: expiresAt.toISOString(),
                    failed_attempts: 0,
                });

            if (linkErr) {
                req.log?.error({ err: linkErr }, 'Error inserting payment_link');
                return res.status(500).json({ error: 'Error al registrar el enlace de pago.' });
            }

            // 12. Retornar al frontend — SOLO sessionId + info de desglose (no claves)
            res.status(201).json({
                sessionId,
                token,
                grossAmount,
                baseAmount,
                sportmapsFee,
                feePct,
            });
        } catch (err: any) {
            req.log?.error({ err }, 'Error creating ePayco session');
            res.status(500).json({
                error: err.message || 'Error interno al crear sesión de pago.',
            });
        }
    },
);

// ── GET /link/:token ─────────────────────────────────────────────────────────
// Ruta PÚBLICA (sin auth) — retorna la info del pago para la página de confirmación.
// Usado por /pagos/confirmacion después de que ePayco redirecciona al padre.
router.get('/link/:token', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { token } = req.params;

        const { data: link, error } = await supabase
            .from('payment_links')
            .select(`
                id, payment_id, school_id, token,
                gross_amount, base_amount, sportmaps_fee, fee_pct,
                status, expires_at, paid_at, created_at
            `)
            .eq('token', token)
            .single();

        if (error || !link) {
            return res.status(404).json({ error: 'Enlace de pago no encontrado.' });
        }

        // Enriquecer con datos del pago original y la escuela
        const { data: payment } = await supabase
            .from('payments')
            .select('id, concept, child_id, user_id, due_date, status')
            .eq('id', link.payment_id)
            .single();

        let childName: string | null = null;
        if (payment?.child_id) {
            const { data: child } = await supabase
                .from('children')
                .select('full_name')
                .eq('id', payment.child_id)
                .single();
            childName = child?.full_name || null;
        }

        const { data: school } = await supabase
            .from('schools')
            .select('name')
            .eq('id', link.school_id)
            .single();

        res.json({
            linkStatus: link.status,
            grossAmount: link.gross_amount,
            baseAmount: link.base_amount,
            sportmapsFee: link.sportmaps_fee,
            feePct: link.fee_pct,
            expiresAt: link.expires_at,
            paidAt: link.paid_at,
            concept: payment?.concept || null,
            childName,
            schoolName: school?.name || null,
            paymentStatus: payment?.status || null,
            nextDueDate: payment?.due_date || null,
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error fetching payment link');
        res.status(500).json({ error: 'Error al obtener información del pago.' });
    }
});

export default router;
