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
import { appPublica, enlaceDeCobro } from '../utils/url-publica-familias';

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
): Promise<T[]> {
    const lista = Array.isArray(pagos) ? pagos : [];
    if (!parentId || !lista.some((p) => p?.debe_pagarse === true)) return lista;
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
        const tokens = new Map<number, string | null>();
        await Promise.all([...ids].map(async ([i, id]) => {
            tokens.set(i, await emitirTokenCobro(id));
        }));
        return lista.map((p, i) => {
            const token = tokens.get(i);
            return token ? { ...p, enlace_pago: enlaceDeCobro(base, token) } : p;
        });
    } catch (e: any) {
        console.warn('[whatsapp-enlaces-de-pago] sin enlaces', { error: e?.message });
        return lista;
    }
}

/** «Pagar: <url>» para el texto del mensaje, o null. */
export function lineaPagar(p: PagoConEnlace | null | undefined): string | null {
    return p?.enlace_pago ? `   Pagar: ${p.enlace_pago}` : null;
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
