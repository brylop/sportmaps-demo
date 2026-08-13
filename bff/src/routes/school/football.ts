import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
const VALID_SOURCE_TYPES = ['team_match', 'tournament_match'] as const;
const VALID_SUBJECT_TYPES = ['profile', 'child', 'unregistered'] as const;
const VALID_POSITION_CODES = ['arquero', 'defensa', 'medio', 'delantero'] as const;
const VALID_ROLES = ['starter', 'bench'] as const;
const VALID_EVENT_TYPES = ['goal', 'own_goal', 'yellow', 'red', 'assist'] as const;
const MAX_STARTERS = 11;

/**
 * Valida la lista de jugadores de una alineación: subject_type/role válidos,
 * sin duplicados, sin números de camiseta repetidos, máximo 11 titulares.
 * Igual que la validación de sets de voleibol en competition-results.ts, vive
 * en el BFF -- no hay constraint SQL equivalente.
 */
function validateLineupPlayers(players: any[]): string[] {
  const errors: string[] = [];
  const seenSubjects = new Set<string>();
  const seenJerseys = new Set<number>();
  let starters = 0;

  for (const p of players) {
    if (!p.subject_type || !VALID_SUBJECT_TYPES.includes(p.subject_type)) {
      errors.push(`subject_type inválido: ${p.subject_type}`);
      continue;
    }
    if (!p.subject_id) {
      errors.push('subject_id es requerido en cada jugador.');
      continue;
    }
    if (!p.role || !VALID_ROLES.includes(p.role)) {
      errors.push(`role inválido para ${p.subject_id}: debe ser 'starter' o 'bench'.`);
      continue;
    }
    if (p.position_code && !VALID_POSITION_CODES.includes(p.position_code)) {
      errors.push(`position_code inválido: ${p.position_code}`);
    }

    const subjectKey = `${p.subject_type}:${p.subject_id}`;
    if (seenSubjects.has(subjectKey)) {
      errors.push(`Jugador duplicado en la alineación: ${p.subject_id}`);
    }
    seenSubjects.add(subjectKey);

    if (p.jersey_number !== undefined && p.jersey_number !== null) {
      if (seenJerseys.has(p.jersey_number)) {
        errors.push(`Número de camiseta repetido: ${p.jersey_number}`);
      }
      seenJerseys.add(p.jersey_number);
    }

    if (p.role === 'starter') starters++;
  }

  if (starters > MAX_STARTERS) {
    errors.push(`Máximo ${MAX_STARTERS} titulares, se recibieron ${starters}.`);
  }

  return errors;
}

async function assertTeamBelongsToSchool(teamId: string, schoolId: string) {
  const { data: team, error } = await supabase
    .from('teams')
    .select('id, school_id')
    .eq('id', teamId)
    .maybeSingle();
  if (error) throw error;
  return !!team && team.school_id === schoolId;
}

