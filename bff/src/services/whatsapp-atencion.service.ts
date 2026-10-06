/**
 * whatsapp-atencion.service — ¿A quién atiende el asistente, y está prendido?
 *
 * Dos preguntas que antes se contestaban (o no) en cada camino por separado, y
 * por eso se contradecían. Medido en Dynasty el 2026-10-03, primer día con el
 * número conectado por Coexistence y el bot APAGADO (`ai_enabled=false`):
 *
 *   - El bot igual corría el modelo en cada mensaje y dejaba 316 borradores que
 *     nadie aprobó; 238 eran «escríbeme tu correo» a contactos PERSONALES.
 *   - El worker de comprobantes no miraba `ai_enabled` y SÍ le escribió a 17
 *     familias pidiéndoles el correo.
 *
 * Coexistence mete al sistema TODO el WhatsApp de la escuela, que en una
 * escuela chica es también el WhatsApp personal de quien la dirige. Sobre 55
 * conversaciones: 30 eran familias, 21 números desconocidos y 4 el propio
 * equipo (178 de los 375 mensajes). La dueña lo quiso así a propósito, y no
 * pierde nada: con Coexistence ella sigue viendo y contestando todo desde su
 * celular. Así que el asistente NO tiene que hacerse cargo de todo — solo de
 * las familias, y callarse con el resto.
 *
 * Este archivo es el único lugar donde se decide eso. El bot (texto), el
 * webhook (audio/video) y el worker (adjuntos) lo consultan; ninguno decide
 * por su cuenta.
 */

import { supabase } from '../config/supabase';
import type { WhatsAppIntegration } from './whatsapp.service';
import { conversacionTomada } from './whatsapp-tomada.service';

/**
 * - familia            → acudiente con cuenta de un atleta activo (por teléfono o por OTP)
 * - familia_sin_cuenta → el número está en la ficha de un atleta activo, sin cuenta
 * - ambiguo            → el número está en dos cuentas: lo resuelve un humano
 * - staff              → administra la escuela (owner/admin)
 * - desconocido        → nada de lo anterior: amigos, proveedores, prospectos
 * - personal           → la escuela lo marcó a mano como personal (manda sobre todo)
 */
export type TipoDeContacto =
    | 'familia' | 'familia_sin_cuenta' | 'ambiguo' | 'staff' | 'desconocido' | 'personal';

export const TIPOS_QUE_SE_ATIENDEN: ReadonlySet<TipoDeContacto> =
    new Set(['familia', 'familia_sin_cuenta', 'ambiguo']);

interface AjustesDeAtencion {
    botEncendido: boolean;
    responderDesconocidos: boolean;
}

/**
 * Lee `ai_enabled` y `responder_desconocidos` de la integración.
 *
 * Sin fila de ajustes → APAGADO. El alta del canal crea la integración con
 * `ai_enabled=false` (F4, `8b98f1be`); una integración sin ajustes es un estado
 * a medio hacer, y ante la duda el asistente no habla.
 *
 * `responder_desconocidos` llega con la migración de Fase A; mientras no exista
 * la columna la consulta falla y se reintenta sin ella (default false).
 */
export async function ajustesDeAtencion(integrationId: string): Promise<AjustesDeAtencion> {
    const conColumna = await supabase
        .from('whatsapp_settings')
        .select('ai_enabled, responder_desconocidos')
        .eq('integration_id', integrationId)
        .maybeSingle();

    let fila: any = conColumna.data;
    if (conColumna.error) {
        const sinColumna = await supabase
            .from('whatsapp_settings')
            .select('ai_enabled')
            .eq('integration_id', integrationId)
            .maybeSingle();
        fila = sinColumna.data;
    }

    return {
        botEncendido: fila?.ai_enabled === true,
        responderDesconocidos: fila?.responder_desconocidos === true,
    };
}

export async function botEncendido(integrationId: string): Promise<boolean> {
    return (await ajustesDeAtencion(integrationId)).botEncendido;
}

/**
 * Clasifica a quien escribe y deja el resultado en
 * `whatsapp_conversations.contact_kind` para que el buzón pueda filtrar.
 *
 * Corre aunque el bot esté apagado: el buzón necesita separar familias del
 * resto igual.
 *
 * Usa `wa_identify_by_phone`, que además VINCULA la conversación cuando
 * encuentra al acudiente. Es el mismo efecto que el bot ya tenía al
 * identificar; no es un efecto nuevo.
 */
