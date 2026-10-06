/**
 * whatsapp-cola-vencimiento.job — la promesa del acuse tiene plazo (P1 del
 * análisis 2026-10-06).
 *
 * El 06-oct, de 08:00 a 08:55, 15 adjuntos de familias quedaron `pending` en
 * `whatsapp_inbound_queue` sin que nadie se enterara: primero sin worker (0
 * reintentos, sin lease) y después con el OCR fallando en cada vuelta
 * («OCR no disponible: OPENAI_API_KEY no configurada»: el último proveedor de la
 * cadena, o sea que los anteriores también fallaron). A la familia se le había
 * dicho «te confirmo en un momento».
 *
 * Este job, cada 2 minutos:
 *   - ALERTA (log warn + Sentry) si hay filas de más de MIN_ALERTA min sin
 *     desenlace y sin un worker trabajándolas (sin lease vivo);
 *   - VENCE las de más de MIN_VENCIMIENTO min: la conversación va al buzón
 *     (push + correo a la escuela, motivo `comprobante_sin_procesar`) y a la
 *     familia se le escribe UNA vez que la escuela lo revisa
 *     (`escalarComprobanteSinProcesar`). La fila NO se cierra: si el worker la
 *     termina después, su resultado igual le llega a la familia.
 *
 * Tiene su PROPIO kill-switch (DISABLE_WHATSAPP_COLA_VENCIMIENTO), no el de la
 * cola: si alguien apaga la cola (`DISABLE_WHATSAPP_QUEUE_CRON`), este es
 * justamente el que tiene que seguir avisando.
 *
 * Una sola vez por fila: `vencida_at` (migración 2026-10-06), marcada con un
 * UPDATE condicional para que los 3 BFF no avisen tres veces. Sin la columna,
 * el freno es el de `escalarComprobanteSinProcesar` (un mensaje por
 * conversación cada 24 h; push y correo solo en la transición a abierta).
 */

import { supabase } from '../config/supabase';
import type { WhatsAppIntegration } from '../services/whatsapp.service';

export const MIN_ALERTA = 5;
export const MIN_VENCIMIENTO = 10;
const LOTE = 200;

export interface FilaColgada {
    id: string;
    integration_id: string;
    school_id: string;
    wa_phone_number: string;
    status: string;
    locked_until: string | null;
    created_at: string;
    vencida_at?: string | null;
}

/**
 * Pura: de las filas sin desenlace, cuáles alertan y cuáles vencen.
 * «Sin lease vivo»: `pending` (aunque espere un reintento: el OCR caído deja
 * las filas así) o `processing` con el lease ya vencido (un worker murió).
 */
export function clasificarColgadas(filas: FilaColgada[], ahora = Date.now()): {
    alerta: FilaColgada[];
    vencer: FilaColgada[];
} {
    const sinLease = (f: FilaColgada) => f.status === 'pending'
        || (f.status === 'processing' && (!f.locked_until || new Date(f.locked_until).getTime() < ahora));
    const edadMin = (f: FilaColgada) => (ahora - new Date(f.created_at).getTime()) / 60_000;
    // Las ya vencidas no vuelven a alertar: la escuela ya tiene el caso, y una
    // alerta cada 2 min por la misma fila es ruido que se termina ignorando.
    const alerta = filas.filter((f) => sinLease(f) && edadMin(f) >= MIN_ALERTA && !f.vencida_at);
    const vencer = alerta.filter((f) => edadMin(f) >= MIN_VENCIMIENTO);
    return { alerta, vencer };
}

export interface ResultadoVencimiento {
    alerta: number;
    vencidas: number;
    avisadas: number;
    masVieja: string | null;
}

export async function vencerComprobantesColgados(ahora = Date.now()): Promise<ResultadoVencimiento> {
    const corte = new Date(ahora - MIN_ALERTA * 60_000).toISOString();
    // Solo las de los últimos 3 días: más atrás es historia que ya vio alguien.
    const piso = new Date(ahora - 3 * 24 * 3600_000).toISOString();
    const base = 'id, integration_id, school_id, wa_phone_number, status, locked_until, created_at';

    let conColumna = true;
    let { data, error }: { data: any[] | null; error: any } = await supabase.from('whatsapp_inbound_queue')
        .select(`${base}, vencida_at`)
        .in('status', ['pending', 'processing'])
        .lt('created_at', corte)
        .gte('created_at', piso)
        .limit(LOTE);
    if (error) {
        conColumna = false;
        ({ data, error } = await supabase.from('whatsapp_inbound_queue')
            .select(base)
            .in('status', ['pending', 'processing'])
            .lt('created_at', corte)
            .gte('created_at', piso)
            .limit(LOTE));
    }
    if (error) throw new Error(`listar filas colgadas: ${error.message}`);

    const filas = (Array.isArray(data) ? data : []) as FilaColgada[];
    const { alerta, vencer } = clasificarColgadas(filas, ahora);
    const masVieja = alerta.map((f) => f.created_at).sort()[0] ?? null;

    // Agrupado por contacto: cinco fotos de la misma familia son UN aviso.
    const porContacto = new Map<string, FilaColgada[]>();
    for (const f of vencer) {
        const k = `${f.integration_id}|${f.wa_phone_number}`;
        porContacto.set(k, [...(porContacto.get(k) ?? []), f]);
    }

    let vencidas = 0;
    let avisadas = 0;
    const { escalarComprobanteSinProcesar } = await import('../services/whatsapp-bot.service');

    for (const grupo of porContacto.values()) {
        let ids = grupo.map((f) => f.id);
        if (conColumna) {
            const { data: marcadas, error: errMarca } = await supabase.from('whatsapp_inbound_queue')
                .update({ vencida_at: new Date(ahora).toISOString() })
                .in('id', ids)
                .is('vencida_at', null)
                .select('id');
            if (errMarca) { console.warn('[wa-vencimiento] no se pudo marcar', errMarca.message); continue; }
            ids = (Array.isArray(marcadas) ? marcadas : []).map((m: any) => m.id);
            if (!ids.length) continue;   // otro BFF ya las tomó
        }
        vencidas += ids.length;

        const f = grupo[0];
        try {
            const { data: integration } = await supabase.from('school_whatsapp_integrations')
                .select('*').eq('id', f.integration_id).maybeSingle();
            const { data: conv } = await supabase.from('whatsapp_conversations')
                .select('id').eq('integration_id', f.integration_id).eq('contact_wa_id', f.wa_phone_number)
                .maybeSingle();
            if (!integration || !(conv as any)?.id) continue;
            const r = await escalarComprobanteSinProcesar(
                integration as WhatsAppIntegration, (conv as any).id, f.wa_phone_number);
            if (r === 'avisado') avisadas++;
        } catch (e: any) {
            console.error('[wa-vencimiento] no se pudo escalar', { filas: ids, err: e?.message });
        }
    }

    return { alerta: alerta.length, vencidas, avisadas, masVieja };
}
