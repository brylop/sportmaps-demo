/**
 * informe-calidad-bot — Informe semanal de CALIDAD Y COSTO del bot de WhatsApp,
 * para el equipo de SportMaps (no para la escuela).
 *
 * Por cada escuela con WhatsApp conectado, en el rango pedido (hora Bogotá):
 *   - mensajes entrantes / salientes (bot, persona, automáticos, plantillas)
 *   - conversaciones de FAMILIA: % resueltas solo por el bot, % por la escuela
 *     (respondió una persona, haya escalado o no el bot) y % sin respuesta
 *   - escalaciones y tiempo hasta la respuesta humana (mediana y p90)
 *   - errores: envíos fallidos (status 'failed'), turnos con fallas del modelo
 *     (`llm_fallas`), respuestas de respaldo por falla del modelo
 *     (`via='llm_error'`), fugas de texto interno bloqueadas por el filtro de
 *     salida (`salida_filtrada`) y respuestas repetidas del bot
 *   - comprobantes procesados y su resultado
 *   - clases de cortesía reservadas y opt-ins nuevos
 *   - COSTO: tokens y USD estimados por proveedor/modelo, por función y por
 *     conversación (desde `llm_usage`, que existe desde el 2026-10-08; antes
 *     no hay datos y el informe lo dice)
 *
 * Las fórmulas de conversación/espera/comprobantes son las del tablero
 * (whatsapp-metricas.ts) para que los dos números coincidan. Lo de acá es
 * puro (`calcularInformeEscuela`, `resumirCostos`) y se prueba sin base; la
 * lectura está en `armarInformeCalidadBot`.
 *
 * El texto de los mensajes se lee SOLO para detectar repeticiones y no sale de
 * esta función: el informe trae conteos, nunca contenido.
 */

import { supabase } from '../config/supabase';
import { echosAutomaticos, ECHO_AUTOMATICO_VENTANA_MS } from './whatsapp-buzon';
import {
    analizarConversacion, clasificarComprobante, desenlace, esEscalamiento, esFamilia, momentoDe, motivoCorto,
    percentil, tipoDeMensaje, type ClaseComprobante, type Evento, type MensajeCrudo,
} from './whatsapp-metricas';
import { costoUsd, precioDe, type FilaUso } from './llm-usage.service';
import { correosDeSoporte, enviarConReserva, escaparHtml, fechaColombia } from './avisos-correo.service';

const DIA_MS = 24 * 3600_000;
/** Dos respuestas del bot iguales en la misma conversación dentro de esta ventana = repetida. */
export const VENTANA_REPETIDA_MS = 24 * 3600_000;

// ─── Tipos de entrada (filas crudas) ────────────────────────────────────────

export type MensajeInforme = MensajeCrudo & {
    status?: string | null;
    error_detail?: string | null;
    text_body?: string | null;
    llm_fallas?: unknown;
    salida_filtrada?: unknown;
    via?: string | null;
};

export interface BorradorInforme {
    id: string;
    conversation_id: string;
    created_at: string;
    step?: string | null;
    con_enlace?: unknown;
    llm_fallas?: unknown;
    salida_filtrada?: unknown;
}

export interface FilaColaInforme {
    status: string;
    result_type?: string | null;
    result_ref_id?: string | null;
    error_message?: string | null;
}

export interface DatosEscuela {
    schoolId: string;
    nombre: string;
    mensajes: MensajeInforme[];
    /** Echos del celular de la escuela (para la regla de saludos automáticos). */
    echos: { id: string; conversation_id: string; text_body: string | null; wa_timestamp?: string | null; created_at?: string | null }[];
    borradores: BorradorInforme[];
    kinds: Map<string, string | null>;
    cola: FilaColaInforme[];
    pagos: Map<string, { status?: string | null; approved_by?: string | null }>;
    optinsNuevos: number;
    cortesiasReservadas: number;
    uso: FilaUsoInforme[];
    /** Alguna consulta llegó al techo de filas: los números son un piso. */
    truncado?: boolean;
}

export type FilaUsoInforme = FilaUso & {
    provider: string;
    feature: string;
    school_id?: string | null;
    conversation_id?: string | null;
};

// ─── Salida ─────────────────────────────────────────────────────────────────

export interface CostoAgrupado {
    clave: string;
    llamadas: number;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    audioSeg: number;
    usd: number;
    /** Hay filas de un modelo sin precio: el USD es un piso. */
    sinPrecio: number;
    /** El precio usado no está confirmado (Gemini/Groq/OpenAI). */
    precioPorConfirmar: boolean;
}

export interface ResumenCostos {
    llamadas: number;
    usd: number;
    sinPrecio: number;
    porModelo: CostoAgrupado[];
    porFuncion: CostoAgrupado[];
    conversacionesConCosto: number;
    usdPromedioPorConversacion: number | null;
    usdMaxConversacion: number | null;
}

