import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * GET /trainer/biomech/analyzers/detect
 * Detecta si un ejercicio tiene un analyzer biomecánico mapeado.
 * Query params: wger_id (number) y/o name (string)
 * Devuelve: { analyzer_code: string } | null
 */
router.get('/biomech/analyzers/detect', async (req: Request, res: Response) => {
  try {
    const { wger_id, name } = req.query;

    if (!wger_id && !name) {
      return res.status(400).json({ error: 'Se requiere wger_id o name.' });
    }

    // 1. Buscar por wger_id (más confiable)
    if (wger_id) {
      const { data } = await supabase
        .from('exercise_analyzer_mappings')
        .select('analyzer_code')
        .eq('wger_id', Number(wger_id))
        .maybeSingle();

      if (data) return res.json({ analyzer_code: data.analyzer_code });
    }

    // 2. Fallback: fuzzy match por nombre
    if (name) {
      const nameLower = String(name).toLowerCase();

      const { data: patterns } = await supabase
        .from('exercise_analyzer_mappings')
        .select('analyzer_code, name_pattern');

      const match = (patterns ?? []).find((p: any) =>
        nameLower.includes(p.name_pattern) || p.name_pattern.includes(nameLower)
      );

      if (match) return res.json({ analyzer_code: match.analyzer_code });
    }

    // Sin mapeo encontrado
    res.json(null);
  } catch (err) {
    (req as any).log?.error({ err }, 'Error detecting analyzer');
    res.status(500).json({ error: 'Error al detectar analyzer.' });
  }
});

// ── ANALYZERS ──────────────────────────────────────────────────────────────────

router.get('/biomech/analyzers', async (req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('exercise_analyzers')
            .select('code, name, description, metrics, thresholds')
            .order('name');
        if (error) throw error;
        res.json(data ?? []);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching exercise analyzers');
        res.status(500).json({ error: 'Error al obtener analyzers.' });
    }
});

// ── CAPTURES ───────────────────────────────────────────────────────────────────

router.get('/biomech/captures', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;
        const { schoolId } = req;
        const { client_id, session_plan_id, analyzer_code, status } = req.query;

        const { data: plans } = await supabase
            .from('trainer_session_plans')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('school_id', schoolId);

        const planIds = (plans ?? []).map((p: any) => p.id);

        let query = supabase
            .from('biomech_captures')
            .select(`
                id, athlete_id, session_plan_id, enrollment_id,
                analyzer_code, block_index, status, quality_score,
                duration_seconds, source, created_at, updated_at,
                biomech_analyses ( id, rep_count, metrics, flags, summary, quality_rating, processed_at )
            `)
            .eq('school_id', schoolId);

        if (client_id) {
            query = query.eq('athlete_id', client_id as string);
        } else {
            if (planIds.length === 0) return res.json([]);
            query = query.in('session_plan_id', planIds);
        }

        if (session_plan_id) query = query.eq('session_plan_id', session_plan_id as string);
        if (analyzer_code)   query = query.eq('analyzer_code', analyzer_code as string);
        if (status)          query = query.eq('status', status as string);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data ?? []);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching biomech captures (trainer)');
        res.status(500).json({ error: 'Error al obtener capturas biomecánicas.' });
    }
});

