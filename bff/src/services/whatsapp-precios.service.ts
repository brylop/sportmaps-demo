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
