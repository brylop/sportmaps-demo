/**
 * Valores de la escuela para quien pregunta «¿cuánto cuesta?» (ajuste
 * `wa_responder_precios`, spec docs/specs/whatsapp-ajustes-por-escuela.md).
 *
 * Besser: «si pregunta cuánto cuesta, indicamos el valor, no que deba pagar».
 * Se informa la lista de precios de los planes activos (`offering_plans`) —la
 * misma que ve la escuela en su catálogo— y NO se manda enlace de pago.
 * Los planes en $0 (p. ej. «CORTESÍA») no son un precio: se omiten.
 *
 * DETERMINISTA: un valor redactado por el modelo es justo lo que una familia
 * después reclama.
 */
import { supabase } from '../config/supabase';
import { pesos } from './whatsapp-reclamo-valor.service';

export interface PlanConPrecio { nombre: string | null; precio: number | string | null }

/** «4 DÍAS / SEMANA (PROFUNDIZACIÓN) » → «4 días por semana (profundización)». */
export function nombreDePlan(nombre: string | null | undefined): string {
    const t = String(nombre ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const minus = t === t.toUpperCase() ? t.toLowerCase() : t;
    const conPor = minus.replace(/\s*\/\s*semana\b/gi, ' por semana');
    return conPor.charAt(0).toUpperCase() + conPor.slice(1);
}

/** Lista de precios en texto, de menor a mayor. null = no hay ningún plan con valor. */
export function textoDePrecios(planes: PlanConPrecio[]): string | null {
    const vistos = new Set<string>();
    const lista = planes
        .map((p) => ({ nombre: nombreDePlan(p.nombre), precio: Math.round(Number(p.precio ?? 0)) }))
        .filter((p) => p.nombre && Number.isFinite(p.precio) && p.precio > 0)
        .filter((p) => {
            const clave = `${p.nombre.toLowerCase()}|${p.precio}`;
            if (vistos.has(clave)) return false;
            vistos.add(clave);
            return true;
        })
        .sort((a, b) => a.precio - b.precio);
    if (!lista.length) return null;
    return ['💰 Estos son los valores de la mensualidad:', ...lista.map((p) => `• ${p.nombre}: *${pesos(p.precio)}*`)].join('\n');
}

/** Planes activos de la escuela con su precio. Nunca lanza. */
export async function textoDePreciosDeEscuela(schoolId: string): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('offering_plans')
            .select('name, price, is_active')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('price', { ascending: true })
            .limit(30);
        if (error || !Array.isArray(data)) return null;
        return textoDePrecios((data as any[]).map((p) => ({ nombre: p.name, precio: p.price })));
    } catch {
        return null;
    }
}

// ─── El precio en la PRIMERA respuesta al prospecto (embudo 2026-10-08) ──────
//
// Dynasty, 24 prospectos en 6 días: 9 preguntaron el precio y el bot dio 0
// cifras aunque `wa_responder_precios` estaba prendido. La pregunta venía junto
// con otra («¿qué precio tiene? ¿horarios? ¿desde qué edad?») y ganaba la rama
// de la clase de cortesía, que solo mandaba el enlace. Ahora cualquier
// respuesta al prospecto que pidió precio lleva la lista corta en el MISMO
// mensaje y, si dijo la edad, el grupo que le corresponde.

function normalizarPrecio(texto: string | null | undefined): string {
    return String(texto ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ').trim();
}

/** Lo de una familia que ya paga (comprobante, «ya te envío la mensualidad», saldo): no es pregunta de precio. */
const YA_PAGA: RegExp[] = [
    /\b(comprobantes?|consign\w*|transfer\w*|pague|pagamos|ya (te |le )?(envi|mand)\w*|te envio|soportes?|recibo)\b/,
    /\b(pendientes?|debo|debemos|paz y salvo|del mes)\b/,
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/,
    // «¿En qué horario se puede ir a cancelar la mensualidad?»: cómo pagar, no cuánto.
    /\b(cancelar|pagar|abonar) (la |el )?(mensualidad|cuota)\b/,
    /\b(como|donde) (pago|pagar|cancelo)\b/,
];

/**
 * ¿Pregunta cuánto cuesta? «qué precio tiene», «costos», «cuánto es la
 * mensualidad», «y los precios», «cuánto sería? 130 mil?». Pura.
 * «Mensualidad agosto» / «ya te envío la mensualidad» / «valor pendiente»: no.
 */
export function pidePrecio(texto: string | null | undefined): boolean {
    const t = normalizarPrecio(texto);
    if (!t) return false;
    if (YA_PAGA.some((re) => re.test(t))) return false;
    if (/\b(precios?|valor(es)?|costos?|tarifas?)\b/.test(t)) return true;
    if (/\bcuanto (cuesta|cuestan|vale|valen|cobran|es|son|sale|salen|seria|serian|esta|estan|pago|se paga)\b/.test(t)) return true;
    if (/\bmensualidad(es)?\b/.test(t) && /(\?|\bcuanto\b|\bque\b|\bcomo\b|\binfo\w*)/.test(t)) return true;
    return false;
}

/** Lo que se sabe del deportista para elegir el grupo. */
export interface PerfilPrecio { edad?: number | null; genero?: 'f' | 'm' | null; adulto?: boolean }

/**
 * Lista corta de mensualidades + el grupo para la edad (si la dijo y los
 * grupos tienen edades). Pura: la arma quien tiene los datos.
 */
export function bloqueDePreciosProspecto(precios: string | null, lineaGrupo: string | null): string | null {
    if (!precios) return null;
    return lineaGrupo ? `${precios}\n\n👉 ${lineaGrupo}` : precios;
}

/**
 * El bloque de precios para un prospecto, o null si la escuela no responde
 * precios (`wa_responder_precios` apagado) o no tiene planes con valor.
 * `perfil` con edad → «Para 12 años le corresponde …». Nunca lanza.
 */
export async function preciosParaProspecto(
    schoolId: string,
    responderPrecios: boolean,
    perfil: PerfilPrecio | null = null,
): Promise<string | null> {
    if (!responderPrecios) return null;
    try {
        const precios = await textoDePreciosDeEscuela(schoolId);
        if (!precios) return null;
        let linea: string | null = null;
        if (perfil && (typeof perfil.edad === 'number' || perfil.adulto)) {
            const { rangosDeEscuela, elegirGrupo, textoGrupoParaEdad } = await import('./grupos-por-edad.service');
            const rangos = await rangosDeEscuela(schoolId).catch(() => []);
            if (rangos.length) linea = textoGrupoParaEdad(elegirGrupo(rangos, perfil), perfil);
        }
        return bloqueDePreciosProspecto(precios, linea);
    } catch {
        return null;
    }
}
