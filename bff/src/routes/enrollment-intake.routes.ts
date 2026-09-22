/**
 * /api/v1/enrollment-intake — inbox de revisión de hojas de matrícula
 * (fase 4 de docs/specs/alta-atleta-por-foto-hoja-matricula.md).
 *
 * NO reimplementa el alta de atleta: el frontend crea el atleta llamando a
 * `POST /api/v1/students/create-one` (el mismo endpoint que usa el alta
 * manual, con su detección de duplicados por documento/nombre y su guardia
 * de mayor-de-edad ya construidas) y luego confirma acá con `/mark-approved`.
 * Este router solo administra el ciclo de vida de la fila de
 * `enrollment_form_intake`: listar, marcar aprobada, vincular a un atleta
 * existente, o rechazar.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();
const BUCKET = 'identity-documents';
const SIGNED_URL_TTL_SEG = 600; // 10 minutos — el inbox pide una URL fresca cada vez que se abre la lista.

const ROLES_ADMIN = ['owner', 'admin', 'super_admin', 'school_admin', 'school'] as const;

// ── GET / — lista de fichas pendientes de revisión ────────────────────────────
router.get('/', requireAuth, requireRole(...ROLES_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req;
    const status = typeof req.query.status === 'string' ? req.query.status : 'waiting_review';

    const { data: rows, error } = await supabase
        .from('enrollment_form_intake')
        .select('id, storage_path, status, extracted, duplicate_of_child_id, duplicate_of_intake_id, rejection_reason, created_at')
        .eq('school_id', schoolId)
        .eq('status', status)
        .order('created_at', { ascending: true });

    if (error) {
        req.log?.error({ err: error }, '[enrollment-intake] error listando');
        return res.status(500).json({ error: 'No se pudo cargar el inbox de matrículas.' });
    }

    // Nombre del duplicado, para no obligar al frontend a hacer un segundo viaje.
    const duplicateIds = [...new Set((rows ?? []).map(r => r.duplicate_of_child_id).filter(Boolean))] as string[];
    const duplicateNames = new Map<string, string>();
    if (duplicateIds.length > 0) {
        const { data: dups } = await supabase
            .from('children')
            .select('id, full_name')
            .in('id', duplicateIds);
        for (const d of dups ?? []) duplicateNames.set(d.id as string, d.full_name as string);
    }

    const withUrls = await Promise.all((rows ?? []).map(async (row) => {
        let photoUrl: string | null = null;
        if (row.storage_path) {
            const { data: signed } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SEG);
            photoUrl = signed?.signedUrl ?? null;
        }
        return {
            id: row.id,
            status: row.status,
            extracted: row.extracted,
            photoUrl,
            duplicateOfChildId: row.duplicate_of_child_id,
            duplicateOfChildName: row.duplicate_of_child_id ? duplicateNames.get(row.duplicate_of_child_id) ?? null : null,
            duplicateOfIntakeId: row.duplicate_of_intake_id,
            rejectionReason: row.rejection_reason,
            createdAt: row.created_at,
        };
    }));

    return res.json({ items: withUrls });
});

// ── POST /:id/mark-approved — el frontend YA creó el atleta por create-one ──
// Exactamente uno de los dos: `childId` (menor, create-one type "child") o
// `unregisteredAthleteId` (mayor de edad, create-one type "unregistered_adult"
// — ese tipo crea la fila en unregistered_athletes, no en children).
const MarkApprovedSchema = z.object({
    childId: z.string().uuid().optional(),
    unregisteredAthleteId: z.string().uuid().optional(),
    // create-one no tiene estos campos en su schema (ChildSchema/UnregisteredAdultSchema
    // no los cargan) — se completan acá, aparte, porque ya se tiene acceso de servicio
    // a la fila recién creada.
    epsName: z.string().max(200).optional(),
    bloodType: z.string().max(10).optional(),
}).refine(
    (v) => Boolean(v.childId) !== Boolean(v.unregisteredAthleteId),
    { message: 'Mandá exactamente uno: childId o unregisteredAthleteId.' },
);

router.post('/:id/mark-approved', requireAuth, requireRole(...ROLES_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req;
    const parsed = MarkApprovedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.', details: parsed.error.issues });

    const { data: intake } = await supabase
        .from('enrollment_form_intake')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('school_id', schoolId)
        .maybeSingle();

    if (!intake) return res.status(404).json({ error: 'Ficha no encontrada.' });
    if (intake.status !== 'waiting_review') {
        return res.status(409).json({ error: `La ficha ya está en estado "${intake.status}", no en revisión.` });
    }

    // Se verifica explícito que el destino sea de ESTA escuela — no basta con
    // confiar en que el frontend mandó el id correcto.
    const patch: Record<string, unknown> = {
        status: 'approved',
        reviewed_by: req.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
    };

    const salud: Record<string, unknown> = {};
    if (parsed.data.epsName) salud.eps_name = parsed.data.epsName;
    if (parsed.data.bloodType) salud.blood_type = parsed.data.bloodType;

    if (parsed.data.childId) {
        const { data: child } = await supabase
            .from('children')
            .select('id')
            .eq('id', parsed.data.childId)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!child) return res.status(404).json({ error: 'El atleta indicado no existe en esta escuela.' });
        patch.child_id = parsed.data.childId;
        if (Object.keys(salud).length > 0) {
            await supabase.from('children').update(salud).eq('id', parsed.data.childId);
        }
    } else {
        const { data: ua } = await supabase
            .from('unregistered_athletes')
            .select('id')
            .eq('id', parsed.data.unregisteredAthleteId)
            .eq('school_id', schoolId)
            .maybeSingle();
        if (!ua) return res.status(404).json({ error: 'El atleta indicado no existe en esta escuela.' });
        patch.unregistered_athlete_id = parsed.data.unregisteredAthleteId;
        if (Object.keys(salud).length > 0) {
            await supabase.from('unregistered_athletes').update(salud).eq('id', parsed.data.unregisteredAthleteId);
        }
    }

    const { error } = await supabase
        .from('enrollment_form_intake')
        .update(patch)
        .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'No se pudo marcar la ficha como aprobada.' });
    return res.json({ success: true });
});

// ── POST /:id/link — vincular a un atleta YA existente (duplicado) ──────────
const LinkSchema = z.object({ childId: z.string().uuid() });

router.post('/:id/link', requireAuth, requireRole(...ROLES_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req;
    const parsed = LinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'childId inválido.', details: parsed.error.issues });

    const { data: intake } = await supabase
        .from('enrollment_form_intake')
        .select('id, status, extracted')
        .eq('id', req.params.id)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!intake) return res.status(404).json({ error: 'Ficha no encontrada.' });
    if (intake.status !== 'waiting_review') {
        return res.status(409).json({ error: `La ficha ya está en estado "${intake.status}", no en revisión.` });
    }

    // El destino tiene que seguir existiendo — puede haberse borrado entre que
    // el inbox lo mostró y el admin dio clic (§6.1(c) del plan).
    const { data: child } = await supabase
        .from('children')
        .select('id, eps_name, blood_type, date_of_birth, doc_type, doc_number')
        .eq('id', parsed.data.childId)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!child) return res.status(404).json({ error: 'El atleta a vincular ya no existe. Revisa la lista de nuevo.' });

    // Solo se completan campos VACÍOS del atleta existente — nunca se
    // sobrescribe uno ya cargado.
    const extracted = intake.extracted as Record<string, any> | null;
    const patch: Record<string, unknown> = {};
    if (extracted) {
        if (!child.eps_name && extracted.epsName) patch.eps_name = extracted.epsName;
        if (!child.blood_type && extracted.bloodType) patch.blood_type = extracted.bloodType;
        if (!child.date_of_birth && extracted.dateOfBirth) patch.date_of_birth = extracted.dateOfBirth;
        if (!child.doc_type && extracted.docType) patch.doc_type = extracted.docType;
        if (!child.doc_number && extracted.docNumber) patch.doc_number = extracted.docNumber;
    }

    if (Object.keys(patch).length > 0) {
        const { error: patchErr } = await supabase.from('children').update(patch).eq('id', child.id);
        if (patchErr) return res.status(500).json({ error: 'No se pudo actualizar el atleta existente.' });
    }

    const { error } = await supabase
        .from('enrollment_form_intake')
        .update({
            status: 'approved',
            child_id: child.id,
            reviewed_by: req.user?.id ?? null,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'No se pudo marcar la ficha como vinculada.' });
    return res.json({ success: true, patchedFields: Object.keys(patch) });
});

// ── POST /:id/reject — descartar la foto sin crear nada ─────────────────────
const RejectSchema = z.object({ reason: z.string().max(500).optional() });

router.post('/:id/reject', requireAuth, requireRole(...ROLES_ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req;
    const parsed = RejectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Motivo inválido.', details: parsed.error.issues });

    const { data: intake } = await supabase
        .from('enrollment_form_intake')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('school_id', schoolId)
        .maybeSingle();
    if (!intake) return res.status(404).json({ error: 'Ficha no encontrada.' });
    if (intake.status !== 'waiting_review') {
        return res.status(409).json({ error: `La ficha ya está en estado "${intake.status}", no en revisión.` });
    }

    const { error } = await supabase
        .from('enrollment_form_intake')
        .update({
            status: 'rejected',
            rejection_reason: parsed.data.reason ?? null,
            reviewed_by: req.user?.id ?? null,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.params.id);

    if (error) return res.status(500).json({ error: 'No se pudo descartar la ficha.' });
    return res.json({ success: true });
});

export default router;
