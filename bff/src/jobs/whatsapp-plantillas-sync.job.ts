/**
 * whatsapp-plantillas-sync.job — cada 30 min trae de Meta el estado de las
 * plantillas de cada WABA conectada y lo deja en whatsapp_template_status.
 *
 * Por qué polling y no solo el webhook: el 2026-10-04 se registraron 10
 * plantillas en la WABA de Dynasty y en whatsapp_account_events NO llegó ningún
 * evento de esa WABA (sí llegan los de la WABA de prueba). Depender del webhook
 * habría dejado la cobranza de Dynasty sin plantillas aunque Meta las aprobara.
 * El listado es la verdad; el webhook es el respaldo cuando Graph falla
 * (sincronizarPlantillas lo aplica solo).
 *
 * Costo: un GET paginado por integración activa (2 hoy). Muy por debajo del
 * límite de la Graph API.
 */

import { supabase } from '../config/supabase';
import { sincronizarPlantillas, type ResultadoSync } from '../services/whatsapp-plantillas.service';

export async function runWhatsAppPlantillasSync(): Promise<{ integraciones: number; fallidas: number; resultados: ResultadoSync[] }> {
    const { data, error } = await supabase
        .from('school_whatsapp_integrations')
        .select('id')
        .eq('status', 'active')
        .not('waba_id', 'is', null);
    if (error || !data?.length) return { integraciones: 0, fallidas: 0, resultados: [] };

    const resultados: ResultadoSync[] = [];
    // En serie: son pocas y así un token roto de una escuela no tapa los logs de otra.
    for (const { id } of data as { id: string }[]) {
        try {
            resultados.push(await sincronizarPlantillas(id));
        } catch (err: any) {
            resultados.push({ integrationId: id, ok: false, fuente: 'ninguna', plantillas: 0, aprobadas: 0, error: err?.message });
        }
    }
    const fallidas = resultados.filter((r) => !r.ok);
    for (const f of fallidas) {
        console.warn('[wa-plantillas-sync] no se pudo listar en Meta', { integrationId: f.integrationId, error: f.error, respaldo: f.fuente });
    }
    return { integraciones: resultados.length, fallidas: fallidas.length, resultados };
}
