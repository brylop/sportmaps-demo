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
import rateLimit from 'express-rate-limit';
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
                .select('id, amount, status, concept, child_id, user_id, parent_id, school_id, requires_review')
                .eq('id', paymentId)
                .eq('school_id', schoolId)
                .single();

            if (paymentErr || !payment) {
                return res.status(404).json({ error: 'Pago no encontrado.' });
            }

            // 1.a IDOR check: usuarios no-staff (parent/athlete) solo pueden
            // pagar pagos donde figuran como parent_id o user_id. Sin esto,
            // un padre podia pagar la deuda de otro padre en la misma escuela
            // si conocia el paymentId.
            const STAFF_ROLES = new Set(['owner', 'admin', 'super_admin', 'school_admin']);
            const isStaff = STAFF_ROLES.has(req.role);
            if (!isStaff) {
                const callerId = req.user.id;
                const payerIds = [(payment as any).parent_id, (payment as any).user_id].filter(Boolean);
                if (!payerIds.includes(callerId)) {
                    req.log?.warn(
                        { paymentId, callerId, payerIds },
                        'create-session: caller no es payer del pago',
                    );
                    return res.status(403).json({
                        error: 'No tienes permiso para pagar este registro.',
                    });
                }
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

            // 4. Reutilizar link activo (idempotencia — evita doble cobro accidental).
            //    Consulta y respuesta factorizadas para reusar tambien en el 23505.
            const fetchActiveLink = () => supabase
                .from('payment_links')
                .select('id, status, expires_at, payment_provider, provider_reference, wompi_reference, gross_amount, base_amount, sportmaps_fee, fee_pct')
                .eq('payment_id', paymentId)
                .eq('status', 'pending')
                .gte('expires_at', new Date().toISOString())
                .maybeSingle();

            const reuseResponse = (link: any) => res.status(200).json({
                provider: (link.payment_provider as PaymentProvider) ?? 'wompi',
                publicKey: resolved?.publicKey ?? null,
                sandbox: resolved?.sandbox ?? true,
                reference: link.provider_reference || link.wompi_reference,
                amountInCents: copToCents(Number(link.gross_amount)),
                transactionAmount: Number(link.gross_amount),
                grossAmount: Number(link.gross_amount),
                baseAmount: Number(link.base_amount),
                sportmapsFee: Number(link.sportmaps_fee),
                feePct: Number(link.fee_pct),
                reused: true,
            });

            const { data: existingLink } = await fetchActiveLink();
            if (existingLink && (existingLink.provider_reference || existingLink.wompi_reference)) {
                return reuseResponse(existingLink);
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

            // 6.b Expirar links 'pending' vencidos por tiempo: no son un checkout
            //     activo y chocarian con el unico parcial (H-05). Solo toca los ya
            //     vencidos, nunca uno vigente creado por otra request.
            await supabase
                .from('payment_links')
                .update({ status: 'expired', updated_at: new Date().toISOString() })
                .eq('payment_id', paymentId)
                .eq('status', 'pending')
                .lt('expires_at', new Date().toISOString());

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
                // 23505: otra request concurrente ya creo la link 'pending' para esta
                // deuda (carrera H-05, bloqueada por uq_payment_links_one_pending_per_payment).
                // Reusar la existente en vez de crear una segunda referencia pagable.
                if ((linkErr as any).code === '23505') {
                    const { data: raced } = await fetchActiveLink();
                    if (raced && (raced.provider_reference || raced.wompi_reference)) {
                        req.log?.info({ paymentId }, 'create-session: carrera resuelta, reusando link existente');
                        return reuseResponse(raced);
                    }
                }
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
//
// Seguridad:
//  - rate-limit dedicado: 10/min por IP (encima del paymentLimiter del router).
//  - imageBase64 acotado a ~6 MB binario para evitar memory exhaustion / abuso
//    del free tier de Groq.
//  - mimeType validado contra whitelist (imagenes y PDF).

// ~8 MB de base64 == ~6 MB de imagen binaria. Suficiente para PNG/JPG de un
// comprobante movil; bloquea uploads disenados para reventar memoria.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'] as const;

const ExtractSchema = z.object({
    imageBase64: z.string()
        .min(100, 'Imagen demasiado pequena')
        .max(MAX_BASE64_LENGTH, 'Imagen demasiado grande (max ~6 MB).'),
    mimeType: z.enum(ALLOWED_MIME_TYPES).optional(),
});

const ocrLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones de OCR. Intenta en 1 minuto.' },
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
    ocrLimiter,
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
