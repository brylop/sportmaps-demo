import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────
const EnrollmentSchema = z.object({
    student_id: z.string().uuid('student_id inválido'),
    class_id: z.string().uuid('class_id inválido'),
    program_id: z.string().uuid('program_id inválido').optional(),
});

// ── POST /api/v1/enrollments ──────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('admin', 'staff'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        // 1. Validar request
        const parsed = EnrollmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: parsed.error.issues,
            });
        }

        const { student_id, class_id, program_id } = parsed.data;

        // 2. Ejecutar transacción atómica vía RPC en Supabase
        // req.schoolId asegura que no matriculemos en otra escuela
        const { data, error } = await supabase.rpc('enroll_student', {
            p_student_id: student_id,
            p_class_id: class_id,
            p_school_id: req.schoolId,
            p_program_id: program_id || null
        });

        if (error) {
            req.log?.error({ err: error }, 'RPC enroll_student falló');

            // Mapear errores de negocio comunes
            if (error.message.includes('No hay cupos disponibles')) {
                return res.status(409).json({ error: 'La clase está llena.' });
            }
            if (error.message.includes('ya está inscrito')) {
                return res.status(400).json({ error: 'El estudiante ya está inscrito en esta clase.' });
            }

            return res.status(500).json({ error: 'Error interno al procesar la inscripción.' });
        }

        return res.status(201).json({
            success: true,
            message: 'Inscripción exitosa',
            data: data
        });

    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Error inesperado en inscripciones');
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
