/**
 * A qué pago se aplica un comprobante que llegó por WhatsApp.
 *
 * Es el punto delicado de toda la fase: aplicar un comprobante al pago
 * equivocado es tocar dinero de un tercero. En Dynasty hay cientos de pendientes
 * y padres con varios hijos, así que la regla de oro es **no adivinar**: cuando
 * el monto no desempata, se pregunta.
 *
 * Plan: docs/specs/whatsapp-cola-de-comprobantes-plan.md §4.5 y §4.6
 */

import { supabase } from '../config/supabase';

/** Pago pendiente del acudiente, con lo mínimo para nombrarlo en el chat. */
export interface PagoPendiente {
    id: string;
    amount: number;
    concept: string | null;
    due_date: string | null;
    child_id: string | null;
    atleta: string | null;
}

export type Coincidencia =
    | { tipo: 'unico'; pago: PagoPendiente }
    | { tipo: 'por_monto'; pago: PagoPendiente }
    | { tipo: 'combinacion'; pagos: PagoPendiente[] }
    | { tipo: 'preguntar'; opciones: PagoPendiente[] }
    | { tipo: 'sin_pendientes' };

/**
 * Tope de pendientes para buscar combinaciones. Por encima, la búsqueda se
 * vuelve cara Y ambigua (con 20 pendientes casi cualquier monto suma de varias
 * formas), así que se pregunta en vez de proponer.
 */
const TOPE_COMBINACIONES = 8;

/** Cuántas opciones se ofrecen en el mensaje antes de que sea ilegible. */
export const TOPE_OPCIONES = 5;

/** Pendientes del acudiente en esa escuela, del más viejo al más nuevo. */
export async function pagosPendientesDe(
    parentId: string,
    schoolId: string,
): Promise<PagoPendiente[]> {
    const { data, error } = await supabase
        .from('payments')
        .select('id, amount, concept, due_date, child_id, child:children(full_name)')
        .eq('parent_id', parentId)
        .eq('school_id', schoolId)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(50);

    if (error || !data) return [];

    return data.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        concept: p.concept ?? null,
        due_date: p.due_date ?? null,
        child_id: p.child_id ?? null,
        atleta: p.child?.full_name ?? null,
    }));
}

/**
 * Subconjuntos cuya suma da exactamente `objetivo`.
 *
 * Corta apenas encuentra dos, porque con dos ya sabemos que es ambiguo y no hay
 * que seguir gastando: la decisión es «preguntar», venga de dos combinaciones o
 * de doscientas.
 */
function subconjuntosQueSuman(pagos: PagoPendiente[], objetivo: number): PagoPendiente[][] {
    const encontrados: PagoPendiente[][] = [];

    const buscar = (desde: number, restante: number, acumulado: PagoPendiente[]) => {
        if (encontrados.length >= 2) return;
        if (restante === 0 && acumulado.length > 0) { encontrados.push([...acumulado]); return; }
        if (restante < 0) return;
        for (let i = desde; i < pagos.length; i++) {
            acumulado.push(pagos[i]);
            buscar(i + 1, restante - pagos[i].amount, acumulado);
            acumulado.pop();
            if (encontrados.length >= 2) return;
        }
    };

    buscar(0, objetivo, []);
    return encontrados;
}

/**
 * Decide a qué pago (o pagos) corresponde un comprobante de `monto`.
 *
 * `monto` null significa que el OCR no pudo leerlo: ahí no se aplica nada por
 * monto, solo vale el caso de un único pendiente.
 */
export function resolverPago(pendientes: PagoPendiente[], monto: number | null): Coincidencia {
    if (pendientes.length === 0) return { tipo: 'sin_pendientes' };

    // Un solo pendiente: no hay a qué otra cosa aplicarlo.
    if (pendientes.length === 1) return { tipo: 'unico', pago: pendientes[0] };

    if (monto !== null) {
        // El monto coincide con EXACTAMENTE uno → se aplica a ese, y la
        // respuesta dice a cuál para que el padre pueda corregir.
        const exactos = pendientes.filter((p) => p.amount === monto);
        if (exactos.length === 1) return { tipo: 'por_monto', pago: exactos[0] };

        // Varios del MISMO monto: el monto no desempata. Preguntar.
        if (exactos.length > 1) {
            return { tipo: 'preguntar', opciones: exactos.slice(0, TOPE_OPCIONES) };
        }

        // Una transferencia que cubre varios pendientes. Caso real y frecuente:
        // dos hijos, un solo pago por la suma. Solo se propone si hay UNA
        // combinación posible; con dos ya es ambiguo.
        if (pendientes.length <= TOPE_COMBINACIONES) {
            const combos = subconjuntosQueSuman(pendientes, monto);
            if (combos.length === 1) return { tipo: 'combinacion', pagos: combos[0] };
        }
    }

    return { tipo: 'preguntar', opciones: pendientes.slice(0, TOPE_OPCIONES) };
}

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/** Normaliza para comparar nombres sin tildes ni mayúsculas. */
const plano = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/**
 * Cómo se nombra un pago en el chat, para que el acudiente lo reconozca.
 *
 * El nombre del atleta solo se agrega si el concepto no lo trae ya. En la base,
 * la mayoría de los conceptos son del estilo "Mensualidad 08/2026 - SARA ISABELLA
 * ROJAS MORENO", y agregarlo igual producía "… - SARA ISABELLA ROJAS MORENO de
 * SARA ISABELLA ROJAS MORENO".
 */
export function describirPago(p: PagoPendiente): string {
    const concepto = p.concept ?? 'Cobro';
    const partes = [concepto];
    if (p.atleta && !plano(concepto).includes(plano(p.atleta))) partes.push(`de ${p.atleta}`);
    partes.push(`por ${cop(p.amount)}`);
    if (p.due_date) partes.push(`(vence ${p.due_date})`);
    return partes.join(' ');
}

/** Lista numerada para que el acudiente elija, cuando el monto no desempata. */
export function mensajeElegirPago(opciones: PagoPendiente[]): string {
    const lineas = opciones.map((p, i) => `${i + 1}. ${describirPago(p)}`);
    return (
        'Recibí tu comprobante, pero tienes varios cobros pendientes y no quiero ' +
        'aplicarlo al que no es 🤔\n\n' +
        `${lineas.join('\n')}\n\n` +
        'Respóndeme con el número al que corresponde.'
    );
}
