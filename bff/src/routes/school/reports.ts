/**
 * API del Informe Mensual del Atleta.
 *
 * El ciclo completo: generar borradores → escribir la nota del equipo →
 * publicar (que congela el snapshot) → enviar.
 *
 * Toda la escritura sobre `athlete_reports` pasa por las RPCs de la migración
 * 20260731163725: la tabla solo concede SELECT a `authenticated` (§9.1), porque
 * las policies de Postgres son por fila y no por columna, así que «el coach
 * actualiza solo coach_note» no es expresable como policy.
 *
 * ⚠️ Las RPCs se invocan con `userClient(req)`, NO con el cliente de servicio.
 * Con la service role key `auth.uid()` es NULL dentro de PostgREST, así que toda
 * RPC que autorice por caller —todas, porque §10.1 lo exige— rechazaría al BFF
 * con 42501. Ver `utils/userClient.ts`.
 *
 * `requireRole` es solo la primera puerta; la autorización real la hace cada RPC
 * en su cuerpo, y la RLS de M2 filtra las lecturas.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';
import { buildReportSnapshot, buildTeamReportSnapshot, type SubjectType } from '../../services/report-snapshot.service';
import { deliverPublishedReports } from '../../services/report-delivery.service';
import { userClient } from '../../utils/userClient';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
const ADMIN_ROLES = ['owner', 'super_admin', 'admin', 'school_admin'] as const;

const PeriodSchema = z.object({
    year: z.coerce.number().int().min(2020).max(2100),
    month: z.coerce.number().int().min(1).max(12),
});

/** Mapea el error de una RPC a un HTTP honesto en vez de un 500 genérico. */
function rpcStatus(error: { code?: string; message?: string }): number {
    if (error.code === '42501') return 403;   // permisos
    if (error.code === 'P0002') return 404;   // no encontrado
    if (error.code === '55000') return 409;   // estado inválido
    if (error.code === '22023') return 400;   // argumento inválido
    return 500;
}

// ── POST /api/v1/school/reports/generate ─────────────────────────────────────
// Crea los borradores del periodo. Idempotente: se puede correr todos los días
// sin duplicar ni pisar notas.
router.post(
    '/reports/generate',
    requireAuth,
    requireRole(...ADMIN_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = PeriodSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Periodo inválido', details: parsed.error.issues });
        }
        const { year, month } = parsed.data;

        const { data, error } = await userClient(req).rpc('generate_report_drafts', {
            p_school_id: req.schoolId,
            p_year: year,
            p_month: month,
        });

        if (error) {
            req.log?.error({ err: error }, 'generate_report_drafts falló');
            return res.status(rpcStatus(error)).json({ error: error.message });
        }

        res.json({ created: data ?? 0, year, month });
    },
);

