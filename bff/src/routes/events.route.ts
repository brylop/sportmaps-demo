import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { todayInZone } from '../utils/businessDate';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { userClient } from '../utils/userClient';

const router = Router();

// Full Event payload schema for creation
const FullEventSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, 'El título es requerido'),
    sport: z.string().min(1, 'El deporte es requerido'),
    description: z.string().optional(),
    event_date: z.string().min(1, 'La fecha es requerida'),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    capacity: z.number().optional(),
    image_url: z.string().optional().nullable(),
    banner_url: z.string().optional().nullable(),
    slug: z.string().min(1, 'El slug es requerido'),
    visibility: z.string().optional().default('public'),
    registration_type: z.string().optional().default('delegation'),
    
    // Rules
    registration_deadline: z.string().optional(),
    payment_deadline: z.string().optional(),
    kit_deadline_platino: z.string().optional().nullable(),
    kit_deadline_gold: z.string().optional().nullable(),
    virtual_reg_start: z.string().optional().nullable(),
    virtual_reg_end: z.string().optional().nullable(),
    presential_reg_start: z.string().optional().nullable(),
    presential_reg_end: z.string().optional().nullable(),
    crossover_allowed: z.boolean().optional().default(false),
    free_package_every: z.number().optional().default(20),
    coach_discount_usd: z.number().optional().default(70),
    companion_discount_usd: z.number().optional().default(50),
    invited_schools: z.array(z.string()).optional(),

    // Payment Config
    payment_methods: z.array(z.string()).optional(),
    bank_data: z.record(z.string(), z.any()).optional(),
    referral_tracking_enabled: z.boolean().optional().default(false),

    // Sub-resources
    categories: z.array(z.any()).optional(),
    price_phases: z.array(z.any()).optional(),
});

// GET /api/v1/events - List published events (public)
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { sport, city, limit = '20', offset = '0' } = req.query as Record<string, string>;

        let q = supabase
            .from('events')
            .select('id, title, sport, description, event_date, city, slug, image_url, banner_url, status, visibility')
            .eq('status', 'published')
            .eq('visibility', 'public')
            .order('event_date', { ascending: true })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (sport) q = q.eq('sport', sport);
        if (city) q = q.ilike('city', `%${city}%`);

        const { data, error } = await q;
        if (error) throw error;

        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error listando eventos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/mine - List organizer's own events
