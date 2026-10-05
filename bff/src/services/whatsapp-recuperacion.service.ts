/**
 * whatsapp-recuperacion.service — comprobantes que llegaron por WhatsApp y
 * nadie aplicó, metidos al cobro EN REVISIÓN y sin hablarle a nadie.
 *
 * Origen, medido el 2026-10-05 en Dynasty (Coexistence desde el 2026-10-02):
 * 56 fotos de comprobantes en `whatsapp_inbound_queue` sin archivo guardado —
 * 22 cerradas `bot_apagado`, 21 `contacto sin identificar` (el bug viejo que
 * pedía el correo) y 13 `pending` con el cron frenado. La dueña dice que tiene
 * muchos comprobantes de padres sin subir.
 *
 * Dos entradas usan este módulo y deciden IGUAL:
 *   - scripts/wa-recuperar-comprobantes.ts  → filas de la cola (Tarea A).
 *   - POST /whatsapp/:schoolId/importar-chat → el .zip de «Exportar chat» (Tarea B).
 *
 * Reglas que mandan sobre todo lo demás:
 *
 *  1. **Nunca se aprueba.** El resultado bueno es `awaiting_approval` con el
 *     comprobante y su veredicto — lo mismo que deja el worker cuando NO
 *     auto-aprueba. Por eso se usa `estamparComprobante` y NO
 *     `evaluatePaymentReceipt`: con la auto-aprobación de la escuela prendida
 *     esa función aprueba sola (y le manda correo al acudiente).
 *  2. **Nunca se le escribe a nadie.** Ni WhatsApp ni correo. Estos
 *     comprobantes tienen días; una respuesta del bot ahora sería un mensaje
 *     fuera de contexto a una familia que ya habló con la dueña por su celular.
 *     Se marca `outcome_notified_at` para que el job de desenlace
 *     (whatsapp-payment-outcome.job) tampoco avise cuando la escuela apruebe.
 *  3. **Nunca un doble pago.** Muchos de estos pagos la dueña ya los registró a
 *     mano o con las planillas de papel. Si la familia ya tiene un pago
 *     registrado por ese monto en esas fechas, es `ya_registrado` y no se toca
 *     ningún cobro. Si además hay un pendiente del mismo monto, no se adivina:
 *     va al buzón como `varios_cobros`.
 *  4. **No adivinar el cobro.** Mismo motor que el worker (`resolverPago`):
 *     solo se estampa cuando hay UN cobro posible Y el monto leído coincide
 *     (o no se pudo leer). Lo que el worker resolvería preguntándole al
 *     acudiente acá va al buzón, porque no se le pregunta.
 */

import type { Logger } from 'pino';
import { supabase } from '../config/supabase';
import { extractReceipt, type OcrResult } from './ocr.service';
import { normalizeReference } from './receipt-verdict';
import {
    pagosPendientesDe, resolverPago, describirPago, type PagoPendiente,
} from './whatsapp-receipt-matching.service';
import crypto from 'node:crypto';
import {
    destinoEsDeLaEscuela, estamparComprobante, obtenerArchivoDeFila, type FilaCola,
} from '../jobs/whatsapp-queue.job';
import type { WhatsAppIntegration } from './whatsapp.service';

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** Quién mandó el comprobante, ya resuelto. */
export type Familia =
    | { tipo: 'identificado'; parentId: string }
    | { tipo: 'sin_cuenta' }
    | { tipo: 'ambiguo' }
    | { tipo: 'staff' }
    | { tipo: 'desconocido' };

export type DecisionRecuperacion =
    | 'en_revision'          // estampado en el cobro, awaiting_approval
    | 'ya_registrado'        // ese pago ya está en la base: no se toca nada
    | 'no_es_comprobante'
    | 'es_listado'
    | 'destino_ajeno'
    | 'sin_pendientes'
    | 'varios_cobros'        // el monto no desempata, o puede ser uno ya registrado
    | 'monto_distinto'       // un solo cobro pendiente, pero el comprobante es por otro valor
    | 'familia_sin_cuenta'
    | 'numero_ambiguo'
    | 'sin_familia'
    | 'enviado_por_equipo'
    | 'archivo_no_disponible'
    | 'reintentar';          // OCR caído u otro transitorio: la fila vuelve como estaba

