/**
 * whatsapp-queue.job — procesa los comprobantes que llegan por el chat.
 *
 * El webhook solo encola (ver whatsapp-queue.service). Acá se hace el trabajo
 * lento: bajar el archivo de Graph, guardarlo, leerlo y aplicarlo al pago que
 * corresponde.
 *
 * Dos reglas que mandan sobre todo lo demás:
 *
 *  1. **El archivo se guarda ANTES del OCR.** La URL de media de Meta expira en
 *     minutos; si se baja, se pasa al OCR y el OCR falla, un reintento veinte
 *     minutos después ya no puede bajar nada y el comprobante del padre se
 *     pierde sin dejar rastro.
 *
 *  2. **Un OCR caído nunca rechaza.** Si no se pudo leer, la fila espera y
 *     reintenta; jamás produce un veredicto. Confundir «no pude leer» con «no es
 *     válido» rechazaría pagos buenos en masa.
 *
 * Plan: docs/specs/whatsapp-cola-de-comprobantes-plan.md §4.3 y §4.4
 */

import crypto from 'node:crypto';
import { supabase } from '../config/supabase';
import { downloadMedia, sendTextMessage, type WhatsAppIntegration } from '../services/whatsapp.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from '../services/whatsapp-optin.service';
import { extractReceipt } from '../services/ocr.service';
import { buildVerdictContext } from '../services/receipt-context.service';
import { normalizeDestination, normalizeReference, evaluateVerdict } from '../services/receipt-verdict';
import { evaluatePaymentReceipt, redRejectionMessage } from '../services/receipt-approval.service';
import {
    pagosPendientesDe, resolverPago, describirPago, mensajeElegirPago,
    type PagoPendiente,
} from '../services/whatsapp-receipt-matching.service';

// El mismo Logger que usa receipt-approval.service, para poder pasárselo tal cual
// a evaluatePaymentReceipt sin castear.
import type { Logger } from 'pino';

const BUCKET = 'payment-receipts';
const LOTE = 10;
const LEASE_MIN = 5;
const MAX_REINTENTOS = 5;

interface FilaCola {
    id: string;
    integration_id: string;
    school_id: string;
    wa_phone_number: string;
    wa_message_id: string;
    media_id: string | null;
    media_mime_type: string | null;
    storage_path: string | null;
    retries: number;
}

// ─── Mensajes al acudiente ───────────────────────────────────────────────────
// Todos siguen la misma forma: qué revisamos → qué encontró → qué necesitamos →
// cómo seguir. Nunca «contáctanos».

const M = {
    noIdentificado:
        'Recibí tu comprobante 📄 Para poder aplicarlo necesito saber quién eres. ' +
        'Escríbeme el correo con el que estás registrado en la escuela y te mando un código.',

    sinPendientes:
        'Recibí tu comprobante, pero ahora mismo no tienes cobros pendientes ✅ ' +
        'Si crees que falta alguno, la escuela lo revisa y te confirma.',

    noEsComprobante:
        'Revisé el archivo que enviaste y *no es un comprobante de pago*.\n\n' +
        'Si es el código QR o la llave para pagar: eso es lo que usas para *hacer* ' +
        'la transferencia. Lo que necesito es la pantalla que te muestra el banco ' +
        '*después* de enviar el dinero, la que dice "Transferencia exitosa" con el ' +
        'valor, la fecha y el número de aprobación.\n\n' +
        'Cuando la tengas, mándala por acá y la valido en un minuto.',

    esListado:
        'Revisé el archivo y es un *listado de movimientos*, no el comprobante de ' +
        'un pago puntual. Mándame el comprobante de esa transferencia sola y lo ' +
        'valido enseguida.',

    noSePudoLeer:
        'Recibí tu comprobante pero no logré leerlo bien 😕 La escuela lo va a ' +
        'revisar a mano y te confirma.',
} as const;

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/**
 * ¿Vale la pena reintentar este fallo de `downloadMedia`?
 *
 * Se decide por LISTA BLANCA de lo transitorio, no por lista negra de lo
 * permanente: los códigos llevan sufijo (`mime_no_soportado:image/gif`,
 * `archivo_muy_grande:9400000`), así que compararlos por igualdad falla en
 * silencio y termina reintentando cinco veces algo irrecuperable, contra un
 * proveedor que cobra.
 *
 * Transitorio: la red, el 429 y los 5xx. Todo lo demás —mime rechazado, archivo
 * muy grande, token que no desencripta, media que ya expiró (4xx)— no mejora
 * reintentando.
 */
