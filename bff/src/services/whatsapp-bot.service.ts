/**
 * whatsapp-bot.service — Orquestador del bot de WhatsApp (WA2).
 *
 * Flujo por cada mensaje entrante ya guardado (llamado desde el webhook):
 *
 *  1. IDENTIFICACIÓN (determinista, sin LLM — más seguro, decisión #4 / R17):
 *     - Si la conversación NO está identificada:
 *         · el mensaje parece email  → arranca OTP (envía código al correo)
 *         · el mensaje parece código  → verifica OTP → vincula parent_id
 *         · si no                    → pide el email registrado
 *     - Sin identificar, el bot NO consulta datos sensibles.
 *
 *  2. CONSENTIMIENTO (opt-in explícito, una sola vez, tras identificarse):
 *     - Escribir NO es consentir: abrir la ventana de 24h y aceptar plantillas
 *       son permisos distintos (política de Meta). Solo un sí afirmativo estampa
 *       el opt-in, con el wa_message_id de ESA confirmación como prueba.
 *     - STOP lo registra la ingesta; ACTIVAR lo revierte.
 *
 *  3. INTENTS (con Gemini + tool-calling), solo si está identificada:
 *     - get_payment_status → wa_get_payment_status (pagos de ESTA escuela)
 *     - escalate_to_human  → marca la conversación para atención humana
 *     - El LLM decide la tool; el BFF la ejecuta; el LLM redacta con el resultado.
 *
 *  4. ENTREGA según modo (whatsapp_settings.mode):
 *     - assisted → crea draft (NO envía; el admin aprueba)
 *     - auto     → envía por Graph API + registra outbound
 *
 * Cero respuestas sin tool exitoso (decisión #6): si una tool falla, el bot
 * responde neutro y escala; jamás inventa datos de menores.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { chatWithTools, type LlmTool, type LlmMessage } from './llm.service';
import { sendTextMessage, aFormatoWhatsApp, type WhatsAppIntegration } from './whatsapp.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from './whatsapp-optin.service';
import { estadoDeHorario, mensajeDeEscalamiento } from './whatsapp-horario.service';
import { sendToUser } from './push.service';
import { mediosDePago } from './whatsapp-medios-de-pago.service';
import { resolverRespuestaDeCobro } from './whatsapp-respuesta-de-cobro.service';

const OTP_TTL_MIN = 10;

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function runBotTurn(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    inboundText: string | null,
    waMessageId: string,
    optedOut = false,
): Promise<void> {
    const text = (inboundText || '').trim();

    // 0. Pidió la baja (la ingesta ya la registró) → confirmar y parar.
    //    A quien pide que no le escriban no se le sigue preguntando nada.
    if (optedOut) {
        await deliver(integration, conversationId, contactWaId,
            'Listo, no volverás a recibir mensajes automáticos de la escuela por este medio. ' +
            'Si cambias de opinión, escríbeme *ACTIVAR* y los reactivo. 👋',
            { step: 'opt_out_confirmado' });
        return;
    }

    // Cargar estado de la conversación.
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, parent_id, identified')
        .eq('id', conversationId)
        .maybeSingle();

    if (!conv) return;

    // 1. No identificado → flujo OTP determinista.
    if (!conv.identified) {
        await handleIdentification(integration, conversationId, contactWaId, text);
        return;
    }

    // 1b. Ya identificada: verificar que el vinculo siga siendo el correcto.
    //
    //     Una identificacion vieja NO caduca. Encontrado el 2026-09-16 en la
    //     prueba: la conversacion seguia vinculada a la persona que verifico
    //     por correo el 12 de septiembre, aunque el numero hoy sea de otra.
    //     Quien escribiera desde ese telefono veria los pagos de la primera.
    //
    //     Es el caso del numero que cambia de dueno —linea reciclada, celular
    //     que pasa de un papa a otro, el telefono familiar que queda con el
    //     hijo mayor— y no es raro: las companias reasignan numeros a los
    //     pocos meses.
    //
    //     El numero manda sobre el vinculo guardado: el `from` de WhatsApp lo
    //     autentica Meta en CADA mensaje, mientras que el vinculo viejo es una
    //     afirmacion de hace semanas que nadie volvio a comprobar.
    const revision = await revisarVinculoPorTelefono(
        integration, conversationId, contactWaId, conv.parent_id);
    if (revision === 'corto') return;
    if (revision !== 'sin_cambio') conv.parent_id = revision;

    // 2. Consentimiento: se pide UNA vez, después de identificarse.
    //    Si este turno lo resolvió (preguntó, o registró el sí/no), termina acá.
    if (await handleConsent(integration, conversationId, contactWaId, conv.parent_id, text, waMessageId)) {
        return;
    }

    // 2.5. ¿Hay una pregunta de comprobante abierta? Va ANTES del LLM.
    //
    //      «2», «los dos», «el de Sharik» o «al pendiente» solo significan algo
    //      contra las opciones que se le ofrecieron; para el modelo son ruido y
    //      terminaba contestando cualquier cosa mientras el comprobante seguia
    //      colgado en 'waiting_user'.
    const respondio = await resolverRespuestaDeCobro(
        integration, contactWaId, text,
        (texto, paso) => deliver(integration, conversationId, contactWaId, texto, { step: paso }),
    );
    if (respondio) return;

    // 3. Identificado → intents con LLM.
    await handleIntent(integration, conversationId, contactWaId, conv.parent_id, text);
}

// ─── 1. Identificación (OTP por email) ────────────────────────────────────────

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.sportmaps.co';

/**
 * Identificacion por el NUMERO desde el que escribe. Va antes que el correo.
 *
 * Medido en Dynasty el 2026-09-16: de 502 atletas activos, 156 no tienen
 * ninguna cuenta de acudiente. Para esas familias el camino del correo NO
 * EXISTE — escriben un correo que no esta en la base, el codigo nunca sale, y
 * el bot igual contesta «te envie un codigo» (a proposito, para no revelar
 * quien esta registrado). La conversacion se muere ahi.
 *
 * Por telefono el 100% es alcanzable: 346 entran directo y 156 quedan
 * reconocidos como familia y se les pide crear la cuenta. Quien no la tenga
 * NO recibe informacion de ningun tipo — ni el nombre del atleta, que seria
 * decirle a quien hoy tenga ese numero de quien es familia.
 *
 * Devuelve true si resolvio el turno.
 */