/** Pago que ya cuenta como plata recibida (o en revisión) de la familia. */
export interface PagoRegistrado {
    id: string;
    amount: number;
    amount_paid: number | null;
    status: string;
    payment_date: string | null;
    updated_at: string | null;
    concept: string | null;
}

export interface ResultadoRecuperacion {
    decision: DecisionRecuperacion;
    motivo: string;
    ocr: OcrResult | null;
    /** El cobro donde quedó (en_revision) o el que se propone (simulación). */
    pago?: PagoPendiente;
    /** El pago que ya cubre este comprobante (ya_registrado). */
    pagoRegistradoId?: string | null;
    parentId?: string | null;
    veredicto?: string | null;
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/** Días antes de la fecha del comprobante en que un pago registrado aún «lo cubre». */
const VENTANA_ANTES_DIAS = 3;
/**
 * Días DESPUÉS. `payment_date` es el día en que la escuela aprueba o registra
 * (no el de la transferencia), y la dueña registra a mano con días de atraso;
 * las planillas de papel de septiembre se cargaron el 3 de octubre con la fecha
 * real. 20 días cubre las dos cosas sin alcanzar al mes siguiente completo.
 */
const VENTANA_DESPUES_DIAS = 20;

const DIA_MS = 86_400_000;
const aDia = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/**
 * La fecha que manda para comparar: la del comprobante si es creíble, si no la
 * del mensaje. El OCR a veces lee mal el año; una fecha a más de 60 días del
 * mensaje (o en el futuro) no es la de este pago.
 */
export function fechaDeReferencia(ocrDate: string | null, fechaMensaje: string): string {
    if (ocrDate && /^\d{4}-\d{2}-\d{2}$/.test(ocrDate)) {
        const d = aDia(ocrDate);
        const m = aDia(fechaMensaje);
        if (!Number.isNaN(d) && d <= m + DIA_MS && d >= m - 60 * DIA_MS) return ocrDate;
    }
    return fechaMensaje.slice(0, 10);
}

/**
 * Pagos de la familia que ya cubren un comprobante de `monto` hecho el día
 * `fecha`: mismo monto (cobrado o abonado) y fecha de registro dentro de la
 * ventana. Pura, para probarla sin base.
 */
export function pagosQueYaCubren(pagos: PagoRegistrado[], monto: number | null, fecha: string): PagoRegistrado[] {
    if (monto === null || !(monto > 0)) return [];
    const ref = aDia(fecha);
    return pagos.filter((p) => {
        const mismoMonto = Number(p.amount) === monto || (p.amount_paid !== null && Number(p.amount_paid) === monto);
        if (!mismoMonto) return false;
        // En revisión no tiene payment_date todavía: vale la última edición.
        const cuando = p.payment_date ?? p.updated_at;
        if (!cuando) return false;
        const d = aDia(cuando);
        return d >= ref - VENTANA_ANTES_DIAS * DIA_MS && d <= ref + VENTANA_DESPUES_DIAS * DIA_MS;
    });
}

// ─── La regla ────────────────────────────────────────────────────────────────

/**
 * Qué hacer con un comprobante ya leído. Función pura: es LA regla, se prueba
 * sin mocks.
 */
export function decidirRecuperacion(e: {
    familia: Familia;
    ocr: OcrResult;
    destinoDeLaEscuela: boolean;
    /** Pago que ya tiene esta referencia de banco o esta misma imagen. */
    yaUsadoEn: { paymentId: string | null; por: 'referencia' | 'imagen' } | null;
    pagadosQueCubren: PagoRegistrado[];
    pendientes: PagoPendiente[];
}): { decision: DecisionRecuperacion; motivo: string; pago?: PagoPendiente; pagoRegistradoId?: string | null } {
    const { ocr } = e;
    if (ocr.isReceipt === false) return { decision: 'no_es_comprobante', motivo: 'el archivo no es un comprobante de pago' };
    if (ocr.isTransactionList === true) return { decision: 'es_listado', motivo: 'listado de movimientos, no un comprobante' };
    if (!e.destinoDeLaEscuela) {
        return { decision: 'destino_ajeno', motivo: `el dinero fue a ${ocr.destination ?? '?'}, que no es una cuenta de la escuela` };
    }
    if (e.yaUsadoEn) {
        return {
            decision: 'ya_registrado',
            motivo: e.yaUsadoEn.por === 'referencia'
                ? `la referencia ${ocr.reference} ya está en otro pago`
                : 'esta misma imagen ya está en otro pago',
            pagoRegistradoId: e.yaUsadoEn.paymentId,
        };
    }

    const f = e.familia;
    if (f.tipo === 'sin_cuenta') return { decision: 'familia_sin_cuenta', motivo: 'familia de la escuela sin cuenta: aplicarlo a mano' };
    if (f.tipo === 'ambiguo') return { decision: 'numero_ambiguo', motivo: 'el número está en más de una cuenta' };
    if (f.tipo === 'staff') return { decision: 'enviado_por_equipo', motivo: 'lo mandó alguien que administra la escuela (puede ser de otra familia): aplicarlo a mano' };
    if (f.tipo === 'desconocido') return { decision: 'sin_familia', motivo: 'el número no está en ninguna ficha de la escuela' };

    const monto = ocr.amount ?? null;
    const hayPendienteDelMonto = monto !== null && e.pendientes.some((p) => p.amount === monto);
    if (e.pagadosQueCubren.length > 0) {
        const reg = e.pagadosQueCubren[0];
        if (hayPendienteDelMonto) {
            // Puede ser el pago que la dueña ya registró… o el siguiente mes.
            // Elegir mal es cobrar dos veces o dejar un mes sin pagar: decide ella.
            return {
                decision: 'varios_cobros',
                motivo: `puede ser el pago ya registrado (${reg.concept ?? reg.id}) o un cobro pendiente del mismo monto`,
                pagoRegistradoId: reg.id,
            };
        }
        return {
            decision: 'ya_registrado',
            motivo: `ya hay un pago ${reg.status} de ${monto} (${reg.concept ?? reg.id}, ${reg.payment_date ?? reg.updated_at?.slice(0, 10) ?? 's/f'})`,
            pagoRegistradoId: reg.id,
        };
    }

    const match = resolverPago(e.pendientes, monto);
    if (match.tipo === 'sin_pendientes') return { decision: 'sin_pendientes', motivo: 'la familia no tiene cobros pendientes' };
    if (match.tipo === 'unico' && monto !== null && match.pago.amount !== monto) {
        // El worker lo aplicaría igual (y le contaría al acudiente a qué cobro
        // fue, para que corrija). Acá no hay conversación: un abono de $75.000
        // estampado en una mensualidad de $210.000 se aprueba con un clic como
        // pagada completa. Medido en la simulación de Dynasty del 2026-10-05:
        // 4 de 9 «único pendiente» tenían otro monto ($25.000 y $170.000 contra
        // un mismo cobro de $180.000). Lo decide una persona.
        return {
            decision: 'monto_distinto',
            motivo: `leído ${monto}; el único cobro pendiente es ${describirPago(match.pago)}`,
        };
    }
    if (match.tipo === 'unico' || match.tipo === 'por_monto') {
        return { decision: 'en_revision', motivo: `a ${describirPago(match.pago)}`, pago: match.pago };
    }
    const opciones = match.tipo === 'combinacion' ? match.pagos : match.opciones;
    return {
        decision: 'varios_cobros',
        motivo: match.tipo === 'combinacion'
            ? `parece cubrir ${opciones.length} cobros a la vez: aplicarlo a mano`
            : `${e.pendientes.length} cobros pendientes y el monto no desempata`,
    };
}

// ─── Cómo queda la fila de la cola ───────────────────────────────────────────

/** Prefijo de `error_message` de todo lo que tocó la recuperación: así no se reprocesa. */
export const PREFIJO_RECUPERADO = 'recuperado:';

/**
 * El cierre de la fila según la decisión. `null` = no se cierra (transitorio):
 * la fila vuelve a su estado previo y la próxima corrida lo intenta de nuevo.
 *
 * Estados y result_type dentro de los CHECK de la tabla (verificados en la base
 * el 2026-10-05): status pending|processing|waiting_user|done|failed|ignored;
 * result_type payment_receipt|glosa|escalated|none. Lo que necesita a una
 * persona va `ignored` + `escalated`, que es lo que lista el buzón.
 */
export function cierreDeFila(r: ResultadoRecuperacion, ahoraIso: string): Record<string, unknown> | null {
    if (r.decision === 'reintentar') return null;
    const base = {
        processed_at: ahoraIso,
        locked_until: null,
        error_message: `${PREFIJO_RECUPERADO} ${r.decision} — ${r.motivo}`.slice(0, 500),
        // Rule 2: el job de desenlace no avisa por WhatsApp de estos pagos.
        outcome_notified_at: ahoraIso,
        matched_parent_id: r.parentId ?? null,
    };
    switch (r.decision) {
        case 'en_revision':
            return {
                ...base, status: 'done', result_type: 'payment_receipt',
                result_ref_id: r.pago?.id ?? null, matched_child_id: r.pago?.child_id ?? null,
            };
        case 'ya_registrado':
            return { ...base, status: 'ignored', result_type: 'none', result_ref_id: r.pagoRegistradoId ?? null };
        case 'no_es_comprobante':
        case 'es_listado':
            return { ...base, status: 'ignored', result_type: 'none' };
        case 'archivo_no_disponible':
            return { ...base, status: 'failed', result_type: 'none' };
        default:
            // destino_ajeno, sin_pendientes, varios_cobros, monto_distinto, familia_sin_cuenta,
            // numero_ambiguo, sin_familia: los ve una persona en el buzón.
            return { ...base, status: 'ignored', result_type: 'escalated', result_ref_id: r.pagoRegistradoId ?? null };
    }
}

// ─── I/O ─────────────────────────────────────────────────────────────────────

/**
 * ¿Esta referencia de banco o esta imagen ya están en algún pago de la escuela?
 *
 * Es la misma defensa que el veredicto (checks 7 y 8 de
 * `buildVerdictContext`) más el UNIQUE `uq_payments_school_ocr_reference`,
 * pero devolviendo EL pago — la escuela necesita saber a cuál quedó. Se
 * busca también por `ocr_reference` crudo porque el estampado del worker no
 * llena `receipt_reference_norm`.
 *
 * Una referencia de menos de 6 caracteres no se usa: «1» o «OK» chocan con
 * cualquier cosa.
 */
export async function buscarComprobanteYaUsado(
    schoolId: string,
    ocr: OcrResult,
    sha: string,
): Promise<{ paymentId: string | null; por: 'referencia' | 'imagen' } | null> {
    const norm = normalizeReference(ocr.reference);
    if (norm && norm.length >= 6) {
        const { data: porCrudo } = await supabase.from('payments').select('id')
            .eq('school_id', schoolId).eq('ocr_reference', ocr.reference as string).limit(1);
        if (porCrudo?.length) return { paymentId: porCrudo[0].id as string, por: 'referencia' };
        const { data: porNorm } = await supabase.from('payments').select('id')
            .eq('school_id', schoolId).eq('receipt_reference_norm', norm).limit(1);
        if (porNorm?.length) return { paymentId: porNorm[0].id as string, por: 'referencia' };
    }
    // Igual que el índice único parcial: un rechazo libera la imagen.
    const { data: porImagen } = await supabase.from('payments').select('id')
        .eq('school_id', schoolId).eq('receipt_image_sha256', sha)
        .not('status', 'in', '(rejected,cancelled,failed)').limit(1);
    if (porImagen?.length) return { paymentId: porImagen[0].id as string, por: 'imagen' };
    return null;
}

/**
 * Pagos de la familia que ya cuentan: cobrados, abonados o en revisión.
 *
 * Por `parent_id` Y por los hijos del acudiente: las planillas de papel y el
 * registro a mano dejan pagos con `child_id` y sin `parent_id` (14 de 120 en
 * Dynasty desde el 25-sep). Buscar solo por `parent_id` los perdería y
 * produciría justo el doble pago que esto evita.
 */
export async function pagosRegistradosDeLaFamilia(parentId: string, schoolId: string): Promise<PagoRegistrado[]> {
    const { data: hijos } = await supabase.from('children').select('id')
        .eq('parent_id', parentId).eq('school_id', schoolId);
    const ids = (hijos ?? []).map((h: any) => h.id as string);
    const filtro = ids.length
        ? `parent_id.eq.${parentId},child_id.in.(${ids.join(',')})`
        : `parent_id.eq.${parentId}`;
    const desde = new Date(Date.now() - 150 * DIA_MS).toISOString();
    const { data } = await supabase.from('payments')
        .select('id, amount, amount_paid, status, payment_date, updated_at, concept')
        .eq('school_id', schoolId)
        .in('status', ['paid', 'partial', 'awaiting_approval'])
        .or(filtro)
        .gte('updated_at', desde)
        .limit(200);
    return (data ?? []).map((p: any) => ({
        id: p.id, amount: Number(p.amount), amount_paid: p.amount_paid === null ? null : Number(p.amount_paid),
        status: p.status, payment_date: p.payment_date ?? null, updated_at: p.updated_at ?? null,
        concept: p.concept ?? null,
    }));
}

export interface EntradaComprobante {
    schoolId: string;
    familia: Familia;
    base64: string;
    mime: string;
    sha: string;
    /** Ruta en el bucket. null solo en simulación (no se sube nada). */
    storagePath: string | null;
    /** Cuándo llegó el mensaje (ISO). Respaldo de la fecha del comprobante. */
    fechaMensaje: string;
    /** false = simulación: decide igual, pero no escribe nada. */
    aplicar: boolean;
    queueId: string;
    log?: Logger;
    /** Inyectable para pruebas. */
    ocrFn?: (base64: string, mime: string) => Promise<OcrResult>;
}

/**
 * Lee, decide y —si `aplicar`— estampa. No toca la fila de la cola: eso lo
 * hace quien llama, con `cierreDeFila`.
 */
export async function procesarComprobanteRecuperado(e: EntradaComprobante): Promise<ResultadoRecuperacion> {
    const parentId = e.familia.tipo === 'identificado' ? e.familia.parentId : null;

    let ocr: OcrResult;
    try {
        ocr = await (e.ocrFn ?? extractReceipt)(e.base64, e.mime);
    } catch (err: any) {
        // Un OCR caído nunca decide: «no pude leer» no es «no es válido».
        return { decision: 'reintentar', motivo: `OCR no disponible: ${err?.message ?? err}`, ocr: null, parentId };
    }

    const [destinoDeLaEscuela, yaUsadoEn] = await Promise.all([
        destinoEsDeLaEscuela(e.schoolId, ocr),
        buscarComprobanteYaUsado(e.schoolId, ocr, e.sha),
    ]);

    let pendientes: PagoPendiente[] = [];
    let pagadosQueCubren: PagoRegistrado[] = [];
    if (parentId) {
        const [pend, registrados] = await Promise.all([
            pagosPendientesDe(parentId, e.schoolId),
            pagosRegistradosDeLaFamilia(parentId, e.schoolId),
        ]);
        pendientes = pend;
        pagadosQueCubren = pagosQueYaCubren(registrados, ocr.amount ?? null, fechaDeReferencia(ocr.date, e.fechaMensaje));
    }

    const d = decidirRecuperacion({ familia: e.familia, ocr, destinoDeLaEscuela, yaUsadoEn, pagadosQueCubren, pendientes });
    const resultado: ResultadoRecuperacion = { ...d, ocr, parentId };

    if (d.decision !== 'en_revision' || !e.aplicar) return resultado;

    if (!e.storagePath) {
        // No debería pasar: aplicar siempre guarda el archivo antes.
        return { ...resultado, decision: 'reintentar', motivo: 'sin archivo guardado para adjuntar' };
    }
    const estampado = await estamparComprobante(
        { queueId: e.queueId, schoolId: e.schoolId, storagePath: e.storagePath, sha: e.sha, ocr, log: e.log },
        d.pago as PagoPendiente,
    );
    if (!estampado.ok) {
        if (estampado.duplicado) {
            return {
                ...resultado, decision: 'ya_registrado', pago: undefined,
                motivo: `la referencia ${ocr.reference} ya está en otro pago`,
                pagoRegistradoId: estampado.yaAplicado?.id ?? null,
            };
        }
        return { ...resultado, decision: 'reintentar', motivo: estampado.error };
    }
    if (!estampado.actualizado) {
        // Lo registró la escuela entre la búsqueda y el estampado.
        return { ...resultado, decision: 'sin_pendientes', pago: undefined, motivo: 'el cobro dejó de estar pendiente mientras se procesaba' };
    }
    return { ...resultado, veredicto: estampado.veredicto.verdict };
}

// ─── Identificación por teléfono ─────────────────────────────────────────────

const tel10 = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '').slice(-10);

