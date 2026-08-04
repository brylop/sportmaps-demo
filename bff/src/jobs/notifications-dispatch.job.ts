// bff/src/jobs/notifications-dispatch.job.ts
//
// Worker (red de seguridad) del despachador unificado. Drena el outbox
// `notification_deliveries`: filas pending/failed cuyo lease ya venció
// (next_attempt_at <= now) y que no agotaron intentos.
//
// Cubre: (a) fallos de pg_net / BFF caído, (b) reintentos con backoff,
// (c) CRASH entre claim y envío (el lease de 2min expira y aquí se retoma).
//
// try/catch POR FILA: una fila que explota no tumba el resto del lote.
// Corre cada minuto (node-cron) desde initMaintenanceJobs.

import { supabase } from '../config/supabase';
import { claimRow, dispatchDelivery } from '../services/notification.service';

const BATCH = 50;

export async function runNotificationDispatch(): Promise<{ claimed: number; failed: number }> {
    // Gate de despliegue (idéntico al endpoint): apagado → no-op.
    if (process.env.NOTIF_DISPATCH_ENABLED !== 'true') return { claimed: 0, failed: 0 };

    const nowIso = new Date().toISOString();

    const { data: candidates, error } = await supabase
        .from('notification_deliveries')
        .select('*')
        .in('status', ['pending', 'failed'])
        .lte('next_attempt_at', nowIso)
        .order('next_attempt_at', { ascending: true })
        .limit(BATCH);

    if (error || !candidates || candidates.length === 0) {
        return { claimed: 0, failed: 0 };
    }

    let claimed = 0;
    let failed = 0;

    for (const c of candidates as any[]) {
        // El filtro attempts < max_attempts no se puede expresar en el query
        // (columna vs columna), se aplica aquí.
        if (c.attempts >= c.max_attempts) continue;
        try {
            const leased = await claimRow(c); // lease optimista; null si otro lo tomó
            if (!leased) continue;
            claimed++;
            await dispatchDelivery(leased);
        } catch (err: any) {
            failed++;
            console.warn('[notif-dispatch] fila falló (se reintentará tras el lease):', {
                id: c.id, err: err?.message || err,
            });
        }
    }

    if (claimed > 0 || failed > 0) {
        console.log(`[notif-dispatch] claimed=${claimed} failed=${failed}`);
    }
    return { claimed, failed };
}
