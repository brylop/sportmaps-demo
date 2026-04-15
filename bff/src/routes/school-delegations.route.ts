import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

// GET /api/v1/school/delegations - List all delegations for the current school
router.get('/', requireAuth, requireRole('school'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Find the school for this user
        const { data: membership } = await supabase
            .from('school_members')
            .select('school_id')
            .eq('profile_id', userId)
            .eq('status', 'active')
            .limit(1)
            .single();

        if (!membership) return res.status(403).json({ error: 'No se encontró escuela asociada' });

        const schoolId = membership.school_id;

        // Get all delegations for this school with event info
        const { data: delegations, error } = await supabase
            .from('event_delegations')
            .select('id, event_id, status, total_amount, paid_amount, created_at')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with event details and counts
        const enriched = await Promise.all((delegations || []).map(async (del: any) => {
            // Event info
            const { data: event } = await supabase
                .from('events')
                .select('id, title, sport, event_date, city, slug, status, image_url')
                .eq('id', del.event_id)
                .single();

            // Team count
            const { count: teamCount } = await supabase
                .from('event_teams')
                .select('*', { count: 'exact', head: true })
                .eq('delegation_id', del.id);

            // Athlete count
            const { data: teams } = await supabase
                .from('event_teams')
                .select('id')
                .eq('delegation_id', del.id);

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
                event_id: del.event_id,
                status: del.status,
                total_amount: del.total_amount,
                paid_amount: del.paid_amount,
                created_at: del.created_at,
                team_count: teamCount || 0,
                athlete_count: athleteCount,
                event: event || null
            };
        }));

        return res.status(200).json(enriched);
    } catch (err: any) {
        req.log?.error({ err }, 'Error listando delegaciones de la escuela');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /api/v1/school/delegations/:id - Delegation detail with teams and athletes
router.get('/:id', requireAuth, requireRole('school'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const { data: membership } = await supabase
            .from('school_members')
            .select('school_id')
            .eq('profile_id', userId)
            .eq('status', 'active')
            .limit(1)
            .single();

        if (!membership) return res.status(403).json({ error: 'No se encontró escuela asociada' });

        // Get delegation
        const { data: delegation, error: delError } = await supabase
            .from('event_delegations')
            .select('*')
            .eq('id', id)
            .eq('school_id', membership.school_id)
            .single();

        if (delError || !delegation) return res.status(404).json({ error: 'Delegación no encontrada' });

        // Get event
        const { data: event } = await supabase
            .from('events')
            .select('id, title, sport, event_date, city, slug, status, image_url, registration_deadline, payment_deadline')
            .eq('id', delegation.event_id)
            .single();

        // Get teams with their categories and athletes
        const { data: teams } = await supabase
            .from('event_teams')
            .select('id, category_id, team_name')
            .eq('delegation_id', delegation.id);

        const teamsWithDetails = await Promise.all((teams || []).map(async (team: any) => {
            // Category info
            const { data: category } = await supabase
                .from('event_categories_config')
                .select('division, level, category, rama')
                .eq('id', team.category_id)
                .single();

            // Athletes
            const { data: members } = await supabase
                .from('event_team_members')
                .select('id, athlete_id, package_id')
                .eq('event_team_id', team.id);

            // Resolve athlete names
            const athletesWithNames = await Promise.all((members || []).map(async (m: any) => {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', m.athlete_id)
                    .single();

                // Check documents
                const folderPath = `children/${m.athlete_id}/docs`;
                const { data: files } = await supabase.storage
                    .from('identity-documents')
                    .list(folderPath, { limit: 5 });

                const docs = (files || []).filter((f: any) => f.name && !f.name.startsWith('.')).map((f: any) => ({
                    name: f.name,
                    path: `${folderPath}/${f.name}`
                }));

                return {
                    id: m.id,
                    athlete_id: m.athlete_id,
                    athlete_name: profile?.full_name || 'Desconocido',
                    package_id: m.package_id,
                    has_documents: docs.length > 0,
                    documents: docs
                };
            }));

            return {
                id: team.id,
                team_name: team.team_name,
                category: category ? `${category.division} ${category.category} ${category.rama}` : 'Sin categoría',
                athletes: athletesWithNames
            };
        }));

        // Coaches
        const { data: coaches } = await supabase
            .from('event_team_coaches')
            .select('id, coach_id, package_id')
            .eq('delegation_id', delegation.id);

        const coachesWithNames = await Promise.all((coaches || []).map(async (c: any) => {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', c.coach_id).single();
            return { id: c.id, coach_id: c.coach_id, name: profile?.full_name || 'Desconocido', package_id: c.package_id };
        }));

        return res.status(200).json({
            ...delegation,
            event,
            teams: teamsWithDetails,
            coaches: coachesWithNames
        });
    } catch (err: any) {
        req.log?.error({ err }, 'Error obteniendo detalle de delegación');
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export default router;
