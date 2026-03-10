import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

const SportConfigSchema = z.object({
    sport: z.string().min(1),
    categorization_axis: z.enum(['age', 'weight', 'belt', 'level', 'division', 'none']),
    rules: z.array(z.record(z.unknown())),
    settings: z.record(z.unknown()).optional().default({}),
});

/**
 * GET /api/v1/sport-configs
 * Lista configuraciones de deporte de la escuela.
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('sport_configs')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('sport', { ascending: true });

        if (error) throw error;
        res.json({ configs: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error listing sport configs');
        res.status(500).json({ error: 'Error al listar configuraciones de deporte' });
    }
});

/**
 * GET /api/v1/sport-configs/:sport
 * Obtiene configuración de un deporte específico.
 */
router.get('/:sport', requireAuth, async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;
        const { sport } = req.params;

        const { data, error } = await supabase
            .from('sport_configs')
            .select('*')
            .eq('school_id', schoolId)
            .eq('sport', sport)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }

        res.json({ config: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching sport config');
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

/**
 * POST /api/v1/sport-configs
 * Crea o actualiza configuración de deporte (upsert por school_id + sport).
 */
router.post('/',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const parsed = SportConfigSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({ error: 'Datos inválidos', details: parsed.error.issues });
            }

            const { schoolId } = req;

            const { data, error } = await supabase
                .from('sport_configs')
                .upsert(
                    { ...parsed.data, school_id: schoolId },
                    { onConflict: 'school_id,sport' }
                )
                .select()
                .single();

            if (error) {
                if (error.message.includes('sport_configs:')) {
                    return res.status(400).json({ error: error.message });
                }
                throw error;
            }

            res.status(201).json({ config: data });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error saving sport config');
            res.status(500).json({ error: 'Error al guardar configuración de deporte' });
        }
    }
);

/**
 * DELETE /api/v1/sport-configs/:sport
 * Desactiva (soft delete) configuración de un deporte.
 */
router.delete('/:sport',
    requireAuth,
    requireRole('owner', 'admin', 'school_admin'),
    async (req: Request, res: Response) => {
        try {
            const { schoolId } = req;
            const { sport } = req.params;

            const { error } = await supabase
                .from('sport_configs')
                .update({ is_active: false })
                .eq('school_id', schoolId)
                .eq('sport', sport);

            if (error) throw error;
            res.json({ success: true });
        } catch (err) {
            (req as any).log?.error({ err }, 'Error deleting sport config');
            res.status(500).json({ error: 'Error al eliminar configuración' });
        }
    }
);

export default router;
