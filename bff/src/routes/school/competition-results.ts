import { Router, Response } from 'express';
import { supabase } from '../../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';

const router = Router();

const STAFF_ROLES = ['owner', 'super_admin', 'admin', 'school_admin', 'coach', 'staff'] as const;
const VALID_RESULT_TYPES = ['preparatorio', 'competencia_oficial'] as const;

interface SetInput {
  set_number: number;
  team_score: number;
  opponent_score: number;
}

type MatchFormat = 'bo3' | 'bo5' | 'libre';

interface ScoredSets {
  sets: SetInput[];
  sets_won_team: number;
  sets_won_opponent: number;
  match_result: 'win' | 'loss' | 'draw' | null;
  warnings: string[];
}

function deciderSetNumber(format: MatchFormat): number | null {
  if (format === 'bo3') return 3;
  if (format === 'bo5') return 5;
  return null; // 'libre': no hay noción de set decisivo
}

function maxSetsForFormat(format: MatchFormat): number {
  return format === 'bo3' ? 3 : 5; // 'bo5' y 'libre' comparten el mismo techo razonable
}

/**
 * Valida y calcula el resultado de un partido de voleibol a partir de sus sets.
 * Reglas: sets 1-4 se ganan con >=25 puntos y diferencia >=2; el set decisivo
 * se gana con >=15 puntos y diferencia >=2. No exige un número fijo de sets.
 * Si `sets` viene vacío/undefined, el partido queda como "programado" (sin jugar aún).
 */
function validateAndScoreSets(
  rawSets: any,
  format: MatchFormat,
  force: boolean
): { result: ScoredSets; blockingErrors: string[] } {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  if (!rawSets || !Array.isArray(rawSets) || rawSets.length === 0) {
    return { result: { sets: [], sets_won_team: 0, sets_won_opponent: 0, match_result: null, warnings: [] }, blockingErrors: [] };
  }

  const maxSets = maxSetsForFormat(format);
  const decider = deciderSetNumber(format);
  const sets: SetInput[] = [];
  let setsWonTeam = 0;
  let setsWonOpponent = 0;

  for (const raw of rawSets) {
    const setNumber = Number(raw?.set_number);
    const teamScore = Number(raw?.team_score);
    const opponentScore = Number(raw?.opponent_score);

    // Estructuralmente imposible -> bloquea SIEMPRE, en cualquier formato, incluso con force
    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > maxSets) {
      blockingErrors.push(`set_number inválido para formato ${format}: ${raw?.set_number}`);
      continue;
    }
    if (!Number.isInteger(teamScore) || teamScore < 0 || !Number.isInteger(opponentScore) || opponentScore < 0) {
      blockingErrors.push(`Marcador inválido en el set ${setNumber}: ${raw?.team_score}-${raw?.opponent_score}`);
      continue;
    }
    if (teamScore === opponentScore) {
      blockingErrors.push(`Set ${setNumber}: un set de voleibol no puede terminar en empate (${teamScore}-${opponentScore}).`);
      continue;
    }

    // Marcador "no estándar" -> solo se evalúa si el coach eligió bo3/bo5
    if (format !== 'libre') {
      const minToWin = setNumber === decider ? 15 : 25;
      const higher = Math.max(teamScore, opponentScore);
      const diff = Math.abs(teamScore - opponentScore);
      const looksStandard = higher >= minToWin && diff >= 2;

      if (!looksStandard) {
        const msg = `Set ${setNumber} (${teamScore}-${opponentScore}) no sigue el marcador estándar de ${format} (mínimo ${minToWin}, diferencia de 2).`;
        if (!force) {
          blockingErrors.push(msg);
          continue;
        }
        warnings.push(msg);
      }
    }

    if (teamScore > opponentScore) setsWonTeam++; else setsWonOpponent++;
    sets.push({ set_number: setNumber, team_score: teamScore, opponent_score: opponentScore });
  }

  const match_result: ScoredSets['match_result'] =
    blockingErrors.length > 0 ? null
    : setsWonTeam === setsWonOpponent ? 'draw'
    : setsWonTeam > setsWonOpponent ? 'win' : 'loss';

  return { result: { sets, sets_won_team: setsWonTeam, sets_won_opponent: setsWonOpponent, match_result, warnings }, blockingErrors };
}