/**
 * ¿El telefono sigue apuntando al mismo acudiente al que quedo vinculada la
 * conversacion?
 *
 * Devuelve el parent_id vigente, 'sin_cambio' si no hay nada que hacer, o
 * 'corto' si el turno ya quedo resuelto y quien llama debe parar.
 *
 * Solo actua cuando el telefono dice algo DISTINTO y confiable. Si el numero
 * no resuelve a nadie —un acudiente que se identifico por correo desde el
 * celular de un vecino, o cuyo telefono nunca se cargo en la ficha— NO se le
 * quita el acceso: seria romperle el canal a quien lo tenia bien.
 */
async function revisarVinculoPorTelefono(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentActual: string | null,
): Promise<string | 'sin_cambio' | 'corto'> {
    const { data, error } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
    });
    if (error) return 'sin_cambio';

    const estado = (data as any)?.estado;
    const porTelefono = (data as any)?.parent_id as string | undefined;

    // El telefono confirma lo que ya teniamos, o no sabe: nada que hacer.
    if (estado !== 'identificado' || !porTelefono) return 'sin_cambio';
    if (porTelefono === parentActual) return 'sin_cambio';

    // Dice otra cosa. La RPC ya reescribio el vinculo; solo queda avisar, para
    // que el nuevo dueno del numero entienda por que el bot le habla distinto.
    console.warn('[whatsapp-bot] el telefono apunta a otro acudiente; se revinculo',
        { conversationId, antes: parentActual, ahora: porTelefono });

    await deliver(integration, conversationId, contactWaId,
        'Actualicé tus datos: este número quedó asociado a tu cuenta. 👍',
        { step: 'revinculado_por_telefono' });

    return porTelefono;
}

