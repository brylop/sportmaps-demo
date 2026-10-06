/**
 * whatsapp-turno-agrupado — P5 del análisis 2026-10-06: un turno por RÁFAGA,
 * nunca dos turnos a la vez en la misma conversación.
 *
 * Medido el 06-oct en Dynasty: el 64 % de los entrantes llega a menos de 60 s
 * del anterior en la misma conversación («Hola Milena» → «Buen día» → «Cómo
 * vas?» → foto → «👆»). El webhook corría un turno por mensaje, en paralelo:
 * `e9ed4b64` recibió 4 salientes en 2 s, fuera de orden, con dos estados de pago
 * idénticos a 9 s; `8f9e500b` recibió 5 estados de pago en 6 minutos.
 *
 * Cómo se agrupa, sin tabla nueva de trabajos:
 *
 *  1. ESPERA. Cada entrante espera `esperaMs` (10 s por defecto,
 *     WHATSAPP_BOT_ESPERA_MS).
 *  2. EL ÚLTIMO GANA. Después de esperar, si en la conversación entró otro
 *     mensaje conversacional más nuevo, este turno se retira: el del más nuevo
 *     lo atiende, y ve los anteriores porque ya están en el historial (el
 *     modelo los recibe fusionados en un solo turno `user`, ver `armarTurnos`,
 *     y las reglas leen la ráfaga con `textoDeRafaga`). Es una lectura de la
 *     base, así que vale entre los 3 BFF.
 *  3. CANDADO POR CONVERSACIÓN, en la base (los 3 BFF lo comparten):
 *     `whatsapp_conversations.bot_turno_hasta` es un lease. Se toma con un
 *     UPDATE condicional (`bot_turno_hasta` nulo o vencido) que devuelve la
 *     fila solo si la tomó; Postgres re-evalúa el WHERE bajo el lock de fila,
 *     así que dos BFF no pueden tomarlo a la vez. Si está tomado, se espera a
 *     que se suelte (o venza) y se vuelve a mirar si sigue siendo el último.
 *     Sin la columna (migración sin aplicar) el turno corre sin candado, como
 *     antes, y se avisa una vez en el log.
 *
 * Límite conocido: la espera vive en memoria. Si el BFF se reinicia justo en
 * esos 10 s, ese mensaje no se contesta (queda en el buzón como pendiente). Es
 * el costo de no agregar una cola de turnos; el análisis lo aceptó a cambio de
 * no sumar infraestructura en esta entrega.
 */

import { supabase } from '../config/supabase';

export const ESPERA_RAFAGA_MS = (() => {
    const env = Number(process.env.WHATSAPP_BOT_ESPERA_MS);
    if (Number.isFinite(env) && env >= 0 && process.env.WHATSAPP_BOT_ESPERA_MS !== undefined) return env;
    // En las pruebas no se espera: el comportamiento se prueba inyectando
    // `esperar` y la espera, no durmiendo 10 s por caso.
    return process.env.VITEST ? 0 : 10_000;
})();

/** Duración del candado. Un turno con dos llamadas al modelo tarda 5–40 s. */
export const LEASE_TURNO_MS = 90_000;
/** Cuánto espera un turno a que se suelte el candado antes de rendirse. */
export const ESPERA_MAX_CANDADO_MS = 100_000;
const SONDEO_MS = 1_500;

// Solo los que corren `runBotTurn`. Un audio o un video tienen su propia
// respuesta fija («no puedo escuchar notas de voz»): si contaran, un texto
// seguido de un audio quedaría sin contestar.
//
// Excepción: la nota de voz TRANSCRITA que se le pasó al bot
// (`payload.transcripcion.al_bot`, spec whatsapp-notas-de-voz) sí corre
// `runBotTurn`, así que cuenta como cualquier texto. Una larga, ruido o sin
// transcribir no cuenta.
const TIPOS_CONVERSACIONALES = new Set(['text', 'interactive', 'button']);
const esConversacional = (f: { type: string | null; transcripcion?: any }) =>
    TIPOS_CONVERSACIONALES.has(String(f.type))
    || (f.type === 'audio' && f.transcripcion?.al_bot === true);

type Logger = { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };

export type ResultadoTurno = 'corrido' | 'absorbido' | 'ocupado';

