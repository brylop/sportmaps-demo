import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { normalizeSchoolName } from '../utils/brandingUtils';
import {
    createPendingPayment as createPendingPaymentShared,
    cancelPendingPlanPayments,
    INACTIVE_ATHLETE_ERROR,
} from '../services/enrollmentBilling';

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
        .min(1, 'Al menos un deportista requerido')
        .max(200, 'Máximo 200 deportistas por carga'),
    options: z.object({
        // Si true: actualiza si document_id ya existe. Si false: reporta como error.
        upsert: z.boolean().default(false),
        // Branch ID por defecto para deportistas sin columna 'sede' en el CSV
        defaultBranchId: z.string().uuid().nullable().optional(),
    }).default({ upsert: false }),
});

// children-by-ids — resuelve nombres/PII de menores por lote.
// IMPORTANTE: el BFF usa service role (bypassa RLS). Sin el filtro school_id
// abajo, un admin de la escuela A podía obtener PII medica de niños de la
// escuela B con sólo saber los UUIDs.
async function fetchChildrenByIds(
    req: AuthenticatedRequest,
    res: Response,
    ids: string[] | undefined,
): Promise<Response> {
    try {
        const cleanIds = [...new Set((ids ?? []).filter(Boolean))];
        if (!cleanIds.length) return res.json([]);

        const { schoolId } = req;
        if (!schoolId) {
            return res.status(400).json({ error: 'schoolId del request es requerido.' });
        }

        // supabase-js traduce .in() a un GET a PostgREST con los IDs en la URL,
        // así que con lotes grandes la URL de PostgREST también revienta (500).
        // Chunkeamos para mantener cada query dentro de límites seguros.
        const CHUNK = 150;
        const rows: any[] = [];
        for (let i = 0; i < cleanIds.length; i += CHUNK) {
            const slice = cleanIds.slice(i, i + CHUNK);
            const { data, error } = await supabase
                .from('children')
                .select('id, full_name, date_of_birth, avatar_url, school_id, medical_info')
                .in('id', slice)
                .eq('school_id', schoolId);
            if (error) throw error;
            if (data?.length) rows.push(...data);
        }
        return res.json(rows);
    } catch (err: any) {
        req.log?.error({ err }, 'children-by-ids unhandled error');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
}

// GET /api/v1/students/children-by-ids?ids=uuid1,uuid2
// Se mantiene por compatibilidad, pero con lotes grandes la URL supera el
// límite del proxy (503 / ERR_FAILED). Preferir el POST de abajo.
router.get('/children-by-ids', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const ids = (req.query.ids as string)?.split(',');
    return fetchChildrenByIds(req, res, ids);
});

// POST /api/v1/students/children-by-ids  { ids: uuid[] }
// Los IDs van en el body para evitar URLs gigantes cuando el lote es grande.
router.post('/children-by-ids', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
    return fetchChildrenByIds(req, res, ids);
});

