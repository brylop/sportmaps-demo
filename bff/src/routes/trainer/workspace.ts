import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * GET /api/v1/trainer/workspace
 * Retorna school_id, school_settings y trainer_profile combinados.
 */
router.get('/workspace', async (req: Request, res: Response) => {
    try {
        const { schoolId, user } = req;

        const [schoolRes, settingsRes, profileRes] = await Promise.all([
            supabase
                .from('schools')
                .select('id, name, school_type, onboarding_status, onboarding_step, email, phone')
                .eq('id', schoolId)
                .eq('school_type', 'personal_trainer')
                .maybeSingle(),
            supabase
                .from('school_settings')
                .select('*')
                .eq('school_id', schoolId)
                .maybeSingle(),
            supabase
                .from('trainer_profiles')
                .select('*')
                .eq('school_id', schoolId)
                .eq('user_id', user.id)
                .maybeSingle(),
        ]);

        if (schoolRes.error) throw schoolRes.error;
        if (!schoolRes.data) {
            return res.status(404).json({ error: 'Workspace de entrenador no encontrado.' });
        }

        res.json({
            school: schoolRes.data,
            settings: settingsRes.data ?? null,
            trainer_profile: profileRes.data ?? null,
        });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer workspace');
        res.status(500).json({ error: 'Error al obtener workspace del entrenador.' });
    }
});

/**
 * PUT /api/v1/trainer/workspace/payment-settings
 * Actualiza bank/nequi/daviplata en school_settings.
 */
router.put('/workspace/payment-settings', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        const allowedFields = [
            'payment_methods', 'bank_name', 'bank_account_number', 'bank_account_type',
            'nequi_number', 'daviplata_number', 'payment_notes',
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

        const { data, error } = await supabase
            .from('school_settings')
            .upsert({ school_id: schoolId, ...updates })
            .eq('school_id', schoolId)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, settings: data });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error updating trainer payment settings');
        res.status(500).json({ error: 'Error al actualizar configuración de pagos.' });
    }
});

export default router;
