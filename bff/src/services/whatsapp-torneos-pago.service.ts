/**
 * whatsapp-torneos-pago — que cada pago de torneo quede con torneo, deportista
 * y QUIÉN PAGÓ (spec whatsapp-conversacion-v2-dynasty §3.6, control de Milena).
 *
 * Hoy Dynasty tiene 0 ítems en `school_tournament_items` y 0 cobros únicos: un
 * comprobante de torneo cae en «otro concepto» y se escala sin cruzarse. Acá:
 *
 *  1. `cruzarTorneo`: concepto/pie + monto contra el catálogo de la escuela →
 *     el torneo propuesto. Pura. Sin catálogo DEGRADA bien: no inventa nada,
 *     deja el motivo `otro_concepto: torneo …` con el nombre de quien pagó.
 *  2. `motivoTorneo`: el `error_message` de la bandeja, con quién pagó (el
 *     `originName` del comprobante, que el estampado guarda en
 *     `payments.ocr_origin_name`), el deportista y la propuesta. Pura.
 *  3. `listarPagosDeTorneo(schoolId)`: el reporte «Torneos: quién pagó qué»
 *     (servicio, sin ruta ni pantalla: las hace otro agente).
 *
 * `payments.payment_category = 'torneo'` es un valor válido del CHECK
 * (migraciones 20260908152538 y 20261014153538). El cobro de torneo lo crea la
 * escuela; este módulo NUNCA crea cobros ni aprueba: solo cruza y lista.
 *
 * Un abono (monto menor al ítem) solo se propone cuando el ítem permite cuotas
 * (`allow_installments`); si no, va a la bandeja como monto distinto.
 */

import { supabase } from '../config/supabase';
import { normalizarFrase } from './whatsapp-reglas-turno';
import { conRecargoDeLink, ABONO_MINIMO_PCT, motivoConPropuesta } from './whatsapp-pago-esperado.service';

export interface ItemDeTorneo {
    id: string;
    name: string;
    price: number;
    per_athlete: boolean;
    allow_installments: boolean;
    event_id: string | null;
    active?: boolean;
}

export type ResultadoCruceTorneo =
    | { tipo: 'sin_catalogo' }
    /** El texto no nombra ningún ítem y el monto no es el de ninguno. */
    | { tipo: 'sin_coincidencia' }
    | { tipo: 'ambiguo'; items: ItemDeTorneo[] }
    | {
        tipo: 'propuesto';
        item: ItemDeTorneo;
        /** `nombre`: el texto lo nombra. `monto`: solo el precio coincide. */
        via: 'nombre' | 'monto' | 'nombre_y_monto';
        /** `exacto`, `con_recargo` (enlace de pago) o `abono` (menor y el ítem permite cuotas). */
        monto: 'exacto' | 'con_recargo' | 'abono' | 'distinto';
        saldo?: number;
    };

const cop = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/** Palabras del nombre de un ítem que lo distinguen (sin «torneo», «copa», artículos…). */
const GENERICAS = new Set(['torneo', 'torneos', 'copa', 'campeonato', 'festival', 'de', 'del', 'la', 'las', 'los', 'el',
    'para', 'por', 'con', 'inscripcion', 'valor', 'pago', 'cuota', 'sub']);

export function palabrasDistintivas(nombre: string): string[] {
    return [...new Set(normalizarFrase(nombre).split(' ').filter((w) => w.length >= 3 && !GENERICAS.has(w) && !/^\d+$/.test(w)))];
}

/** Cuántas palabras distintivas del ítem aparecen en los textos. */
function aciertos(item: ItemDeTorneo, texto: string): number {
    const t = ` ${texto} `;
    return palabrasDistintivas(item.name).filter((w) => t.includes(` ${w} `)).length;
}

/**
 * Cruza lo que dice el comprobante (pie, descripción, chat) y el monto con el
 * catálogo. Pura.
 */