export interface InformeEscuela {
    schoolId: string;
    nombre: string;
    mensajes: { entrantes: number; salientes: number; bot: number; humano: number; automatico: number; otro: number };
    conversaciones: { activas: number; familias: number };
    familias: {
        soloBot: number; escuela: number; sinRespuesta: number;
        pctBot: number | null; pctEscuela: number | null; pctSinRespuesta: number | null;
    };
    escalaciones: {
        conversaciones: number;
        respondidasPorPersona: number;
        sinRespuestaHumana: number;
        medianaMin: number | null;
        p90Min: number | null;
    };
    errores: {
        enviosFallidos: number;
        motivosEnvio: { motivo: string; n: number }[];
        turnosConFallaLlm: number;
        fallasPorProveedor: { proveedor: string; n: number }[];
        respaldoPorFallaLlm: number;
        fugasBloqueadas: number;
        motivosFuga: { motivo: string; n: number }[];
        respuestasRepetidas: number;
        repetidasPorPaso: { motivo: string; n: number }[];
    };
    comprobantes: {
        recibidos: number; aplicadosSolos: number; aprobadosPorEscuela: number; esperandoRevision: number;
        rechazados: number; escalados: number; fallidos: number; esperandoFamilia: number; ignorados: number; enProceso: number;
    };
    cortesiasReservadas: number;
    optinsNuevos: number;
    costo: ResumenCostos;
    truncado: boolean;
}

export interface InformeCalidadBot {
    desde: string;
    hasta: string;
    escuelas: InformeEscuela[];
    /** Consumo sin escuela (SportBot sin escuela, OCR fuera de la cola, scripts). */
    sinEscuela: ResumenCostos;
    total: ResumenCostos;
    /** Fecha del primer registro de `llm_usage` (null = la tabla está vacía o no existe). */
    usoDesde: string | null;
    usoDisponible: boolean;
}

// ─── Utilidades puras ───────────────────────────────────────────────────────

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const presente = (v: unknown) => v !== null && v !== undefined && v !== false && v !== ''
    && !(Array.isArray(v) && v.length === 0);

function lista(v: unknown): any[] {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; } }
    return [];
}

/** `salida_filtrada` es la lista de motivos del filtro (códigos, sin texto de nadie). */
function motivosDeFiltro(v: unknown): string[] {
    const l = lista(v).map(String).slice(0, 3);
    return l.length ? l : ['filtrada'];
}

function contar(claves: string[], tope = 5): { motivo: string; n: number }[] {
    const m = new Map<string, number>();
    for (const k of claves) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n).slice(0, tope);
}

/** Motivo corto de un error de envío de Meta, sin números de teléfono ni textos largos. */
export function motivoDeEnvio(error: string | null | undefined): string {
    const e = String(error ?? '').trim();
    if (!e) return 'sin detalle';
    const codigo = e.match(/\b(1[0-9]{5}|[0-9]{3,6})\b/);
    const limpio = e.replace(/\+?\d{7,}/g, '•••').replace(/\s+/g, ' ');
    const corto = limpio.length > 70 ? `${limpio.slice(0, 69)}…` : limpio;
    return codigo && !corto.includes(codigo[1]) ? `${codigo[1]} ${corto}` : corto;
}

const normalizarTexto = (s: string | null | undefined) =>
    String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Respuestas del bot que repiten, palabra por palabra, una respuesta anterior
 * del bot en la misma conversación dentro de `VENTANA_REPETIDA_MS`. Textos
 * muy cortos («Listo») no cuentan.
 */
export function contarRepetidas(
    mensajes: { conversation_id: string; texto: string | null | undefined; t: number; step?: string | null }[],
): { total: number; porPaso: { motivo: string; n: number }[] } {
    const porConv = new Map<string, { n: string; t: number }[]>();
    const pasos: string[] = [];
    for (const m of [...mensajes].sort((a, b) => a.t - b.t)) {
        const n = normalizarTexto(m.texto);
        if (n.length < 15) continue;
        const previas = porConv.get(m.conversation_id) ?? [];
        if (previas.some((p) => p.n === n && m.t - p.t <= VENTANA_REPETIDA_MS)) pasos.push(m.step || 'sin paso');
        previas.push({ n, t: m.t });
        porConv.set(m.conversation_id, previas);
    }
    // El paso dice si la repetición es un problema («escribe tu correo» dos
    // veces) o esperable (una confirmación por cada comprobante aprobado).
    return { total: pasos.length, porPaso: contar(pasos, 4) };
}