// ==========================================
// GET /api/v1/school/football/tournament-matches?team_id=...
// Partidos de TORNEO (tournament_matches) que involucran a este equipo.
//
// No hay FK real entre event_teams y teams -- event_teams solo tiene
// team_name (texto libre) por delegación. Se resuelve por mejor esfuerzo:
// delegaciones de esta escuela + coincidencia de nombre (mismo criterio que
// ya usa el resto del código para resolver sport_category_id desde
// team.sport vía ilike). Va por el BFF con service_role porque event_teams/
// event_delegations solo son legibles por el organizador del torneo via RLS,
// no por la escuela participante.
// ==========================================
router.get(
  '/football/tournament-matches',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id } = req.query as Record<string, string>;
      if (!team_id) {
        return res.status(400).json({ error: 'team_id es requerido.' });
      }

      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .select('id, name, school_id')
        .eq('id', team_id)
        .maybeSingle();
      if (teamErr) throw teamErr;
      if (!team || team.school_id !== schoolId) {
        return res.status(403).json({ error: 'El equipo no pertenece a esta escuela.' });
      }

      const { data: delegations, error: delErr } = await supabase
        .from('event_delegations')
        .select('id')
        .eq('school_id', schoolId);
      if (delErr) throw delErr;
      const delegationIds = (delegations ?? []).map((d: any) => d.id);
      if (delegationIds.length === 0) return res.json([]);

      const { data: eventTeams, error: etErr } = await supabase
        .from('event_teams')
        .select('id')
        .in('delegation_id', delegationIds)
        .ilike('team_name', team.name);
      if (etErr) throw etErr;
      const ourEventTeamIds: string[] = (eventTeams ?? []).map((t: any) => t.id);
      if (ourEventTeamIds.length === 0) return res.json([]);

      const [homeRes, awayRes] = await Promise.all([
        supabase
          .from('tournament_matches')
          .select('id, event_id, round, home_team_id, away_team_id, home_score, away_score, status, scheduled_at, venue')
          .in('home_team_id', ourEventTeamIds),
        supabase
          .from('tournament_matches')
          .select('id, event_id, round, home_team_id, away_team_id, home_score, away_score, status, scheduled_at, venue')
          .in('away_team_id', ourEventTeamIds),
      ]);
      if (homeRes.error) throw homeRes.error;
      if (awayRes.error) throw awayRes.error;

      const seen = new Set<string>();
      const matches = [...(homeRes.data ?? []), ...(awayRes.data ?? [])].filter((m: any) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });

      const opponentIds = new Set<string>();
      for (const m of matches) {
        const oppId = ourEventTeamIds.includes(m.home_team_id) ? m.away_team_id : m.home_team_id;
        if (oppId) opponentIds.add(oppId);
      }
      const { data: opponents } = opponentIds.size > 0
        ? await supabase.from('event_teams').select('id, team_name').in('id', [...opponentIds])
        : { data: [] as any[] };
      const opponentMap = new Map((opponents ?? []).map((o: any) => [o.id, o.team_name]));

      const eventIds = [...new Set(matches.map((m: any) => m.event_id))];
      const { data: events } = eventIds.length > 0
        ? await supabase.from('events').select('id, title').in('id', eventIds)
        : { data: [] as any[] };
      const eventMap = new Map((events ?? []).map((e: any) => [e.id, e.title]));

      const result = matches
        .map((m: any) => {
          const isHome = ourEventTeamIds.includes(m.home_team_id);
          const opponentEventTeamId = isHome ? m.away_team_id : m.home_team_id;
          return {
            id: m.id,
            event_id: m.event_id,
            event_title: eventMap.get(m.event_id) ?? 'Torneo',
            round: m.round,
            is_home: isHome,
            opponent: opponentEventTeamId ? (opponentMap.get(opponentEventTeamId) ?? 'Rival por definir') : 'Rival por definir',
            home_score: m.home_score,
            away_score: m.away_score,
            status: m.status,
            scheduled_at: m.scheduled_at,
            venue: m.venue,
          };
        })
        .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''));

      res.json(result);
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/football/lineups
// Filtros: team_id, source_type, source_id
// ==========================================
router.get(
  '/football/lineups',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id, source_type, source_id } = req.query as Record<string, string>;

      let query = supabase
        .from('match_lineups')
        .select('id, team_id, source_type, source_id, formation, created_by, created_at, updated_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (team_id) query = query.eq('team_id', team_id);
      if (source_type) query = query.eq('source_type', source_type);
      if (source_id) query = query.eq('source_id', source_id);

      const { data, error } = await query.limit(200);
      if (error) throw error;

      res.json(data ?? []);
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/football/lineups/:id
// Alineación + jugadores.
// ==========================================
router.get(
  '/football/lineups/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;

      const { data: lineup, error: lineupErr } = await supabase
        .from('match_lineups')
        .select('id, team_id, source_type, source_id, formation, created_by, created_at, updated_at')
        .eq('id', id)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (lineupErr) throw lineupErr;
      if (!lineup) return res.status(404).json({ error: 'Alineación no encontrada.' });

      const { data: players, error: playersErr } = await supabase
        .from('match_lineup_players')
        .select('id, subject_type, subject_id, position_code, role, jersey_number, minutes_played')
        .eq('lineup_id', id)
        .order('role', { ascending: true });
      if (playersErr) throw playersErr;

      res.json({ ...lineup, players: players ?? [] });
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// POST /api/v1/school/football/lineups
// Crea o reemplaza la alineación de un partido (upsert por source_type+source_id).
// Body: { team_id, source_type, source_id, formation?, players: [{subject_type,
//         subject_id, position_code?, role, jersey_number?, minutes_played?}] }
// ==========================================
router.post(
  '/football/lineups',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { team_id, source_type, source_id, formation, players } = req.body;

      if (!team_id || !source_type || !VALID_SOURCE_TYPES.includes(source_type) || !source_id) {
        return res.status(400).json({
          error: 'team_id, source_type (team_match|tournament_match) y source_id son requeridos.',
        });
      }

      const playerList = Array.isArray(players) ? players : [];
      const playerErrors = validateLineupPlayers(playerList);
      if (playerErrors.length > 0) {
        return res.status(422).json({ error: 'Alineación inválida.', details: playerErrors });
      }

      if (!(await assertTeamBelongsToSchool(team_id, schoolId!))) {
        return res.status(403).json({ error: 'El equipo no pertenece a esta escuela.' });
      }

      const { data: existing } = await supabase
        .from('match_lineups')
        .select('id')
        .eq('source_type', source_type)
        .eq('source_id', source_id)
        .maybeSingle();

      let lineupId: string;
      if (existing) {
        const { data: updated, error: updateErr } = await supabase
          .from('match_lineups')
          .update({ team_id, formation: formation ?? null, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .eq('school_id', schoolId)
          .select('id')
          .single();
        if (updateErr) throw updateErr;
        lineupId = updated.id;

        const { error: delErr } = await supabase
          .from('match_lineup_players')
          .delete()
          .eq('lineup_id', lineupId);
        if (delErr) throw delErr;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('match_lineups')
          .insert({
            school_id: schoolId,
            team_id,
            source_type,
            source_id,
            formation: formation ?? null,
            created_by: user.id,
          })
          .select('id')
          .single();
        if (createErr) throw createErr;
        lineupId = created.id;
      }

      if (playerList.length > 0) {
        const rows = playerList.map((p: any) => ({
          lineup_id: lineupId,
          school_id: schoolId,
          subject_type: p.subject_type,
          subject_id: p.subject_id,
          position_code: p.position_code ?? null,
          role: p.role,
          jersey_number: p.jersey_number ?? null,
          minutes_played: p.minutes_played ?? null,
        }));

        const { error: insertErr } = await supabase.from('match_lineup_players').insert(rows);
        if (insertErr) throw insertErr;
      }

      const { data: fullLineup } = await supabase
        .from('match_lineups')
        .select('id, team_id, source_type, source_id, formation, created_by, created_at, updated_at')
        .eq('id', lineupId)
        .single();
      const { data: fullPlayers } = await supabase
        .from('match_lineup_players')
        .select('id, subject_type, subject_id, position_code, role, jersey_number, minutes_played')
        .eq('lineup_id', lineupId);

      res.status(existing ? 200 : 201).json({ ...fullLineup, players: fullPlayers ?? [] });
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// DELETE /api/v1/school/football/lineups/:id
// ==========================================
router.delete(
  '/football/lineups/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;

      const { error } = await supabase
        .from('match_lineups')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/football/events
// Filtros: team_id, source_type, source_id, subject_type, subject_id
// ==========================================
router.get(
  '/football/events',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id, source_type, source_id, subject_type, subject_id } = req.query as Record<string, string>;

      let query = supabase
        .from('football_match_events')
        .select('id, team_id, source_type, source_id, subject_type, subject_id, type, minute, created_by, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (team_id) query = query.eq('team_id', team_id);
      if (source_type) query = query.eq('source_type', source_type);
      if (source_id) query = query.eq('source_id', source_id);
      if (subject_type) query = query.eq('subject_type', subject_type);
      if (subject_id) query = query.eq('subject_id', subject_id);

      const { data, error } = await query.limit(500);
      if (error) throw error;

      res.json(data ?? []);
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// POST /api/v1/school/football/events
// Crea uno o varios eventos en un solo request.
// Body: { team_id, source_type, source_id, events: [{subject_type, subject_id, type, minute?}] }
// ==========================================
router.post(
  '/football/events',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { team_id, source_type, source_id, events } = req.body;

      if (!team_id || !source_type || !VALID_SOURCE_TYPES.includes(source_type) || !source_id) {
        return res.status(400).json({
          error: 'team_id, source_type (team_match|tournament_match) y source_id son requeridos.',
        });
      }
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'events debe ser un array no vacío.' });
      }

      for (const e of events) {
        if (!e.subject_type || !VALID_SUBJECT_TYPES.includes(e.subject_type)) {
          return res.status(400).json({ error: `subject_type inválido: ${e.subject_type}` });
        }
        if (!e.subject_id) {
          return res.status(400).json({ error: 'subject_id es requerido en cada evento.' });
        }
        if (!e.type || !VALID_EVENT_TYPES.includes(e.type)) {
          return res.status(400).json({ error: `type inválido: ${e.type}. Debe ser uno de: ${VALID_EVENT_TYPES.join(', ')}` });
        }
        if (e.minute !== undefined && e.minute !== null && (!Number.isInteger(e.minute) || e.minute < 0)) {
          return res.status(400).json({ error: `minute inválido: ${e.minute}` });
        }
      }

      if (!(await assertTeamBelongsToSchool(team_id, schoolId!))) {
        return res.status(403).json({ error: 'El equipo no pertenece a esta escuela.' });
      }

      const rows = events.map((e: any) => ({
        school_id: schoolId,
        team_id,
        source_type,
        source_id,
        subject_type: e.subject_type,
        subject_id: e.subject_id,
        type: e.type,
        minute: e.minute ?? null,
        created_by: user.id,
      }));

      const { data, error } = await supabase.from('football_match_events').insert(rows).select();
      if (error) throw error;

      res.status(201).json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// DELETE /api/v1/school/football/events/:id
// ==========================================
router.delete(
  '/football/events/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;

      const { error } = await supabase
        .from('football_match_events')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// GET /api/v1/school/football/season-stats?team_id=...
// Acumulados por jugador: partidos, minutos, goles, asistencias, tarjetas.
// Calculado en el BFF combinando match_lineup_players + football_match_events
// (mismo criterio que report-snapshot.service.ts: el BFF agrega, SQL no).
// "Partido jugado" = tuvo minutes_played > 0 cargado; si el coach no carga
// minutos, esa presencia cuenta en matches_in_squad pero no en matches_played.
// ==========================================
router.get(
  '/football/season-stats',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id } = req.query as Record<string, string>;
      if (!team_id) {
        return res.status(400).json({ error: 'team_id es requerido.' });
      }

      const { data: lineups, error: lineupsErr } = await supabase
        .from('match_lineups')
        .select('id')
        .eq('school_id', schoolId)
        .eq('team_id', team_id);
      if (lineupsErr) throw lineupsErr;

      const lineupIds = (lineups ?? []).map((l: any) => l.id);

      type Stat = {
        subject_type: string;
        subject_id: string;
        matches_in_squad: number;
        matches_played: number;
        minutes_played: number;
        goals: number;
        own_goals: number;
        assists: number;
        yellow_cards: number;
        red_cards: number;
      };
      const stats = new Map<string, Stat>();
      const getOrInit = (subject_type: string, subject_id: string): Stat => {
        const key = `${subject_type}:${subject_id}`;
        let s = stats.get(key);
        if (!s) {
          s = {
            subject_type, subject_id,
            matches_in_squad: 0, matches_played: 0, minutes_played: 0,
            goals: 0, own_goals: 0, assists: 0, yellow_cards: 0, red_cards: 0,
          };
          stats.set(key, s);
        }
        return s;
      };

      if (lineupIds.length > 0) {
        const { data: players, error: playersErr } = await supabase
          .from('match_lineup_players')
          .select('subject_type, subject_id, minutes_played')
          .in('lineup_id', lineupIds);
        if (playersErr) throw playersErr;

        for (const p of players ?? []) {
          const s = getOrInit(p.subject_type, p.subject_id);
          s.matches_in_squad += 1;
          if (p.minutes_played && p.minutes_played > 0) {
            s.matches_played += 1;
            s.minutes_played += p.minutes_played;
          }
        }
      }

      const { data: events, error: eventsErr } = await supabase
        .from('football_match_events')
        .select('subject_type, subject_id, type')
        .eq('school_id', schoolId)
        .eq('team_id', team_id);
      if (eventsErr) throw eventsErr;

      for (const e of events ?? []) {
        const s = getOrInit(e.subject_type, e.subject_id);
        if (e.type === 'goal') s.goals += 1;
        else if (e.type === 'own_goal') s.own_goals += 1;
        else if (e.type === 'assist') s.assists += 1;
        else if (e.type === 'yellow') s.yellow_cards += 1;
        else if (e.type === 'red') s.red_cards += 1;
      }

      res.json({ team_id, stats: Array.from(stats.values()) });
    } catch (err: any) {
      req.log?.error({ err }, 'school/football unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

export default router;
