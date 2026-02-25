import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────
const EnrollmentSchema = z.object({
    student_id: z.string().uuid('student_id inválido'),
    class_id: z.string().uuid('class_id inválido'),
    program_id: z.string().uuid('program_id inválido').optional(),
});

// ── POST /api/v1/enrollments ──────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { schoolId } = req;

        const parsed = EnrollmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Datos inválidos.',
                details: parsed.error.issues,  // ✅ Zod v4
            });
        }

        const { student_id, class_id, program_id } = parsed.data;

        const { data: result, error: rpcError } = await supabase
            .rpc('enroll_student', {
                p_student_id: student_id,
                p_class_id: class_id,
                p_program_id: program_id ?? null,
                p_school_id: schoolId,           // 🔒 forzado por el servidor
            });

        if (rpcError) {
            req.log?.error({ err: rpcError }, 'Error en RPC enroll_student');
            return res.status(500).json({ error: 'Error al procesar la inscripción.' });
        }

        // La función retorna { error: string } o { success: true, enrollment: {...} }
        if (result?.error) {
            const statusCode = result.error.includes('llena') ? 409
                : result.error.includes('no encontrado') ? 404
                    : 400;
            return res.status(statusCode).json({ error: result.error });
        }

        return res.status(201).json({
            success: true,
            data: result.enrollment,
        });

    } catch (err) {
        req.log?.error({ err }, 'Error inesperado en POST /enrollments');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── GET /api/v1/enrollments ───────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { class_id } = req.query;

    let query = supabase
        .from('enrollments')
        .select('id, student_id, class_id, status, payment_status, created_at')
        .eq('school_id', req.schoolId);  // 🔒 siempre filtrado

    if (class_id && typeof class_id === 'string') {
        query = query.eq('class_id', class_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Error al obtener inscripciones.' });

    return res.json({ enrollments: data });
});

export default router;
