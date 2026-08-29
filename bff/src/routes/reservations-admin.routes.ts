// bff/src/routes/reservations-admin.routes.ts
//
// Cancelar / reprogramar reservas desde la pestaña "Reservas" del owner
// (SchoolFacilitiesPage.tsx), con correo de confirmación al prospecto/socio.
// Cubre los dos tipos que esa pestaña mezcla en una sola tabla:
//   · facility_reservations — alquiler manual del owner (OwnerReservationModal).
//     Cancelar/reprogramar ya existía escribiendo Supabase DIRECTO desde el
//     navegador (sin BFF, sin correo). Se mueve acá solo para poder mandar
//     el correo del lado del servidor — el trigger de choque de horario
//     (trg_check_facility_overlap) ya protegía esto, no hizo falta RPC nueva.
//   · session_bookings de clases de cortesía (creadas en /agendar/:slug) —
//     cancelar solo cambiaba el status; reprogramar fecha/hora NO existía.
//     Ver migración 20260828232516_session_booking_reschedule_y_notificaciones.sql.
//
// "Eliminar" (borrado físico) también vive acá, no en el navegador: RLS
// bloquea a propósito el DELETE directo —
// session_bookings_delete_none (USING false) para cualquier authenticated, y
// facility_reservations solo deja borrar al propio autor con status='pending'.
// El botón "Eliminar" del frontend llamaba Supabase directo, la policy
// negaba la fila silenciosamente (DELETE sobre 0 filas no es un error) y el
// toast decía "eliminado" sin haber borrado nada. Acá sí se puede, con
// service_role, solo para owner/admin.



import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { BrandedEmailTemplates } from '../utils/emailTemplates';
import { emailClient } from '../utils/emailClient';

const router = Router();

const requireOwnerOrAdmin = requireRole('school', 'school_admin');

const CancelSchema = z.object({
    reason: z.string().optional(),
});

const RescheduleFacilitySchema = z.object({
    reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
});

