/**
 * whatsapp-clase-cortesia.service — clase de cortesía (de prueba) por WhatsApp:
 * informar, AGENDAR y RESERVAR un cupo real, y cancelarlo. DETERMINISTA: el
 * modelo solo decide que la pregunta es de esto (tool `get_trial_class_info`);
 * los datos, las franjas y la reserva no pasan por el LLM.
 *
 * QUÉ MECÁNICA USA Y POR QUÉ (medido el 2026-10-06):
 * En el código conviven tres cosas que se llaman parecido:
 *   (a) `school_trial_slots` + `school_signup_leads` — cupos puntuales que la
 *       escuela carga y que el prospecto reserva desde /inscripcion/<slug> con
 *       `submit_school_lead` (FOR UPDATE sobre el cupo, dedupe 24 h por
 *       teléfono). Dynasty tiene 2 franjas cargadas y 4 prospectos ahí.
 *   (b) la agenda del owner MOD-28 (`trial_class_*`, cancha × entrenador) —
 *       Dynasty no tiene `school_trial_class_settings`, ni categorías, ni
 *       disponibilidad de canchas/entrenadores: 0 filas para reservar.
 *   (c) `school_courtesy_settings` — la «cortesía» de instalaciones por OTP;
 *       Dynasty no tiene fila.
 * La única con franjas reales de Dynasty es (a), y es la que ya conocen sus
 * prospectos por el formulario. Se reutilizan SUS RPC: `list_open_trial_slots_public`
 * para listar y `submit_school_lead` para reservar (la misma llamada del
 * formulario, con el mismo candado de cupo). No hay una reserva nueva. Lo único
 * que no existía es liberar un cupo: `wa_cancelar_clase_de_prueba`
 * (migración 20261006082002, solo service_role). Mientras no esté aplicada,
 * «cancelar mi clase» se le pide a la escuela y no se toca el contador.
 *
 * ESTADO DEL PASO A PASO: `whatsapp_conversation_flows` (de factura
 * electrónica, mig. 20261005133534) NO está aplicada, y además su CHECK solo
 * admite el flujo de factura. Sin migración nueva se guarda el estado en lo que
 * ya existe: el `payload` del ÚLTIMO saliente del bot (o `tool_context` del
 * borrador en modo asistido). Cada pregunta del flujo viaja con
 * `{flujo, paso_cortesia, datos_cortesia}`; la respuesta del papá se lee contra
 * esa pregunta. Ventaja: si después escribe la escuela o el bot contesta otra
 * cosa, el último saliente ya no es del flujo y el flujo queda cerrado solo —
 * nunca se lee un «12» como edad cuando la última pregunta fue otra.
 *
 * Flujo:
 *   oferta (≤3 franjas con botones; «Ver más» si hay más)
 *     → nombre del deportista → edad o fecha de nacimiento
 *     → nombre del acudiente (solo si es menor y no lo conocemos)
 *     → resumen «Confirmar / Cambiar» → submit_school_lead → resumen + aviso a la escuela
 *   sin franjas: «¿dejas tus datos?» → mismos pasos → prospecto SIN cupo (igual
 *     que el formulario sin elegir horario) → la escuela lo contacta.
 *   «cancelar mi clase» (solo si ESE número tiene una reserva futura)
 *     → «¿Cancelo…?» → wa_cancelar_clase_de_prueba → aviso a la escuela.
 */

import { supabase } from '../config/supabase';
import type { BotonInteractivo } from './whatsapp.service';
import { sendToUser } from './push.service';
import { destinatariosDeEscuela, enviarConReserva } from './avisos-correo.service';
import { esSinLimite } from './franjas-cortesia.service';

export const FLUJO_CORTESIA = 'clase_cortesia';
/** Misma ventana de atención de Meta: pasada, el papá ya no recuerda la pregunta. */
export const VIGENCIA_FLUJO_CORTESIA_MS = 24 * 60 * 60 * 1000;
const MAX_INTENTOS = 3;
/** Franjas con botón por mensaje. Meta permite 3 botones; con «Ver más» van 2. */
const MAX_BOTONES = 3;
const TZ = 'America/Bogota';

export type PasoCortesia =
    | 'elegir_franja' | 'dejar_datos' | 'nombre' | 'edad' | 'acudiente'
    | 'confirmar' | 'confirmar_cancelacion';

export interface FranjaCortesia {
    id: string;
    /** Lo que la escuela escribió como etiqueta: «Sub-15», «Clase abierta». */
    grupo: string;
    fecha: string;          // YYYY-MM-DD
    horaInicio: string;     // HH:MM[:SS]
    horaFin: string | null;
    sede: string | null;
    cupos: number;
}

export interface DatosCortesia {
    /** Franja elegida; ausente en el camino «dejar datos». */
    franja?: FranjaCortesia | null;
    /** true = no hay franjas: se dejan los datos para que la escuela llame. */
    sinFranja?: boolean;
    /** Ids de las franjas en el orden en que se numeraron («1», «2»…). */
    lista?: string[];
    desde?: number;
    nombre?: string;
    edad?: number;
    fechaNacimiento?: string | null;
    acudiente?: string | null;
    intentos?: number;
}

export interface EstadoCortesia {
    paso: PasoCortesia;
    datos: DatosCortesia;
}

export interface ReservaVigente {
    leadId: string;
    nombre: string;
    franja: FranjaCortesia;
}

export type ResultadoReserva =
    | { ok: true; leadId: string | null; duplicado: boolean; conCupo: boolean }
    | { ok: false; motivo: 'lleno' | 'no_disponible' | 'error' };

export type ResultadoCancelacion =
    | { ok: true; franja: FranjaCortesia | null }
    | { ok: false; motivo: 'sin_reserva' | 'sin_rpc' | 'error' };

export type TipoAvisoCortesia =
    | 'reservada' | 'datos' | 'cancelada' | 'cancelacion_pedida' | 'no_reservada';

export interface AvisoCortesia {
    tipo: TipoAvisoCortesia;
    schoolId: string;
    conversationId: string;
    contactWaId: string;
    leadId?: string | null;
    nombre?: string | null;
    edad?: number | null;
    acudiente?: string | null;
    franja?: FranjaCortesia | null;
}

export interface ParamsReserva {
    schoolId: string;
    conversationId: string;
    contactWaId: string;
    franjaId: string | null;
    nombre: string;
    edad: number;
    fechaNacimiento: string | null;
    acudiente: string | null;
}

