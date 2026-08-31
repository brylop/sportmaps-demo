// bff/src/routes/trial-classes.ts
//
// Agenda de Clases de Prueba (owner) — ver docs/specs/clases-de-prueba-agenda-owner.md
// y la Fase 1 en supabase/migrations/20260827184021_clases_de_prueba_agenda.sql
// (+ el fix de auth en 20260827191307_clases_de_prueba_fix_bff_auth.sql).
//
// Las 4 RPCs (trial_class_*) están restringidas a `service_role` — solo este
// BFF puede llamarlas. La autorización que antes vivía en la RPC (is_school_admin
// vía auth.uid()) ahora vive acá, porque el cliente de supabase de este archivo
// usa la service role key y no tiene sesión de usuario (auth.uid() = NULL).

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { BrandedEmailTemplates } from '../utils/emailTemplates';
import { emailClient } from '../utils/emailClient';

const router = Router();

/** Link de wa.me hacia el PROSPECTO (no confundir con el WhatsApp de ventas
 * de SportMaps — frontend/src/lib/salesContact.ts es otro número, otro caso
 * de uso). El owner lo abre y lo envía a mano (decisión de producto: v1 sin
 * integración Cloud API). */
function prospectWhatsappLink(prospectWhatsapp: string, message: string): string {
    const digits = prospectWhatsapp.replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// requireRole ya deja pasar automáticamente a owner/admin/super_admin
// (PRIVILEGED_ROLES en authMiddleware.ts) — 'school' y 'school_admin' son
// los nombres de rol adicionales que identifican al owner en school_members.
const requireOwnerOrAdmin = requireRole('school', 'school_admin');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveCallerCoachId(schoolId: string, authUserId: string): Promise<string | null> {
    const { data } = await supabase
        .from('school_staff')
        .select('id')
        .eq('school_id', schoolId)
        .eq('coach_auth_id', authUserId)
        .maybeSingle();
    return data?.id ?? null;
}

function isAdminRole(role: string): boolean {
    return ['owner', 'admin', 'super_admin', 'school', 'school_admin'].includes(role);
}

/**
 * Notifica al prospecto por correo (automático) y arma el mensaje de
 * WhatsApp (envío manual por el owner, mismo patrón que la confirmación de
 * creación) cuando una clase ya agendada se cancela o se reprograma. Se
 * llama DESPUÉS de que la RPC correspondiente ya aplicó el cambio, así que
 * la fila de trial_class_bookings refleja el estado/horario nuevo.
 */
async function notifyBookingChange(
    req: Request,
    bookingId: string,
    schoolId: string,
    kind: 'cancelled' | 'rescheduled',
    opts: { cancelReason?: string; whatsappMessage?: string } = {},
): Promise<{ email_sent: boolean; whatsapp_message: string; whatsapp_link: string }> {
    const { data: booking } = await supabase
        .from('trial_class_bookings')
        .select('prospect_name, prospect_email, prospect_whatsapp, scheduled_date, start_time, facility_id, coach_id, is_minor, child_name')
        .eq('id', bookingId)
        .eq('school_id', schoolId)
        .single();

    if (!booking) {
        return { email_sent: false, whatsapp_message: '', whatsapp_link: '' };
    }

    const dateLabel = new Date(`${booking.scheduled_date}T00:00:00`).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
    const timeLabel = booking.start_time?.slice(0, 5) ?? '';
    const childLine = booking.is_minor ? ` de ${booking.child_name}` : '';

    let whatsappMessage = opts.whatsappMessage ?? '';
    let emailSent = false;

    try {
        if (kind === 'cancelled') {
            if (!whatsappMessage) {
                const reasonLine = opts.cancelReason ? ` Motivo: ${opts.cancelReason}.` : '';
                whatsappMessage = `Hola ${booking.prospect_name}, te confirmamos que tu clase de prueba${childLine} del ${dateLabel} a las ${timeLabel} fue cancelada.${reasonLine} Si quieres reagendar, contáctanos cuando quieras.`;
            }
            const { subject, html } = await BrandedEmailTemplates.trialClassCancellation({
                prospectName: booking.prospect_name,
                childName: booking.is_minor ? booking.child_name : null,
                dateLabel,
                timeLabel,
                cancelReason: opts.cancelReason ?? null,
                schoolId,
            });
            const sendResult = await emailClient.send({ to: booking.prospect_email, subject, html });
            emailSent = !!sendResult.success;
        } else {
            const [{ data: facility }, { data: coach }] = await Promise.all([
                supabase.from('facilities').select('name').eq('id', booking.facility_id).single(),
                supabase.from('school_staff').select('full_name').eq('id', booking.coach_id).single(),
            ]);
            const { subject, html } = await BrandedEmailTemplates.trialClassRescheduled({
                prospectName: booking.prospect_name,
                childName: booking.is_minor ? booking.child_name : null,
                dateLabel,
                timeLabel,
                facilityName: facility?.name ?? '',
                coachName: coach?.full_name ?? '',
                schoolId,
            });
            const sendResult = await emailClient.send({ to: booking.prospect_email, subject, html });
            emailSent = !!sendResult.success;
        }
    } catch (err) {
        // El cambio (cancelación/reprogramación) ya quedó aplicado en la RPC —
        // un fallo de correo no debe tumbar la respuesta.
        req.log?.error({ err, bookingId, kind }, 'trial-classes: fallo enviando notificación de cambio');
    }

    return {
        email_sent: emailSent,
        whatsapp_message: whatsappMessage,
        whatsapp_link: prospectWhatsappLink(booking.prospect_whatsapp, whatsappMessage),
    };
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const SaveSettingsSchema = z.object({
    enabled:            z.boolean(),
    requires_approval:  z.boolean().optional().default(false),
});

const CreateBookingSchema = z.object({
    category_id:               z.string().uuid('category_id inválido'),
    facility_availability_id: z.string().uuid('facility_availability_id inválido'),
    coach_availability_id:    z.string().uuid('coach_availability_id inválido'),
    scheduled_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    start_time:                z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
    end_time:                  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
    prospect_name:              z.string().min(2, 'Nombre requerido'),
    prospect_email:              z.string().email('Email inválido'),
    prospect_whatsapp:            z.string().min(7, 'WhatsApp requerido'),
    is_minor:                    z.boolean().optional().default(false),
    child_name:                  z.string().min(2).optional(),
}).refine((data) => !data.is_minor || !!data.child_name, {
    message: 'El nombre del hijo/a es obligatorio cuando el prospecto es menor de edad',
    path: ['child_name'],
});

const UpdateStatusSchema = z.object({
    status:        z.enum(['realizada', 'no_show', 'cancelada', 'convertida']),
    cancel_reason: z.string().optional(),
});

const RescheduleSchema = z.object({
    facility_availability_id: z.string().uuid('facility_availability_id inválido'),
    coach_availability_id:    z.string().uuid('coach_availability_id inválido'),
    scheduled_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    start_time:                z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
    end_time:                  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
});

const CategoryUpsertSchema = z.object({
    name:        z.string().min(2, 'Nombre requerido'),
    description: z.string().optional(),
    price:       z.number().min(0, 'El precio no puede ser negativo'),
    is_active:   z.boolean().optional().default(true),
});

const RepeatPricingSchema = z.object({
    allow_repeat: z.boolean(),
    repeat_price: z.number().min(0, 'El precio no puede ser negativo').nullable().optional(),
}).refine((d) => !d.allow_repeat || d.repeat_price != null, {
    message: 'repeat_price es obligatorio cuando allow_repeat está activo',
    path: ['repeat_price'],
});

// ── Configuración ─────────────────────────────────────────────────────────────

// GET /api/v1/trial-classes/settings
router.get('/settings', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { data, error } = await supabase
            .from('school_trial_class_settings')
            .select('school_id, enabled, requires_approval')
            .eq('school_id', schoolId)
            .maybeSingle();

        if (error) throw error;

        // Sin fila todavía (lazy init pasa recién en el primer booking) → defaults.
        res.json(data ?? { school_id: schoolId, enabled: true, requires_approval: false });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes settings unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PUT /api/v1/trial-classes/settings
router.put('/settings', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const parsed = SaveSettingsSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { error } = await supabase.rpc('trial_class_save_settings', {
            p_school_id: schoolId,
            p_enabled: parsed.data.enabled,
            p_requires_approval: parsed.data.requires_approval,
        });

        if (error) throw error;
        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes save-settings unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── Categorías (nombre + descripción + precio propio) ────────────────────────

// GET /api/v1/trial-classes/categories?activeOnly=true
router.get('/categories', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { activeOnly } = req.query as Record<string, string | undefined>;

        let query = supabase
            .from('trial_class_categories')
            .select('id, name, description, price, is_active, allow_repeat, repeat_price')
            .eq('school_id', schoolId)
            .order('name', { ascending: true });

        if (activeOnly === 'true') query = query.eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes categories list unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// POST /api/v1/trial-classes/categories
router.post('/categories', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const parsed = CategoryUpsertSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const c = parsed.data;

        const { data, error } = await supabase.rpc('trial_class_category_upsert', {
            p_school_id: schoolId,
            p_name: c.name,
            p_price: c.price,
            p_description: c.description ?? null,
            p_is_active: c.is_active,
        });

        if (error) return res.status(409).json({ error: error.message });
        res.status(201).json({ id: data });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes categories create unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PUT /api/v1/trial-classes/categories/:id
router.put('/categories/:id', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = CategoryUpsertSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const c = parsed.data;

        const { data, error } = await supabase.rpc('trial_class_category_upsert', {
            p_school_id: schoolId,
            p_id: id,
            p_name: c.name,
            p_price: c.price,
            p_description: c.description ?? null,
            p_is_active: c.is_active,
        });

        if (error) return res.status(409).json({ error: error.message });
        res.json({ id: data });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes categories update unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/trial-classes/categories/:id/active
router.patch('/categories/:id/active', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const { is_active } = req.body as { is_active?: boolean };
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active es requerido y debe ser booleano.' });
        }

        const { error } = await supabase.rpc('trial_class_category_set_active', {
            p_school_id: schoolId,
            p_id: id,
            p_is_active: is_active,
        });

        if (error) return res.status(409).json({ error: error.message });
        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes categories set-active unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/trial-classes/categories/:id/repeat-pricing — ¿esta categoría
// deja agendar una prueba después de la primera, y a qué precio? Sin tope de
// veces (ver docs/specs/mis-inscripciones-agenda-clases-prueba.md §3/§7) —
// solo lo usa el self-service desde Mis Inscripciones (trial_class_self_create),
// el flujo del owner no tiene concepto de "repetir".
router.patch('/categories/:id/repeat-pricing', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = RepeatPricingSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const { allow_repeat, repeat_price } = parsed.data;

        const { error } = await supabase.rpc('trial_class_category_set_repeat_pricing', {
            p_school_id: schoolId,
            p_id: id,
            p_allow_repeat: allow_repeat,
            p_repeat_price: repeat_price ?? null,
        });

        if (error) return res.status(409).json({ error: error.message });
        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes categories repeat-pricing unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── Slots conjuntos (cancha + coach) ──────────────────────────────────────────

// GET /api/v1/trial-classes/slots?facilityId=&coachId=&from=&to=
router.get('/slots', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { facilityId, coachId, from, to } = req.query as Record<string, string>;

        if (!facilityId || !coachId || !from || !to) {
            return res.status(400).json({ error: 'facilityId, coachId, from y to son requeridos.' });
        }

        const { data, error } = await supabase.rpc('trial_class_get_joint_slots', {
            p_school_id: schoolId,
            p_facility_id: facilityId,
            p_coach_id: coachId,
            p_from_date: from,
            p_to_date: to,
        });

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes slots unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── Agenda ─────────────────────────────────────────────────────────────────────

// GET /api/v1/trial-classes?status=&from=&to=
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId, role, user } = req;
        const { status, from, to } = req.query as Record<string, string | undefined>;

        let query = supabase
            .from('trial_class_bookings')
            .select('*')
            .eq('school_id', schoolId)
            .order('scheduled_date', { ascending: true })
            .order('start_time', { ascending: true });

        if (status) query = query.eq('status', status);
        if (from) query = query.gte('scheduled_date', from);
        if (to) query = query.lte('scheduled_date', to);

        // El coach solo ve sus propias pruebas; el owner/admin ve todas.
        if (!isAdminRole(role)) {
            const coachId = await resolveCallerCoachId(schoolId, user.id);
            if (!coachId) return res.json([]);
            query = query.eq('coach_id', coachId);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes list unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// POST /api/v1/trial-classes — agenda una nueva clase de prueba
router.post('/', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId, user } = req;
        const parsed = CreateBookingSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const b = parsed.data;

        const { data: rpcData, error: rpcError } = await supabase.rpc('trial_class_create_booking', {
            p_school_id: schoolId,
            p_category_id: b.category_id,
            p_facility_availability_id: b.facility_availability_id,
            p_coach_availability_id: b.coach_availability_id,
            p_scheduled_date: b.scheduled_date,
            p_start_time: b.start_time,
            p_end_time: b.end_time,
            p_prospect_name: b.prospect_name,
            p_prospect_email: b.prospect_email,
            p_prospect_whatsapp: b.prospect_whatsapp,
            p_created_by: user.id,
            p_is_minor: b.is_minor,
            p_child_name: b.child_name ?? null,
        });

        if (rpcError) {
            // Errores de negocio de la RPC (slot ocupado, fuera de horario, etc.)
            // llegan como mensaje plano — se los pasamos tal cual al owner.
            return res.status(409).json({ error: rpcError.message });
        }

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const bookingId: string = row.booking_id;
        const whatsappMessage: string = row.whatsapp_message;

        // Trae los datos ya resueltos para el correo (evita otro round-trip
        // de armar el mismo texto en dos lugares distintos).
        const { data: booking } = await supabase
            .from('trial_class_bookings')
            .select('prospect_name, prospect_email, scheduled_date, start_time, price_charged, facility_id, coach_id, is_minor, child_name')
            .eq('id', bookingId)
            .single();

        let emailSent = false;
        if (booking) {
            const [{ data: facility }, { data: coach }] = await Promise.all([
                supabase.from('facilities').select('name').eq('id', booking.facility_id).single(),
                supabase.from('school_staff').select('full_name').eq('id', booking.coach_id).single(),
            ]);

            const dateLabel = new Date(`${booking.scheduled_date}T00:00:00`).toLocaleDateString('es-CO', {
                day: '2-digit', month: 'long', year: 'numeric',
            });
            const timeLabel = booking.start_time?.slice(0, 5) ?? '';

            try {
                const { subject, html } = await BrandedEmailTemplates.trialClassConfirmation({
                    prospectName: booking.prospect_name,
                    childName: booking.is_minor ? booking.child_name : null,
                    dateLabel,
                    timeLabel,
                    facilityName: facility?.name ?? '',
                    coachName: coach?.full_name ?? '',
                    priceLabel: booking.price_charged > 0 ? `$${booking.price_charged}` : null,
                    schoolId,
                });
                const sendResult = await emailClient.send({ to: booking.prospect_email, subject, html });
                emailSent = !!sendResult.success;

                if (emailSent) {
                    await supabase
                        .from('trial_class_bookings')
                        .update({ confirmation_email_sent_at: new Date().toISOString() })
                        .eq('id', bookingId);
                }
            } catch (emailErr) {
                // El booking ya quedó creado — un fallo de correo no debe
                // tumbar la respuesta, solo se reporta sin confirmación.
                req.log?.error({ err: emailErr, bookingId }, 'trial-classes: fallo enviando email de confirmación');
            }
        }

        res.status(201).json({
            id: bookingId,
            whatsapp_message: whatsappMessage,
            whatsapp_link: prospectWhatsappLink(b.prospect_whatsapp, whatsappMessage),
            email_sent: emailSent,
        });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes create unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/trial-classes/:id/status
router.patch('/:id/status', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId, role, user } = req;
        const { id } = req.params;
        const parsed = UpdateStatusSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const { status, cancel_reason } = parsed.data;

        const admin = isAdminRole(role);

        // cancelada/convertida son decisiones de negocio: solo owner/admin.
        if (!admin && (status === 'cancelada' || status === 'convertida')) {
            return res.status(403).json({ error: 'Solo un administrador puede realizar esta transición.' });
        }

        // El coach solo puede tocar sus propias pruebas (realizada/no_show).
        if (!admin) {
            const coachId = await resolveCallerCoachId(schoolId, user.id);
            const { data: booking } = await supabase
                .from('trial_class_bookings')
                .select('coach_id')
                .eq('id', id)
                .eq('school_id', schoolId)
                .maybeSingle();

            if (!booking || !coachId || booking.coach_id !== coachId) {
                return res.status(403).json({ error: 'No tienes permiso sobre esta clase de prueba.' });
            }
        }

        const { error } = await supabase.rpc('trial_class_update_status', {
            p_id: id,
            p_school_id: schoolId,
            p_new_status: status,
            p_cancel_reason: cancel_reason ?? null,
        });

        if (error) return res.status(409).json({ error: error.message });

        // La cancelación es la única transición que se notifica al prospecto
        // (realizada/no_show/convertida son internas, no le cambian nada a él).
        if (status === 'cancelada') {
            const notice = await notifyBookingChange(req, id as string, schoolId, 'cancelled', { cancelReason: cancel_reason });
            return res.json({ success: true, ...notice });
        }

        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes update-status unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/trial-classes/:id/reschedule — cambia fecha/hora (misma cancha
// y mismo entrenador; cambiarlos es "otra clase", no "editarla"). Solo admin.
router.patch('/:id/reschedule', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = RescheduleSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const r = parsed.data;

        const { data: rpcData, error: rpcError } = await supabase.rpc('trial_class_reschedule_booking', {
            p_id: id,
            p_school_id: schoolId,
            p_facility_availability_id: r.facility_availability_id,
            p_coach_availability_id: r.coach_availability_id,
            p_new_date: r.scheduled_date,
            p_new_start_time: r.start_time,
            p_new_end_time: r.end_time,
        });

        if (rpcError) return res.status(409).json({ error: rpcError.message });

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const notice = await notifyBookingChange(req, id as string, schoolId, 'rescheduled', { whatsappMessage: row?.whatsapp_message });
        res.json({ success: true, ...notice });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes reschedule unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// POST /api/v1/trial-classes/:id/resend-confirmation
router.post('/:id/resend-confirmation', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;

        const { data: booking, error } = await supabase
            .from('trial_class_bookings')
            .select('prospect_name, prospect_email, scheduled_date, start_time, price_charged, facility_id, coach_id, is_minor, child_name')
            .eq('id', id)
            .eq('school_id', schoolId)
            .maybeSingle();

        if (error) throw error;
        if (!booking) return res.status(404).json({ error: 'Clase de prueba no encontrada.' });

        const [{ data: facility }, { data: coach }] = await Promise.all([
            supabase.from('facilities').select('name').eq('id', booking.facility_id).single(),
            supabase.from('school_staff').select('full_name').eq('id', booking.coach_id).single(),
        ]);

        const dateLabel = new Date(`${booking.scheduled_date}T00:00:00`).toLocaleDateString('es-CO', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
        const timeLabel = booking.start_time?.slice(0, 5) ?? '';

        const { subject, html } = await BrandedEmailTemplates.trialClassConfirmation({
            prospectName: booking.prospect_name,
            childName: booking.is_minor ? booking.child_name : null,
            dateLabel,
            timeLabel,
            facilityName: facility?.name ?? '',
            coachName: coach?.full_name ?? '',
            priceLabel: booking.price_charged > 0 ? `$${booking.price_charged}` : null,
            schoolId,
        });
        const sendResult = await emailClient.send({ to: booking.prospect_email, subject, html });

        if (sendResult.success) {
            await supabase
                .from('trial_class_bookings')
                .update({ confirmation_email_sent_at: new Date().toISOString() })
                .eq('id', id);
        }

        res.json({ success: !!sendResult.success });
    } catch (err: any) {
        req.log?.error({ err }, 'trial-classes resend-confirmation unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
