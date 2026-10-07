/**
 * whatsapp-reglas-turno — reglas DETERMINISTAS del turno del bot (sin modelo).
 *
 * Salen del análisis de las conversaciones de Dynasty del 2026-10-06
 * (docs/analisis/whatsapp-conversaciones-dynasty-2026-10-06.md, §2 y §3): en la
 * primera hora con el bot en automático, de 9 familias no resolvió del todo
 * ninguna. Casi todos los errores eran de ORDEN y de LECTURA, no de redacción:
 * el consentimiento antes del comprobante, el texto precargado de /p/:token que
 * nadie reconocía, «Mile, …» contestado con «solo puedo ayudar con…», el bot
 * hablando encima de Milena, y «ya pagué» respondido con la deuda.
 *
 * Todo lo de acá es PURO: recibe texto o filas y devuelve una decisión. Se
 * prueba sin mocks (whatsapp-reglas-turno.test.ts) y se puede explicar por qué
 * disparó. Las consultas a la base viven en whatsapp-bot.service.
 *
 * Normalización: la ortografía de las familias es informal («q», «xfa», «ha
 * cer», «Dinasty», sin tildes, mayúsculas al azar); se compara sin tildes, en
 * minúsculas y con la puntuación vuelta espacio.
 */

export function normalizarFrase(t: string | null | undefined): string {
    return (t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── P3. «Te envío el comprobante» ───────────────────────────────────────────
//
// 29 de 49 familias (59 %) escriben para mandar un comprobante, y casi siempre
// lo ANUNCIAN con texto antes o después de la foto. Dos de las del 06-oct usaron
// el texto precargado del botón «Enviar comprobante por WhatsApp» de /p/:token:
//   «Hola, envío el comprobante de pago de Mensualidad 10/2026 - [ATLETA]
//    (octubre 2026) de [atleta].»
// y recibieron la pregunta de consentimiento en vez de «mándame la foto».

export interface ComprobanteAnunciado {
    tipo: 'precargado' | 'generico' | 'futuro';
    /** Concepto tal cual lo escribió /p/:token (precargado). */
    concepto?: string | null;
    periodo?: string | null;
    deportista?: string | null;
    /** Referencia corta del cobro (8 hex del id del pago), si el texto la trae. */
    ref?: string | null;
}

/** Texto de /p/:token: «… comprobante de pago de <concepto> (<periodo>) de <deportista>. (ref. ABCD1234)» */
const PRECARGADO = /env[ií]o el comprobante de pago de (.+?)(?:\s+\(([^()]+)\))?(?:\s+de\s+([^()]+?))?\s*\.*\s*(?:\(\s*ref\.?\s*:?\s*([0-9a-f]{8})\s*\))?\s*\.?\s*$/i;
const REF = /\bref\.?\s*:?\s*([0-9a-f]{8})\b/i;

/** Verbo de envío + objeto de pago, en cualquier orden razonable. */
const VERBO_ENVIO = /\b(envio|envie|envia|adjunto|comparto|te comparto|te mando|le mando|te paso|le paso|ahi va|ahi te va|aqui va|aca va|aqui te|ahi te|mando|remito)\b/;
const OBJETO_PAGO = /\b(pagos?|comprobantes?|soportes?|transferencias?|consignacion(es)?|mensualidad(es)?|recibos?|desprendibles?)\b/;
/** «Voy a enviar el pago mañana»: anuncia algo que todavía no existe. */
const FUTURO = /\b(voy a|vamos a|ahorita te|mas tarde te|manana te|luego te|en un rato te|despues te|ya te)\s*(enviar|mandar|pasar|envio|mando|paso|hacer)\b/;
/** «Pagué la mensualidad», «hice la transferencia» (sin reclamo: eso es P7). */
const ACABO_DE_PAGAR = /\b(pague|cancele|consigne|transferi|hice (el pago|la transferencia|la consignacion))\b.*\b(mensualidad|mes|pago|cuota|matricula|inscripcion|octubre|noviembre|diciembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre)\b/;
/** «Pago Sofía», «Soporte mensualidad octubre»: el pie típico, ahora como texto suelto. */
const ROTULO = /^(pagos?|soportes?|comprobantes?|mensualidad(es)?)\b/;

export function anunciaComprobante(texto: string | null | undefined): ComprobanteAnunciado | null {
    const crudo = (texto || '').trim();
    if (!crudo) return null;

    const pre = crudo.match(PRECARGADO);
    if (pre) {
        return {
            tipo: 'precargado',
            concepto: pre[1]?.trim() || null,
            periodo: pre[2]?.trim() || null,
            deportista: pre[3]?.trim() || null,
            ref: (pre[4] || crudo.match(REF)?.[1] || '').toLowerCase() || null,
        };
    }

    const t = normalizarFrase(crudo);
    if (!t) return null;
    // Una pregunta («¿te envío el comprobante por acá?», «¿a dónde mando el
    // soporte?») no es un anuncio: es la pregunta de cómo pagar, y la contesta
    // el modelo con los medios de pago.
    if (crudo.includes('?')) return null;
    if (yaPagoYReclama(crudo)) return null;

    if (FUTURO.test(t) && OBJETO_PAGO.test(t)) return { tipo: 'futuro' };
    if (VERBO_ENVIO.test(t) && OBJETO_PAGO.test(t)) return { tipo: 'generico', ref: crudo.match(REF)?.[1]?.toLowerCase() ?? null };
    if (ACABO_DE_PAGAR.test(t) && !/\bya\b/.test(t)) return { tipo: 'generico' };
    if (ROTULO.test(t) && t.split(' ').length <= 7) return { tipo: 'generico' };
    return null;
}

/** Nombre del cobro para decirlo de vuelta: «Mensualidad 10/2026 - X (octubre 2026)». */
export function nombreDelCobroAnunciado(a: ComprobanteAnunciado | null | undefined): string | null {
    if (!a?.concepto) return null;
    return a.concepto + (a.periodo ? ` (${a.periodo})` : '');
}

// ─── P7. «Ya pagué y me sigue llegando el cobro» ────────────────────────────
//
// 10 de 49 familias (20 %): «me aparece el pago pendiente y yo ya pagué», «aún
// no aparece el pago en la plataforma», «la transferencia se realizó el 4 de
// septiembre». El bot les listaba la deuda como vencida.

const YA_PAGUE: RegExp[] = [
    /\bya (pague|cancele|consigne|transferi|envie|mande|hice el pago|hice la transferencia|te envie|te mande|le envie|le mande|realice el pago)\b/,
    /\b(yo )?ya (te|le) (envie|mande|pase)\b/,
    /\bno (me )?aparece (el|mi) pago\b/,
    /\b(aun|todavia) no aparece\b/,
    /\bsigue apareciendo\b/,
    /\bme (sigue|siguen|esta|estan) llegando\b.*\b(cobro|cobros|cuenta|correo|mensajes?|estado de cuenta|recordatorio)/,
    /\bme (llego|aparece)\b.*\b(cobro|pendiente|cuenta de cobro)\b.*\b(pague|pagado|cancele)\b/,
    /\breflejar el pago\b/,
    /\bla transferencia (se )?(realizo|hizo|fue)\b/,
    /\bpague el (lunes|martes|miercoles|jueves|viernes|sabado|domingo|\d)/,
];

export function yaPagoYReclama(texto: string | null | undefined): boolean {
    const t = normalizarFrase(texto);
    if (!t) return false;
    return YA_PAGUE.some((re) => re.test(t));
}

export interface PagoDeEstado {
    concept?: string | null;
    saldo?: number | string | null;
    amount?: number | string | null;
    status?: string | null;
    estado_legible?: string | null;
    debe_pagarse?: boolean | null;
    due_date?: string | null;
    vencido?: boolean | null;
    /** /p/:token del cobro (whatsapp-enlaces-de-pago), si se pudo emitir. */
    enlace_pago?: string | null;
}

export interface FilaDeColaFamilia {
    status: string;
    result_type?: string | null;
    created_at: string;
}

const copFmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

function horaCorta(iso: string): string {
    try {
        return new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
        }).format(new Date(iso));
    } catch {
        return iso.slice(0, 16).replace('T', ' ');
    }
}

