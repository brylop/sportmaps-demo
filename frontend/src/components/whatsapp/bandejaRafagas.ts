/**
 * Ráfagas de la bandeja (2026-10-13). Solo presentación: los datos no cambian.
 *
 * En Dynasty un proveedor mandó 37 fotos de catálogo en 13 horas y la bandeja
 * las mostraba como 37 tarjetas iguales. Ahora las filas del MISMO número, el
 * MISMO día (hora de Bogotá) y el MISMO motivo se muestran como UNA tarjeta
 * con contador y acciones en lote. Desde MIN_RAFAGA filas: dos comprobantes
 * del mismo día (dos hijos) siguen viéndose por separado.
 */

export const MIN_RAFAGA = 3;

export interface FilaAgrupable {
    id: string;
    wa_phone_number: string;
    created_at: string;
    motivo: string;
    message_type?: string;
    media_mime_type?: string | null;
}

export type Bloque<T extends FilaAgrupable> =
    | { tipo: 'fila'; fila: T }
    | { tipo: 'rafaga'; clave: string; filas: T[] };

/** Día calendario en Bogotá (YYYY-MM-DD). Pura. */
export function diaBogota(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/**
 * Agrupa respetando el orden de llegada de `filas`: el bloque ocupa el lugar
 * de su primera fila. Pura.
 */
export function agruparRafagas<T extends FilaAgrupable>(filas: T[], min = MIN_RAFAGA): Bloque<T>[] {
    const clave = (f: T) => `${f.wa_phone_number}|${diaBogota(f.created_at)}|${f.motivo}`;
    const porClave = new Map<string, T[]>();
    for (const f of filas) {
        const k = clave(f);
        if (!porClave.has(k)) porClave.set(k, []);
        porClave.get(k)!.push(f);
    }
    const out: Bloque<T>[] = [];
    const puestos = new Set<string>();
    for (const f of filas) {
        const k = clave(f);
        const grupo = porClave.get(k)!;
        if (grupo.length < min) { out.push({ tipo: 'fila', fila: f }); continue; }
        if (puestos.has(k)) continue;
        puestos.add(k);
        out.push({ tipo: 'rafaga', clave: k, filas: grupo });
    }
    return out;
}

/** «37 fotos de este número» / «4 archivos de este número». Pura. */
export function textoDeRafaga(filas: FilaAgrupable[]): string {
    const fotos = filas.every((f) => (f.media_mime_type ?? '').startsWith('image/') || f.message_type === 'image');
    return `${filas.length} ${fotos ? 'fotos' : 'archivos'} de este número`;
}