/**
 * Quién es el dueño de este número para la escuela.
 *
 * Con `soloLectura=false` usa `wa_identify_by_phone`, la misma RPC del bot y
 * del worker — que además vincula la conversación al acudiente (efecto que el
 * bot ya tiene en cada turno).
 *
 * En SIMULACIÓN no se puede llamar: escribe (`whatsapp_conversations` y
 * `whatsapp_identifications`). Ahí se usa `identificarSoloLectura`, que espeja
 * la RPC con lecturas. Si la RPC cambia, este espejo tiene que cambiar con
 * ella — es el precio de una simulación que de verdad no escribe.
 */
export async function identificarFamilia(
    integrationId: string,
    schoolId: string,
    contactWaId: string,
    opciones: { soloLectura: boolean; cache?: CacheEscuela },
): Promise<Familia> {
    // Quien administra la escuela va PRIMERO, aunque también sea acudiente: es
    // la misma regla del worker (`decidirAdjunto`). En Dynasty la dueña tiene
    // una hija entrenando y reenvía al chat fotos de comprobantes de OTRAS
    // familias; tratarla como «familia» aplicaría esa plata a SUS cobros.
    // Solo lectura en la base (sin efectos), así que vale en los dos modos.
    const { data: staff } = await supabase.rpc('wa_identify_staff_admin_by_phone', {
        p_school_id: schoolId, p_wa_phone_number: contactWaId,
    });
    if ((staff as any)?.estado === 'identificado') return { tipo: 'staff' };

    let familia: Familia;
    if (opciones.soloLectura) {
        familia = await identificarSoloLectura(schoolId, contactWaId, opciones.cache);
    } else {
        const { data, error } = await supabase.rpc('wa_identify_by_phone', {
            p_integration_id: integrationId, p_contact_wa_id: contactWaId,
        });
        const r = error ? null : (data as any);
        if (r?.estado === 'identificado' && r.parent_id) familia = { tipo: 'identificado', parentId: r.parent_id };
        else if (r?.estado === 'debe_registrarse') familia = { tipo: 'sin_cuenta' };
        else if (r?.estado === 'ambiguo') familia = { tipo: 'ambiguo' };
        else familia = { tipo: 'desconocido' };
    }
    if (familia.tipo !== 'desconocido') return familia;

    // Verificado por OTP desde este número (camino viejo del bot).
    const { data: conv } = await supabase.from('whatsapp_conversations')
        .select('identified, parent_id')
        .eq('integration_id', integrationId).eq('contact_wa_id', contactWaId).maybeSingle();
    if ((conv as any)?.identified && (conv as any)?.parent_id) {
        return { tipo: 'identificado', parentId: (conv as any).parent_id };
    }
    return { tipo: 'desconocido' };
}

