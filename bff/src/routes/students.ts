import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schema Zod v4 ─────────────────────────────────────────────────────────────
// ⚠️  En Zod v4, los errores están en `error.issues`, no en `error.errors`
const StudentSchema = z.object({
    first_name: z.string().min(2, 'Nombre muy corto').max(100).trim(),
    last_name: z.string().min(2, 'Apellido muy corto').max(100).trim(),
    document_id: z.string().min(5, 'Documento muy corto').max(20)
        .regex(/^[0-9A-Za-z\-]+$/, 'Documento inválido'),
    grade: z.string().max(20).optional(),
    medical_info: z.string().max(1000).optional(),
});

const BulkUploadSchema = z.object({
    students: z.array(StudentSchema)
        .min(1, 'Al menos un estudiante requerido')
        .max(200, 'Máximo 200 estudiantes por carga'),
    options: z.object({
        // Si true: actualiza si document_id ya existe. Si false: reporta como error.
        upsert: z.boolean().default(false),
    }).default({ upsert: false }),
});

// ── POST /api/v1/students/bulk ────────────────────────────────────────────────
router.post(
    '/bulk',
    requireAuth,
    requireRole('admin', 'staff'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const { schoolId } = req;

            // 1. Validar payload
            const parsed = BulkUploadSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    error: 'Datos inválidos.',
                    // ✅ Zod v4: usar .issues en vez de .errors
                    details: parsed.error.issues,
                });
            }

            const { students, options } = parsed.data;

            // 2. Detectar duplicados DENTRO del mismo payload (document_id repetido)
            const docIds = students.map(s => s.document_id);
            const duplicatesInPayload = docIds.filter((id, i) => docIds.indexOf(id) !== i);
            if (duplicatesInPayload.length > 0) {
                return res.status(400).json({
                    error: 'El payload tiene document_id duplicados.',
                    duplicates: [...new Set(duplicatesInPayload)],
                });
            }

            // 3. Buscar cuáles ya existen en esta escuela
            const { data: existing } = await supabase
                .from('students')
                .select('id, document_id')
                .eq('school_id', schoolId)      // 🔒 solo busca en TU escuela
                .in('document_id', docIds);

            const existingMap = new Map(existing?.map(s => [s.document_id, s.id]) ?? []);

            // 4. Separar en nuevos vs. existentes
            const toInsert: typeof students = [];
            const toUpdate: Array<{ id: string; data: (typeof students)[0] }> = [];
            const skipped: Array<{ document_id: string; reason: string }> = [];

            for (const student of students) {
                const existingId = existingMap.get(student.document_id);
                if (existingId) {
                    if (options.upsert) {
                        toUpdate.push({ id: existingId, data: student });
                    } else {
                        skipped.push({ document_id: student.document_id, reason: 'Ya existe. Activa upsert para actualizar.' });
                    }
                } else {
                    toInsert.push(student);
                }
            }

            // 5. Ejecutar inserts
            let inserted = 0;
            if (toInsert.length > 0) {
                const records = toInsert.map(s => ({
                    ...s,
                    school_id: schoolId,    // 🔒 forzado por el servidor
                    status: 'active',
                    created_at: new Date().toISOString(),
                }));

                const { data, error } = await supabase
                    .from('students')
                    .insert(records)
                    .select('id');

                if (error) {
                    req.log?.error({ err: error }, 'Error en bulk insert');
                    return res.status(500).json({ error: 'Error en base de datos al insertar.' });
                }
                inserted = data?.length ?? 0;
            }

            // 6. Ejecutar updates (si upsert: true)
            let updated = 0;
            for (const { id, data: studentData } of toUpdate) {
                const { error } = await supabase
                    .from('students')
                    .update({ ...studentData, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .eq('school_id', schoolId);  // 🔒 doble check

                if (!error) updated++;
            }

            // 7. Respuesta con reporte detallado
            const totalFailed = skipped.length;
            const statusCode = totalFailed === 0 ? 200 : inserted + updated > 0 ? 207 : 422;

            return res.status(statusCode).json({
                success: totalFailed === 0,
                message: `${inserted + updated} procesados, ${totalFailed} omitidos.`,
                summary: { total: students.length, inserted, updated, skipped: totalFailed },
                skipped,  // detalle fila por fila de los omitidos
            });

        } catch (err) {
            next(err);
        }
    }
);

// ── GET /api/v1/students ──────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('admin', 'staff'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('students')
            .select('id, first_name, last_name, document_id, grade, status')
            .eq('school_id', req.schoolId)   // 🔒 siempre filtrado
            .order('last_name');

        if (error) return res.status(500).json({ error: 'Error al obtener estudiantes.' });
        return res.json({ students: data });
    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Error inesperado al obtener estudiantes');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});
// Necesario para que el catch use next()
function next(err: unknown) { throw err; }

export default router;