function esTransitorio(error: string): boolean {
    if (error === 'network_error' || error === '') return true;
    const m = error.match(/_(\d{3})(?::|$)/);
    if (m) {
        const codigo = Number(m[1]);
        return codigo === 408 || codigo === 429 || codigo >= 500;
    }
    return false;
}

// ─── Cierres de fila ─────────────────────────────────────────────────────────

async function cerrar(
    id: string,
    status: 'done' | 'ignored' | 'failed',
    extra: Record<string, unknown> = {},
) {
    await supabase.from('whatsapp_inbound_queue')
        .update({ status, processed_at: new Date().toISOString(), locked_until: null, ...extra })
        .eq('id', id);
}

/** Espera a que el bot resuelva la pregunta de a cuál pago aplicar. */
async function esperarAlUsuario(id: string) {
    await supabase.from('whatsapp_inbound_queue')
        .update({ status: 'waiting_user', locked_until: null, updated_at: new Date().toISOString() })
        .eq('id', id);
}

/**
 * Fallo TRANSITORIO: vuelve a 'pending' con backoff. Esto es lo que separa «no
 * pude leer» de «no es válido»: acá no hay veredicto, hay otra oportunidad.
 */
async function reintentar(fila: FilaCola, motivo: string, log?: Logger) {
    const intentos = fila.retries + 1;
    const esperaMin = Math.min(2 ** intentos, 60); // 2, 4, 8, 16, 32, tope 60
    log?.warn?.({ queueId: fila.id, intentos, motivo }, '[wa-queue] transitorio, reintenta');
    await supabase.from('whatsapp_inbound_queue')
        .update({
            status: 'pending',
            retries: intentos,
            error_message: motivo,
            locked_until: null,
            next_retry_at: new Date(Date.now() + esperaMin * 60_000).toISOString(),
        })
        .eq('id', fila.id);
}

// ─── El procesamiento de una fila ────────────────────────────────────────────