function agrupar(filas: FilaUsoInforme[], clave: (f: FilaUsoInforme) => string): CostoAgrupado[] {
    const m = new Map<string, CostoAgrupado>();
    for (const f of filas) {
        const k = clave(f);
        const g = m.get(k) ?? {
            clave: k, llamadas: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, audioSeg: 0, usd: 0,
            sinPrecio: 0, precioPorConfirmar: false,
        };
        g.llamadas++;
        g.input += Number(f.input_tokens ?? 0);
        g.output += Number(f.output_tokens ?? 0);
        g.cacheRead += Number(f.cache_read_tokens ?? 0);
        g.cacheWrite += Number(f.cache_write_tokens ?? 0);
        g.audioSeg += Number(f.audio_segundos ?? 0) || 0;
        const c = costoUsd(f);
        if (c === null) g.sinPrecio++;
        else g.usd += c;
        const p = precioDe(f.model);
        if (p && !p.confirmado) g.precioPorConfirmar = true;
        m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.usd - a.usd || b.llamadas - a.llamadas);
}

export function resumirCostos(filas: FilaUsoInforme[]): ResumenCostos {
    const porModelo = agrupar(filas, (f) => `${f.provider} · ${f.model}`);
    const porFuncion = agrupar(filas, (f) => f.feature);
    const porConv = new Map<string, number>();
    for (const f of filas) {
        if (!f.conversation_id) continue;
        porConv.set(f.conversation_id, (porConv.get(f.conversation_id) ?? 0) + (costoUsd(f) ?? 0));
    }
    const usd = porModelo.reduce((s, g) => s + g.usd, 0);
    const valores = [...porConv.values()];
    return {
        llamadas: filas.length,
        usd,
        sinPrecio: porModelo.reduce((s, g) => s + g.sinPrecio, 0),
        porModelo,
        porFuncion,
        conversacionesConCosto: porConv.size,
        usdPromedioPorConversacion: valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null,
        usdMaxConversacion: valores.length ? Math.max(...valores) : null,
    };
}

