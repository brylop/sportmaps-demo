import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// ── Schema Zod v4 ─────────────────────────────────────────────────────────────
// ⚠️  En Zod v4, los errores están en `error.issues`, no en `error.errors`
const StudentSchema = z.object({
    first_name: z.string().min(1, 'Nombre requerido').max(100).trim(),
    last_name: z.string().min(1, 'Apellido requerido').max(100).trim(),
    document_id: z.string().min(1, 'Documento requerido').max(30),
    grade: z.string().max(20).optional(),
    medical_info: z.string().max(1000).refine(
        val => { try { const p = JSON.parse(val); return typeof p.has_allergies === 'boolean'; } catch { return false; } },
        { message: 'notas_medicas debe ser JSON válido con campo has_allergies (boolean). Ej: {"has_allergies": false}' }
    ).optional(),
    branch: z.string().max(100).optional(),
    team: z.string().min(1, 'Equipo requerido').max(100),
    sport: z.string().min(1, 'Deporte requerido').max(100),
    date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento debe tener formato YYYY-MM-DD').optional(),
    gender: z.string().optional(),
    parent_name: z.string().min(2, 'Nombre del acudiente requerido (mín. 2 caracteres)'),
    parent_email: z.string().email('Email del acudiente inválido'),
    parent_phone: z.string().regex(/^\d{10,}$/, 'Teléfono del acudiente debe tener mínimo 10 dígitos numéricos'),
    monthly_fee: z.number().min(10000, 'La mensualidad debe ser mínimo $10,000 COP').optional(),
});

const BulkUploadSchema = z.object({
    students: z.array(StudentSchema)
        .min(1, 'Al menos un estudiante requerido')
        .max(200, 'Máximo 200 estudiantes por carga'),
    options: z.object({
        // Si true: actualiza si document_id ya existe. Si false: reporta como error.
        upsert: z.boolean().default(false),
        // Branch ID por defecto para estudiantes sin columna 'sede' en el CSV
        defaultBranchId: z.string().uuid().nullable().optional(),
    }).default({ upsert: false }),
});

