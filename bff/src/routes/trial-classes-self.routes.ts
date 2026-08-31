// bff/src/routes/trial-classes-self.routes.ts
//
// Fase 2 (BFF) de "Agendamiento unificado desde Mis Inscripciones" — ver
// docs/specs/mis-inscripciones-agenda-clases-prueba.md. Hermano pero
// separado de bff/src/routes/trial-classes.ts (owner/admin) y de
// bff/src/routes/public-booking.routes.ts (prospecto anónimo, OTP): acá el
// caller ya tiene sesión (padre/atleta), así que no hay OTP ni
// is_school_admin — la autorización real vive en las RPCs
// trial_class_self_* (reciben p_created_by explícito porque corren con
// service_role, sin auth.uid()).
//
// Las 6 RPCs están restringidas a service_role (supabase/migrations/
// 20260829020235_trial_class_self_service_backend.sql), igual que el resto
// de la familia trial_class_*.

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { BrandedEmailTemplates } from '../utils/emailTemplates';
import { emailClient } from '../utils/emailClient';
import { todayInZone } from '../utils/businessDate';

const router = Router();

// requireRole ya deja pasar automáticamente a owner/admin/super_admin
// (PRIVILEGED_ROLES en authMiddleware.ts) — 'school'/'school_admin' son los
// nombres adicionales que identifican al owner en school_members. Mismo
// helper que usa trial-classes.ts, para que Ajustes viva bajo la misma regla.
const requireOwnerOrAdmin = requireRole('school', 'school_admin');

// ── Notificación al confirmar/reprogramar/cancelar ──────────────────────────
// Mismo patrón que trial-classes.ts (notifyBookingChange): un fallo de correo
// no debe tumbar la respuesta, la reserva ya quedó aplicada por la RPC.

async function sendBookingEmail(
  req: Request,
  bookingId: string,
  schoolId: string,
  kind: 'confirmed' | 'cancelled' | 'rescheduled',
  opts: { cancelReason?: string } = {},
): Promise<boolean> {
  try {
    const { data: booking } = await supabase
      .from('trial_class_bookings')
      .select('prospect_name, prospect_email, scheduled_date, start_time, price_charged, facility_id, coach_id, is_minor, child_name')
      .eq('id', bookingId)
      .eq('school_id', schoolId)
      .single();

    if (!booking) return false;

    const [{ data: facility }, { data: coach }] = await Promise.all([
      supabase.from('facilities').select('name').eq('id', booking.facility_id).single(),
      supabase.from('school_staff').select('full_name').eq('id', booking.coach_id).single(),
    ]);

    const dateLabel = new Date(`${booking.scheduled_date}T00:00:00`).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    const timeLabel = booking.start_time?.slice(0, 5) ?? '';
    const childName = booking.is_minor ? booking.child_name : null;

    let subject: string, html: string;
    if (kind === 'cancelled') {
      ({ subject, html } = await BrandedEmailTemplates.trialClassCancellation({
        prospectName: booking.prospect_name,
        childName,
        dateLabel,
        timeLabel,
        cancelReason: opts.cancelReason ?? null,
        schoolId,
      }));
    } else if (kind === 'rescheduled') {
      ({ subject, html } = await BrandedEmailTemplates.trialClassRescheduled({
        prospectName: booking.prospect_name,
        childName,
        dateLabel,
        timeLabel,
        facilityName: facility?.name ?? '',
        coachName: coach?.full_name ?? '',
        schoolId,
      }));
    } else {
      ({ subject, html } = await BrandedEmailTemplates.trialClassConfirmation({
        prospectName: booking.prospect_name,
        childName,
        dateLabel,
        timeLabel,
        facilityName: facility?.name ?? '',
        coachName: coach?.full_name ?? '',
        priceLabel: booking.price_charged > 0 ? `$${booking.price_charged}` : null,
        schoolId,
      }));
    }

    const sendResult = await emailClient.send({ to: booking.prospect_email, subject, html });
    return !!sendResult.success;
  } catch (err) {
    req.log?.error({ err, bookingId, kind }, 'trial-classes-self: fallo enviando notificación');
    return false;
  }
}

// ── Schemas Zod ───────────────────────────────────────────────────────────────

const SelfServiceSettingsSchema = z.object({
  self_service_enabled: z.boolean(),
  reschedule_cutoff_hours: z.number().int().min(0).max(240).optional().default(12),
  payment_mode: z.enum(['gateway', 'manual', 'en_sede']).optional().default('en_sede'),
});