/** Todo el cálculo de UNA escuela, sin base. */
export function calcularInformeEscuela(d: DatosEscuela): InformeEscuela {
    const automaticos = echosAutomaticos(d.echos as any);
    const eventosPorConv = new Map<string, Evento[]>();
    const agregar = (conv: string, e: Evento) => {
        const l = eventosPorConv.get(conv) ?? [];
        l.push(e);
        eventosPorConv.set(conv, l);
    };

    const mensajes = { entrantes: 0, salientes: 0, bot: 0, humano: 0, automatico: 0, otro: 0 };
    const fallidos: string[] = [];
    const fugas: string[] = [];
    const fallasProv: string[] = [];
    let turnosConFalla = 0;
    let respaldo = 0;
    const delBot: { conversation_id: string; texto: string | null | undefined; t: number; step?: string | null }[] = [];

    for (const m of d.mensajes) {
        const tipo = tipoDeMensaje(m, automaticos);
        const t = momentoDe(m);
        agregar(m.conversation_id, { t, tipo });
        if (tipo === 'entrante') { mensajes.entrantes++; continue; }
        mensajes.salientes++;
        if (tipo === 'bot' || tipo === 'escalamiento') {
            mensajes.bot++;
            delBot.push({ conversation_id: m.conversation_id, texto: m.text_body, t, step: m.step });
        } else if (tipo === 'humano') mensajes.humano++;
        else if (tipo === 'automatico') mensajes.automatico++;
        else mensajes.otro++;

        if (m.status === 'failed') fallidos.push(motivoDeEnvio(m.error_detail));
        if (presente(m.salida_filtrada)) fugas.push(...motivosDeFiltro(m.salida_filtrada));
        const fl = lista(m.llm_fallas);
        if (fl.length) {
            turnosConFalla++;
            for (const f of fl) fallasProv.push(String(f?.proveedor ?? 'desconocido'));
        }
        if (m.via === 'llm_error' || String(m.step ?? '').startsWith('llm_error')) respaldo++;
    }
    // Modo asistido: la escalación queda como borrador y la falla/filtro también.
    for (const b of d.borradores) {
        const t = new Date(b.created_at).getTime();
        if (esEscalamiento(b.step, b.con_enlace)) agregar(b.conversation_id, { t, tipo: 'escalamiento' });
        if (presente(b.salida_filtrada)) fugas.push(...motivosDeFiltro(b.salida_filtrada));
        const fl = lista(b.llm_fallas);
        if (fl.length) {
            turnosConFalla++;
            for (const f of fl) fallasProv.push(String(f?.proveedor ?? 'desconocido'));
        }
    }

    let activas = 0, familias = 0, soloBot = 0, escuela = 0, sinRespuesta = 0;
    let escaladas = 0, escaladasRespondidas = 0;
    const esperasEscalacion: number[] = [];
    for (const [conv, eventos] of eventosPorConv) {
        const r = analizarConversacion(eventos);
        if (!r.tuvoEntrante) continue;
        activas++;
        if (r.escalada) {
            escaladas++;
            if (r.tuvoHumano) escaladasRespondidas++;
            esperasEscalacion.push(...r.esperas);
        }
        if (!esFamilia(d.kinds.get(conv) ?? null)) continue;
        familias++;
        const des = desenlace(r);
        if (des === 'solo_bot') soloBot++;
        else if (des === 'humano' || (des === 'escalada' && r.tuvoHumano)) escuela++;
        else sinRespuesta++; // nadie respondió, o el bot escaló y ninguna persona contestó
    }

    const clases: Record<ClaseComprobante, number> = {
        aprobado_solo: 0, aprobado_por_escuela: 0, esperando_revision: 0, rechazado: 0, escalado: 0,
        fallido: 0, esperando_familia: 0, ignorado: 0, matricula: 0, en_proceso: 0,
    };
    for (const f of d.cola) clases[clasificarComprobante(f, f.result_ref_id ? d.pagos.get(f.result_ref_id) : null)]++;

    const repetidas = contarRepetidas(delBot);
    const minutos = (ms: number | null) => (ms === null ? null : Math.round(ms / 60_000));
    return {
        schoolId: d.schoolId,
        nombre: d.nombre,
        mensajes,
        conversaciones: { activas, familias },
        familias: {
            soloBot, escuela, sinRespuesta,
            pctBot: pct(soloBot, familias), pctEscuela: pct(escuela, familias), pctSinRespuesta: pct(sinRespuesta, familias),
        },
        escalaciones: {
            conversaciones: escaladas,
            respondidasPorPersona: escaladasRespondidas,
            sinRespuestaHumana: escaladas - escaladasRespondidas,
            medianaMin: minutos(percentil(esperasEscalacion, 0.5)),
            p90Min: minutos(percentil(esperasEscalacion, 0.9)),
        },
        errores: {
            enviosFallidos: fallidos.length,
            motivosEnvio: contar(fallidos, 3),
            turnosConFallaLlm: turnosConFalla,
            fallasPorProveedor: contar(fallasProv).map(({ motivo, n }) => ({ proveedor: motivo, n })),
            respaldoPorFallaLlm: respaldo,
            fugasBloqueadas: d.mensajes.filter((m) => presente(m.salida_filtrada)).length
                + d.borradores.filter((b) => presente(b.salida_filtrada)).length,
            motivosFuga: contar(fugas, 4),
            respuestasRepetidas: repetidas.total,
            repetidasPorPaso: repetidas.porPaso,
        },
        comprobantes: {
            recibidos: d.cola.length - clases.matricula,
            aplicadosSolos: clases.aprobado_solo,
            aprobadosPorEscuela: clases.aprobado_por_escuela,
            esperandoRevision: clases.esperando_revision,
            rechazados: clases.rechazado,
            escalados: clases.escalado,
            fallidos: clases.fallido,
            esperandoFamilia: clases.esperando_familia,
            ignorados: clases.ignorado,
            enProceso: clases.en_proceso,
        },
        cortesiasReservadas: d.cortesiasReservadas,
        optinsNuevos: d.optinsNuevos,
        costo: resumirCostos(d.uso),
        truncado: !!d.truncado,
    };
}

// ─── Lectura de la base (solo SELECT) ───────────────────────────────────────

const PAGINA = 1000;
const TECHO_MENSAJES = 40_000;
const TECHO_GENERAL = 10_000;

type Respuesta = { data: unknown; error: { code?: string; message?: string } | null };

async function paginar<T>(armar: (de: number, a: number) => PromiseLike<Respuesta>, techo: number):
    Promise<{ filas: T[]; truncado: boolean; error: Respuesta['error'] }> {
    const filas: T[] = [];
    for (let de = 0; de < techo; de += PAGINA) {
        const r = await armar(de, Math.min(de + PAGINA, techo) - 1);
        if (r.error) return { filas, truncado: false, error: r.error };
        const lote = (r.data as T[]) ?? [];
        filas.push(...lote);
        if (lote.length < PAGINA) return { filas, truncado: false, error: null };
    }
    return { filas, truncado: true, error: null };
}

async function enTrozos<R>(ids: string[], tam: number, f: (trozo: string[]) => PromiseLike<{ data: unknown }>): Promise<R[]> {
    const out: R[] = [];
    for (let i = 0; i < ids.length; i += tam) out.push(...((((await f(ids.slice(i, i + tam))).data) as R[]) ?? []));
    return out;
}

