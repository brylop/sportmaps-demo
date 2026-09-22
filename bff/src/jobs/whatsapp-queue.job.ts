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
import { downloadMedia, sendTextMessage, aFormatoWhatsApp, type WhatsAppIntegration } from '../services/whatsapp.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from '../services/whatsapp-optin.service';
import { extractReceipt } from '../services/ocr.service';
import { extractEnrollmentForm, type EnrollmentFormResult } from '../services/enrollment-ocr.service';
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
/** Minutos en los que NO se repite un mensaje idéntico al mismo contacto. */
const VENTANA_ANTI_REPETICION_MIN = 10;

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

/**
 * Deja la fila esperando la respuesta del acudiente, CON todo lo necesario
 * para aplicarla despues.
 *
 * Hasta el 2026-09-15 esto solo ponia el estado y nadie volvia a mirar la fila:
 * el bot preguntaba «respondeme con el numero», el padre contestaba, y ese
 * mensaje se iba al LLM —que no sabia que hubo una pregunta—. El comprobante
 * quedaba colgado y el padre creyendo que lo habiamos aplicado.
 */
async function esperarAlUsuario(id: string, pregunta: {
    opciones: PagoPendiente[];
    ocr: Awaited<ReturnType<typeof extractReceipt>>;
    sha: string;
    storagePath: string | null;
    parentId: string;
}) {
    await supabase.from('whatsapp_inbound_queue')
        .update({
            status: 'waiting_user',
            locked_until: null,
            updated_at: new Date().toISOString(),
            pregunta_opciones: pregunta.opciones,
            pregunta_ocr: {
                ocr: pregunta.ocr,
                sha: pregunta.sha,
                storagePath: pregunta.storagePath,
                parentId: pregunta.parentId,
            },
            pregunta_at: new Date().toISOString(),
        })
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

/**
 * Contexto para estampar un comprobante, sin depender de la fila de la cola.
 *
 * Existe porque el estampado tiene DOS entradas: el worker cuando el monto
 * desempata solo, y la respuesta del acudiente cuando hubo que preguntarle a
 * cuál cobro aplicarlo. Antes solo existía la primera y la pregunta quedaba en
 * 'waiting_user' para siempre — nadie leía la respuesta.
 */
export interface ContextoAplicacion {
    queueId: string;
    schoolId: string;
    parentId: string;
    storagePath: string | null;
    /** sha256 de la imagen. Es la llave del dedup: no se recalcula, se pasa. */
    sha: string;
    ocr: Awaited<ReturnType<typeof extractReceipt>>;
    responder: (texto: string, paso: string) => Promise<unknown>;
    /** Qué hacer ante un fallo transitorio. El worker reintenta; la respuesta no. */
    alFallar: (motivo: string) => Promise<void>;
    log?: Logger;
}

/**
 * Estampa el comprobante en UN pago, con su veredicto, y le cuenta al acudiente.
 *
 * `restantes` son los cobros que quedan vivos después de este. No es cosmético:
 * es la mitad de la regla de la escuela y lo único que evita que el padre crea
 * que quedó al día cuando solo pagó el atrasado.
 */
export async function aplicarComprobante(
    ctx: ContextoAplicacion,
    pago: PagoPendiente,
    restantes: PagoPendiente[],
): Promise<void> {

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
    const ctxPago = await buildVerdictContext(ctx.schoolId, {
        referenceNorm: normalizeReference(ctx.ocr.reference),
        imageSha256: ctx.sha,
        expectedAmount: pago.amount,
        paymentId: pago.id,
    });
    const veredicto = evaluateVerdict(ctx.ocr, ctxPago);
    ctx.log?.info?.(
        { queueId: ctx.queueId, paymentId: pago.id, veredicto: veredicto.verdict, motivos: veredicto.reasons.map((r) => r.code) },
        '[wa-queue] veredicto',
    );

    const { error: stampErr } = await supabase.from('payments').update({
        receipt_url: ctx.storagePath,
        receipt_storage_bucket: BUCKET,
        receipt_image_sha256: ctx.sha,
        receipt_image_sha256_source: 'server_verified',
        ocr_amount: ctx.ocr.amount, ocr_date: ctx.ocr.date, ocr_bank: ctx.ocr.bank,
        ocr_reference: ctx.ocr.reference, ocr_destination: ctx.ocr.destination,
        ocr_provider: ctx.ocr.provider,
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
                .eq('school_id', ctx.schoolId)
                .eq('ocr_reference', ctx.ocr.reference)
                .maybeSingle();

            const donde = yaAplicado
                ? ` Ya está aplicado a *${yaAplicado.concept}* por ${cop(Number(yaAplicado.amount))}.`
                : '';
            await ctx.responder(
                `Ese comprobante ya lo había recibido, así que no lo apliqué de nuevo.${donde}\n\n` +
                'Si hiciste otra transferencia, mándame el comprobante de esa — el número de ' +
                'aprobación tiene que ser distinto.',
                'comprobante_repetido',
            );
            await cerrar(ctx.queueId, 'ignored', {
                result_type: 'none',
                error_message: `referencia ya usada: ${ctx.ocr.reference}`,
            });
            ctx.log?.info?.({ queueId: ctx.queueId, referencia: ctx.ocr.reference }, '[wa-queue] comprobante repetido');
            return;
        }
        await ctx.alFallar(`no se pudo estampar el pago: ${stampErr.message}`);
        return;
    }

    const resultado = await evaluatePaymentReceipt(pago.id, ctx.log);

    // 8. Contarle al acudiente qué pasó, nombrando el pago para que pueda corregir.
    let respuesta: string;
    if (resultado.action === 'approved') {
        respuesta = `¡Listo! ✅ Apliqué tu pago a *${describirPago(pago)}*.`
            + (restantes.length ? '' : ' Queda al día.');
    } else if (resultado.action === 'rejected') {
        respuesta =
            `Revisé tu comprobante para *${describirPago(pago)}* y no lo pude validar.\n\n` +
            `${resultado.reason ?? ''}\n\nSi crees que hay un error, mándame el comprobante correcto por acá.`;
    } else {
        respuesta =
            `Recibí tu comprobante y lo apliqué a *${describirPago(pago)}* 📄\n\n` +
            'La escuela lo está revisando y te confirma en poco tiempo.';
    }

    // Lo que SIGUE debiendo. Sin esto, el acudiente que paga «lo pendiente»
    // se va convencido de que quedó al día y la escuela se entera cuando le
    // vence el mes corriente. La regla la fijó la escuela el 2026-09-15: se
    // aplica al más antiguo y el del mes en curso queda vivo — y se dice.
    if (restantes.length) {
        respuesta += `\n\nTe queda${restantes.length > 1 ? 'n' : ''} pendiente${restantes.length > 1 ? 's' : ''}:\n`
            + restantes.map((r) => `• ${describirPago(r)}`).join('\n');
    }

    await ctx.responder(respuesta, 'resultado_comprobante');

    await cerrar(ctx.queueId, 'done', {
        result_type: 'payment_receipt',
        result_ref_id: pago.id,
        matched_parent_id: ctx.parentId,
        matched_child_id: pago.child_id,
        error_message: null,
    });
    ctx.log?.info?.({ queueId: ctx.queueId, paymentId: pago.id, accion: resultado.action }, '[wa-queue] aplicado');
}
/** Resultado de bajar y guardar el archivo — el llamador solo revisa `ok`; en `false` la fila ya quedó cerrada/reintentando y hay que retornar sin hacer nada más. */
type ArchivoBajado =
    | { ok: true; base64: string; mime: string; storagePath: string }
    | { ok: false };

/**
 * Bajar y GUARDAR antes de leer. La URL de media de Meta expira en minutos;
 * si se baja, se pasa al OCR y el OCR falla, un reintento veinte minutos
 * después ya no puede bajar nada y el archivo se pierde sin dejar rastro.
 *
 * Idempotente por FILA: si `fila.storage_path` ya está estampado (reintento,
 * o una rama anterior del mismo procesamiento ya lo bajó), relee del bucket
 * en vez de volver a pedirle el archivo a Meta y volver a subirlo. Esto
 * importa para la rama de staff-admin (§3 de
 * alta-atleta-por-foto-hoja-matricula.md): si termina resolviendo que
 * también es acudiente y sigue por `continuarComoComprobante`, NO vuelve a
 * bajar el mismo archivo.
 */
async function bajarYGuardarArchivo(fila: FilaCola, wa: WhatsAppIntegration, log?: Logger): Promise<ArchivoBajado> {
    let mime = fila.media_mime_type ?? 'image/jpeg';
    let storagePath = fila.storage_path;

    if (storagePath) {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(storagePath);
        if (error || !blob) { await reintentar(fila, `no se pudo releer del bucket: ${error?.message}`, log); return { ok: false }; }
        const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
        return { ok: true, base64, mime, storagePath };
    }

    if (!fila.media_id) {
        await cerrar(fila.id, 'failed', { error_message: 'fila sin media_id' });
        return { ok: false };
    }
    const bajada = await downloadMedia(wa, fila.media_id);
    if (!bajada.ok || !bajada.base64) {
        if (!esTransitorio(bajada.error ?? '')) {
            await cerrar(fila.id, 'failed', { error_message: bajada.error ?? 'no se pudo bajar' });
        } else {
            await reintentar(fila, bajada.error ?? 'fallo al bajar', log);
        }
        return { ok: false };
    }
    const base64 = bajada.base64;
    mime = bajada.mimeType ?? mime;

    const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] ?? 'jpg');
    storagePath = `${fila.school_id}/whatsapp/${fila.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(storagePath, Buffer.from(base64, 'base64'), { contentType: mime, upsert: true });
    if (upErr) {
        const detalle = [upErr.message, (upErr as { statusCode?: string }).statusCode, upErr.name]
            .filter(Boolean).join(' · ') || JSON.stringify(upErr).slice(0, 200);
        await reintentar(fila, `no se pudo guardar en el bucket: ${detalle}`, log);
        return { ok: false };
    }

    // Se estampa YA, antes del OCR: si el OCR falla, el reintento (o la rama
    // que sigue en el mismo procesamiento) parte del bucket, no de una URL de
    // Meta que para entonces ya expiró.
    await supabase.from('whatsapp_inbound_queue')
        .update({ storage_path: storagePath, media_mime_type: mime })
        .eq('id', fila.id);
    // Mutar la fila en memoria: si esta misma invocación sigue a
    // continuarComoComprobante o a otra rama, esas lecturas de fila.storage_path
    // ya ven el valor estampado.
    fila.storage_path = storagePath;
    fila.media_mime_type = mime;

    return { ok: true, base64, mime, storagePath };
}

/**
 * Todo lo que pasa una vez que sabemos QUIÉN paga (`parentId`) y que el
 * archivo YA se leyó como comprobante (`ocr`). Compartida por el camino de
 * siempre (acudiente identificado por OTP/teléfono) y por el camino nuevo
 * (admin-que-también-es-acudiente, ver `procesarComoStaffAdmin`) — para que
 * un admin con hijos en la escuela no pierda el camino de pagos de hoy, y
 * para no volver a bajar el archivo una segunda vez.
 */
async function continuarComoComprobante(
    fila: FilaCola,
    parentId: string,
    responder: (texto: string, paso: string) => Promise<unknown>,
    base64: string,
    mime: string,
    storagePath: string,
    ocr: Awaited<ReturnType<typeof extractReceipt>>,
    log?: Logger,
): Promise<void> {
    if (ocr.isTransactionList === true) {
        await responder(M.esListado, 'es_listado');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'listado de movimientos' });
        return;
    }

    // ¿El dinero fue siquiera a la escuela? Va ANTES de mirar los pendientes
    // (ver comentario original: decirle "no tienes pendientes" a quien mandó
    // el comprobante de otra cuenta es cierto pero inútil).
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

    // ¿A qué pago va?
    const pendientes = await pagosPendientesDe(parentId, fila.school_id);
    const match = resolverPago(pendientes, ocr.amount ?? null);

    if (match.tipo === 'sin_pendientes') {
        await responder(M.sinPendientes, 'sin_pendientes');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'sin pagos pendientes' });
        return;
    }

    if (match.tipo === 'preguntar' || match.tipo === 'combinacion') {
        const texto = match.tipo === 'preguntar'
            ? mensajeElegirPago(match.opciones)
            : `Recibí tu comprobante por ${cop(ocr.amount ?? 0)}. Parece que cubre estos cobros:\n\n` +
              `${match.pagos.map((p) => `• ${describirPago(p)}`).join('\n')}\n\n` +
              'Respóndeme *sí* para aplicarlo así.';
        await responder(texto, match.tipo === 'preguntar' ? 'ask_cual_pago' : 'confirmar_combinacion');
        await esperarAlUsuario(fila.id, {
            opciones: match.tipo === 'preguntar' ? match.opciones : match.pagos,
            ocr,
            sha: crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex'),
            storagePath,
            parentId,
        });
        return;
    }

    // Un solo destino: se estampa el comprobante Y SU VEREDICTO.
    const pago: PagoPendiente = match.pago;
    const sha = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');

    await aplicarComprobante({
        queueId: fila.id, schoolId: fila.school_id, parentId, storagePath, sha, ocr,
        responder,
        alFallar: (motivo) => reintentar(fila, motivo, log),
        log,
    }, pago, pendientes.filter((x) => x.id !== pago.id));
}

/**
 * Busca si el documento del deportista ya existe en `children` de esta
 * escuela, o en otra fila de `enrollment_form_intake` todavía sin aprobar —
 * ver §6.1 de alta-atleta-por-foto-hoja-matricula.md. Solo corre si el OCR
 * pudo leer el documento; sin documento no hay llave confiable y se deja la
 * decisión al admin en el inbox (fase 4).
 */
async function buscarDuplicadoDeMatricula(
    schoolId: string,
    docNumber: string | null,
): Promise<{ duplicateOfChildId: string | null; duplicateOfIntakeId: string | null }> {
    if (!docNumber) return { duplicateOfChildId: null, duplicateOfIntakeId: null };
    const docNorm = docNumber.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (!docNorm) return { duplicateOfChildId: null, duplicateOfIntakeId: null };

    const { data: existingChild } = await supabase
        .from('children')
        .select('id')
        .eq('school_id', schoolId)
        .eq('doc_number', docNorm)
        .maybeSingle();
    if (existingChild) return { duplicateOfChildId: existingChild.id as string, duplicateOfIntakeId: null };

    // Sin filtro JSONB en el query (evitar depender de sintaxis ->> del
    // cliente): son pocas filas abiertas por escuela, se filtra en memoria.
    const { data: abiertas } = await supabase
        .from('enrollment_form_intake')
        .select('id, extracted')
        .eq('school_id', schoolId)
        .in('status', ['pending', 'processing', 'waiting_review']);

    const otra = (abiertas ?? []).find((row: any) => {
        const otroDoc = (row.extracted as EnrollmentFormResult | null)?.docNumber;
        return otroDoc && otroDoc.replace(/[^0-9A-Za-z]/g, '').toUpperCase() === docNorm;
    });

    return { duplicateOfChildId: null, duplicateOfIntakeId: (otra?.id as string) ?? null };
}

/** Encola la matrícula extraída en `enrollment_form_intake`, con su chequeo de duplicados, y cierra la fila de WhatsApp. */
async function encolarMatricula(
    fila: FilaCola,
    storagePath: string,
    enrollment: EnrollmentFormResult,
    responder: (texto: string, paso: string) => Promise<unknown>,
    log?: Logger,
): Promise<void> {
    const { duplicateOfChildId, duplicateOfIntakeId } = await buscarDuplicadoDeMatricula(fila.school_id, enrollment.docNumber);

    const { data: intake, error: intakeErr } = await supabase
        .from('enrollment_form_intake')
        .insert({
            school_id: fila.school_id,
            integration_id: fila.integration_id,
            wa_message_id: fila.wa_message_id,
            wa_phone_number: fila.wa_phone_number,
            media_id: fila.media_id,
            storage_path: storagePath,
            status: 'waiting_review',
            extracted: enrollment,
            duplicate_of_child_id: duplicateOfChildId,
            duplicate_of_intake_id: duplicateOfIntakeId,
        })
        .select('id')
        .single();

    if (intakeErr || !intake) {
        log?.error?.({ err: intakeErr?.message, queueId: fila.id }, '[wa-queue] no se pudo encolar la matrícula');
        await reintentar(fila, `no se pudo encolar la matrícula: ${intakeErr?.message}`, log);
        return;
    }

    const aviso = duplicateOfChildId
        ? 'Recibí la hoja de matrícula 📋 El documento ya existe para un atleta activo de la escuela — ' +
          'la dejé en revisión para que decidas si vinculas los datos nuevos o la descartas, no crea un atleta duplicado.'
        : duplicateOfIntakeId
        ? 'Recibí la hoja de matrícula 📋 Ya había otra foto con el mismo documento esperando revisión — las agrupé.'
        : 'Recibí la hoja de matrícula 📋 La dejé lista para que la revises y confirmes los datos antes de crear al atleta.';

    await responder(aviso, 'matricula_encolada');
    await cerrar(fila.id, 'done', { result_type: 'enrollment_form', result_ref_id: intake.id });
    log?.info?.({ queueId: fila.id, intakeId: intake.id, duplicateOfChildId, duplicateOfIntakeId }, '[wa-queue] matrícula encolada');
}

/**
 * Camino nuevo para quien resulta ser owner/admin/school_admin de la
 * escuela (§4.1/§4.2 de alta-atleta-por-foto-hoja-matricula.md). Corre ANTES
 * del gate de acudiente porque un admin no tiene por qué estar identificado
 * como acudiente para poder mandar la foto de una hoja de matrícula.
 *
 * Primero se descarta que sea un comprobante (mismo extractor que ya existe,
 * cero clasificador nuevo): si lo es, y el admin TAMBIÉN es acudiente
 * (escuela chica, el dueño tiene hijos entrenando ahí), sigue el camino de
 * pagos de siempre sin perder esa función. Si no es acudiente, no se aplica
 * —los pagos de terceros/efectivo se registran desde el panel, no por acá—.
 * Si no es comprobante, se prueba como hoja de matrícula.
 */
async function procesarComoStaffAdmin(
    fila: FilaCola,
    wa: WhatsAppIntegration,
    conv: { id?: string; parent_id?: string | null; identified?: boolean } | null | undefined,
    responder: (texto: string, paso: string) => Promise<unknown>,
    log?: Logger,
): Promise<void> {
    const bajada = await bajarYGuardarArchivo(fila, wa, log);
    if (!bajada.ok) return;
    const { base64, mime, storagePath } = bajada;

    let ocr;
    try {
        ocr = await extractReceipt(base64, mime);
    } catch (err: any) {
        await reintentar(fila, `OCR (comprobantes) no disponible: ${err?.message ?? err}`, log);
        return;
    }

    if (ocr.isReceipt === true) {
        let parentId: string | null = (conv?.identified && conv.parent_id) ? conv.parent_id : null;
        if (!parentId) {
            const { data: identificacion } = await supabase.rpc('wa_identify_by_phone', {
                p_integration_id: fila.integration_id,
                p_contact_wa_id: fila.wa_phone_number,
            });
            if ((identificacion as any)?.estado === 'identificado' && (identificacion as any)?.parent_id) {
                parentId = (identificacion as any).parent_id as string;
            }
        }

        if (parentId) {
            await continuarComoComprobante(fila, parentId, responder, base64, mime, storagePath, ocr, log);
            return;
        }

        await responder(
            'Este archivo parece un comprobante de pago. Los pagos de terceros o en efectivo se ' +
            'registran desde el panel de administración, no por este canal.',
            'admin_comprobante_no_acudiente',
        );
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'admin no acudiente, comprobante no aplicado' });
        return;
    }

    let enrollment: EnrollmentFormResult;
    try {
        enrollment = await extractEnrollmentForm(base64, mime);
    } catch (err: any) {
        await reintentar(fila, `OCR (matrícula) no disponible: ${err?.message ?? err}`, log);
        return;
    }

    if (!enrollment.isEnrollmentForm) {
        await responder(
            'No reconocí este archivo ni como comprobante de pago ni como hoja de matrícula. ' +
            'Si querías registrar un atleta nuevo, envía la foto completa de la hoja.',
            'no_reconocido_admin',
        );
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'ni comprobante ni matrícula' });
        return;
    }

    await encolarMatricula(fila, storagePath, enrollment, responder, log);
}

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
        const final = aFormatoWhatsApp(dadoDeBaja ? texto + AVISO_DADO_DE_BAJA : texto);

        // Si ese MISMO texto ya salió hace poco a este contacto, no se repite.
        // Medido el 2026-09-11: 8 imágenes de golpe produjeron 7 mensajes
        // idénticos seguidos, uno cada 5 segundos. Desde el lado del acudiente
        // eso es spam, y en un canal donde Meta mide la calidad del número,
        // repetir lo mismo siete veces es justo lo que penaliza.
        if (conversationId) {
            const desde = new Date(Date.now() - VENTANA_ANTI_REPETICION_MIN * 60_000).toISOString();
            const { data: repetido } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('conversation_id', conversationId)
                .eq('direction', 'outbound')
                .eq('text_body', final)
                .gte('created_at', desde)
                .limit(1);
            if (repetido && repetido.length > 0) {
                log?.info?.({ queueId: fila.id, paso }, '[wa-queue] mismo mensaje reciente, no se repite');
                return { ok: true };
            }
        }

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

    // 2. ¿Quién es? Se busca la conversación PRIMERO —tanto el camino de
    // siempre como la rama nueva de staff-admin la necesitan (esta última
    // para poder registrar sus mensajes salientes y para saber, sin una
    // segunda consulta, si el admin también es acudiente).
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, parent_id, identified')
        .eq('integration_id', fila.integration_id)
        .eq('contact_wa_id', fila.wa_phone_number)
        .maybeSingle();

    conversationId = (conv?.id as string) ?? null;

    // 2.5. ¿Es un admin de esta escuela? Va ANTES de exigir identificación de
    // acudiente — ver §4.1/§4.2 de alta-atleta-por-foto-hoja-matricula.md.
    const { data: staffCheck } = await supabase.rpc('wa_identify_staff_admin_by_phone', {
        p_school_id: fila.school_id,
        p_wa_phone_number: fila.wa_phone_number,
    });
    if ((staffCheck as any)?.estado === 'identificado') {
        await procesarComoStaffAdmin(fila, wa, conv, responder, log);
        return;
    }

    // Un comprobante no identifica a nadie: primero OTP/teléfono (sin cambios
    // respecto de hoy).
    if (!conv?.identified || !conv.parent_id) {
        await responder(M.noIdentificado, 'pide_identificacion');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'contacto sin identificar' });
        return;
    }
    const parentId = conv.parent_id as string;

    // 3. Bajar y GUARDAR antes de leer.
    const bajada = await bajarYGuardarArchivo(fila, wa, log);
    if (!bajada.ok) return;
    const { base64, mime, storagePath } = bajada;

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

    await continuarComoComprobante(fila, parentId, responder, base64, mime, storagePath, ocr, log);
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