export async function clasificarContacto(
    integration: WhatsAppIntegration,
    conversationId: string | null,
    contactWaId: string,
): Promise<TipoDeContacto> {
    // 1. Lo marcado a mano manda. Si la columna aún no existe, se ignora.
    if (conversationId) {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('contact_kind, identified, parent_id')
            .eq('id', conversationId)
            .maybeSingle();
        if (!error && (data as any)?.contact_kind === 'personal') return 'personal';
    }

    const tipo = await clasificarSinGuardar(integration, conversationId, contactWaId);
    if (conversationId) await guardarTipo(conversationId, tipo);
    return tipo;
}

async function clasificarSinGuardar(
    integration: WhatsAppIntegration,
    conversationId: string | null,
    contactWaId: string,
): Promise<TipoDeContacto> {
    const { data: porTelefono, error } = await supabase.rpc('wa_identify_by_phone', {
        p_integration_id: integration.id,
        p_contact_wa_id: contactWaId,
    });
    const estado = error ? null : (porTelefono as any)?.estado;
    if (estado === 'identificado') return 'familia';
    if (estado === 'debe_registrarse') return 'familia_sin_cuenta';
    if (estado === 'ambiguo') return 'ambiguo';

    // Se identificó por OTP desde otro teléfono: el número no lo resuelve,
    // pero la persona ya probó quién es.
    if (conversationId) {
        const { data: conv } = await supabase
            .from('whatsapp_conversations')
            .select('identified, parent_id')
            .eq('id', conversationId)
            .maybeSingle();
        if ((conv as any)?.identified && (conv as any)?.parent_id) return 'familia';
    }

    const { data: staff } = await supabase.rpc('wa_identify_staff_admin_by_phone', {
        p_school_id: integration.school_id,
        p_wa_phone_number: contactWaId,
    });
    if ((staff as any)?.estado === 'identificado') return 'staff';

    return 'desconocido';
}

async function guardarTipo(conversationId: string, tipo: TipoDeContacto): Promise<void> {
    // No pisa una marca manual de 'personal' (carrera con el buzón).
    const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ contact_kind: tipo })
        .eq('id', conversationId)
        .or('contact_kind.is.null,contact_kind.neq.personal');
    if (error && !avisoDeColumnaDado) {
        avisoDeColumnaDado = true;
        console.warn('[wa-atencion] no se pudo guardar contact_kind (¿falta la migración de Fase A?)',
            { err: error.message });
    }
}
let avisoDeColumnaDado = false;

/**
 * La decisión completa: ¿el asistente le contesta a este contacto?
 *
 * - Bot apagado → nunca.
 * - Familias (con o sin cuenta, o ambiguas) → sí.
 * - Desconocidos → solo si la escuela lo pidió (`responder_desconocidos`).
 * - Staff y personal → nunca: es el equipo o la vida privada de la dueña.
 *
 * `atender=false` con `tipo='desconocido'` y el bot prendido NO es silencio
 * seguro: el webhook todavía le pasa el texto a `atenderDesconocido` (bot), que
 * contesta solo correo/código vigente o tema escolar (`temaEscolar`, abajo).
 * Staff y personal no tienen esa puerta. Con `tomada=true` tampoco.
 */
export async function debeAtender(
    integration: WhatsAppIntegration,
    conversationId: string | null,
    contactWaId: string,
): Promise<{ atender: boolean; tipo: TipoDeContacto; botEncendido: boolean; tomada: boolean }> {
    const [ajustes, tipo, tomada] = await Promise.all([
        ajustesDeAtencion(integration.id),
        clasificarContacto(integration, conversationId, contactWaId),
        conversacionTomada(conversationId),
    ]);
    // Tomada por una persona desde el buzón (mejora 9): nada automático, sea
    // quien sea. `tipo` y `botEncendido` se devuelven igual: el worker de
    // comprobantes los usa para seguir APLICANDO el comprobante (sin escribirle
    // a la familia; ver whatsapp-tomada.service).
    const atender = !tomada && ajustes.botEncendido && (
        TIPOS_QUE_SE_ATIENDEN.has(tipo) ||
        (tipo === 'desconocido' && ajustes.responderDesconocidos)
    );
    return { atender, tipo, botEncendido: ajustes.botEncendido, tomada };
}