// ── POST /api/v1/students/bulk ────────────────────────────────────────────────
router.post(
    '/bulk',
    requireAuth,
    requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school', 'coach', 'staff'),
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
            const defaultBranchId = options.defaultBranchId || null;

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

            // 4.5. Auto-crear sedes (branches) ───────────────────────────
            let branchesCreated = 0;
            const branchNameToId = new Map<string, string>(); // lowercase name → id

            // Collect unique branch names
            const branchNamesSet = new Set<string>();
            const branchOriginalNames = new Map<string, string>();
            for (const student of students) {
                if (student.branch) {
                    const key = student.branch.trim().toLowerCase();
                    branchNamesSet.add(key);
                    if (!branchOriginalNames.has(key)) {
                        branchOriginalNames.set(key, student.branch.trim());
                    }
                }
            }

            if (branchNamesSet.size > 0) {
                // Fetch ALL branches for this school to do case-insensitive matching locally
                const { data: allExistingBranches } = await supabase
                    .from('school_branches')
                    .select('id, name')
                    .eq('school_id', schoolId);

                for (const b of allExistingBranches ?? []) {
                    branchNameToId.set(b.name.toLowerCase(), b.id);
                }

                // Create missing branches
                const branchesToCreate = [...branchNamesSet]
                    .filter(key => !branchNameToId.has(key))
                    .map(key => ({
                        name: branchOriginalNames.get(key) || key,
                        school_id: schoolId,
                        status: 'active',
                        created_at: new Date().toISOString(),
                    }));

                if (branchesToCreate.length > 0) {
                    const { data: createdBranches, error: branchError } = await supabase
                        .from('school_branches')
                        .insert(branchesToCreate)
                        .select('id, name');

                    if (branchError) {
                        req.log?.error({ err: branchError }, 'Error creando sedes');
                    } else {
                        branchesCreated = createdBranches?.length ?? 0;
                        for (const b of createdBranches ?? []) {
                            branchNameToId.set(b.name.toLowerCase(), b.id);
                        }
                    }
                }
            }

            // Helper: resolve branch_id for a student — falls back to defaultBranchId
            const resolveBranchId = (student: { branch?: string }) => {
                if (student.branch) {
                    return branchNameToId.get(student.branch.trim().toLowerCase()) || defaultBranchId;
                }
                return defaultBranchId;
            };

            // 4.75. Auto-crear equipos (teams) ─────────────────────────────
            let teamsCreated = 0;
            const existingTeamMap = new Map<string, string>(); // lowercase name → id

            // Collect unique team names from all students
            const teamStudentMap = new Map<string, { sport: string; branch?: string }>();
            const teamOriginalNames = new Map<string, string>();

            for (const student of students) {
                if (student.team) {
                    const teamKey = student.team.trim().toLowerCase();
                    if (!teamStudentMap.has(teamKey)) {
                        teamStudentMap.set(teamKey, {
                            sport: student.sport || 'General',
                            branch: student.branch,
                        });
                        teamOriginalNames.set(teamKey, student.team.trim());
                    }
                }
            }

            if (teamStudentMap.size > 0) {
                // Fetch ALL teams for this school to do case-insensitive matching locally
                const { data: allExistingTeams } = await supabase
                    .from('teams')
                    .select('id, name')
                    .eq('school_id', schoolId);

                for (const t of allExistingTeams ?? []) {
                    existingTeamMap.set(t.name.toLowerCase(), t.id);
                }

                // Create missing teams
                const teamsToCreate = [...teamStudentMap.entries()]
                    .filter(([key]) => !existingTeamMap.has(key))
                    .map(([key, val]) => ({
                        name: teamOriginalNames.get(key) || key,
                        sport: val.sport,
                        school_id: schoolId,
                        branch_id: val.branch ? resolveBranchId({ branch: val.branch }) : null,
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
            }

            const resolveTeamId = (student: { team?: string }) => {
                if (!student.team) return null;
                return existingTeamMap.get(student.team.trim().toLowerCase()) || null;
            };

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
                    branch_id: resolveBranchId(s),
                    program_id: resolveTeamId(s),
                    team_id: resolveTeamId(s),  // Sincronizar para que la vista filtre correctamente
                    date_of_birth: s.date_of_birth || null,
                    gender: s.gender || null,
                    parent_name_temp: s.parent_name || null,
                    parent_email_temp: s.parent_email || null,
                    parent_phone_temp: s.parent_phone || null,
                    is_demo: false,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
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
                        branch_id: resolveBranchId(s),
                        program_id: resolveTeamId(s),
                        team_id: resolveTeamId(s),  // Sincronizar para que la vista filtre correctamente
                        date_of_birth: s.date_of_birth || null,
                        gender: s.gender || null,
                        parent_name_temp: s.parent_name || null,
                        parent_email_temp: s.parent_email || null,
                        parent_phone_temp: s.parent_phone || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .eq('school_id', schoolId);

                if (!error) updated++;
            }

            // 7. Auto-crear enrollments y pagos ─────────────────────────────
            let enrollmentsCreated = 0;
            let paymentsCreated = 0;

            if (insertedChildMap.size > 0 || toUpdate.length > 0) {
                // Build a doc_number → child_id map for ALL students (inserted + updated)
                const allDocIds = students.map(s => s.document_id);
                const { data: childRows } = await supabase
                    .from('children')
                    .select('id, doc_number')
                    .eq('school_id', schoolId)
                    .in('doc_number', allDocIds);

                const docToChildId = new Map(
                    (childRows ?? []).map(c => [c.doc_number, c.id])
                );

                // Create enrollments & payments
                const enrollmentRecords: Array<{ child_id: string; program_id: string; status: string; start_date: string }> = [];
                const paymentRecords: Array<any> = [];

                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + 1);

                for (const student of students) {
                    const childId = docToChildId.get(student.document_id);
                    if (!childId) continue;

                    const teamId = resolveTeamId(student);
                    if (teamId) {
                        enrollmentRecords.push({
                            child_id: childId,
                            program_id: teamId,
                            status: 'active',
                            start_date: new Date().toISOString().split('T')[0],
                        });
                    }

                    // Solo crear pago para los recién insertados para evitar duplicar cobros en upsert
                    const isNewChild = [...insertedChildMap.values()].includes(childId);
                    if (isNewChild) {
                        paymentRecords.push({
                            parent_id: null,
                            child_id: childId,
                            school_id: schoolId,
                            branch_id: resolveBranchId(student),
                            amount: student.monthly_fee || 150000,
                            concept: `Mensualidad ${student.team || 'Programa'} - ${student.first_name} ${student.last_name}`.trim(),
                            due_date: dueDate.toISOString().split('T')[0],
                            status: 'pending',
                            payment_type: 'monthly',
                        });
                    }
                }

                if (paymentRecords.length > 0) {
                    const { data: paymentsData, error: paymentsError } = await supabase
                        .from('payments')
                        .insert(paymentRecords)
                        .select('id');

                    if (paymentsError) {
                        req.log?.error({ err: paymentsError }, 'Error creando pagos');
                    } else {
                        paymentsCreated = paymentsData?.length ?? 0;
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

            // 8. Auto-crear Invitaciones para correos de padres
            let invitationsCreated = 0;

            // Recolectar correos únicos de padres con la info del primer hijo que encontremos para la plantilla
            const parentEmailMap = new Map<string, { childName: string; programId: string | null; fee: number; parentName: string }>();

            for (const s of students) {
                if (s.parent_email && s.parent_email.trim() !== '') {
                    const emailKey = s.parent_email.trim().toLowerCase();
                    if (!parentEmailMap.has(emailKey)) {
                        parentEmailMap.set(emailKey, {
                            childName: `${s.first_name} ${s.last_name}`.trim(),
                            programId: existingTeamMap.get(s.team?.trim()?.toLowerCase() || '') || null,
                            fee: s.monthly_fee || 150000,
                            parentName: s.parent_name || emailKey.split('@')[0]
                        });
                    }
                }
            }

            if (parentEmailMap.size > 0) {
                // Verificar cuáles invitaciones ya existen para esta escuela y rol
                const emailList = Array.from(parentEmailMap.keys());
                const { data: existingInvites } = await supabase
                    .from('invitations')
                    .select('email, status')
                    .eq('school_id', schoolId)
                    .eq('role_to_assign', 'parent')
                    .in('email', emailList);

                const existingInviteSet = new Set((existingInvites || []).filter(i => i.status === 'pending' || i.status === 'accepted').map(i => i.email));

                const newInvites = [];
                const emailsToSend = [];

                // Obtener nombre de la escuela para el correo
                const { data: schoolData } = await supabase.from('schools').select('name').eq('id', schoolId).single();
                const schoolName = schoolData?.name || 'la Academia';
                const senderId = req.user?.id || null;

                for (const [email, info] of parentEmailMap.entries()) {
                    if (!existingInviteSet.has(email)) {
                        newInvites.push({
                            email,
                            school_id: schoolId,
                            role_to_assign: 'parent',
                            invited_by: senderId,
                            status: 'pending',
                            child_name: info.childName,
                            program_id: info.programId,
                            monthly_fee: info.fee
                        });
                        emailsToSend.push({ ...info, email });
                    }
                }

                if (newInvites.length > 0) {
                    const { data: insertedInvites, error: inviteError } = await supabase
                        .from('invitations')
                        .insert(newInvites)
                        .select('id, email');

                    if (inviteError) {
                        req.log?.error({ err: inviteError }, 'Error insertando invitaciones masivas');
                    } else {
                        invitationsCreated = insertedInvites?.length || 0;

                        // Enviar correos en background saltando los awaits largos (fire and forget)
                        if (insertedInvites && insertedInvites.length > 0) {
                            const { emailClient } = await import('../utils/emailClient');
                            const { EmailTemplates } = await import('../utils/emailTemplates');

                            const origin = process.env.CORS_ORIGIN || 'https://app.sportmaps.com';

                            insertedInvites.forEach(inviteRow => {
                                const info = parentEmailMap.get(inviteRow.email);
                                if (info) {
                                    const inviteLink = `${origin}/register?email=${encodeURIComponent(inviteRow.email)}&role=parent&invite=${inviteRow.id}`;

                                    emailClient.send({
                                        to: inviteRow.email,
                                        subject: `Invitación a SportMaps - ${schoolName}`,
                                        html: EmailTemplates.invitation(
                                            info.parentName,
                                            info.childName,
                                            schoolName,
                                            inviteLink
                                        )
                                    }).catch((e: any) => req.log?.error({ email: inviteRow.email, err: e }, 'Fallo al enviar correo masivo'));
                                }
                            });
                        }
                    }
                }
            }

            // 9. Respuesta con reporte detallado
            const totalFailed = skipped.length;
            const statusCode = totalFailed === 0 ? 200 : inserted + updated > 0 ? 207 : 422;

            return res.status(statusCode).json({
                success: totalFailed === 0,
                message: `${inserted + updated} procesados, ${totalFailed} omitidos. ${branchesCreated} sedes creadas, ${teamsCreated} equipos creados, ${enrollmentsCreated} insc., ${paymentsCreated} pagos, ${invitationsCreated} invitaciones.`,
                summary: {
                    total: students.length,
                    inserted,
                    updated,
                    skipped: totalFailed,
                    branches_created: branchesCreated,
                    teams_created: teamsCreated,
                    enrollments_created: enrollmentsCreated,
                    invitations_created: invitationsCreated,
                },
                skipped,  // detalle fila por fila de los omitidos
            });

        } catch (err: any) {
            req.log?.error?.({ err: err.message || err }, 'Error inesperado en bulk upload');
            return res.status(500).json({ error: err.message || 'Error interno del servidor al procesar el CSV.' });
        }
    }
);

// ── GET /api/v1/students ──────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school', 'coach', 'staff'), async (req: AuthenticatedRequest, res: Response) => {
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

export default router;