/**
 * La respuesta a «ya pagué»: PRIMERO qué comprobante tenemos y en qué está;
 * DESPUÉS, si queda, lo que figura pendiente. Nunca promete revisar nada que el
 * bot no revisa: describe estados que existen en la base.
 *
 * `hayAlgo` = encontró al menos un comprobante (en la cola o en revisión). Si no
 * hay nada, quien llama abre el caso en el buzón: la familia dice que pagó y el
 * sistema no lo ve, eso lo tiene que mirar una persona.
 */
export function textoYaPague(
    pagos: PagoDeEstado[] | null | undefined,
    cola: FilaDeColaFamilia[] | null | undefined,
): { texto: string; hayAlgo: boolean } {
    const lista = Array.isArray(pagos) ? pagos : [];
    const filas = Array.isArray(cola) ? cola : [];
    const lineas: string[] = [];

    // 1. Lo que llegó por este chat y todavía no tiene desenlace.
    const enCola = filas.filter((f) => ['pending', 'processing', 'waiting_user'].includes(f.status));
    const aManoEscuela = filas.filter((f) => f.status === 'ignored' && f.result_type === 'escalated');
    if (enCola.length) {
        const ultimo = enCola.map((f) => f.created_at).sort().slice(-1)[0];
        lineas.push(enCola.length === 1
            ? `Tengo el comprobante que enviaste por aquí el ${horaCorta(ultimo)}; está pendiente de revisión. 📄`
            : `Tengo ${enCola.length} archivos que enviaste por aquí (el último, el ${horaCorta(ultimo)}); están pendientes de revisión. 📄`);
    } else if (aManoEscuela.length) {
        lineas.push('Tengo el comprobante que enviaste por aquí; la escuela lo tiene para aplicarlo. 📄');
    }

    // 2. Lo que la base ya sabe de cada cobro.
    const enRevision = lista.filter((p) => p.status === 'awaiting_approval');
    const pagados = lista.filter((p) => p.status === 'paid');
    const rechazados = lista.filter((p) => p.status === 'rejected');
    const glosados = lista.filter((p) => p.status === 'glosado');
    for (const p of enRevision.slice(0, 3)) lineas.push(`• *${p.concept}*: comprobante recibido, la escuela lo está revisando.`);
    for (const p of rechazados.slice(0, 3)) lineas.push(`• *${p.concept}*: el comprobante fue rechazado.`);
    for (const p of glosados.slice(0, 3)) lineas.push(`• *${p.concept}*: la escuela pidió una aclaración sobre este pago.`);
    for (const p of pagados.slice(0, 3)) lineas.push(`• *${p.concept}*: pagado y confirmado ✅`);

    const hayAlgo = enCola.length > 0 || aManoEscuela.length > 0 || enRevision.length > 0
        || rechazados.length > 0 || glosados.length > 0 || pagados.length > 0;

    // 3. Lo pendiente, recién al final y sin la palabra «vencida» como reproche.
    const pendientes = lista.filter((p) => p.debe_pagarse === true);
    if (!hayAlgo) {
        lineas.push('No encuentro ningún comprobante tuyo reciente por este medio. 🤔');
        lineas.push('Si ya pagaste, mándame la *foto* o el *PDF* del comprobante por aquí. ' +
            'Y le dejo el caso a la escuela para que lo revise contigo.');
    }
    if (pendientes.length) {
        lineas.push('');
        lineas.push(hayAlgo
            ? 'Esto todavía figura pendiente en el sistema:'
            : 'Por ahora el sistema muestra pendiente:');
        for (const p of pendientes.slice(0, 5)) {
            lineas.push(`• ${p.concept}: ${copFmt(Number(p.saldo ?? p.amount ?? 0))}`);
            if (p.enlace_pago) lineas.push(`   Pagar: ${p.enlace_pago}`);
        }
        if (hayAlgo && (enCola.length || enRevision.length)) {
            lineas.push('Si alguno de esos es el que ya pagaste, queda al día apenas se apruebe el comprobante.');
        }
    }
    return { texto: lineas.join('\n').trim(), hayAlgo };
}

