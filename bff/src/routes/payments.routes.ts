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
import { generateMpReference } from '../services/mercadopago.service';
import { resolveProvider, type PaymentProvider } from '../services/payment-provider.resolver';
import { extractReceipt } from '../services/ocr.service';

const router = Router();

const CreateSessionSchema = z.object({
    paymentId: z.string().uuid(),
    enrollmentId: z.string().uuid().optional(),
    preferredProvider: z.enum(['wompi', 'mercadopago']).optional(),
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

            const { paymentId, enrollmentId, preferredProvider } = parsed.data;
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

            // 3. Resolver provider de pago para esta escuela.
            //    Estrategia:
            //     a) school_payment_providers tiene config explicita → usa esa.
            //     b) Sino, fallback legacy: school_settings.wompi_enabled.
            const resolved = await resolveProvider({ schoolId, preferredProvider });

            const { data: settings } = await supabase
                .from('school_settings')
                .select('wompi_enabled, online_fee_pct, fee_payer')
                .eq('school_id', schoolId)
                .single();

            const provider: PaymentProvider = resolved?.provider
                ?? (settings?.wompi_enabled ? 'wompi' : (null as any));

            if (!provider) {
                return res.status(400).json({
                    error: 'Los pagos online no estan habilitados para esta escuela.',
                });
            }

            const feePct = Number(settings?.online_fee_pct ?? 3);

            // 4. No reutilizar links activos (idempotencia debil — evita doble cobro accidental)
            const { data: existingLink } = await supabase
                .from('payment_links')
                .select('id, status, expires_at, payment_provider, provider_reference, wompi_reference, gross_amount, base_amount, sportmaps_fee, fee_pct')
                .eq('payment_id', paymentId)
                .eq('status', 'pending')
                .gte('expires_at', new Date().toISOString())
                .maybeSingle();

            if (existingLink && (existingLink.provider_reference || existingLink.wompi_reference)) {
                const linkProvider = (existingLink.payment_provider as PaymentProvider) ?? 'wompi';
                const linkRef = existingLink.provider_reference || existingLink.wompi_reference;
                return res.status(200).json({
                    provider: linkProvider,
                    publicKey: resolved?.publicKey ?? null,
                    sandbox: resolved?.sandbox ?? true,
                    reference: linkRef,
                    amountInCents: copToCents(Number(existingLink.gross_amount)),
                    transactionAmount: Number(existingLink.gross_amount),
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

            // 6. Generar referencia segun provider
            const reference = provider === 'mercadopago'
                ? generateMpReference('school_payment')
                : generateReference('school_payment');

            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

            // 7. Persistir payment_link con columnas genericas + legacy mirror
            const { error: linkErr } = await supabase
                .from('payment_links')
                .insert({
                    payment_id: paymentId,
                    school_id: schoolId,
                    token,
                    payment_provider: provider,
                    provider_reference: reference,
                    wompi_reference: provider === 'wompi' ? reference : null,
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
                provider,
                publicKey: resolved?.publicKey ?? null,
                sandbox: resolved?.sandbox ?? true,
                reference,
                amountInCents: copToCents(grossAmount),
                transactionAmount: grossAmount,
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /extract-receipt — Extrae monto/fecha/banco de un comprobante via LLM Vision
// ─────────────────────────────────────────────────────────────────────────────
// Usado por el frontend al subir un comprobante manual. El cliente envia la
// imagen en base64 y recibe JSON estructurado que se persiste en payments.ocr_*.
const ExtractSchema = z.object({
    imageBase64: z.string().min(100, 'Imagen demasiado pequena'),
    mimeType: z.string().optional(),
});

// Cliente liviano con ANON key, solo para validar JWTs en endpoints userspace
// (evita depender del SUPABASE_SERVICE_ROLE_KEY que puede estar como placeholder
// en local). El SERVICE_ROLE_KEY es necesario para acceder a tablas con RLS,
// pero no para hacer auth.getUser() que solo decodea el JWT contra /auth/v1/user.
import { createClient } from '@supabase/supabase-js';
const supabaseAnonClient = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } },
);

router.post(
    '/extract-receipt',
    // Auth ligera: solo valida el JWT (no consulta school_members). Es suficiente
    // porque este endpoint solo procesa una imagen — no toca data de la escuela.
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Token de autorizacion requerido.' });
            }
            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabaseAnonClient.auth.getUser(token);
            if (authError || !user) {
                req.log?.warn({ err: authError }, '[OCR] JWT validation failed');
                return res.status(401).json({ error: 'Token invalido o expirado.' });
            }

            const parsed = ExtractSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Datos invalidos',
                    details: parsed.error.issues,
                });
            }
            const { imageBase64, mimeType } = parsed.data;

            const result = await extractReceipt(imageBase64, mimeType || 'image/png');
            return res.json(result);
        } catch (err: any) {
            req.log?.error({ err }, 'Error extracting receipt with LLM Vision');
            return res.status(502).json({
                error: 'No se pudo procesar el comprobante con OCR.',
                detail: err.message,
            });
        }
    },
);

export default router;
