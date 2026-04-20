import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middlewares/authMiddleware';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * GET /api/v1/trainer/profile
 * Obtener el perfil propio del entrenador personal.
 */
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
    try {
        const { user, schoolId } = req;

        const { data, error } = await supabase
            .from('trainer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .eq('school_id', schoolId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Perfil de entrenador no encontrado.' });

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer profile');
        res.status(500).json({ error: 'Error al obtener perfil del entrenador.' });
    }
});

/**
 * PUT /api/v1/trainer/profile
 * Actualizar el perfil del entrenador (campos de trainer_profiles).
 */
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
    try {
        const { user, schoolId } = req;

        const allowedFields = [
            'display_name', 'tagline', 'bio', 'avatar_url', 'cover_image_url',
            'primary_sport', 'secondary_sports', 'specialties', 'experience_years',
            'certifications', 'gallery_urls', 'rate_per_session', 'rate_currency',
            'rate_notes', 'city', 'address', 'lat', 'lng', 'modality',
            'instagram_url', 'whatsapp_number',
        ];

        const updates: Record<string, any> = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('trainer_profiles')
            .update(updates)
            .eq('user_id', user.id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating trainer profile');
        res.status(500).json({ error: 'Error al actualizar perfil del entrenador.' });
    }
});

/**
 * POST /api/v1/trainer/profile/publish
 * Publicar el perfil del entrenador (is_published = true).
 */
router.post('/profile/publish', requireAuth, async (req: Request, res: Response) => {
    try {
        const { user, schoolId } = req;

        const { data, error } = await supabase
            .from('trainer_profiles')
            .update({ is_published: true, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, profile: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error publishing trainer profile');
        res.status(500).json({ error: 'Error al publicar perfil.' });
    }
});

/**
 * GET /api/v1/trainer/public/:userId
 * Ver perfil público de un entrenador (sin auth).
 */
router.get('/public/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('trainer_profiles')
            .select(
                'id, user_id, school_id, display_name, tagline, bio, avatar_url, cover_image_url, ' +
                'primary_sport, secondary_sports, specialties, experience_years, certifications, ' +
                'gallery_urls, rate_per_session, rate_currency, rate_notes, city, address, ' +
                'lat, lng, modality, instagram_url, whatsapp_number, rating, review_count, created_at'
            )
            .eq('user_id', userId)
            .eq('is_published', true)
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Perfil no encontrado o no publicado.' });

        res.json(data);
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching public trainer profile');
        res.status(500).json({ error: 'Error al obtener perfil público.' });
    }
});

export default router;