// ── GET /api/v1/school/reports?year&month ────────────────────────────────────
// Listado del periodo con lo justo para el tablero. El coach ve solo sus
// atletas y el admin ve todo: lo resuelve la RLS de M2, no un filtro acá.
router.get(
    '/reports',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = PeriodSchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Periodo inválido', details: parsed.error.issues });
        }
        const { year, month } = parsed.data;

        // Como el usuario, no como el servicio: así la RLS de M2 hace el filtro
        // por rol y el coach ve solo los informes de sus atletas
        // (coach_can_see_report), sin replicar esa lógica acá.
        const { data, error } = await userClient(req)
            .from('athlete_reports')
            .select('id, subject_type, subject_id, team_id, status, scheduled_for, coach_note, '
                  + 'recipient_id, published_at, sent_at, viewed_at, teams(name)')
            .eq('school_id', req.schoolId)
            .eq('period_year', year)
            .eq('period_month', month)
            .order('scheduled_for', { ascending: true });

        if (error) {
            req.log?.error({ err: error }, 'listado de informes falló');
            return res.status(500).json({ error: 'Error listando informes.' });
        }

        const filas = (data ?? []) as any[];

        // El nombre del atleta no vive en athlete_reports: el eje es polimórfico
        // (subject_type + subject_id, sin FK) porque Postgres no admite FK a tres
        // tablas. Se resuelve acá, en una consulta por tipo presente, no una por
        // fila. Sin el nombre la lista es una columna de estados sin sujeto.
        const porTipo: Record<string, string[]> = {};
        for (const f of filas) {
            (porTipo[f.subject_type] ??= []).push(f.subject_id);
        }

        const TABLA_POR_TIPO: Record<string, string> = {
            profile: 'profiles',
            child: 'children',
            unregistered: 'unregistered_athletes',
        };

        const nombres = new Map<string, string>();
        await Promise.all(
            Object.entries(porTipo).map(async ([tipo, ids]) => {
                const tabla = TABLA_POR_TIPO[tipo];
                if (!tabla) return;
                const { data: sujetos } = await supabase
                    .from(tabla)
                    .select('id, full_name')
                    .in('id', [...new Set(ids)]);
                for (const s of (sujetos ?? []) as any[]) {
                    nombres.set(`${tipo}:${s.id}`, s.full_name);
                }
            }),
        );

        for (const f of filas) {
            f.athlete_name = nombres.get(`${f.subject_type}:${f.subject_id}`) ?? 'Atleta';
        }

        // Buckets del tablero (§10.2). `sin_destinatario` es el que le sirve al
        // admin para perseguir a las familias que no activaron cuenta.
        const resumen = {
            total: filas.length,
            borrador: filas.filter((r) => r.status === 'borrador').length,
            listo: filas.filter((r) => r.status === 'listo').length,
            publicados: filas.filter((r) => r.status === 'publicado').length,
            retenidos: filas.filter((r) => r.status === 'retenido').length,
            enviados: filas.filter((r) => r.sent_at).length,
            leidos: filas.filter((r) => r.viewed_at).length,
            sin_destinatario: filas.filter((r) => r.status === 'publicado' && !r.recipient_id).length,
        };

        // Se devuelve quién libera para que el frontend no tenga que adivinarlo:
        // el coach no puede leer school_settings (RLS), y sin este dato la
        // pantalla o le esconde un botón que sí puede usar, o le ofrece un 403.
        const { data: cfg } = await supabase
            .from('school_settings')
            .select('reports_release_by')
            .eq('school_id', req.schoolId)
            .maybeSingle();

        // Cobertura por equipo (M4). Es información que `resumen` NO puede dar:
        // se calcula sobre los INSCRITOS del periodo, así que incluye a los
        // atletas que no tienen informe porque nadie los midió — el dato que
        // convierte la pantalla en una lista de trabajo. `resumen` solo puede
        // contar filas que ya existen.
        //
        // Fail-soft a propósito: las migraciones se aplican a mano, así que este
        // deploy puede llegar antes que M4. Sin la RPC la pantalla pierde el
        // panel de cobertura y sigue funcionando; si esto tirara 500, el listado
        // entero se caería por un panel accesorio.
        let cobertura: any[] = [];
        const { data: cov, error: covErr } = await userClient(req).rpc('report_coverage', {
            p_school_id: req.schoolId,
            p_year: year,
            p_month: month,
        });
        if (covErr) {
            req.log?.warn({ err: covErr }, 'report_coverage no disponible');
        } else {
            cobertura = (cov ?? []) as any[];
        }

        res.json({
            year,
            month,
            resumen,
            cobertura,
            release_by: (cfg as any)?.reports_release_by ?? 'school',
            reports: filas,
        });
    },
);

// ── PUT /api/v1/school/teams/:teamId/report-note ─────────────────────────────
// La nota de equipo: obligatoria para publicar y el punto donde el módulo se
// gana o se pierde. Un coach con 4 equipos no escribe 60 notas; sí escribe 4.
const NoteSchema = PeriodSchema.extend({
    body: z.string().trim().min(20, 'La nota debe tener al menos 20 caracteres.'),
});

