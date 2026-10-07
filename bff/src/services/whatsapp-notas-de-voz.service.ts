/**
 * whatsapp-notas-de-voz — F1 del spec docs/specs/whatsapp-notas-de-voz.md.
 *
 * Una nota de voz de una FAMILIA CON CONSENTIMIENTO, con el flag
 * `whatsapp_settings.transcribir_audios` prendido, se baja a memoria, se
 * transcribe (Groq → OpenAI), se guarda el texto en el entrante
 * (`text_body` + `payload.transcripcion`) y pasa al turno normal del bot como si
 * la familia hubiera escrito: ráfaga, P4, P9, consentimiento, modelo. La
 * respuesta empieza con el eco «🎤 Entendí: …» (lo pone `deliver`).
 *
 * Todo lo demás conserva el comportamiento anterior («No puedo escuchar notas
 * de voz»), respetando P4 (la escuela está escribiendo → silencio) y P9 (la
 * ráfaga le habla a una persona del equipo → silencio, ya quedó en el buzón).
 *
 * Reglas duras:
 *  - Quien llama ya pasó por `debeAtender`. Acá además se exige que el tipo sea
 *    de FAMILIA: un desconocido nunca se transcribe aunque la escuela tenga
 *    `responder_desconocidos` (el 71 % de los audios del número de Dynasty son
 *    la vida privada de la dueña, §1.2). Staff y personal tampoco.
 *  - El archivo se baja SOLO si se va a transcribir.
 *  - El audio nunca se guarda; el texto nunca va a los logs.
 *  - > 120 s o ruido: no se le pasa al bot (buzón / «¿me lo escribes?»).
 */

import { supabase } from '../config/supabase';
import {
    downloadMedia, AUDIO_MIME_PERMITIDOS, AUDIO_MAX_BYTES,
    type WhatsAppIntegration, type ParsedInboundMessage,
} from './whatsapp.service';
import {
    deliver, mensajesRecientes, abrirEnBuzon, vocativosDeEscuela, nombreDeEscuela,
    textoDeRafaga, SILENCIO_HUMANO_MIN, transcribeSinConsentimiento, yaSePreguntoConsentimiento,
    entrantesDeTexto, BOTONES_CONSENTIMIENTO,
} from './whatsapp-bot.service';
import {
    humanoReciente, pideALaPersona, pasoEnVentana, esRuidoDeTranscripcion, AUDIO_MAX_SEGUNDOS_BOT,
    type FilaReciente,
} from './whatsapp-reglas-turno';
import { transcribirAudio, type ResultadoTranscripcion } from './transcripcion.service';
import { intencionDeProspecto, DIAS_MARCA_PROSPECTO, type TipoDeContacto } from './whatsapp-atencion.service';

/** Tipos de contacto cuyas notas de voz se pueden transcribir (D6: nunca desconocidos). */
const TIPOS_TRANSCRIBIBLES: ReadonlySet<TipoDeContacto> = new Set(['familia', 'familia_sin_cuenta', 'ambiguo']);

const VENTANA_REPETICION_MS = 10 * 60_000;
/** «No puedo escuchar» una vez por día y conversación (…7251 lo recibió 2 veces el 06-oct). */
const VENTANA_NO_PUEDO_ESCUCHAR_MS = 24 * 3600_000;

export const TEXTO_NO_PUEDO_ESCUCHAR =
    'No puedo escuchar notas de voz 🙊 Escríbeme el mensaje y te ayudo. Y si es un ' +
    'comprobante de pago, mándame la *foto* o el *PDF* que te da el banco.';
export const TEXTO_NO_PUDE_ESCUCHAR =
    'No logré escuchar tu nota de voz 🙊 ¿Me escribes el mensaje? Y si es un comprobante de ' +
    'pago, mándame la *foto* o el *PDF* que te da el banco.';
/**
 * P1-10 de la auditoría 2026-10-06: a 4 de 4 familias sin opt-in se les dijo
 * «No puedo escuchar» ANTES de ofrecerles lo que lo habilita (…1621 lo rechazó
 * dos minutos después). Ahora la negativa y la oferta van en el mismo mensaje,
 * con los botones del consentimiento (step 'ask_consent': la respuesta la lee
 * el turno normal).
 */
export const textoOfertaConsentimientoPorAudio = (escuela: string) =>
    'Todavía no puedo escuchar tus notas de voz 🙊 Si aceptas recibir por aquí los recordatorios ' +
    `de pago y los avisos de tu atleta de *${escuela}*, desde ese momento las paso a texto para ` +
    'ayudarte.\n\n¿Aceptas? Mientras tanto, escríbeme el mensaje; y si es un comprobante, mándame ' +
    'la *foto* o el *PDF* del banco.';
