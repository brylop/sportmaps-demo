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

import { APP_PUBLICA_PROD } from '../utils/url-publica-familias';
import crypto from 'node:crypto';
import { supabase } from '../config/supabase';
import {
    downloadMedia, sendTextMessage, sendInteractiveButtons, aFormatoWhatsApp, type WhatsAppIntegration,
} from '../services/whatsapp.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from '../services/whatsapp-optin.service';
import { extractReceipt } from '../services/ocr.service';
import { conContextoLlm } from '../services/llm-usage.service';
import { extractEnrollmentForm, type EnrollmentFormResult } from '../services/enrollment-ocr.service';
import { buildVerdictContext } from '../services/receipt-context.service';
import { normalizeDestination, normalizeReference, evaluateVerdict, destinationMatchesRegistered } from '../services/receipt-verdict';
import { evaluatePaymentReceipt, redRejectionMessage } from '../services/receipt-approval.service';
import { debeAtender, type TipoDeContacto } from '../services/whatsapp-atencion.service';
import { anunciaComprobante, normalizarFrase, PASOS_SIN_CUENTA, type ComprobanteAnunciado } from '../services/whatsapp-reglas-turno';
import {
    pagosPendientesDe, resolverPago, describirPago, mensajeElegirPago,
    type PagoPendiente,
} from '../services/whatsapp-receipt-matching.service';
import { invitacionPendienteVigente } from '../services/whatsapp-invitacion-vigente.service';
import { esErrorDeVentana } from '../services/whatsapp-plantillas.service';

// El mismo Logger que usa receipt-approval.service, para poder pasárselo tal cual
// a evaluatePaymentReceipt sin castear.
import type { Logger } from 'pino';
import {
    detectarOtroConcepto, decidirOtroConcepto, mensajeOtroConcepto, motivoOtroConcepto, textosAlrededor,
} from '../services/whatsapp-otro-concepto.service';
import { ventaAbiertaDeContacto, decidirComprobanteDeVenta } from '../services/whatsapp-venta-servicios.service';

const BUCKET = 'payment-receipts';
const LOTE = 10;
const LEASE_MIN = 5;
const MAX_REINTENTOS = 5;
/** Minutos en los que NO se repite un mensaje idéntico al mismo contacto. */
const VENTANA_ANTI_REPETICION_MIN = 10;

export interface FilaCola {
    id: string;
    integration_id: string;
    school_id: string;
    wa_phone_number: string;
    wa_message_id: string;
    media_id: string | null;
    media_mime_type: string | null;
    storage_path: string | null;
    retries: number;
    /** Vienen en el `q.*` del claim; opcionales para no romper llamadores viejos. */
    media_caption?: string | null;
    created_at?: string | null;
}

// ─── Pista del cobro anunciado (P3, análisis 2026-10-06) ────────────────────
//
// La familia suele ANUNCIAR el comprobante con texto antes o después de la
// foto («Hola, envío el comprobante de pago de Mensualidad 10/2026 - X (octubre
// 2026) de X. (ref. ABCD1234)», el texto precargado de /p/:token). Cuando el
// monto no desempata entre varios pendientes, esa pista decide en vez de
// preguntarle «¿a cuál de estos?».

export interface PistaDeCobro { ref: string | null; concepto: string | null }

/**
 * El cobro que la pista señala, o null. Por ref (prefijo del id) primero —es
 * exacta—; por concepto, solo si coincide con UNO.
 */
export function elegirPorPista(pendientes: PagoPendiente[], pista: PistaDeCobro | null): PagoPendiente | null {
    if (!pista) return null;
    if (pista.ref) {
        const ref = pista.ref.toLowerCase();
        const porRef = pendientes.filter((p) => String(p.id).replace(/-/g, '').toLowerCase().startsWith(ref));
        if (porRef.length === 1) return porRef[0];
    }
    if (pista.concepto) {
        const c = normalizarFrase(pista.concepto);
        const porConcepto = pendientes.filter((p) => normalizarFrase(p.concept) === c);
        if (porConcepto.length === 1) return porConcepto[0];
    }
    return null;
}

/** Junta la pista del pie de la foto y de los textos de la familia cerca de ella. */
export function pistaDesdeTextos(textos: (string | null | undefined)[]): PistaDeCobro | null {
    let mejor: ComprobanteAnunciado | null = null;
    for (const t of textos) {
        const a = anunciaComprobante(t);
        if (!a) continue;
        if (a.ref) return { ref: a.ref, concepto: a.concepto ?? null };
        if (a.concepto && !mejor?.concepto) mejor = a;
    }
    return mejor?.concepto ? { ref: null, concepto: mejor.concepto } : null;
}

// ─── Adjunto que NO es un comprobante (análisis 2026-10-06, Dynasty) ────────
//
// Caso real: una mamá SIN cuenta escribió «acabo de ver un correo», mandó la
// captura del correo de estado de cuenta y siguió con «llevo varios meses sin
// asistir» y «no entiendo porque me estan cobrando?». El camino de familia sin
// cuenta no leía la imagen ni el texto: respondió «Recibí tu comprobante 📄 …
// se lo paso a la escuela para que lo aplique» y dejó la fila en el buzón de
// comprobantes (`escalated`) como si fuera un pago. Era un reclamo.

/**
 * ¿Lo que la familia escribe alrededor del adjunto es un reclamo o una
 * pregunta sobre un cobro? Entonces el adjunto acompaña una CONSULTA, no un
 * pago: lo atiende una persona, y no se le dice «Recibí tu comprobante».
 */
const SENALES_DE_CONSULTA: RegExp[] = [
    /\b(por ?que|porq|xq|pq)\b.*\bcobr/,                                   // ¿por qué me cobran?
    /\bno entiendo\b/,
    /\bcobr\w* (de mas|doble|dos veces|equivocad\w*|indebid\w*|errad\w*|mal)\b/,
    /\bsin asistir\b/,
    /\bno (he|ha|hemos|han) (ido|asistido|venido|vuelto)\b/,
    /\bno (asiste|asisto|asistio|asistimos|asisten)\b/,
    /\bno (le )?(debo|debemos)\b/,
    /\b(reclamo|queja)\b/,
    /\baclar\w*/,                                                          // «me puedes aclarar»
    /\bestado de cuenta\b/,
    /\b(vi|ver|veo|llego|llega|recibi|mandaron|enviaron|enviaste|mandaste) (un|el|este|ese|su|tu) correo\b/,
];

export function esConsultaSobreCobro(textos: (string | null | undefined)[]): boolean {
    return textos.some((t) => {
        const n = normalizarFrase(t);
        return !!n && SENALES_DE_CONSULTA.some((re) => re.test(n));
    });
}

/**
 * ¿La lectura muestra un comprobante de pago de verdad? Monto, y una prueba de
 * la transacción: la referencia, o la fecha con el banco. Un correo de cobro o
 * un estado de cuenta trae monto y fecha, pero ni referencia ni banco.
 */
export function pareceComprobanteDePago(ocr: Partial<Awaited<ReturnType<typeof extractReceipt>>> | null | undefined): boolean {
    if (!ocr || ocr.isReceipt === false || ocr.isTransactionList === true) return false;
    if (!(typeof ocr.amount === 'number' && ocr.amount > 0)) return false;
    if (ocr.reference && String(ocr.reference).trim()) return true;
    return !!ocr.date && !!ocr.bank && ocr.bank !== 'Otro';
}

/** Los textos de la familia alrededor del adjunto: el pie y lo que escribió cerca. */
async function textosCercanos(fila: FilaCola): Promise<(string | null | undefined)[]> {
    const textos: (string | null | undefined)[] = [fila.media_caption];
    try {
        const { data: conv } = await supabase.from('whatsapp_conversations')
            .select('id').eq('integration_id', fila.integration_id).eq('contact_wa_id', fila.wa_phone_number)
            .maybeSingle();
        if ((conv as any)?.id) {
            const base = fila.created_at ? new Date(fila.created_at).getTime() : Date.now();
            const { data } = await supabase.from('whatsapp_messages')
                .select('text_body, created_at')
                .eq('conversation_id', (conv as any).id)
                .eq('direction', 'inbound')
                .gte('created_at', new Date(base - 15 * 60_000).toISOString())
                .lte('created_at', new Date(base + 5 * 60_000).toISOString())
                .limit(30);
            for (const m of (Array.isArray(data) ? data : []) as any[]) textos.push(m?.text_body);
        }
    } catch {
        // Sin textos se decide solo con el pie y la lectura.
    }
    return textos;
}