router.put(
    '/teams/:teamId/report-note',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = NoteSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const { year, month, body } = parsed.data;
        const { teamId } = req.params;

        // El equipo tiene que ser de esta escuela: sin esto un staff podría
        // escribir la nota de un equipo ajeno pasando su UUID.
        const { data: team } = await supabase
            .from('teams')
            .select('id')
            .eq('id', teamId)
            .eq('school_id', req.schoolId)
            .maybeSingle();

        if (!team) return res.status(404).json({ error: 'Equipo no encontrado en esta escuela.' });

        // Autor = school_staff.id, no auth.uid(): la identidad del coach en este
        // repo vive en school_staff (resuelto por coach_auth_id o por correo).
        const { data: staffIds } = await userClient(req).rpc('current_staff_ids');
        let authorId: string | null = null;
        if (Array.isArray(staffIds) && staffIds.length > 0) {
            const { data: staff } = await supabase
                .from('school_staff')
                .select('id')
                .in('id', staffIds)
                .eq('school_id', req.schoolId)
                .maybeSingle();
            authorId = (staff as any)?.id ?? null;
        }

        // Como el usuario: la policy de M2 limita la escritura a los equipos del
        // coach. Con service role cualquier staff podría escribir la de otro.
        const { data, error } = await userClient(req)
            .from('team_report_notes')
            .upsert(
                {
                    school_id: req.schoolId,
                    team_id: teamId,
                    period_year: year,
                    period_month: month,
                    body,
                    author_id: authorId,
                },
                { onConflict: 'team_id,period_year,period_month' },
            )
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'upsert de nota de equipo falló');
            return res.status(500).json({ error: 'No se pudo guardar la nota.' });
        }

        res.json(data);
    },
);

// ── PUT /api/v1/school/reports/:id/note ──────────────────────────────────────
// Nota individual, opcional.
router.put(
    '/reports/:id/note',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const note = typeof req.body?.note === 'string' ? req.body.note : '';

        const { error } = await userClient(req).rpc('set_athlete_report_note', {
            p_report_id: req.params.id,
            p_note: note,
        });

        if (error) return res.status(rpcStatus(error)).json({ error: error.message });
        res.json({ ok: true });
    },
);

/** El :id de la ruta, ya angostado a string. */
const paramId = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

/** Arma el snapshot de un informe a partir de su fila. */
async function snapshotFor(reportId: string, schoolId: string) {
    const { data: informe } = await supabase
        .from('athlete_reports')
        .select('id, subject_type, subject_id, team_id, period_year, period_month, coach_note, status')
        .eq('id', reportId)
        .eq('school_id', schoolId)
        .maybeSingle();

    if (!informe) return null;

    const r = informe as any;
    const snapshot = await buildReportSnapshot({
        schoolId,
        subjectType: r.subject_type as SubjectType,
        subjectId: r.subject_id,
        year: r.period_year,
        month: r.period_month,
        governingTeamId: r.team_id,
        coachNote: r.coach_note,
    });

    return { informe: r, snapshot };
}

// ── POST /api/v1/school/reports/:id/publish ──────────────────────────────────
// Congela el snapshot y publica. El snapshot se arma acá y la RPC lo recibe
// (decisión D-G): el cálculo de deltas y destacados ya existe en el frontend, y
// dos implementaciones del mismo ranking terminan divergiendo.
router.post(
    '/reports/:id/publish',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const armado = await snapshotFor(paramId(req.params.id), req.schoolId);
            if (!armado) return res.status(404).json({ error: 'Informe no encontrado.' });

            const { error } = await userClient(req).rpc('publish_athlete_report', {
                p_report_id: req.params.id,
                p_snapshot: armado.snapshot,
                p_override_note: req.body?.override_note === true,
                p_reason: req.body?.reason ?? null,
            });

            if (error) return res.status(rpcStatus(error)).json({ error: error.message });

            res.json({ ok: true, snapshot: armado.snapshot });
        } catch (err: any) {
            req.log?.error({ err }, 'publicación de informe falló');
            res.status(500).json({ error: 'Error publicando el informe.' });
        }
    },
);