// ==========================================
// GET /api/v1/school/competition-results
// Filtros: team_id, result_type, from_date, to_date
// ==========================================
router.get(
  '/competition-results',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { team_id, result_type, from_date, to_date } = req.query as Record<string, string>;

      let query = supabase
        .from('competition_results')
        .select('id, team_id, subject_type, subject_id, competition_name, competition_date, result_type, result_data, opponent, notes, recorded_by, created_at')
        .eq('school_id', schoolId)
        .order('competition_date', { ascending: false });

      if (team_id)     query = query.eq('team_id', team_id);
      if (result_type) query = query.eq('result_type', result_type);
      if (from_date)   query = query.gte('competition_date', from_date);
      if (to_date)     query = query.lte('competition_date', to_date);

      const { data, error } = await query.limit(200);
      if (error) throw error;

      res.json(data ?? []);
    } catch (err: any) {
      req.log?.error({ err }, 'school/competition-results unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// POST /api/v1/school/competition-results
// Body: { team_id, opponent, competition_date, result_type, competition_name?, match_format, sets?, notes?, force? }
// `sets` es opcional: sin sets, el partido queda "programado" (match_result: null).
// ==========================================
router.post(
  '/competition-results',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, user } = req;
      const { team_id, opponent, competition_date, result_type, competition_name, match_format, sets, notes, force } = req.body;

      if (!team_id || !opponent || !competition_date) {
        return res.status(400).json({ error: 'team_id, opponent y competition_date son requeridos.' });
      }
      if (!result_type || !VALID_RESULT_TYPES.includes(result_type)) {
        return res.status(400).json({ error: `result_type debe ser uno de: ${VALID_RESULT_TYPES.join(', ')}` });
      }
      const VALID_FORMATS = ['bo3', 'bo5', 'libre'] as const;
      if (!match_format || !VALID_FORMATS.includes(match_format)) {
        return res.status(400).json({ error: `match_format debe ser uno de: ${VALID_FORMATS.join(', ')}` });
      }

      const { result: scored, blockingErrors } = validateAndScoreSets(sets, match_format, !!force);
      if (blockingErrors.length > 0) {
        return res.status(422).json({
          error: 'Marcadores inválidos o fuera de lo estándar.',
          details: blockingErrors,
          requires_confirmation: match_format !== 'libre',
        });
      }

      // Deporte real del equipo, para dejar sport_category_id consistente por deporte, con fallback al de la escuela
      let sportCategoryId: string | null = null;
      const { data: team } = await supabase
        .from('teams')
        .select('sport')
        .eq('id', team_id)
        .maybeSingle();

      if (team?.sport) {
        const { data: cat } = await supabase
          .from('sports_categories')
          .select('id')
          .ilike('name', team.sport)
          .maybeSingle();
        sportCategoryId = cat?.id ?? null;
      }
      if (!sportCategoryId) {
        const { data: school } = await supabase
          .from('schools')
          .select('category_id')
          .eq('id', schoolId)
          .maybeSingle();
        sportCategoryId = school?.category_id ?? null;
      }

      const { data, error } = await supabase
        .from('competition_results')
        .insert({
          school_id: schoolId,
          sport_category_id: sportCategoryId,
          team_id,
          opponent,
          competition_date,
          result_type,
          competition_name: competition_name ?? null,
          result_data: { ...scored, match_format }, // match_format queda trazado dentro del jsonb
          notes: notes ?? null,
          recorded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/competition-results unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// PUT /api/v1/school/competition-results/:id
// Permite completar un partido "programado" con sets, o editar uno existente.
// ==========================================
router.put(
  '/competition-results/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;
      const { opponent, competition_date, result_type, competition_name, match_format, sets, notes, force } = req.body;

      // 1. Obtener registro existente para validar pertenencia y extraer el formato guardado
      const { data: existing, error: fetchErr } = await supabase
        .from('competition_results')
        .select('school_id, result_data')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!existing) {
        return res.status(404).json({ error: 'Registro no encontrado.' });
      }
      if (existing.school_id !== schoolId) {
        return res.status(403).json({ error: 'No tienes permisos para modificar este registro.' });
      }

      const existingData = existing.result_data as any;
      const currentFormat = match_format ?? existingData?.match_format ?? 'libre';

      const VALID_FORMATS = ['bo3', 'bo5', 'libre'] as const;
      if (match_format !== undefined && !VALID_FORMATS.includes(match_format)) {
        return res.status(400).json({ error: `match_format debe ser uno de: ${VALID_FORMATS.join(', ')}` });
      }

      const updates: Record<string, any> = {};
      if (opponent !== undefined)          updates.opponent = opponent;
      if (competition_date !== undefined)  updates.competition_date = competition_date;
      if (competition_name !== undefined)  updates.competition_name = competition_name;
      if (notes !== undefined)             updates.notes = notes;

      if (result_type !== undefined) {
        if (!VALID_RESULT_TYPES.includes(result_type)) {
          return res.status(400).json({ error: `result_type debe ser uno de: ${VALID_RESULT_TYPES.join(', ')}` });
        }
        updates.result_type = result_type;
      }

      if (sets !== undefined || match_format !== undefined) {
        const setsToValidate = sets !== undefined ? sets : (existingData?.sets ?? []);
        const { result: scored, blockingErrors } = validateAndScoreSets(setsToValidate, currentFormat, !!force);
        if (blockingErrors.length > 0) {
          return res.status(422).json({
            error: 'Marcadores inválidos o fuera de lo estándar.',
            details: blockingErrors,
            requires_confirmation: currentFormat !== 'libre',
          });
        }
        updates.result_data = { ...scored, match_format: currentFormat };
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
      }

      const { data, error } = await supabase
        .from('competition_results')
        .update(updates)
        .eq('id', id)
        .eq('school_id', schoolId)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      req.log?.error({ err }, 'school/competition-results unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

// ==========================================
// DELETE /api/v1/school/competition-results/:id
// ==========================================
router.delete(
  '/competition-results/:id',
  requireAuth,
  requireRole(...STAFF_ROLES),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId } = req;
      const { id } = req.params;

      const { error } = await supabase
        .from('competition_results')
        .delete()
        .eq('id', id)
        .eq('school_id', schoolId);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      req.log?.error({ err }, 'school/competition-results unhandled error');
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

export default router;