export const TEXTO_AUDIO_NO_ENTENDIDO = 'No te entendí bien el audio 🙉 ¿Me lo escribes?';
export const textoAudioLargo = (escuela: string) =>
    `Recibí tu audio 🎧 Como es largo, se lo paso a *${escuela}* para que te responda. ` +
    'Si es algo de pagos o comprobantes, escríbemelo y te ayudo de una vez.';
export const textoAudioNoEntendidoBuzon = (escuela: string) =>
    `Tampoco logré entender este audio 🙉 Se lo paso a *${escuela}* para que lo escuche y te responda.`;

export type ResultadoNotaDeVoz =
    | 'transcrito_al_turno'     // pasó al turno del bot
    | 'transcrito_humano'       // transcrito para el buzón; la escuela está atendiendo (P4)
    | 'largo_al_buzon'
    | 'ruido'
    | 'ruido_al_buzon'
    | 'fallo_al_buzon'
    | 'no_puedo_escuchar'       // comportamiento anterior (sin flag / sin consentimiento)
    | 'ofrece_consentimiento'   // «no puedo escuchar» + la pregunta que lo habilita
    | 'silencio_humano'         // P4 sin transcribir
    | 'silencio_persona'        // P9: la ráfaga es para una persona del equipo
    | 'ya_avisado';             // ya se dijo «no puedo escuchar» hace < 10 min

/** ¿La escuela prendió la transcripción? Sin la columna (migración sin aplicar) → no. */
export async function transcribirAudiosActivo(integrationId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('whatsapp_settings')
            .select('transcribir_audios')
            .eq('integration_id', integrationId)
            .maybeSingle();
        if (error) return false;
        return (data as any)?.transcribir_audios === true;
    } catch {
        return false;
    }
}

/** Opt-in vigente: aceptó y no se dio de baja después. Ante la duda, no. */
export async function tieneConsentimiento(integrationId: string, contactWaId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from('whatsapp_optins')
            .select('opted_in_at, opted_out_at')
            .eq('integration_id', integrationId)
            .eq('contact_wa_id', contactWaId)
            .maybeSingle();
        if (error || !(data as any)?.opted_in_at) return false;
        const out = (data as any).opted_out_at;
        return !out || new Date(out) < new Date((data as any).opted_in_at);
    } catch {
        return false;
    }
}

/** Vocabulario para Whisper: escuela, equipo y palabras del dominio. */
async function vocabulario(schoolId: string): Promise<string> {
    const [escuela, vocativos] = await Promise.all([
        nombreDeEscuela(schoolId).catch(() => ''),
        vocativosDeEscuela(schoolId).catch(() => new Map<string, string>()),
    ]);
    const nombres = [...new Set([...vocativos.values()])].slice(0, 10);
    return [
        escuela,
        ...nombres,
        'mensualidad, inscripción, comprobante, transferencia, Nequi, Daviplata, Bancolombia, ' +
        'clase de cortesía, entrenamiento, uniforme',
    ].filter(Boolean).join('. ').slice(0, 600);
}

async function guardarTranscripcion(
    msg: ParsedInboundMessage,
    textoBody: string | null,
    transcripcion: Record<string, unknown>,
): Promise<void> {
    const parche: Record<string, unknown> = {
        payload: { ...(msg.raw && typeof msg.raw === 'object' ? msg.raw : {}), transcripcion },
    };
    if (textoBody) parche.text_body = textoBody;
    const { error } = await supabase.from('whatsapp_messages').update(parche).eq('wa_message_id', msg.waMessageId);
    if (error) console.warn('[wa-notas-de-voz] no se pudo guardar la transcripción', { err: error.message });
}

function metadatos(r: Extract<ResultadoTranscripcion, { ok: true }>, alBot: boolean, motivo?: string) {
    return {
        version: 1,
        proveedor: r.proveedor,
        modelo: r.modelo,
        duracion: r.duracionS,
        duracion_estimada: r.duracionEstimada,
        confianza: r.confianza,
        no_speech_prob: r.noSpeechProb,
        avg_logprob: r.avgLogprob,
        idioma: 'es',
        ms: r.ms,
        al_bot: alBot,
        ...(motivo ? { motivo } : {}),
        ...(r.intentos.length ? { intentos_fallidos: r.intentos } : {}),
        at: new Date().toISOString(),
    };
}