export function cruzarTorneo(e: {
    textos: (string | null | undefined)[];
    monto: number | null;
    items: ItemDeTorneo[];
}): ResultadoCruceTorneo {
    const items = e.items.filter((i) => i.active !== false);
    if (items.length === 0) return { tipo: 'sin_catalogo' };
    const texto = normalizarFrase(e.textos.filter(Boolean).join(' \n '));

    const porNombre = items.map((i) => ({ i, n: aciertos(i, texto) })).filter((x) => x.n > 0);
    const mejor = Math.max(0, ...porNombre.map((x) => x.n));
    const nombrados = porNombre.filter((x) => x.n === mejor).map((x) => x.i);
    const porPrecio = e.monto === null ? [] : items.filter((i) => Number(i.price) === e.monto
        || conRecargoDeLink(Number(i.price)) === e.monto);

    let candidatos = nombrados;
    let via: 'nombre' | 'monto' | 'nombre_y_monto' = 'nombre';
    if (nombrados.length > 1) {
        // El monto desempata entre los nombrados.
        const exactos = nombrados.filter((i) => porPrecio.includes(i));
        if (exactos.length === 1) { candidatos = exactos; via = 'nombre_y_monto'; }
    } else if (nombrados.length === 1 && porPrecio.includes(nombrados[0])) {
        via = 'nombre_y_monto';
    } else if (nombrados.length === 0 && porPrecio.length > 0) {
        candidatos = porPrecio; via = 'monto';
    }
    if (candidatos.length === 0) return { tipo: 'sin_coincidencia' };
    if (candidatos.length > 1) return { tipo: 'ambiguo', items: candidatos.slice(0, 3) };

    const item = candidatos[0];
    const precio = Number(item.price);
    let monto: 'exacto' | 'con_recargo' | 'abono' | 'distinto' = 'distinto';
    let saldo: number | undefined;
    if (e.monto !== null) {
        if (e.monto === precio) monto = 'exacto';
        else if (e.monto === conRecargoDeLink(precio)) monto = 'con_recargo';
        else if (e.monto < precio && e.monto >= precio * ABONO_MINIMO_PCT && item.allow_installments) {
            monto = 'abono'; saldo = precio - e.monto;
        }
    }
    return { tipo: 'propuesto', item, via, monto, ...(saldo !== undefined ? { saldo } : {}) };
}

/** La propuesta del cruce en una línea (va dentro del motivo). Pura. */
export function textoCruceTorneo(r: ResultadoCruceTorneo, monto: number | null): string {
    switch (r.tipo) {
        case 'sin_catalogo':
            return 'la escuela no tiene torneos cargados en el catálogo: registrar el pago a mano (categoría torneo)';
        case 'sin_coincidencia':
            return 'ningún torneo del catálogo coincide con el texto ni con el monto: registrar a mano (categoría torneo)';
        case 'ambiguo':
            return `puede ser ${r.items.map((i) => `${i.name} ${cop(Number(i.price))}`).join(' | ')}`;
        case 'propuesto': {
            const base = `torneo: ${r.item.name} (${cop(Number(r.item.price))}${r.item.per_athlete ? ' por deportista' : ''})`;
            if (r.monto === 'exacto') return `${base}; el monto coincide`;
            if (r.monto === 'con_recargo') return `${base}; el monto es el del enlace de pago (con recargo)`;
            if (r.monto === 'abono') return `${base}; abono de ${monto === null ? '?' : cop(monto)} (saldo ${cop(r.saldo ?? 0)}), el torneo permite cuotas`;
            return `${base}; el monto leído${monto === null ? '' : ` (${cop(monto)})`} no es el del torneo${r.item.allow_installments ? '' : ' y no permite cuotas'}`;
        }
    }
}

/**
 * El `error_message` de un comprobante de torneo. Siempre empieza por
 * `otro_concepto: torneo` (la bandeja lo clasifica por ese prefijo) y deja
 * VISIBLE quién pagó. Pura.
 */