const COLUMNAS_MENSAJE = 'id, conversation_id, direction, ai_generated, wa_timestamp, created_at, status, error_detail, text_body, '
    + 'step:payload->>step, con_enlace:payload->con_enlace, automatico:payload->automatico, '
    + 'to:payload->to, manual:payload->manual, aprobado_por:payload->aprobado_por, '
    + 'llm_fallas:payload->llm_fallas, salida_filtrada:payload->salida_filtrada, via:payload->>via';

const COLUMNAS_USO = 'school_id, conversation_id, feature, provider, model, input_tokens, output_tokens, '
    + 'cache_read_tokens, cache_write_tokens, audio_segundos, created_at';

/** ¿Existe la tabla llm_usage? (la migración se aplica a mano). */
function tablaInexistente(e: Respuesta['error']): boolean {
    return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''));
}

async function datosDeEscuela(
    integ: { id: string; school_id: string }, nombre: string, desde: number, hasta: number, uso: FilaUsoInforme[],
): Promise<DatosEscuela> {
    const desdeIso = new Date(desde).toISOString();
    const hastaIso = new Date(hasta).toISOString();
    const [msgs, echos, borr, convs, cola, optins, cortesias] = await Promise.all([
        paginar<MensajeInforme>((de, a) => supabase.from('whatsapp_messages').select(COLUMNAS_MENSAJE)
            .eq('integration_id', integ.id).gte('wa_timestamp', desdeIso).lt('wa_timestamp', hastaIso)
            .order('wa_timestamp').order('id').range(de, a), TECHO_MENSAJES),
        paginar<any>((de, a) => supabase.from('whatsapp_messages')
            .select('id, conversation_id, text_body, wa_timestamp, created_at')
            .eq('integration_id', integ.id).eq('direction', 'outbound').eq('ai_generated', false)
            .not('payload->to', 'is', null)
            .gte('wa_timestamp', new Date(desde - ECHO_AUTOMATICO_VENTANA_MS).toISOString()).lt('wa_timestamp', hastaIso)
            .order('wa_timestamp').order('id').range(de, a), TECHO_GENERAL),
        paginar<BorradorInforme>((de, a) => supabase.from('whatsapp_message_drafts')
            .select('id, conversation_id, created_at, step:tool_context->>step, con_enlace:tool_context->con_enlace, '
                + 'llm_fallas:tool_context->llm_fallas, salida_filtrada:tool_context->salida_filtrada')
            .eq('integration_id', integ.id).gte('created_at', desdeIso).lt('created_at', hastaIso)
            .order('created_at').order('id').range(de, a), TECHO_GENERAL),
        paginar<any>((de, a) => supabase.from('whatsapp_conversations').select('id, contact_kind')
            .eq('school_id', integ.school_id).order('id').range(de, a), TECHO_GENERAL),
        paginar<any>((de, a) => supabase.from('whatsapp_inbound_queue')
            .select('id, status, result_type, result_ref_id, error_message')
            .eq('school_id', integ.school_id).gte('created_at', desdeIso).lt('created_at', hastaIso)
            .order('created_at').order('id').range(de, a), TECHO_GENERAL),
        supabase.from('whatsapp_optins').select('id', { count: 'exact', head: true })
            .eq('school_id', integ.school_id).gte('opted_in_at', desdeIso).lt('opted_in_at', hastaIso).is('opted_out_at', null),
        supabase.from('school_signup_leads').select('id', { count: 'exact', head: true })
            .eq('school_id', integ.school_id).not('trial_slot_id', 'is', null).neq('status', 'discarded')
            .gte('created_at', desdeIso).lt('created_at', hastaIso),
    ]);
    for (const r of [msgs, echos, borr, convs, cola]) {
        if (r.error) throw new Error(`informe-calidad-bot: ${r.error.message ?? 'error de consulta'}`);
    }
    const idsPago = cola.filas.filter((f) => f.result_type === 'payment_receipt' && f.result_ref_id).map((f) => f.result_ref_id as string);
    const pagos = new Map<string, any>();
    if (idsPago.length) {
        for (const p of await enTrozos<any>(idsPago, 150, (ids) => supabase.from('payments').select('id, status, approved_by').in('id', ids))) {
            pagos.set(p.id, p);
        }
    }
    return {
        schoolId: integ.school_id,
        nombre,
        mensajes: msgs.filas,
        echos: echos.filas,
        borradores: borr.filas,
        kinds: new Map(convs.filas.map((c: any) => [c.id, c.contact_kind ?? null])),
        cola: cola.filas,
        pagos,
        optinsNuevos: (optins as any).count ?? 0,
        cortesiasReservadas: (cortesias as any).count ?? 0,
        uso,
        truncado: msgs.truncado || echos.truncado || borr.truncado || convs.truncado || cola.truncado,
    };
}

/**
 * Arma el informe de [desde, hasta). Solo lee. `schoolId` limita a una
 * escuela (el script); sin él, todas las que tienen WhatsApp activo.
 */