/** P9 sin transcripción: la ráfaga le habla a una persona, o la conversación ya está con una. */
async function esParaUnaPersona(
    schoolId: string,
    recientes: FilaReciente[],
    waMessageId: string,
): Promise<boolean> {
    if (pasoEnVentana(recientes, 'mensaje_para_persona', VENTANA_REPETICION_MS)
        || pasoEnVentana(recientes, 'escalated', VENTANA_REPETICION_MS)) return true;
    const rafaga = textoDeRafaga(recientes, '', waMessageId);
    if (!rafaga.trim()) return false;
    return pideALaPersona(rafaga, await vocativosDeEscuela(schoolId)) !== null;
}

/**
 * Atiende una nota de voz de un contacto que `debeAtender` ya aprobó.
 * `turno(texto)` corre el turno normal del bot (con ráfaga y candado) con el
 * texto transcrito y `origen: 'audio'`.
 */
export async function atenderNotaDeVoz(p: {
    integration: WhatsAppIntegration;
    conversationId: string;
    msg: ParsedInboundMessage;
    tipo: TipoDeContacto;
    turno: (texto: string) => Promise<void>;
}): Promise<ResultadoNotaDeVoz> {
    const { integration, conversationId, msg } = p;
    const contactWaId = msg.contactWaId;
    const recientes = await mensajesRecientes(conversationId);
    const escuelaHablando = humanoReciente(recientes, SILENCIO_HUMANO_MIN);

    const esFamilia = TIPOS_TRANSCRIBIBLES.has(p.tipo) && !!msg.mediaId;
    const flagAudios = esFamilia && await transcribirAudiosActivo(integration.id);
    const conConsentimiento = flagAudios && await tieneConsentimiento(integration.id, contactWaId);
    // Ajuste por escuela `wa_transcribir_sin_consentimiento`: familias sin
    // opt-in también (nunca personales ni staff: no llegan a este tipo).
    const transcribible = esFamilia
        && (conConsentimiento || await transcribeSinConsentimiento(integration.school_id));

    // ─── Sin transcripción: comportamiento anterior, con P4 y P9 ─────────────
    if (!transcribible) {
        if (escuelaHablando) return 'silencio_humano';
        if (await esParaUnaPersona(integration.school_id, recientes, msg.waMessageId)) return 'silencio_persona';
        if (pasoEnVentana(recientes, 'tipo_no_soportado_audio', VENTANA_NO_PUEDO_ESCUCHAR_MS)
            || pasoEnVentana(recientes, 'ask_consent', VENTANA_NO_PUEDO_ESCUCHAR_MS)) return 'ya_avisado';
        if (flagAudios && await puedeOfrecerConsentimiento(integration.id, conversationId, contactWaId)) {
            await deliver(integration, conversationId, contactWaId,
                textoOfertaConsentimientoPorAudio(await nombreDeEscuela(integration.school_id)),
                { step: 'ask_consent', por_audio: true },
                { botones: BOTONES_CONSENTIMIENTO });
            return 'ofrece_consentimiento';
        }
        await deliver(integration, conversationId, contactWaId, TEXTO_NO_PUEDO_ESCUCHAR,
            { step: 'tipo_no_soportado_audio' });
        return 'no_puedo_escuchar';
    }

    return transcribirYAtender(p, recientes, escuelaHablando);
}

/**
 * ¿Se le puede ofrecer el consentimiento a esta familia? Solo con cuenta
 * (el opt-in se registra contra el acudiente), sin baja y si nunca se le
 * preguntó (borradores no enviados no cuentan). Nunca lanza.
 */
async function puedeOfrecerConsentimiento(integrationId: string, conversationId: string, contactWaId: string): Promise<boolean> {
    try {
        const { data: conv } = await supabase.from('whatsapp_conversations')
            .select('parent_id').eq('id', conversationId).maybeSingle();
        if (!(conv as any)?.parent_id) return false;
        const { data: optin } = await supabase.from('whatsapp_optins')
            .select('opted_in_at, opted_out_at')
            .eq('integration_id', integrationId).eq('contact_wa_id', contactWaId).maybeSingle();
        if ((optin as any)?.opted_out_at) return false;
        return !(await yaSePreguntoConsentimiento(conversationId));
    } catch {
        return false;
    }
}

/**
 * Nota de voz de un DESCONOCIDO con el ajuste `wa_transcribir_sin_consentimiento`.
 * Solo si la conversación ya es de prospecto (un texto suyo de los últimos días
 * con intención clara de entrar a la escuela): un desconocido cualquiera puede
 * ser un amigo de la dueña y su audio no se toca. Lo transcrito pasa por la
 * misma puerta angosta del desconocido (`turno`, sin modelo). Si no aplica,
 * silencio, como siempre.
 */
