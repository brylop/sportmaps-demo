// saas-billing-cycle.job — ciclo diario de facturación SaaS SportMaps →
// escuelas (Fase 1). Llama a la RPC run_saas_billing_cycle() (SQL puro:
// flip a overdue, avanza período, genera la próxima factura, calcula
// recordatorios) y por cada fila que necesita salir, genera el PDF (si
// falta) y manda email + push vía sendSaasInvoice. El push in-app no pasa
// por acá — ya sale directo del insert en `notifications` dentro de
// sendSaasInvoice, con su propio dispatcher (notifications-dispatch.job.ts).
//
// Por qué vive acá y no en pg_cron + Edge Function: ver el comentario de
// cabecera de supabase/migrations/20260824180914_saas_billing_ciclo_automatico.sql.

import { supabase } from '../config/supabase';
import { sendSaasInvoice, SaasInvoiceSendReason } from '../services/saasInvoicing.service';

export interface SaasBillingCycleResult {
    processed: number;
    failed: number;
}

export async function runSaasBillingCycle(): Promise<SaasBillingCycleResult> {
    const { data: rows, error } = await supabase.rpc('run_saas_billing_cycle');
    if (error) {
        console.error('[saas-billing-cycle] run_saas_billing_cycle falló:', error.message);
        return { processed: 0, failed: 0 };
    }
    if (!rows || rows.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;

    for (const row of rows as { invoice_id: string; kind: SaasInvoiceSendReason }[]) {
        try {
            const result = await sendSaasInvoice(row.invoice_id, row.kind);
            if (result.ok) processed++;
            else failed++;
        } catch (err: any) {
            failed++;
            console.warn('[saas-billing-cycle] fila falló:', { invoiceId: row.invoice_id, kind: row.kind, err: err?.message || err });
        }
    }

    console.log(`[saas-billing-cycle] processed=${processed} failed=${failed}`);
    return { processed, failed };
}
