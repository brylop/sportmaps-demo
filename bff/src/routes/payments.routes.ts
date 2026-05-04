/**
 * payments.routes — Pagos de escuela via Wompi.
 *
 * Reemplaza la ruta antigua /api/v1/payments (pasarela legacy).
 * Endpoints:
 *  - POST /api/v1/payments/create-session
 *      Crea o reutiliza un payment_link para un pago de escuela
 *      y devuelve la `reference` que el frontend pasara al Widget Wompi.
 *  - GET /api/v1/payments/link/:token
 *      Pagina publica de informacion del enlace de pago (sin auth).
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { generateReference, copToCents, assertUserNotBlocked, UserPaymentBlockedError } from '../services/wompi.service';

const router = Router();

const CreateSessionSchema = z.object({
    paymentId: z.string().uuid(),
    enrollmentId: z.string().uuid().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /create-session — Crea referencia Wompi para un pago de escuela
// ─────────────────────────────────────────────────────────────────────────────
// El frontend recibe { reference, amountInCents } y abre el Widget Wompi.
// La firma de integridad la pide el frontend a la Edge Function `wompi-sign`.
// Validamos: pago existe, pertenece a la escuela, esta en estado pagable,
// la escuela tiene Wompi habilitado, y no existe link activo previo.
router.post(
    '/create-session',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin', 'parent', 'athlete'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const parsed = CreateSessionSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Datos invalidos',
                    details: parsed.error.issues,
                });
            }

            const { paymentId, enrollmentId } = parsed.data;
            const { schoolId } = req;

            // 0. Lock de negocio: si el usuario tiene pagos pendientes de revision,
            // no puede iniciar ningun nuevo checkout hasta que el negocio destrabe.
            try {
                await assertUserNotBlocked(req.user.id);
            } catch (err) {
                if (err instanceof UserPaymentBlockedError) {
                    return res.status(409).json({
                        error: err.message,
                        code: err.code,
                        details: err.details,
                    });
                }
                throw err;
            }

            // 1. Pago debe existir y pertenecer a la escuela del request
            const { data: payment, error: paymentErr } = await supabase
                .from('payments')
                .select('id, amount, status, concept, child_id, user_id, school_id, requires_review')
                .eq('id', paymentId)
                .eq('school_id', schoolId)
                .single();

            if (paymentErr || !payment) {
                return res.status(404).json({ error: 'Pago no encontrado.' });
            }

            // 1.b Lock especifico al pago
            if ((payment as any).requires_review) {
                return res.status(409).json({
                    error: 'Este pago esta bloqueado pendiente de revision del negocio.',
                    code: 'PAYMENT_REQUIRES_REVIEW',
                });
            }

            // 2. Estado pagable
            if (!['pending', 'overdue'].includes(payment.status)) {
                return res.status(400).json({
                    error: `Este pago no se puede procesar (estado actual: ${payment.status}).`,
                });
            }

            // 3. La escuela debe tener Wompi habilitado
            const { data: settings } = await supabase
                .from('school_settings')
                .select('wompi_enabled, online_fee_pct, fee_payer')
                .eq('school_id', schoolId)
                .single();

            if (!settings?.wompi_enabled) {
                return res.status(400).json({
                    error: 'Los pagos online no estan habilitados para esta escuela.',
                });
            }

            const feePct = Number(settings.online_fee_pct ?? 3);

            // 4. No reutilizar links activos (idempotencia debil — evita doble cobro accidental)
            const { data: existingLink } = await supabase
                .from('payment_links')
                .select('id, status, expires_at, wompi_reference, gross_amount, base_amount, sportmaps_fee, fee_pct')
                .eq('payment_id', paymentId)
                .eq('status', 'pending')
                .gte('expires_at', new Date().toISOString())
                .maybeSingle();

            if (existingLink && existingLink.wompi_reference) {
                // Devolver el link activo en lugar de crear uno nuevo
                return res.status(200).json({
                    reference: existingLink.wompi_reference,
                    amountInCents: copToCents(Number(existingLink.gross_amount)),
                    grossAmount: Number(existingLink.gross_amount),
                    baseAmount: Number(existingLink.base_amount),
                    sportmapsFee: Number(existingLink.sportmaps_fee),
                    feePct: Number(existingLink.fee_pct),
                    reused: true,
                });
            }

            // 5. Calcular montos en el server (NUNCA confiar en el cliente)
            const baseAmount = Number(payment.amount);
            const sportmapsFee = Math.round(baseAmount * (feePct / 100));
            const grossAmount = baseAmount + sportmapsFee;

            // 6. Generar referencia Wompi unica
            const reference = generateReference('school_payment');
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

            // 7. Persistir payment_link
            const { error: linkErr } = await supabase
                .from('payment_links')
                .insert({
                    payment_id: paymentId,
                    school_id: schoolId,
                    token,
                    wompi_reference: reference,
                    gross_amount: grossAmount,
                    base_amount: baseAmount,
                    sportmaps_fee: sportmapsFee,
                    fee_pct: feePct,
                    status: 'pending',
                    expires_at: expiresAt.toISOString(),
                    failed_attempts: 0,
                    enrollment_id: enrollmentId || null,
                });

            if (linkErr) {
                req.log?.error({ err: linkErr }, 'Error inserting payment_link');
                return res.status(500).json({ error: 'Error al registrar el enlace de pago.' });
            }

            return res.status(201).json({
                reference,
                amountInCents: copToCents(grossAmount),
                grossAmount,
                baseAmount,
                sportmapsFee,
                feePct,
                token,
            });
        } catch (err: any) {
            req.log?.error({ err }, 'Error creating Wompi payment session');
            return res.status(500).json({
                error: err.message || 'Error interno al crear sesion de pago.',
            });
        }
    },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /link/:token — Info publica de un payment_link (sin auth)
// ─────────────────────────────────────────────────────────────────────────────
// Usado por la pagina de confirmacion despues de Wompi redirect.
router.get('/link/:token', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { token } = req.params;

        const { data: link, error } = await supabase
            .from('payment_links')
            .select(`
                id, payment_id, school_id, token,
                gross_amount, base_amount, sportmaps_fee, fee_pct,
                status, expires_at, paid_at, created_at, wompi_reference
            `)
            .eq('token', token)
            .single();

        if (error || !link) {
            return res.status(404).json({ error: 'Enlace de pago no encontrado.' });
        }

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

        return res.json({
            linkStatus: link.status,
            wompiReference: link.wompi_reference,
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
        return res.status(500).json({ error: 'Error al obtener informacion del pago.' });
    }
});

export default router;
