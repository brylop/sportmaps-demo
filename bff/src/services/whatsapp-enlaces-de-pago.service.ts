/**
 * whatsapp-enlaces-de-pago — el «Pagar» de cada cobro pendiente cuando el bot
 * da el estado de pagos (MEJORA 1, 2026-10-06).
 *
 * El enlace es la página pública del cobro (/p/:token, cobro-enlace-publico):
 * ahí ya están la transferencia, el QR de la escuela, su link de pago y el pago
 * en línea. El bot no inventa otro camino de pago; solo deja la puerta.
 *
 * Por qué hay un lookup aparte: `wa_get_payment_status` (RPC, jsonb) NO devuelve
 * el id del cobro (verificado contra la base el 2026-10-06). Para no tocar la
 * RPC (sin migración) se leen los cobros vivos del mismo pagador con el MISMO
 * filtro (parent_id + school_id + pending/partial/overdue) y se emparejan por
 * concepto + vencimiento + monto. Un cobro que no empareja se queda sin enlace:
 * mejor sin botón que con el botón de OTRO cobro.
 *
 * La base de la URL es SIEMPRE la de producción para familias
 * (`appPublica`, nunca FRONTEND_URL: los tres BFF comparten base y cron).
 *
 * Nunca lanza: cualquier falla devuelve los pagos tal cual llegaron y el bot
 * responde como antes.
 */

import { supabase } from '../config/supabase';
import { emitirTokenCobro } from './cobro-enlace-publico.service';
import { crearLinkWompiConMonto } from './wompi-link-con-monto.service';
import { appPublica, enlaceDeCobro } from '../utils/url-publica-familias';
import { etiquetaDelCobro, type CobroClasificable } from './tipo-de-cobro';

/** Máximo de enlaces por mensaje: más que eso es un muro de URLs. */
export const MAX_ENLACES_POR_MENSAJE = 5;

/** Texto del botón URL (Meta corta en 20 caracteres). */
export const TEXTO_BOTON_PAGAR = 'Pagar';

export interface PagoConEnlace {
    concept?: string | null;
    amount?: number | string | null;
    due_date?: string | null;
    status?: string | null;
    debe_pagarse?: boolean | null;
    enlace_pago?: string | null;
    /**
     * Minutos que dura `enlace_pago` cuando es el link de Wompi con el monto
     * exacto (crearLinkWompiConMonto). Ausente = página del cobro (/p/:token),
     * que no vence.
     */
    enlace_vence_min?: number | null;
    /** Lo que el modelo debe repetir junto al enlace con monto (vigencia y qué pasa al pagar). */
    enlace_instrucciones?: string | null;
    /** El aviso por WhatsApp al aprobarse quedó registrado (se puede prometer). */
    enlace_avisa?: boolean | null;
    /** Lo que cobra el link con monto (cobro + recargo en línea de la escuela). */
    enlace_total?: number | null;
    /** El recargo en línea (online_fee_pct) incluido en `enlace_total`; 0 = sin recargo. */
    enlace_recargo?: number | null;
    /**
     * Nombre humano del cobro («Mensualidad octubre 2026», «Inscripción»,
     * «Seguro de accidentes»…), solo en los pendientes. Ver `conTipoDeCobro`.
     */
    tipo_cobro?: string | null;
    [k: string]: unknown;
}

interface FilaCobro {
    id: string;
    concept: string | null;
    amount: number | string | null;
    due_date: string | null;
    status: string | null;
}

const dia = (d: unknown) => (d ? String(d).slice(0, 10) : '');
const mismoMonto = (a: unknown, b: unknown) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) < 0.5;

/**
 * Empareja cada pago pendiente de la RPC (los primeros `max`) con el id de su
 * cobro. Pura. Cada fila se usa una sola vez: dos mensualidades iguales del
 * mismo mes (dos hijos) reciben cada una su propio id. Devuelve índice → id.
 */
export function emparejarIds(
    pagos: PagoConEnlace[],
    filas: FilaCobro[],
    max = MAX_ENLACES_POR_MENSAJE,
): Map<number, string> {
    const libres = [...filas];
    const out = new Map<number, string>();
    pagos.forEach((p, i) => {
        if (out.size >= max || p?.debe_pagarse !== true) return;
        const k = libres.findIndex((f) =>
            String(f.concept ?? '') === String(p.concept ?? '')
            && dia(f.due_date) === dia(p.due_date)
            && mismoMonto(f.amount, p.amount)
            && (!p.status || f.status === p.status));
        if (k < 0) return;
        out.set(i, libres[k].id);
        libres.splice(k, 1);
    });
    return out;
}

/**
 * Los pagos de la RPC con `enlace_pago` en cada pendiente (máx. 5). Lo que no
 * tiene enlace queda igual. Nunca lanza.
 */
