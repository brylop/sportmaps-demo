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
    team: z.string().max(100).optional(),
    sport: z.string().max(100).optional(),
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

            // 3. Buscar cuáles ya existen en esta escuela (usando colas SQL reales: children.doc_number)
            const { data: existing } = await supabase
                .from('children')
                .select('id, doc_number')
                .eq('school_id', schoolId)
                .in('doc_number', docIds);

            const existingMap = new Map(existing?.map(s => [s.doc_number, s.id]) ?? []);

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
            const insertedChildMap = new Map<string, string>(); // doc_number → child_id
            if (toInsert.length > 0) {
                const records = toInsert.map(s => ({
                    full_name: `${s.first_name} ${s.last_name}`.trim(),
                    doc_number: s.document_id,
                    doc_type: 'CC', // Por defecto
                    grade: s.grade,
                    medical_info: s.medical_info,
                    school_id: schoolId,
                    is_demo: false, // Por defecto
                    created_at: new Date().toISOString(),
                }));

                const { data, error } = await supabase
                    .from('children')
                    .insert(records)
                    .select('id, doc_number');

                if (error) {
                    req.log?.error({ err: error }, 'Error en bulk insert');
                    return res.status(500).json({ error: 'Error en base de datos al insertar.' });
                }
                inserted = data?.length ?? 0;

                // Map doc_number → child id for enrollment later
                for (const row of data ?? []) {
                    insertedChildMap.set(row.doc_number, row.id);
                }
            }

            // 6. Ejecutar updates (si upsert: true)
            let updated = 0;
            for (const { id, data: s } of toUpdate) {
                const { error } = await supabase
                    .from('children')
                    .update({
                        full_name: `${s.first_name} ${s.last_name}`.trim(),
                        doc_number: s.document_id,
                        grade: s.grade,
                        medical_info: s.medical_info,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .eq('school_id', schoolId);

                if (!error) updated++;
            }

            // 7. Auto-crear equipos y enrollments ─────────────────────────────
            let teamsCreated = 0;
            let enrollmentsCreated = 0;

            // Collect unique team names from all students (inserted + updated)
            const teamStudentMap = new Map<string, { sport: string; docIds: string[] }>();
            for (const student of students) {
                if (student.team) {
                    const teamKey = student.team.trim().toLowerCase();
                    if (!teamStudentMap.has(teamKey)) {
                        teamStudentMap.set(teamKey, {
                            sport: student.sport || 'General',
                            docIds: [],
                        });
                    }
                    teamStudentMap.get(teamKey)!.docIds.push(student.document_id);
                }
            }

            if (teamStudentMap.size > 0) {
                // Get all original team names (preserve casing from first occurrence)
                const teamOriginalNames = new Map<string, string>();
                for (const student of students) {
                    if (student.team) {
                        const key = student.team.trim().toLowerCase();
                        if (!teamOriginalNames.has(key)) {
                            teamOriginalNames.set(key, student.team.trim());
                        }
                    }
                }

                // Check which teams already exist for this school
                const teamNames = [...teamOriginalNames.values()];
                const { data: existingTeams } = await supabase
                    .from('teams')
                    .select('id, name')
                    .eq('school_id', schoolId)
                    .in('name', teamNames);

                const existingTeamMap = new Map(
                    (existingTeams ?? []).map(t => [t.name.toLowerCase(), t.id])
                );

                // Create missing teams
                const teamsToCreate = [...teamStudentMap.entries()]
                    .filter(([key]) => !existingTeamMap.has(key))
                    .map(([key, val]) => ({
                        name: teamOriginalNames.get(key) || key,
                        sport: val.sport,
                        school_id: schoolId,
                        status: 'active',
                        current_students: 0,
                        created_at: new Date().toISOString(),
                    }));

                if (teamsToCreate.length > 0) {
                    const { data: createdTeams, error: teamError } = await supabase
                        .from('teams')
                        .insert(teamsToCreate)
                        .select('id, name');

                    if (teamError) {
                        req.log?.error({ err: teamError }, 'Error creando equipos');
                    } else {
                        teamsCreated = createdTeams?.length ?? 0;
                        for (const t of createdTeams ?? []) {
                            existingTeamMap.set(t.name.toLowerCase(), t.id);
                        }
                    }
                }

                // Build a doc_number → child_id map for ALL students (inserted + updated)
                const allDocIds = [...teamStudentMap.values()].flatMap(v => v.docIds);
                const { data: childRows } = await supabase
                    .from('children')
                    .select('id, doc_number')
                    .eq('school_id', schoolId)
                    .in('doc_number', allDocIds);

                const docToChildId = new Map(
                    (childRows ?? []).map(c => [c.doc_number, c.id])
                );

                // Create enrollments (skip if already exists)
                const enrollmentRecords: Array<{ child_id: string; program_id: string; status: string; start_date: string }> = [];

                for (const [teamKey, teamData] of teamStudentMap.entries()) {
                    const teamId = existingTeamMap.get(teamKey);
                    if (!teamId) continue;

                    for (const docId of teamData.docIds) {
                        const childId = docToChildId.get(docId);
                        if (!childId) continue;

                        enrollmentRecords.push({
                            child_id: childId,
                            program_id: teamId,
                            status: 'active',
                            start_date: new Date().toISOString().split('T')[0],
                        });
                    }
                }

                if (enrollmentRecords.length > 0) {
                    // Check which enrollments already exist to avoid duplicates
                    const childIdsForEnroll = enrollmentRecords.map(e => e.child_id);
                    const programIdsForEnroll = [...new Set(enrollmentRecords.map(e => e.program_id))];

                    const { data: existingEnrollments } = await supabase
                        .from('enrollments')
                        .select('child_id, program_id')
                        .in('child_id', childIdsForEnroll)
                        .in('program_id', programIdsForEnroll);

                    const existingEnrollSet = new Set(
                        (existingEnrollments ?? []).map(e => `${e.child_id}:${e.program_id}`)
                    );

                    const newEnrollments = enrollmentRecords.filter(
                        e => !existingEnrollSet.has(`${e.child_id}:${e.program_id}`)
                    );

                    if (newEnrollments.length > 0) {
                        const { data: enrollData, error: enrollError } = await supabase
                            .from('enrollments')
                            .insert(newEnrollments)
                            .select('id');

                        if (enrollError) {
                            req.log?.error({ err: enrollError }, 'Error creando enrollments');
                        } else {
                            enrollmentsCreated = enrollData?.length ?? 0;
                        }
                    }
                }
            }

            // 8. Respuesta con reporte detallado
            const totalFailed = skipped.length;
            const statusCode = totalFailed === 0 ? 200 : inserted + updated > 0 ? 207 : 422;

            return res.status(statusCode).json({
                success: totalFailed === 0,
                message: `${inserted + updated} procesados, ${totalFailed} omitidos. ${teamsCreated} equipos creados, ${enrollmentsCreated} inscripciones.`,
                summary: {
                    total: students.length,
                    inserted,
                    updated,
                    skipped: totalFailed,
                    teams_created: teamsCreated,
                    enrollments_created: enrollmentsCreated,
                },
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