// ─── P9. «Mile, …» y «¿Milena estás por acá?» ───────────────────────────────
//
// 50 de 200 textos (25 %) nombran a alguien. «¿Milena estás por acá?» → el
// modelo PREGUNTÓ si escalar (el prompt decía escalar de una); «Mile, puedes ir
// a comunicación…» → «Lo siento, solo puedo ayudar con…».

/** Vocativos que no son de nadie en particular pero son de la escuela. */
export const VOCATIVOS_GENERICOS = ['profe', 'profesora', 'profesor', 'entrenador', 'entrenadora', 'coach', 'sra', 'senora', 'senor'];

const PIDE_PERSONA: RegExp[] = [
    /\b(estas|esta|estan) (por )?(aca|aqui|ahi|alli|disponible)\b/,
    /\b(hablar|comunicarme|comunicar|charlar) con (alguien|una persona|un humano|un asesor|una asesora|la escuela|el profe|la profe|la duena|la administradora|el administrador|la directora|el director)\b/,
    /\b(me (comunicas|pasas|comunica|pasa) con)\b/,
    /\b(una persona|un humano|persona real|asesor humano)\b/,
    /\bnecesito (hablar|que me llame|una llamada)\b/,
    /\b(me puede|me puedes|pueden) llamar\b/,
];

