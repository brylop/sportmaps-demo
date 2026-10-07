/**
 * «El valor no coincide» (ajuste `wa_reclamos_de_valor`, spec
 * docs/specs/whatsapp-ajustes-por-escuela.md).
 *
 * Un reclamo de valor lo resuelve una persona: el bot NO corrige ni explica el
 * cobro (el modelo inventaría una razón). Le muestra a la familia sus cobros
 * abiertos, le pide el valor que le informaron o el comprobante, y abre la
 * conversación en el buzón con un motivo que ya dice qué cobros hay —el correo
 * a la escuela lo lleva tal cual—.
 */
import { supabase } from '../config/supabase';

function normalizar(t: string | null | undefined): string {
    return String(t ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const DINERO = /\b(valor|valores|monto|cobro|cobros|cobran|cobraron|cobrando|precio|mensualidad|cuota|total|factura|pago|saldo)\b/;

/** Frases que por sí solas ya son un reclamo de cobro. */
const RECLAMO_DIRECTO: RegExp[] = [
    /\bme (estan |han )?(cobrando|cobraron|cobran) (de mas|doble|dos veces|mas de lo|otro valor)\b/,
    /\bcobr\w* (doble|de mas|dos veces)\b/,
    /\bpor que me (cobran|cobraron|estan cobrando|sale)\b/,
    /\bno debo (eso|ese valor|tanto|esa plata)\b/,
    /\bese no es el valor\b/,
    /\b(el|ese|este) valor (no es|esta mal|no esta bien)\b/,
];

/** Necesitan una palabra de dinero cerca: «no coincide» solo también es otra cosa. */
const RECLAMO_CON_DINERO: RegExp[] = [
    /\bno (me )?coincide\b/,
    /\bno corresponde\b/,
    /\b(esta|estan) mal\b/,
    /\b(equivocad|incorrect|errad)\w*\b/,
    /\b(diferente|distinto)\b/,
    /\bme sale (otro|mas|un valor)\b/,
    /\bno (es|son) (lo|el) (que|valor)\b/,
];

export function reclamaValor(texto: string | null | undefined): boolean {
    const t = normalizar(texto);
    if (!t) return false;
    if (RECLAMO_DIRECTO.some((re) => re.test(t))) return true;
    return DINERO.test(t) && RECLAMO_CON_DINERO.some((re) => re.test(t));
}

export interface CobroAbierto {
    concept: string | null;
    amount: number | string | null;
    status: string | null;
    due_date: string | null;
}

export function pesos(n: number | string | null | undefined): string {
    const v = Math.round(Number(n ?? 0));
    return `$${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso: string | null): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : '';
}

function lineaDeCobro(c: CobroAbierto): string {
    const estado = c.status === 'overdue' ? 'vencido'
        : c.status === 'awaiting_approval' ? 'comprobante en revisión'
            : c.status === 'partial' ? 'abonado en parte'
                : c.due_date ? `vence ${fechaCorta(c.due_date)}` : 'pendiente';
    return `• ${(c.concept ?? 'Cobro').trim()}: *${pesos(c.amount)}* (${estado})`;
}

/** Lo que se le contesta a la familia. El aviso de que pasa a una persona lo agrega `escalate`. */
export function textoReclamoDeValor(cobros: CobroAbierto[]): string {
    const lista = cobros.length
        ? ['Estos son los cobros que tienes abiertos:', ...cobros.map(lineaDeCobro)]
        : ['No veo cobros abiertos a tu nombre en este momento.'];
    return [
        'Entiendo, revisemos ese valor 🙏',
        ...lista,
        '',
        'Si tienes el valor que te informaron o un comprobante, mándalo por aquí y queda en tu caso.',
    ].join('\n');
}

/** Motivo para el buzón y el correo a la escuela (frase, no código). */
export function motivoReclamoDeValor(texto: string, cobros: CobroAbierto[]): string {
    const dicho = normalizarEspacios(texto);
    const recorte = dicho.length > 140 ? `${dicho.slice(0, 137)}…` : dicho;
    const detalle = cobros.length
        ? cobros.map((c) => `${(c.concept ?? 'Cobro').trim()} ${pesos(c.amount)}`).join('; ')
        : 'sin cobros abiertos';
    return `Reclamo de valor: «${recorte}». Cobros abiertos: ${detalle}.`;
}

function normalizarEspacios(t: string): string {
    return String(t ?? '').replace(/\s+/g, ' ').trim();
}

/** Cobros abiertos de la familia en ESTA escuela (máx. 6). Nunca lanza. */
export async function cobrosAbiertos(parentId: string | null, schoolId: string): Promise<CobroAbierto[]> {
    if (!parentId) return [];
    try {
        const { data, error } = await supabase
            .from('payments')
            .select('concept, amount, status, due_date')
            .eq('parent_id', parentId)
            .eq('school_id', schoolId)
            .in('status', ['pending', 'overdue', 'partial', 'awaiting_approval'])
            .order('due_date', { ascending: true })
            .limit(6);
        if (error || !Array.isArray(data)) return [];
        return data as CobroAbierto[];
    } catch {
        return [];
    }
}
