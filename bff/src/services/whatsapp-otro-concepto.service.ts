/**
 * whatsapp-otro-concepto — el comprobante dice que NO es la mensualidad.
 *
 * Caso real (Dynasty, 2026-10-06, `bd8bd4d3` y `0a55af2d`): una foto con el pie
 * «Clase perfeccionamiento …» y otra anunciada con «mira aquí lo de los
 * uniformes», pagadas al Nequi de la profe, se aplicaron a «Mensualidad
 * $180.000». La escuela las rechazó (3 rechazos por familia) y la familia
 * recibió «no se pudo validar tu pago» por plata que sí había mandado.
 *
 * La regla: si el pie, la descripción del comprobante o lo que la familia
 * escribió alrededor de la foto nombra OTRO concepto (perfeccionamiento,
 * uniforme, torneo, viaje, rifa, inscripción, vacacional…), no se aplica a la
 * mensualidad. Si la familia tiene un cobro pendiente de ESE concepto y el
 * monto cuadra, va a ese; si no, lo registra la escuela («otro_concepto»).
 *
 * Todo lo de acá es puro (se prueba sin base) salvo `textosAlrededor`.
 */

import { supabase } from '../config/supabase';
import { normalizarFrase } from './whatsapp-reglas-turno';
import type { PagoPendiente } from './whatsapp-receipt-matching.service';

export type OtroConcepto =
    | 'clase_extra'
    | 'uniforme'
    | 'torneo'
    | 'viaje'
    | 'rifa'
    | 'inscripcion'
    | 'vacacional';

/** Cómo se nombra cada concepto en el mensaje a la familia y en el motivo. */
export const NOMBRE_OTRO_CONCEPTO: Record<OtroConcepto, string> = {
    clase_extra: 'clase de perfeccionamiento',
    uniforme: 'uniforme',
    torneo: 'torneo',
    viaje: 'viaje',
    rifa: 'rifa',
    inscripcion: 'inscripción',
    vacacional: 'vacacionales',
};

/**
 * Sobre texto ya normalizado (`normalizarFrase`: sin tildes, minúsculas, solo
 * letras y números). El orden importa: el primero que coincide gana.
 */
const PATRONES: [OtroConcepto, RegExp][] = [
    ['vacacional', /\b(vacacional(es)?|curso de vacaciones|plan vacaciones)\b/],
    ['clase_extra', /\b(perfeccionamiento|refuerzo|clases? (extra|adicional(es)?|suelta|sueltas|particular(es)?|personalizada(s)?|privada(s)?)|clases? de (hoy|manana|ayer))\b/],
    ['uniforme', /\b(uniformes?|camiseta(s)?|sudadera(s)?|pantaloneta(s)?|licra(s)?|chaqueta(s)?|dotacion|kit)\b/],
    ['torneo', /\b(torneos?|campeonatos?|copa|festival|inscripcion (al|del|de la) (torneo|copa|campeonato))\b/],
    ['viaje', /\b(viajes?|tiquetes?|pasajes?|transporte|hotel|hospedaje|excursion)\b/],
    ['rifa', /\b(rifas?|boletas?|bono(s)? (de la )?rifa)\b/],
    ['inscripcion', /\b(inscripcion|matricula)\b/],
];

/** Palabras que dicen «esto ES la mensualidad». */
const MENSUALIDAD = /\b(mensualidad(es)?|mensual|cuota del mes|pension|plan pro|plan basico)\b/;

/** El concepto (distinto de la mensualidad) que nombra un texto, o null. */
export function conceptoNombrado(texto: string | null | undefined): OtroConcepto | null {
    const t = normalizarFrase(texto);
    if (!t) return null;
    for (const [c, re] of PATRONES) if (re.test(t)) return c;
    return null;
}

/** ¿El texto nombra la mensualidad? */
export function nombraMensualidad(texto: string | null | undefined): boolean {
    return MENSUALIDAD.test(normalizarFrase(texto));
}

/** De qué concepto es un cobro, por su texto. null = mensualidad u otro sin clasificar. */
export function conceptoDelCobro(concept: string | null | undefined): OtroConcepto | null {
    if (nombraMensualidad(concept)) return null;
    return conceptoNombrado(concept);
}

export interface SenalOtroConcepto {
    concepto: OtroConcepto;
    /** De dónde salió: el pie y la descripción del comprobante son fuertes; el chat, débil. */
    fuente: 'pie' | 'descripcion' | 'chat';
    /** El texto que lo nombró, recortado (va al motivo que ve la escuela). */
    evidencia: string;
}

/**
 * ¿El comprobante es de otro concepto? Pura.
 *
 *  1. El pie de la foto y la descripción que escribió quien pagó (OCR) mandan:
 *     si nombran la mensualidad, es la mensualidad; si nombran otro concepto
 *     (y no la mensualidad), es ese.
 *  2. Si ninguno dice nada, cuenta lo que la familia escribió alrededor —sin
 *     las preguntas: «¿cuánto valen los uniformes?» junto al comprobante de la
 *     mensualidad no lo convierte en uniforme— y solo si ningún texto nombra
 *     la mensualidad.
 */