export async function conEnlacesDePago<T extends PagoConEnlace>(
    pagos: T[] | null | undefined,
    parentId: string | null | undefined,
    schoolId: string,
    /**
     * El chat al que va el enlace. Con esto, cuando sale el link de Wompi con
     * monto se registra el aviso de desenlace (`registrarAvisoDePagoPorLink`,
     * 15ed9235) y la familia recibe por WhatsApp «se aprobó tu pago».
     */
    aviso?: { integrationId: string; waPhone: string },
): Promise<T[]> {
    const lista = Array.isArray(pagos) ? pagos : [];
    if (!parentId || !lista.some((p) => p?.debe_pagarse === true)) return lista;
    // Un comprobante de este chat en camino (en la cola, o esperando que la
    // familia diga a cuál cobro va): no se ofrece ni se registra un link de
    // pago. Dynasty 2026-10-09: el modelo listó los pendientes con link 30 s
    // después de la foto y quedó un `payment_link` sobre el MISMO cobro que
    // el comprobante terminó pagando.
    if (aviso && await comprobanteEnCamino(aviso.integrationId, aviso.waPhone)) return lista;
    try {
        const base = appPublica();
        const { data, error } = await supabase
            .from('payments')
            .select('id, concept, amount, due_date, status')
            .eq('parent_id', parentId)
            .eq('school_id', schoolId)
            .in('status', ['pending', 'partial', 'overdue'])
            .order('due_date', { ascending: true })
            .limit(20);
        if (error || !Array.isArray(data)) return lista;

        const ids = emparejarIds(lista, data as FilaCobro[]);
        if (!ids.size) return lista;
        // Primero el link de Wompi con el monto exacto (eb1e833d): la familia no
        // escribe el valor y, al aprobarse, el pago queda aplicado solo. Si la
        // escuela no tiene pago en línea (Dynasty hoy: 'sin_pago_en_linea') o
        // algo falla, la página del cobro /p/:token como siempre.
        const enlaces = new Map<number, {
            url: string; minutos: number | null; avisa?: boolean; total?: number; recargo?: number;
        }>();
        await Promise.all([...ids].map(async ([i, id]) => {
            const wompi = await crearLinkWompiConMonto(id).catch(() => null);
            if (wompi?.ok && wompi.url) {
                const avisa = aviso ? await registrarAviso(aviso, schoolId, id) : false;
                enlaces.set(i, { url: wompi.url, minutos: wompi.minutos, avisa, total: wompi.total, recargo: wompi.recargo });
                return;
            }
            const token = await emitirTokenCobro(id);
            if (token) enlaces.set(i, { url: enlaceDeCobro(base, token), minutos: null });
        }));
        return lista.map((p, i) => {
            const e = enlaces.get(i);
            if (!e) return p;
            return e.minutos
                ? { ...p, enlace_pago: e.url, enlace_vence_min: e.minutos, enlace_avisa: e.avisa === true,
                    enlace_total: e.total ?? null, enlace_recargo: e.recargo ?? null,
                    enlace_instrucciones: instruccionesDelLinkConMonto(e.minutos, e.avisa === true,
                        { total: e.total, recargo: e.recargo }) }
                : { ...p, enlace_pago: e.url };
        });
    } catch (e: any) {
        console.warn('[whatsapp-enlaces-de-pago] sin enlaces', { error: e?.message });
        return lista;
    }
}

/** Cuánto hacia atrás cuenta un comprobante de la cola como «en camino». */
export const VENTANA_COMPROBANTE_EN_CAMINO_MIN = 30;

/**
 * ¿Alguna fila de comprobante de este número sigue abierta (pendiente, en
 * proceso o esperando la respuesta de la familia) desde hace menos de 30 min?
 * Pura.
 */
export function hayComprobanteEnCamino(
    filas: { status?: string | null; message_type?: string | null; created_at?: string | null }[],
    ahora = Date.now(),
): boolean {
    const desde = ahora - VENTANA_COMPROBANTE_EN_CAMINO_MIN * 60_000;
    return (Array.isArray(filas) ? filas : []).some((f) =>
        ['pending', 'processing', 'waiting_user'].includes(String(f?.status ?? ''))
        && f?.message_type !== 'payment_link'
        && Date.parse(String(f?.created_at ?? '')) >= desde);
}

/** Lee la cola del número y aplica `hayComprobanteEnCamino`. Ante un error, no bloquea. */
async function comprobanteEnCamino(integrationId: string, waPhone: string): Promise<boolean> {
    try {
        const { data } = await supabase.from('whatsapp_inbound_queue')
            .select('status, message_type, created_at')
            .eq('integration_id', integrationId)
            .eq('wa_phone_number', waPhone)
            .in('status', ['pending', 'processing', 'waiting_user'])
            .gte('created_at', new Date(Date.now() - VENTANA_COMPROBANTE_EN_CAMINO_MIN * 60_000).toISOString())
            .limit(5);
        return hayComprobanteEnCamino(Array.isArray(data) ? data as any[] : []);
    } catch {
        return false;
    }
}

/** «tienes 1 hora para pagar» / «tienes 30 minutos para pagar». Pura. */
export function plazoParaPagar(minutos: number): string {
    if (minutos % 60 === 0) {
        const h = minutos / 60;
        return h === 1 ? '1 hora' : `${h} horas`;
    }
    return `${minutos} minutos`;
}

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

