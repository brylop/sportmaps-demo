import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

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