/** Teléfonos de la escuela, leídos una vez por corrida. */
export interface CacheEscuela {
    acudientesPorTel?: Map<string, Set<string>>;
    fichasSinCuenta?: Set<string>;
    /** La carga en curso: con varias filas en paralelo se lee una sola vez. */
    cargando?: Promise<void>;
}

function cargarCache(schoolId: string, cache: CacheEscuela): Promise<void> {
    if (!cache.cargando) cache.cargando = leerTelefonosDeLaEscuela(schoolId, cache);
    return cache.cargando;
}

async function leerTelefonosDeLaEscuela(schoolId: string, cache: CacheEscuela): Promise<void> {
    const { data: hijos } = await supabase.from('children')
        .select('parent_id, parent_phone_temp')
        .eq('school_id', schoolId).eq('is_active', true).limit(5000);
    const parentIds = Array.from(new Set((hijos ?? []).map((h: any) => h.parent_id).filter(Boolean))) as string[];
    const porTel = new Map<string, Set<string>>();
    for (let i = 0; i < parentIds.length; i += 150) {
        const { data: perfiles } = await supabase.from('profiles').select('id, phone')
            .in('id', parentIds.slice(i, i + 150));
        for (const p of perfiles ?? []) {
            const t = tel10((p as any).phone);
            if (!t) continue;
            if (!porTel.has(t)) porTel.set(t, new Set());
            porTel.get(t)!.add((p as any).id);
        }
    }
    cache.acudientesPorTel = porTel;
    cache.fichasSinCuenta = new Set((hijos ?? []).map((h: any) => tel10(h.parent_phone_temp)).filter(Boolean));
}