/** Señales de trámite concreto: con alguna de estas, el vocativo es solo un saludo y el bot sí atiende. */
const TRAMITE: RegExp[] = [
    /\b(pagos?|pague|pagar|debo|deuda|mensualidad(es)?|saldo|cobros?|comprobantes?|soportes?|transferencias?|consignacion|nequi|daviplata|llave|cuenta|link|enlace|factura)\b/,
    /\b(horarios?|clases?|entrenamientos?|entreno|sede|cortesia|prueba|inscrip\w*|matricul\w*|cupos?|categorias?)\b/,
    /\b(cuanto|cuando|donde|a que hora)\b/,
];

const NO_VOCATIVO_ANTES = new Set([
    'el', 'la', 'los', 'las', 'al', 'del', 'un', 'una', 'de', 'a', 'con', 'para', 'por', 'tu', 'su', 'sus', 'que',
]);

export type PedidoDePersona =
    | { tipo: 'escalar' }
    | { tipo: 'vocativo'; nombre: string };

/**
 * Nombres del equipo con los que escriben las familias: nombre de pila, el
 * diminutivo de cuatro letras («Milena» → «mile») y el -ita («milenita»).
 */
export function vocativosDelEquipo(nombresCompletos: (string | null | undefined)[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const completo of nombresCompletos) {
        const pila = normalizarFrase(completo).split(' ')[0];
        if (!pila || pila.length < 3) continue;
        const visible = (completo || '').trim().split(/\s+/)[0];
        m.set(pila, visible);
        if (pila.length >= 5) m.set(pila.slice(0, 4), visible);
        if (/[ao]$/.test(pila)) m.set(pila.slice(0, -1) + (pila.endsWith('a') ? 'ita' : 'ito'), visible);
    }
    return m;
}

/**
 * ¿Le está hablando a una persona del equipo, sin un trámite que el bot pueda
 * atender? (`vocativo`) ¿O pide una persona? (`escalar`)
 *
 * El vocativo se busca al PRINCIPIO o al FINAL del mensaje («Mile, …», «…,
 * Milena»): en el medio casi siempre es un relato («le dije a Milena que…»).
 */
export function pideALaPersona(
    texto: string | null | undefined,
    equipo: Map<string, string> = new Map(),
): PedidoDePersona | null {
    const t = normalizarFrase(texto);
    if (!t) return null;
    if (PIDE_PERSONA.some((re) => re.test(t))) return { tipo: 'escalar' };

    const palabras = t.split(' ');
    // La última palabra cuenta como vocativo solo si no va con artículo o
    // preposición: «¿quién es el entrenador?» habla DE alguien, no LE habla.
    const penultima = palabras[palabras.length - 2];
    const ultimaEsVocativo = palabras.length === 1 || !NO_VOCATIVO_ANTES.has(penultima);
    const extremos = [palabras[0], ultimaEsVocativo ? palabras[palabras.length - 1] : '']
        .filter(Boolean) as string[];
    // «Hola Milena», «Buen día Mile», «Mi querida Mile»: el saludo empuja el
    // nombre a la segunda o tercera palabra.
    const sinSaludo = t.replace(/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|mi querida|querida|mi|sra|senora)\s+/, '')
        .replace(/^(hola|buen dia|buenos dias|buenas tardes|buenas noches)\s+/, '');
    const primeraTrasSaludo = sinSaludo.split(' ')[0];

    let nombre: string | null = null;
    for (const w of [...extremos, primeraTrasSaludo]) {
        if (equipo.has(w)) { nombre = equipo.get(w)!; break; }
        if (VOCATIVOS_GENERICOS.includes(w)) { nombre = w === 'profe' || w.startsWith('profes') ? 'la profe' : 'la escuela'; break; }
    }
    if (!nombre) return null;
    if (TRAMITE.some((re) => re.test(t))) return null;
    return { tipo: 'vocativo', nombre };
}