async function identificarPorTelefono(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
): Promise<boolean> {
    const { data, error } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
    });
    if (error) {
        console.warn('[whatsapp-bot] wa_identify_by_phone fallo', { err: error.message });
        return false;   // se cae al camino del correo, que sigue existiendo
    }

    const estado = (data as any)?.estado;

    if (estado === 'identificado') {
        // La RPC ya dejo la conversacion vinculada. Se saluda y se pide el
        // consentimiento en el MISMO mensaje, igual que al verificar por OTP:
        // dos «responde SI» seguidos por motivos distintos es una experiencia
        // mala y una fuente de respuestas ambiguas.
        const escuela = await nombreDeEscuela(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            `¡Hola! Soy el *asistente automático* de ${escuela}. 🤖` + '\n\n' +
            `Te reconocí por tu número, así que no necesitas hacer nada más.` + '\n\n' +
            `¿Quieres que la escuela te envíe por aquí los recordatorios de pago ` +
            'y los avisos de tu atleta? Responde *SÍ* para activarlos — puedes darte ' +
            'de baja cuando quieras escribiendo *STOP*.',
            { step: 'ask_consent', identificado_por: 'telefono' });
        return true;
    }

    if (estado === 'debe_registrarse') {
        // UNA VEZ POR DIA, no en cada mensaje.
        //
        // Esto corre mientras la conversacion siga sin identificar, que para
        // estas familias es SIEMPRE: sin el freno, cada mensaje que escriban
        // recibe el mismo aviso. Desde el lado del papa eso es spam, y en un
        // canal donde Meta mide la calidad del numero repetir lo mismo es justo
        // lo que penaliza — ya lo vimos el 2026-09-11 con 7 respuestas iguales.
        //
        // Se devuelve true igual cuando se calla: el turno SI esta resuelto.
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: yaAvisado } = await supabase
            .from('whatsapp_messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)
            .eq('direction', 'outbound')
            .eq('payload->>step', 'debe_registrarse')
            .gte('created_at', desde);
        if ((yaAvisado ?? 0) > 0) return true;

        // EL ENLACE TIENE QUE SER EL DE LA INVITACION, no `/register?phone=`.
        //
        // El registro normal NO toca `children`: solo `accept_invitation_pro`
        // hace `UPDATE children SET parent_id = auth.uid()`. Sin eso el papa se
        // registra, se crea su perfil con el telefono, `children.parent_id`
        // sigue vacio, vuelve a escribir, `wa_identify_by_phone` exige ser
        // acudiente de un atleta activo, falla — y el bot le dice OTRA VEZ que
        // se registre. Hizo todo bien y el sistema le dice que no hizo nada.
        //
        // Medido el 2026-09-22: 148 de 157 de estas familias en Dynasty YA
        // tienen invitacion pendiente. No hay que crear nada, solo encontrarla.
        const { data: inv } = await supabase.rpc('wa_invitacion_pendiente_por_telefono', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
        });

        const invitacion = inv as { invite_id?: string; email?: string } | null;
        let enlace: string;
        if (invitacion?.invite_id) {
            // El correo viaja para que el formulario lo precargue:
            // `accept_invitation_pro` exige que la sesion sea de ESE correo, y
            // si el papa usa otro la aceptacion falla EN SILENCIO despues de
            // que ya lleno todo.
            const correo = invitacion.email ? `&email=${encodeURIComponent(invitacion.email)}` : '';
            enlace = `${FRONTEND_URL}/register?invite=${invitacion.invite_id}${correo}`;
        } else {
            // Sin invitacion (9 de 157 en Dynasty) queda el camino viejo. No
            // vincula solo, pero al menos la escuela lo ve en el buzon y lo
            // resuelve a mano. Crear invitaciones desde el bot es otra decision
            // —quien queda como invited_by, que rol, que plan— y no se toma de
            // contrabando dentro de un fix.
            enlace = `${FRONTEND_URL}/register?phone=${encodeURIComponent(contactWaId)}`;
        }

        await deliver(integration, conversationId, contactWaId,
            'Tu número está registrado en la escuela, pero todavía no tienes tu cuenta creada. 🙌' + '\n\n' +
            `Créala aquí, ya te dejé todo listo: ${enlace}` + '\n\n' +
            'Cuando la tengas, escríbeme por acá y podrás consultar tus pagos, mandar ' +
            'comprobantes y recibir los avisos de tu atleta.',
            { step: 'debe_registrarse', con_invitacion: Boolean(invitacion?.invite_id) });

        // Que quede en el buzon: son familias que hay que empujar a registrarse,
        // y eso lo trabaja la escuela, no el bot.
        await supabase.from('whatsapp_conversations')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        return true;
    }

    if (estado === 'ambiguo') {
        // Dos cuentas con el mismo numero. Elegir mal es mostrarle a alguien
        // los pagos de otra familia: lo resuelve un humano, no el bot.
        await deliver(integration, conversationId, contactWaId,
            'Encontré tu número en más de una cuenta y no quiero mostrarte información ' +
            'que no sea tuya. Ya le avisé a la escuela para que lo revisen contigo. 🙏',
            { step: 'identificacion_ambigua' });
        await escalate(integration, conversationId, contactWaId,
            'Dos cuentas comparten el mismo número de WhatsApp');
        return true;
    }

    return false;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CODE_RE = /\b(\d{6})\b/;