/** Espejo de `wa_identify_by_phone` sin escrituras (ver `identificarFamilia`). */
async function identificarSoloLectura(schoolId: string, contactWaId: string, cache: CacheEscuela = {}): Promise<Familia> {
    const t = tel10(contactWaId);
    if (!/^3\d{9}$/.test(t)) return { tipo: 'desconocido' };
    await cargarCache(schoolId, cache);
    const ids = cache.acudientesPorTel!.get(t);
    if (ids && ids.size > 1) return { tipo: 'ambiguo' };
    if (ids && ids.size === 1) return { tipo: 'identificado', parentId: Array.from(ids)[0] };
    if (cache.fichasSinCuenta!.has(t)) return { tipo: 'sin_cuenta' };
    // STABLE en la base: solo lee `unregistered_athletes`.
    const { data } = await supabase.rpc('wa_es_familia_sin_registrar', { p_school_id: schoolId, p_contact_wa_id: contactWaId });
    return data === true ? { tipo: 'sin_cuenta' } : { tipo: 'desconocido' };
}

// ─── Una fila de la cola (Tarea A) ───────────────────────────────────────────

/** Filas que la recuperación toma: lo que nunca llegó a leerse. */
export const MOTIVOS_RECUPERABLES = ['bot_apagado', 'contacto sin identificar'] as const;