async function pistaDeCobro(fila: FilaCola): Promise<PistaDeCobro | null> {
    try {
        return pistaDesdeTextos(await textosCercanos(fila));
    } catch {
        return null;
    }
}

// ─── Mensajes al acudiente ───────────────────────────────────────────────────
// Todos siguen la misma forma: qué revisamos → qué encontró → qué necesitamos →
// cómo seguir. Nunca «contáctanos».

const M = {
    // Antes había acá un `noIdentificado` que pedía el correo para mandar un
    // código. Se eliminó el 2026-10-03: con el bot APAGADO le salió de verdad a
    // 17 familias de Dynasty, y a todas se las podía reconocer por el teléfono
    // (`wa_identify_by_phone`), que este worker no consultaba. Un comprobante
    // no es momento de pedir un trámite: o se sabe quién es, o lo ve la escuela.

    sinCuenta:
        'Recibí tu comprobante 📄 Como todavía no tienes tu cuenta creada, ' +
        'se lo paso a la escuela para que lo aplique.',

    numeroAmbiguo:
        'Recibí tu comprobante 📄 Tu número está en más de una cuenta de la escuela, ' +
        'así que se lo paso a la escuela para que lo aplique a la que corresponde.',

    // Familia reconocida (por OTP) cuya conversación ya no tiene acudiente: no
    // debería pasar, pero si pasa no se le pide nada — lo resuelve un humano.
    escaladoSinAcudiente:
        'Recibí tu comprobante 📄 Se lo paso a la escuela para que lo aplique.',

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

    // El adjunto acompaña una pregunta o un reclamo sobre un cobro (o no es un
    // comprobante y la familia no tiene cuenta): no se dice «comprobante», no se
    // promete aplicar nada y no se ofrece el registro — lo atiende una persona.
    consulta:
        'Recibí tu mensaje 🙏 Se lo paso a la escuela para que lo revise contigo ' +
        'y te responda por aquí.',
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
export function esTransitorio(error: string): boolean {
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
    const { error } = await supabase.from('whatsapp_inbound_queue')
        .update({ status, processed_at: new Date().toISOString(), locked_until: null, ...extra })
        .eq('id', id);
    // Un cierre que falla deja la fila en 'processing' y se reprocesa cuando
    // vence el lease. Que al menos quede en el log (así pasó con el
    // result_type 'enrollment_form', que el CHECK rechaza).
    if (error) console.error('[wa-queue] no se pudo cerrar la fila', { id, status, err: error.message });
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
/** Resultado de estampar un comprobante en un cobro, sin hablar con nadie. */
export type ResultadoEstampado =
    | { ok: true; veredicto: ReturnType<typeof evaluateVerdict>; actualizado: boolean }
    /** 23505: esa referencia de banco ya está en otro pago de la escuela. */
    | { ok: false; duplicado: true; yaAplicado: { id: string; concept: string | null; amount: number; status: string } | null }
    | { ok: false; duplicado: false; error: string };

/**
 * Deja el comprobante en el cobro: archivo, lectura, veredicto y
 * `awaiting_approval`. NADA más — ni aprueba, ni responde, ni cierra la fila.
 *
 * Se separó de `aplicarComprobante` el 2026-10-05 para la recuperación en lote
 * (scripts/wa-recuperar-comprobantes.ts y el importador de chats exportados):
 * esos caminos tienen que dejar el comprobante EXACTAMENTE como lo deja el
 * worker —mismas columnas, mismo veredicto, misma defensa antiduplicado— pero
 * sin `evaluatePaymentReceipt` (que con auto-aprobación prendida aprobaría
 * solo) y sin escribirle al acudiente. Un solo estampado para los tres caminos
 * evita que diverjan en qué columnas llenan.
 */
export async function estamparComprobante(
    ctx: Pick<ContextoAplicacion, 'schoolId' | 'storagePath' | 'sha' | 'ocr' | 'log' | 'queueId'>,
    pago: PagoPendiente,
): Promise<ResultadoEstampado> {
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

    const { data: estampados, error: stampErr } = await supabase.from('payments').update({
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
    }).eq('id', pago.id).in('status', ['pending', 'overdue']).select('id');

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
                .select('id, concept, amount, status')
                .eq('school_id', ctx.schoolId)
                .eq('ocr_reference', ctx.ocr.reference)
                .maybeSingle();
            return {
                ok: false,
                duplicado: true,
                yaAplicado: yaAplicado
                    ? { id: yaAplicado.id as string, concept: (yaAplicado.concept as string) ?? null,
                        amount: Number(yaAplicado.amount), status: yaAplicado.status as string }
                    : null,
            };
        }
        return { ok: false, duplicado: false, error: `no se pudo estampar el pago: ${stampErr.message}` };
    }
    // `actualizado` = false si el cobro dejó de estar pendiente entre la
    // búsqueda y el estampado (la escuela lo registró en el medio). El worker
    // no lo mira —conserva su comportamiento—; la recuperación sí, para no
    // reportar «en revisión» un comprobante que no quedó en ningún cobro.
    return { ok: true, veredicto, actualizado: Array.isArray(estampados) ? estampados.length > 0 : true };
}

export async function aplicarComprobante(
    ctx: ContextoAplicacion,
    pago: PagoPendiente,
    restantes: PagoPendiente[],
): Promise<void> {
    const estampado = await estamparComprobante(ctx, pago);

    if (!estampado.ok) {
        // 23505 sobre `uq_payments_school_ocr_reference` NO es un fallo: ver
        // el comentario en `estamparComprobante`.
        if (estampado.duplicado) {
            const yaAplicado = estampado.yaAplicado;
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
                // El pago que YA tiene esa referencia: la Bandeja cierra la fila
                // sola con él. `result_type` sigue 'none': el aviso de desenlace
                // (whatsapp-payment-outcome) no la toma.
                ...(yaAplicado?.id ? { result_ref_id: yaAplicado.id } : {}),
                error_message: `referencia ya usada: ${ctx.ocr.reference}`,
            });
            ctx.log?.info?.({ queueId: ctx.queueId, referencia: ctx.ocr.reference }, '[wa-queue] comprobante repetido');
            return;
        }
        await ctx.alFallar(estampado.error);
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

    const salida = await ctx.responder(respuesta, 'resultado_comprobante') as { ok?: boolean; error?: string } | undefined;
    // En revisión y Meta rechazó el texto por ventana cerrada (cola atrasada
    // más de 24 h): `comprobante_en_revision` si está aprobada; si no, como antes.
    if (resultado.action !== 'approved' && resultado.action !== 'rejected'
        && salida?.ok === false && esErrorDeVentana(salida.error)) {
        await avisarRevisionTrasVentana(ctx, pago).catch(() => undefined);
    }

    await cerrar(ctx.queueId, 'done', {
        result_type: 'payment_receipt',
        result_ref_id: pago.id,
        matched_parent_id: ctx.parentId,
        matched_child_id: pago.child_id,
        error_message: null,
    });
    ctx.log?.info?.({ queueId: ctx.queueId, paymentId: pago.id, accion: resultado.action }, '[wa-queue] aplicado');
}
/** Ver `aplicarComprobante`: la plantilla de «en revisión» cuando el texto no pudo salir por ventana. */
async function avisarRevisionTrasVentana(ctx: ContextoAplicacion, pago: PagoPendiente): Promise<void> {
    const { data: fila } = await supabase.from('whatsapp_inbound_queue')
        .select('wa_phone_number').eq('id', ctx.queueId).maybeSingle();
    const telefono = (fila as any)?.wa_phone_number as string | undefined;
    if (!telefono) return;
    const { avisarRevisionPorPlantilla } = await import('../services/whatsapp-aviso-revision.service');
    const r = await avisarRevisionPorPlantilla({
        schoolId: ctx.schoolId, telefono, paymentId: pago.id, parentId: ctx.parentId,
        monto: ctx.ocr?.amount ?? null, atleta: pago.atleta, paso: 'resultado_comprobante_plantilla',
    });
    ctx.log?.info?.({ queueId: ctx.queueId, paymentId: pago.id, enviado: r.enviado, motivo: (r as any).motivo },
        '[wa-queue] ventana cerrada: aviso de revisión por plantilla');
}
/** Resultado de bajar y guardar el archivo — el llamador solo revisa `ok`; en `false` la fila ya quedó cerrada/reintentando y hay que retornar sin hacer nada más. */
type ArchivoBajado =
    | { ok: true; base64: string; mime: string; storagePath: string }
    | { ok: false };