async function procesarFila(fila: FilaCola, log?: Logger): Promise<void> {
    // 1. La integración, que trae el token para bajar el archivo.
    const { data: integration } = await supabase
        .from('school_whatsapp_integrations')
        .select('*')
        .eq('id', fila.integration_id)
        .single();

    if (!integration) {
        await cerrar(fila.id, 'failed', { error_message: 'la integración ya no existe' });
        return;
    }
    const wa = integration as WhatsAppIntegration;

    // Se consulta el ESTADO de baja, no el evento. La ingesta solo marca
    // `opted_out` cuando el mensaje trae la palabra STOP, y una imagen no trae
    // texto: por eso un contacto dado de baja en un mensaje anterior recibía
    // respuesta igual. Medido el 2026-09-11.
    //
    // Se le responde —él inició el contacto mandando un comprobante—, pero con
    // la coletilla que le recuerda que tiene las notificaciones apagadas.
    const dadoDeBaja = await estaDadoDeBaja(fila.integration_id, fila.wa_phone_number);
    let conversationId: string | null = null;

    /**
     * Envía Y REGISTRA. Lo segundo no es un detalle: el worker mandaba con
     * `sendTextMessage` pelado, que no pasa por `wa_record_outbound_message`, así
     * que sus respuestas no aparecían en `whatsapp_messages`. La escuela veía la
     * foto que mandó el papá y ninguna de las respuestas del bot sobre su plata,
     * y no quedaba rastro auditable de lo que se le dijo.
     *
     * `conversationId` llega null solo si el contacto no tiene conversación, que
     * no puede pasar: la ingesta la crea antes de encolar.
     */
    const responder = async (texto: string, paso: string) => {
        const final = dadoDeBaja ? texto + AVISO_DADO_DE_BAJA : texto;
        const enviado = await sendTextMessage(wa, fila.wa_phone_number, final);
        if (conversationId) {
            await supabase.rpc('wa_record_outbound_message', {
                p_conversation_id: conversationId,
                p_integration_id: fila.integration_id,
                p_wa_message_id: enviado.waMessageId || `local-${crypto.randomUUID()}`,
                p_type: 'text',
                p_text_body: final,
                p_payload: { step: paso, queue_id: fila.id },
                p_ai_generated: true,
                p_to_wa_id: fila.wa_phone_number,
            });
        }
        return enviado;
    };

    // 2. ¿Quién es? Un comprobante no identifica a nadie: primero OTP.
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, parent_id, identified')
        .eq('integration_id', fila.integration_id)
        .eq('contact_wa_id', fila.wa_phone_number)
        .maybeSingle();

    conversationId = (conv?.id as string) ?? null;

    if (!conv?.identified || !conv.parent_id) {
        await responder(M.noIdentificado, 'pide_identificacion');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'contacto sin identificar' });
        return;
    }
    const parentId = conv.parent_id as string;

    // 3. Bajar y GUARDAR antes de leer (ver el encabezado del archivo).
    let base64: string;
    let mime = fila.media_mime_type ?? 'image/jpeg';
    let storagePath = fila.storage_path;

    if (storagePath) {
        // Reintento: el archivo ya está a salvo, se relee del bucket.
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(storagePath);
        if (error || !blob) { await reintentar(fila, `no se pudo releer del bucket: ${error?.message}`, log); return; }
        base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
    } else {
        if (!fila.media_id) {
            await cerrar(fila.id, 'failed', { error_message: 'fila sin media_id' });
            return;
        }
        const bajada = await downloadMedia(wa, fila.media_id);
        if (!bajada.ok || !bajada.base64) {
            if (!esTransitorio(bajada.error ?? '')) {
                await cerrar(fila.id, 'failed', { error_message: bajada.error ?? 'no se pudo bajar' });
            } else {
                await reintentar(fila, bajada.error ?? 'fallo al bajar', log);
            }
            return;
        }
        base64 = bajada.base64;
        mime = bajada.mimeType ?? mime;

        const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] ?? 'jpg');
        storagePath = `${fila.school_id}/whatsapp/${fila.id}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET)
            .upload(storagePath, Buffer.from(base64, 'base64'), { contentType: mime, upsert: true });
        if (upErr) { await reintentar(fila, `no se pudo guardar en el bucket: ${upErr.message}`, log); return; }

        // Se estampa YA, antes del OCR: si el OCR falla, el reintento parte del
        // bucket y no de una URL de Meta que para entonces ya expiró.
        await supabase.from('whatsapp_inbound_queue')
            .update({ storage_path: storagePath, media_mime_type: mime })
            .eq('id', fila.id);
    }

    // 4. Leer. Si el OCR no responde, NO hay veredicto: se reintenta.
    let ocr;
    try {
        ocr = await extractReceipt(base64, mime);
    } catch (err: any) {
        await reintentar(fila, `OCR no disponible: ${err?.message ?? err}`, log);
        return;
    }

    // 5. ¿Es siquiera un comprobante? Este es el caso del papá que sube el QR de
    //    pago en vez de la transferencia — el error más probable del flujo.
    if (ocr.isReceipt === false) {
        await responder(M.noEsComprobante, 'no_es_comprobante');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'no es un comprobante' });
        return;
    }
    if (ocr.isTransactionList === true) {
        await responder(M.esListado, 'es_listado');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'listado de movimientos' });
        return;
    }

    // 6. ¿El dinero fue siquiera a la escuela?
    //
    //    Va ANTES de mirar los pendientes. Si no, alguien que manda un
    //    comprobante de otra cosa recibe «no tienes cobros pendientes», que es
    //    cierto pero inútil: lo que necesita saber es que ese pago no llegó a la
    //    escuela. Caso real del 2026-09-11.
    //
    //    Solo se puede afirmar si la escuela TIENE cuentas registradas. Sin
    //    ellas no hay contra qué comparar y callar es lo correcto — decir «no es
    //    nuestra cuenta» sin saberlo sería peor que no decir nada.
    const ctx = await buildVerdictContext(fila.school_id, { referenceNorm: null, imageSha256: null });
    const cuentas = ctx.registeredAccounts ?? [];
    const destino = normalizeDestination(ocr.destination);
    if (destino && cuentas.length > 0 && !cuentas.includes(destino)) {
        await responder(
            `Revisé tu comprobante y el dinero se envió a la cuenta *${ocr.destination}*, ` +
            'que no es ninguna de las cuentas registradas por la escuela.\n\n' +
            'Verifica la llave o el número antes de volver a transferir, y si ya lo hiciste ' +
            'escríbele a la escuela para que lo revisen contigo.',
            'destino_ajeno',
        );
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'destino no es de la escuela' });
        return;
    }

    // 7. ¿A qué pago va?
    const pendientes = await pagosPendientesDe(parentId, fila.school_id);
    const match = resolverPago(pendientes, ocr.amount ?? null);

    if (match.tipo === 'sin_pendientes') {
        await responder(M.sinPendientes, 'sin_pendientes');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'sin pagos pendientes' });
        return;
    }

    if (match.tipo === 'preguntar' || match.tipo === 'combinacion') {
        // No se adivina y no se reparte plata sin un sí explícito.
        const texto = match.tipo === 'preguntar'
            ? mensajeElegirPago(match.opciones)
            : `Recibí tu comprobante por ${cop(ocr.amount ?? 0)}. Parece que cubre estos cobros:\n\n` +
              `${match.pagos.map((p) => `• ${describirPago(p)}`).join('\n')}\n\n` +
              'Respóndeme *sí* para aplicarlo así.';
        await responder(texto, match.tipo === 'preguntar' ? 'ask_cual_pago' : 'confirmar_combinacion');
        await esperarAlUsuario(fila.id);
        return;
    }

    // 7. Un solo destino: se estampa el comprobante Y SU VEREDICTO.
    const pago: PagoPendiente = match.pago;
    const sha = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');

    /**
     * El veredicto se calcula ACÁ y se persiste. No es opcional.
     *
     * `evaluatePaymentReceipt` no lo computa cuando la escuela tiene el
     * auto-approve apagado: su comentario lo dice — «se decide con el veredicto
     * ya persistido, que lo computó el BFF en /extract-receipt». En la app ese
     * endpoint lo calcula al subir; el worker no pasa por ahí.
     *
     * Sin este bloque el comprobante quedaba en `awaiting_approval` con
     * `receipt_verdict` en null y la escuela lo revisaba a ciegas — exactamente
     * los 45 pagos sin veredicto que encontramos el 2026-09-11, reproducidos
     * por este código. Y `REFERENCIA_DUPLICADA` nunca se disparaba, que es la
     * defensa contra que el mismo comprobante se aplique dos veces.
     *
     * Se reconstruye el contexto porque el de §6 se armó sin referencia ni hash
     * —no se conocían todavía—, y son justo los que alimentan el dedup.
     */
    const ctxPago = await buildVerdictContext(fila.school_id, {
        referenceNorm: normalizeReference(ocr.reference),
        imageSha256: sha,
        expectedAmount: pago.amount,
        paymentId: pago.id,
    });
    const veredicto = evaluateVerdict(ocr, ctxPago);
    log?.info?.(
        { queueId: fila.id, paymentId: pago.id, veredicto: veredicto.verdict, motivos: veredicto.reasons.map((r) => r.code) },
        '[wa-queue] veredicto',
    );

    const { error: stampErr } = await supabase.from('payments').update({
        receipt_url: storagePath,
        receipt_storage_bucket: BUCKET,
        receipt_image_sha256: sha,
        receipt_image_sha256_source: 'server_verified',
        ocr_amount: ocr.amount, ocr_date: ocr.date, ocr_bank: ocr.bank,
        ocr_reference: ocr.reference, ocr_destination: ocr.destination,
        ocr_provider: ocr.provider,
        receipt_verdict: veredicto.verdict,
        receipt_verdict_reasons: veredicto.reasons,
        receipt_verdict_at: new Date().toISOString(),
        status: 'awaiting_approval',
    }).eq('id', pago.id).in('status', ['pending', 'overdue']);

    if (stampErr) {
        // 23505 sobre `uq_payments_school_ocr_reference` NO es un fallo: es la
        // base diciendo que esa referencia de banco ya se usó en esta escuela.
        // Es la última defensa contra aplicar el mismo comprobante dos veces, y
        // hay que leerla como tal.
        //
        // Tratarla como transitorio —que es lo que hacía— dejaba al acudiente sin
        // ninguna respuesta y ponía la fila a reintentar cinco veces contra una
        // restricción que nunca va a ceder, pagando OCR en cada vuelta.
        if (stampErr.code === '23505') {
            const { data: yaAplicado } = await supabase
                .from('payments')
                .select('concept, amount, status')
                .eq('school_id', fila.school_id)
                .eq('ocr_reference', ocr.reference)
                .maybeSingle();

            const donde = yaAplicado
                ? ` Ya está aplicado a *${yaAplicado.concept}* por ${cop(Number(yaAplicado.amount))}.`
                : '';
            await responder(
                `Ese comprobante ya lo había recibido, así que no lo apliqué de nuevo.${donde}\n\n` +
                'Si hiciste otra transferencia, mándame el comprobante de esa — el número de ' +
                'aprobación tiene que ser distinto.',
                'comprobante_repetido',
            );
            await cerrar(fila.id, 'ignored', {
                result_type: 'none',
                error_message: `referencia ya usada: ${ocr.reference}`,
            });
            log?.info?.({ queueId: fila.id, referencia: ocr.reference }, '[wa-queue] comprobante repetido');
            return;
        }
        await reintentar(fila, `no se pudo estampar el pago: ${stampErr.message}`, log);
        return;
    }

    const resultado = await evaluatePaymentReceipt(pago.id, log);

    // 8. Contarle al acudiente qué pasó, nombrando el pago para que pueda corregir.
    let respuesta: string;
    if (resultado.action === 'approved') {
        respuesta = `¡Listo! ✅ Apliqué tu pago a *${describirPago(pago)}*. Queda al día.`;
    } else if (resultado.action === 'rejected') {
        respuesta =
            `Revisé tu comprobante para *${describirPago(pago)}* y no lo pude validar.\n\n` +
            `${resultado.reason ?? ''}\n\nSi crees que hay un error, mándame el comprobante correcto por acá.`;
    } else {
        respuesta =
            `Recibí tu comprobante y lo apliqué a *${describirPago(pago)}* 📄\n\n` +
            'La escuela lo está revisando y te confirma en poco tiempo.';
    }
    await responder(respuesta, 'resultado_comprobante');

    await cerrar(fila.id, 'done', {
        result_type: 'payment_receipt',
        result_ref_id: pago.id,
        matched_parent_id: parentId,
        matched_child_id: pago.child_id,
        error_message: null,
    });
    log?.info?.({ queueId: fila.id, paymentId: pago.id, accion: resultado.action }, '[wa-queue] aplicado');
}

// ─── Entrada del job ─────────────────────────────────────────────────────────

export async function runWhatsAppQueue(log?: Logger): Promise<{ tomadas: number; errores: number }> {
    const { data: filas, error } = await supabase.rpc('wa_queue_claim', {
        p_limit: LOTE, p_lease_minutes: LEASE_MIN, p_max_retries: MAX_REINTENTOS,
    });

    if (error) {
        log?.error?.({ err: error.message }, '[wa-queue] el claim falló');
        return { tomadas: 0, errores: 1 };
    }
    const lote = (filas ?? []) as FilaCola[];
    if (lote.length === 0) return { tomadas: 0, errores: 0 };

    let errores = 0;
    for (const fila of lote) {
        try {
            await procesarFila(fila, log);
        } catch (err: any) {
            errores++;
            // Una excepción inesperada no puede dejar la fila colgada en
            // 'processing': se devuelve a la rueda con su motivo.
            await reintentar(fila, `excepción: ${err?.message ?? err}`, log).catch(() => {});
            log?.error?.({ err: err?.message ?? err, queueId: fila.id }, '[wa-queue] fila explotó');
        }
    }
    return { tomadas: lote.length, errores };
}