/**
 * Lo que acompaña al link con monto. «Te aviso por aquí» SOLO si el aviso de
 * desenlace quedó registrado (`avisa`); si no, no se promete.
 *
 * Con recargo en línea (online_fee_pct de la escuela) se dice cuánto cobra el
 * link y cuánto es el recargo (auditoría 2026-10-10): en Wompi la familia ve
 * un valor distinto al de su cobro y no sabía por qué.
 */
export function instruccionesDelLinkConMonto(
    minutos: number,
    avisa = false,
    montos?: { total?: number | null; recargo?: number | null },
): string {
    const recargo = Number(montos?.recargo ?? 0);
    const total = Number(montos?.total ?? 0);
    const valor = recargo > 0 && total > 0
        ? `El link cobra ${cop(total)} (incluye ${cop(recargo)} de recargo por pago en línea). `
        : '';
    return `${valor}Tienes ${plazoParaPagar(minutos)} para pagar con ese link; al aprobarse, el pago queda aplicado solo` +
        (avisa ? ' y te aviso por aquí.' : '.');
}

/** Registra el aviso de desenlace del pago por link. Import diferido: el job importa servicios del bot. Nunca lanza. */
async function registrarAviso(aviso: { integrationId: string; waPhone: string }, schoolId: string, paymentId: string): Promise<boolean> {
    try {
        const { registrarAvisoDePagoPorLink } = await import('../jobs/whatsapp-payment-outcome.job');
        const r = await registrarAvisoDePagoPorLink({
            integrationId: aviso.integrationId, schoolId, waPhone: aviso.waPhone, paymentId,
        });
        return r.ok;
    } catch {
        return false;
    }
}

/** «Pagar: <url>» para el texto del mensaje, o null. */
export function lineaPagar(p: PagoConEnlace | null | undefined): string | null {
    if (!p?.enlace_pago) return null;
    return p.enlace_vence_min
        ? `   Pagar: ${p.enlace_pago}\n   (${instruccionesDelLinkConMonto(p.enlace_vence_min, p.enlace_avisa === true,
            { total: p.enlace_total, recargo: p.enlace_recargo })})`
        : `   Pagar: ${p.enlace_pago}`;
}

/**
 * Si hay UN solo cobro pendiente y trae enlace, el botón URL de WhatsApp para
 * él. Con varios no: un botón cta_url lleva una sola URL y elegir uno sería
 * esconder los otros.
 */
export function botonPagarUnico(pagos: PagoConEnlace[] | null | undefined): { texto: string; url: string } | null {
    const pendientes = (Array.isArray(pagos) ? pagos : []).filter((p) => p?.debe_pagarse === true);
    if (pendientes.length !== 1 || !pendientes[0].enlace_pago) return null;
    return { texto: TEXTO_BOTON_PAGAR, url: pendientes[0].enlace_pago };
}

// ─── Tipo de cada cobro (pagos únicos, 2026-10-10) ──────────────────────────

/**
 * Los pagos de la RPC con `tipo_cobro` en cada pendiente: «Mensualidad octubre
 * 2026», «Inscripción», «Seguro de accidentes», «Torneo»… La RPC no trae
 * `payment_category` ni `payment_type`, así que se leen los cobros vivos del
 * mismo pagador y se emparejan igual que los enlaces (concepto + vencimiento +
 * monto + estado). Lo que no empareja se nombra por su concepto. Nunca lanza:
 * ante cualquier falla, el nombre sale del concepto.
 */
export async function conTipoDeCobro<T extends PagoConEnlace>(
    pagos: T[] | null | undefined,
    parentId: string | null | undefined,
    schoolId: string,
): Promise<T[]> {
    const lista = Array.isArray(pagos) ? pagos : [];
    if (!lista.some((p) => p?.debe_pagarse === true)) return lista;
    let filas: (FilaCobro & CobroClasificable)[] = [];
    if (parentId) {
        try {
            const { data, error } = await supabase
                .from('payments')
                .select('id, concept, amount, due_date, status, payment_category, payment_type, period_year, period_month')
                .eq('parent_id', parentId)
                .eq('school_id', schoolId)
                .in('status', ['pending', 'partial', 'overdue'])
                .order('due_date', { ascending: true })
                .limit(50);
            if (!error && Array.isArray(data)) filas = data as any[];
        } catch { /* se nombra por el concepto */ }
    }
    const porId = new Map(filas.map((f) => [f.id, f]));
    const ids = emparejarIds(lista, filas, Number.POSITIVE_INFINITY);
    return lista.map((p, i) => {
        if (p?.debe_pagarse !== true) return p;
        const fila = porId.get(ids.get(i) ?? '');
        const tipo = etiquetaDelCobro(fila ?? { concept: p.concept ?? null, due_date: p.due_date ?? null });
        return { ...p, tipo_cobro: tipo };
    });
}