async function handleIdentification(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    text: string,
): Promise<void> {
    // El numero manda. Solo si no resuelve nada se cae al correo, que sigue
    // sirviendo para el acudiente que escribe desde OTRO telefono.
    if (await identificarPorTelefono(integration, conversationId, contactWaId)) return;

    const emailMatch = text.match(EMAIL_RE);
    const codeMatch = text.match(CODE_RE);

    // (a) Mandó un código de 6 dígitos → verificar.
    if (codeMatch) {
        const otpHash = hashOtp(codeMatch[1]);
        const { data: res } = await supabase.rpc('wa_verify_otp', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
            p_otp_hash: otpHash,
        });
        const r = res as any;
        if (r?.ok) {
            // La pregunta de consentimiento va PEGADA a la verificación, no en un
            // turno aparte: dos "responde SÍ" seguidos por motivos distintos es
            // una experiencia mala y una fuente de respuestas ambiguas (§5 del
            // spec). El step 'ask_consent' es lo que hace que handleConsent sepa
            // que ya se preguntó y se limite a leer la respuesta.
            const escuela = await nombreDeEscuela(integration.school_id);
            await deliver(integration, conversationId, contactWaId,
                '✅ ¡Listo! Tu identidad quedó verificada. Te atiende el asistente automático de la escuela. 🤖\n\n' +
                `¿Quieres que *${escuela}* te envíe por aquí los recordatorios de pago y los avisos de tu atleta? ` +
                'Responde *SÍ* para activarlos — puedes darte de baja cuando quieras escribiendo *STOP*.',
                { step: 'ask_consent', otp_verified: true });
        } else {
            const reason = r?.reason;
            const msg = reason === 'expired'
                ? 'Ese código expiró. Escríbeme de nuevo tu email registrado y te envío uno nuevo.'
                : reason === 'too_many_attempts'
                ? 'Demasiados intentos. Escríbeme tu email registrado para reiniciar la verificación.'
                : reason === 'wrong_code'
                ? `Ese código no coincide. Te quedan ${r?.attempts_left ?? 0} intentos.`
                : 'No tengo una verificación pendiente. Escríbeme tu email registrado para empezar.';
            await deliver(integration, conversationId, contactWaId, msg, { step: 'otp_failed', reason });
        }
        return;
    }

    // (b) Mandó un email → arrancar OTP.
    if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
        const otpHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

        const { data: res } = await supabase.rpc('wa_start_identification', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
            p_email: email,
            p_otp_hash: otpHash,
            p_expires_at: expiresAt,
        });

        // Solo enviamos el correo si el email corresponde a un usuario real,
        // pero respondemos IGUAL en ambos casos (no permitir enumeración).
        if ((res as any)?.email_matches_parent) {
            await emailClient.send({
                to: email,
                subject: 'Tu código de verificación de SportMaps',
                html: `<p>Tu código de verificación es:</p>
                       <h2 style="letter-spacing:3px">${code}</h2>
                       <p>Vence en ${OTP_TTL_MIN} minutos. Si no lo solicitaste, ignora este correo.</p>`,
                text: `Tu código de verificación de SportMaps es ${code} (vence en ${OTP_TTL_MIN} min).`,
            });
        }

        await deliver(integration, conversationId, contactWaId,
            `Te envié un código de 6 dígitos al correo *${maskEmail(email)}*. Escríbemelo aquí para verificar tu identidad. 🔒`,
            { step: 'otp_sent' });
        return;
    }

    // (c) Ni email ni código.
    //
    // Antes esto exigia el correo de entrada: «Escríbeme el correo electrónico
    // con el que estás registrado en la escuela». Para un padre que escribe
    // desde otro telefono esta bien. Para quien NO es de la escuela —la mama de
    // la duenia, un proveedor, un numero equivocado— es una maquina pidiendole
    // credenciales, y el numero de la escuela suele ser tambien el personal de
    // quien la dirige.
    //
    // Ahora se presenta y ofrece las dos salidas sin exigir ninguna, y la
    // conversacion escala al buzon para que un humano la vea. Quien sea de la
    // escuela sigue teniendo su camino; quien no, deja de sentirse interrogado.
    const nombreEscuela = await nombreDeEscuela(integration.school_id);
    await deliver(integration, conversationId, contactWaId,
        `Hola 👋 Soy el *asistente automático* de *${nombreEscuela}*. 🤖` + '\n\n' +
        'Si eres familia de un atleta y quieres consultar pagos o inscripciones, ' +
        'escríbeme el *correo electrónico* con el que estás registrado y te ayudo enseguida.' + '\n\n' +
        'Si buscas otra cosa, cuéntame y alguien de la escuela te responde.',
        { step: 'ask_email' });

    // Escala, pero SIN el mensaje de escalamiento: `escalate` manda su propio
    // «en breve te contactan» y quedarian dos mensajes seguidos diciendo casi lo
    // mismo. Acá solo se marca para que aparezca en el buzón.
    const { data: previa } = await supabase.from('whatsapp_conversations')
        .select('status, contact_name').eq('id', conversationId).maybeSingle();
    if ((previa as any)?.status !== 'open') {
        await supabase.from('whatsapp_conversations')
            .update({ status: 'open', updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        await avisarQueEsperan(integration, conversationId, (previa as any)?.contact_name ?? null);
    }
}

// ─── 2. Consentimiento explícito (opt-in) ─────────────────────────────────────
//
// Que el padre nos escriba abre la ventana de 24h; NO es consentimiento para
// mandarle plantillas después (política de Meta, §1.1 del spec). El opt-in se
// pide UNA vez, enganchado al final del flujo de identificación para no hacerle
// dos interrogatorios seguidos, y solo una confirmación afirmativa lo estampa.
//
// Devuelve true si este turno quedó resuelto acá (no debe seguir al LLM).
//
// Spec: docs/specs/whatsapp-optin-y-rastreo-de-plantillas.md §5

const AFIRMATIVAS = new Set([
    'si', 'si acepto', 'acepto', 'si quiero', 'quiero', 'claro', 'claro que si',
    'dale', 'ok', 'okey', 'de acuerdo', 'esta bien', 'listo', 'activar',
]);
const NEGATIVAS = new Set(['no', 'no gracias', 'no quiero', 'ahora no', 'prefiero que no']);
const REACTIVAR = new Set(['activar', 'reactivar', 'si activar']);

/**
 * Misma normalización que la RPC wa_ingest_inbound_message usa para las palabras
 * de baja: minúsculas, sin tildes, sin puntuación, y comparación contra el
 * mensaje COMPLETO. Nunca por subcadena — "no quiero perderme la clase" no puede
 * leerse como un "no".
 */
function normalizar(t: string): string {
    return t
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')   // quita las tildes que NFD dejo sueltas
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function handleConsent(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    text: string,
    waMessageId: string,
): Promise<boolean> {
    const norm = normalizar(text);

    const { data: optin } = await supabase
        .from('whatsapp_optins')
        .select('opted_in_at, opted_out_at')
        .eq('integration_id', integration.id)
        .eq('contact_wa_id', contactWaId)
        .maybeSingle();

    const yaConsintio = !!(optin as any)?.opted_in_at && !(optin as any)?.opted_out_at;
    const estaDeBaja = !!(optin as any)?.opted_out_at;

    // Se dio de baja: NO se le vuelve a pedir. Solo escuchamos que la reactive.
    if (estaDeBaja) {
        if (REACTIVAR.has(norm)) {
            await registrarOptIn(integration, contactWaId, parentId, waMessageId);
            await deliver(integration, conversationId, contactWaId,
                '✅ Listo, reactivé los recordatorios por WhatsApp. Puedes darte de baja cuando quieras con *STOP*.',
                { step: 'opt_in_reactivado' });
            return true;
        }
        return false;
    }

    if (yaConsintio) return false;

    // La pregunta se hace una sola vez por conversación.
    if (!(await yaSePreguntoConsentimiento(conversationId))) {
        const escuela = await nombreDeEscuela(integration.school_id);
        await deliver(integration, conversationId, contactWaId,
            `Una cosa más: ¿quieres que *${escuela}* te envíe por aquí los recordatorios de pago ` +
            `y los avisos de tu atleta?\n\n` +
            `Responde *SÍ* para activarlos. Puedes darte de baja cuando quieras escribiendo *STOP*.`,
            { step: 'ask_consent' });
        return true;
    }

    if (AFIRMATIVAS.has(norm)) {
        await registrarOptIn(integration, contactWaId, parentId, waMessageId);
        await deliver(integration, conversationId, contactWaId,
            '✅ Activado. Te avisaré por aquí de tus pagos y de tu atleta. Para darte de baja, escribe *STOP*.',
            { step: 'opt_in_registrado' });
        return true;
    }

    if (NEGATIVAS.has(norm)) {
        // No se registra nada: no hay consentimiento que guardar. Y como la
        // pregunta ya quedó hecha, no se vuelve a insistir.
        await deliver(integration, conversationId, contactWaId,
            'Sin problema, no te enviaré recordatorios automáticos. Igual puedes preguntarme lo que necesites por aquí. 🙌',
            { step: 'consent_rechazado' });
        return true;
    }

    // Ni sí ni no: el padre vino a otra cosa. No se insiste, sigue su camino.
    return false;
}

async function registrarOptIn(
    integration: WhatsAppIntegration,
    contactWaId: string,
    parentId: string | null,
    waMessageId: string,
): Promise<void> {
    // source_ref = el mensaje de la CONFIRMACIÓN, no el primero que escribió.
    // Es la prueba que se muestra si Meta audita el consentimiento.
    const { error } = await supabase.rpc('wa_register_optin', {
        p_integration_id: integration.id,
        p_school_id: integration.school_id,
        p_contact_wa_id: contactWaId,
        p_source: 'user_confirmed',
        p_source_ref: waMessageId,
        p_parent_id: parentId,
        p_opt_out: false,
    });
    if (error) console.error('[whatsapp-bot] wa_register_optin error:', error);
}

async function yaSePreguntoConsentimiento(conversationId: string): Promise<boolean> {
    const { count: enviados } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .eq('payload->>step', 'ask_consent');
    if ((enviados ?? 0) > 0) return true;

    // En modo asistido la pregunta queda como borrador hasta que un admin la
    // aprueba. Cuenta igual como preguntada: si no, cada mensaje del padre
    // generaría un borrador nuevo pidiendo lo mismo.
    const { count: borradores } = await supabase
        .from('whatsapp_message_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('tool_context->>step', 'ask_consent');
    return (borradores ?? 0) > 0;
}

async function nombreDeEscuela(schoolId: string): Promise<string> {
    const { data } = await supabase.from('schools').select('name').eq('id', schoolId).maybeSingle();
    return (data as any)?.name || 'la escuela';
}

// ─── 3. Intents (LLM + tools) ──────────────────────────────────────────────────

export const SYSTEM_PROMPT = `Eres el asistente de una escuela deportiva en WhatsApp, hablando con el padre/acudiente (ya verificado).
Reglas estrictas:
- Responde SIEMPRE en español, cordial y breve (es WhatsApp).
- NUNCA inventes datos. Si necesitas información de pagos, USA la herramienta get_payment_status.
- Si no puedes ayudar o piden algo fuera de tu alcance, usa escalate_to_human.
- No pidas datos personales ni el email otra vez (ya está identificado).
- Formatea montos en pesos colombianos y fechas en formato legible.
- Formato de WhatsApp, NO Markdown: negrita con UN asterisco (*asi*), cursiva con _asi_.
  Nunca uses ** ni ## ni tablas ni enlaces [texto](url): WhatsApp los muestra literales.
- No ofrezcas nada que no puedas hacer. Sabes tres cosas: consultar los pagos del
  acudiente, decirle como pagar, y pasar la conversacion a un humano. No ofrezcas
  agendar, inscribir, enviar documentos ni cambiar nada en el sistema.
- Lo que NO sabes y te van a preguntar igual: horarios de entrenamiento, categorias
  por edad, precios de mensualidad o uniforme, sedes, entrenadores, competencias,
  asistencia y rendimiento. No tienes esos datos. Dilo derecho —«eso no lo tengo a
  la mano»— y ofrece pasarlo con la escuela. NUNCA los deduzcas ni los inventes:
  suenan faciles de contestar y es justo ahi donde un asistente se inventa un horario
  o un precio que la familia despues reclama.
- Al listar pagos, mira SIEMPRE el campo debe_pagarse. Los que vienen en false YA
  ESTAN RESUELTOS: no los pongas bajo "pagos pendientes" ni menciones su saldo en $0.
  Si el acudiente pregunta por uno de esos, responde con su estado_legible
  ("ya esta pagado y confirmado por la escuela").
- Si NINGUNO tiene debe_pagarse en true, di que esta al dia; no inventes una lista.
- «Cuanto cuesta la mensualidad?» de alguien YA inscrito es una pregunta sobre SU
  cobro, no sobre la lista de precios: usa get_payment_status y dile su monto. Es la
  pregunta mas comun de todas y contestarle «no tengo ese dato» teniendolo delante es
  el peor no que puede dar. Solo si pregunta por precios de la escuela en general
  —otro plan, otra categoria, inscripcion nueva— no lo tienes.

QUIEN ERES:
- Eres un asistente AUTOMATICO, y si te preguntan lo dices sin rodeos: «soy el
  asistente automatico de la escuela». No te hagas pasar por una persona ni dejes
  que lo crean — este numero es el MISMO que atendia un humano hasta ayer, y las
  familias estan acostumbradas a que les responda ella.
- Nunca firmes con el nombre de nadie de la escuela.
- Si el acudiente quiere hablar con una persona, no lo discutas: usa
  escalate_to_human de una.

FUERA DE TEMA:
- Eres el asistente de la escuela. NO respondas preguntas generales de cultura,
  tecnologia ni nada ajeno a la escuela y sus pagos, aunque sepas la respuesta.
  En el chat de prueba explicaste que es Claude y que es un JSON: eso convierte el
  WhatsApp de la escuela en un chatbot de uso general.
- NUNCA digas que modelo o que proveedor de IA eres. Si preguntan, di que eres el
  asistente de la escuela y ofrece ayudar con pagos o comunicar con el equipo.
- Ante algo fuera de tema, responde corto y amable, y vuelve a lo tuyo. No lo
  escales: escalar cada pregunta suelta le llena la bandeja a la escuela.

COMO PAGAR:
- Para «medios de pago», «como pago», «a que cuenta», «acepta Nequi» o «donde mando el
  soporte» usa get_payment_methods. Esas preguntas NO se escalan.
- Ofrece SIEMPRE las tres opciones que devuelva la herramienta, y menciona que puede
  mandar la foto del comprobante por este mismo chat: es la que nadie descubre solo.
- Da los numeros de cuenta COMPLETOS, tal como vienen. No los recortes.
- Si la escuela no tiene cuentas cargadas, no te las inventes: ofrece el enlace para
  pagar en linea y el envio del comprobante por aqui.`;

export const TOOLS: LlmTool[] = [
    {
        name: 'get_payment_status',
        description: 'Estado de los pagos del acudiente en esta escuela: lo que debe Y lo resuelto en los ultimos 60 dias. Cada pago trae `estado_legible` (pagado y confirmado, comprobante en revision, rechazado, pendiente) y `debe_pagarse`. Usala SIEMPRE que pregunte por pagos, mensualidades, inscripciones, saldos, vencimientos, o si un pago suyo ya quedo aprobado. Si un concepto no aparece en el resultado, di que no lo encuentras — NUNCA afirmes que un cobro no existe.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_payment_methods',
        description: 'Como puede pagar el acudiente: las cuentas de la escuela para transferir, el enlace para pagar en linea, y que puede mandar el comprobante por este mismo chat. Usala cuando pregunte como pagar, medios de pago, a que cuenta consignar, si acepta Nequi o transferencia, o donde manda el soporte. NO escales estas preguntas: se responden con esta herramienta.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'escalate_to_human',
        description: 'Escala la conversación a un humano de la escuela. Úsala cuando no puedas resolver o el padre lo pida.',
        parameters: {
            type: 'object',
            properties: { reason: { type: 'string', description: 'Motivo breve de la escalación' } },
            required: [],
        },
    },
];

async function handleIntent(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    text: string,
): Promise<void> {
    if (!text) return;

    const messages: LlmMessage[] = [{ role: 'user', content: text }];

    let first;
    try {
        first = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
    } catch (err: any) {
        console.error('[whatsapp-bot] LLM error:', err?.message);
        await escalate(integration, conversationId, contactWaId, 'llm_error');
        return;
    }

    // Sin tool → responder texto directo (saludos, agradecimientos).
    if (!first.toolCalls?.length) {
        await deliver(integration, conversationId, contactWaId,
            first.text || 'Puedo ayudarte con el estado de tus pagos. ¿Qué necesitas?',
            { step: 'llm_text', provider: first.provider });
        return;
    }

    const call = first.toolCalls[0];

    if (call.name === 'escalate_to_human') {
        await escalate(integration, conversationId, contactWaId, String((call.args as any)?.reason || 'user_request'));
        return;
    }

    if (call.name === 'get_payment_methods') {
        const medios = await mediosDePago(integration.school_id);

        messages.push({ role: 'assistant', content: `Llamando get_payment_methods` });
        messages.push({ role: 'tool', toolName: 'get_payment_methods', content: JSON.stringify(medios) });
        let final;
        try {
            // SIN herramientas, a proposito. Este turno solo REDACTA con datos que
            // ya llegaron; ofrecerle TOOLS lo invita a llamar otra, y cuando lo
            // hace `text` vuelve vacio y caemos al texto plano.
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: [] });
        } catch {
            await deliver(integration, conversationId, contactWaId,
                fallbackMediosDePago(medios), { step: 'medios_fallback' });
            return;
        }
        // Un degradado al texto plano NO puede ser silencioso. El 2026-09-14
        // ocurrio cuatro veces sin dejar rastro en ningun lado, y buscar la
        // causa costo descartar saturacion, proveedor, configuracion de dev y
        // recursos de Render, uno por uno. La proxima vez lo dira.
        if (!final.text) {
            console.warn('[whatsapp-bot] medios_de_pago: el modelo no devolvio texto',
                { proveedor: final.provider, toolCalls: (final as any).toolCalls?.length ?? 0 });
        }
        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackMediosDePago(medios),
            { step: 'get_payment_methods', provider: final.provider });
        return;
    }

    if (call.name === 'get_payment_status') {
        const { data: payments, error } = await supabase.rpc('wa_get_payment_status', {
            p_parent_id: parentId,
            p_school_id: integration.school_id,
        });

        // Tool falló → NO inventar. Escalar.
        if (error) {
            console.error('[whatsapp-bot] wa_get_payment_status error:', error);
            await escalate(integration, conversationId, contactWaId, 'tool_error');
            return;
        }

        // Redacción final con el resultado de la tool.
        messages.push({ role: 'assistant', content: `Llamando get_payment_status` });
        messages.push({ role: 'tool', toolName: 'get_payment_status', content: JSON.stringify(payments) });

        let final;
        try {
            // SIN herramientas, a proposito. Este turno solo REDACTA con datos que
            // ya llegaron; ofrecerle TOOLS lo invita a llamar otra, y cuando lo
            // hace `text` vuelve vacio y caemos al texto plano.
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: [] });
        } catch {
            // Si la 2a llamada falla, redactar un fallback determinista con los datos.
            await deliver(integration, conversationId, contactWaId,
                fallbackPaymentText(payments), { step: 'payment_fallback' });
            return;
        }

        // Un degradado al texto plano NO puede ser silencioso. El 2026-09-14
        // ocurrio cuatro veces sin dejar rastro en ningun lado, y buscar la
        // causa costo descartar saturacion, proveedor, configuracion de dev y
        // recursos de Render, uno por uno. La proxima vez lo dira.
        if (!final.text) {
            console.warn('[whatsapp-bot] estado_de_pagos: el modelo no devolvio texto',
                { proveedor: final.provider, toolCalls: (final as any).toolCalls?.length ?? 0 });
        }
        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackPaymentText(payments),
            { step: 'get_payment_status', provider: final.provider, tool_result: payments });
        return;
    }

    // Tool desconocida → escalar.
    await escalate(integration, conversationId, contactWaId, 'unknown_tool');
}

