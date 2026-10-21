/**
 * «Mismo cobro, dos pantallas»: dos personas de la escuela registran lo MISMO en
 * pocos minutos, cada una con su propio client_request_id.
 *
 * Lo que ya frena la base: el mismo client_request_id (uq_charge_batches_request),
 * la mensualidad del mismo período (uniq_payment_active_period_*), el mismo
 * comprobante (uq_payments_school_receipt_hash) y las horas del mismo pago
 * (uq_hour_bank_grants_payment). Lo que NO frena nada: un cobro que no es de
 * período (otro cobro, «Hora adicional consumida», horas por adelantado, torneo…)
 * repetido desde otra pantalla. Esto lo detecta mirando los lotes recientes.
 *
 * No es un bloqueo duro: el modal enseña quién y cuándo lo registró y el usuario
 * puede confirmar que de verdad es otro cobro (`confirmar_duplicado`). Un reintento
 * con el MISMO client_request_id nunca cae aquí: sigue siendo idempotente y la RPC
 * responde `duplicated: true`.
 */
import { supabase } from '../config/supabase';
import { CobrosError, lineasParaRpc } from './charge-batches.service';
import type { ChargeBatchRequest } from './charge-batches.schemas';

export const VENTANA_DUPLICADO_MIN = 15;
const MAX_CANDIDATOS = 50;

export interface CobroReciente {
    batch_id: string;
    created_at: string;
    minutes_ago: number;
    created_by: string | null;
    created_by_name: string | null;
    total_amount: number | null;
}

interface LoteCandidato {
    id: string;
    client_request_id?: string | null;
    mode?: string | null;
    target?: { kind?: string; ids?: unknown } | null;
    lines?: unknown;
    created_by?: string | null;
    created_at: string;
    annulled_at?: string | null;
    total_amount?: number | string | null;
}

type PedidoParaFirma = Pick<ChargeBatchRequest, 'mode' | 'target' | 'athletes' | 'lines' | 'new_athlete'>;

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Firma de las líneas: categoría + concepto + valor + vencimiento, sin importar el orden. */
export function firmaDeLineas(lineas: unknown): string | null {
    if (!Array.isArray(lineas) || lineas.length === 0) return null;
    const partes = lineas.map((l: any) => [
        norm(l?.category),
        norm(l?.concept),
        l?.amount == null ? '' : String(Math.round(Number(l.amount))),
        String(l?.due_date ?? ''),
    ].join('|'));
    return partes.sort().join('§');
}

function firmaDeIds(kind: unknown, ids: unknown): string | null {
    if (!Array.isArray(ids)) return null;
    const limpios = [...new Set(ids.filter((x): x is string => typeof x === 'string'))].sort();
    // Sin ids no se sabe a quién va (p. ej. una «lista» cuyos atletas no se guardan en el lote): no se compara.
    if (limpios.length === 0) return null;
    return `${norm(kind)}:${limpios.join(',')}`;
}

/** Firma del destino del pedido: en modo un atleta, el atleta; en varios, el grupo tal como lo guarda el lote. */
export function firmaDelPedido(b: PedidoParaFirma): { destino: string; lineas: string } | null {
    if (b.new_athlete) return null; // el atleta nuevo no existe todavía: no hay con qué comparar
    const lineas = firmaDeLineas(lineasParaRpc(b));
    if (!lineas) return null; // solo pagos de pendientes: lo cubren COBRO_CERRADO / PREVIEW_STALE
    const destino = b.mode === 'single'
        ? firmaDeIds('athlete', b.athletes.map((a) => a.id))
        : firmaDeIds(b.target.kind, b.target.ids);
    return destino ? { destino, lineas } : null;
}

/** Lotes ya creados que son idénticos al pedido (misma escuela ya viene filtrada). Pura: sin base ni reloj propio. */
export function lotesIdenticos(
    candidatos: LoteCandidato[],
    pedido: { destino: string; lineas: string },
    clientRequestId: string | undefined,
    ahora: number,
): LoteCandidato[] {
    const desde = ahora - VENTANA_DUPLICADO_MIN * 60_000;
    return candidatos.filter((c) => {
        if (c.annulled_at) return false;
        if (clientRequestId && c.client_request_id === clientRequestId) return false; // mismo envío = idempotente, no duplicado
        const t = Date.parse(c.created_at);
        if (!Number.isFinite(t) || t < desde) return false;
        if (firmaDeIds(c.target?.kind, c.target?.ids) !== pedido.destino) return false;
        return firmaDeLineas(c.lines) === pedido.lineas;
    });
}

/** Una consulta de lotes recientes + una de nombres (sin N+1). Devuelve [] si no hay coincidencia o no se puede decidir. */
export async function buscarCobroDuplicadoReciente(
    schoolId: string,
    b: PedidoParaFirma,
    clientRequestId?: string,
    ahora: number = Date.now(),
): Promise<CobroReciente[]> {
    const firma = firmaDelPedido(b);
    if (!firma) return [];
    const desde = new Date(ahora - VENTANA_DUPLICADO_MIN * 60_000).toISOString();
    let q = supabase.from('charge_batches')
        .select('id, client_request_id, mode, target, lines, created_by, created_at, annulled_at, total_amount')
        .eq('school_id', schoolId)
        .is('annulled_at', null)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(MAX_CANDIDATOS);
    if (clientRequestId) q = q.neq('client_request_id', clientRequestId);
    const { data, error } = await q;
    // Este aviso es una red de seguridad: si la consulta falla, no se frena una operación legítima.
    if (error) return [];
    const iguales = lotesIdenticos((data ?? []) as LoteCandidato[], firma, clientRequestId, ahora);
    if (iguales.length === 0) return [];

    const autores = [...new Set(iguales.map((l) => l.created_by).filter((x): x is string => !!x))];
    const nombres = new Map<string, string>();
    if (autores.length) {
        const { data: perfiles } = await supabase.from('profiles').select('id, full_name').in('id', autores);
        for (const p of (perfiles ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) nombres.set(p.id, p.full_name);
    }
    return iguales.map((l) => ({
        batch_id: l.id,
        created_at: l.created_at,
        minutes_ago: Math.max(0, Math.round((ahora - Date.parse(l.created_at)) / 60_000)),
        created_by: l.created_by ?? null,
        created_by_name: (l.created_by && nombres.get(l.created_by)) || null,
        total_amount: l.total_amount == null ? null : Number(l.total_amount),
    }));
}

export function mensajeDeDuplicado(c: CobroReciente): string {
    const quien = c.created_by_name ? ` por ${c.created_by_name}` : '';
    const hace = c.minutes_ago <= 0 ? 'hace menos de un minuto' : `hace ${c.minutes_ago} min`;
    return `Este mismo cobro ya se registró ${hace}${quien}.`;
}

/** Confirmar: si hay un lote idéntico reciente y no se confirmó expresamente, 409 con las coincidencias. */
export async function verificarCobroDuplicado(
    schoolId: string,
    b: PedidoParaFirma & { client_request_id: string; confirmar_duplicado?: boolean },
): Promise<void> {
    if (b.confirmar_duplicado) return;
    const coincidencias = await buscarCobroDuplicadoReciente(schoolId, b, b.client_request_id);
    if (coincidencias.length === 0) return;
    throw new CobrosError(
        409,
        'COBRO_DUPLICADO_RECIENTE',
        `${mensajeDeDuplicado(coincidencias[0])} Si de verdad es otro cobro, confirma para crearlo igual.`,
        { duplicates: coincidencias },
    );
}