export async function armarInformeCalidadBot(p: { desde: number; hasta: number; schoolId?: string | null }): Promise<InformeCalidadBot> {
    const desdeIso = new Date(p.desde).toISOString();
    const hastaIso = new Date(p.hasta).toISOString();

    let q = supabase.from('school_whatsapp_integrations').select('id, school_id').eq('status', 'active');
    if (p.schoolId) q = q.eq('school_id', p.schoolId);
    const { data: integraciones, error } = await q;
    if (error) throw new Error(`informe-calidad-bot: ${error.message}`);
    const integs = (integraciones ?? []) as { id: string; school_id: string }[];

    const { data: escuelasRows } = integs.length
        ? await supabase.from('schools').select('id, name').in('id', integs.map((i) => i.school_id))
        : { data: [] as any[] };
    const nombres = new Map(((escuelasRows ?? []) as any[]).map((s) => [s.id, s.name]));

    // Consumo del rango (y la fecha del primer registro, para avisar desde cuándo hay costos).
    const usoR = await paginar<FilaUsoInforme>((de, a) => {
        let u = supabase.from('llm_usage').select(COLUMNAS_USO).gte('created_at', desdeIso).lt('created_at', hastaIso);
        if (p.schoolId) u = u.eq('school_id', p.schoolId);
        return u.order('created_at').order('id').range(de, a);
    }, 100_000);
    const usoDisponible = !tablaInexistente(usoR.error);
    if (usoR.error && usoDisponible) throw new Error(`informe-calidad-bot: ${usoR.error.message ?? 'llm_usage'}`);
    let usoDesde: string | null = null;
    if (usoDisponible) {
        const { data: primero } = await supabase.from('llm_usage').select('created_at').order('created_at').limit(1);
        usoDesde = ((primero ?? []) as any[])[0]?.created_at ?? null;
    }
    const uso = usoR.filas;

    const escuelas: InformeEscuela[] = [];
    for (const integ of integs) {
        const datos = await datosDeEscuela(integ, nombres.get(integ.school_id) || 'Escuela', p.desde, p.hasta,
            uso.filter((f) => f.school_id === integ.school_id));
        escuelas.push(calcularInformeEscuela(datos));
    }
    return {
        desde: desdeIso,
        hasta: hastaIso,
        escuelas,
        sinEscuela: resumirCostos(uso.filter((f) => !f.school_id)),
        total: resumirCostos(uso),
        usoDesde,
        usoDisponible,
    };
}

// ─── Presentación ───────────────────────────────────────────────────────────

export const fmtUsd = (x: number | null | undefined) =>
    (x === null || x === undefined ? '—' : x < 0.01 && x > 0 ? `US$${x.toFixed(4)}` : `US$${x.toFixed(2)}`);
const fmtPct = (x: number | null) => (x === null ? '—' : `${x}%`);
const fmtMin = (x: number | null) => (x === null ? '—' : x < 60 ? `${x} min` : `${Math.round((x / 60) * 10) / 10} h`);
const miles = (x: number) => x.toLocaleString('es-CO');

function notaCosto(inf: InformeCalidadBot): string {
    if (!inf.usoDisponible) return 'Sin datos de costo: la tabla llm_usage todavía no existe (migración 20261008164445 sin aplicar).';
    if (!inf.usoDesde) return 'Sin datos de costo: llm_usage está vacía (el registro empezó con el despliegue del 2026-10-08).';
    if (inf.usoDesde > inf.desde) return `Costos solo desde ${inf.usoDesde.slice(0, 10)} (antes no había registro).`;
    return '';
}