/**
 * Texto de medios de pago sin pasar por el modelo.
 *
 * Si la segunda llamada al LLM falla, el acudiente igual se queda con las
 * cuentas y el enlace. Dejarlo sin respuesta seria peor que un texto plano.
 */
function fallbackMediosDePago(m: Awaited<ReturnType<typeof mediosDePago>>): string {
    const lineas: string[] = ['Puedes pagar de estas formas:', ''];
    if (m.cuentas.length) {
        lineas.push('*Transferencia*');
        for (const c of m.cuentas) {
            lineas.push(`• ${c.tipo}: ${c.numero}${c.titular ? ` (${c.titular})` : ''}`);
        }
        lineas.push('');
    }
    lineas.push(`*En línea:* ${m.enlace_para_pagar}`);
    lineas.push('');
    lineas.push('*Y si ya pagaste*, mándame la foto del comprobante por acá mismo y yo lo registro. 📄');
    return lineas.join('\n');
}

// ─── Entrega: modo asistido (draft) vs auto (envío) ────────────────────────────

/**
 * Embudo UNICO de todo lo que el bot le dice al acudiente: respeta el modo
 * (auto envia, asistido deja borrador), registra el saliente y agrega la
 * coletilla de baja cuando corresponde. Exportada para que el webhook pueda
 * responder a los tipos que el bot no procesa (audio, video) sin duplicar nada
 * de eso.
 */