export async function atenderNotaDeVozDeProspecto(p: {
    integration: WhatsAppIntegration;
    conversationId: string;
    msg: ParsedInboundMessage;
    turno: (texto: string) => Promise<void>;
}): Promise<ResultadoNotaDeVoz | 'no_aplica'> {
    if (!p.msg.mediaId) return 'no_aplica';
    if (!(await transcribeSinConsentimiento(p.integration.school_id))) return 'no_aplica';
    const previos = await entrantesDeTexto(p.conversationId, DIAS_MARCA_PROSPECTO);
    if (!previos.some((t) => intencionDeProspecto(t))) return 'no_aplica';
    const recientes = await mensajesRecientes(p.conversationId);
    const escuelaHablando = humanoReciente(recientes, SILENCIO_HUMANO_MIN);
    return transcribirYAtender(p, recientes, escuelaHablando);
}

async function transcribirYAtender(
    p: {
        integration: WhatsAppIntegration;
        conversationId: string;
        msg: ParsedInboundMessage;
        turno: (texto: string) => Promise<void>;
    },
    recientes: FilaReciente[],
    escuelaHablando: boolean,
): Promise<ResultadoNotaDeVoz> {
    const { integration, conversationId, msg } = p;
    const contactWaId = msg.contactWaId;

    // ─── Transcribir ────────────────────────────────────────────────────────
    const bajada = await downloadMedia(integration, msg.mediaId as string,
        { mimes: AUDIO_MIME_PERMITIDOS, maxBytes: AUDIO_MAX_BYTES });
    let resultado: ResultadoTranscripcion;
    if (!bajada.ok || !bajada.buffer) {
        resultado = { ok: false, motivo: `descarga: ${bajada.error ?? 'sin_binario'}`, intentos: [] };
    } else {
        resultado = await transcribirAudio(bajada.buffer, bajada.mimeType || msg.mediaMimeType || 'audio/ogg', {
            idioma: 'es',
            prompt: await vocabulario(integration.school_id).catch(() => ''),
        });
    }
    // El buffer sale de alcance acá: el audio no se guarda en ningún lado.

    if (!resultado.ok) {
        await guardarTranscripcion(msg, null, {
            version: 1, error: resultado.motivo, al_bot: false, at: new Date().toISOString(),
        });
        if (escuelaHablando) return 'silencio_humano';
        await deliver(integration, conversationId, contactWaId, TEXTO_NO_PUDE_ESCUCHAR,
            { step: 'audio_no_transcrito' });
        await abrirEnBuzon(integration, conversationId, contactWaId);
        return 'fallo_al_buzon';
    }

    const largo = (resultado.duracionS ?? 0) > AUDIO_MAX_SEGUNDOS_BOT;
    const ruido = !largo && esRuidoDeTranscripcion(resultado.texto, resultado.noSpeechProb);
    const alBot = !largo && !ruido && !escuelaHablando;
    await guardarTranscripcion(msg, ruido ? null : resultado.texto,
        metadatos(resultado, alBot, largo ? 'audio_largo' : ruido ? 'ruido' : escuelaHablando ? 'escuela_atendiendo' : undefined));

    // P4: la escuela está escribiendo. Queda transcrito para el buzón y el bot calla.
    if (escuelaHablando) return 'transcrito_humano';

    if (largo) {
        await abrirEnBuzon(integration, conversationId, contactWaId);
        await deliver(integration, conversationId, contactWaId,
            textoAudioLargo(await nombreDeEscuela(integration.school_id)),
            { step: 'audio_largo', duracion: resultado.duracionS });
        return 'largo_al_buzon';
    }

    if (ruido) {
        if (pasoEnVentana(recientes, 'audio_no_entendido', VENTANA_REPETICION_MS)) {
            await abrirEnBuzon(integration, conversationId, contactWaId);
            await deliver(integration, conversationId, contactWaId,
                textoAudioNoEntendidoBuzon(await nombreDeEscuela(integration.school_id)),
                { step: 'audio_no_entendido_buzon' });
            return 'ruido_al_buzon';
        }
        await deliver(integration, conversationId, contactWaId, TEXTO_AUDIO_NO_ENTENDIDO,
            { step: 'audio_no_entendido' });
        return 'ruido';
    }

    await p.turno(resultado.texto);
    return 'transcrito_al_turno';
}