/** Líneas de texto plano (script y respaldo del correo). Solo agregados. */
export function lineasInforme(inf: InformeCalidadBot): string[] {
    const l: string[] = [];
    for (const e of inf.escuelas) {
        const f = e.familias, es = e.escalaciones, er = e.errores, c = e.comprobantes;
        l.push(`== ${e.nombre}${e.truncado ? ' (datos recortados: piso)' : ''}`);
        l.push(`Mensajes: ${e.mensajes.entrantes} entrantes · ${e.mensajes.salientes} salientes (bot ${e.mensajes.bot}, persona ${e.mensajes.humano}, automáticos ${e.mensajes.automatico}, plantillas/otros ${e.mensajes.otro})`);
        l.push(`Conversaciones de familia: ${e.conversaciones.familias} de ${e.conversaciones.activas} activas → bot ${fmtPct(f.pctBot)} (${f.soloBot}) · escuela ${fmtPct(f.pctEscuela)} (${f.escuela}) · sin respuesta ${fmtPct(f.pctSinRespuesta)} (${f.sinRespuesta})`);
        l.push(`Escalaciones: ${es.conversaciones} (${es.respondidasPorPersona} con respuesta humana, ${es.sinRespuestaHumana} sin ella) · hasta respuesta humana: mediana ${fmtMin(es.medianaMin)}, p90 ${fmtMin(es.p90Min)}`);
        l.push(`Errores: ${er.enviosFallidos} envíos fallidos${er.motivosEnvio.length ? ` [${er.motivosEnvio.map((m) => `${m.motivo} ×${m.n}`).join('; ')}]` : ''} · ${er.turnosConFallaLlm} turnos con falla del modelo${er.fallasPorProveedor.length ? ` [${er.fallasPorProveedor.map((x) => `${x.proveedor} ×${x.n}`).join(', ')}]` : ''} · ${er.respaldoPorFallaLlm} respuestas de respaldo · ${er.fugasBloqueadas} fugas de texto interno bloqueadas${er.motivosFuga.length ? ` [${er.motivosFuga.map((m) => `${m.motivo} ×${m.n}`).join(', ')}]` : ''} · ${er.respuestasRepetidas} respuestas repetidas${er.repetidasPorPaso.length ? ` [${er.repetidasPorPaso.map((m) => `${m.motivo} ×${m.n}`).join(', ')}]` : ''}`);
        l.push(`Comprobantes: ${c.recibidos} recibidos → ${c.aplicadosSolos} aplicados solos · ${c.aprobadosPorEscuela} aprobados por la escuela · ${c.esperandoRevision} en revisión · ${c.rechazados} rechazados · ${c.escalados} escalados · ${c.fallidos} fallidos · ${c.esperandoFamilia} esperando a la familia · ${c.ignorados} ignorados · ${c.enProceso} en proceso`);
        l.push(`Cortesías reservadas: ${e.cortesiasReservadas} · Opt-ins nuevos: ${e.optinsNuevos}`);
        l.push(`Costo: ${fmtUsd(e.costo.usd)} en ${e.costo.llamadas} llamadas${e.costo.sinPrecio ? ` (${e.costo.sinPrecio} sin precio)` : ''} · por conversación: promedio ${fmtUsd(e.costo.usdPromedioPorConversacion)}, máx ${fmtUsd(e.costo.usdMaxConversacion)} (${e.costo.conversacionesConCosto} conv.)`);
        for (const g of e.costo.porModelo) {
            l.push(`   ${g.clave}: ${g.llamadas} llamadas · ${miles(g.input)} in / ${miles(g.output)} out / ${miles(g.cacheRead)} caché leída / ${miles(g.cacheWrite)} caché escrita${g.audioSeg ? ` / ${Math.round(g.audioSeg)} s audio` : ''} → ${fmtUsd(g.usd)}${g.precioPorConfirmar ? ' (precio por confirmar)' : ''}`);
        }
    }
    l.push(`== Total del consumo: ${fmtUsd(inf.total.usd)} en ${inf.total.llamadas} llamadas · sin escuela: ${fmtUsd(inf.sinEscuela.usd)} (${inf.sinEscuela.llamadas})`);
    for (const g of inf.total.porFuncion) l.push(`   ${g.clave}: ${g.llamadas} llamadas → ${fmtUsd(g.usd)}`);
    const nota = notaCosto(inf);
    if (nota) l.push(nota);
    return l;
}

const td = (s: string | number, extra = '') =>
    `<td style="padding:4px 8px;border-bottom:1px solid #eee;${extra}">${escaparHtml(String(s))}</td>`;
const th = (s: string) => `<th style="padding:4px 8px;text-align:left;background:#f6f6f6;">${escaparHtml(s)}</th>`;