export async function deliver(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    proposedText: string,
    context: Record<string, unknown>,
): Promise<void> {
    // ¿Modo auto vigente? (auto solo si mode='auto' y ya pasó assisted_until)
    const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('mode, assisted_until, ai_enabled')
        .eq('integration_id', integration.id)
        .maybeSingle();

    const s = settings as any;
    const now = Date.now();
    const autoAllowed =
        s?.ai_enabled !== false &&
        s?.mode === 'auto' &&
        (!s?.assisted_until || new Date(s.assisted_until).getTime() < now);

    // A quien pidió la baja y AUN ASÍ nos escribe se le responde —él inició el
    // contacto—, pero enterándose de que sigue con las notificaciones apagadas.
    // Va acá porque `deliver` es el embudo único de todo lo que sale del bot:
    // puesto en cada intent, el primero que se agregue mañana se olvida.
    //
    // Se exceptúan los pasos que HABLAN del consentimiento, o el mensaje queda
    // contradiciéndose («no volverás a recibir… tienes las notificaciones
    // apagadas»).
    const PASOS_DE_CONSENTIMIENTO = [
        'opt_out_confirmado', 'opt_in_confirmado', 'opt_in_reactivado', 'ask_consent',
    ];
    // WhatsApp usa UN asterisco para negrita; el modelo escribe Markdown estandar.
    let texto = aFormatoWhatsApp(proposedText);
    if (!PASOS_DE_CONSENTIMIENTO.includes(String((context as any)?.step ?? ''))
        && await estaDadoDeBaja(integration.id, contactWaId)) {
        texto += AVISO_DADO_DE_BAJA;
    }

    if (autoAllowed) {
        const sent = await sendTextMessage(integration, contactWaId, texto);
        await supabase.rpc('wa_record_outbound_message', {
            p_conversation_id: conversationId,
            p_integration_id: integration.id,
            p_wa_message_id: sent.waMessageId || `local-${crypto.randomUUID()}`,
            p_type: 'text',
            p_text_body: texto,
            p_payload: context,
            p_ai_generated: true,
            p_to_wa_id: contactWaId,
        });
        return;
    }

    // Modo asistido → draft para aprobación (NO se envía).
    await supabase.from('whatsapp_message_drafts').insert({
        conversation_id: conversationId,
        integration_id: integration.id,
        proposed_text: texto,
        tool_context: context,
        llm_provider: (context as any)?.provider ?? null,
        status: 'pending',
    });
}