/** Lo que devuelve `obtenerArchivoDeFila`, SIN haber tocado el estado de la fila. */
export type ArchivoObtenido =
    | { ok: true; base64: string; mime: string; storagePath: string | null }
    | { ok: false; error: string; transitorio: boolean };

/**
 * Baja (o relee) el archivo de una fila y, si `guardar`, lo sube al bucket y
 * estampa `storage_path` en la fila. NO cierra ni reintenta la fila: decide el
 * llamador.
 *
 * Existe aparte de `bajarYGuardarArchivo` para la recuperación en lote
 * (scripts/wa-recuperar-comprobantes.ts): esa ruta procesa filas `ignored`, y
 * el `reintentar` del worker las devolvería a `pending` — donde el cron las
 * tomaría y le respondería al acudiente. Y en simulación necesita el archivo
 * en memoria para el OCR sin subir nada (`guardar: false`).
 *
 * Misma ruta en el bucket que siempre: `{school}/whatsapp/{fila}.{ext}`.
 */
export async function obtenerArchivoDeFila(
    fila: FilaCola,
    wa: WhatsAppIntegration,
    opciones: { guardar: boolean },
): Promise<ArchivoObtenido> {
    let mime = fila.media_mime_type ?? 'image/jpeg';

    if (fila.storage_path) {
        const { data: blob, error } = await supabase.storage.from(BUCKET).download(fila.storage_path);
        if (error || !blob) return { ok: false, error: `no se pudo releer del bucket: ${error?.message}`, transitorio: true };
        const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
        return { ok: true, base64, mime, storagePath: fila.storage_path };
    }

    if (!fila.media_id) return { ok: false, error: 'fila sin media_id', transitorio: false };

    const bajada = await downloadMedia(wa, fila.media_id);
    if (!bajada.ok || !bajada.base64) {
        const error = bajada.error ?? '';
        return { ok: false, error: error || 'fallo al bajar', transitorio: esTransitorio(error) };
    }
    const base64 = bajada.base64;
    mime = bajada.mimeType ?? mime;
    if (!opciones.guardar) return { ok: true, base64, mime, storagePath: null };

    const ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] ?? 'jpg');
    const storagePath = `${fila.school_id}/whatsapp/${fila.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(storagePath, Buffer.from(base64, 'base64'), { contentType: mime, upsert: true });
    if (upErr) {
        const detalle = [upErr.message, (upErr as { statusCode?: string }).statusCode, upErr.name]
            .filter(Boolean).join(' · ') || JSON.stringify(upErr).slice(0, 200);
        return { ok: false, error: `no se pudo guardar en el bucket: ${detalle}`, transitorio: true };
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
 *
 * Lo transitorio (red, 429, 5xx, bucket) reintenta; lo permanente (mime,
 * tamaño, media vencida, sin media_id) cierra la fila en `failed`.
 */
async function bajarYGuardarArchivo(fila: FilaCola, wa: WhatsAppIntegration, log?: Logger): Promise<ArchivoBajado> {
    const r = await obtenerArchivoDeFila(fila, wa, { guardar: true });
    if (!r.ok) {
        if (r.transitorio) await reintentar(fila, r.error, log);
        else await cerrar(fila.id, 'failed', { error_message: r.error });
        return { ok: false };
    }
    return { ok: true, base64: r.base64, mime: r.mime, storagePath: r.storagePath as string };
}

/**
 * ¿El dinero fue a una cuenta de la escuela?
 *
 * Aquí todavía no se sabe a qué cobro va, así que valen TODAS las llaves de
 * la escuela, también las restringidas a un concepto (el Nequi de
 * inscripciones de Dynasty): el dinero sí llegó a la escuela. Si el cobro
 * resulta ser de otro concepto, lo marca el veredicto de aplicarComprobante
 * (amarillo → revisión), no este portero. Antes comparaba con igualdad
 * exacta y sin las restringidas: rechazaba inscripciones legítimas
 * (2026-10-03) y los destinos enmascarados ("**** 6942") que el check 4 ya
 * aceptaba.
 *
 * Sin destino leído o sin cuentas registradas → true: no hay con qué cruzar.
 * Exportada para que la recuperación en lote decida con la misma regla.
 */
export async function destinoEsDeLaEscuela(
    schoolId: string,
    ocr: Awaited<ReturnType<typeof extractReceipt>>,
): Promise<boolean> {
    const ctx = await buildVerdictContext(schoolId, { referenceNorm: null, imageSha256: null });
    const cuentas = [
        ...(ctx.registeredAccounts ?? []),
        ...(ctx.restrictedAccounts ?? []).map((r) => r.value),
    ];
    const destino = normalizeDestination(ocr.destination);
    return !(destino && cuentas.length > 0 && !destinationMatchesRegistered(destino, cuentas));
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
    // ¿La MISMA imagen ya se recibió de esta familia? (…0340, 07-oct: la foto
    // enviada dos veces recibió «lo apliqué…» y 40 s después «no tienes cobros
    // pendientes».) Va antes que todo: la respuesta nunca contradice a la primera.
    const shaArchivo = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex');
    if (await atenderComprobanteRepetido(fila, parentId, shaArchivo, responder, log)) return;

    if (ocr.isTransactionList === true) {
        await responder(M.esListado, 'es_listado');
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'listado de movimientos' });
        return;
    }

    // ¿El dinero fue siquiera a la escuela? Va ANTES de mirar los pendientes
    // (decirle "no tienes pendientes" a quien mandó el comprobante de otra
    // cuenta es cierto pero inútil). La regla vive en `destinoEsDeLaEscuela`.
    if (!(await destinoEsDeLaEscuela(fila.school_id, ocr))) {
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

    // ¿Hay una venta por WhatsApp esperando el pago (servicio, carril B)? La
    // foto es de ESE cobro suelto, nunca de la mensualidad
    // (docs/specs/ventas-por-whatsapp.md §5.3). Va antes que todo lo demás:
    // el cobro de la venta es la mejor pista que existe.
    const venta = decidirComprobanteDeVenta(
        await ventaAbiertaDeContacto(fila.integration_id, fila.wa_phone_number), pendientes);
    if (venta.tipo === 'aplicar') {
        log?.info?.({ queueId: fila.id, paymentId: venta.pago.id }, '[wa-queue] comprobante de la venta abierta');
        await aplicarComprobante({
            queueId: fila.id, schoolId: fila.school_id, parentId, storagePath,
            sha: crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex'),
            ocr, responder,
            alFallar: (motivo) => reintentar(fila, motivo, log),
            log,
        }, venta.pago, pendientes.filter((x) => x.id !== venta.pago.id));
        return;
    }
    if (venta.tipo === 'a_la_escuela') {
        await responder(venta.mensaje, 'otro_concepto');
        await cerrar(fila.id, 'ignored', {
            result_type: 'escalated', matched_parent_id: parentId, error_message: venta.motivo,
        });
        return;
    }

    // ¿Dice que es OTRA cosa? (P0, 2026-10-07: «Clase perfeccionamiento» y «lo
    // de los uniformes» se aplicaron a la mensualidad y la escuela los rechazó
    // tres veces.) Si hay un cobro pendiente de ese concepto por ese monto, va
    // a ese; si no, NO se aplica a la mensualidad: lo registra la escuela.
    const otro = decidirOtroConcepto(
        detectarOtroConcepto({
            pie: fila.media_caption,
            descripcion: ocr.description,
            chat: await textosAlrededor(fila),
        }),
        pendientes,
        ocr.amount ?? null,
    );
    if (otro.tipo === 'aplicar') {
        log?.info?.({ queueId: fila.id, paymentId: otro.pago.id, concepto: otro.senal.concepto }, '[wa-queue] cobro del concepto que nombra la familia');
        await aplicarComprobante({
            queueId: fila.id, schoolId: fila.school_id, parentId, storagePath,
            sha: crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex'),
            ocr, responder,
            alFallar: (motivo) => reintentar(fila, motivo, log),
            log,
        }, otro.pago, pendientes.filter((x) => x.id !== otro.pago.id));
        return;
    }
    if (otro.tipo === 'a_la_escuela') {
        await responder(mensajeOtroConcepto(otro.senal), 'otro_concepto');
        await cerrar(fila.id, 'ignored', {
            result_type: 'escalated',
            matched_parent_id: parentId,
            error_message: motivoOtroConcepto(otro.senal),
        });
        log?.info?.({ queueId: fila.id, concepto: otro.senal.concepto, fuente: otro.senal.fuente }, '[wa-queue] otro concepto: a la escuela');
        return;
    }

    let match = resolverPago(pendientes, ocr.amount ?? null);

    // El monto no desempata: ¿la familia dijo a cuál iba? (P3)
    if (match.tipo === 'preguntar') {
        const elegido = elegirPorPista(pendientes, await pistaDeCobro(fila));
        if (elegido) {
            log?.info?.({ queueId: fila.id, paymentId: elegido.id }, '[wa-queue] cobro elegido por la pista del texto');
            match = { tipo: 'unico', pago: elegido };
        }
    }

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

// ─── La misma foto otra vez (auditoría 2026-10-07, …0340) ────────────────────

/** Días en los que la misma imagen (sha256) de la familia cuenta como repetida. */
export const DIAS_COMPROBANTE_REPETIDO = 7;
/** Si ya se dijo «ya lo había recibido» hace menos de esto, se calla. */
export const VENTANA_SILENCIO_REPETIDO_MS = 10 * 60_000;
/** error_message de la fila cerrada por repetida: marca el aviso para el freno. */
export const MOTIVO_COMPROBANTE_REPETIDO = 'comprobante ya recibido (misma imagen)';
export const TEXTO_COMPROBANTE_REPETIDO = 'Este comprobante ya lo había recibido 👍';

/** El cobro de la familia que ya tiene esta imagen (≤ 7 días), o null. Nunca lanza. */
export async function cobroConLaMismaImagen(
    schoolId: string, parentId: string, sha: string, ahora = Date.now(),
): Promise<{ id: string; concept: string | null; status: string } | null> {
    try {
        const { data, error } = await supabase.from('payments')
            .select('id, concept, status')
            .eq('school_id', schoolId)
            .eq('parent_id', parentId)
            .eq('receipt_image_sha256', sha)
            .gte('receipt_verdict_at', new Date(ahora - DIAS_COMPROBANTE_REPETIDO * 24 * 3600_000).toISOString())
            .limit(1);
        if (error || !Array.isArray(data) || !data.length) return null;
        const p = data[0] as any;
        return { id: p.id, concept: p.concept ?? null, status: p.status };
    } catch {
        return null;
    }
}

/** ¿Este contacto ya recibió «ya lo había recibido» hace < 10 min? Nunca lanza. */
async function repetidoAvisadoHacePoco(fila: FilaCola, ahora = Date.now()): Promise<boolean> {
    try {
        const { data } = await supabase.from('whatsapp_inbound_queue')
            .select('id')
            .eq('integration_id', fila.integration_id)
            .eq('wa_phone_number', fila.wa_phone_number)
            .eq('error_message', MOTIVO_COMPROBANTE_REPETIDO)
            .neq('id', fila.id)
            .gte('processed_at', new Date(ahora - VENTANA_SILENCIO_REPETIDO_MS).toISOString())
            .limit(1);
        return Array.isArray(data) && data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Si la imagen (sha256) ya está en un cobro de esta familia de los últimos 7
 * días: «Este comprobante ya lo había recibido 👍» una vez —o nada si ya se
 * dijo hace < 10 min— y la fila se cierra apuntando a ese cobro. Nunca
 * contradice la primera respuesta. Devuelve true si la atendió.
 */
async function atenderComprobanteRepetido(
    fila: FilaCola,
    parentId: string,
    sha: string,
    responder: (texto: string, paso: string) => Promise<unknown>,
    log?: Logger,
): Promise<boolean> {
    const previo = await cobroConLaMismaImagen(fila.school_id, parentId, sha);
    if (!previo) return false;
    const callar = await repetidoAvisadoHacePoco(fila);
    if (!callar) await responder(TEXTO_COMPROBANTE_REPETIDO, 'comprobante_repetido');
    await cerrar(fila.id, 'ignored', {
        result_type: 'none',
        result_ref_id: previo.id,
        matched_parent_id: parentId,
        error_message: MOTIVO_COMPROBANTE_REPETIDO,
    });
    log?.info?.({ queueId: fila.id, paymentId: previo.id, callar }, '[wa-queue] misma imagen ya recibida');
    return true;
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
    // `result_type` NO puede ser 'enrollment_form': el CHECK `chk_wa_queue_result`
    // (verificado en la base viva el 2026-10-03) solo admite payment_receipt,
    // glosa, escalated y none. Con 'enrollment_form' el UPDATE fallaba en
    // silencio, la fila quedaba en 'processing', el lease vencía y se volvía a
    // procesar: otra fila en enrollment_form_intake por vuelta, hasta agotar
    // los reintentos y terminar 'failed'. La matrícula se ubica por `result_ref_id`.
    await cerrar(fila.id, 'done', { result_type: 'none', result_ref_id: intake.id });
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

/**
 * Qué hace el worker con un adjunto, según quién lo manda y si el bot está
 * prendido. Función pura a propósito: es LA regla, y se prueba sin mocks.
 *
 * Medido el 2026-10-03 en Dynasty (Coexistence: el número de la escuela es
 * también el WhatsApp personal de la dueña), con el bot APAGADO: el worker no
 * miraba `ai_enabled` y le escribió de verdad a 17 familias pidiéndoles el
 * correo. La decisión de producto que sale de ahí:
 *
 *  - Apagado es apagado. Ni comprobantes, ni la rama de staff-admin (alta por
 *    foto de matrícula): con el bot apagado el worker no habla con nadie. La
 *    dueña ve y contesta todo desde su celular.
 *  - El asistente solo atiende familias. Desconocidos y contactos marcados
 *    como personales → silencio, aunque la escuela haya pedido
 *    `responder_desconocidos`: eso es para el texto del bot; a un comprobante
 *    de alguien que no se sabe quién es no hay nada útil que contestarle sin
 *    pedirle un trámite.
 *  - Quien administra la escuela sigue por su rama (`procesarComoStaffAdmin`)
 *    AUNQUE también sea familia: en una escuela chica el dueño suele tener
 *    hijos entrenando, y `debeAtender` lo clasifica como 'familia' antes que
 *    como 'staff'. Sin esto perdería el alta por foto de matrícula. Su rama ya
 *    aplica el comprobante como acudiente cuando corresponde.
 */
export type DecisionDeAdjunto =
    | 'bot_apagado'       // cerrar ignored, sin responder, sin bajar nada
    | 'staff_admin'       // procesarComoStaffAdmin
    | 'comprobante'       // camino de siempre, con el parent_id por teléfono u OTP
    | 'escalar_sin_cuenta'
    | 'escalar_ambiguo'
    | 'silencio';         // cerrar ignored, sin responder

export function decidirAdjunto(a: {
    botEncendido: boolean;
    tipo: TipoDeContacto;
    /** Solo se consulta si el tipo lo amerita; para 'staff' es true por definición. */
    esStaffAdmin: boolean;
}): DecisionDeAdjunto {
    if (!a.botEncendido) return 'bot_apagado';
    // Lo marcado a mano como personal manda sobre todo, incluso sobre staff.
    if (a.tipo === 'personal' || a.tipo === 'desconocido') return 'silencio';
    if (a.tipo === 'staff' || a.esStaffAdmin) return 'staff_admin';
    if (a.tipo === 'familia') return 'comprobante';
    if (a.tipo === 'familia_sin_cuenta') return 'escalar_sin_cuenta';
    if (a.tipo === 'ambiguo') return 'escalar_ambiguo';
    return 'silencio';
}

// Los enlaces salen a familias reales por el número de la escuela: siempre la
// app de producción. Con FRONTEND_URL, el BFF de dev mandaba dev.sportmaps.co
// (la base es una sola y dev también procesa la cola; 2026-10-06).
const FRONTEND_URL = APP_PUBLICA_PROD;

/**
 * Familia conocida por la escuela pero sin cuenta. El enlace es el de SU
 * invitación (mismo criterio que whatsapp-bot.service): el registro normal no
 * vincula `children`, solo `accept_invitation_pro` lo hace.
 */
async function mensajeSinCuenta(fila: FilaCola): Promise<string> {
    // Solo la invitación de un atleta ACTIVO (whatsapp-invitacion-vigente): a la
    // familia de un atleta dado de baja no se le ofrece crear la cuenta.
    const { invitacion } = await invitacionPendienteVigente(
        fila.integration_id, fila.wa_phone_number, fila.school_id);
    if (!invitacion?.invite_id) return M.sinCuenta;
    const enlace = `${FRONTEND_URL}/register?invite=${invitacion.invite_id}` +
        (invitacion.email ? `&email=${encodeURIComponent(invitacion.email)}` : '');
    return `${M.sinCuenta}\n\nSi creas tu cuenta aquí, la próxima vez tu comprobante se aplica solo: ${enlace}`;
}

/**
 * El adjunto acompaña una consulta, no un pago: se le dice a la familia que lo
 * atiende una persona y la CONVERSACIÓN pasa a la escuela (abierta en el buzón,
 * con push al staff), igual que el escalamiento del bot. La fila NO queda como
 * comprobante a aplicar (`result_type='none'`, no `escalated`): no es un pago.
 * El paso es 'escalated' para que cuente como escalamiento y para que el bot
 * no le conteste encima a la persona que lo va a atender.
 */
async function derivarConsulta(
    fila: FilaCola,
    wa: WhatsAppIntegration,
    conversationId: string | null,
    responder: (texto: string, paso: string) => Promise<unknown>,
    origen: string,
    log?: Logger,
): Promise<void> {
    await responder(M.consulta, 'escalated');
    if (conversationId) {
        try {
            // Import perezoso, como `ofrecerConsentimientoSiFalta`: el bot arrastra media app.
            const { abrirConsultaParaLaEscuela } = await import('../services/whatsapp-bot.service');
            await abrirConsultaParaLaEscuela(wa, conversationId, fila.wa_phone_number, 'consulta_con_adjunto');
        } catch (e: any) {
            log?.warn?.({ queueId: fila.id, err: e?.message }, '[wa-queue] no se pudo avisar a la escuela; se abre la conversación');
            await supabase.from('whatsapp_conversations')
                .update({ status: 'open', updated_at: new Date().toISOString() })
                .eq('id', conversationId);
        }
    }
    await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: `consulta_no_comprobante:${origen}` });
    log?.info?.({ queueId: fila.id, origen }, '[wa-queue] adjunto con consulta: a la escuela como conversación');
}

/**
 * Familia que la escuela conoce pero a la que no se le puede aplicar el
 * comprobante sola (sin cuenta, o número en dos cuentas). Se guarda el
 * archivo —la URL de Meta expira en minutos y la escuela tiene que poder
 * verlo para aplicarlo a mano—, se le avisa UNA vez y la fila queda en el
 * buzón (`ignored` + `result_type='escalated'`; el buzón lista
 * failed/ignored/waiting_user). Sin OCR: lo va a leer una persona.
 *
 * No va a `waiting_user`: ese estado significa «el bot preguntó a cuál cobro
 * aplicar» y lo consume whatsapp-respuesta-de-cobro.service.
 */
async function escalarALaEscuela(
    fila: FilaCola,
    wa: WhatsAppIntegration,
    conversationId: string | null,
    responder: (texto: string, paso: string) => Promise<unknown>,
    mensaje: string | (() => Promise<string>),
    paso: string,
    motivo: string,
    log?: Logger,
): Promise<void> {
    const bajada = await bajarYGuardarArchivo(fila, wa, log);
    if (!bajada.ok) return;

    // ¿Es siquiera un comprobante? (2026-10-06, ver `esConsultaSobreCobro`.)
    // Primero lo que escribió —no cuesta nada—; si no lo dice, la lectura. Antes
    // este camino no leía nada y a una captura de un correo de cobro con un
    // reclamo le contestaba «Recibí tu comprobante».
    let consulta = esConsultaSobreCobro(await textosCercanos(fila));
    if (!consulta) {
        try {
            consulta = !pareceComprobanteDePago(await extractReceipt(bajada.base64, bajada.mime));
        } catch (err: any) {
            // Sin lectura no hay veredicto: sigue como antes —lo mira una persona igual—.
            log?.warn?.({ queueId: fila.id, err: err?.message ?? err }, '[wa-queue] OCR no disponible al escalar');
        }
    }
    if (consulta) {
        await derivarConsulta(fila, wa, conversationId, responder, motivo, log);
        return;
    }

    await responder(typeof mensaje === 'function' ? await mensaje() : mensaje, paso);
    await cerrar(fila.id, 'ignored', { result_type: 'escalated', error_message: motivo });
    log?.info?.({ queueId: fila.id, motivo }, '[wa-queue] escalado a la escuela');
}

// ─── Una respuesta por comprobante (2026-10-07) ─────────────────────────────
//
// Medido en Dynasty (6-7 oct, 81 ráfagas de adjuntos en 48 h): de las 38 que
// recibieron respuesta, la mediana fue 2 mensajes del bot y el máximo 8; 18
// tuvieron 3 o más. El acuse inmediato del webhook («Recibí tu comprobante 📄
// Lo reviso…») + el resultado de la cola ~50 s después + la pregunta del
// consentimiento pegada + el párrafo de «no tienes cuenta» repetido.
//
// Ahora: el resultado sale en UN mensaje (con la presentación delante si es el
// primer contacto y la pregunta del consentimiento al pie, con sus botones). El
// acuse solo sale si a los ACUSE_DIFERIDO_MS de llegado el archivo todavía no
// hay resultado. Lo manda el worker que tiene la fila (lease de
// `wa_queue_claim`): uno solo entre los 3 BFF, sin reserva extra en la base.

/** A partir de cuánto (desde que llegó el archivo) se acusa sin resultado. La cola tarda ~40–60 s. */
export const ACUSE_DIFERIDO_MS = 90_000;
let esperaAcuseMs = ACUSE_DIFERIDO_MS;
/** Solo para pruebas. */
export function _fijarEsperaAcuse(ms: number): void { esperaAcuseMs = ms; }

/** Pasos que son PREGUNTAS: salen en el acto (llevan su `queue_id` y esperan respuesta). */
const PASOS_PREGUNTA = new Set(['ask_cual_pago', 'confirmar_combinacion']);

/** Respuestas de una ráfaga de archivos del mismo contacto, para mandarlas en UN mensaje. */
export interface RespuestaEnRafaga { texto: string; paso: string; queueId: string }
export interface Rafaga {
    respuestas: RespuestaEnRafaga[];
    /** El envío de la última fila (con su conversación, baja, acudiente). */
    enviar?: (texto: string, payload: Record<string, unknown>, conConsentimiento: boolean) => Promise<unknown>;
}

/**
 * Pura: las respuestas de varias fotos en un mensaje. Textos iguales van una
 * vez («Recibí tus 2 comprobantes 📄 Como todavía…»); distintos, numerados.
 */
export function resumirRafaga(respuestas: RespuestaEnRafaga[]): { texto: string; paso: string } {
    const n = respuestas.length;
    const unicos: RespuestaEnRafaga[] = [];
    for (const r of respuestas) if (!unicos.some((u) => u.texto === r.texto)) unicos.push(r);
    if (n <= 1 || unicos.length === 1) {
        const r = unicos[0];
        const texto = n > 1 && r.texto.startsWith('Recibí tu comprobante')
            ? `Recibí tus ${n} comprobantes${r.texto.slice('Recibí tu comprobante'.length)}`
            : r.texto;
        return { texto, paso: r.paso };
    }
    return {
        texto: `Recibí tus ${n} comprobantes:\n\n` + unicos.map((r, i) => `*${i + 1}.* ${r.texto}`).join('\n\n'),
        paso: 'resultado_rafaga',
    };
}

/** ¿Ya se le dijo «todavía no tienes tu cuenta» en las últimas 24 h? */
async function yaSeDijoSinCuenta(conversationId: string | null): Promise<boolean> {
    if (!conversationId) return false;
    try {
        const { data } = await supabase.from('whatsapp_messages')
            .select('id')
            .eq('conversation_id', conversationId)
            .eq('direction', 'outbound')
            .in('payload->>step', PASOS_SIN_CUENTA)
            .gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
            .limit(1);
        return Array.isArray(data) && data.length > 0;
    } catch {
        return false;
    }
}

// ─── Para la Bandeja de comprobantes (2026-10-07) ───────────────────────────

/** Palabras con las que alguien anuncia un pago («mi pago de este mes», «Mes octubre»). */
const PISTA_DE_PAGO_DESCONOCIDO = new RegExp(
    '\\b(pagos?|pague|comprobantes?|soportes?|transferencias?|consignacion|consigno|mensualidad|recibo|abono|cuota|nequi|daviplata)\\b'
    + '|\\bmes (de )?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\\b');

/** Pura: ¿el pie o los textos alrededor del archivo hablan de un pago? Sin OCR. */
export function textosHablanDePago(textos: (string | null | undefined)[]): boolean {
    return textos.some((t) => {
        const n = normalizarFrase(t);
        return !!n && PISTA_DE_PAGO_DESCONOCIDO.test(n);
    });
}

/** El pie del archivo y lo que el contacto escribió 15 min antes / 5 min después. */
async function textosDelContacto(fila: FilaCola, conversationId: string | null): Promise<(string | null | undefined)[]> {
    const textos: (string | null | undefined)[] = [fila.media_caption];
    if (!conversationId) return textos;
    try {
        const base = fila.created_at ? new Date(fila.created_at).getTime() : Date.now();
        const { data } = await supabase.from('whatsapp_messages')
            .select('text_body')
            .eq('conversation_id', conversationId)
            .eq('direction', 'inbound')
            .gte('created_at', new Date(base - 15 * 60_000).toISOString())
            .lte('created_at', new Date(base + 5 * 60_000).toISOString())
            .limit(30);
        for (const m of (Array.isArray(data) ? data : []) as any[]) textos.push(m?.text_body);
    } catch { /* solo el pie */ }
    return textos;
}

/**
 * Familia sin cuenta: el atleta de la ficha con ese celular (`parent_phone_temp`),
 * si es UNO solo, en `matched_child_id` de la fila escalada. La Bandeja lo
 * muestra y la escuela lo aplica sin buscarlo. Nunca lanza.
 */
async function anotarAtletaDeLaFicha(fila: FilaCola): Promise<void> {
    try {
        const tel = String(fila.wa_phone_number ?? '').replace(/\D/g, '').slice(-10);
        if (!/^3\d{9}$/.test(tel)) return;
        const { data } = await supabase.from('children')
            .select('id')
            .eq('school_id', fila.school_id)
            .eq('is_active', true)
            .ilike('parent_phone_temp', `%${tel}`)
            .limit(2);
        if (!Array.isArray(data) || data.length !== 1) return;
        await supabase.from('whatsapp_inbound_queue')
            .update({ matched_child_id: (data[0] as any).id })
            .eq('id', fila.id)
            .eq('result_type', 'escalated');
    } catch { /* sin atleta: la escuela lo busca */ }
}

async function procesarFila(fila: FilaCola, log?: Logger, rafaga?: Rafaga): Promise<void> {
    // Acuse diferido: se arma cuando se sabe que a esta familia se le va a
    // contestar, y se desarma al salir.
    let acuseTimer: ReturnType<typeof setTimeout> | null = null;
    try {
        // La escuela de la fila queda en el contexto para el registro de consumo (llm_usage).
        await conContextoLlm({ schoolId: fila.school_id, feature: 'ocr' },
            () => procesarFilaInterna(fila, log, rafaga, (t) => { acuseTimer = t; }));
    } finally {
        if (acuseTimer) clearTimeout(acuseTimer);
    }
}

async function procesarFilaInterna(
    fila: FilaCola,
    log: Logger | undefined,
    rafaga: Rafaga | undefined,
    armarTimer: (t: ReturnType<typeof setTimeout>) => void,
): Promise<void> {
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
    /** Pasos que salieron en este procesamiento: decide si se ofrece el consentimiento. */
    const pasosEnviados = new Set<string>();

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
    // Mejora 9: si una persona tomó la conversación en el buzón, el comprobante
    // se procesa y se APLICA igual, pero no se le escribe a la familia: lo que
    // se le habría dicho queda en el log y el resultado se ve en el panel de
    // comprobantes. Se fija después de `debeAtender` (abajo).
    let tomada = false;
    /** ¿Ya se le contestó (o quedó en la ráfaga)? Desarma el acuse diferido. */
    let respondio = false;
    /** El acudiente, cuando se conoce: decide si la pregunta del consentimiento va al pie. */
    let parentIdConocido: string | null = null;

    /**
     * El envío en sí: presentación (primer contacto) y consentimiento al pie
     * (resultado de un comprobante) EN EL MISMO MENSAJE, anti-repetición, y
     * registro en whatsapp_messages.
     */
    const enviar = async (texto: string, payload: Record<string, unknown>, conConsentimiento: boolean) => {
        let cuerpo = texto;
        let botones: any[] | null = null;
        let extra: Record<string, unknown> = {};
        // Import perezoso: el bot arrastra el modelo y media app. Cada pieza
        // por separado y sin poder tumbar el envío: la respuesta sale igual.
        let bot: any = null;
        try { bot = await import('../services/whatsapp-bot.service'); } catch { bot = null; }
        if (conversationId && bot) {
            try {
                cuerpo = await bot.conPresentacionSiEsPrimera(wa, conversationId, cuerpo);
            } catch { /* sin presentación */ }
            if (conConsentimiento && parentIdConocido) {
                try {
                    const anexo = await bot.anexoDeConsentimiento(wa, conversationId, fila.wa_phone_number, parentIdConocido);
                    if (anexo?.texto) {
                        cuerpo = `${cuerpo}\n\n${anexo.texto}`;
                        botones = bot.BOTONES_CONSENTIMIENTO ?? null;
                        extra = { pregunta: 'ask_consent' };
                    }
                } catch { /* sin consentimiento: sale la respuesta sola */ }
            }
        }
        const final = aFormatoWhatsApp(dadoDeBaja ? cuerpo + AVISO_DADO_DE_BAJA : cuerpo);

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
                log?.info?.({ queueId: fila.id, paso: payload.step }, '[wa-queue] mismo mensaje reciente, no se repite');
                return { ok: true };
            }
        }

        let tipo = 'text';
        let enviado = botones?.length
            ? await sendInteractiveButtons(wa, fila.wa_phone_number, final, botones)
            : null;
        if (enviado?.ok) {
            tipo = 'interactive';
        } else {
            // Sin botones, o Meta los rechazó: el texto plano SIEMPRE sale (la
            // pregunta dice «Responde *SÍ*», que se lee igual que el botón).
            enviado = await sendTextMessage(wa, fila.wa_phone_number, final);
        }
        if (conversationId) {
            await supabase.rpc('wa_record_outbound_message', {
                p_conversation_id: conversationId,
                p_integration_id: fila.integration_id,
                p_wa_message_id: enviado.waMessageId || `local-${crypto.randomUUID()}`,
                p_type: tipo,
                p_text_body: final,
                p_payload: { ...payload, ...extra, ...(tipo === 'interactive' ? { botones } : {}) },
                p_ai_generated: true,
                p_to_wa_id: fila.wa_phone_number,
            });
        }
        return enviado;
    };

    const responder = async (texto: string, paso: string) => {
        if (tomada) {
            log?.info?.({ queueId: fila.id, paso }, '[wa-queue] conversación tomada: no se le escribe a la familia');
            return { ok: true, silenciado: true };
        }
        respondio = true;
        pasosEnviados.add(paso);
        // Ráfaga: la respuesta se junta con las de las otras fotos y sale UNA
        // vez al final (`runWhatsAppQueue`). Las preguntas salen ya.
        if (rafaga && !PASOS_PREGUNTA.has(paso)) {
            rafaga.respuestas.push({ texto, paso, queueId: fila.id });
            rafaga.enviar = enviar;
            return { ok: true, enRafaga: true };
        }
        return enviar(texto, { step: paso, queue_id: fila.id }, paso === 'resultado_comprobante');
    };

    /**
     * Acuse diferido: si a los ACUSE_DIFERIDO_MS de llegado el archivo esta
     * fila todavía no contestó, «Recibí tu comprobante 📄 Lo reviso…» por
     * `acusarAdjunto` (respeta modo, baja, persona escribiendo y ráfaga; se
     * calla si el bot ya dijo algo después del archivo). Solo en el primer
     * intento: un reintento ya tuvo el suyo.
     */
    const armarAcuseDiferido = () => {
        if (fila.retries > 0 || !conversationId || tomada) return;
        const llegada = fila.created_at ? Date.parse(fila.created_at) : NaN;
        const espera = Math.max(0, (Number.isFinite(llegada) ? llegada : Date.now()) + esperaAcuseMs - Date.now());
        const conv = conversationId;
        armarTimer(setTimeout(() => {
            if (respondio) return;
            respondio = true;
            void (async () => {
                try {
                    const { acusarAdjunto } = await import('../services/whatsapp-bot.service');
                    const r = await acusarAdjunto(wa, conv, fila.wa_phone_number, fila.wa_message_id, fila.media_caption ?? null);
                    log?.info?.({ queueId: fila.id, acuse: r }, '[wa-queue] acuse diferido');
                } catch (e: any) {
                    log?.warn?.({ queueId: fila.id, err: e?.message }, '[wa-queue] no se pudo acusar');
                }
            })();
        }, espera));
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

    // 2.5. ¿Lo atiende el asistente? Va ANTES de bajar el archivo y del OCR:
    // con el bot apagado no se gasta nada ni se le escribe a nadie. Medido el
    // 2026-10-03 en Dynasty: sin esta puerta el worker le pidió el correo a 17
    // familias con `ai_enabled=false`.
    //
    // `debeAtender` también deja `contact_kind` en la conversación (el buzón
    // filtra por eso aunque el bot esté apagado) y, si reconoce al acudiente
    // por teléfono, vincula la conversación (`wa_identify_by_phone`).
    const atencion = await debeAtender(wa, conversationId, fila.wa_phone_number);
    tomada = atencion.tomada === true;

    // Solo se pregunta si administra la escuela cuando la respuesta puede
    // cambiar algo: familias que también son dueñas (ver `decidirAdjunto`).
    let esStaffAdmin = atencion.tipo === 'staff';
    if (atencion.botEncendido && ['familia', 'familia_sin_cuenta', 'ambiguo'].includes(atencion.tipo)) {
        const { data: staffCheck } = await supabase.rpc('wa_identify_staff_admin_by_phone', {
            p_school_id: fila.school_id,
            p_wa_phone_number: fila.wa_phone_number,
        });
        esStaffAdmin = (staffCheck as any)?.estado === 'identificado';
    }

    const decision = decidirAdjunto({ botEncendido: atencion.botEncendido, tipo: atencion.tipo, esStaffAdmin });
    log?.info?.({ queueId: fila.id, tipo: atencion.tipo, decision }, '[wa-queue] atención');

    if (decision === 'bot_apagado') {
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'bot_apagado' });
        return;
    }
    if (decision === 'silencio') {
        // Número desconocido que ANUNCIA un pago («Mira mile mi pago de este
        // mes», 06-oct: Helen, Andrés Vargas, Mauricio…): no se le responde,
        // pero el archivo se guarda (`storage_path`) para que la escuela lo vea
        // en la Bandeja — antes se perdía con la URL de Meta. Solo por el texto
        // (sin OCR) y nunca a contactos marcados como personales.
        if (atencion.tipo === 'desconocido' && textosHablanDePago(await textosDelContacto(fila, conversationId))) {
            const bajada = await bajarYGuardarArchivo(fila, wa, log);
            if (!bajada.ok) return;
        }
        await cerrar(fila.id, 'ignored', { result_type: 'none', error_message: 'contacto_no_atendido' });
        return;
    }
    armarAcuseDiferido();
    if (decision === 'staff_admin') {
        // §4.1/§4.2 de alta-atleta-por-foto-hoja-matricula.md.
        await procesarComoStaffAdmin(fila, wa, conv, responder, log);
        return;
    }
    if (decision === 'escalar_sin_cuenta') {
        // El mensaje (con el enlace de registro) se arma solo si de verdad es un
        // comprobante: a una consulta no se le ofrece registrarse.
        //
        // «No tienes cuenta» UNA vez cada 24 h por conversación: si el bot (o
        // la cola) ya lo dijo, el comprobante se acusa corto, sin el párrafo
        // (…8804c0, 07-oct: tres veces el mismo aviso en 14 min).
        await escalarALaEscuela(fila, wa, conversationId, responder,
            async () => (await yaSeDijoSinCuenta(conversationId)) ? M.escaladoSinAcudiente : mensajeSinCuenta(fila),
            'familia_sin_cuenta', 'familia_sin_cuenta', log);
        await anotarAtletaDeLaFicha(fila);
        return;
    }
    if (decision === 'escalar_ambiguo') {
        await escalarALaEscuela(fila, wa, conversationId, responder, M.numeroAmbiguo,
            'numero_ambiguo', 'numero_ambiguo', log);
        return;
    }

    // decision === 'comprobante'. ¿De qué acudiente? Primero el TELÉFONO, que es
    // lo que usó `debeAtender` para decir «familia» (y la RPC ya dejó la
    // conversación vinculada); si no, el OTP. Se pregunta de nuevo en vez de
    // fiarse de `conv`, que se leyó ANTES de que la RPC la vinculara.
    //
    // Antes esto solo miraba `conv.identified`, que lo estampa el bot: en
    // Dynasty, del 2 al 3 de octubre de 2026, 18 de 29 comprobantes se cerraron
    // «contacto sin identificar»; contra `wa_identify_by_phone` 7 eran
    // familias identificables que perdieron su comprobante por pedirles correo.
    const { data: identificacion } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: fila.integration_id,
        p_contact_wa_id: fila.wa_phone_number,
    });
    let parentId: string | null =
        ((identificacion as any)?.estado === 'identificado' && (identificacion as any)?.parent_id)
            ? (identificacion as any).parent_id as string
            : null;
    if (!parentId && conv?.identified && conv.parent_id) parentId = conv.parent_id as string;
    parentIdConocido = parentId;

    if (!parentId) {
        // 'familia' sin acudiente resoluble: no debería pasar. NO se pide el
        // correo (ver `M`); lo resuelve la escuela.
        await escalarALaEscuela(fila, wa, conversationId, responder, M.escaladoSinAcudiente,
            'familia_sin_acudiente', 'familia sin parent_id resoluble', log);
        return;
    }

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

    // 4.5. ¿Acompaña un reclamo o una pregunta sobre un cobro, y la lectura no
    //      muestra un pago? (captura del correo de estado de cuenta + «¿por qué
    //      me cobran?», 2026-10-06). Va a una persona como consulta. Un
    //      comprobante real con un reclamo al lado SÍ se aplica: lo que la
    //      escuela revisa es el pago, y un falso positivo del texto no puede
    //      dejar sin aplicar un comprobante bueno.
    if (!pareceComprobanteDePago(ocr) && esConsultaSobreCobro(await textosCercanos(fila))) {
        await derivarConsulta(fila, wa, conversationId, responder, 'familia', log);
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

    // La pregunta del consentimiento ya NO sale como mensaje aparte después
    // del resultado (…b62e3f, 06-oct: resultado y 2 s después la pregunta): va
    // al pie del resultado, con sus botones (`enviar`).
}

// ─── Preguntas que nadie va a contestar ──────────────────────────────────────
//
// Una fila `waiting_user` espera que la familia diga a qué cobro va. Si la
// pregunta nunca le llegó —quedó en un BORRADOR del modo asistido que nadie
// aprobó, o la conversación estaba tomada y el worker no le escribió—, o si la
// familia no contestó, la fila esperaba para siempre con el comprobante sin
// aplicar. Caso real: …9366, 06-oct 09:31, 13 h y contando; la familia SÍ
// contestó («De sep y oct») pero la repregunta quedó en borrador.
//
// A las HORAS_VIDA_PREGUNTA horas pasa al buzón de la escuela (ignored +
// escalated, que es lo que lista «Comprobantes sin resolver») con el motivo.
// No se le escribe a la familia: la ventana de 24 h ya cerró.

export const HORAS_VIDA_PREGUNTA = 24;

export type PorQueVencio = 'pregunta_en_borrador' | 'pregunta_no_enviada' | 'sin_respuesta';

/** Pura: el motivo que ve la escuela. */
export function motivoPreguntaVencida(e: { enviada: boolean; enBorrador: boolean }): { codigo: PorQueVencio; texto: string } {
    if (e.enBorrador) {
        return { codigo: 'pregunta_en_borrador', texto: `pregunta_vencida: la pregunta de a qué cobro va quedó en un borrador sin enviar (${HORAS_VIDA_PREGUNTA} h); aplicarlo a mano` };
    }
    if (!e.enviada) {
        return { codigo: 'pregunta_no_enviada', texto: `pregunta_vencida: la pregunta de a qué cobro va nunca salió (conversación tomada); aplicarlo a mano` };
    }
    return { codigo: 'sin_respuesta', texto: `pregunta_vencida: la familia no dijo a qué cobro va en ${HORAS_VIDA_PREGUNTA} h; aplicarlo a mano` };
}

/** Vence las preguntas viejas. Idempotente y seguro con los 3 BFF: el UPDATE exige `waiting_user`. */
export async function vencerPreguntasSinRespuesta(log?: Logger, ahora = Date.now()): Promise<number> {
    const corte = new Date(ahora - HORAS_VIDA_PREGUNTA * 3600_000).toISOString();
    const { data: filas, error } = await supabase.from('whatsapp_inbound_queue')
        .select('id, integration_id, wa_phone_number, pregunta_at, updated_at')
        .eq('status', 'waiting_user')
        .lt('updated_at', corte)
        .limit(50);
    if (error || !filas?.length) return 0;

    let vencidas = 0;
    for (const f of filas as any[]) {
        const desde = (f.pregunta_at ?? f.updated_at) as string;
        if (new Date(desde).getTime() > ahora - HORAS_VIDA_PREGUNTA * 3600_000) continue;

        let enviada = false;
        let enBorrador = false;
        try {
            const { data: conv } = await supabase.from('whatsapp_conversations')
                .select('id').eq('integration_id', f.integration_id).eq('contact_wa_id', f.wa_phone_number)
                .maybeSingle();
            const convId = (conv as any)?.id;
            if (convId) {
                const [{ data: salientes }, { data: borradores }] = await Promise.all([
                    supabase.from('whatsapp_messages').select('id')
                        .eq('conversation_id', convId).eq('direction', 'outbound')
                        .eq('payload->>queue_id', f.id).limit(1),
                    supabase.from('whatsapp_message_drafts').select('id, tool_context')
                        .eq('conversation_id', convId)
                        .in('status', ['pending', 'expired'])
                        .gte('created_at', desde)
                        .limit(20),
                ]);
                enviada = (salientes?.length ?? 0) > 0;
                enBorrador = ((borradores ?? []) as any[])
                    .some((b) => String(b?.tool_context?.step ?? '').startsWith('ask_cual_pago')
                        || String(b?.tool_context?.step ?? '').startsWith('confirmar_combinacion'));
            }
        } catch { /* sin detalle: vence igual con el motivo genérico */ }

        const motivo = motivoPreguntaVencida({ enviada, enBorrador });
        const { data: cerradas } = await supabase.from('whatsapp_inbound_queue')
            .update({
                status: 'ignored',
                result_type: 'escalated',
                error_message: motivo.texto,
                processed_at: new Date(ahora).toISOString(),
                locked_until: null,
            })
            .eq('id', f.id)
            .eq('status', 'waiting_user')
            .select('id');
        if (cerradas?.length) {
            vencidas++;
            log?.info?.({ queueId: f.id, motivo: motivo.codigo }, '[wa-queue] pregunta vencida: al buzón de la escuela');
        }
    }
    return vencidas;
}

// ─── Entrada del job ─────────────────────────────────────────────────────────

export async function runWhatsAppQueue(log?: Logger): Promise<{ tomadas: number; errores: number }> {
    // Antes del claim y sin poder tumbarlo: una pregunta vieja no frena la cola.
    await vencerPreguntasSinRespuesta(log).catch((err) =>
        log?.warn?.({ err: err?.message ?? err }, '[wa-queue] no se pudieron vencer las preguntas'));

    const { data: filas, error } = await supabase.rpc('wa_queue_claim', {
        p_limit: LOTE, p_lease_minutes: LEASE_MIN, p_max_retries: MAX_REINTENTOS,
    });

    if (error) {
        log?.error?.({ err: error.message }, '[wa-queue] el claim falló');
        return { tomadas: 0, errores: 1 };
    }
    const lote = (filas ?? []) as FilaCola[];
    if (lote.length === 0) return { tomadas: 0, errores: 0 };

    // Ráfaga: varias fotos del MISMO contacto en el lote se procesan una por
    // una (cada comprobante se aplica a su cobro, como siempre), pero la
    // respuesta sale UNA vez al final: «Recibí tus 2 comprobantes: …».
    const grupos = new Map<string, FilaCola[]>();
    for (const fila of lote) {
        const k = `${fila.integration_id}|${fila.wa_phone_number}`;
        grupos.set(k, [...(grupos.get(k) ?? []), fila]);
    }

    let errores = 0;
    for (const filas of grupos.values()) {
        const rafaga: Rafaga | undefined = filas.length > 1 ? { respuestas: [] } : undefined;
        for (const fila of filas) {
            try {
                await procesarFila(fila, log, rafaga);
            } catch (err: any) {
                errores++;
                // Una excepción inesperada no puede dejar la fila colgada en
                // 'processing': se devuelve a la rueda con su motivo.
                await reintentar(fila, `excepción: ${err?.message ?? err}`, log).catch(() => {});
                log?.error?.({ err: err?.message ?? err, queueId: fila.id }, '[wa-queue] fila explotó');
            }
        }
        if (rafaga?.respuestas.length && rafaga.enviar) {
            const { texto, paso } = resumirRafaga(rafaga.respuestas);
            const pasos = rafaga.respuestas.map((r) => r.paso);
            const ids = rafaga.respuestas.map((r) => r.queueId);
            try {
                await rafaga.enviar(texto,
                    { step: paso, queue_id: ids[0], ...(ids.length > 1 ? { queue_ids: ids, pasos } : {}) },
                    pasos.includes('resultado_comprobante'));
            } catch (err: any) {
                errores++;
                log?.error?.({ err: err?.message ?? err, queueIds: ids }, '[wa-queue] no salió la respuesta de la ráfaga');
            }
        }
    }
    return { tomadas: lote.length, errores };
}
