/**
 * whatsapp-factura.service — captura DETERMINISTA (sin LLM) de la preferencia
 * de factura electrónica y de los datos del pagador por WhatsApp.
 * Spec: docs/specs/factura-electronica-preferencia-y-datos-del-pagador.md §5
 *
 * Por qué sin modelo: un número de documento mal leído no se descubre hasta
 * que la DIAN rechaza la factura, y una factura rechazada quema un número de
 * la resolución. Cada dato se pide solo, se valida con las MISMAS reglas que
 * el formulario y la base, y al final se confirma el resumen con botones.
 *
 * Flujo:
 *   preguntar_quiere ─ No ─→ guarda 'no_quiere' y cierra
 *        │ Sí
 *   elegir_canal ─ Formulario ─→ manda /p/<token>#factura y cierra
 *        │ Por aquí            (si no hay enlace, se salta este paso)
 *   tipo_documento → numero → nombre → correo → confirmar ─ Correcto ─→ guarda 'quiere'
 *                                                        └ Corregir ─→ tipo_documento
 *
 * El estado vive en `whatsapp_conversation_flows` (una fila por conversación)
 * para sobrevivir entre mensajes, y vence a las 24 h — la misma ventana de
 * atención de Meta: pasado eso, la familia ya no recuerda qué se le preguntó.
 *
 * Quién entra: SOLO el contacto que el bot ya atiende como familia — con
 * cuenta (conversación identificada, dueño = su perfil) o sin cuenta
 * (wa_identify_by_phone = 'debe_registrarse', dueño = escuela + celular). Al
 * desconocido, al staff y al ambiguo nunca se les piden datos. Y al que no
 * tiene cuenta nunca se le MUESTRA nada guardado: solo se le repite lo que él
 * mismo escribió en este flujo.
 */

import { supabase } from '../config/supabase';
import type { BotonInteractivo } from './whatsapp.service';
import { emitirTokenCobro } from './cobro-enlace-publico.service';
import { appPublica, enlaceDeCobro } from '../utils/url-publica-familias';
import {
    type DuenoFactura, type TipoDocumento, type FilaFactura,
    normalizarDocumento, errorDeDocumento, correoValido,
    normalizarNombre, nombreValido, guardarParaDueno, filaDe, escuelaFacturaElectronicamente,
    MENSAJE_ERROR, enmascararCorreo,
} from './factura-pagador.service';

export const FLUJO_FACTURA = 'factura_electronica';
export const VIGENCIA_FLUJO_MS = 24 * 60 * 60 * 1000;
/** Intentos inválidos seguidos en un mismo paso antes de ofrecer el formulario. */
export const MAX_INTENTOS = 3;

export type PasoFactura =
    | 'preguntar_quiere' | 'elegir_canal' | 'tipo_documento' | 'numero'
    | 'nombre' | 'correo' | 'confirmar';

export interface DatosFlujo {
    tipo?: TipoDocumento;
    numero?: string;
    nombre?: string;
    correo?: string | null;
    intentos?: number;
    /** Ya mostró "elige el tipo" con la lista larga (tocó «Otro»). */
    otroTipo?: boolean;
}

export interface FlujoGuardado {
    step: PasoFactura;
    data: DatosFlujo;
    expires_at: string;
}

// Los ids son el contrato con el webhook (button_reply.id). Títulos ≤ 20.
export const BOTON_FE = {
    SI: 'sm_fe_si',
    NO: 'sm_fe_no',
    AQUI: 'sm_fe_aqui',
    FORMULARIO: 'sm_fe_form',
    CC: 'sm_fe_cc',
    NIT: 'sm_fe_nit',
    OTRO: 'sm_fe_otro',
    CORRECTO: 'sm_fe_ok',
    CORREGIR: 'sm_fe_corregir',
    QUIERO_FACTURA: 'sm_fe_quiero',
} as const;

