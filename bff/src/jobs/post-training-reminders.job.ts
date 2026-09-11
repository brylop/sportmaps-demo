/**
 * post-training-reminders.job — F2 de "Evaluación Post-Entrenamiento"
 * (docs/specs/evaluacion-post-entrenamiento.md §4).
 *
 * Toda la lógica pesada vive en las RPCs de sistema
 * (post_training_send_parent_reminders_system /
 * post_training_send_coach_reminders_system) — este job solo dispara y loguea,
 * mismo patrón que athlete-reports.job.ts.
 */
import { supabase } from '../config/supabase';

export async function runPostTrainingReminders(): Promise<{
    parentReminders: number;
    coachReminders: number;
}> {
    let parentReminders = 0;
    let coachReminders = 0;

    const { data: parentCount, error: parentErr } = await supabase.rpc(
        'post_training_send_parent_reminders_system'
    );
    if (parentErr) {
        console.error('[post-training-cron] recordatorio a padres falló:', parentErr.message);
    } else {
        parentReminders = parentCount ?? 0;
    }

    const { data: coachCount, error: coachErr } = await supabase.rpc(
        'post_training_send_coach_reminders_system'
    );
    if (coachErr) {
        console.error('[post-training-cron] recordatorio a coaches falló:', coachErr.message);
    } else {
        coachReminders = coachCount ?? 0;
    }

    if (parentReminders > 0 || coachReminders > 0) {
        console.log(
            `[post-training-cron] recordatorios_padres=${parentReminders} recordatorios_coaches=${coachReminders}`
        );
    }

    return { parentReminders, coachReminders };
}