/**
 * Avisa a quien administra la escuela que hay alguien esperando.
 *
 * Sin esto el buzon existe pero no se usa: la escuela tendria que acordarse de
 * entrar a revisar, y en dos dias deja de hacerlo. El push ya existia para
 * otras cosas; aca solo se engancha a la escalacion.
 *
 * Nunca revienta el flujo del bot: si el aviso falla, el padre igual recibio su
 * respuesta y la conversacion igual quedo marcada como abierta. Un push caido
 * no puede dejar a la familia sin atencion.
 */
async function avisarQueEsperan(
    integration: WhatsAppIntegration,
    conversationId: string,
    nombreContacto: string | null,
): Promise<void> {
    try {
        const [{ data: escuela }, { data: miembros }] = await Promise.all([
            supabase.from('schools').select('name, owner_id').eq('id', integration.school_id).maybeSingle(),
            supabase.from('school_members').select('profile_id')
                .eq('school_id', integration.school_id).eq('status', 'active')
                .in('role', ['owner', 'admin', 'school_admin']),
        ]);

        // El dueno puede no tener fila en school_members: se suma aparte y se
        // deduplica, o recibiria dos avisos por el mismo mensaje.
        const destinos = new Set<string>();
        for (const m of (miembros ?? []) as any[]) if (m.profile_id) destinos.add(m.profile_id);
        if ((escuela as any)?.owner_id) destinos.add((escuela as any).owner_id);
        if (!destinos.size) return;

        const quien = nombreContacto?.trim() || 'Una familia';
        await Promise.allSettled([...destinos].map((uid) => sendToUser(uid, {
            title: `${quien} espera respuesta`,
            body: 'El asistente no pudo resolverlo. Abre WhatsApp en SportMaps para responder.',
            data: { tipo: 'whatsapp_escalado', conversation_id: conversationId,
                    school_id: integration.school_id },
        })));
    } catch {
        // A proposito en silencio. Ver el comentario de arriba.
    }
}

