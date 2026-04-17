import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';

const router = Router();

/**
 * GET /api/v1/trainer/onboarding/status
 * Leer onboarding_step y onboarding_status de la escuela del trainer.
 */
router.get('/onboarding/status', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        const { data, error } = await supabase
            .from('schools')
            .select('id, onboarding_status, onboarding_step, school_type')
            .eq('id', schoolId)
            .eq('school_type', 'personal_trainer')
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            // Si no hay escuela todavía, devolvemos un status dummy para que inicie en el paso 1
            return res.json({
                school_id: null,
                onboarding_status: 'pending',
                onboarding_step: 1,
            });
        }

        res.json({
            school_id: data.id,
            onboarding_status: data.onboarding_status,
            onboarding_step: data.onboarding_step,
        });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error fetching trainer onboarding status');
        res.status(500).json({ error: 'Error al obtener estado del onboarding.' });
    }
});

/**
 * POST /api/v1/trainer/onboarding/step
 * Guardar progreso de un paso y avanzar al siguiente.
 * Body: { step: number, data: object }
 */
router.post('/onboarding/step', async (req: Request, res: Response) => {
    try {
        const { schoolId, user } = req;
        const { step, data: stepData } = req.body;

        if (typeof step !== 'number' || step < 1 || step > 6) {
            return res.status(400).json({ error: 'El paso debe ser un número entre 1 y 6.' });
        }

        let currentSchoolId = schoolId;

        // ==========================================
        //  PROVISIONING LOGIC (Solo ocurre si schoolId está vacío en el Step 1)
        // ==========================================
        if (!currentSchoolId) {
            if (step !== 1) return res.status(400).json({ error: 'El onboarding debe inicializarse desde el paso 1.' });

            // 1. Insertar escuela
            const { data: newSchool, error: schoolErr } = await supabase
                .from('schools')
                .insert({
                    name: `Entrenador Personal - Workspace`,
                    school_type: 'personal_trainer',
                    owner_id: user.id,
                    onboarding_status: 'in_progress',
                    onboarding_step: 2,
                    email: user.email
                })
                .select('id')
                .single();

            if (schoolErr) throw schoolErr;
            currentSchoolId = newSchool.id;

            // 2. Insertar settings
            await supabase.from('school_settings').insert({ school_id: currentSchoolId });

            // 3. Insertar trainer profile
            await supabase.from('trainer_profiles').insert({
                school_id: currentSchoolId,
                user_id: user.id,
                primary_sport: stepData?.primary_sport || null,
                secondary_sports: stepData?.secondary_sports || [],
                specialties: stepData?.specialties || [],
                experience_years: stepData?.experience_years || null
            });

            return res.json({ success: true, current_step: 1, next_step: 2 });
        }

        // Guardar datos del paso en trainer_profiles y/o schools según el paso
        const trainerUpdates: Record<string, any> = {};
        const schoolUpdates: Record<string, any> = {};

        switch (step) {
            case 1: // Deporte principal y especialidades
                if (stepData?.primary_sport) trainerUpdates.primary_sport = stepData.primary_sport;
                if (stepData?.secondary_sports) trainerUpdates.secondary_sports = stepData.secondary_sports;
                if (stepData?.specialties) trainerUpdates.specialties = stepData.specialties;
                if (stepData?.experience_years) trainerUpdates.experience_years = stepData.experience_years;
                break;
            case 2: // Modalidad y ciudad
                if (stepData?.modality) trainerUpdates.modality = stepData.modality;
                if (stepData?.city) {
                    trainerUpdates.city = stepData.city;
                    schoolUpdates.city = stepData.city;
                }
                if (stepData?.address) trainerUpdates.address = stepData.address;
                break;
            case 3: // Disponibilidad básica — se gestiona via availability routes
                break;
            case 4: // Plan de precios / tarifa
                if (stepData?.rate_per_session !== undefined) trainerUpdates.rate_per_session = stepData.rate_per_session;
                if (stepData?.rate_currency) trainerUpdates.rate_currency = stepData.rate_currency;
                if (stepData?.rate_notes) trainerUpdates.rate_notes = stepData.rate_notes;
                break;
            case 5: // Configuración de pagos
                if (stepData?.payment_settings) {
                    const { payment_settings } = stepData;
                    const { error: settingsErr } = await supabase
                        .from('school_settings')
                        .update({
                            nequi_number: payment_settings.nequi_number || null,
                            bank_name: payment_settings.bank_name || null
                        })
                        .eq('school_id', currentSchoolId);
                    if (settingsErr) throw settingsErr;
                }
                if (stepData?.whatsapp_number) trainerUpdates.whatsapp_number = stepData.whatsapp_number;
                break;
            case 6: // Foto de perfil y bio
                if (stepData?.avatar_url) trainerUpdates.avatar_url = stepData.avatar_url;
                if (stepData?.bio) trainerUpdates.bio = stepData.bio;
                if (stepData?.display_name) {
                    trainerUpdates.display_name = stepData.display_name;
                    schoolUpdates.name = stepData.display_name;
                }
                if (stepData?.tagline) trainerUpdates.tagline = stepData.tagline;
                break;
        }

        // Actualizar trainer_profiles si hay datos para ese paso
        if (Object.keys(trainerUpdates).length > 0) {
            trainerUpdates.updated_at = new Date().toISOString();
            const { error: profileErr } = await supabase
                .from('trainer_profiles')
                .update(trainerUpdates)
                .eq('school_id', currentSchoolId)
                .eq('user_id', user.id);
            if (profileErr) throw profileErr;
        }

        // Actualizar schools si hay datos (city, name, onboarding_step)
        const nextStep = step + 1;
        const finalSchoolUpdates = { ...schoolUpdates, onboarding_step: nextStep };
        
        const { error: schoolErr } = await supabase
            .from('schools')
            .update(finalSchoolUpdates)
            .eq('id', currentSchoolId);
        if (schoolErr) throw schoolErr;

        res.json({ success: true, current_step: step, next_step: nextStep });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error saving trainer onboarding step');
        res.status(500).json({ error: 'Error al guardar paso del onboarding.' });
    }
});

/**
 * POST /api/v1/trainer/onboarding/complete
 * Marcar onboarding_status = 'completed' en schools.
 */
router.post('/onboarding/complete', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req;

        const { error } = await supabase
            .from('schools')
            .update({ onboarding_status: 'completed', onboarding_step: 7 })
            .eq('id', schoolId)
            .eq('school_type', 'personal_trainer');

        if (error) throw error;

        res.json({ success: true, onboarding_status: 'completed' });
    } catch (err) {
        (req as any).log?.error({ err }, 'Error completing trainer onboarding');
        res.status(500).json({ error: 'Error al completar el onboarding.' });
    }
});

export default router;