// ─── El desconocido que SÍ es de la escuela ──────────────────────────────────
//
// «Solo familias» dejó afuera a dos que sí son de la escuela y el teléfono no
// reconoce:
//
//   - la familia que escribe desde OTRO número (antes se verificaba mandando
//     su correo y el código; con el filtro ya no le contestaba nadie), y
//   - el prospecto. En Dynasty, el 2026-10-02, llegaron «Quiero inscribir a mi
//     hija a volleyball» y «Me puedes compartir más información (Horarios,
//     cursos, lugar de práctica, valor…)» de números que no estaban en ninguna
//     ficha. Un prospecto es plata.
//
// La decisión (opción «1C», aprobada): con `responder_desconocidos=false` al
// desconocido se le contesta SOLO si el mensaje trae un correo o un código de
// verificación vigente, o si es de tema escolar — y lo escolar, una vez cada
// 30 días por conversación. El resto sigue en silencio.
//
// Esto lo decide `temaEscolar`, con REGLAS y no con el modelo: se evalúa sobre
// cada mensaje de cada amigo de la dueña, tiene que ser gratis y tiene que
// poder explicarse por qué disparó. Un LLM acá es caro e impredecible justo en
// el lado donde equivocarse le escribe a la vida privada de alguien.

export type TemaEscolar = 'inscripcion' | 'pagos';

/**
 * La normalización de `normalizar()` del bot (minúsculas, sin tildes, sin
 * puntuación), con UNA diferencia: la puntuación se vuelve espacio en vez de
 * borrarse. Allá se compara el mensaje entero («si», «no»); acá se buscan
 * palabras, y «información(Horarios,cursos» borrando la puntuación queda como
 * una sola palabra que no matchea nada. Copiada y no importada porque el bot
 * depende de este archivo y no al revés.
 */