export interface FilaParaRecuperar extends FilaCola {
    status: string;
    error_message: string | null;
    created_at: string;
    wa_timestamp: string | null;
}

/** Minutos que la fila queda tomada mientras se procesa. */
const LEASE_RECUPERACION_MIN = 15;

/**
 * Recupera UNA fila: la toma, identifica a la familia, baja el archivo, decide
 * y —si `aplicar`— estampa y cierra la fila. En simulación no escribe NADA:
 * ni la toma, ni el bucket, ni la fila, ni el cobro.
 *
 * La toma es un UPDATE condicionado al estado que se leyó: si el cron (o otra
 * corrida) la agarró en el medio, no se procesa dos veces.
 */
export async function recuperarFilaDeCola(
    fila: FilaParaRecuperar,
    wa: WhatsAppIntegration,
    opciones: { aplicar: boolean; log?: Logger; cache?: CacheEscuela; ocrFn?: EntradaComprobante['ocrFn'] },
): Promise<ResultadoRecuperacion> {
    const { aplicar } = opciones;

    if (aplicar) {
        let toma = supabase.from('whatsapp_inbound_queue')
            .update({
                status: 'processing',
                locked_until: new Date(Date.now() + LEASE_RECUPERACION_MIN * 60_000).toISOString(),
            })
            .eq('id', fila.id)
            .eq('status', fila.status);
        toma = fila.error_message === null ? toma.is('error_message', null) : toma.eq('error_message', fila.error_message);
        const { data: tomadas } = await toma.select('id');
        if (!tomadas || tomadas.length === 0) {
            return { decision: 'reintentar', motivo: 'la fila cambió mientras tanto (la tomó otro proceso)', ocr: null };
        }
    }

    const devolver = async () => {
        if (aplicar) {
            await supabase.from('whatsapp_inbound_queue')
                .update({ status: fila.status, locked_until: null })
                .eq('id', fila.id);
        }
    };
    const cerrarCon = async (r: ResultadoRecuperacion) => {
        if (!aplicar) return;
        const cierre = cierreDeFila(r, new Date().toISOString());
        if (!cierre) { await devolver(); return; }
        const { error } = await supabase.from('whatsapp_inbound_queue').update(cierre).eq('id', fila.id);
        if (error) opciones.log?.error?.({ id: fila.id, err: error.message }, '[wa-recuperar] no se pudo cerrar la fila');
    };

    try {
        const familia = await identificarFamilia(fila.integration_id, fila.school_id, fila.wa_phone_number,
            { soloLectura: !aplicar, cache: opciones.cache });

        const archivo = await obtenerArchivoDeFila(fila, wa, { guardar: aplicar });
        if (!archivo.ok) {
            const r: ResultadoRecuperacion = archivo.transitorio
                ? { decision: 'reintentar', motivo: archivo.error, ocr: null }
                // Lo típico: Meta ya no lo tiene (pasaron los ~30 días) o el
                // tipo no es imagen/PDF. No mejora reintentando.
                : { decision: 'archivo_no_disponible', motivo: `no se pudo bajar de WhatsApp: ${archivo.error}`, ocr: null };
            r.parentId = familia.tipo === 'identificado' ? familia.parentId : null;
            await cerrarCon(r);
            return r;
        }

        const sha = crypto.createHash('sha256').update(Buffer.from(archivo.base64, 'base64')).digest('hex');
        const r = await procesarComprobanteRecuperado({
            schoolId: fila.school_id, familia, base64: archivo.base64, mime: archivo.mime, sha,
            storagePath: archivo.storagePath,
            fechaMensaje: fila.wa_timestamp ?? fila.created_at,
            aplicar, queueId: fila.id, log: opciones.log, ocrFn: opciones.ocrFn,
        });
        await cerrarCon(r);
        return r;
    } catch (err: any) {
        await devolver();
        return { decision: 'reintentar', motivo: `excepción: ${err?.message ?? err}`, ocr: null };
    }
}
