/**
 * whatsapp-plantilla-manual — «Enviar plantilla» desde el hilo del buzón.
 *
 * Con la ventana de 24 h cerrada el buzón decía «hay que enviarle una plantilla
 * aprobada» y no había cómo hacerlo (inventario 2026-10-12, §10.2). Esto deja a
 * una persona de la escuela mandar UNA plantilla aprobada de su WABA a UNA
 * conversación, con las variables escritas a mano.
 *
 * Las reglas son las mismas que usa el envío automático (whatsapp-plantillas
 * .service), no unas nuevas:
 *   - Solo plantillas APPROVED de la WABA ACTUAL (whatsapp_template_status, el
 *     espejo que mantiene el sync) y categoría UTILITY: el consentimiento que
 *     se pide a las familias cubre avisos, no publicidad.
 *   - `wa_can_send_template` es la pregunta obligatoria antes de todo envío
 *     (spec opt-in §4.2): consentimiento vigente y número no bloqueado. Una
 *     baja (STOP) se respeta también aquí.
 *   - Las de cobro solo en el horario legal de cobranza (Ley 2300).
 *   - Las que llevan botón con enlace dinámico (sportmaps.co/p/{token}) no se
 *     ofrecen: el token sale de un cobro concreto, y eso se manda desde Cobros.
 *   - Nunca a un contacto marcado personal.
 *   - Freno de abuso por persona, por conversación y por escuela (en memoria).
 *
 * Lo puro está separado de lo que toca la base para probarlo sin Supabase.
 */

import crypto from 'node:crypto';
import { supabase } from '../config/supabase';
import { sendRawPayload, type WhatsAppIntegration } from './whatsapp.service';
import {
    CONCEPTOS, armarPayloadPlantilla, dentroDeHorarioDeCobranza, limpiarParametro, renderizarCuerpo,
    tieneBotonUrlDinamico, variablesDelCuerpo,
} from './whatsapp-plantillas.service';

// ─── Puro ────────────────────────────────────────────────────────────────────

/** Por qué una plantilla (o la conversación) no deja enviar. Lo lee la pantalla. */
export type MotivoBloqueo =
    | 'sin_integracion'
    | 'contacto_personal'
    | 'sin_consentimiento'
    | 'dado_de_baja'
    | 'bloqueado'
    | 'consulta_fallida'
    | 'no_aprobada'
    | 'otra_waba'
    | 'no_es_utility'
    | 'necesita_enlace'
    | 'fuera_de_horario';

export const TEXTO_MOTIVO: Record<MotivoBloqueo, string> = {
    sin_integracion: 'La escuela no tiene WhatsApp conectado.',
    contacto_personal: 'Es una conversación personal: el canal de la escuela no le escribe.',
    sin_consentimiento: 'Esta persona no ha aceptado recibir avisos de la escuela por WhatsApp. '
        + 'Cuando vuelva a escribir se abre la ventana y puedes responderle con texto.',
    dado_de_baja: 'Esta persona pidió no recibir más mensajes de la escuela (escribió BAJA o STOP).',
    bloqueado: 'Este número está bloqueado para el canal de la escuela.',
    consulta_fallida: 'No se pudo confirmar el consentimiento. Intenta de nuevo en un momento.',
    no_aprobada: 'Meta todavía no aprobó esta plantilla.',
    otra_waba: 'La plantilla es de una cuenta de WhatsApp anterior de la escuela.',
    no_es_utility: 'Es de categoría publicidad: el consentimiento de las familias solo cubre avisos.',
    necesita_enlace: 'Lleva un botón con enlace de pago: se envía desde Cobros, no desde el chat.',
    fuera_de_horario: 'Es un mensaje de cobro y estamos fuera del horario legal de cobranza '
        + '(lunes a viernes 7 a. m.–7 p. m., sábados 8 a. m.–3 p. m., nunca domingos ni festivos).',
};

export interface FilaPlantilla {
    name: string;
    language: string;
    category: string | null;
    status: string;
    waba_id: string | null;
    components: any[] | null;
}

export interface PlantillaParaElHilo {
    nombre: string;
    idioma: string;
    categoria: string | null;
    estado: string;
    cuerpo: string;
    variables: number;
    /** Los ejemplos con que se aprobó (sirven de ayuda en cada campo). */
    ejemplos: string[];
    enviable: boolean;
    motivo: MotivoBloqueo | null;
}