const RescheduleCourtesySchema = z.object({
    facility_availability_id: z.string().uuid('facility_availability_id inválido'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida (HH:MM)'),
});

function dateLabel(d: string): string {
    return new Date(`${d}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

function timeLabel(t: string): string {
    return t?.slice(0, 5) ?? '';
}

// ── facility_reservations (alquiler manual del owner) ──────────────────────

// PATCH /api/v1/reservations-admin/facility/:id/cancel
router.patch('/facility/:id/cancel', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = CancelSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

        const { data: resv, error: fetchErr } = await supabase
            .from('facility_reservations')
            .select('id, reservation_date, start_time, facility:facilities(id, name, school_id), requester:profiles!facility_reservations_user_id_fkey(full_name, email)')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!resv || (resv.facility as any)?.school_id !== schoolId) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        const { error: updErr } = await supabase
            .from('facility_reservations')
            .update({ status: 'cancelled', cancellation_reason: parsed.data.reason ?? null, cancelled_at: new Date().toISOString() })
            .eq('id', id);
        if (updErr) throw updErr;

        let emailSent = false;
        const requesterEmail = (resv.requester as any)?.email;
        if (requesterEmail) {
            try {
                const { subject, html } = await BrandedEmailTemplates.reservationCancelled({
                    recipientName: (resv.requester as any)?.full_name || 'cliente',
                    facilityName: (resv.facility as any)?.name ?? '',
                    dateLabel: dateLabel(resv.reservation_date),
                    timeLabel: timeLabel(resv.start_time),
                    cancelReason: parsed.data.reason ?? null,
                    schoolId,
                });
                const sendResult = await emailClient.send({ to: requesterEmail, subject, html });
                emailSent = !!sendResult.success;
            } catch (emailErr) {
                req.log?.error({ err: emailErr, id }, 'reservations-admin: fallo enviando correo de cancelación');
            }
        }

        res.json({ success: true, email_sent: emailSent });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin facility cancel unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/reservations-admin/facility/:id/reschedule
router.patch('/facility/:id/reschedule', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = RescheduleFacilitySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const r = parsed.data;

        const { data: resv, error: fetchErr } = await supabase
            .from('facility_reservations')
            .select('id, facility:facilities(id, name, school_id), requester:profiles!facility_reservations_user_id_fkey(full_name, email)')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!resv || (resv.facility as any)?.school_id !== schoolId) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        const { error: updErr } = await supabase
            .from('facility_reservations')
            .update({
                reservation_date: r.reservation_date,
                start_time: r.start_time,
                end_time: r.end_time,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        if (updErr) {
            if (updErr.message?.includes('facility_slot_conflict')) {
                return res.status(409).json({ error: 'Ese horario ya está ocupado por otra reserva.', reason: 'capacity_full' });
            }
            throw updErr;
        }

        let emailSent = false;
        const requesterEmail = (resv.requester as any)?.email;
        if (requesterEmail) {
            try {
                const { subject, html } = await BrandedEmailTemplates.reservationRescheduled({
                    recipientName: (resv.requester as any)?.full_name || 'cliente',
                    facilityName: (resv.facility as any)?.name ?? '',
                    dateLabel: dateLabel(r.reservation_date),
                    timeLabel: timeLabel(r.start_time),
                    schoolId,
                });
                const sendResult = await emailClient.send({ to: requesterEmail, subject, html });
                emailSent = !!sendResult.success;
            } catch (emailErr) {
                req.log?.error({ err: emailErr, id }, 'reservations-admin: fallo enviando correo de reprogramación');
            }
        }

        res.json({ success: true, email_sent: emailSent });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin facility reschedule unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── session_bookings de clases de cortesía (/agendar/:slug) ────────────────

async function resolveCourtesyRequester(bookingRow: any): Promise<{ name: string; email: string | null }> {
    if (bookingRow.unregistered_athlete_id) {
        const { data } = await supabase.from('unregistered_athletes').select('full_name, email').eq('id', bookingRow.unregistered_athlete_id).maybeSingle();
        return { name: data?.full_name || 'Invitado', email: data?.email ?? null };
    }
    if (bookingRow.child_id) {
        const { data: child } = await supabase.from('children').select('full_name, parent_id').eq('id', bookingRow.child_id).maybeSingle();
        const { data: parent } = child?.parent_id
            ? await supabase.from('profiles').select('email').eq('id', child.parent_id).maybeSingle()
            : { data: null as any };
        return { name: child?.full_name || 'Estudiante', email: parent?.email ?? null };
    }
    if (bookingRow.user_id) {
        const { data } = await supabase.from('profiles').select('full_name, email').eq('id', bookingRow.user_id).maybeSingle();
        return { name: data?.full_name || 'Usuario', email: data?.email ?? null };
    }
    return { name: 'Usuario', email: null };
}

// GET /api/v1/reservations-admin/courtesy/slots?facility_id=&from=&to=
// Slots libres SOLO por cancha (sin coach) — para el picker de reprogramar.
router.get('/courtesy/slots', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { facility_id, from, to } = req.query as Record<string, string | undefined>;
        if (!facility_id || !from || !to) {
            return res.status(400).json({ error: 'facility_id, from y to son requeridos.' });
        }

        const { data: facility } = await supabase
            .from('facilities')
            .select('id')
            .eq('id', facility_id)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!facility) return res.status(404).json({ error: 'Instalación no encontrada.' });

        const { data: availData } = await supabase
            .from('facility_availability')
            .select('id, day_of_week, start_time, end_time, max_group_capacity')
            .eq('facility_id', facility_id);

        const { data: existingSessions } = await supabase
            .from('attendance_sessions')
            .select('facility_availability_id, session_date, id')
            .eq('facility_id', facility_id)
            .gte('session_date', from)
            .lte('session_date', to);

        const bookedSessionIds = (existingSessions || []).map((s: any) => s.id);
        const { data: activeCounts } = bookedSessionIds.length
            ? await supabase.from('session_bookings').select('session_id').in('session_id', bookedSessionIds).neq('status', 'cancelled')
            : { data: [] as any[] };

        const countBySession: Record<string, number> = {};
        (activeCounts || []).forEach((b: any) => { countBySession[b.session_id] = (countBySession[b.session_id] ?? 0) + 1; });

        const sessionByAvailDate: Record<string, { id: string; count: number }> = {};
        (existingSessions || []).forEach((s: any) => {
            sessionByAvailDate[`${s.facility_availability_id}_${s.session_date}`] = { id: s.id, count: countBySession[s.id] ?? 0 };
        });

        const fromDate = new Date(`${from}T00:00:00Z`);
        const toDate = new Date(`${to}T00:00:00Z`);
        const slots: any[] = [];
        for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dbDay = d.getUTCDay();
            for (const avail of (availData || []).filter((a: any) => a.day_of_week === dbDay)) {
                const existing = sessionByAvailDate[`${avail.id}_${dateStr}`];
                const max = avail.max_group_capacity ?? 10;
                const current = existing?.count ?? 0;
                if (current >= max) continue;
                slots.push({
                    facility_availability_id: avail.id,
                    slot_date: dateStr,
                    slot_start_time: avail.start_time,
                    slot_end_time: avail.end_time,
                    available_spots: max - current,
                });
            }
        }

        res.json(slots);
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin courtesy slots unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/reservations-admin/courtesy/:id/cancel
router.patch('/courtesy/:id/cancel', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = CancelSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

        const { data: booking, error: fetchErr } = await supabase
            .from('session_bookings')
            .select('id, user_id, child_id, unregistered_athlete_id, session:attendance_sessions(session_date, start_time, facility:facilities(name))')
            .eq('id', id)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

        const { error: updErr } = await supabase
            .from('session_bookings')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);
        if (updErr) throw updErr;

        const requester = await resolveCourtesyRequester(booking);
        let emailSent = false;
        if (requester.email) {
            try {
                const session = booking.session as any;
                const { subject, html } = await BrandedEmailTemplates.reservationCancelled({
                    recipientName: requester.name,
                    facilityName: session?.facility?.name ?? '',
                    dateLabel: dateLabel(session?.session_date ?? ''),
                    timeLabel: timeLabel(session?.start_time ?? ''),
                    cancelReason: parsed.data.reason ?? null,
                    schoolId,
                });
                const sendResult = await emailClient.send({ to: requester.email, subject, html });
                emailSent = !!sendResult.success;
            } catch (emailErr) {
                req.log?.error({ err: emailErr, id }, 'reservations-admin: fallo enviando correo de cancelación (cortesía)');
            }
        }

        res.json({ success: true, email_sent: emailSent });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin courtesy cancel unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// PATCH /api/v1/reservations-admin/courtesy/:id/reschedule
router.patch('/courtesy/:id/reschedule', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;
        const parsed = RescheduleCourtesySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const r = parsed.data;

        const { data: booking, error: fetchErr } = await supabase
            .from('session_bookings')
            .select('id, user_id, child_id, unregistered_athlete_id')
            .eq('id', id)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

        const { data: rpcData, error: rpcErr } = await supabase.rpc('session_booking_reschedule', {
            p_id: id,
            p_school_id: schoolId,
            p_facility_availability_id: r.facility_availability_id,
            p_new_date: r.date,
            p_new_start_time: r.start_time,
            p_new_end_time: r.end_time,
        });

        if (rpcErr) {
            if (rpcErr.message?.includes('CAPACITY_FULL')) {
                return res.status(409).json({ error: 'Este horario ya alcanzó su cupo máximo.', reason: 'capacity_full' });
            }
            return res.status(409).json({ error: rpcErr.message });
        }

        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        const { data: facility } = row?.facility_id
            ? await supabase.from('facilities').select('name').eq('id', row.facility_id).maybeSingle()
            : { data: null as any };

        const requester = await resolveCourtesyRequester(booking);
        let emailSent = false;
        if (requester.email) {
            try {
                const { subject, html } = await BrandedEmailTemplates.reservationRescheduled({
                    recipientName: requester.name,
                    facilityName: facility?.name ?? '',
                    dateLabel: dateLabel(r.date),
                    timeLabel: timeLabel(r.start_time),
                    schoolId,
                });
                const sendResult = await emailClient.send({ to: requester.email, subject, html });
                emailSent = !!sendResult.success;
            } catch (emailErr) {
                req.log?.error({ err: emailErr, id }, 'reservations-admin: fallo enviando correo de reprogramación (cortesía)');
            }
        }

        res.json({ success: true, email_sent: emailSent });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin courtesy reschedule unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── Eliminar (borrado físico) — ver nota arriba: RLS lo bloquea a propósito
// para authenticated, así que solo funciona desde acá (service_role) ────────

// DELETE /api/v1/reservations-admin/facility/:id
router.delete('/facility/:id', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;

        const { data: resv, error: fetchErr } = await supabase
            .from('facility_reservations')
            .select('id, facility:facilities(school_id)')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!resv || (resv.facility as any)?.school_id !== schoolId) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        const { error: delErr } = await supabase.from('facility_reservations').delete().eq('id', id);
        if (delErr) throw delErr;

        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin facility delete unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// DELETE /api/v1/reservations-admin/courtesy/:id
router.delete('/courtesy/:id', requireAuth, requireOwnerOrAdmin, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { id } = req.params;

        const { data: booking, error: fetchErr } = await supabase
            .from('session_bookings')
            .select('id')
            .eq('id', id)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (fetchErr) throw fetchErr;
        if (!booking) return res.status(404).json({ error: 'Reserva no encontrada.' });

        const { error: delErr } = await supabase.from('session_bookings').delete().eq('id', id);
        if (delErr) throw delErr;

        res.json({ success: true });
    } catch (err: any) {
        req.log?.error({ err }, 'reservations-admin courtesy delete unhandled error');
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