// ─── P13. «Gracias», «Ok», «👍» ─────────────────────────────────────────────
//
// 91 de 200 textos tienen ≤ 20 caracteres («Vale», «Ok», «?», «Si ??», «👆»).
// Responder «¡De nada! 😊 Si necesitas consultar algún pago…» a cada cierre es
// ruido, y en un canal donde Meta mide la calidad del número, ruido caro.

const CIERRES = new Set([
    'gracias', 'muchas gracias', 'mil gracias', 'gracias mil', 'ok', 'okey', 'okay', 'oki', 'vale', 'listo',
    'perfecto', 'super', 'genial', 'dale', 'bueno', 'buenisimo', 'entendido', 'de acuerdo', 'ok gracias',
    'listo gracias', 'vale gracias', 'perfecto gracias', 'gracias igualmente', 'igualmente', 'bendiciones',
    'que dios te bendiga', 'feliz dia', 'feliz tarde', 'feliz noche', 'chao', 'bye', 'gracias profe',
    'ok muchas gracias', 'listo muchas gracias', 'super gracias', 'gracias a ti', 'a ti',
]);

/** Apelativos de cariño que acompañan un cierre («Vale querida», «Gracias linda»). */
const CARINOS = new Set(['querida', 'querido', 'linda', 'lindo', 'hermosa', 'bella', 'reina', 'mija', 'amiga', 'amigo']);

/**
 * `equipo`: los vocativos de la escuela (`vocativosDeEscuela`, claves
 * normalizadas: «mile», «milena»). «Gracias Mile» y «Listo mile gracias»
 * son cierres con el nombre de quien atiende (Dynasty, 2026-10-06); sin el
 * nombre, el P9 los leía como recado para Milena.
 */
export function esCierreSuelto(
    texto: string | null | undefined,
    equipo: ReadonlyMap<string, string> | ReadonlySet<string> = new Map(),
): boolean {
    const crudo = (texto || '').trim();
    if (!crudo) return false;
    // Solo emojis o signos («👍», «🙏🏻», «👆», «!!»): no hay nada que contestar.
    if (!/[\p{L}\p{N}]/u.test(crudo)) return !crudo.includes('?');
    if (crudo.includes('?')) return false;
    const t = normalizarFrase(crudo);
    if (CIERRES.has(t)) return true;
    const resto = t.split(' ')
        .filter((w) => !equipo.has(w) && !VOCATIVOS_GENERICOS.includes(w) && !CARINOS.has(w))
        .join(' ');
    return resto !== t && CIERRES.has(resto);
}

// ─── P14. Auto-respuestas de otros negocios ─────────────────────────────────
//
// `c59de2` (una familia con negocio): «¡Hola! 👋 Gracias por escribir a Play
// Kids… fuera de horario». Si el bot le contesta, la otra auto-respuesta le
// contesta al bot y quedan dos máquinas hablándose.

const AUTO_RESPUESTA: RegExp[] = [
    /\bgracias por (comunicarte|comunicarse|escribir|escribirnos|contactar|contactarnos|tu mensaje|su mensaje)\b/,
    /\b(respuesta|mensaje) automatic[oa]\b/,
    /\bfuera (de|del) (nuestro )?horario\b/,
    /\bnuestro horario de atencion\b/,
    /\b(te|le) (responderemos|contestaremos|atenderemos) (lo antes posible|a la brevedad|pronto|en breve)\b/,
    /\ben este momento no (podemos|estamos|me encuentro)\b/,
    /\bno estoy disponible en este momento\b/,
];