export function detectarOtroConcepto(e: {
    pie?: string | null;
    descripcion?: string | null;
    chat?: (string | null | undefined)[];
}): SenalOtroConcepto | null {
    const recorte = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 80);

    for (const [fuente, texto] of [['pie', e.pie], ['descripcion', e.descripcion]] as const) {
        if (!texto || !texto.trim()) continue;
        if (nombraMensualidad(texto)) return null;
        const c = conceptoNombrado(texto);
        if (c) return { concepto: c, fuente, evidencia: recorte(texto) };
    }

    const chat = (e.chat ?? []).filter((t): t is string => !!t && !!t.trim() && !t.includes('?'));
    if (chat.some(nombraMensualidad)) return null;
    for (const t of chat) {
        const c = conceptoNombrado(t);
        if (c) return { concepto: c, fuente: 'chat', evidencia: recorte(t) };
    }
    return null;
}

export type DecisionOtroConcepto =
    /** No hay señal de otro concepto (o es débil y el monto cuadra con un cobro): flujo normal. */
    | { tipo: 'seguir' }
    /** Hay un cobro pendiente de ESE concepto por ese monto: se aplica a ese. */
    | { tipo: 'aplicar'; pago: PagoPendiente; senal: SenalOtroConcepto }
    /** No hay a qué aplicarlo: lo registra la escuela. */
    | { tipo: 'a_la_escuela'; senal: SenalOtroConcepto };

/**
 * Qué hacer con un comprobante según el concepto que nombra. Pura.
 *
 * Una señal SOLO del chat (no del pie ni del comprobante) cede ante un monto
 * que coincide exacto con un cobro pendiente: en una ráfaga de dos fotos
 * («la mensualidad» y «lo de los uniformes») el texto puede ser de la otra
 * foto, y el monto exacto es mejor prueba que la cercanía de un mensaje.
 */
export function decidirOtroConcepto(
    senal: SenalOtroConcepto | null,
    pendientes: PagoPendiente[],
    monto: number | null,
): DecisionOtroConcepto {
    if (!senal) return { tipo: 'seguir' };
    const delConcepto = pendientes.filter((p) => conceptoDelCobro(p.concept) === senal.concepto);
    if (monto !== null) {
        const exactos = delConcepto.filter((p) => p.amount === monto);
        if (exactos.length === 1) return { tipo: 'aplicar', pago: exactos[0], senal };
    }
    if (senal.fuente === 'chat' && monto !== null) {
        const cualquiera = pendientes.filter((p) => p.amount === monto);
        if (cualquiera.length > 0 && delConcepto.length === 0) return { tipo: 'seguir' };
    }
    return { tipo: 'a_la_escuela', senal };
}

/** Motivo que queda en `error_message` (la pantalla «Comprobantes sin resolver» lo muestra). */
export function motivoOtroConcepto(s: SenalOtroConcepto): string {
    return `otro_concepto: ${NOMBRE_OTRO_CONCEPTO[s.concepto]} (${s.fuente}: «${s.evidencia}»)`.slice(0, 500);
}

/** Lo que se le dice a la familia: honesto, sin prometer aplicarlo a nada. */
export function mensajeOtroConcepto(s: SenalOtroConcepto): string {
    return `Recibí tu comprobante de *${NOMBRE_OTRO_CONCEPTO[s.concepto]}* 📄 ` +
        'Se lo paso a la escuela para que lo registre; no lo apliqué a la mensualidad.';
}

/**
 * Lo que la familia escribió alrededor de la foto (entrantes de −15 a +5 min,
 * la misma ventana que la pista del cobro del worker). Sin el pie: ese va
 * aparte porque pesa más. Si falla, lista vacía.
 */
export async function textosAlrededor(fila: {
    integration_id: string; wa_phone_number: string; created_at?: string | null;
}): Promise<string[]> {
    try {
        const { data: conv } = await supabase.from('whatsapp_conversations')
            .select('id').eq('integration_id', fila.integration_id).eq('contact_wa_id', fila.wa_phone_number)
            .maybeSingle();
        const convId = (conv as any)?.id;
        if (!convId) return [];
        const base = fila.created_at ? new Date(fila.created_at).getTime() : Date.now();
        const { data } = await supabase.from('whatsapp_messages')
            .select('text_body, created_at')
            .eq('conversation_id', convId)
            .eq('direction', 'inbound')
            .gte('created_at', new Date(base - 15 * 60_000).toISOString())
            .lte('created_at', new Date(base + 5 * 60_000).toISOString())
            .limit(30);
        return ((Array.isArray(data) ? data : []) as any[])
            .map((m) => m?.text_body).filter((t): t is string => typeof t === 'string' && !!t.trim());
    } catch {
        return [];
    }
}
