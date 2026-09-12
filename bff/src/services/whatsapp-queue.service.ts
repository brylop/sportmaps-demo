/**
 * whatsapp-queue.service — encolar lo que el acudiente manda al chat.
 *
 * El webhook NO procesa el comprobante: lo encola y retorna. Procesarlo ahí es
 * imposible — el OCR tarda segundos, Meta reintenta el webhook si no
 * respondemos rápido, y el resultado sería el mismo comprobante procesado
 * varias veces. El worker (`whatsapp-queue.job`) hace el trabajo.
 *
 * Plan: docs/specs/whatsapp-cola-de-comprobantes-plan.md §4.1
 */

import { supabase } from '../config/supabase';
import { sendTextMessage, type WhatsAppIntegration, type ParsedInboundMessage } from './whatsapp.service';

type Logger = { info?: (...a: any[]) => void; warn?: (...a: any[]) => void; error?: (...a: any[]) => void };

/**
 * Lo que se acepta como comprobante. Mismo conjunto que `downloadMedia()`, a
 * propósito: rechazar acá lo que allá tampoco se podría bajar evita encolar algo
 * que el worker solo puede fallar.
 *
 * `application/pdf` está adentro porque varios bancos colombianos exportan el
 * comprobante en PDF — verificado el 2026-09-11 de punta a punta.
 */
const MIME_ACEPTADOS = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
]);

/** Tipos de mensaje que pueden traer un comprobante. */
const TIPOS_CON_ARCHIVO = new Set(['image', 'document']);

export type ResultadoEncolado =
    | 'encolado'
    | 'duplicado'      // reintento de Meta: la fila ya existía
    | 'no_aplica'      // no es un tipo con archivo
    | 'mime_rechazado'
    | 'error';

const ACUSE =
    'Recibí tu comprobante 📄 Lo estoy revisando y te confirmo en un momento.';

const MIME_RECHAZADO =
    'Recibí tu archivo, pero no puedo leer ese formato. Mándame una *foto* del ' +
    'comprobante o el *PDF* que te da el banco, y lo valido enseguida.';

/**
 * Encola un adjunto entrante. Devuelve qué pasó, para que el llamador decida.
 *
 * El acuse al acudiente sale SOLO si la inserción ocurrió de verdad. El
 * `UNIQUE (wa_message_id)` ya protegía la fila, pero mandar el mensaje antes de
 * mirar si se insertó hacía que ante un reintento de Meta el padre recibiera
 * "recibí tu comprobante" dos y tres veces.
 */
export async function encolarAdjunto(
    integration: WhatsAppIntegration,
    msg: ParsedInboundMessage,
    log?: Logger,
): Promise<ResultadoEncolado> {
    if (!TIPOS_CON_ARCHIVO.has(msg.type) || !msg.mediaId) return 'no_aplica';

    // El mime del webhook puede venir con parámetros ("image/jpeg; codecs=...").
    const mime = (msg.mediaMimeType ?? '').split(';')[0].trim().toLowerCase();
    if (!MIME_ACEPTADOS.has(mime)) {
        log?.info?.({ waMessageId: msg.waMessageId, mime }, '[wa-queue] mime no aceptado, no se encola');
        // Un audio o un video no es un comprobante: no se encola para que el
        // worker no lo falle cinco veces. Pero al acudiente hay que decirle algo,
        // o se queda esperando una respuesta que nunca llega.
        await sendTextMessage(integration, msg.contactWaId, MIME_RECHAZADO);
        return 'mime_rechazado';
    }

    // `ignoreDuplicates` => ON CONFLICT DO NOTHING. Con `.select()`, `data` trae
    // SOLO las filas realmente insertadas: ese es el RETURNING que decide si
    // acusamos recibo.
    const { data, error } = await supabase
        .from('whatsapp_inbound_queue')
        .upsert(
            {
                integration_id: integration.id,
                school_id: integration.school_id,
                wa_phone_number: msg.contactWaId,
                wa_message_id: msg.waMessageId,
                wa_timestamp: msg.waTimestamp,
                message_type: msg.type,
                media_id: msg.mediaId,
                media_mime_type: mime,
                media_caption: msg.mediaCaption,
                text_body: msg.textBody,
                status: 'pending',
            },
            { onConflict: 'wa_message_id', ignoreDuplicates: true },
        )
        .select('id');

    if (error) {
        log?.error?.({ err: error.message, code: error.code, waMessageId: msg.waMessageId },
            '[wa-queue] no se pudo encolar');
        return 'error';
    }

    if (!data || data.length === 0) {
        log?.info?.({ waMessageId: msg.waMessageId }, '[wa-queue] ya estaba encolado (reintento de Meta)');
        return 'duplicado';
    }

    log?.info?.({ queueId: data[0].id, waMessageId: msg.waMessageId }, '[wa-queue] encolado');

    // El acuse va DESPUÉS de la inserción y solo si insertó. Si el envío falla,
    // la fila ya está: el worker igual procesa y responde con el resultado.
    const enviado = await sendTextMessage(integration, msg.contactWaId, ACUSE);
    if (!enviado.ok) {
        log?.warn?.({ queueId: data[0].id, err: enviado.error }, '[wa-queue] acuse no salió');
    }

    return 'encolado';
}