// ── POST /api/v1/students/bulk ────────────────────────────────────────────────
router.post(
    '/bulk',
    requireAuth,
    // Carga masiva de atletas: SOLO admin/owner (coach de escuela no crea atletas).
    requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school'),
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
                    return res.status(500).json({
                        error: 'Error en base de datos al insertar.',
                        details: error.message,
                        hint: error.hint,
                        code: error.code,
                    });
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
                const enrollmentRecords: Array<{ child_id: string; team_id: string; school_id: string; status: string; start_date: string }> = [];
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
                            team_id: teamId,
                            school_id: schoolId,
                            status: 'active',
                            start_date: todayInZone(),
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
                            // 'one_time'|'subscription' (payments_payment_type_check); 'monthly' rompía el INSERT
                            payment_type: 'one_time',
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
                    const teamIdsForEnroll = [...new Set(enrollmentRecords.map(e => e.team_id))];

                    const { data: existingEnrollments } = await supabase
                        .from('enrollments')
                        .select('child_id, team_id')
                        .in('child_id', childIdsForEnroll)
                        .in('team_id', teamIdsForEnroll);

                    const existingEnrollSet = new Set(
                        (existingEnrollments ?? []).map(e => `${e.child_id}:${e.team_id}`)
                    );

                    const newEnrollments = enrollmentRecords.filter(
                        e => !existingEnrollSet.has(`${e.child_id}:${e.team_id}`)
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
            const parentEmailMap = new Map<string, { childName: string; teamId: string | null; fee: number; parentName: string }>();

            for (const s of students) {
                if (s.parent_email && s.parent_email.trim() !== '') {
                    const emailKey = s.parent_email.trim().toLowerCase();
                    if (!parentEmailMap.has(emailKey)) {
                        parentEmailMap.set(emailKey, {
                            childName: `${s.first_name} ${s.last_name}`.trim(),
                            teamId: existingTeamMap.get(s.team?.trim()?.toLowerCase() || '') || null,
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
                const schoolName = normalizeSchoolName(schoolData?.name || 'la Academia');
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
                            team_id: info.teamId,
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

                        // Enviar correos branded en background. El template
                        // se resuelve por escuela (logo + colores) — el primer
                        // hit lee DB, los siguientes vienen del cache de 60s.
                        if (insertedInvites && insertedInvites.length > 0) {
                            const { emailClient } = await import('../utils/emailClient');
                            const { BrandedEmailTemplates } = await import('../utils/emailTemplates');

                            const origin = process.env.CORS_ORIGIN || 'https://app.sportmaps.com';

                            for (const inviteRow of insertedInvites) {
                                const info = parentEmailMap.get(inviteRow.email);
                                if (!info) continue;
                                const inviteLink = `${origin}/register?email=${encodeURIComponent(inviteRow.email)}&role=parent&invite=${inviteRow.id}`;

                                try {
                                    const tpl = await BrandedEmailTemplates.invitation({
                                        parentName: info.parentName,
                                        childName: info.childName,
                                        schoolId,
                                        inviteLink,
                                    });
                                    emailClient.send({
                                        to: inviteRow.email,
                                        subject: tpl.subject,
                                        html: tpl.html,
                                    }).catch((e: any) =>
                                        req.log?.error({ email: inviteRow.email, err: e }, 'Fallo al enviar correo masivo'),
                                    );
                                } catch (e: any) {
                                    req.log?.error({ email: inviteRow.email, err: e }, 'Fallo armando template branded');
                                }
                            }
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
            return res.status(500).json({ error: 'Error interno del servidor al procesar el CSV.' });
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

        if (error) return res.status(500).json({ error: 'Error al obtener deportistas.' });
        return res.json({ students: data });
    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Error inesperado al obtener deportistas');
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ── PUT /api/v1/students/:id ──────────────────────────────────────────────────
// Actualiza perfil base + enrollment de un atleta.
// Usa service role → ownership check OBLIGATORIO antes de cualquier write.
// ⚠️ El entrenador NO va en esta lista. Este endpoint escribe la cuota de la
// inscripción (`monthly_fee`), el correo y el teléfono del acudiente, y la
// identidad del atleta (nombre, documento, fecha de nacimiento). Cambiar cuánto
// paga una familia o a dónde le llegan las notificaciones no es una atribución
// deportiva. Antes aceptaba 'coach' — incoherente con POST /students/bulk, que
// nunca lo aceptó. El coach queda en solo lectura sobre atletas.
router.put(
  '/:id',
  requireAuth,
  requireRole('owner', 'admin', 'school_admin', 'staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // req.params.id llega tipado como string | string[] (Express 5): se
      // normaliza una vez para poder pasarlo a los helpers tipados.
      // El `as string` es necesario: req.params tiene index signature, así que TS no
      // estrecha el tipo con Array.isArray sobre ese acceso y el ternario sigue siendo
      // string | string[] aguas abajo.
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
      const { schoolId } = req;
      const { athlete_type, profile, enrollment } = req.body;

      if (!id || !athlete_type || !schoolId) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
      }

      // ── PASO 1: Verificar ownership según tipo ────────────────────────────
      // Nunca confiar en el body — siempre cruzar contra req.schoolId (del JWT)
      //
      // El estado (activo/inactivo) se lee aquí pero NO decide el ownership: un
      // atleta inactivo sigue siendo de la escuela y sus datos se pueden
      // corregir. Antes el chequeo del adulto exigía status='active' y devolvía
      // un 403 "Acceso denegado" opaco al editar a un inactivo.
      let athleteIsActive = true;

      if (athlete_type === 'child') {
        const { data: owned } = await supabase
          .from('children')
          .select('id, is_active')
          .eq('id', id)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (!owned) return res.status(403).json({ error: 'Acceso denegado.' });
        athleteIsActive = (owned as any).is_active !== false;

      } else if (athlete_type === 'adult') {
        const { data: membership } = await supabase
          .from('school_members')
          .select('id, status')
          .eq('profile_id', id)
          .eq('school_id', schoolId)
          .eq('role', 'athlete')
          .maybeSingle();
        if (!membership) return res.status(403).json({ error: 'Acceso denegado.' });
        athleteIsActive = (membership as any).status === 'active';

      } else if (athlete_type === 'unregistered') {
        const { data: owned } = await supabase
          .from('unregistered_athletes')
          .select('id, is_active')
          .eq('id', id)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (!owned) return res.status(403).json({ error: 'Acceso denegado.' });
        athleteIsActive = (owned as any).is_active !== false;

      } else {
        return res.status(400).json({ error: 'athlete_type inválido.' });
      }

      // ── PASO 1.b: Atleta inactivo → no se le asigna equipo ni plan ────────
      // El plan es lo que genera los cobros: asignárselo a un inactivo lo mete
      // de vuelta a la facturación (open_month solo mira enrollments.status).
      // Se rechaza ANTES de cualquier escritura para no dejar el perfil
      // guardado a medias. Quitarlos (null) sí se permite.
      if (enrollment && !athleteIsActive && (enrollment.team_id || enrollment.offering_plan_id)) {
        return res.status(409).json({ error: INACTIVE_ATHLETE_ERROR });
      }

      // ── PASO 2: Actualizar tabla base ─────────────────────────────────────
      if (profile && Object.keys(profile).length > 0) {
        const profileUpdate = {
          full_name:     profile.full_name     ?? undefined,
          date_of_birth: profile.date_of_birth ?? undefined,
          medical_info:  profile.medical_info  ?? undefined,
          updated_at:    new Date().toISOString(),
        };

        if (athlete_type === 'child') {
          const childUpdate: any = {
            ...profileUpdate,
            tshirt_size:       profile.tshirt_size       ?? undefined,
            blood_type:        profile.blood_type         ?? undefined,
            eps_name:          profile.eps_name           ?? undefined,
            parent_email_temp: profile.parent_email       ?? undefined,
            parent_phone_temp: profile.parent_phone       ?? undefined,
          };
          // Limpiar keys undefined para no sobreescribir con null
          Object.keys(childUpdate).forEach(k => childUpdate[k] === undefined && delete childUpdate[k]);

          const { error } = await supabase
            .from('children')
            .update(childUpdate)
            .eq('id', id)
            .eq('school_id', schoolId); // doble candado
          if (error) throw new Error(`Error actualizando child: ${error.message}`);

        } else if (athlete_type === 'adult') {
          // profiles no tiene school_id → el ownership ya fue verificado en paso 1
          const adultUpdate: any = { ...profileUpdate };
          Object.keys(adultUpdate).forEach(k => adultUpdate[k] === undefined && delete adultUpdate[k]);

          const { error } = await supabase
            .from('profiles')
            .update(adultUpdate)
            .eq('id', id);
          if (error) throw new Error(`Error actualizando profile: ${error.message}`);

        } else if (athlete_type === 'unregistered') {
          const unregUpdate: any = { ...profileUpdate };
          Object.keys(unregUpdate).forEach(k => unregUpdate[k] === undefined && delete unregUpdate[k]);

          const { error } = await supabase
            .from('unregistered_athletes')
            .update(unregUpdate)
            .eq('id', id)
            .eq('school_id', schoolId); // doble candado
          if (error) throw new Error(`Error actualizando unregistered_athlete: ${error.message}`);
        }
      }

      // ── PASO 3: Actualizar enrollments + propagar a payments ──────────────────────
      const warnings: string[] = [];

      if (enrollment) {
        // Helper: columna del atleta según tipo
        const athleteCol = athlete_type === 'child' ? 'child_id'
          : athlete_type === 'adult' ? 'user_id'
          : 'unregistered_athlete_id';

        const applyAthleteFilter = (q: any) => q.eq(athleteCol, id);

        // Vencimiento y alta de cobro salen del servicio compartido
        // (enrollmentBilling): mismo criterio aquí y en POST /enrollments.
        const createPendingPayment = (
          teamId: string | null,
          planId: string | null,
          amount: number,
          concept: string,
          startDate: string
        ) => createPendingPaymentShared({
          schoolId, athleteCol, athleteId: id, teamId, planId, amount, concept, startDate,
        });

        /**
         * Lee las inscripciones activas de un tipo (equipo o plan) y devuelve la
         * más antigua + las sobrantes.
         *
         * Antes esto era un `.maybeSingle()` cuyo `error` se descartaba: con DOS
         * filas activas PostgREST responde 406, `data` llega null y el código
         * concluía "no tiene inscripción" → INSERT → 23505 contra
         * idx_enrollments_user_offering_plan_active. El editor de ese atleta
         * quedaba muerto: hasta cambiarle el nombre fallaba.
         */
        const readActiveEnrollments = async (kind: 'team' | 'plan') => {
          const col = kind === 'team' ? 'team_id' : 'offering_plan_id';
          const { data, error } = await applyAthleteFilter(
            supabase.from('enrollments')
              .select('id, team_id, offering_plan_id, monthly_fee')
              .eq('school_id', schoolId).eq('status', 'active')
              .order('created_at', { ascending: true })
          );
          if (error) throw new Error(`Error leyendo inscripciones: ${error.message}`);
          const rows = (data as any[]) ?? [];
          const withCol = rows.filter(r => r[col]);

          // El `.not(col, 'is', null)` estaba en la QUERY, así que los dos bloques de
          // abajo miraban conjuntos DISJUNTOS: el de equipo veía solo filas con
          // team_id y el de plan solo filas con offering_plan_id. Con una inscripción
          // de roster existente, asignar un plan hacía que el bloque de equipo la
          // actualizara y el de plan —al no ver ninguna con plan— INSERTARA una
          // segunda. Y con la fila vacía que dejaba el QR, ninguno de los dos la veía
          // y los dos insertaban: tres filas para un atleta.
          //
          // Ahora el filtro se aplica en memoria y, si no hay fila con esa columna, se
          // reusa cualquier inscripción activa. `extras` sigue siendo solo las
          // duplicadas del MISMO tipo: cancelar la complementaria acá le borraría al
          // atleta el equipo o el plan que la escuela ya le había puesto.
          const survivor = withCol[0] ?? rows[0] ?? null;
          return { survivor, extras: withCol.slice(1) };
        };

        /**
         * Deja UNA sola inscripción activa antes de que los bloques de equipo y plan
         * escriban nada, heredando en la que sobrevive los datos de las que se van.
         *
         * Sin esto, un atleta que ya venía con el par partido (una fila de roster y
         * otra de plan, 80 casos en producción al 2026-08-03) se quedaba partido para
         * siempre: cada bloque encontraba "su" fila y ninguno las unía. El generador
         * del mes recorre inscripciones, así que cada fila era un cobro.
         */
        const consolidateEnrollments = async () => {
          const { data, error } = await applyAthleteFilter(
            supabase.from('enrollments')
              .select('id, team_id, offering_plan_id, monthly_fee')
              .eq('school_id', schoolId).eq('status', 'active')
              .order('created_at', { ascending: true })
          );
          if (error) throw new Error(`Error leyendo inscripciones: ${error.message}`);
          const rows = (data as any[]) ?? [];
          if (rows.length <= 1) return;

          const [keep, ...rest] = rows;
          const inheritedTeam = keep.team_id ?? rest.find(r => r.team_id)?.team_id ?? null;

          // La cuota sigue al PLAN. Con `keep.monthly_fee ?? …` la fila de roster
          // ganaba con su 0 —el `??` solo atrapa null— y la fusionada quedaba con plan
          // y cuota cero, o sea un atleta activo al que no se le cobra nada.
          const planRow = keep.offering_plan_id ? keep : (rest.find(r => r.offering_plan_id) ?? null);
          const inheritedPlan = planRow?.offering_plan_id ?? null;
          const inheritedFee = planRow
            ? (planRow.monthly_fee ?? null)
            : (keep.monthly_fee ?? rest.find(r => r.monthly_fee != null)?.monthly_fee ?? null);

          // Cancelar ANTES de mover los datos a `keep`: los índices únicos son
          // parciales (WHERE status='active'), así que escribir el plan en la fila que
          // queda con la duplicada todavía activa revienta con 23505.
          await cancelExtraEnrollments(rest);

          await supabase.from('enrollments')
            .update({
              team_id: inheritedTeam,
              offering_plan_id: inheritedPlan,
              monthly_fee: inheritedFee,
              updated_at: new Date().toISOString(),
            })
            .eq('id', keep.id).eq('school_id', schoolId);

          // Los planes que se van y NO quedaron en la fusionada dejan de cobrar; si
          // no, el atleta arrastra una mensualidad viva de un plan que ya no tiene.
          await cancelPendingPlanPayments({
            schoolId, athleteCol, athleteId: id,
            planIds: rest
              .map(r => r.offering_plan_id)
              .filter((pid: string | null): pid is string => !!pid && pid !== inheritedPlan),
          });

          req.log?.warn?.(
            { athleteId: id, schoolId, kept: keep.id, cancelled: rest.map(r => r.id) },
            'Inscripciones duplicadas fusionadas en una sola',
          );
        };

        // Va antes de los dos bloques: después de esto hay como máximo una activa, así
        // que ambos escriben sobre la misma fila en vez de crear una cada uno.
        await consolidateEnrollments();

        /**
         * Cancela las inscripciones activas duplicadas. Va SIEMPRE antes de
         * actualizar la que sobrevive: los índices únicos son parciales
         * (WHERE status='active'), así que mover el plan a la fila que queda con
         * la duplicada todavía activa revienta con 23505.
         */
        const cancelExtraEnrollments = async (extras: any[]) => {
          if (!extras.length) return;
          const today = todayInZone();
          await supabase.from('enrollments')
            .update({ status: 'cancelled', end_date: today, updated_at: new Date().toISOString() })
            .in('id', extras.map(r => r.id))
            .eq('school_id', schoolId);
        };

        // ── Enrollment de EQUIPO ────────────────────────────────────────────────
        if (enrollment.team_id !== undefined) {
          const teamStartDate: string = enrollment.team_start_date || todayInZone();
          // Plan manda: si hay plan seleccionado, el equipo es SOLO roster y no
          // genera cobro propio (evita el doble cobro equipo+plan).
          const hasPlan = !!enrollment.offering_plan_id;
          // Con plan, la cuota del equipo se guarda en 0: el cobro lo define el
          // plan y una cuota fantasma en el equipo reaparecía en la vista
          // (school_athletes) y en el editor. Sin plan, un 0 explícito es
          // "equipo sin cobro" y se respeta tal cual.
          const teamFee: number | null = hasPlan ? 0 : (enrollment.team_monthly_fee ?? null);

          const { survivor: existingTeam, extras: extraTeams } = await readActiveEnrollments('team');
          await cancelExtraEnrollments(extraTeams);

          const oldTeamId: string | null = existingTeam?.team_id || null;

          if (existingTeam) {
            await supabase.from('enrollments')
              .update({ team_id: enrollment.team_id || null, start_date: teamStartDate, monthly_fee: teamFee, updated_at: new Date().toISOString() })
              .eq('id', existingTeam.id).eq('school_id', schoolId);

            if (hasPlan) {
              // Con plan, el equipo NO cobra: cancelar cualquier cobro pendiente
              // de equipo (sin plan) de este atleta.
              await applyAthleteFilter(
                supabase.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                  .eq('school_id', schoolId).not('team_id', 'is', null).is('offering_plan_id', null).eq('status', 'pending')
              );
            } else if (oldTeamId && oldTeamId !== enrollment.team_id) {
              // Equipo cambió: cancelar pagos pending del equipo anterior
              await applyAthleteFilter(
                supabase.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                  .eq('school_id', schoolId).eq('team_id', oldTeamId).eq('status', 'pending')
              );
              // Crear pago nuevo para el equipo nuevo (solo si tiene cuota > 0)
              if (enrollment.team_id) {
                const { data: teamData } = await supabase.from('teams').select('name, price_monthly').eq('id', enrollment.team_id).maybeSingle();
                const amount = teamFee ?? Number(teamData?.price_monthly ?? 0);
                if (amount > 0) await createPendingPayment(enrollment.team_id, null, amount, `Mensualidad ${teamData?.name || 'Equipo'}`, teamStartDate);
              }
            } else if (teamFee !== null && teamFee <= 0) {
              // Cuota de equipo en 0 = sin cobro por equipo: se cancelan los
              // pendientes (payments_amount_positive prohíbe amount = 0).
              await applyAthleteFilter(
                supabase.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                  .eq('school_id', schoolId).eq('team_id', oldTeamId || enrollment.team_id).eq('status', 'pending')
              );
            } else {
              // Mismo equipo: actualizar SOLO el monto de los cobros pendientes.
              //
              // Ya NO se reescribe due_date. Antes se ponía teamStartDate + 1 mes,
              // así que cada guardado del atleta le corría el vencimiento (editar
              // hoy 30/07 lo mandaba al 30/08) y rompía la fecha única del mes.
              // Cuándo vence el cobro lo define el generador del mes (open_month
              // con payment_cutoff_day); cambiar una cuota no es motivo para
              // mover la fecha de pago de una familia.
              if (teamFee !== null) {
                await applyAthleteFilter(
                  supabase.from('payments').update({ amount: teamFee, updated_at: new Date().toISOString() })
                    .eq('school_id', schoolId).eq('team_id', oldTeamId || enrollment.team_id).eq('status', 'pending')
                );
              }
            }
          } else if (enrollment.team_id) {
            const row: any = { school_id: schoolId, status: 'active', team_id: enrollment.team_id, start_date: teamStartDate, monthly_fee: teamFee };
            row[athleteCol] = id;
            const { error } = await supabase.from('enrollments').insert(row);
            if (error) throw new Error(`Error creando enrollment equipo: ${error.message}`);
            // Cobro del equipo solo si NO hay plan y hay cuota > 0.
            if (!hasPlan) {
              const { data: teamData } = await supabase.from('teams').select('name, price_monthly').eq('id', enrollment.team_id).maybeSingle();
              const amount = teamFee ?? Number(teamData?.price_monthly ?? 0);
              if (amount > 0) await createPendingPayment(enrollment.team_id, null, amount, `Mensualidad ${teamData?.name || 'Equipo'}`, teamStartDate);
            }
          }
        }

        // ── Enrollment de PLAN ──────────────────────────────────────────────────
        if (enrollment.offering_plan_id !== undefined) {
          const planStartDate: string = enrollment.plan_start_date || todayInZone();
          const planFee: number | null = enrollment.plan_monthly_fee ?? null;
          const expiresAt = new Date(planStartDate);
          expiresAt.setDate(expiresAt.getDate() + 30);
          const expiresAtStr = expiresAt.toISOString().split('T')[0];

          const { survivor: existingPlan, extras: extraPlans } = await readActiveEnrollments('plan');
          await cancelExtraEnrollments(extraPlans);

          // Los planes de las filas descartadas que NO son el plan final dejan
          // de cobrar: sus cobros pendientes se anulan (si no, el atleta queda
          // con dos mensualidades vivas de planes distintos).
          await cancelPendingPlanPayments({
            schoolId, athleteCol, athleteId: id,
            planIds: extraPlans
              .map(r => r.offering_plan_id)
              .filter((pid: string | null): pid is string => !!pid && pid !== enrollment.offering_plan_id),
          });

          const oldPlanId: string | null = existingPlan?.offering_plan_id || null;

          if (existingPlan) {
            await supabase.from('enrollments')
              .update({ offering_plan_id: enrollment.offering_plan_id || null, start_date: planStartDate, expires_at: expiresAtStr, monthly_fee: planFee, updated_at: new Date().toISOString() })
              .eq('id', existingPlan.id).eq('school_id', schoolId);

            if (oldPlanId && oldPlanId !== enrollment.offering_plan_id) {
              // Plan cambió: cancelar pagos pending del plan anterior
              await applyAthleteFilter(
                supabase.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                  .eq('school_id', schoolId).eq('offering_plan_id', oldPlanId).eq('status', 'pending')
              );
              if (enrollment.offering_plan_id) {
                const { data: planData } = await supabase.from('offering_plans').select('name, price').eq('id', enrollment.offering_plan_id).maybeSingle();
                const amount = planFee ?? planData?.price ?? 0;
                await createPendingPayment(null, enrollment.offering_plan_id, amount, `Plan ${planData?.name || 'Plan'}`, planStartDate);
              }
            } else if (planFee !== null && planFee <= 0) {
              // Plan sin cobro: cancelar pendientes (amount = 0 rompe el
              // constraint payments_amount_positive).
              await applyAthleteFilter(
                supabase.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                  .eq('school_id', schoolId).eq('offering_plan_id', oldPlanId || enrollment.offering_plan_id).eq('status', 'pending')
              );
            } else {
              // Mismo plan: actualizar SOLO el monto de los cobros pendientes.
              //
              // Ya NO se reescribe due_date. Antes se le metía `expiresAtStr`,
              // que es plan_start_date + 30 días — o sea el vencimiento del PLAN
              // usado como fecha de pago del cobro. Son cosas distintas, y el
              // efecto era que cada edición movía el vencimiento del alumno
              // (por eso convivían cobros del mismo agosto venciendo 29 y 30).
              if (planFee !== null) {
                await applyAthleteFilter(
                  supabase.from('payments').update({ amount: planFee, updated_at: new Date().toISOString() })
                    .eq('school_id', schoolId).eq('offering_plan_id', oldPlanId || enrollment.offering_plan_id).eq('status', 'pending')
                );
              }
            }
          } else if (enrollment.offering_plan_id) {
            const row: any = { school_id: schoolId, status: 'active', offering_plan_id: enrollment.offering_plan_id, start_date: planStartDate, expires_at: expiresAtStr, monthly_fee: planFee };
            row[athleteCol] = id;
            const { error } = await supabase.from('enrollments').insert(row);
            if (error) throw new Error(`Error creando enrollment plan: ${error.message}`);
            const { data: planData } = await supabase.from('offering_plans').select('name, price').eq('id', enrollment.offering_plan_id).maybeSingle();
            const amount = planFee ?? planData?.price ?? 0;
            await createPendingPayment(null, enrollment.offering_plan_id, amount, `Plan ${planData?.name || 'Plan'}`, planStartDate);
          }
        }

        // ── Guard: ninguna inscripción activa puede quedar sin equipo NI plan ───
        //
        // Las dos ramas de arriba actualizan por separado y ambas escriben
        // `|| null` (equipo ~L829, plan ~L913). Guardar un atleta sin equipo
        // cuando su fila no tenía plan —o al revés— la dejaba HUÉRFANA: activa,
        // sin referenciar nada, y **conservando su monthly_fee** (la rama de
        // equipo escribe `monthly_fee: teamFee` en el mismo UPDATE).
        //
        // El daño era invisible por partida doble: `school_athletes` la ignora
        // (sus LATERAL exigen team_id o offering_plan_id, así que el listado se
        // ve impecable) mientras `open_month` **sí** la factura, porque su
        // cascada cae hasta children.monthly_fee cuando no hay plan ni equipo.
        // Resultado: cobros duplicados que nadie podía ver en pantalla.
        //
        // Auditoría 2026-07-31: 26 filas así en producción, hasta 3 por atleta.
        // Combinaciones válidas: equipo+plan, solo plan, solo equipo. La cuarta
        // no existe en el negocio → aquí se cierra, y la migración del CHECK
        // (D19) la vuelve imposible a nivel de tabla.
        // Ver docs/plan-f0-inscripciones-y-cobros-duplicados.md §1.A
        const { data: orphaned, error: orphanErr } = await applyAthleteFilter(
          supabase.from('enrollments')
            .select('id')
            .eq('school_id', schoolId)
            .eq('status', 'active')
            .is('team_id', null)
            .is('offering_plan_id', null)
        );
        if (orphanErr) throw new Error(`Error verificando inscripciones huérfanas: ${orphanErr.message}`);

        if (orphaned?.length) {
          const today = todayInZone();
          const { error: cancelErr } = await supabase.from('enrollments')
            .update({ status: 'cancelled', end_date: today, updated_at: new Date().toISOString() })
            .in('id', (orphaned as any[]).map(r => r.id))
            .eq('school_id', schoolId);
          if (cancelErr) throw new Error(`Error cancelando inscripción huérfana: ${cancelErr.message}`);

          // No se anulan cobros aquí: los pendientes de una huérfana no traen
          // team_id ni offering_plan_id, así que no hay forma de distinguirlos
          // de otros cobros del atleta sin arriesgar cancelar el equivocado.
          // Se avisa y la escuela decide.
          warnings.push(
            'El atleta quedó sin equipo y sin plan, así que su inscripción se cerró y dejará de generar cobros. ' +
            'Si sigue activo, asígnale un equipo o un plan. Revisa sus cobros pendientes.'
          );
          req.log?.warn?.(
            { athleteId: id, schoolId, cancelled: (orphaned as any[]).map(r => r.id) },
            'Inscripción huérfana cancelada por el guard del editor de atletas'
          );
        }
      }


      return res.json({ success: true, warnings });

    } catch (err: any) {
      req.log?.error?.({ err: err.message }, 'Error en PUT /students/:id');
      return res.status(500).json({ error: err.message || 'Error interno.' });
    }
  }
);

export default router;