export function motivoTorneo(e: {
    /** `originName` del comprobante: quién hizo la transferencia. */
    quienPago: string | null | undefined;
    deportista?: string | null;
    monto: number | null;
    cruce: ResultadoCruceTorneo;
    evidencia?: string | null;
    max?: number;
}): string {
    const base = `otro_concepto: torneo${e.evidencia ? ` («${e.evidencia}»)` : ''}`;
    const quien = e.quienPago && e.quienPago.trim() ? e.quienPago.trim() : 'no se leyó en el comprobante';
    const prop = `Propuesta → pagó: ${quien}${e.deportista ? ` · deportista: ${e.deportista}` : ' · deportista: sin identificar'}`
        + ` · ${textoCruceTorneo(e.cruce, e.monto)}`;
    return motivoConPropuesta(base, prop, e.max ?? 500);
}

/** Ítems activos del catálogo de la escuela. Nunca lanza (ante un error, sin catálogo). */
export async function cargarItemsDeTorneo(schoolId: string): Promise<ItemDeTorneo[]> {
    try {
        const { data, error } = await supabase.from('school_tournament_items')
            .select('id, name, price, per_athlete, allow_installments, event_id, active')
            .eq('school_id', schoolId).eq('active', true).limit(200);
        if (error || !Array.isArray(data)) return [];
        return (data as any[]).map((r) => ({
            id: r.id, name: String(r.name ?? ''), price: Number(r.price ?? 0),
            per_athlete: r.per_athlete === true, allow_installments: r.allow_installments === true,
            event_id: r.event_id ?? null, active: r.active !== false,
        }));
    } catch {
        return [];
    }
}

// ─── Reporte «Torneos: quién pagó qué» ───────────────────────────────────────

export interface PagoDeTorneoFila {
    pagoId: string;
    estado: string;
    concepto: string | null;
    deportista: string | null;
    /** Quién hizo la transferencia (`payments.ocr_origin_name`). */
    quienPago: string | null;
    monto: number;
    abonado: number | null;
    montoLeido: number | null;
    fechaPago: string | null;
    vence: string | null;
}

export interface TorneoConPagos {
    itemId: string | null;
    torneo: string;
    precio: number | null;
    porDeportista: boolean;
    permiteCuotas: boolean;
    pagos: PagoDeTorneoFila[];
    /** Suma de lo ya cobrado (paid) + abonado (partial). */
    totalCobrado: number;
    /** Suma de lo que sigue pendiente, en revisión o abonado a medias. */
    totalPorCobrar: number;
}

export interface ComprobanteDeTorneoSinRegistrar {
    filaId: string;
    llego: string;
    detalle: string;
}

export interface ReporteTorneos {
    torneos: TorneoConPagos[];
    /** Pagos de torneo que no se pudieron ligar a un ítem del catálogo (catálogo vacío incluido). */
    sinCatalogo: TorneoConPagos | null;
    /** Comprobantes de torneo que están en la bandeja sin cobro donde aplicarse. */
    porRegistrar: ComprobanteDeTorneoSinRegistrar[];
}

/** ¿El concepto del cobro nombra a este ítem? Pura. */
export function itemDelPago(concepto: string | null | undefined, items: ItemDeTorneo[]): ItemDeTorneo | null {
    const t = normalizarFrase(concepto);
    if (!t) return null;
    const conAciertos = items.map((i) => ({ i, n: aciertos(i, t) })).filter((x) => x.n > 0);
    if (!conAciertos.length) return null;
    const mejor = Math.max(...conAciertos.map((x) => x.n));
    const empatados = conAciertos.filter((x) => x.n === mejor);
    return empatados.length === 1 ? empatados[0].i : null;
}

const ESTADOS_COBRADO = new Set(['paid']);