export const BOTONES_QUIERE: BotonInteractivo[] = [
    { id: BOTON_FE.SI, title: 'Sí, quiero factura' },
    { id: BOTON_FE.NO, title: 'No, gracias' },
];
export const BOTONES_CANAL: BotonInteractivo[] = [
    { id: BOTON_FE.AQUI, title: 'Por aquí' },
    { id: BOTON_FE.FORMULARIO, title: 'Por formulario' },
];
export const BOTONES_TIPO: BotonInteractivo[] = [
    { id: BOTON_FE.CC, title: 'Cédula (CC)' },
    { id: BOTON_FE.NIT, title: 'NIT (empresa)' },
    { id: BOTON_FE.OTRO, title: 'Otro documento' },
];
export const BOTONES_CONFIRMAR: BotonInteractivo[] = [
    { id: BOTON_FE.CORRECTO, title: 'Correcto' },
    { id: BOTON_FE.CORREGIR, title: 'Corregir' },
];
/** Para ofrecer la factura después de confirmar un pago (lo usa la cola). */
export const BOTONES_OFERTA_TRAS_PAGO: BotonInteractivo[] = [
    { id: BOTON_FE.QUIERO_FACTURA, title: 'Quiero factura' },
];

// ─── Texto (puro) ──────────────────────────────────────────────────────────