// ── POST /api/v1/school/reports/publish-team ─────────────────────────────────
// El lote de un equipo. Un informe con problema no tumba el resto.
const PublishTeamSchema = PeriodSchema.extend({
    team_id: z.string().uuid(),
    override_note: z.boolean().optional(),
    reason: z.string().optional(),
});

router.post(
    '/reports/publish-team',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = PublishTeamSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const { year, month, team_id, override_note, reason } = parsed.data;

        try {
            const { data: pendientes } = await supabase
                .from('athlete_reports')
                .select('id')
                .eq('school_id', req.schoolId)
                .eq('team_id', team_id)
                .eq('period_year', year)
                .eq('period_month', month)
                .in('status', ['borrador', 'listo']);

            // Los snapshots se arman antes y se pasan todos juntos: la RPC
            // publica el lote en una sola transacción.
            const snapshots: Record<string, unknown> = {};
            for (const fila of (pendientes ?? []) as any[]) {
                const armado = await snapshotFor(fila.id, req.schoolId);
                if (armado) snapshots[fila.id] = armado.snapshot;
            }

            const { data, error } = await userClient(req).rpc('publish_team_reports', {
                p_school_id: req.schoolId,
                p_team_id: team_id,
                p_year: year,
                p_month: month,
                p_snapshots: snapshots,
                p_override_note: override_note === true,
                p_reason: reason ?? null,
            });

            if (error) return res.status(rpcStatus(error)).json({ error: error.message });

            res.json({ results: data ?? [] });
        } catch (err: any) {
            req.log?.error({ err }, 'publicación por equipo falló');
            res.status(500).json({ error: 'Error publicando el lote.' });
        }
    },
);

// ── POST /api/v1/school/reports/:id/hold ─────────────────────────────────────
router.post(
    '/reports/:id/hold',
    requireAuth,
    requireRole(...ADMIN_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';

        const { error } = await userClient(req).rpc('hold_athlete_report', {
            p_report_id: req.params.id,
            p_reason: reason,
        });

        if (error) return res.status(rpcStatus(error)).json({ error: error.message });
        res.json({ ok: true });
    },
);

// ── POST /api/v1/school/reports/send ─────────────────────────────────────────
// Despacha los publicados que aún no salieron. `only_due` limita a los que ya
// llegaron a su día del calendario; sin él manda todo lo publicado, que es lo
// que se quiere al probar.
const SendSchema = PeriodSchema.extend({
    only_due: z.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    // Envío puntual de un atleta. El caso real es «acabo de evaluar a este y
    // quiero mandarle a él», no esperar a despachar el equipo entero.
    report_id: z.string().uuid().optional(),
});

router.post(
    '/reports/send',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = SendSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const { year, month, only_due, limit, report_id } = parsed.data;

        // Quién despacha lo decide la escuela en reports_release_by. Con 'coach'
        // el entrenador manda, pero SOLO sus equipos: delegar la liberación no es
        // darle el botón de escribirle a toda la escuela.
        let teamIds: string[] | undefined;
        if (!ADMIN_ROLES.includes(req.role as any)) {
            const { data: settings } = await supabase
                .from('school_settings')
                .select('reports_release_by')
                .eq('school_id', req.schoolId)
                .maybeSingle();

            if ((settings as any)?.reports_release_by !== 'coach') {
                return res.status(403).json({
                    error: 'En esta escuela el envío lo hace la administración.',
                });
            }

            const { data: propios } = await userClient(req).rpc('current_staff_team_ids');
            teamIds = Array.isArray(propios) ? propios : [];
        }

        try {
            const salida = await deliverPublishedReports(req.schoolId, year, month, {
                onlyDue: only_due === true,
                limit,
                teamIds,
                // Se pasa además de teamIds, no en su lugar: el alcance del coach
                // sigue aplicando, así que un id de otro equipo no despacha nada.
                reportIds: report_id ? [report_id] : undefined,
            });
            res.json(salida);
        } catch (err: any) {
            req.log?.error({ err }, 'envío de informes falló');
            res.status(500).json({ error: 'Error enviando los informes.', details: err?.message });
        }
    },
);