/** ¿El nombre es una plantilla de cobro de SportMaps? (esas tienen horario legal) */
export function esPlantillaDeCobro(nombre: string): boolean {
    return Object.values(CONCEPTOS).some((c) => c.esCobro && c.plantilla === nombre);
}

/** Cómo se ve una plantilla en el selector del hilo. Pura. */
export function evaluarPlantilla(f: FilaPlantilla, wabaActual: string | null, ahora: Date = new Date()): PlantillaParaElHilo {
    const comps = f.components ?? [];
    const body = comps.find((c: any) => String(c?.type).toUpperCase() === 'BODY');
    const ejemplos: string[] = Array.isArray(body?.example?.body_text?.[0]) ? body.example.body_text[0].map(String) : [];
    let motivo: MotivoBloqueo | null = null;
    if (!wabaActual || f.waba_id !== wabaActual) motivo = 'otra_waba';
    else if (f.status !== 'APPROVED') motivo = 'no_aprobada';
    else if (f.category && f.category !== 'UTILITY') motivo = 'no_es_utility';
    else if (tieneBotonUrlDinamico(comps)) motivo = 'necesita_enlace';
    else if (esPlantillaDeCobro(f.name) && !dentroDeHorarioDeCobranza(ahora)) motivo = 'fuera_de_horario';
    return {
        nombre: f.name,
        idioma: f.language,
        categoria: f.category,
        estado: f.status,
        cuerpo: String(body?.text ?? ''),
        variables: variablesDelCuerpo(comps),
        ejemplos,
        enviable: motivo === null,
        motivo,
    };
}

/** Orden del selector: primero las que se pueden mandar, después por nombre. Pura. */
export function ordenarParaElHilo(ps: PlantillaParaElHilo[]): PlantillaParaElHilo[] {
    return [...ps].sort((a, b) => (Number(b.enviable) - Number(a.enviable)) || a.nombre.localeCompare(b.nombre));
}

/** Las variables escritas a mano, listas para Meta, o el error. Pura. */
export function validarVariables(esperadas: number, crudas: string[]):
    { ok: true; variables: string[] } | { ok: false; error: string } {
    if (crudas.length !== esperadas) {
        return { ok: false, error: `La plantilla tiene ${esperadas} dato(s) y llegaron ${crudas.length}.` };
    }
    const variables = crudas.map((v) => limpiarParametro(String(v ?? '')));
    const vacia = variables.findIndex((v) => !v);
    if (vacia >= 0) return { ok: false, error: `Falta el dato {{${vacia + 1}}}.` };
    const larga = variables.findIndex((v) => v.length > 300);
    if (larga >= 0) return { ok: false, error: `El dato {{${larga + 1}}} es demasiado largo (máximo 300 caracteres).` };
    return { ok: true, variables };
}

// ─── Freno de abuso ──────────────────────────────────────────────────────────
//
// En memoria por proceso (con 3 BFF el tope efectivo es hasta 3×): es un freno
// contra el dedo pegado o un script, no la defensa de costos — esa la pone Meta
// con el límite de mensajería de la WABA.

export const LIMITES_PLANTILLA = {
    porUsuario: { max: 15, ventanaMs: 10 * 60_000 },
    porConversacion: { max: 3, ventanaMs: 60 * 60_000 },
    porEscuela: { max: 60, ventanaMs: 60 * 60_000 },
};

const eventos = new Map<string, number[]>();