export interface CtxCortesia {
    conversationId: string;
    schoolId: string;
    contactWaId: string;
    /**
     * Envía un mensaje del flujo. `estado` null = mensaje terminal (cierra el
     * flujo). `step` es el que queda en el payload (cuenta para frenos).
     */
    enviar: (texto: string, step: string, estado: EstadoCortesia | null,
        botones?: BotonInteractivo[], enTexto?: string) => Promise<void>;
    /** Nombre del acudiente ya identificado (familia con cuenta); null si no se sabe. */
    nombreAcudiente?: () => Promise<string | null>;
    // Inyectables (pruebas). Por defecto, los de Supabase de abajo.
    leerEstado?: (conversationId: string) => Promise<EstadoCortesia | null>;
    franjas?: (schoolId: string) => Promise<FranjaCortesia[]>;
    reservaVigente?: (schoolId: string, contactWaId: string) => Promise<ReservaVigente | null>;
    reservar?: (p: ParamsReserva) => Promise<ResultadoReserva>;
    cancelar?: (schoolId: string, contactWaId: string) => Promise<ResultadoCancelacion>;
    avisarEscuela?: (aviso: AvisoCortesia) => Promise<void>;
    ahora?: () => Date;
}

// ─── Botones (ids = contrato con el webhook; títulos ≤ 20) ─────────────────

export const BOTON_CC = {
    FRANJA: 'sm_cc_f:',            // + id de la franja
    VER_MAS: 'sm_cc_mas',
    DATOS_SI: 'sm_cc_datos_si',
    DATOS_NO: 'sm_cc_datos_no',
    CONFIRMAR: 'sm_cc_confirmar',
    CAMBIAR: 'sm_cc_cambiar',
    CANCELAR: 'sm_cc_cancelar',
    CANCELAR_SI: 'sm_cc_cancelar_si',
    CANCELAR_NO: 'sm_cc_cancelar_no',
} as const;

const BOTONES_DATOS: BotonInteractivo[] = [
    { id: BOTON_CC.DATOS_SI, title: 'Sí, dejar mis datos' },
    { id: BOTON_CC.DATOS_NO, title: 'No, gracias' },
];
const BOTONES_CONFIRMAR: BotonInteractivo[] = [
    { id: BOTON_CC.CONFIRMAR, title: 'Confirmar' },
    { id: BOTON_CC.CAMBIAR, title: 'Cambiar' },
];
const BOTONES_CANCELAR: BotonInteractivo[] = [
    { id: BOTON_CC.CANCELAR_SI, title: 'Sí, cancelar' },
    { id: BOTON_CC.CANCELAR_NO, title: 'No, la mantengo' },
];
const BOTON_CANCELAR_MI_CLASE: BotonInteractivo[] = [
    { id: BOTON_CC.CANCELAR, title: 'Cancelar mi clase' },
];

export function esBotonCortesia(id: string | null | undefined): boolean {
    return !!id && id.startsWith('sm_cc_');
}

// ─── Texto (puro) ──────────────────────────────────────────────────────────