// =============================================================================
// Informe DE EQUIPO — evaluacion-post-entrenamiento.md §3.5 (F4 segunda mitad).
// Mismo patrón que arriba: RPCs `_system` porque exigen service_role (no
// auth.uid()), así que el gate real es `requireRole` acá, no la RPC.
// =============================================================================

const TeamPeriodSchema = PeriodSchema;

// ── GET /api/v1/school/reports/team/:teamId/preview?year&month ──────────────
// Snapshot SIEMPRE en vivo (no depende de que exista team_reports todavía) +
// el estado publicado/borrador y las notas por bloque si ya se escribieron.
router.get(
    '/reports/team/:teamId/preview',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = TeamPeriodSchema.safeParse(req.query ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Periodo inválido', details: parsed.error.issues });
        }
        const { year, month } = parsed.data;
        const teamId = paramId(req.params.teamId);

        // El equipo tiene que ser de esta escuela — sin esto, un coach podría
        // pedir el snapshot de un equipo de otra escuela por id adivinado.
        const { data: equipo } = await userClient(req)
            .from('teams')
            .select('id, name')
            .eq('id', teamId)
            .eq('school_id', req.schoolId)
            .maybeSingle();

        if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado.' });

        try {
            const snapshot = await buildTeamReportSnapshot({ schoolId: req.schoolId, teamId, year, month });

            // find-or-create del borrador: las notas por bloque necesitan un
            // report_id real para engancharse. Efecto secundario deliberado de
            // este GET — igual que abrir un documento nuevo lo crea — porque
            // pedirle al coach un paso aparte de "generar" antes de poder
            // comentar es fricción sin beneficio (el borrador no se publica solo).
            let informe: any = (
                await userClient(req)
                    .from('team_reports')
                    .select('id, status, published_at')
                    .eq('school_id', req.schoolId)
                    .eq('team_id', teamId)
                    .eq('period_year', year)
                    .eq('period_month', month)
                    .maybeSingle()
            ).data;

            if (!informe) {
                const { data: creado } = await supabase
                    .from('team_reports')
                    .insert({ school_id: req.schoolId, team_id: teamId, period_year: year, period_month: month })
                    .select('id, status, published_at')
                    .maybeSingle();
                informe = creado ?? null;
            }

            const { data: notas } = await userClient(req)
                .from('report_section_notes')
                .select('section_key, body, author_id, updated_at')
                .eq('school_id', req.schoolId)
                .eq('report_type', 'team')
                .eq('report_id', (informe as any)?.id ?? '00000000-0000-0000-0000-000000000000');

            res.json({ snapshot, report: informe ?? null, section_notes: notas ?? [] });
        } catch (err: any) {
            req.log?.error({ err }, 'preview de informe de equipo falló');
            res.status(500).json({ error: 'No se pudo armar el informe de equipo.', details: err?.message });
        }
    },
);

