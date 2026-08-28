// account-deletion.job — ejecuta el borrado físico que
// request_account_deletion() (migración 20260522141000_security_hardening_p1.sql)
// dejó prometido pero sin construir: "El borrado fisico (anonimizacion) lo
// ejecuta un job aparte que corre diariamente".
//
// Por qué anonimizar en vez de borrar la fila: profiles.id referencia
// auth.users(id) ON DELETE CASCADE. Si este job llamara
// auth.admin.deleteUser(), Postgres cascadearía el borrado de `profiles` —
// y con eso, potencialmente cualquier tabla de la escuela (pagos,
// inscripciones, relación con el equipo) que dependa de ese profile_id sin
// tener su propia lógica de conservación. La escuela sigue necesitando su
// propio historial de pagos/asistencia aunque el padre borre su cuenta.
// Por eso: se anonimiza `profiles` (se pierden nombre/telefono/foto/etc.)
// y se banea el login en auth.users — la fila y sus referencias sobreviven,
// los datos personales no.
//
// No se toca `recurring_subscriptions` ni `payment_tokens` acá: eso ya lo
// hizo request_account_deletion() de inmediato al solicitarse el borrado.

import { supabase } from '../config/supabase';

const BATCH_LIMIT = 200;
// ~100 años: no existe "ban permanente" real en GoTrue, se emula con una
// duración enorme. Revertible manualmente si algún día hace falta (soporte).
const PERMANENT_BAN_DURATION = '876000h';

export interface AccountDeletionCycleResult {
    processed: number;
    failed: number;
}

export async function runAccountDeletionCycle(): Promise<AccountDeletionCycleResult> {
    const { data: due, error } = await supabase
        .from('account_deletion_requests')
        .select('id, user_id')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .limit(BATCH_LIMIT);

    if (error) {
        console.error('[account-deletion] error consultando requests vencidas:', error.message);
        return { processed: 0, failed: 0 };
    }
    if (!due || due.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;

    for (const row of due as { id: string; user_id: string }[]) {
        try {
            const { error: profileErr } = await supabase
                .from('profiles')
                .update({
                    full_name: 'Usuario eliminado',
                    email: `deleted-${row.user_id}@sportmaps.invalid`,
                    phone: null,
                    avatar_url: null,
                    bio: null,
                    date_of_birth: null,
                    location: null,
                    metadata: {},
                })
                .eq('id', row.user_id);

            if (profileErr) throw new Error(`profiles: ${profileErr.message}`);

            // Bloquea login futuro. NO se usa deleteUser (ver comentario de cabecera).
            const { error: banErr } = await supabase.auth.admin.updateUserById(row.user_id, {
                ban_duration: PERMANENT_BAN_DURATION,
            });
            if (banErr) throw new Error(`auth.admin: ${banErr.message}`);

            await supabase
                .from('account_deletion_requests')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', row.id);

            processed++;
        } catch (err: any) {
            failed++;
            const message = err?.message || String(err);
            console.error(`[account-deletion] fila ${row.id} (user ${row.user_id}) falló:`, message);
            await supabase
                .from('account_deletion_requests')
                .update({ status: 'failed', error_message: message.slice(0, 500) })
                .eq('id', row.id);
        }
    }

    console.log(`[account-deletion] processed=${processed} failed=${failed}`);
    return { processed, failed };
}