export function esAutoRespuesta(texto: string | null | undefined): boolean {
    const t = normalizarFrase(texto);
    if (!t || t.split(' ').length < 4) return false;
    return AUTO_RESPUESTA.some((re) => re.test(t));
}

// ─── P10. Respuesta sin modelo cuando el modelo falla ───────────────────────

export type RutaSinModelo = 'pagos' | 'medios' | 'menu';

/** Si el modelo no responde, ¿por cuál camino determinista va el mensaje? */
export function rutaSinModelo(texto: string | null | undefined): RutaSinModelo {
    const t = normalizarFrase(texto);
    if (/\b(como (pago|pagar|le pago|te pago)|a que cuenta|numero de cuenta|cuenta para|nequi|daviplata|llave|bre b|qr|link (de|para) pag\w*|medios de pago|donde (pago|consigno|transfiero))\b/.test(t)) return 'medios';
    if (/\b(cuanto (debo|es|vale|cuesta)|debo|deuda|saldo|pendiente|mensualidad|mis pagos|estado de cuenta|cobro|valor)\b/.test(t)) return 'pagos';
    return 'menu';
}

// ─── Estado reciente de la conversación ─────────────────────────────────────

export interface FilaReciente {
    wa_message_id?: string | null;
    direction: string;
    type?: string | null;
    text_body?: string | null;
    payload?: any;
    ai_generated?: boolean | null;
    wa_timestamp?: string | null;
    created_at?: string | null;
}

const momento = (f: FilaReciente) => new Date(f.wa_timestamp || f.created_at || 0).getTime();
const esAutomaticoDeApp = (f: FilaReciente) =>
    f.payload?.automatico === true || f.payload?.automatico === 'true';
const pasoDe = (f: FilaReciente) => (f.payload?.step ?? null) as string | null;

/**
 * P4: ¿escribió una PERSONA de la escuela en los últimos `minutos`? Saliente con
 * `ai_generated=false` que no sea un automático de WhatsApp Business: echo de
 * Coexistence (Milena desde su celular) o respuesta del buzón.
 *
 * Medido el 06-oct: en 6 de 10 conversaciones Milena escribía mientras el bot
 * respondía (20 salientes humanos contra 49 del bot); en `8f9e500b` el bot
 * mandó 5 estados de pago encima de ella y contradijo lo que acordaron.
 */
export function humanoReciente(filas: FilaReciente[], minutos: number, ahora = Date.now()): boolean {
    const desde = ahora - minutos * 60_000;
    return filas.some((f) => f.direction === 'outbound'
        && f.ai_generated === false
        && !esAutomaticoDeApp(f)
        && momento(f) >= desde);
}

const PASOS_DE_CONSENTIMIENTO = new Set([
    'ask_consent', 'opt_in_registrado', 'consent_rechazado', 'opt_in_reactivado', 'opt_out_confirmado',
    'confirmar_baja', 'baja_mantenida',
]);

/**
 * P2: ¿la última pregunta del bot fue la del consentimiento y sigue sin
 * respuesta? Solo entonces un «sí» se lee como «acepto los recordatorios».
 *
 * Se cierra con la respuesta (sí/no) y TAMBIÉN con cualquier otro saliente
 * del bot posterior: si después de preguntar el bot contestó otra cosa, un «sí»
 * que llegue es respuesta a eso otro, no al consentimiento.
 */
export function preguntaAbierta(filas: FilaReciente[], paso: string): boolean {
    const salientesBot = filas
        .filter((f) => f.direction === 'outbound' && f.ai_generated !== false && !esAutomaticoDeApp(f) && pasoDe(f))
        .sort((a, b) => momento(b) - momento(a));
    const ultimo = salientesBot[0];
    // `payload.pregunta`: la pregunta viaja DENTRO de otra respuesta (el
    // consentimiento al pie del estado de pagos o del resultado de un
    // comprobante, 2026-10-07) y el paso del mensaje es el de la respuesta.
    return !!ultimo && (pasoDe(ultimo) === paso || ultimo.payload?.pregunta === paso);
}

