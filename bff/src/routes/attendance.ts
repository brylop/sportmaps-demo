import { Router, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── GET /api/v1/attendance/session/:teamId ────────────────────────────────────
// Consulta si ya existe una sesión de asistencia hoy para el equipo.
// Retorna la sesión con sus registros si existe, o null si no.
router.get(
    '/session/:teamId',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { teamId } = req.params;
            const today = new Date().toISOString().split('T')[0];

            // 1. Buscar sesión de hoy para este equipo
            const { data: session, error: sessionErr } = await supabase
                .from('attendance_sessions')
                .select('id, team_id, session_date, finalized, finalized_at, created_by, created_at')
                .eq('team_id', teamId)
                .eq('session_date', today)
                .maybeSingle();

            if (sessionErr) throw sessionErr;

            if (!session) {
                return res.json({ session: null, records: [] });
            }

            // 2. Si existe la sesión, traer los registros asociados
            const { data: records, error: recordsErr } = await supabase
                .from('attendance_records')
                .select('child_id, user_id, status')
                .eq('program_id', teamId)
                .eq('attendance_date', today);

            if (recordsErr) throw recordsErr;

            return res.json({ session, records: records || [] });
        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error consultando sesión de asistencia');
            return res.status(500).json({ error: 'Error interno consultando la sesión.' });
        }
    }
);

// ── POST /api/v1/attendance/session ──────────────────────────────────────────
// Crea la sesión (si no existe) y guarda/actualiza los registros de asistencia.
// Solo permitido si la sesión no está finalizada.
router.post(
    '/session',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { schoolId } = req;
            const { teamId, records } = req.body as {
                teamId: string;
                records: { childId?: string; userId?: string; status: string }[];
            };

            if (!teamId || !Array.isArray(records) || records.length === 0) {
                return res.status(400).json({ error: 'teamId y records son requeridos.' });
            }

            const invalidRecord = records.find((r) => !r.childId && !r.userId);
            if (invalidRecord) {
                return res.status(400).json({ error: 'Cada record debe tener childId o userId.' });
            }

            const today = new Date().toISOString().split('T')[0];

            // 1. Verificar si ya existe sesión hoy
            const { data: existing, error: existingErr } = await supabase
                .from('attendance_sessions')
                .select('id, finalized')
                .eq('team_id', teamId)
                .eq('session_date', today)
                .maybeSingle();

            if (existingErr) throw existingErr;

            // Bloquear si ya está finalizada
            if (existing?.finalized) {
                return res.status(409).json({
                    error: 'La sesión de hoy ya fue finalizada y no puede modificarse.',
                    finalized: true,
                });
            }

            // 2. Crear sesión si no existe (upsert seguro con el UNIQUE constraint)
            const { data: session, error: sessionErr } = await supabase
                .from('attendance_sessions')
                .upsert(
                    {
                        school_id: schoolId,
                        team_id: teamId,
                        session_date: today,
                        created_by: req.user?.id,
                    },
                    { onConflict: 'team_id,session_date', ignoreDuplicates: false }
                )
                .select('id, finalized')
                .single();

            if (sessionErr) throw sessionErr;

            // 3. Guardar registros de asistencia (upsert — permite edición antes de finalizar)
            const attendanceRecords = records.map(({ childId, userId, status }) => ({
                school_id: schoolId,
                program_id: teamId,
                ...(childId ? { child_id: childId } : { user_id: userId }),
                attendance_date: today,
                status,
                marked_by: req.user?.id,
            }));

            const childRecords = attendanceRecords.filter((r: any) => r.child_id);
            const adultRecords = attendanceRecords.filter((r: any) => r.user_id);

            if (childRecords.length > 0) {
                const { error: childErr } = await supabase
                    .from('attendance_records')
                    .upsert(childRecords, {
                        onConflict: 'child_id,program_id,attendance_date',
                        ignoreDuplicates: false,
                    });
                if (childErr) throw childErr;
            }

            if (adultRecords.length > 0) {
                const { error: adultErr } = await supabase
                    .from('attendance_records')
                    .upsert(adultRecords, {
                        onConflict: 'user_id,program_id,attendance_date',
                        ignoreDuplicates: false,
                    });
                if (adultErr) throw adultErr;
            }

            return res.json({ success: true, sessionId: session.id });
        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error guardando sesión de asistencia');
            return res.status(500).json({ error: 'Error interno guardando la asistencia.' });
        }
    }
);

// ── PATCH /api/v1/attendance/session/:sessionId/finalize ──────────────────────
// Finaliza la sesión. Una vez finalizada, los registros son de solo lectura.
router.patch(
    '/session/:sessionId/finalize',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const { sessionId } = req.params;

            // Verificar que la sesión existe y no está ya finalizada
            const { data: session, error: fetchErr } = await supabase
                .from('attendance_sessions')
                .select('id, finalized, team_id')
                .eq('id', sessionId)
                .single();

            if (fetchErr || !session) {
                return res.status(404).json({ error: 'Sesión no encontrada.' });
            }

            if (session.finalized) {
                return res.status(409).json({ error: 'La sesión ya estaba finalizada.' });
            }

            // Obtener preview de bookings que serán procesados por el trigger
            const { data: bookingsPreview } = await supabase
                .from('session_bookings')
                .select('id, user_id, child_id, is_secondary, booking_type, enrollment_id')
                .eq('session_id', sessionId)
                .eq('status', 'confirmed');

            // Finalizar — trigger trg_deduct_sessions_on_finalize se dispara automáticamente
            const { error: updateErr } = await supabase
                .from('attendance_sessions')
                .update({
                    finalized: true,
                    finalized_at: new Date().toISOString(),
                    finalized_by: req.user?.id,
                })
                .eq('id', sessionId);

            if (updateErr) throw updateErr;

            return res.json({
                success: true,
                message: 'Sesión finalizada correctamente.',
                summary: {
                    bookings_processed: bookingsPreview?.length ?? 0,
                    details: (bookingsPreview || []).map((b: any) => ({
                        booking_id: b.id,
                        booking_type: b.booking_type,
                        is_secondary: b.is_secondary,
                    })),
                },
            });
        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error finalizando sesión de asistencia');
            return res.status(500).json({ error: 'Error interno finalizando la sesión.' });
        }
    }
);

// ── GET /api/v1/attendance/rate/:teamId ───────────────────────────────────────
// Calcula el porcentaje de asistencia de un equipo sin problemas de RLS
router.get(
    '/rate/:teamId',
    requireAuth,
    requireRole('owner', 'super_admin', 'admin', 'school_admin', 'coach'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { teamId } = req.params;
            const { data, error } = await supabase
                .from('attendance_records')
                .select('status')
                .eq('program_id', teamId);

            if (error) throw error;

            const total = data?.length || 0;
            const present = data?.filter((r: any) => r.status === 'present' || r.status === 'late').length || 0;

            return res.json({ rate: total > 0 ? Math.round((present / total) * 100) : 0 });
        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error calculando porcentaje de asistencia');
            return res.status(500).json({ error: 'Error interno calculando asistencia.', rate: 0 });
        }
    }
);

export default router;