function normalizarTexto(t: string): string {
    return t
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const MESES = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';

/**
 * PAGOS — términos que solo usa quien le paga a la escuela.
 *
 * Lo que NO está, a propósito, medido sobre los mensajes de contactos no-familia
 * de Dynasty del 2026-10-03:
 *   - «pago», «pagar», «pagarte» sueltos: «¿Dónde andas para pagarte lo de la
 *     rifa?». Pagar es de la vida diaria; pagar la MENSUALIDAD es de la escuela.
 *   - «plata», «mandar»: «Yo voy a hacer plata», «Te mando para que desayunes».
 *   - «saldo» suelto: en Colombia es el saldo del celular. Va «saldo pendiente».
 *   - «deuda», «cuota» sueltas: «2da cuota vuelos…» es un viaje.
 *   - «cuenta de cobro»: la manda un proveedor o un profesor, no una familia.
 *   - «cuánto TE debo»: es entre amigos. Va «cuánto debo».
 */
const PAGOS_FUERTES: RegExp[] = [
    /\bmensualidad(es)?\b/,
    /\bcomprobantes?\b/,
    /\bconsignacion(es)?\b/,
    /\bconsign(e|o|ar|amos|aste|ado)\b/,
    /\btransferencias?\b/,
    /\btransferi\b/,
    /\brecibo de (pago|caja)\b/,
    /\bsoportes? (de pago|del pago|de la mensualidad|del mes|de mes|mes)\b/,
    /\bpago (del|de la|de) (mes|mensualidad|matricula|inscripcion)\b/,
    new RegExp(`\\bpago (del mes de |de |mes de )${MESES}\\b`),
    /\b(valor|saldo) pendiente\b/,
    /\bcuanto debo\b/,
    /\bpaz y salvo\b/,
    /\bacudiente\b/,
];

/**
 * INSCRIPCIÓN — términos que por sí solos ya son de una escuela.
 *
 * «Matrícula» queda aunque en Colombia también sea la del carro: en el número
 * de una escuela la del carro no apareció ni una vez, y la de la escuela sí.
 */
const INSCRIPCION_FUERTES: RegExp[] = [
    /\binscrib\w*/,               // inscribir, inscribirla, inscribo, inscribimos
    /\binscripcion(es)?\b/,
    /\bmatricul\w*/,              // matricular, matricularla, matricula
    /\bclases? (de prueba|de cortesia|gratis|gratuitas?)\b/,
    /\bprogramas? de formacion\b/,
];

/**
 * INSCRIPCIÓN — palabras sueltas que solas no alcanzan.
 *
 * «Precio», «información» u «horario» los dice cualquiera («pásame la info del
 * restaurante y el precio»). Se exigen DOS conceptos distintos y que al menos
 * uno sea de deporte o escuela. Así «información (Horarios, cursos, lugar de
 * práctica, valor)» dispara y «info del restaurante y el precio» no.
 *
 * Cada grupo cuenta una vez: «valor» y «cuánto cuesta» son el mismo concepto.
 */
const CONCEPTOS_GENERICOS: Record<string, RegExp> = {
    precio: /\b(precios?|valor(es)?|costos?|tarifas?|cuanto (cuesta|vale|cobran))\b/,
    horario: /\bhorarios?\b/,
    informacion: /\b(informacion|info)\b/,
};
const CONCEPTOS_DE_ESCUELA: Record<string, RegExp> = {
    actividad: /\b(clases?|cursos?|entrenamientos?|entrenar|entrenan|practicas?|practias?)\b/,
    categoria: /\b(categorias?|cupos?)\b/,
    lugar: /\b(sedes?|donde entrenan|lugar de practica)\b/,
    deporte: /\b(voley|volley|voleibol|volleyball|futbol|baloncesto|basket|natacion|patinaje|deportes?|escuela|club|academia)\b/,
    interes: /\b(interesad[oa]s?|quiero entrar|quisiera entrar)\b/,
};

/**
 * «Soy familia» sin decir pagos: «mi hija no va a ir al entrenamiento». «Mi
 * hija» sola no alcanza —la mamá de la dueña también tiene hija—; tiene que
 * venir con algo de la escuela al lado.
 */
const MI_HIJO = /\b(mi|mis) hij[oa]s?\b/;
const CONTEXTO_FAMILIA = /\b(entren\w*|clases?|escuela|club|categorias?|equipo|voley|volley|voleibol|volleyball|uniformes?|partidos?|torneos?|profe|entrenador[a]?)\b/;

/**
 * ¿El mensaje de un desconocido es de tema escolar? Pura y determinista.
 *
 * Orden (si coinciden ambas intenciones, gana pagos — decisión 1C):
 *   1. término fuerte de pagos            → 'pagos'
 *   2. término fuerte de inscripción       → 'inscripcion'
 *   3. dos conceptos sueltos de inscripción (uno de escuela) → 'inscripcion'
 *   4. «mi hijo/hija» + contexto escolar   → 'pagos' (es familia: se le pide el correo)
 *   5. nada                                → null (silencio)
 *
 * El 3 va antes que el 4 para que «mi hija quiere info de horarios de vóley»
 * reciba el enlace y no un pedido de correo.
 */
export function temaEscolar(texto: string | null | undefined): TemaEscolar | null {
    if (!texto) return null;
    const t = normalizarTexto(texto);
    if (!t) return null;

    if (PAGOS_FUERTES.some((re) => re.test(t))) return 'pagos';
    if (INSCRIPCION_FUERTES.some((re) => re.test(t))) return 'inscripcion';

    const genericos = Object.values(CONCEPTOS_GENERICOS).filter((re) => re.test(t)).length;
    const deEscuela = Object.values(CONCEPTOS_DE_ESCUELA).filter((re) => re.test(t)).length;
    if (deEscuela >= 1 && genericos + deEscuela >= 2) return 'inscripcion';

    if (MI_HIJO.test(t) && CONTEXTO_FAMILIA.test(t)) return 'pagos';

    return null;
}

/**
 * Señales de que ya le paga a la escuela: hay un cobro suyo de por medio.
 * Con alguna de estas, «valor» o «cuánto» es SU cobro, no la lista de precios.
 */
const YA_LE_PAGA: RegExp[] = [
    /\bcomprobantes?\b/,
    /\bconsign\w*/,
    /\btransfer\w*/,
    /\brecibo de (pago|caja)\b/,
    /\bsoportes?\b/,
    /\bpendientes?\b/,
    /\bcuanto debo\b/,
    /\bpaz y salvo\b/,
    /\bacudiente\b/,
    /\bdel mes\b/,
    new RegExp(`\\b${MESES}\\b`),
];

/**
 * Cuando `temaEscolar` dice 'pagos', ¿el mensaje TAMBIÉN puede ser de alguien
 * que todavía no está inscrito y pregunta el precio?
 *
 * «¿Qué precio tiene la mensualidad?» o «¿cuánto vale la mensualidad de 2
 * clases?» dicen «mensualidad» —término fuerte de pagos, por eso ganan pagos—
 * pero los escribe igual una familia desde otro celular que un prospecto. Con
 * solo pagos, al prospecto se le pedía el correo de una cuenta que no tiene y
 * se quedaba sin el enlace de inscripción. Con estas señales el bot manda UN
 * mensaje con las dos salidas.
 *
 * NO dispara si el mensaje trae señales de un cobro que ya existe
 * (`YA_LE_PAGA`): «me confirmas el valor para el pago del mes de septiembre» o
 * «el valor pendiente» son de familia, y mandarles el enlace de inscripción es
 * ruido. Pura y determinista, como `temaEscolar`.
 */
export function preguntaPrecioComoProspecto(texto: string | null | undefined): boolean {
    if (!texto) return false;
    const t = normalizarTexto(texto);
    if (!t) return false;
    if (YA_LE_PAGA.some((re) => re.test(t))) return false;
    return INSCRIPCION_FUERTES.some((re) => re.test(t))
        || CONCEPTOS_GENERICOS.precio.test(t)
        || /\bcuanto (es|son|sale)\b/.test(t);
}