/** Minúsculas, sin tildes; conserva / y - para leer fechas. */
export function normalizar(t: string | null | undefined): string {
    return String(t ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9/ -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * ¿Pregunta por la clase de cortesía / prueba? Reglas, no modelo: corre sobre
 * cada mensaje de familias Y de desconocidos, y tiene que poder explicarse por
 * qué disparó. «Clase de cortesía tienen» (Dynasty, 2026-10-06) es el caso que
 * el bot contestó con «no tengo esa información».
 */
const PIDE_CORTESIA: RegExp[] = [
    /\bclases? (de )?(prueba|cortesia|gratis|gratuitas?|muestra|ensayo)\b/,
    /\b(probar|conocer) (una |la )?clase\b/,
    /\b(ir|venir|pasar) a probar\b/,
    /\bpuedo (ir a )?probar\b/,
    /\b(agendar|reservar|separar) (una )?clase\b/,
    /\bcortesia\b/,
];
export function pideClaseDeCortesia(texto: string | null | undefined): boolean {
    const n = normalizar(texto);
    return !!n && PIDE_CORTESIA.some((re) => re.test(n));
}

/**
 * «Cancelar mi clase», «ya no puedo ir a la clase de prueba». OJO: para una
 * familia inscrita «cancelar la clase» también es avisar que no va a entrenar;
 * por eso quien llama SOLO lo toma como cancelación si ese número tiene una
 * reserva de cortesía futura.
 */
export function quiereCancelarClase(texto: string | null | undefined): boolean {
    const n = normalizar(texto);
    return /\b(cancelar|cancela|cancelo|cancelen|anular|anula)\b.*\b(clase|reserva|cortesia|prueba|cupo)\b/.test(n)
        || /\bya no (puedo|podemos|voy|vamos) (a ir )?(a )?(la )?(clase|prueba)\b/.test(n);
}

/**
 * ¿Quiere salirse del agendamiento? Antes solo valía el mensaje EXACTO
 * («cancelar»); en la prueba en vivo del 2026-10-06 escribieron «Cancelar
 * prueba» y el bot respondió «Toca la franja que prefieras». Ahora basta con
 * que EMPIECE por una de estas frases.
 */
function abandona(texto: string): boolean {
    return /^(cancelar|cancela|cancelo|salir|ya no|no gracias|dejalo|olvidalo|no quiero|no me interesa|mejor no|despues|luego)/
        .test(normalizar(texto));
}

/** Un mensaje largo o con pregunta no es una respuesta: es otra conversación. */
function pareceOtraConversacion(texto: string): boolean {
    const t = (texto || '').trim();
    return t.includes('?') || t.split(/\s+/).filter(Boolean).length > 7;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partesFecha(fecha: string): { y: number; m: number; d: number; dow: number } {
    const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
    // Mediodía UTC: el día de la semana no se corre por zona horaria.
    const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
    return { y, m, d, dow };
}

export function fechaLegible(fecha: string): string {
    const { m, d, dow } = partesFecha(fecha);
    return `${DIAS[dow]} ${d} de ${MESES[m - 1]}`;
}

export function horaLegible(hora: string): string {
    const [hh, mm] = hora.split(':').map(Number);
    const sufijo = hh >= 12 ? 'p. m.' : 'a. m.';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm || 0).padStart(2, '0')} ${sufijo}`;
}

function minutos(hora: string): number {
    const [hh, mm] = hora.split(':').map(Number);
    return hh * 60 + (mm || 0);
}

export function duracionLegible(inicio: string, fin: string | null): string | null {
    if (!fin) return null;
    const total = minutos(fin) - minutos(inicio);
    if (total <= 0) return null;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** Título de botón ≤ 20: «1. Sáb 10/10 5:00pm». El número evita títulos repetidos. */
export function tituloBoton(f: FranjaCortesia, n: number): string {
    const { m, d, dow } = partesFecha(f.fecha);
    const [hh, mm] = f.horaInicio.split(':').map(Number);
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    const t = `${n}. ${DIAS_CORTOS[dow]} ${d}/${m} ${h12}:${String(mm || 0).padStart(2, '0')}${hh >= 12 ? 'pm' : 'am'}`;
    return Array.from(t).slice(0, 20).join('');
}

/**
 * Las franjas generadas desde los entrenamientos no tienen límite real
 * (max_capacity = CUPOS_SIN_LIMITE = 999): decir «998 cupos» suena a error y
 * además invita a preguntar «¿998?». Ahí va «cupos disponibles», sin número.
 * Las franjas cargadas a mano (5, 10…) siguen mostrando la cifra.
 */
export function textoCupos(cupos: number): string {
    if (esSinLimite(cupos)) return 'cupos disponibles';
    return cupos === 1 ? '1 cupo' : `${cupos} cupos`;
}

/**
 * Reordena para que la primera página muestre grupos DISTINTOS: la próxima
 * franja de cada grupo (en orden cronológico de su primera franja), después la
 * segunda de cada uno, etc.
 *
 * Por qué: con franjas generadas de los entrenamientos Dynasty tiene ~40 por
 * semana y `list_open_trial_slots_public` devuelve las 20 más cercanas; en
 * orden puro de fecha, las dos primeras con botón serían de los dos grupos que
 * entrenan hoy a las 4 p. m. y el papá de un niño de otra categoría tendría
 * que tocar «Ver más» varias veces. Lo ideal sería ofrecer primero el grupo de
 * la EDAD del deportista, pero (a) el flujo pregunta la edad DESPUÉS de elegir
 * la franja y (b) ningún equipo tiene edades cargadas (age_min/birth_year_min
 * NULL en todas las escuelas, medido 2026-09-22) y deducirla del nombre
 * («U15») está prohibido en whatsapp-info-escuela.service.ts. Intercalar por
 * grupo es lo que se puede hacer sin inventar.
 */
export function intercalarPorGrupo(franjas: FranjaCortesia[]): FranjaCortesia[] {
    const colas = new Map<string, FranjaCortesia[]>();
    for (const f of franjas) {
        if (!colas.has(f.grupo)) colas.set(f.grupo, []);
        colas.get(f.grupo)!.push(f);
    }
    const salida: FranjaCortesia[] = [];
    for (let ronda = 0; salida.length < franjas.length; ronda++) {
        for (const cola of colas.values()) if (cola[ronda]) salida.push(cola[ronda]);
    }
    return salida;
}

function lineaFranja(f: FranjaCortesia, n: number): string {
    const fin = f.horaFin ? ` a ${horaLegible(f.horaFin)}` : '';
    const dur = duracionLegible(f.horaInicio, f.horaFin);
    const sede = f.sede ? ` · 📍 ${f.sede}` : '';
    const cupos = textoCupos(f.cupos);
    return `${n}. *${f.grupo}* — ${fechaLegible(f.fecha)}, ${horaLegible(f.horaInicio)}${fin}` +
        `${dur ? ` (${dur})` : ''}${sede} · ${cupos}`;
}

function bloqueFranja(f: FranjaCortesia): string {
    const fin = f.horaFin ? ` a ${horaLegible(f.horaFin)}` : '';
    return `📅 ${fechaLegible(f.fecha)}\n🕔 ${horaLegible(f.horaInicio)}${fin}` +
        (f.sede ? `\n📍 ${f.sede}` : '') + `\n👥 Grupo: ${f.grupo}`;
}

function textoResumen(d: DatosCortesia): string {
    const lineas = ['Revisa que esté todo bien:', ''];
    if (d.franja) {
        lineas.push(`• Clase: *${d.franja.grupo}* — ${fechaLegible(d.franja.fecha)}, ${horaLegible(d.franja.horaInicio)}`);
        if (d.franja.sede) lineas.push(`• Sede: ${d.franja.sede}`);
    } else {
        lineas.push('• Clase de cortesía: *la escuela te contacta para agendarla*');
    }
    lineas.push(`• Deportista: *${d.nombre ?? ''}* (${d.edad ?? '?'} años)`);
    if (d.acudiente) lineas.push(`• Acudiente: *${d.acudiente}*`);
    lineas.push('• Teléfono: este WhatsApp');
    lineas.push('', d.franja ? '¿Confirmo la reserva?' : '¿Le paso estos datos a la escuela?');
    return lineas.join('\n');
}

// ─── Lectura de respuestas ─────────────────────────────────────────────────

/** Nombre de persona: 3–80 caracteres, con letras, sin números ni @. */
export function nombreValido(texto: string): string | null {
    const t = (texto || '').replace(/\s+/g, ' ').trim();
    if (t.length < 3 || t.length > 80) return null;
    if (/[0-9@?¿]/.test(t)) return null;
    if ((t.match(/\p{L}/gu) ?? []).length < 3) return null;
    // «Juan pérez» → «Juan Pérez»: así llega a la escuela y al resumen.
    return t.split(' ').map((p) => p ? p[0].toLocaleUpperCase('es-CO') + p.slice(1) : p).join(' ');
}

function hoyBogota(ahora: Date): { y: number; m: number; d: number; iso: string; minutos: number } {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(ahora);
    const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
    const y = v('year'); const m = v('month'); const d = v('day');
    return { y, m, d, iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, minutos: v('hour') * 60 + v('minute') };
}

/**
 * Edad o fecha de nacimiento: «12», «12 años», «tiene 9», «15/03/2014»,
 * «2014-03-15». Edad válida 3–90. La fecha manda: con ella la escuela calcula
 * la categoría (lo hace `submit_school_lead`).
 */
export function leerEdad(texto: string, ahora: Date): { edad: number; fechaNacimiento: string | null } | null {
    const n = normalizar(texto);
    const hoy = hoyBogota(ahora);
    let y: number | null = null; let m: number | null = null; let d: number | null = null;
    const dmy = n.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
    const ymd = n.match(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
    if (dmy) { d = Number(dmy[1]); m = Number(dmy[2]); y = Number(dmy[3]); }
    else if (ymd) { y = Number(ymd[1]); m = Number(ymd[2]); d = Number(ymd[3]); }
    if (y && m && d) {
        const fecha = new Date(Date.UTC(y, m - 1, d));
        if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
        let edad = hoy.y - y;
        if (hoy.m < m || (hoy.m === m && hoy.d < d)) edad--;
        if (edad < 3 || edad > 90) return null;
        return { edad, fechaNacimiento: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
    }
    const solo = n.match(/^(?:tiene |tengo |de )?(\d{1,2})(?: anos| ano| anitos)?$/);
    if (solo) {
        const edad = Number(solo[1]);
        if (edad >= 3 && edad <= 90) return { edad, fechaNacimiento: null };
    }
    return null;
}

const SI = new Set(['si', 's', 'dale', 'ok', 'listo', 'claro', 'confirmar', 'confirmo', 'correcto', 'si confirmar',
    'si confirmo', 'esta bien', 'de una', 'si dejar mis datos', 'si cancelar', 'si por favor']);
const NO = new Set(['no', 'n', 'no gracias', 'cambiar', 'corregir', 'no la mantengo', 'mantener', 'no cancelar']);

function siNo(texto: string, botonId: string | null, si: string, no: string): 'si' | 'no' | null {
    if (botonId === si) return 'si';
    if (botonId === no) return 'no';
    const n = normalizar(texto);
    if (SI.has(n)) return 'si';
    if (NO.has(n)) return 'no';
    return null;
}

// ─── Motor del flujo ───────────────────────────────────────────────────────

function deps(ctx: CtxCortesia) {
    return {
        leerEstado: ctx.leerEstado ?? leerEstadoDeSupabase,
        franjas: ctx.franjas ?? franjasDeSupabase,
        reservaVigente: ctx.reservaVigente ?? reservaVigenteDeSupabase,
        reservar: ctx.reservar ?? reservarEnSupabase,
        cancelar: ctx.cancelar ?? cancelarEnSupabase,
        avisar: ctx.avisarEscuela ?? avisarEscuelaCortesia,
        ahora: (ctx.ahora ?? (() => new Date()))(),
    };
}

/** Franjas futuras (Bogotá) con cupo, sin las de hoy que ya empezaron. */
export function filtrarVigentes(franjas: FranjaCortesia[], ahora: Date): FranjaCortesia[] {
    const hoy = hoyBogota(ahora);
    return franjas
        .filter((f) => f.cupos > 0)
        .filter((f) => f.fecha > hoy.iso || (f.fecha === hoy.iso && minutos(f.horaInicio) > hoy.minutos))
        .sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio));
}

/**
 * Turno del flujo. true = lo resolvió este módulo. false = no era para acá
 * (el bot sigue con lo suyo).
 *
 * `iniciar=false`: solo atiende lo que ya está en curso (flujo abierto, botón
 * del flujo, cancelación con reserva). Lo usa el desconocido, que antes de
 * EMPEZAR algo tiene que pasar por el filtro de tema escolar y su freno.
 */
export async function atenderTurnoCortesia(
    ctx: CtxCortesia,
    textoCrudo: string,
    botonId: string | null,
    opciones: { iniciar?: boolean; encabezado?: string; step?: string; intro?: string } = {},
): Promise<boolean> {
    const d = deps(ctx);
    const texto = (textoCrudo || '').trim();
    const iniciar = opciones.iniciar ?? true;

    const estado = await d.leerEstado(ctx.conversationId);

    // Botón «Cancelar mi clase», o lo pide escrito: SOLO si hay reserva.
    if (botonId === BOTON_CC.CANCELAR || (!estado && quiereCancelarClase(texto))) {
        const reserva = await d.reservaVigente(ctx.schoolId, ctx.contactWaId);
        if (!reserva) {
            if (botonId !== BOTON_CC.CANCELAR) return false;
            await ctx.enviar('No encuentro una clase de cortesía reservada desde este número. 🤔',
                'cortesia_sin_reserva', null);
            return true;
        }
        await ctx.enviar(
            `¿Cancelo la clase de cortesía de *${reserva.nombre}*?\n\n${bloqueFranja(reserva.franja)}`,
            'cortesia_confirmar_cancelacion',
            { paso: 'confirmar_cancelacion', datos: { franja: reserva.franja, nombre: reserva.nombre } },
            BOTONES_CANCELAR, 'Responde *Sí, cancelar* o *No, la mantengo*.');
        return true;
    }

    if (estado) {
        // Con flujo abierto, un botón de OTRA cosa («Ver mis pagos») es una
        // elección explícita: el flujo se suelta y lo atiende quien sabe.
        if (botonId && !esBotonCortesia(botonId)) return false;
        return continuar(ctx, d, estado, texto, botonId);
    }

    // Sin flujo abierto: un botón viejo del flujo (de un mensaje anterior) se
    // atiende igual, revalidando contra las franjas de AHORA.
    if (esBotonCortesia(botonId)) {
        return continuar(ctx, d, { paso: 'elegir_franja', datos: {} }, texto, botonId);
    }

    if (iniciar && pideClaseDeCortesia(texto)) {
        await iniciarCortesia(ctx, opciones);
        return true;
    }
    return false;
}

/**
 * Arranca: informa y ofrece franjas, o (sin franjas) ofrece dejar los datos.
 * Es lo que hace la tool `get_trial_class_info` y la puerta del desconocido.
 */
export async function iniciarCortesia(
    ctx: CtxCortesia,
    opciones: { encabezado?: string; step?: string; intro?: string } = {},
): Promise<void> {
    const d = deps(ctx);
    const cabeza = opciones.encabezado ? `${opciones.encabezado}\n\n` : '';

    // Ya tiene una reservada: se le recuerda en vez de reservarle otra.
    const reserva = await d.reservaVigente(ctx.schoolId, ctx.contactWaId);
    if (reserva) {
        await ctx.enviar(
            cabeza + `Ya tienes una clase de cortesía reservada para *${reserva.nombre}*:\n\n${bloqueFranja(reserva.franja)}\n\n` +
            'Si no puedes ir, toca *Cancelar mi clase* para liberar el cupo.',
            opciones.step ?? 'cortesia_ya_reservada', null,
            BOTON_CANCELAR_MI_CLASE, 'Si no puedes ir, escríbeme *cancelar mi clase*.');
        return;
    }

    const franjas = filtrarVigentes(await d.franjas(ctx.schoolId), d.ahora);
    if (!franjas.length) {
        await ctx.enviar(
            cabeza + 'Por ahora no tengo horarios de *clase de cortesía* publicados para agendarla por aquí. 🙏\n\n' +
            '¿Quieres dejarme tus datos para que la escuela te contacte y te agende una?',
            opciones.step ?? 'cortesia_sin_franjas',
            { paso: 'dejar_datos', datos: { sinFranja: true } },
            BOTONES_DATOS, 'Responde *Sí* para dejar tus datos o *No, gracias*.');
        return;
    }

    await ofrecerFranjas(ctx, franjas, 0, {},
        cabeza + (opciones.intro ?? '¡Claro! 🙌 La *clase de cortesía* es *gratis* y sirve para conocer la escuela. ' +
        'Estas son las próximas franjas disponibles:'),
        opciones.step ?? 'cortesia_ofrecer');
}

async function ofrecerFranjas(
    ctx: CtxCortesia,
    franjas: FranjaCortesia[],
    desde: number,
    datosPrevios: DatosCortesia,
    intro: string,
    step: string,
): Promise<void> {
    // Hasta 20 (lo que trae la RPC), intercaladas por grupo: así «Ver más
    // horarios» recorre todos los grupos y no solo los de los próximos dos días.
    const lista = intercalarPorGrupo(franjas).slice(0, 20);
    const inicio = desde >= lista.length ? 0 : desde;
    const hayMas = lista.length > MAX_BOTONES;
    const porPagina = hayMas ? MAX_BOTONES - 1 : MAX_BOTONES;
    const visibles = lista.slice(inicio, inicio + porPagina);

    const lineas = visibles.map((f, i) => lineaFranja(f, inicio + i + 1));
    const botones: BotonInteractivo[] = visibles.map((f, i) => ({
        id: `${BOTON_CC.FRANJA}${f.id}`, title: tituloBoton(f, inicio + i + 1),
    }));
    if (hayMas) botones.push({ id: BOTON_CC.VER_MAS, title: 'Ver más horarios' });

    await ctx.enviar(
        `${intro}\n\n${lineas.join('\n')}\n\n¿Cuál te reservo?`,
        step,
        { paso: 'elegir_franja', datos: { ...datosPrevios, franja: null, sinFranja: false,
            lista: lista.map((f) => f.id), desde: inicio, intentos: 0 } },
        botones,
        `Responde con el número de la franja (${visibles.map((_, i) => inicio + i + 1).join(', ')})` +
            (hayMas ? ' o *ver más*.' : '.'));
}

type Deps = ReturnType<typeof deps>;

async function continuar(
    ctx: CtxCortesia, d: Deps, estado: EstadoCortesia, texto: string, botonId: string | null,
): Promise<boolean> {
    const datos = estado.datos ?? {};

    if (!botonId && abandona(texto) && estado.paso !== 'confirmar_cancelacion') {
        await ctx.enviar('Listo, lo dejamos así. Si quieres agendar después, escríbeme *clase de cortesía*. 🙌',
            'cortesia_abandonada', null);
        return true;
    }

    switch (estado.paso) {
        case 'elegir_franja': return elegirFranja(ctx, d, datos, texto, botonId);
        case 'dejar_datos': {
            const r = siNo(texto, botonId, BOTON_CC.DATOS_SI, BOTON_CC.DATOS_NO);
            if (r === 'no') {
                await ctx.enviar('Sin problema. Si después quieres agendar, escríbeme *clase de cortesía*. 🙌',
                    'cortesia_no_deja_datos', null);
                return true;
            }
            if (r === 'si') return pedirNombre(ctx, { ...datos, sinFranja: true, franja: null });
            if (pareceOtraConversacion(texto)) return false;
            return reintentar(ctx, estado, '¿Me dejas tus datos? Responde *Sí* o *No, gracias*.',
                BOTONES_DATOS);
        }
        case 'nombre': {
            const nombre = nombreValido(texto);
            if (!nombre) {
                if (pareceOtraConversacion(texto)) return false;
                return reintentar(ctx, estado,
                    'Escríbeme el *nombre completo* de quien va a tomar la clase (solo el nombre, sin números).');
            }
            await ctx.enviar(
                `Gracias. ¿Qué *edad* tiene ${nombre.split(' ')[0]}? También me sirve la *fecha de nacimiento* (por ejemplo 15/03/2014).`,
                'cortesia_edad', { paso: 'edad', datos: { ...datos, nombre, intentos: 0 } });
            return true;
        }
        case 'edad': {
            const e = leerEdad(texto, d.ahora);
            if (!e) {
                if (pareceOtraConversacion(texto)) return false;
                return reintentar(ctx, estado,
                    'No te entendí la edad. Escríbeme solo el número de años (por ejemplo *12*) o la fecha de nacimiento (*15/03/2014*).');
            }
            const nuevos: DatosCortesia = { ...datos, edad: e.edad, fechaNacimiento: e.fechaNacimiento, intentos: 0 };
            if (e.edad < 18) {
                const conocido = ctx.nombreAcudiente ? await ctx.nombreAcudiente().catch(() => null) : null;
                if (conocido) return confirmar(ctx, { ...nuevos, acudiente: conocido });
                await ctx.enviar('Como es menor de edad, ¿cuál es el *nombre completo del acudiente*?',
                    'cortesia_acudiente', { paso: 'acudiente', datos: nuevos });
                return true;
            }
            return confirmar(ctx, { ...nuevos, acudiente: null });
        }
        case 'acudiente': {
            const acudiente = nombreValido(texto);
            if (!acudiente) {
                if (pareceOtraConversacion(texto)) return false;
                return reintentar(ctx, estado, 'Escríbeme el *nombre completo del acudiente*.');
            }
            return confirmar(ctx, { ...datos, acudiente });
        }
        case 'confirmar': {
            const r = siNo(texto, botonId, BOTON_CC.CONFIRMAR, BOTON_CC.CAMBIAR);
            if (r === 'si') return reservar(ctx, d, datos);
            if (r === 'no') {
                // «Cambiar» arranca de cero: es más claro que preguntar qué dato
                // cambiar, y son solo tres preguntas.
                if (datos.sinFranja) return pedirNombre(ctx, { sinFranja: true, franja: null });
                const franjas = filtrarVigentes(await d.franjas(ctx.schoolId), d.ahora);
                if (!franjas.length) {
                    await ctx.enviar('Ya no quedan franjas disponibles. ¿Quieres dejarme tus datos para que la escuela te contacte?',
                        'cortesia_sin_franjas', { paso: 'dejar_datos', datos: { sinFranja: true } }, BOTONES_DATOS);
                    return true;
                }
                await ofrecerFranjas(ctx, franjas, 0, {}, 'Listo, empecemos de nuevo. Elige la franja:', 'cortesia_ofrecer');
                return true;
            }
            if (pareceOtraConversacion(texto)) return false;
            return reintentar(ctx, estado, 'Responde *Confirmar* para reservar o *Cambiar* para empezar de nuevo.',
                BOTONES_CONFIRMAR);
        }
        case 'confirmar_cancelacion': {
            const r = siNo(texto, botonId, BOTON_CC.CANCELAR_SI, BOTON_CC.CANCELAR_NO);
            if (r === 'no') {
                await ctx.enviar('Perfecto, tu clase sigue reservada. ¡Te esperamos! 💪', 'cortesia_cancelacion_desistida', null);
                return true;
            }
            if (r === 'si') return cancelarReserva(ctx, d, datos);
            if (pareceOtraConversacion(texto)) return false;
            return reintentar(ctx, estado, 'Responde *Sí, cancelar* o *No, la mantengo*.', BOTONES_CANCELAR);
        }
    }
    return false;
}

async function reintentar(
    ctx: CtxCortesia, estado: EstadoCortesia, pregunta: string, botones?: BotonInteractivo[],
): Promise<boolean> {
    const intentos = (estado.datos?.intentos ?? 0) + 1;
    if (intentos >= MAX_INTENTOS) {
        await ctx.enviar('Dejémoslo acá por ahora. Cuando quieras retomarlo, escríbeme *clase de cortesía*. 🙌',
            'cortesia_demasiados_intentos', null);
        return true;
    }
    await ctx.enviar(pregunta, `cortesia_${estado.paso}`,
        { paso: estado.paso, datos: { ...estado.datos, intentos } }, botones);
    return true;
}

async function pedirNombre(ctx: CtxCortesia, datos: DatosCortesia): Promise<boolean> {
    await ctx.enviar('¿Cuál es el *nombre completo* de quien va a tomar la clase?',
        'cortesia_nombre', { paso: 'nombre', datos: { ...datos, intentos: 0 } });
    return true;
}

async function confirmar(ctx: CtxCortesia, datos: DatosCortesia): Promise<boolean> {
    await ctx.enviar(textoResumen(datos), 'cortesia_confirmar',
        { paso: 'confirmar', datos: { ...datos, intentos: 0 } },
        BOTONES_CONFIRMAR, 'Responde *Confirmar* o *Cambiar*.');
    return true;
}

function datosCompletos(d: DatosCortesia): boolean {
    return !!d.nombre && typeof d.edad === 'number' && (d.edad >= 18 || !!d.acudiente);
}

async function elegirFranja(
    ctx: CtxCortesia, d: Deps, datos: DatosCortesia, texto: string, botonId: string | null,
): Promise<boolean> {
    const franjas = filtrarVigentes(await d.franjas(ctx.schoolId), d.ahora);
    const n = normalizar(texto);

    if (botonId === BOTON_CC.VER_MAS || n === 'ver mas' || n === 'mas' || n === 'ver mas horarios'
        || n === 'ver otros horarios' || n === 'otros horarios' || n === 'otro horario') {
        if (!franjas.length) return sinFranjasDisponibles(ctx);
        await ofrecerFranjas(ctx, franjas, (datos.desde ?? 0) + MAX_BOTONES - 1, datos,
            'Estas son otras franjas:', 'cortesia_ofrecer');
        return true;
    }

    let elegidaId: string | null = null;
    if (botonId?.startsWith(BOTON_CC.FRANJA)) elegidaId = botonId.slice(BOTON_CC.FRANJA.length);
    else if (/^\d{1,2}$/.test(n)) elegidaId = datos.lista?.[Number(n) - 1] ?? null;

    if (!elegidaId) {
        if (pareceOtraConversacion(texto) || !datos.lista?.length) return false;
        return reintentar(ctx, { paso: 'elegir_franja', datos },
            'Toca la franja que prefieras o escríbeme su número (por ejemplo *1*).');
    }

    const franja = franjas.find((f) => f.id === elegidaId);
    if (!franja) {
        // Se llenó o la cerraron entre la oferta y el toque: se dice y se
        // vuelve a ofrecer lo que haya de verdad AHORA.
        if (!franjas.length) return sinFranjasDisponibles(ctx);
        await ofrecerFranjas(ctx, franjas, 0, datos,
            'Uy, esa franja ya no está disponible. 😕 Estas siguen abiertas:', 'cortesia_ofrecer');
        return true;
    }

    const nuevos: DatosCortesia = { ...datos, franja, sinFranja: false, intentos: 0 };
    // Volvió a elegir tras un «se llenó»: ya tenemos sus datos, directo al resumen.
    if (datosCompletos(nuevos)) return confirmar(ctx, nuevos);
    await ctx.enviar(
        `Elegiste *${franja.grupo}* — ${fechaLegible(franja.fecha)}, ${horaLegible(franja.horaInicio)}. 👍\n\n` +
        '¿Cuál es el *nombre completo* de quien va a tomar la clase?',
        'cortesia_nombre', { paso: 'nombre', datos: nuevos });
    return true;
}

async function sinFranjasDisponibles(ctx: CtxCortesia): Promise<boolean> {
    await ctx.enviar(
        'En este momento no quedan franjas de clase de cortesía con cupo. 😕\n\n' +
        '¿Quieres dejarme tus datos para que la escuela te contacte y te agende?',
        'cortesia_sin_franjas', { paso: 'dejar_datos', datos: { sinFranja: true } },
        BOTONES_DATOS, 'Responde *Sí* para dejar tus datos o *No, gracias*.');
    return true;
}

async function reservar(ctx: CtxCortesia, d: Deps, datos: DatosCortesia): Promise<boolean> {
    if (!datos.nombre || typeof datos.edad !== 'number') {
        return pedirNombre(ctx, { franja: datos.franja, sinFranja: datos.sinFranja });
    }
    const franja = datos.sinFranja ? null : datos.franja ?? null;
    const r = await d.reservar({
        schoolId: ctx.schoolId,
        conversationId: ctx.conversationId,
        contactWaId: ctx.contactWaId,
        franjaId: franja?.id ?? null,
        nombre: datos.nombre,
        edad: datos.edad,
        fechaNacimiento: datos.fechaNacimiento ?? null,
        acudiente: datos.acudiente ?? null,
    });
    const base: Omit<AvisoCortesia, 'tipo'> = {
        schoolId: ctx.schoolId, conversationId: ctx.conversationId, contactWaId: ctx.contactWaId,
        nombre: datos.nombre, edad: datos.edad, acudiente: datos.acudiente ?? null, franja,
    };

    if (!r.ok) {
        if (r.motivo === 'lleno' || r.motivo === 'no_disponible') {
            // La carrera: dos familias por el último cupo. `submit_school_lead`
            // lo resolvió con FOR UPDATE; a quien perdió se le ofrece lo que
            // queda, conservando sus datos para no volver a preguntarlos.
            const quedan = filtrarVigentes(await d.franjas(ctx.schoolId), d.ahora)
                .filter((f) => f.id !== franja?.id);
            if (!quedan.length) return sinFranjasDisponibles(ctx);
            await ofrecerFranjas(ctx, quedan, 0, { ...datos, franja: null },
                'Uy, ese horario se acaba de llenar. 😕 Estas franjas siguen con cupo:', 'cortesia_cupo_lleno');
            return true;
        }
        await ctx.enviar(
            'No pude completar la reserva en este momento. 🙏 Ya le avisé a la escuela con tus datos para que te ' +
            'confirme el horario por aquí.', 'cortesia_error_reserva', null);
        void d.avisar({ ...base, tipo: 'no_reservada' }).catch(() => {});
        return true;
    }

    if (franja && r.duplicado && !r.conCupo) {
        // `submit_school_lead` deduplica por teléfono 24 h y en ese caso NO
        // toma el cupo. No se le dice «reservado» a quien no lo quedó.
        await ctx.enviar(
            'Ya tenía tus datos de hoy, así que le pedí a la escuela que te confirme el horario de la clase ' +
            `(${fechaLegible(franja.fecha)}, ${horaLegible(franja.horaInicio)}). Te responden por aquí. 🙌`,
            'cortesia_duplicado', null);
        void d.avisar({ ...base, leadId: r.leadId, tipo: 'no_reservada' }).catch(() => {});
        return true;
    }

    if (!franja) {
        await ctx.enviar(
            `¡Listo! ✅ Le pasé los datos de *${datos.nombre}* a la escuela. Te van a contactar por aquí para ` +
            'agendar la clase de cortesía.', 'cortesia_datos_dejados', null);
        void d.avisar({ ...base, leadId: r.leadId, tipo: 'datos' }).catch(() => {});
        return true;
    }

    await ctx.enviar(
        `✅ ¡Listo! Quedó reservada la clase de cortesía de *${datos.nombre}*:\n\n${bloqueFranja(franja)}\n\n` +
        'Es *gratis*. Llega unos minutos antes; si tienes dudas de qué llevar, escríbenos por aquí y la escuela te confirma.\n\n' +
        'Si no puedes ir, escríbeme *cancelar mi clase* para liberar el cupo.',
        'cortesia_reservada', null);
    void d.avisar({ ...base, leadId: r.leadId, tipo: 'reservada' }).catch(() => {});
    return true;
}

async function cancelarReserva(ctx: CtxCortesia, d: Deps, datos: DatosCortesia): Promise<boolean> {
    const r = await d.cancelar(ctx.schoolId, ctx.contactWaId);
    const base: Omit<AvisoCortesia, 'tipo'> = {
        schoolId: ctx.schoolId, conversationId: ctx.conversationId, contactWaId: ctx.contactWaId,
        nombre: datos.nombre ?? null, franja: datos.franja ?? null,
    };
    if (r.ok) {
        const f = r.franja ?? datos.franja ?? null;
        await ctx.enviar(
            'Listo, cancelé tu clase de cortesía' +
            (f ? ` del ${fechaLegible(f.fecha)} a las ${horaLegible(f.horaInicio)}` : '') +
            ' y el cupo quedó libre. Si quieres otra fecha, escríbeme *clase de cortesía*. 🙌',
            'cortesia_cancelada', null);
        void d.avisar({ ...base, franja: f, tipo: 'cancelada' }).catch(() => {});
        return true;
    }
    if (r.motivo === 'sin_reserva') {
        await ctx.enviar('Ya no encuentro una clase reservada desde este número; puede que ya estuviera cancelada. 🤔',
            'cortesia_sin_reserva', null);
        return true;
    }
    // Sin la RPC (migración pendiente) o con error: lo cancela una persona.
    // NUNCA se toca el contador del cupo desde aquí.
    await ctx.enviar('Le pedí a la escuela que cancele tu clase y libere el cupo. Te confirman por aquí. 🙏',
        'cortesia_cancelacion_pedida', null);
    void d.avisar({ ...base, tipo: 'cancelacion_pedida' }).catch(() => {});
    return true;
}

// ─── Implementaciones con Supabase (por defecto) ───────────────────────────
// Todas atrapan sus errores: una falla de este módulo no puede dejar a la
// familia sin respuesta ni tumbar el turno del bot.

/** Estado = el payload del último saliente del bot (o del borrador pendiente). */
export async function leerEstadoDeSupabase(conversationId: string): Promise<EstadoCortesia | null> {
    try {
        const desde = new Date(Date.now() - VIGENCIA_FLUJO_CORTESIA_MS).toISOString();
        const [msg, borrador] = await Promise.all([
            supabase.from('whatsapp_messages')
                .select('payload, created_at')
                .eq('conversation_id', conversationId)
                .eq('direction', 'outbound')
                .gte('created_at', desde)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('whatsapp_message_drafts')
                .select('tool_context, created_at')
                .eq('conversation_id', conversationId)
                .eq('status', 'pending')
                .gte('created_at', desde)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);
        const m = (msg as any)?.data;
        const b = (borrador as any)?.data;
        const ultimo = !m ? b?.tool_context
            : !b ? m.payload
            : (new Date(b.created_at) > new Date(m.created_at) ? b.tool_context : m.payload);
        if (!ultimo || ultimo.flujo !== FLUJO_CORTESIA || !ultimo.paso_cortesia) return null;
        return { paso: ultimo.paso_cortesia, datos: ultimo.datos_cortesia ?? {} };
    } catch {
        return null;
    }
}

async function slugDeEscuela(schoolId: string): Promise<string | null> {
    const { data } = await supabase.from('schools').select('slug').eq('id', schoolId).maybeSingle();
    return (data as any)?.slug ?? null;
}

function aFranja(r: any): FranjaCortesia {
    return {
        id: String(r.id),
        grupo: String(r.label ?? 'Clase de cortesía'),
        fecha: String(r.slot_date).slice(0, 10),
        horaInicio: String(r.start_time).slice(0, 5),
        horaFin: r.end_time ? String(r.end_time).slice(0, 5) : null,
        sede: r.location ?? null,
        cupos: Number(r.spots_left ?? 0),
    };
}

/** Las mismas franjas que ve el formulario /inscripcion/<slug>. */
export async function franjasDeSupabase(schoolId: string): Promise<FranjaCortesia[]> {
    try {
        const slug = await slugDeEscuela(schoolId);
        if (!slug) return [];
        const { data, error } = await supabase.rpc('list_open_trial_slots_public', { p_slug: slug });
        if (error || !Array.isArray(data)) return [];
        return (data as any[]).map(aFranja);
    } catch {
        return [];
    }
}

function ultimos10(waId: string): string {
    return String(waId ?? '').replace(/\D/g, '').slice(-10);
}

/**
 * El teléfono con que se guarda el prospecto: el celular colombiano de 10
 * dígitos, igual que lo escribe la gente en el formulario. Así el dedupe de
 * 24 h de `submit_school_lead` y la búsqueda de la escuela cruzan.
 */
function telefonoDelLead(waId: string): string {
    const d = String(waId ?? '').replace(/\D/g, '');
    const t10 = d.slice(-10);
    return /^3\d{9}$/.test(t10) ? t10 : `+${d}`;
}

export async function reservaVigenteDeSupabase(schoolId: string, contactWaId: string): Promise<ReservaVigente | null> {
    try {
        const t10 = ultimos10(contactWaId);
        if (t10.length < 10) return null;
        const digitos = String(contactWaId).replace(/\D/g, '');
        const variantes = [...new Set([t10, `57${t10}`, `+57${t10}`, digitos, `+${digitos}`])];
        const { data, error } = await supabase.from('school_signup_leads')
            .select('id, full_name, created_at, school_trial_slots(id, label, slot_date, start_time, end_time, location)')
            .eq('school_id', schoolId)
            .in('phone', variantes)
            .in('status', ['new', 'contacted', 'converted'])
            .not('trial_slot_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);
        if (error || !Array.isArray(data)) return null;
        const hoy = hoyBogota(new Date()).iso;
        for (const l of data as any[]) {
            const s = Array.isArray(l.school_trial_slots) ? l.school_trial_slots[0] : l.school_trial_slots;
            if (s && String(s.slot_date).slice(0, 10) >= hoy) {
                return { leadId: l.id, nombre: l.full_name, franja: aFranja({ ...s, spots_left: 0 }) };
            }
        }
        return null;
    } catch {
        return null;
    }
}

/** Reserva con `submit_school_lead`: la misma RPC (y el mismo candado) del formulario. */
export async function reservarEnSupabase(p: ParamsReserva): Promise<ResultadoReserva> {
    try {
        const slug = await slugDeEscuela(p.schoolId);
        if (!slug) return { ok: false, motivo: 'error' };
        const { data, error } = await supabase.rpc('submit_school_lead', {
            p_slug: slug,
            p_full_name: p.nombre,
            p_phone: telefonoDelLead(p.contactWaId),
            p_email: null,
            p_gender: null,
            p_birth_date: p.fechaNacimiento,
            p_guardian_name: p.acudiente,
            p_how_heard: 'whatsapp',
            p_notes: `Agendada por el asistente de WhatsApp. Edad informada: ${p.edad} años.`,
            p_source_detail: { canal: 'whatsapp', conversation_id: p.conversationId },
            p_website: null,
            p_trial_slot_id: p.franjaId,
        });
        if (error) {
            const msg = normalizar(error.message);
            if (/llen/.test(msg)) return { ok: false, motivo: 'lleno' };
            if (/no esta disponible|no existe/.test(msg)) return { ok: false, motivo: 'no_disponible' };
            console.error('[wa-cortesia] submit_school_lead falló', { err: error.message });
            return { ok: false, motivo: 'error' };
        }
        const r = (data ?? {}) as any;
        const leadId = r.lead_id ?? null;
        let conCupo = !r.duplicate;
        if (r.duplicate && p.franjaId && leadId) {
            const { data: lead } = await supabase.from('school_signup_leads')
                .select('trial_slot_id').eq('id', leadId).maybeSingle();
            conCupo = (lead as any)?.trial_slot_id === p.franjaId;
        }
        return { ok: true, leadId, duplicado: !!r.duplicate, conCupo };
    } catch (e: any) {
        console.error('[wa-cortesia] reservar explotó', { err: e?.message });
        return { ok: false, motivo: 'error' };
    }
}

export async function cancelarEnSupabase(schoolId: string, contactWaId: string): Promise<ResultadoCancelacion> {
    try {
        const { data, error } = await supabase.rpc('wa_cancelar_clase_de_prueba', {
            p_school_id: schoolId, p_phone: contactWaId,
        });
        if (error) {
            // PGRST202 / 42883: la migración 20261006082002 todavía no está aplicada.
            const sinRpc = (error as any).code === 'PGRST202' || (error as any).code === '42883'
                || /could not find the function/i.test(error.message);
            if (!sinRpc) console.error('[wa-cortesia] wa_cancelar_clase_de_prueba falló', { err: error.message });
            return { ok: false, motivo: sinRpc ? 'sin_rpc' : 'error' };
        }
        const r = (data ?? {}) as any;
        if (!r.ok) return { ok: false, motivo: r.reason === 'sin_reserva' ? 'sin_reserva' : 'error' };
        return { ok: true, franja: r.slot_date ? aFranja({ ...r, id: r.lead_id, spots_left: 0 }) : null };
    } catch {
        return { ok: false, motivo: 'error' };
    }
}

const TITULO_AVISO: Record<TipoAvisoCortesia, string> = {
    reservada: 'Nueva clase de cortesía agendada',
    datos: 'Un prospecto dejó sus datos para una clase de cortesía',
    cancelada: 'Clase de cortesía cancelada',
    cancelacion_pedida: 'Piden cancelar una clase de cortesía',
    no_reservada: 'Clase de cortesía por confirmar',
};

/**
 * Push + correo a owner/admins. `submit_school_lead` y la RPC de cancelar ya
 * dejan la notificación in-app; esto es para que se entere aunque no abra la
 * app — un prospecto que llega a la clase y nadie lo esperaba es una
 * inscripción perdida. Nunca lanza.
 */
export async function avisarEscuelaCortesia(a: AvisoCortesia): Promise<void> {
    try {
        const titulo = TITULO_AVISO[a.tipo];
        const quien = a.nombre ? `${a.nombre}${typeof a.edad === 'number' ? ` (${a.edad} años)` : ''}` : 'Un prospecto';
        const cuando = a.franja
            ? `${a.franja.grupo}, ${fechaLegible(a.franja.fecha)} ${horaLegible(a.franja.horaInicio)}`
            : 'sin horario: contáctalo para agendar';
        const accion = a.tipo === 'cancelacion_pedida'
            ? 'Cancélala y libera el cupo; el asistente le dijo que le confirmarían.'
            : a.tipo === 'no_reservada'
                ? 'El asistente no pudo tomar el cupo: confírmale el horario por WhatsApp.'
                : 'Abre WhatsApp en SportMaps para ver la conversación.';

        const [{ data: escuela }, { data: miembros }] = await Promise.all([
            supabase.from('schools').select('owner_id').eq('id', a.schoolId).maybeSingle(),
            supabase.from('school_members').select('profile_id')
                .eq('school_id', a.schoolId).eq('status', 'active')
                .in('role', ['owner', 'admin', 'school_admin']),
        ]);
        const destinos = new Set<string>();
        for (const m of (miembros ?? []) as any[]) if (m.profile_id) destinos.add(m.profile_id);
        if ((escuela as any)?.owner_id) destinos.add((escuela as any).owner_id);
        await Promise.allSettled([...destinos].map((uid) => sendToUser(uid, {
            title: titulo,
            body: `${quien} — ${cuando}. ${accion}`,
            data: { tipo: 'whatsapp_clase_cortesia', conversation_id: a.conversationId, school_id: a.schoolId },
        })));

        const { escuela: nombreEscuela, correos } = await destinatariosDeEscuela(a.schoolId);
        if (!correos.length) return;
        const url = `${(process.env.FRONTEND_URL || 'https://app.sportmaps.co').replace(/\/$/, '')}` +
            `/whatsapp?tab=conversaciones&conversacion=${encodeURIComponent(a.conversationId)}`;
        const lineas = [
            `Deportista: ${quien}`,
            ...(a.acudiente ? [`Acudiente: ${a.acudiente}`] : []),
            `WhatsApp: +${String(a.contactWaId).replace(/\D/g, '')}`,
            `Clase: ${cuando}${a.franja?.sede ? ` · ${a.franja.sede}` : ''}`,
            accion,
        ];
        // Sin plantilla propia en send-email: va el HTML de respaldo. La
        // edge function no conoce 'wa_clase_cortesia' y `enviarPlantilla`
        // reintenta con el respaldo; la clave por evento evita duplicados
        // entre los tres BFF que comparten la base.
        await enviarConReserva({
            clave: `wa_clase_cortesia:${a.tipo}:${a.leadId ?? a.conversationId}:${a.franja?.id ?? 'sin'}`,
            tipo: 'wa_clase_cortesia',
            schoolId: a.schoolId,
            refId: a.conversationId,
            destinos: correos,
            data: { schoolName: nombreEscuela, titulo, lineasJson: JSON.stringify(lineas), url },
            respaldo: { subject: `${titulo} — ${nombreEscuela}`, titulo, lineas, enlace: { url, texto: 'Ver en SportMaps' } },
        });
    } catch (e: any) {
        console.warn('[wa-cortesia] no se pudo avisar a la escuela', { err: e?.message });
    }
}
