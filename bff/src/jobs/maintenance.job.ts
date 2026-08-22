import cron from 'node-cron';
import { supabase } from '../config/supabase';
import {
    createTransactionWithToken,
    copToCents,
} from '../services/wompi.service';
import { reprocessOrphanWebhooks } from '../services/webhook-reprocess.service';
import { autoEmitPendingInvoices, autoEmitPendingMarketplaceInvoices, autoEmitPendingOrders } from '../services/invoicing.service';
import { runGlosaNotifications } from './glosa-notifications.job';
import { runNotificationDispatch } from './notifications-dispatch.job';
import { runAthleteReportsCycle } from './athlete-reports.job';
import { runHourBankAutoclose } from './hour-bank-autoclose.job';

/**
 * Inicia los trabajos de mantenimiento programados para el BFF.
 */
export function initMaintenanceJobs() {
    // ────────────────────────────────────────────────────────────────────────
    // Mantenimiento diario de sesiones (auto_finalize_stale_sessions +
    // refresh_session_health): NO va acá. Lo corre pg_cron en la base, job
    // `auto-finalize-stale-sessions`, a las 04:55 UTC — que son las 23:55 COT,
    // exactamente el minuto en que corría este bloque. Eran dos disparos
    // simultáneos de las mismas dos RPCs desde dos lados.
    //
    // Se dejó el de pg_cron porque es SQL puro: no depende de que el proceso
    // del BFF esté vivo ni de un redeploy de Render, y se ahorra el viaje de
    // red. Si alguna vez hay que devolverlo acá, primero hay que quitar el job
    // de la base (`SELECT cron.unschedule('auto-finalize-stale-sessions')`),
    // no dejar los dos.
    // ────────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────────
    // Auto-cobro de suscripciones recurrentes con token Wompi
    //
    // Frecuencia: 02:00 COT cada día. Recorre `subscriptions_due_for_billing`
    // (vista que filtra suscripciones con auto_renew=true y next_billing_date
    // vencida) y crea una transaccion server-to-server contra Wompi usando el
    // token guardado. Al exito, marca paid + avanza next_billing_date un mes;
    // al fallo, registra last_billing_error y marca para review del negocio.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('0 2 * * *', async () => {
        // Kill-switch: este es el autopay LEGACY (tabla `subscriptions`). El canonico
        // es `recurring_subscriptions` (pg_cron -> /api/v1/recurring/run). Mientras ambos
        // coexistan, poner DISABLE_LEGACY_SUBSCRIPTION_AUTOPAY=true para apagar este sin
        // redeploy de codigo. Ver auditoria H-01.
        if (process.env.DISABLE_LEGACY_SUBSCRIPTION_AUTOPAY === 'true') {
            console.log('[CRON] Auto-cobro legacy de suscripciones DESACTIVADO por env.');
            return;
        }
        console.log('[CRON] Iniciando auto-cobro de suscripciones...');
        try {
            const { data: dueSubs, error } = await supabase
                .from('subscriptions_due_for_billing')
                .select('*');

            if (error) {
                console.error('[CRON] Error consultando subscriptions_due_for_billing:', error.message);
                return;
            }

            if (!dueSubs || dueSubs.length === 0) {
                console.log('[CRON] No hay suscripciones por cobrar hoy.');
                return;
            }

            console.log(`[CRON] Procesando ${dueSubs.length} cobros de suscripcion...`);

            for (const sub of dueSubs) {
                if (!sub.wompi_token || !sub.price) continue;

                const { data: userInfo } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', sub.user_id)
                    .single();

                if (!userInfo?.email) {
                    await supabase
                        .from('subscriptions')
                        .update({
                            last_billing_attempt_at: new Date().toISOString(),
                            last_billing_error: 'no_user_email',
                        })
                        .eq('id', sub.subscription_id);
                    continue;
                }

                // Referencia DETERMINISTICA por (sub, periodo YYYY-MM). Asi:
                //  - dos replicas del BFF que corran el cron a la vez colisionan en el
                //    INSERT (idx_marketplace_tx_provider_ref unico) -> solo una cobra.
                //  - si next_billing_date no avanza (llega tarde el webhook) y el cron
                //    re-corre al dia siguiente, el mismo periodo choca -> no re-cobra.
                // Ver auditoria H-01. El prefijo SUB- lo rutea el webhook a marketplace.
                const periodKey = new Date().toISOString().slice(0, 7); // YYYY-MM
                const reference = `SUB-${String(sub.subscription_id).slice(0, 8)}-${periodKey}`;
                const amountInCents = copToCents(Number(sub.price));

                // Crear marketplace_transaction antes de cobrar (para que webhook reconcilie).
                // provider_reference + payment_provider activan el unico parcial
                // idx_marketplace_tx_provider_ref (payment_provider, provider_reference).
                const { data: tx, error: txErr } = await supabase
                    .from('marketplace_transactions')
                    .insert({
                        user_id: sub.user_id,
                        checkout_type: 'subscription',
                        subscription_id: sub.subscription_id,
                        gross_amount: Number(sub.price),
                        payment_provider: 'wompi',
                        provider_reference: reference,
                        wompi_reference: reference,
                        status: 'pending',
                        description: `Renovacion auto: ${sub.plan_name || 'plan'}`,
                    })
                    .select('id')
                    .single();

                // 23505 = unique_violation: ya existe una tx para esta sub en este
                // periodo -> otro proceso/corrida ya inicio el cobro. Saltar (idempotente).
                if (txErr) {
                    if ((txErr as any).code === '23505') {
                        console.log(`[CRON] Cobro ya iniciado este periodo sub=${sub.subscription_id} (${periodKey}); saltando.`);
                    } else {
                        console.error(`[CRON] Error creando marketplace_transaction sub=${sub.subscription_id}: ${txErr.message}`);
                    }
                    continue;
                }

                const result = await createTransactionWithToken({
                    paymentToken: sub.wompi_token,
                    amountInCents,
                    reference,
                    customerEmail: userInfo.email,
                });

                if (!result.ok) {
                    console.warn(`[CRON] Cobro fallido sub=${sub.subscription_id}: ${result.error}`);
                    await supabase
                        .from('subscriptions')
                        .update({
                            last_billing_attempt_at: new Date().toISOString(),
                            last_billing_error: result.error,
                        })
                        .eq('id', sub.subscription_id);

                    if (tx?.id) {
                        await supabase.rpc('flag_payment_for_review', {
                            p_kind: 'marketplace_transaction',
                            p_id: tx.id,
                            p_reason: `autopay_failed: ${result.error}`,
                        });
                    }
                    continue;
                }

                // Wompi crea la tx pero el resultado real llega via webhook.
                // Marcar el intento; cuando llegue APPROVED, el webhook actualiza next_billing_date.
                await supabase
                    .from('subscriptions')
                    .update({
                        last_billing_attempt_at: new Date().toISOString(),
                        last_billing_error: null,
                    })
                    .eq('id', sub.subscription_id);

                console.log(`[CRON] Cobro iniciado sub=${sub.subscription_id} txWompi=${result.transactionId} status=${result.status}`);
            }

            console.log('[CRON] Auto-cobro de suscripciones completado.');
        } catch (err: any) {
            console.error('[CRON] Error inesperado en auto-cobro:', err?.message || err);
        }
    }, { timezone: 'America/Bogota' });

    console.log('[CRON] Auto-cobro de suscripciones registrado para las 02:00 COT.');

    // ────────────────────────────────────────────────────────────────────────
    // Reproceso de webhooks huerfanos (Fix H-03). Cada 10 min reintenta los
    // eventos 'orphan'/'failed' cuya entidad local ya deberia existir. El claim
    // atomico dentro del runner evita doble-proceso entre replicas.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('*/10 * * * *', async () => {
        try {
            const r = await reprocessOrphanWebhooks(100);
            if (r.scanned > 0) {
                console.log(`[CRON] Reproceso webhooks: scanned=${r.scanned} processed=${r.processed} stillOrphan=${r.stillOrphan} failed=${r.failed} gaveUp=${r.gaveUp}`);
            }
        } catch (err: any) {
            console.error('[CRON] Error en reproceso de webhooks:', err?.message || err);
        }
    });

    console.log('[CRON] Reproceso de webhooks huerfanos registrado (cada 10 min).');

    // ────────────────────────────────────────────────────────────────────────
    // Conciliacion diaria de pagos (Fix H-04). Detecta duplicados internos y
    // webhooks huerfanos estancados, los registra en payment_anomalies y alerta
    // por logs las criticas (visibles en el monitoreo del BFF). 03:30 COT.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('30 3 * * *', async () => {
        console.log('[CRON] Iniciando conciliacion de pagos...');
        try {
            const { data, error } = await supabase.rpc('detect_payment_anomalies');
            if (error) {
                console.error('[CRON] detect_payment_anomalies error:', error.message);
                return;
            }
            const r = (data ?? {}) as Record<string, number>;
            const criticas = (r.duplicate_split ?? 0) + (r.duplicate_marketplace ?? 0);
            if (criticas > 0) {
                // ALERTA critica: posible doble cobro/contabilizacion detectado.
                console.error(`[ALERT][pagos] Anomalias CRITICAS nuevas: duplicate_split=${r.duplicate_split ?? 0} duplicate_marketplace=${r.duplicate_marketplace ?? 0}. Revisar payment_anomalies (status='open').`);
            }
            console.log(`[CRON] Conciliacion: dupSplit=${r.duplicate_split ?? 0} dupMkt=${r.duplicate_marketplace ?? 0} rapid=${r.rapid_duplicate ?? 0} staleWebhook=${r.stale_orphan_webhook ?? 0}`);
        } catch (err: any) {
            console.error('[CRON] Error en conciliacion de pagos:', err?.message || err);
        }
    }, { timezone: 'America/Bogota' });

    console.log('[CRON] Conciliacion de pagos registrada para las 03:30 COT.');

    // ────────────────────────────────────────────────────────────────────────
    // Auto-facturación electrónica (trigger automático). Cada 15 min emite la
    // factura de los pagos 'paid' recientes de escuelas con facturador activo
    // que aún no tienen documento. Idempotente; cubre todos los caminos a
    // 'paid' (checkout, webhook, aprobación manual, recurrente).
    // Kill-switch: DISABLE_AUTO_INVOICING=true.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('*/15 * * * *', async () => {
        if (process.env.DISABLE_AUTO_INVOICING === 'true') return;
        try {
            const r = await autoEmitPendingInvoices();
            if (r.scanned > 0) {
                console.log(`[CRON] Auto-facturación (escuela): scanned=${r.scanned} emitted=${r.emitted} skipped=${r.skipped} failed=${r.failed}`);
            }
        } catch (err: any) {
            console.error('[CRON] Error en auto-facturación (escuela):', err?.message || err);
        }
        try {
            const rm = await autoEmitPendingMarketplaceInvoices();
            if (rm.scanned > 0) {
                console.log(`[CRON] Auto-facturación (marketplace): scanned=${rm.scanned} emitted=${rm.emitted} skipped=${rm.skipped} failed=${rm.failed}`);
            }
        } catch (err: any) {
            console.error('[CRON] Error en auto-facturación (marketplace):', err?.message || err);
        }
        try {
            const ro = await autoEmitPendingOrders();
            if (ro.scanned > 0) {
                console.log(`[CRON] Auto-facturación (tienda/orders): scanned=${ro.scanned} emitted=${ro.emitted} skipped=${ro.skipped} failed=${ro.failed}`);
            }
        } catch (err: any) {
            console.error('[CRON] Error en auto-facturación (tienda/orders):', err?.message || err);
        }
    });

    console.log('[CRON] Auto-facturación electrónica registrada (cada 15 min).');

    // ────────────────────────────────────────────────────────────────────────
    // Correos de glosa que el cron SQL no puede mandar: recordatorio "vence
    // mañana" y ratificación automática. 08:05 COT (después del pg_cron de
    // ratificación 08:00 UTC/03:00 COT — ya ratificó lo vencido). Idempotente
    // por claim atómico sobre reminder_sent_at / ratify_email_sent_at.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('5 8 * * *', async () => {
        try {
            await runGlosaNotifications();
        } catch (err: any) {
            console.error('[CRON] Error en notificaciones de glosa:', err?.message || err);
        }
    }, { timezone: 'America/Bogota' });

    console.log('[CRON] Notificaciones de glosa registradas para las 08:05 COT.');

    // ────────────────────────────────────────────────────────────────────────
    // Ciclo diario del Informe Mensual (F5): genera borradores, publica lo que
    // vence hoy y envía lo publicado sin marcar sent_at. Kill-switch por env
    // mientras se prueba en una escuela piloto.
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('10 6 * * *', async () => {
        if (process.env.DISABLE_ATHLETE_REPORTS_CRON === 'true') return;
        try {
            await runAthleteReportsCycle();
        } catch (err: any) {
            console.error('[CRON] Error en ciclo de informes:', err?.message || err);
        }
    }, { timezone: 'America/Bogota' });

    console.log('[CRON] Ciclo de informes registrado para las 06:10 COT.');

    // ────────────────────────────────────────────────────────────────────────
    // Despachador unificado (F1) — red de seguridad. Drena el outbox
    // notification_deliveries cada minuto: cubre fallos de pg_net, BFF caído,
    // reintentos con backoff y crashes entre claim y envío (lease expira).
    // No-op si NOTIF_DISPATCH_ENABLED != 'true'. Claim por lease (idempotente).
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('* * * * *', async () => {
        try {
            await runNotificationDispatch();
        } catch (err: any) {
            console.error('[CRON] Error en despacho de notificaciones:', err?.message || err);
        }
    });

    console.log('[CRON] Despachador de notificaciones registrado (cada minuto).');

    // ────────────────────────────────────────────────────────────────────────
    // Banco de horas por torniquete (F5) — auto-cierre de visitas 'open' que
    // pasaron la hora de cierre de su día de inicio o el tope de seguridad.
    // NO factura (eso es del owner al corregir). No-op mientras
    // hours_plan_enabled siga en false en todas las escuelas.
    // Ver docs/specs/dreamers-banco-de-horas-torniquete.md
    // ────────────────────────────────────────────────────────────────────────
    cron.schedule('*/15 * * * *', async () => {
        try {
            await runHourBankAutoclose();
        } catch (err: any) {
            console.error('[CRON] Error en auto-cierre de banco de horas:', err?.message || err);
        }
    });

    console.log('[CRON] Auto-cierre de banco de horas registrado (cada 15 min).');
}