// ── POST /api/v1/school/reports/team/:teamId/publish { year, month } ────────
// Crea (si no existe) el borrador del periodo, arma el snapshot en vivo y
// publica. Solo admin — igual que el informe por atleta, publicar es de la
// escuela, escribir la nota es del coach (D1/D2 del spec original).
router.post(
    '/reports/team/:teamId/publish',
    requireAuth,
    requireRole(...ADMIN_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = TeamPeriodSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Periodo inválido', details: parsed.error.issues });
        }
        const { year, month } = parsed.data;
        const teamId = paramId(req.params.teamId);

        const { data: equipo } = await userClient(req)
            .from('teams')
            .select('id')
            .eq('id', teamId)
            .eq('school_id', req.schoolId)
            .maybeSingle();

        if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado.' });

        try {
            // find-or-create del borrador. Sin RPC de por medio: es un INSERT
            // simple, la RLS de team_reports ya lo permite solo a staff.
            let reportId: string;
            const { data: existente } = await supabase
                .from('team_reports')
                .select('id, status')
                .eq('school_id', req.schoolId)
                .eq('team_id', teamId)
                .eq('period_year', year)
                .eq('period_month', month)
                .maybeSingle();

            if ((existente as any)?.status === 'publicado') {
                return res.status(409).json({ error: 'Este informe de equipo ya fue publicado.' });
            }

            if (existente) {
                reportId = (existente as any).id;
            } else {
                const { data: creado, error: crearErr } = await supabase
                    .from('team_reports')
                    .insert({ school_id: req.schoolId, team_id: teamId, period_year: year, period_month: month })
                    .select('id')
                    .single();
                if (crearErr || !creado) throw crearErr ?? new Error('No se pudo crear el borrador.');
                reportId = (creado as any).id;
            }

            const snapshot = await buildTeamReportSnapshot({ schoolId: req.schoolId, teamId, year, month });

            // service client: publish_team_report_system exige service_role
            // (el gate de "quién puede publicar" ya lo hizo requireRole arriba).
            const { error: pubErr } = await supabase.rpc('publish_team_report_system', {
                p_report_id: reportId,
                p_snapshot: snapshot,
            });

            if (pubErr) return res.status(rpcStatus(pubErr)).json({ error: pubErr.message });

            res.json({ ok: true, report_id: reportId, snapshot });
        } catch (err: any) {
            req.log?.error({ err }, 'publicar informe de equipo falló');
            res.status(500).json({ error: 'No se pudo publicar el informe de equipo.', details: err?.message });
        }
    },
);

// ── PUT /api/v1/school/reports/team-section-note ─────────────────────────────
// Comentario del coach POR BLOQUE del informe (spec: "cada gráfico lleva
// debajo un párrafo interpretativo"), para athlete_reports o team_reports.
// Escritura directa (report_section_notes concede INSERT/UPDATE a staff vía
// RLS) — sin máquina de estados que proteger, igual que team_report_notes.
const SectionNoteSchema = z.object({
    report_type: z.enum(['athlete', 'team']),
    report_id: z.string().uuid(),
    section_key: z.enum([
        'rpe_borg', 'task_comprehension', 'self_effort_pct', 'satisfaction',
        'focus', 'coach_effort_rating', 'general',
    ]),
    body: z.string().trim().min(1).max(2000),
});

router.put(
    '/reports/team-section-note',
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: AuthenticatedRequest, res: Response) => {
        const parsed = SectionNoteSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }

        const { data: coachRow } = req.user?.id
            ? await supabase
                .from('school_staff')
                .select('id')
                .eq('coach_auth_id', req.user.id)
                .eq('school_id', req.schoolId)
                .eq('status', 'active')
                .maybeSingle()
            : { data: null };

        const { data, error } = await userClient(req)
            .from('report_section_notes')
            .upsert(
                {
                    school_id: req.schoolId,
                    report_type: parsed.data.report_type,
                    report_id: parsed.data.report_id,
                    section_key: parsed.data.section_key,
                    body: parsed.data.body,
                    author_id: (coachRow as any)?.id ?? null,
                },
                { onConflict: 'report_type,report_id,section_key' },
            )
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'guardar nota de bloque falló');
            return res.status(500).json({ error: 'No se pudo guardar la nota.' });
        }

        res.json(data);
    },
);

export default router;