export interface DepsTurno {
    esperar?: (ms: number) => Promise<void>;
    ahora?: () => number;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * ¿Entró en la conversación un mensaje conversacional MÁS NUEVO que este?
 * Se compara por `created_at` (hora de ingesta, el orden en que llegaron al
 * BFF). Nunca lanza: ante la duda, no se retira (mejor contestar que callar).
 */
export async function hayEntranteMasNuevo(conversationId: string, waMessageId: string): Promise<boolean> {
    try {
        const desde = new Date(Date.now() - 15 * 60_000).toISOString();
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('wa_message_id, type, created_at, transcripcion:payload->transcripcion')
            .eq('conversation_id', conversationId)
            .eq('direction', 'inbound')
            .gte('created_at', desde)
            .limit(50);
        if (error || !Array.isArray(data)) return false;
        const filas = data as unknown as { wa_message_id: string; type: string | null; created_at: string; transcripcion?: any }[];
        const mio = filas.find((f) => f.wa_message_id === waMessageId);
        if (!mio) return false;
        const t = new Date(mio.created_at).getTime();
        return filas.some((f) => f.wa_message_id !== waMessageId
            && esConversacional(f)
            && new Date(f.created_at).getTime() > t);
    } catch {
        return false;
    }
}

let avisoSinColumna = false;

/** Intenta tomar el candado. 'sin_columna' = la migración no está aplicada. */
export async function tomarCandado(
    conversationId: string,
    ahora = Date.now(),
): Promise<{ estado: 'tomado'; hasta: string } | { estado: 'ocupado' } | { estado: 'sin_columna' }> {
    const hasta = new Date(ahora + LEASE_TURNO_MS).toISOString();
    const { data, error } = await supabase
        .from('whatsapp_conversations')
        .update({ bot_turno_hasta: hasta })
        .eq('id', conversationId)
        .or(`bot_turno_hasta.is.null,bot_turno_hasta.lt.${new Date(ahora).toISOString()}`)
        .select('id');
    if (error) {
        if (!avisoSinColumna) {
            avisoSinColumna = true;
            console.warn('[wa-turno] sin candado por conversación (¿falta la migración de bot_turno_hasta?)',
                { err: error.message });
        }
        return { estado: 'sin_columna' };
    }
    if (Array.isArray(data) && data.length === 0) return { estado: 'ocupado' };
    return { estado: 'tomado', hasta };
}

/** Suelta el candado SOLO si sigue siendo el nuestro (no pisa el de otro turno). */
export async function soltarCandado(conversationId: string, hasta: string): Promise<void> {
    try {
        await supabase.from('whatsapp_conversations')
            .update({ bot_turno_hasta: null })
            .eq('id', conversationId)
            .eq('bot_turno_hasta', hasta);
    } catch { /* vence solo en LEASE_TURNO_MS */ }
}

/**
 * Corre `correr` como el turno de la ráfaga, o se retira.
 *
 * `inmediato`: un botón o un STOP no esperan la ráfaga (son una elección
 * explícita y se contestan ya), pero sí respetan el candado.
 */
export async function correrTurnoAgrupado(p: {
    conversationId: string;
    waMessageId: string;
    esperaMs?: number;
    inmediato?: boolean;
    correr: () => Promise<void>;
    log?: Logger;
}, deps: DepsTurno = {}): Promise<ResultadoTurno> {
    const esperar = deps.esperar ?? dormir;
    const ahora = deps.ahora ?? Date.now;
    const esperaMs = p.esperaMs ?? ESPERA_RAFAGA_MS;

    if (!p.inmediato && esperaMs > 0) await esperar(esperaMs);
    if (!p.inmediato && await hayEntranteMasNuevo(p.conversationId, p.waMessageId)) {
        p.log?.info?.({ conversationId: p.conversationId }, '[wa-turno] lo atiende un mensaje más nuevo de la ráfaga');
        return 'absorbido';
    }

    const limite = ahora() + ESPERA_MAX_CANDADO_MS;
    let candado = await tomarCandado(p.conversationId, ahora());
    while (candado.estado === 'ocupado') {
        if (ahora() > limite) {
            p.log?.warn?.({ conversationId: p.conversationId }, '[wa-turno] el candado no se soltó a tiempo; no se contesta');
            return 'ocupado';
        }
        await esperar(SONDEO_MS);
        // Mientras esperaba, ¿llegó otro? Entonces ese responde por los dos.
        if (!p.inmediato && await hayEntranteMasNuevo(p.conversationId, p.waMessageId)) return 'absorbido';
        candado = await tomarCandado(p.conversationId, ahora());
    }

    try {
        await p.correr();
    } finally {
        if (candado.estado === 'tomado') await soltarCandado(p.conversationId, candado.hasta);
    }
    return 'corrido';
}