function vivos(clave: string, ventanaMs: number, ahora: number): number[] {
    const l = (eventos.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    eventos.set(clave, l);
    return l;
}

/** ¿Se puede mandar otra? Si sí, la cuenta. Devuelve el texto del freno si no. */
export function tomarCupoPlantilla(userId: string, conversationId: string, schoolId: string, ahora = Date.now()): string | null {
    const claves: [string, { max: number; ventanaMs: number }, string][] = [
        [`u:${userId}`, LIMITES_PLANTILLA.porUsuario, 'Enviaste muchas plantillas seguidas. Espera unos minutos.'],
        [`c:${conversationId}`, LIMITES_PLANTILLA.porConversacion, 'Ya se enviaron 3 plantillas a esta persona en la última hora.'],
        [`e:${schoolId}`, LIMITES_PLANTILLA.porEscuela, 'La escuela envió muchas plantillas en la última hora. Intenta más tarde.'],
    ];
    for (const [k, lim, texto] of claves) {
        if (vivos(k, lim.ventanaMs, ahora).length >= lim.max) return texto;
    }
    for (const [k] of claves) eventos.get(k)!.push(ahora);
    return null;
}

/** Para pruebas. */
export function reiniciarCuposPlantilla(): void { eventos.clear(); }

// ─── Con base ────────────────────────────────────────────────────────────────

export type Consentimiento = 'ok' | 'sin_consentimiento' | 'dado_de_baja' | 'bloqueado' | 'consulta_fallida';

/**
 * ¿Se le puede mandar una plantilla a este número? `wa_can_send_template`
 * decide; la fila de opt-in solo sirve para explicar el NO.
 */
export async function consentimientoDe(integrationId: string, contactWaId: string): Promise<Consentimiento> {
    const { data: puede, error } = await supabase.rpc('wa_can_send_template', {
        p_integration_id: integrationId, p_contact_wa_id: contactWaId,
    });
    // Ante la duda NO se envía: es la regla del envío automático.
    if (error) return 'consulta_fallida';
    if (puede === true) return 'ok';
    const { data: optin } = await supabase.from('whatsapp_optins')
        .select('opted_in_at, opted_out_at')
        .eq('integration_id', integrationId)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();
    if ((optin as any)?.opted_out_at) return 'dado_de_baja';
    if ((optin as any)?.opted_in_at) return 'bloqueado';
    return 'sin_consentimiento';
}

/** Las plantillas del espejo de la integración, evaluadas para el hilo. */
export async function plantillasParaElHilo(integrationId: string, wabaActual: string | null, ahora = new Date()) {
    const { data, error } = await supabase.from('whatsapp_template_status')
        .select('name, language, category, status, waba_id, components')
        .eq('integration_id', integrationId)
        .limit(200);
    if (error) return { error: error.message, plantillas: [] as PlantillaParaElHilo[] };
    return {
        error: null,
        plantillas: ordenarParaElHilo(((data ?? []) as FilaPlantilla[])
            // Lo borrado en Meta no se muestra ni deshabilitado: ya no existe.
            .filter((f) => !['DELETED', 'PENDING_DELETION', 'ARCHIVED'].includes(f.status))
            .map((f) => evaluarPlantilla(f, wabaActual, ahora))),
    };
}

export type ResultadoEnvioManual =
    | { ok: true; waMessageId: string | null; texto: string }
    | { ok: false; error: string };

/**
 * Manda la plantilla por Graph (mismo POST que el resto del canal, con el
 * cortafuegos del modo simulado) y la deja en el hilo como mensaje de la
 * escuela. Quien llama ya validó todo lo de arriba.
 */
export async function enviarPlantillaManual(p: {
    integration: WhatsAppIntegration;
    conversationId: string;
    toWaId: string;
    plantilla: PlantillaParaElHilo;
    components: any[];
    variables: string[];
    userId: string;
}): Promise<ResultadoEnvioManual> {
    const payload = armarPayloadPlantilla({
        toWaId: p.toWaId, plantilla: p.plantilla.nombre, idioma: p.plantilla.idioma,
        variables: p.variables, tokenBoton: null,
    });
    const r = await sendRawPayload(p.integration, payload);
    if (!r.ok) return { ok: false, error: r.error ?? 'error_graph' };

    const texto = renderizarCuerpo(p.components, p.variables);
    // Mismo RPC que el bot y el buzón: el hilo no queda con huecos. El mensaje
    // ya salió; si el registro falla se informa igual como enviado.
    await supabase.rpc('wa_record_outbound_message', {
        p_conversation_id: p.conversationId,
        p_integration_id: p.integration.id,
        p_wa_message_id: r.waMessageId || `local-${crypto.randomUUID()}`,
        p_type: 'template',
        p_text_body: texto,
        p_payload: { manual: true, por: p.userId, plantilla: p.plantilla.nombre, variables: p.variables },
        p_ai_generated: false,
        p_to_wa_id: p.toWaId,
    });
    return { ok: true, waMessageId: r.waMessageId ?? null, texto };
}