router.get('/mine', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const { data: orgData } = await supabase
            .from('event_organizers')
            .select('id')
            .eq('profile_id', userId)
            .single();

        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const { data, error } = await supabase
            .from('events')
            .select(`
                id, title, sport, description, event_date, city, slug,
                image_url, banner_url, status, visibility, created_at,
                categories:event_categories_config(count),
                phases:event_price_phases(count)
            `)
            .eq('organizer_id', orgData.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error listando eventos del organizador');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events - Create new event + categories + phases
router.post('/', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        
        // Ensure user is an approved organizer
        const { data: orgData } = await supabase
            .from('event_organizers')
            .select('id, is_verified')
            .eq('profile_id', userId)
            .single();

        if (!orgData) return res.status(403).json({ error: 'Perfil de organizador no encontrado' });
        
        const parsed = FullEventSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }

        const payload = parsed.data;

        // 1. Insert Event
        const eventData = {
            organizer_id: orgData.id,
            title: payload.title,
            sport: payload.sport,
            description: payload.description,
            event_date: payload.event_date,
            start_time: payload.start_time,
            end_time: payload.end_time,
            address: payload.address,
            city: payload.city,
            lat: payload.lat,
            lng: payload.lng,
            capacity: payload.capacity,
            image_url: payload.image_url,
            banner_url: payload.banner_url,
            slug: payload.slug,
            visibility: payload.visibility,
            registration_type: payload.registration_type,
            
            registration_deadline: payload.registration_deadline,
            payment_deadline: payload.payment_deadline,
            kit_deadline_platino: payload.kit_deadline_platino,
            kit_deadline_gold: payload.kit_deadline_gold,
            virtual_reg_start: payload.virtual_reg_start,
            virtual_reg_end: payload.virtual_reg_end,
            presential_reg_start: payload.presential_reg_start,
            presential_reg_end: payload.presential_reg_end,
            crossover_allowed: payload.crossover_allowed,
            free_package_every: payload.free_package_every,
            coach_discount_usd: payload.coach_discount_usd,
            companion_discount_usd: payload.companion_discount_usd,
            invited_schools: payload.invited_schools || [],

            payment_methods: payload.payment_methods || [],
            bank_data: payload.bank_data || {},
            referral_tracking_enabled: payload.referral_tracking_enabled,
            
            status: 'draft', // Created as draft
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newEvent, error: eventError } = await supabase
            .from('events')
            .insert(eventData)
            .select()
            .single();

        if (eventError) {
            req.log?.error({ err: eventError }, 'Error insertando evento');
            return res.status(500).json({ error: 'Error al crear el evento' });
        }

        // 2. Insert Categories
        if (payload.categories && Array.isArray(payload.categories) && payload.categories.length > 0) {
            const categoriesToInsert = payload.categories.map(c => ({
                event_id: newEvent.id,
                division: c.division || 'General',
                level: c.level || '1',
                category: c.category || 'Open',
                rama: c.rama || 'Mixto',
                min_age: c.min_age || 0,
                max_age: c.max_age || 99,
                min_athletes: c.min_athletes || 1,
                max_athletes: c.max_athletes || 50,
                base_price: c.base_price || 0
            }));
            await supabase.from('event_categories_config').insert(categoriesToInsert);
        }

        // 3. Insert Price Phases
        if (payload.price_phases && Array.isArray(payload.price_phases) && payload.price_phases.length > 0) {
            const phasesToInsert = payload.price_phases.map(p => ({
                event_id: newEvent.id,
                phase_name: p.phase_name,
                valid_until: p.valid_until,
                pkg_1_price: p.pkg_1_price || 0,
                pkg_2_price: p.pkg_2_price || 0,
                pkg_3_price: p.pkg_3_price || 0,
                pkg_solo_price: p.pkg_solo_price || 0,
                kit_type: p.kit_type || 'Basic',
                crossover_price: p.crossover_price || 0,
                deposit_percentage: p.deposit_percentage || 10
            }));
            await supabase.from('event_price_phases').insert(phasesToInsert);
        }

        return res.status(201).json(newEvent);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado creando evento');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/events/school-tournament — Crear torneo propiedad de una ESCUELA
// ------------------------------------------------------------------------------
// Endpoint aislado (NO reusa el POST '/' del organizador, que está desincronizado
// con el esquema real). Escribe contra las columnas reales de la DB:
//   events.creator_role='school', school_id, organizer_id=NULL.
// Gate: addon 'tournaments' (v_school_entitlements.has_tournaments).
// Mapeo de casos: interno=school_only, externo privado=invited_only, externo público=public.
// ─────────────────────────────────────────────────────────────────────────────
const SchoolTournamentSchema = z.object({
    title: z.string().min(1, 'El título es requerido'),
    sport: z.string().min(1, 'El deporte es requerido'),
    description: z.string().optional().nullable(),
    event_date: z.string().min(1, 'La fecha es requerida'),
    start_time: z.string().min(1, 'La hora de inicio es requerida'),
    end_time: z.string().optional().nullable(),
    address: z.string().min(1, 'La dirección es requerida'),
    city: z.string().min(1, 'La ciudad es requerida'),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    capacity: z.number().int().positive().optional(),
    image_url: z.string().optional().nullable(),
    banner_url: z.string().optional().nullable(),

    // Torneo de escuela
    tournament_scope: z.enum(['internal', 'external']),
    // Visibilidad real de la DB. Default según scope si no viene.
    visibility: z.enum(['public', 'invited_only', 'school_only']).optional(),
    registration_type: z.enum(['individual', 'delegation']).optional().default('delegation'),
    payer_mode: z.enum(['school', 'parent', 'flexible']).optional().default('school'),
    payment_gates_approval: z.boolean().optional().default(true),
    allow_individual_registration: z.boolean().optional().default(false),
    invited_schools: z.array(z.string().uuid()).optional(),

    registration_deadline: z.string().optional().nullable(),
    payment_deadline: z.string().optional().nullable(),
    correction_deadline: z.string().optional().nullable(),
    crossover_allowed: z.boolean().optional().default(false),
    payment_methods: z.array(z.string()).optional(),

    // Sub-recursos (columnas reales)
    categories: z.array(z.any()).optional(),
    price_phases: z.array(z.any()).optional(),
});

function slugifyTitle(title: string): string {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'torneo'}-${suffix}`;
}

router.post('/school-tournament', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const schoolId = req.schoolId;
        if (!schoolId) {
            return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        }

        // Gate: addon 'tournaments' activo para la escuela
        const { data: ent, error: entErr } = await supabase
            .from('v_school_entitlements')
            .select('has_tournaments')
            .eq('school_id', schoolId)
            .maybeSingle();
        if (entErr) {
            req.log?.error({ err: entErr }, 'Error consultando entitlements de torneos');
            return res.status(500).json({ error: 'Error verificando el módulo de torneos.' });
        }
        if (!ent?.has_tournaments) {
            return res.status(403).json({
                error: 'El módulo de Torneos no está activo para esta escuela.',
                hint: 'Actívalo desde Mi Plan.',
            });
        }

        const parsed = SchoolTournamentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        }
        const p = parsed.data;

        // Visibilidad por defecto según el alcance
        const visibility = p.visibility
            ?? (p.tournament_scope === 'internal' ? 'school_only' : 'public');

        // 1. Insert Event (columnas reales; creator_role='school', organizer_id NULL)
        const { data: newEvent, error: eventError } = await supabase
            .from('events')
            .insert({
                creator_id: userId,
                creator_role: 'school',
                school_id: schoolId,
                organizer_id: null,
                title: p.title,
                sport: p.sport,
                description: p.description ?? null,
                event_type: 'tournament',
                event_date: p.event_date,
                start_time: p.start_time,
                end_time: p.end_time ?? null,
                address: p.address,
                city: p.city,
                lat: p.lat ?? null,
                lng: p.lng ?? null,
                capacity: p.capacity ?? 50,
                image_url: p.image_url ?? null,
                banner_url: p.banner_url ?? null,
                slug: slugifyTitle(p.title),
                status: 'draft',
                tournament_scope: p.tournament_scope,
                visibility,
                registration_type: p.registration_type,
                payer_mode: p.payer_mode,
                payment_gates_approval: p.payment_gates_approval,
                allow_individual_registration: p.allow_individual_registration,
                invited_schools: p.invited_schools ?? [],
                registration_deadline: p.registration_deadline ?? null,
                payment_deadline: p.payment_deadline ?? null,
                correction_deadline: p.correction_deadline ?? null,
                crossover_allowed: p.crossover_allowed,
                payment_methods: p.payment_methods ?? [],
            })
            .select()
            .single();

        if (eventError) {
            req.log?.error({ err: eventError }, 'Error insertando torneo de escuela');
            return res.status(500).json({ error: 'Error al crear el torneo' });
        }

        // 2. Categorías (columnas reales: age_min/age_max/team_min/team_max)
        if (Array.isArray(p.categories) && p.categories.length > 0) {
            const rows = p.categories.map((c: any, i: number) => ({
                event_id: newEvent.id,
                division: c.division || 'General',
                level: c.level || '1',
                category: c.category || 'Open',
                rama: c.rama || 'Mixto',
                age_min: c.age_min ?? null,
                age_max: c.age_max ?? null,
                birth_year_min: c.birth_year_min ?? null,
                birth_year_max: c.birth_year_max ?? null,
                team_min: c.team_min ?? 10,
                team_max: c.team_max ?? 30,
                routine_max_seconds: c.routine_max_seconds ?? null,
                scoring_system: c.scoring_system ?? null,
                crossover_allowed: c.crossover_allowed ?? true,
                active: c.active ?? true,
                sort_order: c.sort_order ?? i,
            }));
            const { error: catErr } = await supabase.from('event_categories_config').insert(rows);
            if (catErr) req.log?.warn({ err: catErr }, 'Error insertando categorías (torneo creado igual)');
        }

        // 3. Fases de precio (columnas reales: price_pkg1.., deposit_percent)
        if (Array.isArray(p.price_phases) && p.price_phases.length > 0) {
            const rows = p.price_phases.map((ph: any, i: number) => ({
                event_id: newEvent.id,
                phase_name: ph.phase_name || `Fase ${i + 1}`,
                valid_until: ph.valid_until,
                kit_type: ph.kit_type || 'gold',
                deposit_percent: ph.deposit_percent ?? 30,
                price_pkg1: ph.price_pkg1 ?? 0,
                price_pkg2: ph.price_pkg2 ?? 0,
                price_pkg3: ph.price_pkg3 ?? 0,
                price_solo: ph.price_solo ?? 0,
                sort_order: ph.sort_order ?? i,
            }));
            const { error: phErr } = await supabase.from('event_price_phases').insert(rows);
            if (phErr) req.log?.warn({ err: phErr }, 'Error insertando fases de precio (torneo creado igual)');
        }

        return res.status(201).json(newEvent);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado creando torneo de escuela');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments — Torneos creados por la escuela (host)
router.get('/school-tournaments', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });

        const { data, error } = await supabase
            .from('events')
            .select(`
                id, title, sport, event_date, city, slug, status, visibility,
                tournament_scope, payer_mode, image_url, created_at,
                delegations:event_delegations(count)
            `)
            .eq('school_id', schoolId)
            .eq('creator_role', 'school')
            .order('created_at', { ascending: false });

        if (error) {
            req.log?.error({ err: error }, 'Error listando torneos de la escuela');
            return res.status(500).json({ error: 'Error al listar torneos' });
        }
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado listando torneos de escuela');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id — Detalle (dueño), cualquier status
router.get('/school-tournaments/:id', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;

        const { data, error } = await supabase
            .from('events')
            .select(`
                *,
                categories:event_categories_config(*),
                phases:event_price_phases(*),
                delegations:event_delegations(count)
            `)
            .eq('id', id)
            .eq('school_id', schoolId)
            .eq('creator_role', 'school')
            .maybeSingle();

        if (error) {
            req.log?.error({ err: error }, 'Error obteniendo torneo de escuela');
            return res.status(500).json({ error: 'Error al obtener el torneo' });
        }
        if (!data) return res.status(404).json({ error: 'Torneo no encontrado' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado obteniendo torneo de escuela');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/school-tournaments/:id/publish — Publicar (draft → active)
router.post('/school-tournaments/:id/publish', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;

        // Verificar propiedad + estado ANTERIOR (para no re-notificar si ya estaba activo)
        const { data: ev } = await supabase
            .from('events')
            .select('id, status')
            .eq('id', id)
            .eq('school_id', schoolId)
            .eq('creator_role', 'school')
            .maybeSingle();
        if (!ev) return res.status(404).json({ error: 'Torneo no encontrado' });
        const wasAlreadyActive = ev.status === 'active';

        const { data, error } = await supabase
            .from('events')
            .update({ status: 'active', registrations_open: true, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error publicando torneo de escuela');
            return res.status(500).json({ error: 'Error al publicar el torneo' });
        }

        if (!wasAlreadyActive && data.tournament_scope === 'internal') {
            notifySchoolFamilies(schoolId, {
                title: '🏆 Nuevo torneo/liga interna',
                message: `Ya podés inscribirte a "${data.title}".`,
                link: `/tournaments/${data.id}/register`,
                data: { eventId: data.id },
            }).catch((err) => req.log?.warn({ err }, 'Error notificando publicación de torneo'));
        }

        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado publicando torneo de escuela');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Helper: verifica que el torneo pertenezca a la escuela del usuario
async function assertOwnedSchoolTournament(eventId: string, schoolId: string): Promise<boolean> {
    const { data } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('school_id', schoolId)
        .eq('creator_role', 'school')
        .maybeSingle();
    return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificaciones de torneo interno — reusa el Despachador Unificado ya
// construido y validado (trigger → outbox → dispatcher): un INSERT en
// `notifications` es todo lo que hace falta para que push + correo salgan
// solos. Ver docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md Fase 5.
// ─────────────────────────────────────────────────────────────────────────────
async function notifyProfiles(
    profileIds: string[],
    payload: { title: string; message: string; link: string; data?: Record<string, any> },
): Promise<void> {
    const uniqueIds = Array.from(new Set(profileIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;
    const rows = uniqueIds.map((user_id) => ({
        user_id,
        title: payload.title,
        message: payload.message,
        type: 'info',
        category: 'tournament',
        link: payload.link,
        data: payload.data ?? {},
    }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.error('[events.route] Error notificando torneo:', error.message);
}

// Todos los padres/atletas activos de la escuela (audiencia de "se publicó el torneo").
async function notifySchoolFamilies(schoolId: string, payload: { title: string; message: string; link: string; data?: Record<string, any> }): Promise<void> {
    const { data: members } = await supabase
        .from('school_members')
        .select('profile_id')
        .eq('school_id', schoolId)
        .in('role', ['parent', 'athlete'])
        .eq('status', 'active');
    await notifyProfiles((members || []).map((m: any) => m.profile_id), payload);
}

// Los acudientes/atletas detrás de un conjunto de event_team_members (equipo
// asignado, resultado de partido) — resuelve profile_id directo o vía children.parent_id.
async function notifyTeamMembers(teamIds: string[], payload: { title: string; message: string; link: string; data?: Record<string, any> }): Promise<void> {
    if (teamIds.length === 0) return;
    const { data: members } = await supabase
        .from('event_team_members')
        .select('profile_id, child_id, children:child_id(parent_id)')
        .in('team_id', teamIds);
    const ids = (members || []).map((m: any) => m.profile_id || m.children?.parent_id).filter(Boolean);
    await notifyProfiles(ids, payload);
}

// PATCH /api/v1/events/school-tournaments/:id — editar campos básicos
const PatchTournamentSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    event_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().nullable().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    capacity: z.number().int().positive().nullable().optional(),
    visibility: z.enum(['public', 'invited_only', 'school_only']).optional(),
    payer_mode: z.enum(['school', 'parent', 'flexible']).optional(),
    payment_gates_approval: z.boolean().optional(),
    registration_deadline: z.string().nullable().optional(),
    payment_deadline: z.string().nullable().optional(),
    correction_deadline: z.string().nullable().optional(),
    crossover_allowed: z.boolean().optional(),
});
router.patch('/school-tournaments/:id', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;
        if (!(await assertOwnedSchoolTournament(String(id), schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const parsed = PatchTournamentSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

        const { data, error } = await supabase
            .from('events')
            .update({ ...parsed.data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('school_id', schoolId)
            .select()
            .single();
        if (error) { req.log?.error({ err: error }, 'Error editando torneo'); return res.status(500).json({ error: 'Error al editar el torneo' }); }
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado editando torneo');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/v1/events/school-tournaments/:id/categories — reemplaza categorías
router.put('/school-tournaments/:id/categories', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;
        if (!(await assertOwnedSchoolTournament(String(id), schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const cats = Array.isArray(req.body?.categories) ? req.body.categories : [];
        await supabase.from('event_categories_config').delete().eq('event_id', id);
        if (cats.length > 0) {
            const rows = cats.map((c: any, i: number) => ({
                event_id: id,
                division: c.division || 'General',
                level: c.level || '1',
                category: c.category || 'Open',
                rama: c.rama || 'Mixto',
                age_min: c.age_min ?? null,
                age_max: c.age_max ?? null,
                birth_year_min: c.birth_year_min ?? null,
                birth_year_max: c.birth_year_max ?? null,
                team_min: c.team_min ?? 1,
                team_max: c.team_max ?? 30,
                routine_max_seconds: c.routine_max_seconds ?? null,
                scoring_system: c.scoring_system ?? null,
                crossover_allowed: c.crossover_allowed ?? true,
                active: c.active ?? true,
                sort_order: c.sort_order ?? i,
            }));
            const { error } = await supabase.from('event_categories_config').insert(rows);
            if (error) { req.log?.error({ err: error }, 'Error guardando categorías'); return res.status(500).json({ error: 'Error al guardar categorías' }); }
        }
        const { data } = await supabase.from('event_categories_config').select('*').eq('event_id', id).order('sort_order');
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado guardando categorías');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/v1/events/school-tournaments/:id/price-phases — reemplaza fases de precio
router.put('/school-tournaments/:id/price-phases', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;
        if (!(await assertOwnedSchoolTournament(String(id), schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const phases = Array.isArray(req.body?.phases) ? req.body.phases : [];
        await supabase.from('event_price_phases').delete().eq('event_id', id);
        if (phases.length > 0) {
            const rows = phases.map((p: any, i: number) => ({
                event_id: id,
                phase_name: p.phase_name || `Fase ${i + 1}`,
                valid_until: p.valid_until,
                kit_type: p.kit_type || 'gold',
                deposit_percent: p.deposit_percent ?? 30,
                price_pkg1: p.price_pkg1 ?? 0,
                price_pkg2: p.price_pkg2 ?? 0,
                price_pkg3: p.price_pkg3 ?? 0,
                price_solo: p.price_solo ?? 0,
                sort_order: p.sort_order ?? i,
            }));
            const { error } = await supabase.from('event_price_phases').insert(rows);
            if (error) { req.log?.error({ err: error }, 'Error guardando fases'); return res.status(500).json({ error: 'Error al guardar fases de precio' }); }
        }
        const { data } = await supabase.from('event_price_phases').select('*').eq('event_id', id).order('sort_order');
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado guardando fases');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/delegations — inscritos + estado de pago
router.get('/school-tournaments/:id/delegations', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const { id } = req.params;
        if (!(await assertOwnedSchoolTournament(String(id), schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const { data, error } = await supabase
            .from('event_delegations')
            .select(`
                id, status, total_owed, total_paid, contact_name, contact_email,
                submitted_at, created_at,
                school:schools(id, name, city),
                teams:event_teams(count),
                members:event_team_members(count),
                payments:event_delegation_payments(id, amount, status, payment_method, proof_url, created_at)
            `)
            .eq('event_id', id)
            .order('created_at', { ascending: false });
        if (error) { req.log?.error({ err: error }, 'Error listando inscritos'); return res.status(500).json({ error: 'Error al listar inscritos' }); }
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado listando inscritos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/v1/events/school-tournaments/:id/delegations/:delId — aprobar/rechazar (host)
router.patch('/school-tournaments/:id/delegations/:delId', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const delId = String(req.params.delId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const action = req.body?.action as string;
        if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

        const { data: del } = await supabase
            .from('event_delegations')
            .select('id, status, total_owed, total_paid')
            .eq('id', delId).eq('event_id', eventId).maybeSingle();
        if (!del) return res.status(404).json({ error: 'Delegación no encontrada' });

        if (action === 'approve') {
            const { data: ev } = await supabase.from('events').select('payment_gates_approval').eq('id', eventId).single();
            if (ev?.payment_gates_approval && Number(del.total_paid || 0) < Number(del.total_owed || 0)) {
                return res.status(400).json({ error: 'La delegación no ha cubierto el pago. Registra el pago antes de aprobar (o desactiva el gate de pago).' });
            }
            const { data, error } = await supabase.from('event_delegations')
                .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', delId).select().single();
            if (error) return res.status(500).json({ error: 'Error al aprobar' });
            return res.status(200).json(data);
        }
        // reject
        const { data, error } = await supabase.from('event_delegations')
            .update({ status: 'rejected', rejection_reason: req.body?.rejection_reason ?? null, updated_at: new Date().toISOString() })
            .eq('id', delId).select().single();
        if (error) return res.status(500).json({ error: 'Error al rechazar' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado aprobando/rechazando delegación');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/school-tournaments/:id/delegations/:delId/record-payment — pago manual (host)
router.post('/school-tournaments/:id/delegations/:delId/record-payment', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const delId = String(req.params.delId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const amount = Number(req.body?.amount);
        const method = (req.body?.payment_method as string) || 'cash';
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        const { data: del } = await supabase
            .from('event_delegations')
            .select('id, school_id, total_paid')
            .eq('id', delId).eq('event_id', eventId).maybeSingle();
        if (!del) return res.status(404).json({ error: 'Delegación no encontrada' });

        // Registrar el pago (host-registrado = aprobado)
        const { error: payErr } = await supabase.from('event_delegation_payments').insert({
            delegation_id: delId, event_id: eventId, school_id: del.school_id,
            amount, currency: 'COP', payment_method: method, status: 'approved',
            reviewed_by: req.user!.id, reviewed_at: new Date().toISOString(),
            notes: req.body?.notes ?? null,
        });
        if (payErr) { req.log?.error({ err: payErr }, 'Error registrando pago'); return res.status(500).json({ error: 'Error al registrar el pago' }); }

        const newPaid = Number(del.total_paid || 0) + amount;
        const { data, error } = await supabase.from('event_delegations')
            .update({ total_paid: newPaid, updated_at: new Date().toISOString() })
            .eq('id', delId).select().single();
        if (error) return res.status(500).json({ error: 'Error al actualizar el saldo' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado registrando pago');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/:eventId/delegations/mine/payment — el PARTICIPANTE declara un pago (comprobante)
// Crea event_delegation_payments status='pending' para SU delegación; el host lo verifica luego.
router.post('/:eventId/delegations/mine/payment', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.eventId);

        const amount = Number(req.body?.amount);
        const method = (req.body?.payment_method as string) || 'transfer';
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        // La delegación de ESTA escuela en ESTE evento
        const { data: del } = await supabase
            .from('event_delegations')
            .select('id, school_id')
            .eq('event_id', eventId).eq('school_id', schoolId).maybeSingle();
        if (!del) return res.status(404).json({ error: 'No tienes una delegación inscrita en este torneo.' });

        const { data, error } = await supabase.from('event_delegation_payments').insert({
            delegation_id: del.id, event_id: eventId, school_id: schoolId,
            amount, currency: 'COP', payment_method: method, status: 'pending',
            proof_url: req.body?.proof_url ?? null, notes: req.body?.notes ?? null,
        }).select().single();
        if (error) { req.log?.error({ err: error }, 'Error registrando pago participante'); return res.status(500).json({ error: 'Error al registrar el pago' }); }
        return res.status(201).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado pago participante');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/v1/events/school-tournaments/:id/delegations/:delId/payments/:payId — host verifica/rechaza un pago
router.patch('/school-tournaments/:id/delegations/:delId/payments/:payId', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const delId = String(req.params.delId);
        const payId = String(req.params.payId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const action = req.body?.action as string;
        if (!['verify', 'reject'].includes(action)) return res.status(400).json({ error: 'Acción inválida' });

        const { data: pay } = await supabase
            .from('event_delegation_payments')
            .select('id, amount, status, delegation_id')
            .eq('id', payId).eq('event_id', eventId).eq('delegation_id', delId).maybeSingle();
        if (!pay) return res.status(404).json({ error: 'Pago no encontrado' });
        if (pay.status !== 'pending') return res.status(409).json({ error: 'Este pago ya fue procesado.' });

        if (action === 'reject') {
            const { data, error } = await supabase.from('event_delegation_payments')
                .update({ status: 'rejected', reviewed_by: req.user!.id, reviewed_at: new Date().toISOString(), rejection_reason: req.body?.rejection_reason ?? null, updated_at: new Date().toISOString() })
                .eq('id', payId).select().single();
            if (error) return res.status(500).json({ error: 'Error al rechazar el pago' });
            return res.status(200).json(data);
        }

        // verify → aprobar + sumar a total_paid
        const { error: upPayErr } = await supabase.from('event_delegation_payments')
            .update({ status: 'approved', reviewed_by: req.user!.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', payId).eq('status', 'pending');
        if (upPayErr) return res.status(500).json({ error: 'Error al verificar el pago' });

        const { data: del } = await supabase.from('event_delegations').select('total_paid').eq('id', delId).single();
        const newPaid = Number(del?.total_paid || 0) + Number(pay.amount);
        const { data, error } = await supabase.from('event_delegations')
            .update({ total_paid: newPaid, updated_at: new Date().toISOString() })
            .eq('id', delId).select().single();
        if (error) return res.status(500).json({ error: 'Error al actualizar el saldo' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado verificando pago');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Inscripción individual a torneos/ligas INTERNAS (padre/atleta) — Fase 2 de
// docs/specs/torneos-internos-inscripcion-pago-2026-09-01.md. Estos 4 endpoints
// son los únicos de este archivo que NO usan `req.schoolId` (la escuela sale
// del torneo, no de quién llama) y usan `userClient(req)` porque las RPCs que
// invocan autorizan con `auth.uid()`.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/events/school-tournaments/:id/for-participant — info + mi inscripción (padre/atleta)
router.get('/school-tournaments/:id/for-participant', requireAuth, requireRole('parent', 'athlete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const eventId = String(req.params.id);
        const client = userClient(req);

        const { data: ev, error: evErr } = await client
            .from('events')
            .select(`
                id, title, sport, city, event_date, status, tournament_scope, registrations_open, school_id,
                categories:event_categories_config(id, division, level, category, rama, age_min, age_max, active),
                phases:event_price_phases(id, phase_name, valid_until, price_solo)
            `)
            .eq('id', eventId)
            .eq('tournament_scope', 'internal')
            .maybeSingle();
        if (evErr) { req.log?.error({ err: evErr }, 'Error obteniendo torneo para participante'); return res.status(500).json({ error: 'Error al obtener el torneo' }); }
        if (!ev) return res.status(404).json({ error: 'Torneo no encontrado' });

        const { data: myRegs } = await client
            .from('event_registrations')
            .select('id, category_id, child_id, participant_name, status, payment_id, payment:payment_id(status, amount, due_date)')
            .eq('event_id', eventId)
            .neq('status', 'cancelled');

        return res.status(200).json({ ...ev, my_registrations: myRegs || [] });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado obteniendo torneo para participante');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/my-open-tournaments — torneos/ligas internas ABIERTAS en las
// escuelas donde el caller es padre/atleta activo (tarjeta del Dashboard).
router.get('/my-open-tournaments', requireAuth, requireRole('parent', 'athlete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const client = userClient(req);
        const { data: memberships } = await client
            .from('school_members')
            .select('school_id')
            .in('role', ['parent', 'athlete'])
            .eq('status', 'active');
        const schoolIds = Array.from(new Set((memberships || []).map((m: any) => m.school_id)));
        if (schoolIds.length === 0) return res.status(200).json([]);

        const { data, error } = await client
            .from('events')
            .select('id, title, sport, city, event_date, school:school_id(name)')
            .in('school_id', schoolIds)
            .eq('tournament_scope', 'internal')
            .eq('status', 'active')
            .eq('registrations_open', true)
            .order('event_date', { ascending: true });
        if (error) { req.log?.error({ err: error }, 'Error listando torneos abiertos'); return res.status(500).json({ error: 'Error al listar torneos' }); }
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado listando torneos abiertos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/school-tournaments/:id/register — inscribirse (padre por su hijo, o atleta por sí mismo)
const RegisterInternalSchema = z.object({
    category_id: z.string().uuid(),
    child_id: z.string().uuid().optional().nullable(),
});
router.post('/school-tournaments/:id/register', requireAuth, requireRole('parent', 'athlete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const eventId = String(req.params.id);
        const parsed = RegisterInternalSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

        const client = userClient(req);
        const { data: registrationId, error } = await client.rpc('register_for_internal_tournament', {
            p_event_id: eventId,
            p_category_id: parsed.data.category_id,
            p_child_id: parsed.data.child_id ?? null,
        });
        if (error) {
            req.log?.warn({ err: error }, 'register_for_internal_tournament rechazó la inscripción');
            return res.status(400).json({ error: error.message });
        }
        return res.status(201).json({ registration_id: registrationId });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado inscribiendo a torneo interno');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/individual-registrations — bandeja de la escuela (reemplaza "delegaciones" cuando isInternal)
router.get('/school-tournaments/:id/individual-registrations', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const { data, error } = await supabase
            .from('event_registrations')
            .select(`
                id, participant_name, participant_role, category_id, status, team_id, created_at,
                payment:payment_id(id, status, amount, due_date),
                team:team_id(id, team_name)
            `)
            .eq('event_id', eventId)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
        if (error) { req.log?.error({ err: error }, 'Error listando inscripciones individuales'); return res.status(500).json({ error: 'Error al listar inscritos' }); }
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado listando inscripciones individuales');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/school-tournaments/:id/categories/:catId/assign-teams — la escuela reparte inscritos en equipos
const AssignTeamsSchema = z.object({
    assignments: z.array(z.object({
        team_name: z.string().min(1),
        registration_ids: z.array(z.string().uuid()),
    })),
});
router.post('/school-tournaments/:id/categories/:catId/assign-teams', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const catId = String(req.params.catId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const parsed = AssignTeamsSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });

        const client = userClient(req);
        const { data, error } = await client.rpc('assign_registrants_to_teams', {
            p_event_id: eventId,
            p_category_id: catId,
            p_assignments: parsed.data.assignments,
        });
        if (error) { req.log?.warn({ err: error }, 'assign_registrants_to_teams rechazó el armado'); return res.status(400).json({ error: error.message }); }

        // Solo los recién asignados EN ESTA llamada (no todo el roster del
        // equipo) — evita renotificar a quien ya estaba desde antes.
        const notifyIds = Array.isArray(data?.notified_profile_ids) ? data.notified_profile_ids : [];
        notifyProfiles(notifyIds, {
            title: '⚽ Ya tenés equipo asignado',
            message: 'La escuela ya armó los equipos de tu categoría — revisá tus partidos.',
            link: `/tournaments/${eventId}/register`,
            data: { eventId },
        }).catch((err) => req.log?.warn({ err }, 'Error notificando armado de equipos'));

        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado armando equipos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/category-templates?sport=xxx — sugerencias de categorías por deporte
router.get('/category-templates', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sport = String(req.query.sport || '').trim().toLowerCase();
        if (!sport) return res.status(200).json([]);
        const { data, error } = await supabase
            .from('sport_category_templates')
            .select('sport, archetype, division, category, rama, level, age_min, age_max, team_min, team_max, sort_order')
            .eq('is_active', true)
            .ilike('sport', sport)
            .order('sort_order');
        if (error) { req.log?.error({ err: error }, 'Error plantillas de categorías'); return res.status(500).json({ error: 'Error al cargar plantillas' }); }
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado plantillas de categorías');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/:id/enroll-info — datos para inscribir (participante)
router.get('/:id/enroll-info', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const eventId = String(req.params.id);
        const { data, error } = await supabase
            .from('events')
            .select(`
                id, title, sport, city, address, event_date, status, visibility, tournament_scope,
                registrations_open, registration_deadline, payer_mode, crossover_allowed,
                categories:event_categories_config(*),
                phases:event_price_phases(*)
            `)
            .eq('id', eventId)
            .maybeSingle();
        if (error) { req.log?.error({ err: error }, 'Error enroll-info'); return res.status(500).json({ error: 'Error al cargar el torneo' }); }
        if (!data) return res.status(404).json({ error: 'Torneo no encontrado' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado enroll-info');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/school-tournaments/:id/enroll — inscribir delegación (participante)
// Escuela participante (req.schoolId) inscribe su delegación en un torneo externo publicado.
// Correcto contra el esquema real: event_delegations.total_owed/total_paid, event_teams,
// event_team_members(full_name/document_number/birth_year). Idempotente: re-enviar reemplaza roster.
const EnrollSchema = z.object({
    price_phase_id: z.string().uuid().optional().nullable(),
    contact_name: z.string().optional().nullable(),
    contact_email: z.string().optional().nullable(),
    contact_phone: z.string().optional().nullable(),
    whatsapp: z.string().optional().nullable(),
    teams: z.array(z.object({
        category_id: z.string().uuid().optional().nullable(),
        team_name: z.string().min(1, 'Nombre de equipo requerido'),
        package_type: z.enum(['pkg1', 'pkg2', 'pkg3', 'solo']).optional().default('solo'),
        accommodation: z.enum(['cuadruple', 'triple', 'doble', 'sencilla']).optional().default('cuadruple'),
        members: z.array(z.object({
            full_name: z.string().min(1),
            document_number: z.string().optional().nullable(),
            birth_year: z.number().int().optional().nullable(),
            shirt_size: z.string().optional().nullable(),
            profile_id: z.string().uuid().optional().nullable(),
            child_id: z.string().uuid().optional().nullable(),
        })).optional().default([]),
    })).min(1, 'Agrega al menos un equipo'),
});

function priceForPackage(phase: any, pkg: string): number {
    if (!phase) return 0;
    switch (pkg) {
        case 'pkg1': return Number(phase.price_pkg1 || 0);
        case 'pkg2': return Number(phase.price_pkg2 || 0);
        case 'pkg3': return Number(phase.price_pkg3 || 0);
        default: return Number(phase.price_solo || 0);
    }
}

router.post('/school-tournaments/:id/enroll', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);

        // 1. Evento válido para inscripción
        const { data: ev } = await supabase
            .from('events')
            .select('id, status, tournament_scope, visibility, registrations_open, invited_schools')
            .eq('id', eventId)
            .maybeSingle();
        if (!ev) return res.status(404).json({ error: 'Torneo no encontrado' });
        if (ev.tournament_scope === 'internal') return res.status(400).json({ error: 'Un torneo interno no admite inscripción de delegaciones externas.' });
        if (ev.status !== 'active' || ev.registrations_open === false) return res.status(400).json({ error: 'Las inscripciones no están abiertas.' });
        if (ev.visibility === 'invited_only' && !(ev.invited_schools || []).includes(schoolId)) {
            return res.status(403).json({ error: 'Este torneo es solo por invitación.' });
        }

        const parsed = EnrollSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
        const p = parsed.data;

        // 2. Fase de precio (la indicada o la primera vigente por fecha)
        const { data: phases } = await supabase
            .from('event_price_phases')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order');
        let phase = null as any;
        if (p.price_phase_id) phase = (phases || []).find((x) => x.id === p.price_phase_id) || null;
        if (!phase) {
            const today = todayInZone();
            phase = (phases || []).find((x) => x.valid_until >= today) || (phases || [])[0] || null;
        }

        // 3. Delegación (upsert por event_id+school_id — UNIQUE)
        const { data: existing } = await supabase
            .from('event_delegations')
            .select('id, status')
            .eq('event_id', eventId)
            .eq('school_id', schoolId)
            .maybeSingle();

        let delegationId: string;
        if (existing) {
            if (['confirmed', 'closed'].includes(existing.status)) {
                return res.status(409).json({ error: 'Tu delegación ya fue confirmada; no se puede reeditar.' });
            }
            delegationId = existing.id;
            // Reemplazar roster previo (cascade borra members)
            await supabase.from('event_teams').delete().eq('delegation_id', delegationId);
        } else {
            const { data: del, error: delErr } = await supabase
                .from('event_delegations')
                .insert({
                    event_id: eventId, school_id: schoolId, status: 'draft',
                    price_phase_id: phase?.id ?? null,
                    contact_name: p.contact_name ?? null, contact_email: p.contact_email ?? null,
                    contact_phone: p.contact_phone ?? null, whatsapp: p.whatsapp ?? null,
                    total_owed: 0, total_paid: 0,
                })
                .select('id')
                .single();
            if (delErr || !del) { req.log?.error({ err: delErr }, 'Error creando delegación'); return res.status(500).json({ error: 'Error al crear la delegación' }); }
            delegationId = del.id;
        }

        // 4. Equipos + integrantes; acumular total
        let totalOwed = 0;
        for (const team of p.teams) {
            const unitPrice = priceForPackage(phase, team.package_type);
            totalOwed += unitPrice;
            const { data: teamRow, error: teamErr } = await supabase
                .from('event_teams')
                .insert({
                    delegation_id: delegationId, event_id: eventId,
                    category_id: team.category_id ?? null, team_name: team.team_name,
                    package_type: team.package_type, accommodation: team.accommodation,
                    status: 'submitted', locked_price: unitPrice,
                })
                .select('id')
                .single();
            if (teamErr || !teamRow) { req.log?.error({ err: teamErr }, 'Error creando equipo'); return res.status(500).json({ error: 'Error al crear equipo' }); }

            if (team.members.length > 0) {
                const memberRows = team.members.map((m) => ({
                    team_id: teamRow.id, delegation_id: delegationId,
                    full_name: m.full_name, document_number: m.document_number ?? null,
                    birth_year: m.birth_year ?? null, shirt_size: m.shirt_size ?? null,
                    profile_id: m.profile_id ?? null, child_id: m.child_id ?? null,
                }));
                const { error: memErr } = await supabase.from('event_team_members').insert(memberRows);
                if (memErr) { req.log?.error({ err: memErr }, 'Error creando integrantes'); return res.status(500).json({ error: 'Error al crear integrantes' }); }
            }
        }

        // 5. Actualizar delegación: total + estado submitted
        const { data: finalDel, error: updErr } = await supabase
            .from('event_delegations')
            .update({
                total_owed: totalOwed, status: 'submitted', submitted_at: new Date().toISOString(),
                price_phase_id: phase?.id ?? null,
                contact_name: p.contact_name ?? undefined, contact_email: p.contact_email ?? undefined,
                contact_phone: p.contact_phone ?? undefined, whatsapp: p.whatsapp ?? undefined,
                updated_at: new Date().toISOString(),
            })
            .eq('id', delegationId)
            .select()
            .single();
        if (updErr) { req.log?.error({ err: updErr }, 'Error finalizando delegación'); return res.status(500).json({ error: 'Error al finalizar la inscripción' }); }

        return res.status(201).json(finalDel);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado inscribiendo delegación');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ── Resultados de torneo (Liga) ──────────────────────────────────────────────
// Round-robin (método del círculo). Devuelve jornadas → pares [local, visitante].
function roundRobinRounds(ids: string[]): Array<Array<[string, string]>> {
    const teams: (string | null)[] = [...ids];
    if (teams.length % 2 !== 0) teams.push(null); // bye
    const n = teams.length;
    const rounds: Array<Array<[string, string]>> = [];
    for (let r = 0; r < n - 1; r++) {
        const pairs: Array<[string, string]> = [];
        for (let i = 0; i < n / 2; i++) {
            const a = teams[i], b = teams[n - 1 - i];
            if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]); // alterna localía
        }
        rounds.push(pairs);
        teams.splice(1, 0, teams.pop()!); // rota dejando el primero fijo
    }
    return rounds;
}

// Copa: avanza el ganador de (round,slot) a la ronda siguiente (slot padre = ceil(slot/2); local si slot impar).
async function advanceWinner(eventId: string, catId: string, round: number, slot: number, winnerId: string) {
    const parentSlot = Math.ceil(slot / 2);
    const isHome = slot % 2 === 1;
    const { data: parent } = await supabase.from('tournament_matches')
        .select('id').eq('event_id', eventId).eq('category_id', catId).eq('round', round + 1).eq('slot', parentSlot).maybeSingle();
    if (!parent) return;
    await supabase.from('tournament_matches')
        .update(isHome ? { home_team_id: winnerId } : { away_team_id: winnerId })
        .eq('id', parent.id);
}
// Copa: los partidos de ronda 1 con un solo equipo (bye) avanzan automáticamente.
async function advanceByes(eventId: string, catId: string) {
    const { data: r1 } = await supabase.from('tournament_matches')
        .select('id, slot, home_team_id, away_team_id').eq('event_id', eventId).eq('category_id', catId).eq('round', 1);
    for (const m of (r1 || [])) {
        const h = m.home_team_id as string | null, a = m.away_team_id as string | null;
        if (h && !a) { await supabase.from('tournament_matches').update({ status: 'walkover', home_score: 1, away_score: 0 }).eq('id', m.id); await advanceWinner(eventId, catId, 1, m.slot, h); }
        else if (!h && a) { await supabase.from('tournament_matches').update({ status: 'walkover', home_score: 0, away_score: 1 }).eq('id', m.id); await advanceWinner(eventId, catId, 1, m.slot, a); }
    }
}

// POST /api/v1/events/school-tournaments/:id/categories/:catId/generate-fixtures
router.post('/school-tournaments/:id/categories/:catId/generate-fixtures', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const catId = String(req.params.catId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const { data: teams } = await supabase
            .from('event_teams')
            .select('id')
            .eq('event_id', eventId).eq('category_id', catId)
            .neq('status', 'rejected');
        const ids = (teams || []).map((t) => t.id);
        if (ids.length < 2) return res.status(400).json({ error: 'Se necesitan al menos 2 equipos en la categoría.' });

        const format = (req.body?.format as string) === 'copa' ? 'copa' : 'liga';
        // Borrar partidos aún no jugados de esta categoría (regenerar)
        await supabase.from('tournament_matches').delete().eq('event_id', eventId).eq('category_id', catId).eq('status', 'scheduled');

        const rows: any[] = [];
        if (format === 'liga') {
            const rounds = roundRobinRounds(ids);
            rounds.forEach((pairs, ri) => pairs.forEach((pair, si) => rows.push({
                event_id: eventId, category_id: catId, round: ri + 1, slot: si + 1,
                home_team_id: pair[0], away_team_id: pair[1], status: 'scheduled',
            })));
        } else {
            // Copa: eliminación simple. Sembrar a potencia de 2 con byes (1vsN, 2vsN-1…).
            let size = 1; while (size < ids.length) size *= 2;
            const seeded: (string | null)[] = [...ids];
            while (seeded.length < size) seeded.push(null);
            const totalRounds = Math.round(Math.log2(size));
            for (let i = 0; i < size / 2; i++) {
                rows.push({ event_id: eventId, category_id: catId, round: 1, slot: i + 1, home_team_id: seeded[i], away_team_id: seeded[size - 1 - i], status: 'scheduled' });
            }
            for (let r = 2; r <= totalRounds; r++) {
                const count = size / Math.pow(2, r);
                for (let s = 0; s < count; s++) rows.push({ event_id: eventId, category_id: catId, round: r, slot: s + 1, home_team_id: null, away_team_id: null, status: 'scheduled' });
            }
        }
        if (rows.length > 0) {
            const { error } = await supabase.from('tournament_matches').insert(rows);
            if (error) { req.log?.error({ err: error }, 'Error generando fixtures'); return res.status(500).json({ error: 'Error al generar el calendario' }); }
        }
        await supabase.from('events').update({ competition_format: format, updated_at: new Date().toISOString() }).eq('id', eventId);
        if (format === 'copa') await advanceByes(eventId, catId);
        return res.status(201).json({ matches: rows.length, format });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado generando fixtures');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/matches?category_id=
router.get('/school-tournaments/:id/matches', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        let q = supabase.from('tournament_matches')
            .select('id, category_id, round, slot, home_team_id, away_team_id, home_score, away_score, status, scheduled_at, home:home_team_id(team_name), away:away_team_id(team_name)')
            .eq('event_id', eventId).order('round').order('slot');
        if (req.query.category_id) q = q.eq('category_id', String(req.query.category_id));
        const { data, error } = await q;
        if (error) return res.status(500).json({ error: 'Error al listar partidos' });
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado listando partidos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/v1/events/school-tournaments/:id/matches/:matchId — cargar resultado
router.patch('/school-tournaments/:id/matches/:matchId', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const matchId = String(req.params.matchId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const hs = Number(req.body?.home_score);
        const as = Number(req.body?.away_score);
        if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) return res.status(400).json({ error: 'Marcador inválido' });

        const { data: match } = await supabase.from('tournament_matches')
            .select('id, round, slot, category_id, home_team_id, away_team_id')
            .eq('id', matchId).eq('event_id', eventId).maybeSingle();
        if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

        const { data, error } = await supabase.from('tournament_matches')
            .update({ home_score: hs, away_score: as, status: 'played', updated_at: new Date().toISOString() })
            .eq('id', matchId).select().single();
        if (error) return res.status(500).json({ error: 'Error al guardar el resultado' });

        // Copa: avanzar al ganador a la ronda siguiente (empates no avanzan)
        const { data: evFmt } = await supabase.from('events').select('competition_format').eq('id', eventId).single();
        if (evFmt?.competition_format === 'copa' && hs !== as && match.category_id) {
            const winner = hs > as ? match.home_team_id : match.away_team_id;
            if (winner) await advanceWinner(eventId, String(match.category_id), match.round, match.slot, winner as string);
        }

        // Goles opcionales: [{ team_id, member_id?, minute? }]
        const goals = Array.isArray(req.body?.goals) ? req.body.goals : [];
        if (goals.length > 0) {
            await supabase.from('tournament_match_events').delete().eq('match_id', matchId).eq('type', 'goal');
            const rows = goals.filter((g: any) => g.team_id).map((g: any) => ({
                match_id: matchId, event_id: eventId, team_id: g.team_id,
                member_id: g.member_id ?? null, type: 'goal', minute: g.minute ?? null,
            }));
            if (rows.length > 0) await supabase.from('tournament_match_events').insert(rows);
        }

        const resultTeamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
        notifyTeamMembers(resultTeamIds, {
            title: '📣 Resultado del partido',
            message: `${hs} - ${as} — ya podés verlo y compartirlo.`,
            link: `/tournaments/${eventId}/results`,
            data: { eventId, matchId },
        }).catch((err) => req.log?.warn({ err }, 'Error notificando resultado de partido'));

        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado guardando resultado');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/matches/:matchId/rosters — jugadores de los 2 equipos (goleadores)
router.get('/school-tournaments/:id/matches/:matchId/rosters', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const matchId = String(req.params.matchId);
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        const { data: m } = await supabase.from('tournament_matches')
            .select('home_team_id, away_team_id, home:home_team_id(team_name), away:away_team_id(team_name)')
            .eq('id', matchId).eq('event_id', eventId).maybeSingle();
        if (!m) return res.status(404).json({ error: 'Partido no encontrado' });

        const teamIds = [m.home_team_id, m.away_team_id].filter(Boolean) as string[];
        const { data: members } = teamIds.length
            ? await supabase.from('event_team_members').select('id, full_name, team_id').in('team_id', teamIds)
            : { data: [] as any[] };

        const byTeam = (tid: string | null) => (members || []).filter((x: any) => x.team_id === tid).map((x: any) => ({ id: x.id, full_name: x.full_name }));
        return res.status(200).json({
            home: { team_id: m.home_team_id, team_name: (m as any).home?.team_name ?? null, members: byTeam(m.home_team_id) },
            away: { team_id: m.away_team_id, team_name: (m as any).away?.team_name ?? null, members: byTeam(m.away_team_id) },
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado rosters de partido');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/standings?category_id= — tabla + goleadores
router.get('/school-tournaments/:id/standings', requireAuth, requireRole('school', 'school_admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const schoolId = req.schoolId;
        if (!schoolId) return res.status(403).json({ error: 'No se pudo resolver la escuela del usuario.' });
        const eventId = String(req.params.id);
        const catId = req.query.category_id ? String(req.query.category_id) : null;
        if (!(await assertOwnedSchoolTournament(eventId, schoolId))) return res.status(404).json({ error: 'Torneo no encontrado' });

        // Equipos de la categoría
        let teamsQ = supabase.from('event_teams').select('id, team_name').eq('event_id', eventId).neq('status', 'rejected');
        if (catId) teamsQ = teamsQ.eq('category_id', catId);
        const { data: teams } = await teamsQ;
        const table: Record<string, any> = {};
        (teams || []).forEach((t) => { table[t.id] = { team_id: t.id, team_name: t.team_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }; });

        // Partidos jugados
        let mQ = supabase.from('tournament_matches').select('home_team_id, away_team_id, home_score, away_score').eq('event_id', eventId).eq('status', 'played');
        if (catId) mQ = mQ.eq('category_id', catId);
        const { data: matches } = await mQ;
        (matches || []).forEach((m) => {
            const h = table[m.home_team_id!], a = table[m.away_team_id!];
            if (!h || !a) return;
            const hs = Number(m.home_score), as = Number(m.away_score);
            h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
            if (hs > as) { h.W++; a.L++; h.Pts += 3; }
            else if (hs < as) { a.W++; h.L++; a.Pts += 3; }
            else { h.D++; a.D++; h.Pts++; a.Pts++; }
        });
        const standings = Object.values(table).map((r: any) => ({ ...r, GD: r.GF - r.GA }))
            .sort((a: any, b: any) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);

        // Goleadores
        let gQ = supabase.from('tournament_match_events').select('member_id, team_id, scorer:member_id(full_name)').eq('event_id', eventId).eq('type', 'goal');
        if (catId) gQ = gQ; // los goles ya cuelgan del evento; filtrar por categoría requeriría join a match — se omite en MVP
        const { data: goals } = await gQ;
        const scorerMap: Record<string, any> = {};
        (goals || []).forEach((g: any) => {
            const key = g.member_id || 'sin';
            if (!scorerMap[key]) scorerMap[key] = { member_id: g.member_id, name: g.scorer?.full_name ?? 'Sin registrar', goals: 0 };
            scorerMap[key].goals++;
        });
        const scorers = Object.values(scorerMap).sort((a: any, b: any) => b.goals - a.goals).slice(0, 20);

        return res.status(200).json({ standings, scorers });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado calculando tabla');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/school-tournaments/:id/public-results — SIN LOGIN, para compartir
// por correo/WhatsApp (link abierto, mismo patrón que /event/:slug público).
// Solo lectura de datos ya públicos por diseño (tabla de posiciones y goleadores);
// no expone nada de pagos ni datos de contacto.
router.get('/school-tournaments/:id/public-results', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const eventId = String(req.params.id);
        const catId = req.query.category_id ? String(req.query.category_id) : null;

        const { data: ev } = await supabase
            .from('events')
            .select('id, title, sport, city, event_date, tournament_scope, school:school_id(name)')
            .eq('id', eventId)
            .maybeSingle();
        if (!ev) return res.status(404).json({ error: 'Torneo no encontrado' });

        let teamsQ = supabase.from('event_teams').select('id, team_name').eq('event_id', eventId).neq('status', 'rejected');
        if (catId) teamsQ = teamsQ.eq('category_id', catId);
        const { data: teams } = await teamsQ;
        const table: Record<string, any> = {};
        (teams || []).forEach((t) => { table[t.id] = { team_id: t.id, team_name: t.team_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 }; });

        let mQ = supabase.from('tournament_matches').select('home_team_id, away_team_id, home_score, away_score').eq('event_id', eventId).eq('status', 'played');
        if (catId) mQ = mQ.eq('category_id', catId);
        const { data: matches } = await mQ;
        (matches || []).forEach((m) => {
            const h = table[m.home_team_id!], a = table[m.away_team_id!];
            if (!h || !a) return;
            const hs = Number(m.home_score), as = Number(m.away_score);
            h.P++; a.P++; h.GF += hs; h.GA += as; a.GF += as; a.GA += hs;
            if (hs > as) { h.W++; a.L++; h.Pts += 3; }
            else if (hs < as) { a.W++; h.L++; a.Pts += 3; }
            else { h.D++; a.D++; h.Pts++; a.Pts++; }
        });
        const standings = Object.values(table).map((r: any) => ({ ...r, GD: r.GF - r.GA }))
            .sort((a: any, b: any) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);

        return res.status(200).json({
            title: ev.title, sport: ev.sport, city: ev.city, event_date: ev.event_date,
            school_name: (ev as any).school?.name ?? null,
            standings,
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado obteniendo resultados públicos');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/:id/preview - Full event data for preview
router.get('/:id/preview', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Verify ownership
        const { data: orgData } = await supabase.from('event_organizers').select('id').eq('profile_id', userId).single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select(`
                *,
                categories:event_categories_config(*),
                phases:event_price_phases(*)
            `)
            .eq('id', id)
            .eq('organizer_id', orgData.id)
            .single();

        if (eventError || !event) return res.status(404).json({ error: 'Evento no encontrado' });

        return res.status(200).json(event);
    } catch (err: any) {
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/:id/publish - Publish event
router.post('/:id/publish', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const { data: orgData } = await supabase.from('event_organizers').select('id, is_verified').eq('profile_id', userId).single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });
        
        if (!orgData.is_verified) {
           return res.status(400).json({ error: 'Debes estar verificado para publicar eventos' });
        }

        const { data, error } = await supabase
            .from('events')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organizer_id', orgData.id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: 'Error publicando el evento' });

        return res.status(200).json(data);
    } catch (err: any) {
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/:id/enroll - Creates delegation, teams, athletes, and logs package choices
router.post('/:id/enroll', requireAuth, requireRole('school'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const payload = req.body;

        // payload structure expected:
        // { teams: [ { id, category_id, athletes: [ { id, package_id } ] } ], coaches: [ { id, package_id } ] }

        // Find school associated with user
        const { data: school } = await supabase.from('schools').select('id').eq('admin_user_id', userId).single();
        if (!school) return res.status(403).json({ error: 'Escuela no encontrada' });

        // 1. Check if delegation already exists
        let delegationId;
        const { data: existingDelegation } = await supabase
            .from('event_delegations')
            .select('id')
            .eq('event_id', id)
            .eq('school_id', school.id)
            .single();

        if (existingDelegation) {
            delegationId = existingDelegation.id;
        } else {
            // Create delegation
            const { data: newDelegation, error: delError } = await supabase
                .from('event_delegations')
                .insert({
                    event_id: id,
                    school_id: school.id,
                    status: 'draft',
                    total_amount: 0,
                    paid_amount: 0
                })
                .select().single();
            if (delError) throw delError;
            delegationId = newDelegation.id;
        }

        // 2. We can lock the price phase or calculate immediately using RPC calculate_delegation_balance 
        // For simplicity, we just save the teams and their members.
        
        // This is a complex transactional save. In production we'd do a stored procedure or use Edge Functions.
        // For this demo, let's insert the teams.
        for (const team of payload.teams) {
            // Check if team exists in event_teams
            const { data: eTeam } = await supabase.from('event_teams').insert({
                delegation_id: delegationId,
                category_id: team.category_id,
                team_name: team.name // from school_teams or provided
            }).select().single();

            if (eTeam && team.athletes) {
                const athletesInsert = team.athletes.map((a: any) => ({
                    event_team_id: eTeam.id,
                    athlete_id: a.id,
                    package_id: a.package_id
                }));
                if (athletesInsert.length > 0) {
                   await supabase.from('event_team_members').insert(athletesInsert);
                }
            }
        }

        if (payload.coaches && payload.coaches.length > 0) {
            const coachesInsert = payload.coaches.map((c: any) => ({
                delegation_id: delegationId,
                coach_id: c.id,
                package_id: c.package_id
            }));
            await supabase.from('event_team_coaches').insert(coachesInsert);
        }

        // 3. Call calculate_delegation_balance via RPC
        const { data: finalBalance, error: balanceError } = await supabase.rpc('calculate_delegation_balance', { p_delegation_id: delegationId });
        
        if (balanceError) console.error('Balance error', balanceError);

        return res.status(200).json({ delegationId, finalBalance });

    } catch (err: any) {
        req.log?.error({ err }, 'Error inesperado guardando enrolamiento');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PUT /api/v1/events/:id - Update event details
router.put('/:id', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const { data: orgData } = await supabase.from('event_organizers').select('id').eq('profile_id', userId).single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const allowedFields = [
            'title', 'sport', 'description', 'event_date', 'start_time', 'end_time',
            'address', 'city', 'lat', 'lng', 'capacity', 'image_url', 'banner_url',
            'visibility', 'registration_type', 'registration_deadline', 'payment_deadline',
            'crossover_allowed', 'free_package_every', 'coach_discount_usd', 'companion_discount_usd',
            'payment_methods', 'registrations_open'
        ];

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const key of allowedFields) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const { data, error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', id)
            .eq('organizer_id', orgData.id)
            .select()
            .single();

        if (error || !data) return res.status(404).json({ error: 'Evento no encontrado o sin permisos' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error actualizando evento');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/v1/events/:id/status - Change event status with validation
router.patch('/:id/status', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const { status } = req.body;

        const validTransitions: Record<string, string[]> = {
            draft: ['published', 'cancelled'],
            published: ['closed', 'cancelled'],
            closed: ['completed', 'published'],
            cancelled: ['draft'],
            completed: []
        };

        const { data: orgData } = await supabase
            .from('event_organizers')
            .select('id, is_verified')
            .eq('profile_id', userId)
            .single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const { data: event } = await supabase
            .from('events')
            .select('status')
            .eq('id', id)
            .eq('organizer_id', orgData.id)
            .single();
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const allowed = validTransitions[event.status] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({ error: `No se puede cambiar de "${event.status}" a "${status}"` });
        }

        if (status === 'published' && !orgData.is_verified) {
            return res.status(400).json({ error: 'Debes estar verificado para publicar eventos' });
        }

        const updateData: Record<string, any> = { status, updated_at: new Date().toISOString() };
        if (status === 'published') updateData.registrations_open = true;
        if (status === 'closed' || status === 'cancelled') updateData.registrations_open = false;

        const { data, error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', id)
            .eq('organizer_id', orgData.id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: 'Error cambiando estado del evento' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error cambiando status del evento');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/:id/delegations - Get delegations for an event
router.get('/:id/delegations', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        const { data: orgData } = await supabase.from('event_organizers').select('id').eq('profile_id', userId).single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const { data: event } = await supabase.from('events').select('id').eq('id', id).eq('organizer_id', orgData.id).single();
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const { data: delegations, error } = await supabase
            .from('event_delegations')
            .select('id, status, total_amount, paid_amount, created_at, school_id')
            .eq('event_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Resolve school names and team/athlete counts
        const enriched = await Promise.all((delegations || []).map(async (del: any) => {
            // School name
            let schoolName = 'Desconocida';
            if (del.school_id) {
                const { data: school } = await supabase.from('schools').select('name').eq('id', del.school_id).single();
                if (school) schoolName = school.name;
            }

            // Team count
            const { count: teamCount } = await supabase
                .from('event_teams')
                .select('*', { count: 'exact', head: true })
                .eq('delegation_id', del.id);

            // Athlete count
            const { data: teams } = await supabase.from('event_teams').select('id').eq('delegation_id', del.id);
            let athleteCount = 0;
            if (teams && teams.length > 0) {
                const { count } = await supabase
                    .from('event_team_members')
                    .select('*', { count: 'exact', head: true })
                    .in('event_team_id', teams.map((t: any) => t.id));
                athleteCount = count || 0;
            }

            return {
                id: del.id,
                school_id: del.school_id,
                school_name: schoolName,
                status: del.status,
                total_amount: del.total_amount,
                paid_amount: del.paid_amount,
                team_count: teamCount || 0,
                athlete_count: athleteCount,
                created_at: del.created_at
            };
        }));

        return res.status(200).json(enriched);
    } catch (err: any) {
        req.log?.error({ err }, 'Error obteniendo delegaciones');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// PATCH /api/v1/events/:id/delegations/:delegationId - Update delegation status
router.patch('/:id/delegations/:delegationId', requireAuth, requireRole('organizer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id, delegationId } = req.params;
        const userId = req.user!.id;
        const { status } = req.body;

        const { data: orgData } = await supabase.from('event_organizers').select('id').eq('profile_id', userId).single();
        if (!orgData) return res.status(403).json({ error: 'Organizador no encontrado' });

        const { data: event } = await supabase.from('events').select('id').eq('id', id).eq('organizer_id', orgData.id).single();
        if (!event) return res.status(404).json({ error: 'Evento no encontrado' });

        const { data, error } = await supabase
            .from('event_delegations')
            .update({ status })
            .eq('id', delegationId)
            .eq('event_id', id)
            .select()
            .single();

        if (error || !data) return res.status(404).json({ error: 'Delegación no encontrada' });
        return res.status(200).json(data);
    } catch (err: any) {
        req.log?.error({ err }, 'Error actualizando delegación');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/v1/events/:id/register - Individual athlete/parent registration
router.post('/:id/register', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;

        // Verify event exists, is published, and registrations are open
        const { data: event, error: evErr } = await supabase
            .from('events')
            .select('id, status, registrations_open, registration_deadline, registration_type')
            .eq('id', id)
            .single();

        if (evErr || !event) return res.status(404).json({ error: 'Evento no encontrado' });
        if (event.status !== 'published') return res.status(400).json({ error: 'El evento no está publicado' });
        if (!event.registrations_open) return res.status(400).json({ error: 'Las inscripciones están cerradas' });
        if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
            return res.status(400).json({ error: 'El plazo de inscripción ha vencido' });
        }

        // Check duplicate registration
        const { data: existing } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', userId)
            .in('status', ['pending', 'approved'])
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'Ya tienes una inscripción activa en este evento' });
        }

        const {
            participant_name, participant_email, participant_phone,
            participant_role, participant_age, category_id,
            package_choice, child_id, notes, payment_proof_url
        } = req.body;

        if (!participant_name || !participant_phone) {
            return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
        }

        const { data: registration, error: regErr } = await supabase
            .from('event_registrations')
            .insert({
                event_id: id,
                user_id: userId,
                participant_name,
                participant_email: participant_email || null,
                participant_phone,
                participant_role: participant_role || 'athlete',
                participant_age: participant_age || null,
                category_id: category_id || null,
                package_choice: package_choice || null,
                child_id: child_id || null,
                notes: notes || null,
                payment_proof_url: payment_proof_url || null,
                status: 'pending',
                payment_status: payment_proof_url ? 'pending' : 'not_required'
            })
            .select()
            .single();

        if (regErr) {
            req.log?.error({ err: regErr }, 'Error creando registro individual');
            return res.status(500).json({ error: 'Error al crear la inscripción' });
        }

        // Log telemetry
        await supabase.from('event_telemetry').insert({
            event_id: id,
            user_id: userId,
            event_type: 'registration_created',
            metadata: { participant_role, registration_type: 'individual' }
        });

        return res.status(201).json(registration);
    } catch (err: any) {
        req.log?.error({ err }, 'Error en registro individual');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/events/my-registrations - List user's individual event registrations
router.get('/my-registrations/list', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const { data, error } = await supabase
            .from('event_registrations')
            .select(`
                id, event_id, participant_name, participant_role, participant_age,
                status, payment_status, payment_proof_url, category_id,
                package_choice, child_id, notes, created_at,
                events:event_id(id, title, sport, event_date, city, slug, status, image_url, start_time)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
    } catch (err: any) {
        req.log?.error({ err }, 'Error listando inscripciones del usuario');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// ── GET /api/v1/events/:id/documents ─────────────────────────────────────────
// Organizer endpoint: returns identity documents of athletes enrolled in the event,
// grouped by school (delegation). Used to bulk-download documents before events.
router.get(
    '/:id/documents',
    requireAuth,
    requireRole('organizer'),
    async (req: AuthenticatedRequest, res: Response) => {
        try {
            const eventId = req.params.id;
            const userId = req.user.id;

            // 1. Verify the organizer owns this event
            const { data: orgProfile } = await supabase
                .from('event_organizers')
                .select('id')
                .eq('profile_id', userId)
                .single();

            if (!orgProfile) return res.status(403).json({ error: 'No eres organizador.' });

            const { data: event } = await supabase
                .from('events')
                .select('id, title, organizer_id')
                .eq('id', eventId)
                .single();

            if (!event || event.organizer_id !== orgProfile.id) {
                return res.status(403).json({ error: 'No tienes acceso a este evento.' });
            }

            // 2. Get approved delegations for this event
            const { data: delegations, error: delErr } = await supabase
                .from('event_delegations')
                .select('id, school_id, status')
                .eq('event_id', eventId)
                .in('status', ['approved', 'pending_payment']);

            if (delErr) throw delErr;

            if (!delegations || delegations.length === 0) {
                return res.json({ schools: [] });
            }

            // 3. Resolve school names
            const schoolIds = [...new Set(delegations.map((d: any) => d.school_id).filter(Boolean))];
            const schoolNameMap = new Map<string, string>();
            if (schoolIds.length > 0) {
                const { data: schoolRows } = await supabase
                    .from('schools')
                    .select('id, name')
                    .in('id', schoolIds);
                (schoolRows || []).forEach((s: any) => schoolNameMap.set(s.id, s.name));
            }

            // 4. For each school, get their children with identity documents
            const schools = await Promise.all(
                schoolIds.map(async (schoolId: string) => {
                    const delegation = delegations.find((d: any) => d.school_id === schoolId);

                    // Get children from this school
                    const { data: children } = await supabase
                        .from('children')
                        .select('id, full_name, team_id, id_document_url, status')
                        .eq('school_id', schoolId)
                        .order('full_name');

                    // Resolve team names
                    const teamIds = [...new Set((children || []).map((c: any) => c.team_id).filter(Boolean))];
                    const teamNameMap = new Map<string, string>();
                    if (teamIds.length > 0) {
                        const { data: teamRows } = await supabase
                            .from('teams')
                            .select('id, name')
                            .in('id', teamIds);
                        (teamRows || []).forEach((t: any) => teamNameMap.set(t.id, t.name));
                    }

                    // List documents from storage for each child
                    const students = await Promise.all(
                        (children || []).map(async (child: any) => {
                            const documents: { name: string; path: string }[] = [];

                            const folderPath = `children/${child.id}/docs`;
                            const { data: files } = await supabase.storage
                                .from('identity-documents')
                                .list(folderPath, { limit: 20 });

                            if (files && files.length > 0) {
                                files.forEach((f: any) => {
                                    if (f.name && !f.name.startsWith('.')) {
                                        documents.push({
                                            name: f.name,
                                            path: `${folderPath}/${f.name}`,
                                        });
                                    }
                                });
                            }

                            return {
                                id: child.id,
                                full_name: child.full_name || 'Sin nombre',
                                team_name: teamNameMap.get(child.team_id) || '—',
                                has_document: documents.length > 0,
                                documents,
                            };
                        })
                    );

                    return {
                        school_id: schoolId,
                        school_name: schoolNameMap.get(schoolId) || 'Escuela',
                        delegation_status: delegation?.status || 'unknown',
                        total_students: students.length,
                        with_documents: students.filter(s => s.has_document).length,
                        students,
                    };
                })
            );

            return res.json({ schools });

        } catch (err: any) {
            req.log?.error({ err: err.message || err }, 'Error en documentos del evento');
            return res.status(500).json({ error: 'Error interno obteniendo documentos.' });
        }
    }
);

export default router;