/** Agrupa las filas de pagos por torneo. Pura. */
export function agruparPagosDeTorneo(pagos: PagoDeTorneoFila[], items: ItemDeTorneo[]): { torneos: TorneoConPagos[]; sinCatalogo: TorneoConPagos | null } {
    const grupos = new Map<string, TorneoConPagos>();
    const sin: PagoDeTorneoFila[] = [];
    for (const p of pagos) {
        const item = itemDelPago(p.concepto, items);
        if (!item) { sin.push(p); continue; }
        if (!grupos.has(item.id)) {
            grupos.set(item.id, {
                itemId: item.id, torneo: item.name, precio: Number(item.price), porDeportista: item.per_athlete,
                permiteCuotas: item.allow_installments, pagos: [], totalCobrado: 0, totalPorCobrar: 0,
            });
        }
        grupos.get(item.id)!.pagos.push(p);
    }
    const sumar = (g: TorneoConPagos) => {
        for (const p of g.pagos) {
            const abonado = Number(p.abonado ?? 0);
            if (ESTADOS_COBRADO.has(p.estado)) g.totalCobrado += p.monto;
            else if (p.estado === 'partial') { g.totalCobrado += abonado; g.totalPorCobrar += Math.max(p.monto - abonado, 0); }
            else if (p.estado !== 'cancelled' && p.estado !== 'rejected' && p.estado !== 'failed') g.totalPorCobrar += p.monto;
        }
        return g;
    };
    const torneos = [...grupos.values()].map(sumar).sort((a, b) => a.torneo.localeCompare(b.torneo));
    const sinCatalogo = sin.length
        ? sumar({ itemId: null, torneo: 'Sin torneo identificado en el catálogo', precio: null, porDeportista: false, permiteCuotas: false, pagos: sin, totalCobrado: 0, totalPorCobrar: 0 })
        : null;
    return { torneos, sinCatalogo };
}

/**
 * «Torneos: quién pagó qué»: los cobros con `payment_category='torneo'` de la
 * escuela agrupados por torneo del catálogo, con deportista y quién pagó, más
 * los comprobantes de torneo que esperan en la bandeja. Solo lectura. Un error
 * de lectura devuelve el reporte vacío (nunca lanza).
 */
export async function listarPagosDeTorneo(schoolId: string): Promise<ReporteTorneos> {
    const vacio: ReporteTorneos = { torneos: [], sinCatalogo: null, porRegistrar: [] };
    try {
        const [items, pagosRes, colaRes] = await Promise.all([
            cargarItemsDeTorneo(schoolId),
            supabase.from('payments')
                .select('id, status, concept, amount, amount_paid, ocr_amount, ocr_origin_name, payment_date, due_date, '
                    + 'child_id, unregistered_athlete_id, child:children(full_name), sin_registrar:unregistered_athletes(full_name)')
                .eq('school_id', schoolId).eq('payment_category', 'torneo')
                .order('created_at', { ascending: false }).limit(1000),
            supabase.from('whatsapp_inbound_queue')
                .select('id, created_at, error_message')
                .eq('school_id', schoolId).eq('status', 'ignored').eq('result_type', 'escalated')
                .ilike('error_message', '%otro_concepto: torneo%')
                .order('created_at', { ascending: false }).limit(200),
        ]);
        const filas: PagoDeTorneoFila[] = ((pagosRes.data ?? []) as any[]).map((p) => ({
            pagoId: p.id, estado: String(p.status ?? ''), concepto: p.concept ?? null,
            deportista: (Array.isArray(p.child) ? p.child[0] : p.child)?.full_name
                ?? (Array.isArray(p.sin_registrar) ? p.sin_registrar[0] : p.sin_registrar)?.full_name ?? null,
            quienPago: p.ocr_origin_name ?? null,
            monto: Number(p.amount ?? 0),
            abonado: p.amount_paid === null || p.amount_paid === undefined ? null : Number(p.amount_paid),
            montoLeido: p.ocr_amount === null || p.ocr_amount === undefined ? null : Number(p.ocr_amount),
            fechaPago: p.payment_date ?? null, vence: p.due_date ?? null,
        }));
        const { torneos, sinCatalogo } = agruparPagosDeTorneo(filas, items);
        const porRegistrar = ((colaRes.data ?? []) as any[])
            .filter((f) => !String(f.error_message ?? '').startsWith('cerrado_escuela:'))
            .map((f) => ({ filaId: f.id as string, llego: f.created_at as string, detalle: String(f.error_message ?? '') }));
        return { torneos, sinCatalogo, porRegistrar };
    } catch {
        return vacio;
    }
}