/** Minúsculas, sin tildes, sin puntuación; igual que `normalizar` del bot. */
export function normalizarTexto(t: string | null | undefined): string {
    return String(t ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9@._ -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * ¿Pide factura? «factura», «factura electrónica», «necesito factura»,
 * «me pueden facturar». Por PALABRA, no por subcadena de otra cosa. No
 * dispara con «no quiero factura» — eso se responde como un No, sin abrir
 * el formulario.
 */
export function esIntencionFactura(texto: string | null | undefined): boolean {
    const n = normalizarTexto(texto);
    return /\b(factura|facturas|facturar|facturacion|facturame|facturen)\b/.test(n);
}
export function noQuiereFactura(texto: string | null | undefined): boolean {
    return /\bno (quiero|necesito|requiero) (la )?factura/.test(normalizarTexto(texto));
}

const SI = new Set(['si', 'sí', 's', 'claro', 'dale', 'ok', 'listo', 'si quiero', 'si quiero factura', 'si por favor', 'correcto', 'esta bien', 'si esta bien']);
const NO = new Set(['no', 'n', 'no gracias', 'no quiero', 'no la necesito', 'no necesito']);

/** Respuesta a una pregunta de sí/no, por botón o escrita (modo asistido manda texto). */
export function respuestaSiNo(texto: string, botonId: string | null): 'si' | 'no' | null {
    if (botonId === BOTON_FE.SI || botonId === BOTON_FE.QUIERO_FACTURA) return 'si';
    if (botonId === BOTON_FE.NO) return 'no';
    const n = normalizarTexto(texto);
    if (BOTONES_QUIERE.some((b) => normalizarTexto(b.title) === n) && n.startsWith('si')) return 'si';
    if (normalizarTexto(BOTONES_QUIERE[1].title) === n) return 'no';
    if (SI.has(n)) return 'si';
    if (NO.has(n) || noQuiereFactura(texto)) return 'no';
    return null;
}

/**
 * En los pasos de botones (sí/no, canal), un mensaje largo o con pregunta no
 * es una respuesta: es otra conversación («¿cuánto debo?»). Se suelta el
 * flujo para que lo atienda el bot normal en vez de insistir con los botones.
 */
export function pareceOtraConversacion(texto: string): boolean {
    const t = (texto || '').trim();
    return t.includes('?') || t.split(/\s+/).filter(Boolean).length > 4;
}

export function quiereCancelar(texto: string): boolean {
    return ['cancelar', 'salir', 'cancela', 'ya no', 'dejalo asi', 'olvidalo'].includes(normalizarTexto(texto));
}

/** Tipo de documento por botón o escrito («cc», «cédula», «nit», «pasaporte»…). */
export function tipoDesdeRespuesta(texto: string, botonId: string | null): TipoDocumento | 'otro' | null {
    if (botonId === BOTON_FE.CC) return 'CC';
    if (botonId === BOTON_FE.NIT) return 'NIT';
    if (botonId === BOTON_FE.OTRO) return 'otro';
    const n = normalizarTexto(texto).replace(/[().]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n) return null;
    if (/^(cc|cedula|cedula de ciudadania|cedula cc|c c)$/.test(n)) return 'CC';
    if (/^(nit|nit empresa|empresa)$/.test(n)) return 'NIT';
    if (/^(ce|cedula de extranjeria|extranjeria|c e)$/.test(n)) return 'CE';
    if (/^(pasaporte|pas|pa|pp)$/.test(n)) return 'PASAPORTE';
    if (/^(ti|tarjeta de identidad|t i)$/.test(n)) return 'TI';
    if (/^(rc|registro civil|r c)$/.test(n)) return 'RC';
    if (/^otro( documento)?$/.test(n)) return 'otro';
    return null;
}

const NOMBRE_TIPO: Record<TipoDocumento, string> = {
    CC: 'cédula de ciudadanía', CE: 'cédula de extranjería', NIT: 'NIT',
    PASAPORTE: 'pasaporte', TI: 'tarjeta de identidad', RC: 'registro civil',
};

export function textoResumen(d: DatosFlujo): string {
    return 'Revisa que esté todo bien:\n\n' +
        `• Documento: *${d.tipo ? NOMBRE_TIPO[d.tipo] : ''} ${d.numero ?? ''}*\n` +
        `• A nombre de: *${d.nombre ?? ''}*\n` +
        `• Correo: *${d.correo ?? 'sin correo'}*\n\n` +
        '¿Está correcto?';
}

const PREGUNTA_QUIERE =
    '¿Quieres que la escuela te emita *factura electrónica* a tu nombre por tus pagos? 🧾';
const PREGUNTA_TIPO =
    '¿Con qué documento sale la factura? Si es para una empresa, elige *NIT*.';
const PREGUNTA_TIPO_OTRO =
    'Escríbeme cuál es: *CE* (cédula de extranjería), *PASAPORTE*, *TI* (tarjeta de identidad) o *RC* (registro civil).';

function preguntaNumero(tipo: TipoDocumento): string {
    return tipo === 'NIT'
        ? 'Escríbeme el *NIT* sin el dígito de verificación (por ejemplo 901929705).'
        : `Escríbeme el número de la *${NOMBRE_TIPO[tipo]}*, sin puntos.`;
}
function preguntaNombre(tipo: TipoDocumento): string {
    return tipo === 'NIT'
        ? '¿Cuál es la *razón social* de la empresa, tal como aparece en el RUT?'
        : '¿A nombre de quién sale la factura? Escríbeme el *nombre completo* como aparece en el documento.';
}
const PREGUNTA_CORREO =
    '¿A qué *correo* te llega la factura? Si no tienes, escríbeme *no tengo*.';

// ─── Persistencia del flujo ────────────────────────────────────────────────

export interface AlmacenFlujo {
    leer(conversationId: string): Promise<FlujoGuardado | null>;
    guardar(conversationId: string, step: PasoFactura, data: DatosFlujo): Promise<boolean>;
    borrar(conversationId: string): Promise<void>;
}

export const almacenSupabase: AlmacenFlujo = {
    async leer(conversationId) {
        try {
            const { data, error } = await supabase.from('whatsapp_conversation_flows')
                .select('step, data, expires_at, flow')
                .eq('conversation_id', conversationId).maybeSingle();
            if (error || !data || (data as any).flow !== FLUJO_FACTURA) return null;
            return data as FlujoGuardado;
        } catch {
            return null;
        }
    },
    async guardar(conversationId, step, data) {
        try {
            const ahora = new Date();
            const { error } = await supabase.from('whatsapp_conversation_flows').upsert({
                conversation_id: conversationId,
                flow: FLUJO_FACTURA,
                step,
                data,
                expires_at: new Date(ahora.getTime() + VIGENCIA_FLUJO_MS).toISOString(),
                updated_at: ahora.toISOString(),
            }, { onConflict: 'conversation_id' });
            return !error;
        } catch {
            return false;
        }
    },
    async borrar(conversationId) {
        try {
            await supabase.from('whatsapp_conversation_flows').delete().eq('conversation_id', conversationId);
        } catch { /* sin tabla: no hay nada que borrar */ }
    },
};

// ─── Contexto inyectable (pruebas) ─────────────────────────────────────────

export interface CtxFactura {
    conversationId: string;
    schoolId: string;
    dueno: DuenoFactura;
    /** true = identificado con cuenta: se le puede mostrar lo que ya guardó (enmascarado). */
    conCuenta: boolean;
    enviar: (texto: string, paso: string, botones?: BotonInteractivo[]) => Promise<void>;
    /** Enlace /p/<token>#factura de un cobro de este pagador, o null. */
    enlaceFormulario: () => Promise<string | null>;
    almacen?: AlmacenFlujo;
    ahora?: () => Date;
    /** Inyectables para pruebas; por defecto los del servicio. */
    guardar?: typeof guardarParaDueno;
    leerFila?: typeof filaDe;
    escuelaFactura?: typeof escuelaFacturaElectronicamente;
}

function esBotonFactura(id: string | null): boolean {
    return !!id && id.startsWith('sm_fe_');
}

/**
 * Un turno del bot. true = este módulo lo resolvió (el bot no sigue con el
 * modelo). false = no era para acá.
 */
export async function atenderTurnoFactura(ctx: CtxFactura, textoCrudo: string, botonId: string | null): Promise<boolean> {
    const almacen = ctx.almacen ?? almacenSupabase;
    const ahora = (ctx.ahora ?? (() => new Date()))();
    const texto = (textoCrudo || '').trim();

    let flujo = await almacen.leer(ctx.conversationId);
    if (flujo && new Date(flujo.expires_at).getTime() <= ahora.getTime()) {
        // Vencido: se descarta en silencio. Si este mensaje vuelve a pedir
        // factura, arranca de cero abajo.
        await almacen.borrar(ctx.conversationId);
        flujo = null;
    }

    if (!flujo) {
        if (!esBotonFactura(botonId) && !esIntencionFactura(texto)) return false;
        return iniciar(ctx, almacen, texto, botonId);
    }

    // Con flujo abierto, un botón de OTRA cosa («Ver mis pagos») es una
    // elección explícita: se cierra el flujo y que lo atienda quien sabe.
    if (botonId && !esBotonFactura(botonId)) {
        await almacen.borrar(ctx.conversationId);
        return false;
    }
    if (quiereCancelar(texto)) {
        await almacen.borrar(ctx.conversationId);
        await ctx.enviar('Listo, lo dejamos así. Si la necesitas después, escríbeme *factura*.', 'factura_cancelada');
        return true;
    }
    return continuar(ctx, almacen, flujo, texto, botonId);
}

async function iniciar(ctx: CtxFactura, almacen: AlmacenFlujo, texto: string, botonId: string | null): Promise<boolean> {
    const escuelaFactura = ctx.escuelaFactura ?? escuelaFacturaElectronicamente;
    if (!(await escuelaFactura(ctx.schoolId))) {
        await ctx.enviar(
            'La escuela todavía no emite factura electrónica por este medio. Si la necesitas, ' +
            'escríbele a la escuela y te la gestionan directamente. 🙏',
            'factura_no_disponible');
        return true;
    }

    // «No quiero factura» de entrada: se registra sin preguntar nada más.
    if (noQuiereFactura(texto) || botonId === BOTON_FE.NO) {
        return guardarNoQuiere(ctx, almacen);
    }

    // Botón «Quiero factura» (oferta tras un pago) o «Sí»: directo al canal.
    if (botonId === BOTON_FE.SI || botonId === BOTON_FE.QUIERO_FACTURA) {
        return pasarACanal(ctx, almacen);
    }

    // Con cuenta y datos ya guardados: se le dice qué hay (enmascarado) antes
    // de volver a pedirlo todo. Al que no tiene cuenta NUNCA se le muestra
    // nada guardado: quien tenga hoy ese número no es necesariamente el
    // acudiente.
    let previo = '';
    if (ctx.conCuenta) {
        const fila: FilaFactura | null = await (ctx.leerFila ?? filaDe)(ctx.dueno);
        if (fila?.preference === 'quiere' && fila.document_number) {
            const correo = enmascararCorreo(fila.invoice_email);
            previo = `Hoy tu factura sale con documento terminado en *${fila.document_number.slice(-4)}*` +
                (correo ? ` y llega a *${correo}*` : '') + '.\n\n' +
                'Si quieres cambiar esos datos, toca *Sí, quiero factura* y te los pido de nuevo.\n\n';
        }
    }

    if (!(await almacen.guardar(ctx.conversationId, 'preguntar_quiere', {}))) {
        return sinAlmacen(ctx);
    }
    await ctx.enviar(previo + PREGUNTA_QUIERE, 'factura_preguntar_quiere', BOTONES_QUIERE);
    return true;
}

async function sinAlmacen(ctx: CtxFactura): Promise<boolean> {
    // Sin tabla de flujos (migración sin aplicar) el paso a paso no puede
    // recordar nada; queda el formulario, que no depende de esto.
    const enlace = await ctx.enlaceFormulario();
    await ctx.enviar(enlace
        ? `Para tu factura electrónica, completa tus datos aquí: ${enlace}`
        : 'Para tu factura electrónica, escríbele a la escuela y te ayudan con tus datos. 🙏',
    'factura_sin_flujo');
    return true;
}

async function guardarNoQuiere(ctx: CtxFactura, almacen: AlmacenFlujo): Promise<boolean> {
    await almacen.borrar(ctx.conversationId);
    const r = await (ctx.guardar ?? guardarParaDueno)(ctx.dueno, { preferencia: 'no_quiere' }, 'whatsapp');
    await ctx.enviar(r.ok
        ? 'Listo, no te pediré datos de factura. Si cambias de opinión, escríbeme *factura*.'
        : MENSAJE_ERROR[r.error] ?? MENSAJE_ERROR.no_disponible,
    r.ok ? 'factura_no_quiere' : 'factura_error_guardar');
    return true;
}

async function pasarACanal(ctx: CtxFactura, almacen: AlmacenFlujo): Promise<boolean> {
    const enlace = await ctx.enlaceFormulario();
    if (enlace) {
        if (!(await almacen.guardar(ctx.conversationId, 'elegir_canal', {}))) return sinAlmacen(ctx);
        await ctx.enviar(
            'Perfecto. ¿Me das los datos *por aquí* (son 4 preguntas cortas) o prefieres llenar un *formulario*?',
            'factura_elegir_canal', BOTONES_CANAL);
        return true;
    }
    if (!(await almacen.guardar(ctx.conversationId, 'tipo_documento', {}))) return sinAlmacen(ctx);
    await ctx.enviar(`Perfecto, son 4 preguntas cortas. ${PREGUNTA_TIPO}`, 'factura_tipo_documento', BOTONES_TIPO);
    return true;
}

/** Repite la pregunta del paso; a los MAX_INTENTOS cierra y ofrece el formulario. */
async function reintentar(
    ctx: CtxFactura, almacen: AlmacenFlujo, paso: PasoFactura, data: DatosFlujo,
    mensaje: string, botones?: BotonInteractivo[],
): Promise<boolean> {
    const intentos = (data.intentos ?? 0) + 1;
    if (intentos >= MAX_INTENTOS) {
        await almacen.borrar(ctx.conversationId);
        const enlace = await ctx.enlaceFormulario();
        await ctx.enviar(
            'Parece que no nos estamos entendiendo. 😅 ' + (enlace
                ? `Puedes completar tus datos de factura aquí: ${enlace}`
                : 'Escríbeme *factura* cuando quieras intentarlo de nuevo, o escríbele a la escuela.'),
            'factura_demasiados_intentos');
        return true;
    }
    await almacen.guardar(ctx.conversationId, paso, { ...data, intentos });
    await ctx.enviar(mensaje, `factura_${paso}_reintento`, botones);
    return true;
}

async function continuar(
    ctx: CtxFactura, almacen: AlmacenFlujo, flujo: FlujoGuardado, texto: string, botonId: string | null,
): Promise<boolean> {
    const d: DatosFlujo = { ...(flujo.data ?? {}) };
    const sinIntentos = (x: DatosFlujo): DatosFlujo => { const { intentos: _i, ...resto } = x; return resto; };

    switch (flujo.step) {
        case 'preguntar_quiere': {
            const r = respuestaSiNo(texto, botonId);
            if (r === 'no') return guardarNoQuiere(ctx, almacen);
            if (r === 'si') return pasarACanal(ctx, almacen);
            if (pareceOtraConversacion(texto)) { await almacen.borrar(ctx.conversationId); return false; }
            return reintentar(ctx, almacen, 'preguntar_quiere', d,
                'Toca *Sí, quiero factura* o *No, gracias*.', BOTONES_QUIERE);
        }

        case 'elegir_canal': {
            const n = normalizarTexto(texto);
            const formulario = botonId === BOTON_FE.FORMULARIO || /formulario|enlace|link/.test(n);
            const aqui = botonId === BOTON_FE.AQUI || /^(por )?aqui$|^por aca$|^aca$/.test(n);
            if (formulario) {
                await almacen.borrar(ctx.conversationId);
                const enlace = await ctx.enlaceFormulario();
                await ctx.enviar(enlace
                    ? `Aquí está el formulario; tus datos quedan guardados para las próximas facturas: ${enlace}`
                    : 'No pude generar el formulario en este momento. Escríbeme *factura* y te los pido por aquí.',
                'factura_formulario_enviado');
                return true;
            }
            if (aqui) {
                await almacen.guardar(ctx.conversationId, 'tipo_documento', {});
                await ctx.enviar(PREGUNTA_TIPO, 'factura_tipo_documento', BOTONES_TIPO);
                return true;
            }
            if (pareceOtraConversacion(texto)) { await almacen.borrar(ctx.conversationId); return false; }
            return reintentar(ctx, almacen, 'elegir_canal', d,
                'Toca *Por aquí* o *Por formulario*.', BOTONES_CANAL);
        }

        case 'tipo_documento': {
            const t = tipoDesdeRespuesta(texto, botonId);
            if (t === 'otro') {
                await almacen.guardar(ctx.conversationId, 'tipo_documento', { ...sinIntentos(d), otroTipo: true });
                await ctx.enviar(PREGUNTA_TIPO_OTRO, 'factura_tipo_documento_otro');
                return true;
            }
            if (!t) {
                return reintentar(ctx, almacen, 'tipo_documento', d,
                    d.otroTipo ? PREGUNTA_TIPO_OTRO : `No reconocí el tipo. ${PREGUNTA_TIPO}`,
                    d.otroTipo ? undefined : BOTONES_TIPO);
            }
            await almacen.guardar(ctx.conversationId, 'numero', { tipo: t });
            await ctx.enviar(preguntaNumero(t), 'factura_numero');
            return true;
        }

        case 'numero': {
            const tipo = d.tipo;
            if (!tipo) {
                await almacen.guardar(ctx.conversationId, 'tipo_documento', {});
                await ctx.enviar(PREGUNTA_TIPO, 'factura_tipo_documento', BOTONES_TIPO);
                return true;
            }
            const numero = normalizarDocumento(tipo, texto);
            const error = errorDeDocumento(tipo, numero);
            if (error) {
                return reintentar(ctx, almacen, 'numero', d, `${error} ${preguntaNumero(tipo)}`);
            }
            await almacen.guardar(ctx.conversationId, 'nombre', { ...sinIntentos(d), numero });
            await ctx.enviar(preguntaNombre(tipo), 'factura_nombre');
            return true;
        }

        case 'nombre': {
            const nombre = normalizarNombre(texto);
            if (!nombreValido(nombre) || /^\d+$/.test(nombre)) {
                return reintentar(ctx, almacen, 'nombre', d,
                    `Necesito el nombre completo (al menos 3 letras). ${preguntaNombre(d.tipo ?? 'CC')}`);
            }
            await almacen.guardar(ctx.conversationId, 'correo', { ...sinIntentos(d), nombre });
            await ctx.enviar(PREGUNTA_CORREO, 'factura_correo');
            return true;
        }

        case 'correo': {
            const n = normalizarTexto(texto);
            let correo: string | null;
            if (/^no (tengo|tengo correo)$|^sin correo$|^ninguno$/.test(n)) {
                correo = null;
            } else {
                const candidato = texto.trim().toLowerCase();
                if (!correoValido(candidato)) {
                    return reintentar(ctx, almacen, 'correo', d,
                        'Ese correo no parece válido (debe verse como nombre@dominio.com). ' + PREGUNTA_CORREO);
                }
                correo = candidato;
            }
            const nuevo = { ...sinIntentos(d), correo };
            await almacen.guardar(ctx.conversationId, 'confirmar', nuevo);
            await ctx.enviar(textoResumen(nuevo), 'factura_confirmar', BOTONES_CONFIRMAR);
            return true;
        }

        case 'confirmar': {
            const n = normalizarTexto(texto);
            const corregir = botonId === BOTON_FE.CORREGIR || n === 'corregir' || n === 'no';
            const correcto = botonId === BOTON_FE.CORRECTO || (!corregir && respuestaSiNo(texto, null) === 'si');
            if (corregir) {
                await almacen.guardar(ctx.conversationId, 'tipo_documento', {});
                await ctx.enviar(`Vamos de nuevo. ${PREGUNTA_TIPO}`, 'factura_tipo_documento', BOTONES_TIPO);
                return true;
            }
            if (!correcto) {
                return reintentar(ctx, almacen, 'confirmar', d,
                    'Toca *Correcto* para guardar o *Corregir* para cambiar algo.', BOTONES_CONFIRMAR);
            }
            const r = await (ctx.guardar ?? guardarParaDueno)(ctx.dueno, {
                preferencia: 'quiere',
                tipoDocumento: d.tipo,
                numeroDocumento: d.numero,
                nombre: d.nombre,
                correo: d.correo ?? null,
            }, 'whatsapp');
            await almacen.borrar(ctx.conversationId);
            if (!r.ok) {
                await ctx.enviar(
                    `${MENSAJE_ERROR[r.error] ?? MENSAJE_ERROR.no_disponible} Escríbeme *factura* para intentarlo de nuevo.`,
                    'factura_error_guardar');
                return true;
            }
            await ctx.enviar(
                '¡Listo! ✅ Guardé tus datos. Tus próximos pagos se facturan a nombre de ' +
                `*${d.nombre}*` + (d.correo ? ` y la factura queda asociada a *${d.correo}*.` : '.'),
                'factura_guardada');
            return true;
        }
    }
    // Paso desconocido (no debería pasar: lo impide el CHECK de la tabla).
    await almacen.borrar(ctx.conversationId);
    return false;
}

/**
 * Oferta después de que el bot confirma un pago. Solo si la escuela factura y
 * el pagador no ha respondido nunca (a quien ya dijo sí o no, no se le vuelve
 * a preguntar). Devuelve el texto y los botones para anexar al mensaje de
 * confirmación, o null. La llama la cola de comprobantes (whatsapp-queue.job),
 * que es de otro módulo: ver spec §5.4.
 */
export async function ofertaTrasPago(p: {
    schoolId: string; dueno: DuenoFactura;
    leerFila?: typeof filaDe; escuelaFactura?: typeof escuelaFacturaElectronicamente;
}): Promise<{ texto: string; botones: BotonInteractivo[] } | null> {
    if (!(await (p.escuelaFactura ?? escuelaFacturaElectronicamente)(p.schoolId))) return null;
    const fila = await (p.leerFila ?? filaDe)(p.dueno);
    if (fila && fila.preference !== 'sin_respuesta') return null;
    return {
        texto: '¿Necesitas *factura electrónica* a tu nombre? Toca el botón y te pido los datos.',
        botones: BOTONES_OFERTA_TRAS_PAGO,
    };
}

// ─── Enlace al formulario ──────────────────────────────────────────────────

/**
 * Enlace /p/<token>#factura de un cobro de este pagador en esta escuela (el
 * más reciente no anulado), para el bot y el correo. null si no hay cobro o
 * no se pudo emitir el token: el que llama ofrece entonces el paso a paso.
 * El token resuelve al MISMO pagador (factura_pagador_de_cobro), así que el
 * formulario guarda donde corresponde.
 */
export async function enlaceFormularioFactura(dueno: DuenoFactura, schoolId: string): Promise<string | null> {
    try {
        let paymentId: string | null = null;
        if (dueno.tipo === 'perfil') {
            const { data } = await supabase.from('payments').select('id')
                .eq('school_id', schoolId)
                .or(`parent_id.eq.${dueno.profileId},user_id.eq.${dueno.profileId}`)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false }).limit(1).maybeSingle();
            paymentId = (data as any)?.id ?? null;
        } else {
            const { data: hijos } = await supabase.from('children').select('id')
                .eq('school_id', schoolId).ilike('parent_phone_temp', `%${dueno.phone10}`).limit(20);
            const ids = ((hijos as any[]) ?? []).map((h) => h.id);
            if (ids.length > 0) {
                const { data } = await supabase.from('payments').select('id')
                    .eq('school_id', schoolId).in('child_id', ids).is('parent_id', null)
                    .neq('status', 'cancelled')
                    .order('created_at', { ascending: false }).limit(1).maybeSingle();
                paymentId = (data as any)?.id ?? null;
            }
        }
        if (!paymentId) return null;
        const token = await emitirTokenCobro(paymentId);
        return token ? `${enlaceDeCobro(appPublica(), token)}#factura` : null;
    } catch {
        return null;
    }
}