router.get('/biomech/captures/:captureId', async (req: Request, res: Response) => {
    try {
        const { captureId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { data: capture, error } = await supabase
            .from('biomech_captures')
            .select(`
                id, athlete_id, session_plan_id, enrollment_id,
                analyzer_code, block_index, video_path, keypoints,
                fps, duration_seconds, quality_score, source, status,
                created_at, updated_at,
                biomech_analyses ( id, rep_count, metrics, flags, summary, quality_rating, suggested_correctives, processed_at ),
                biomech_annotations ( id, coach_id, timestamp_seconds, note, label, is_baseline_label, created_at )
            `)
            .eq('id', captureId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        if (!capture) return res.status(404).json({ error: 'Captura no encontrada.' });

        const { data: plan } = await supabase
            .from('trainer_session_plans')
            .select('id')
            .eq('id', (capture as any).session_plan_id)
            .eq('trainer_id', trainerId)
            .maybeSingle();

        if (!plan) return res.status(403).json({ error: 'Sin acceso a esta captura.' });

        res.json(capture);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching biomech capture detail (trainer)');
        res.status(500).json({ error: 'Error al obtener detalle de la captura.' });
    }
});

// ── ANNOTATIONS ────────────────────────────────────────────────────────────────

router.post('/biomech/captures/:captureId/annotations', async (req: Request, res: Response) => {
    try {
        const { captureId } = req.params;
        const { id: coachId } = req.user;
        const { timestamp_seconds, note, label, is_baseline_label } = req.body;

        if (!note) return res.status(400).json({ error: 'La nota es requerida.' });

        const { data: capture } = await supabase
            .from('biomech_captures').select('id').eq('id', captureId).maybeSingle();
        if (!capture) return res.status(404).json({ error: 'Captura no encontrada.' });

        const { data, error } = await supabase
            .from('biomech_annotations')
            .insert({ capture_id: captureId, coach_id: coachId, timestamp_seconds: timestamp_seconds ?? null, note, label: label ?? null, is_baseline_label: is_baseline_label ?? false })
            .select().single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error creating biomech annotation');
        res.status(500).json({ error: 'Error al crear anotación.' });
    }
});

router.put('/biomech/annotations/:annotationId', async (req: Request, res: Response) => {
    try {
        const { annotationId } = req.params;
        const { id: coachId } = req.user;
        const { note, label, is_baseline_label, timestamp_seconds } = req.body;

        const { data, error } = await supabase
            .from('biomech_annotations')
            .update({ note, label, is_baseline_label, timestamp_seconds })
            .eq('id', annotationId).eq('coach_id', coachId)
            .select().single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Anotación no encontrada.' });
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating biomech annotation');
        res.status(500).json({ error: 'Error al actualizar anotación.' });
    }
});

router.delete('/biomech/annotations/:annotationId', async (req: Request, res: Response) => {
    try {
        const { annotationId } = req.params;
        const { id: coachId } = req.user;

        const { error } = await supabase
            .from('biomech_annotations')
            .delete().eq('id', annotationId).eq('coach_id', coachId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error deleting biomech annotation');
        res.status(500).json({ error: 'Error al eliminar anotación.' });
    }
});

// ── BASELINE ───────────────────────────────────────────────────────────────────

router.get('/biomech/baselines/:athleteId', async (req: Request, res: Response) => {
    try {
        const { athleteId } = req.params;
        const { id: trainerId } = req.user;
        const { schoolId } = req;

        const { data: plan } = await supabase
            .from('trainer_session_plans').select('id')
            .eq('trainer_id', trainerId).eq('school_id', schoolId).eq('client_id', athleteId)
            .limit(1).maybeSingle();

        const { data: grant } = await supabase
            .from('biomech_access_grants').select('id')
            .eq('athlete_id', athleteId).eq('coach_id', trainerId)
            .eq('school_id', schoolId).eq('is_active', true).maybeSingle();

        if (!plan && !grant) return res.status(403).json({ error: 'Sin acceso al baseline de este atleta.' });

        const { data, error } = await supabase
            .from('biomech_baselines').select('*').eq('athlete_id', athleteId).maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Baseline no encontrado para este atleta.' });
        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching biomech baseline (trainer)');
        res.status(500).json({ error: 'Error al obtener baseline biomecánico.' });
    }
});

// ── SKILL EVIDENCE ─────────────────────────────────────────────────────────────

router.post('/biomech/skills/:progressId/evidence', async (req: Request, res: Response) => {
    try {
        const { progressId } = req.params;
        const { id: coachId } = req.user;
        const { capture_id } = req.body;

        if (!capture_id) return res.status(400).json({ error: 'capture_id es requerido.' });

        const { data, error } = await supabase
            .from('skill_biomech_evidence')
            .insert({ academic_progress_id: progressId, capture_id, added_by: coachId })
            .select().single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Esta captura ya está adjunta a esta evaluación.' });
            throw error;
        }
        res.status(201).json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error adding skill biomech evidence');
        res.status(500).json({ error: 'Error al adjuntar evidencia biomecánica.' });
    }
});

router.delete('/biomech/skills/:progressId/evidence/:captureId', async (req: Request, res: Response) => {
    try {
        const { progressId, captureId } = req.params;
        const { id: coachId } = req.user;

        const { error } = await supabase
            .from('skill_biomech_evidence')
            .delete()
            .eq('academic_progress_id', progressId)
            .eq('capture_id', captureId)
            .eq('added_by', coachId);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error removing skill biomech evidence');
        res.status(500).json({ error: 'Error al eliminar evidencia biomecánica.' });
    }
});

// ── ACCESS GRANTS ──────────────────────────────────────────────────────────────

router.get('/biomech/grants', async (req: Request, res: Response) => {
    try {
        const { id: trainerId } = req.user;

        const { data, error } = await supabase
            .from('biomech_access_grants')
            .select('id, athlete_id, school_id, is_active, granted_at, expires_at')
            .eq('coach_id', trainerId).eq('is_active', true);

        if (error) throw error;
        res.json(data ?? []);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching biomech grants (trainer)');
        res.status(500).json({ error: 'Error al obtener grants biomecánicos.' });
    }
});

export default router;