/**
 * Pasos que ya le dijeron a la familia «todavía no tienes tu cuenta»: el aviso
 * del bot (`debe_registrarse`) y la respuesta de la cola a un comprobante
 * (`familia_sin_cuenta`). Uno solo cada 24 h por conversación, venga de donde
 * venga (…8804c0, 07-oct: los dos en 17 s).
 */
export const PASOS_SIN_CUENTA = ['debe_registrarse', 'familia_sin_cuenta'];

/** ¿Salió (o quedó registrado) este paso en los últimos `ms`? */
export function pasoEnVentana(filas: FilaReciente[], paso: string, ms: number, ahora = Date.now()): FilaReciente | null {
    const desde = ahora - ms;
    const encontrados = filas
        .filter((f) => f.direction === 'outbound' && pasoDe(f) === paso && momento(f) >= desde)
        .sort((a, b) => momento(b) - momento(a));
    return encontrados[0] ?? null;
}

export { PASOS_DE_CONSENTIMIENTO };

// ─── Notas de voz (spec docs/specs/whatsapp-notas-de-voz.md, F1) ─────────────

/** Más de esto no se le pasa al bot: va al buzón con la transcripción (D3). */
export const AUDIO_MAX_SEGUNDOS_BOT = 120;
const ECO_MAX_CARACTERES = 120;
const VENTANA_ECO_MS = 3 * 60_000;

/**
 * Frases que Whisper «oye» en audios vacíos o de puro ruido (alucinaciones
 * conocidas en español: vienen de los subtítulos con los que se entrenó).
 */
const ALUCINACIONES_WHISPER = [
    /subtitulos? (realizados|hechos|creados) por/,
    /amara org/,
    /gracias por ver( el video)?$/,
    /suscribete/,
    /^(musica|aplausos|risas)$/,
];

/**
 * ¿La transcripción es ruido o nada? Vacía, alucinación conocida, o el modelo
 * dice que no hubo voz (`no_speech_prob` alto). Una sola palabra NO es ruido
 * por sí sola («Sí», «Gracias»): solo si además la probabilidad de no-voz es
 * dudosa.
 */
export function esRuidoDeTranscripcion(texto: string | null | undefined, noSpeechProb: number | null | undefined): boolean {
    const norm = normalizarFrase(texto);
    if (!norm || !/[a-z]/.test(norm)) return true;
    if (ALUCINACIONES_WHISPER.some((re) => re.test(norm))) return true;
    const p = typeof noSpeechProb === 'number' ? noSpeechProb : 0;
    if (p > 0.6) return true;
    return norm.split(' ').length < 2 && p > 0.3;
}

/** La transcripción de esta fila se le pasó al bot (no fue larga, ni ruido, ni error). */
export function esAudioTranscritoParaBot(f: FilaReciente): boolean {
    return f.direction === 'inbound' && f.type === 'audio'
        && f.payload?.transcripcion?.al_bot === true && !!(f.text_body || '').trim();
}

/**
 * El eco «🎤 Entendí: «…»» del turno: las notas de voz transcritas de la ráfaga
 * (la actual, más las que llegaron desde la última respuesta, ≤ 3 min). Le
 * muestra a la familia qué entendió el bot y la deja corregir (D2). `null` si
 * en la ráfaga no hay audio transcrito.
 */
export function ecoDeAudios(filas: FilaReciente[], waMessageIdActual: string | null, ahora = Date.now()): string | null {
    const ultimoSaliente = Math.max(0, ...filas.filter((f) => f.direction === 'outbound').map(momento));
    const desde = Math.max(ultimoSaliente, ahora - VENTANA_ECO_MS);
    const audios = filas
        .filter(esAudioTranscritoParaBot)
        .filter((f) => (waMessageIdActual && f.wa_message_id === waMessageIdActual) || momento(f) > desde)
        .sort((a, b) => momento(a) - momento(b))
        .map((f) => (f.text_body || '').trim().replace(/\s+/g, ' '));
    if (!audios.length) return null;
    let texto = audios.join(' … ');
    if (texto.length > ECO_MAX_CARACTERES) texto = texto.slice(0, ECO_MAX_CARACTERES).trimEnd() + '…';
    return `🎤 Entendí: «${texto}»`;
}