/** Correo HTML (agregados, sin contenido de conversaciones). */
export function htmlInforme(inf: InformeCalidadBot, semana: string): string {
    const filas = inf.escuelas.map((e) => `<tr>${[
        td(e.nombre, 'font-weight:bold;'),
        td(`${e.mensajes.entrantes} / ${e.mensajes.salientes}`),
        td(`${fmtPct(e.familias.pctBot)} / ${fmtPct(e.familias.pctEscuela)} / ${fmtPct(e.familias.pctSinRespuesta)}`),
        td(`${e.escalaciones.conversaciones} · ${fmtMin(e.escalaciones.medianaMin)}`),
        td(`${e.errores.enviosFallidos} · ${e.errores.turnosConFallaLlm} · ${e.errores.fugasBloqueadas} · ${e.errores.respuestasRepetidas}`),
        td(`${e.comprobantes.recibidos} (${e.comprobantes.aplicadosSolos} solos)`),
        td(`${e.cortesiasReservadas} · ${e.optinsNuevos}`),
        td(fmtUsd(e.costo.usd)),
    ].join('')}</tr>`).join('');
    const tabla = `<table style="border-collapse:collapse;font-size:13px;width:100%;"><tr>${[
        'Escuela', 'Entrantes / salientes', '% bot / escuela / sin resp.', 'Escalaciones · mediana', 'Fallidos · fallas LLM · fugas · repetidas',
        'Comprobantes', 'Cortesías · opt-ins', 'Costo',
    ].map(th).join('')}</tr>${filas}</table>`;
    const modelos = inf.total.porModelo.map((g) => `<tr>${[
        td(g.clave), td(g.llamadas), td(miles(g.input)), td(miles(g.output)), td(miles(g.cacheRead)), td(miles(g.cacheWrite)),
        td(fmtUsd(g.usd) + (g.precioPorConfirmar ? ' *' : '')),
    ].join('')}</tr>`).join('');
    const tablaModelos = modelos
        ? `<table style="border-collapse:collapse;font-size:13px;width:100%;margin-top:8px;"><tr>${[
            'Proveedor · modelo', 'Llamadas', 'Entrada', 'Salida', 'Caché leída', 'Caché escrita', 'USD'].map(th).join('')}</tr>${modelos}</table>`
        : '';
    const detalle = lineasInforme(inf).map((x) => `<p style="margin:0 0 4px;font-size:12px;color:#4a4a4a;">${escaparHtml(x)}</p>`).join('');
    return `<div style="font-family:Arial,sans-serif;max-width:900px;">
<h2 style="color:#1a1a1a;">Calidad del bot de WhatsApp — ${escaparHtml(semana)}</h2>
<p style="color:#666;font-size:12px;">Uso interno de SportMaps. Solo agregados; ningún contenido de conversaciones.</p>
${tabla}
<h3 style="margin-top:20px;">Costo por proveedor y modelo (total ${escaparHtml(fmtUsd(inf.total.usd))})</h3>
${tablaModelos || '<p style="font-size:13px;">Sin consumo registrado en el rango.</p>'}
${inf.total.porModelo.some((g) => g.precioPorConfirmar) ? '<p style="font-size:11px;color:#888;">* Precio de referencia por confirmar (llm-usage.service.ts → PRECIOS_POR_MILLON).</p>' : ''}
<h3 style="margin-top:20px;">Detalle</h3>
${detalle}
</div>`;
}

// ─── Envío semanal ──────────────────────────────────────────────────────────

/** BOT_REPORT_EMAIL (coma-separado) o, si no está, SUPPORT_ALERT_EMAIL. */
export function destinosInformeBot(): string[] {
    const crudo = process.env.BOT_REPORT_EMAIL;
    if (!crudo) return correosDeSoporte();
    const l = [...new Set(crudo.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@')))];
    return l.length ? l : correosDeSoporte();
}

/** [lunes anterior 00:00, este lunes 00:00) en hora Colombia (UTC-5 fijo). */
export function semanaAnterior(ahora = Date.now()): { inicio: number; fin: number; lunes: string } {
    const hoy = fechaColombia(ahora);
    const medianocheHoy = Date.parse(`${hoy}T05:00:00Z`);
    const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    const fin = medianocheHoy - ((diaSemana + 6) % 7) * DIA_MS;
    return { inicio: fin - 7 * DIA_MS, fin, lunes: fechaColombia(fin) };
}

/**
 * Lunes 8:00 COT. Uno por semana entre los tres BFF: reserva en `email_sends`
 * con clave determinística por lunes (`enviarConReserva`). Kill-switch:
 * DISABLE_INFORME_CALIDAD_BOT=true.
 */
export async function runInformeCalidadBotSemanal(ahora = Date.now()):
    Promise<'enviado' | 'duplicado' | 'fallo' | 'nada' | 'apagado'> {
    if (process.env.DISABLE_INFORME_CALIDAD_BOT === 'true') return 'apagado';
    try {
        const { inicio, fin, lunes } = semanaAnterior(ahora);
        const inf = await armarInformeCalidadBot({ desde: inicio, hasta: fin });
        if (!inf.escuelas.length && !inf.total.llamadas) return 'nada';
        const semana = `${fechaColombia(inicio)} al ${fechaColombia(fin - 1)}`;
        return await enviarConReserva({
            clave: `informe_calidad_bot:${lunes}`,
            tipo: 'informe_calidad_bot',
            schoolId: null,
            refId: null,
            destinos: destinosInformeBot(),
            data: {},
            plantilla: null,
            respaldo: {
                subject: `Calidad y costo del bot (${semana}) — ${fmtUsd(inf.total.usd)}`,
                titulo: `Calidad del bot de WhatsApp — ${semana}`,
                lineas: lineasInforme(inf),
                html: htmlInforme(inf, semana),
            },
        });
    } catch (err: any) {
        console.error('[informe-calidad-bot] falló:', err?.message || String(err));
        return 'fallo';
    }
}