const CreateSelfBookingSchema = z.object({
  category_id: z.string().uuid('category_id inválido'),
  facility_availability_id: z.string().uuid('facility_availability_id inválido'),
  coach_availability_id: z.string().uuid('coach_availability_id inválido'),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
  // Sujeto: exactamente uno de los tres — la RPC vuelve a validarlo, esto es
  // solo para devolver un 400 legible en vez de que el error salga de la RPC.
  child_id: z.string().uuid().optional(),
  self: z.boolean().optional().default(false),
  prospect_name: z.string().min(2).optional(),
  prospect_email: z.string().email().optional(),
  prospect_whatsapp: z.string().min(7).optional(),
  prospect_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((d) => {
  const count = [!!d.child_id, d.self === true, !!d.prospect_name].filter(Boolean).length;
  return count === 1;
}, { message: 'Elegí exactamente un sujeto: child_id, self=true, o los datos de un hermano/a nuevo' })
  .refine((d) => !d.prospect_name || (d.prospect_email && d.prospect_whatsapp), {
    message: 'prospect_email y prospect_whatsapp son obligatorios para un hermano/a nuevo',
  })
  .refine((d) => d.scheduled_date >= todayInZone(), {
    message: 'La fecha no puede ser anterior a hoy',
    path: ['scheduled_date'],
  });

const RescheduleSelfSchema = z.object({
  facility_availability_id: z.string().uuid('facility_availability_id inválido'),
  coach_availability_id: z.string().uuid('coach_availability_id inválido'),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
});

const CancelSelfSchema = z.object({
  reason: z.string().optional(),
});

// ── Configuración (owner/admin) ──────────────────────────────────────────────

// GET /api/v1/trial-classes-self/settings
router.get('/settings', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('school_trial_class_settings')
      .select('school_id, enabled, self_service_enabled, reschedule_cutoff_hours, payment_mode')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) throw error;

    // Sin fila todavía (lazy init pasa recién en el primer booking del owner)
    // → defaults, mismos que la migración.
    res.json(data ?? {
      school_id: schoolId, enabled: true, self_service_enabled: false,
      reschedule_cutoff_hours: 12, payment_mode: 'en_sede',
    });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self settings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/v1/trial-classes-self/settings
router.put('/settings', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const parsed = SelfServiceSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }
    const s = parsed.data;

    const { error } = await supabase.rpc('trial_class_self_service_save_settings', {
      p_school_id: schoolId,
      p_self_service_enabled: s.self_service_enabled,
      p_reschedule_cutoff_hours: s.reschedule_cutoff_hours,
      p_payment_mode: s.payment_mode,
    });

    if (error) return res.status(409).json({ error: error.message });
    res.json({ success: true });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self save-settings unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── Lectura para el padre/atleta ─────────────────────────────────────────────

// GET /api/v1/trial-classes-self/categories — solo si el self-service está
// prendido; si no, [] (la pantalla no debe ni mostrar la opción).
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { data: settings } = await supabase
      .from('school_trial_class_settings')
      .select('enabled, self_service_enabled')
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!settings?.enabled || !settings?.self_service_enabled) {
      return res.json([]);
    }

    const { data, error } = await supabase
      .from('trial_class_categories')
      .select('id, name, description, price, allow_repeat, repeat_price')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self categories unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/trial-classes-self/slots?facilityId=&coachId=&from=&to=
router.get('/slots', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId } = req;
    const { facilityId, coachId, from, to } = req.query as Record<string, string>;

    if (!facilityId || !coachId || !from || !to) {
      return res.status(400).json({ error: 'facilityId, coachId, from y to son requeridos.' });
    }

    const { data, error } = await supabase.rpc('trial_class_self_get_joint_slots', {
      p_school_id: schoolId,
      p_facility_id: facilityId,
      p_coach_id: coachId,
      p_from_date: from,
      p_to_date: to,
    });

    if (error) return res.status(409).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self slots unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/trial-classes-self/is-first?child_id=  (o ?self=true)
// Preview ANTES de confirmar — un hermano/a nuevo siempre es is_first=true
// y has_active_plan=false (todavía no existe como unregistered_athlete, no
// puede tener un plan). Para hijo/self, también dice si YA tiene un plan
// real en la escuela — si lo tiene, el frontend bloquea la prueba y manda
// a agendar desde el plan en vez de ofrecerla (decisión de producto,
// 20260829102825).
router.get('/is-first', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;
    const { child_id, self: selfParam } = req.query as Record<string, string | undefined>;

    if (child_id) {
      const owns = await supabase.from('children').select('id')
        .eq('id', child_id).eq('parent_id', user.id).eq('school_id', schoolId).maybeSingle();
      if (!owns.data) return res.status(403).json({ error: 'No autorizado sobre este hijo/a.' });
    }

    const p_child_id = child_id ?? null;
    const p_user_id = selfParam === 'true' ? user.id : null;

    const [isFirstResult, hasActivePlanResult] = await Promise.all([
      supabase.rpc('trial_class_self_is_first', {
        p_school_id: schoolId, p_child_id, p_user_id, p_unregistered_athlete_id: null,
      }),
      supabase.rpc('trial_class_self_has_active_plan', {
        p_school_id: schoolId, p_child_id, p_user_id,
      }),
    ]);

    if (isFirstResult.error) throw isFirstResult.error;
    if (hasActivePlanResult.error) throw hasActivePlanResult.error;

    res.json({ is_first: isFirstResult.data, has_active_plan: hasActivePlanResult.data });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self is-first unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/v1/trial-classes-self — mis propias clases de prueba agendadas
// (padre/atleta, no las de toda la escuela como ve el owner).
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;
    const { data, error } = await supabase
      .from('trial_class_bookings')
      .select('id, category_id, facility_id, coach_id, scheduled_date, start_time, end_time, price_charged, status, child_id, user_id, unregistered_athlete_id, prospect_name, is_minor, child_name')
      .eq('school_id', schoolId)
      .eq('created_by', user.id)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self list unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── Escritura para el padre/atleta ───────────────────────────────────────────

// POST /api/v1/trial-classes-self — agenda una clase de prueba
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;
    const parsed = CreateSelfBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }
    const b = parsed.data;

    const { data: rpcData, error: rpcError } = await supabase.rpc('trial_class_self_create', {
      p_school_id: schoolId,
      p_created_by: user.id,
      p_category_id: b.category_id,
      p_facility_availability_id: b.facility_availability_id,
      p_coach_availability_id: b.coach_availability_id,
      p_scheduled_date: b.scheduled_date,
      p_start_time: b.start_time,
      p_end_time: b.end_time,
      p_child_id: b.child_id ?? null,
      p_self: b.self ?? false,
      p_prospect_name: b.prospect_name ?? null,
      p_prospect_email: b.prospect_email ?? null,
      p_prospect_whatsapp: b.prospect_whatsapp ?? null,
      p_prospect_dob: b.prospect_dob ?? null,
    });

    if (rpcError) {
      // too_late_to_reschedule / payment_period_conflict / negocio genérico:
      // el mensaje de la RPC ya es legible, se pasa tal cual.
      return res.status(409).json({ error: rpcError.message });
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const emailSent = await sendBookingEmail(req, row.booking_id, schoolId, 'confirmed');

    res.status(201).json({
      id: row.booking_id,
      price: row.price,
      is_first: row.is_first,
      payment_mode: row.payment_mode,
      email_sent: emailSent,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self create unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/v1/trial-classes-self/:id/reschedule
router.patch('/:id/reschedule', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;
    const { id } = req.params;
    const parsed = RescheduleSelfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }
    const r = parsed.data;

    const { error: rpcError } = await supabase.rpc('trial_class_self_reschedule', {
      p_id: id,
      p_school_id: schoolId,
      p_created_by: user.id,
      p_facility_availability_id: r.facility_availability_id,
      p_coach_availability_id: r.coach_availability_id,
      p_new_date: r.scheduled_date,
      p_new_start_time: r.start_time,
      p_new_end_time: r.end_time,
    });

    if (rpcError) {
      // 'too_late_to_reschedule: ...' llega acá — el frontend lo detecta por
      // el prefijo y muestra "contactá a la escuela" en vez de un genérico.
      return res.status(409).json({ error: rpcError.message });
    }

    const emailSent = await sendBookingEmail(req, id as string, schoolId, 'rescheduled');
    res.json({ success: true, email_sent: emailSent });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self reschedule unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /api/v1/trial-classes-self/:id/cancel
router.patch('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { schoolId, user } = req;
    const { id } = req.params;
    const parsed = CancelSelfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
    }

    // El correo de cancelación necesita leer la fila ANTES de que la RPC le
    // cambie el status — mismo motivo que reservations-admin.routes.ts.
    const emailSentPromise = sendBookingEmail(req, id as string, schoolId, 'cancelled', { cancelReason: parsed.data.reason });

    const { error: rpcError } = await supabase.rpc('trial_class_self_cancel', {
      p_id: id,
      p_school_id: schoolId,
      p_created_by: user.id,
      p_reason: parsed.data.reason ?? null,
    });

    if (rpcError) return res.status(409).json({ error: rpcError.message });

    const emailSent = await emailSentPromise;
    res.json({ success: true, email_sent: emailSent });
  } catch (err: any) {
    req.log?.error({ err }, 'trial-classes-self cancel unhandled error');
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export default router;