async function escalate(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    reason: string,
): Promise<void> {
    // Solo se avisa en la TRANSICION a abierta. `escalate` puede correr varias
    // veces sobre la misma conversacion —el bot se atasca dos veces seguidas— y
    // sin esto la escuela recibiria un push por cada intento.
    const { data: previa } = await supabase.from('whatsapp_conversations')
        .select('status, contact_name').eq('id', conversationId).maybeSingle();

    await supabase.from('whatsapp_conversations')
        .update({ status: 'open', assigned_to: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    if ((previa as any)?.status !== 'open') {
        await avisarQueEsperan(integration, conversationId, (previa as any)?.contact_name ?? null);
    }

    // El bot responde 24/7 — eso no cambia. Lo que cambia fuera de horario es lo
    // que PROMETE: decir "en breve te contactan" a las 11 de la noche, cuando en
    // la escuela no hay nadie hasta el otro dia, es prometer algo que no se
    // puede cumplir.
    const horario = await estadoDeHorario(integration.id);
    await deliver(integration, conversationId, contactWaId,
        mensajeDeEscalamiento(horario),
        { step: 'escalated', reason, fuera_de_horario: horario.fueraDeHorario });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

function maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const shown = user.slice(0, 2);
    return `${shown}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * El estado de pagos sin pasar por el modelo.
 *
 * FILTRA POR `debe_pagarse`. La consulta `wa_get_payment_status` se amplio para
 * devolver tambien lo RESUELTO de los ultimos 60 dias —para poder responder «ya
 * lo aprobaron?»— y este camino seguia listandolo todo bajo «pagos pendientes».
 * Resultado visible en el chat de prueba del 2026-09-14:
 *
 *     • Mensualidad Septiembre 2026: $0 — vence 2026-09-10
 *
 * Un pago confirmado, cobrado de nuevo, en $0. El mismo bug que ya se habia
 * corregido en el prompt del modelo, escondido en el respaldo que nadie volvio
 * a mirar cuando se amplio la consulta.
 */
function fallbackPaymentText(payments: any): string {
    const list = Array.isArray(payments) ? payments : [];
    const pendientes = list.filter((p: any) => p?.debe_pagarse === true);

    if (!pendientes.length) {
        return list.length
            ? 'No tienes pagos pendientes en este momento. ¡Estás al día! ✅'
            : 'No encuentro pagos a tu nombre en esta escuela.';
    }

    const lines = pendientes.slice(0, 5).map((p: any) => {
        const monto = Number(p.saldo || 0).toLocaleString('es-CO');
        const venc = p.vencido ? ' (vencida)' : '';
        return `• ${p.concept}: $${monto} — vence ${p.due_date}${venc}`;
    });
    return `Estos son tus pagos pendientes:\n${lines.join('\n')}`;
}
