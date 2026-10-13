/**
 * whatsapp-medios — adjuntos del hilo del buzón (fotos, notas de voz, PDF…).
 *
 * Hasta el 2026-10-13 el hilo mostraba «(image)», «(audio)», «(document)»: el
 * archivo vive en Meta y su URL es privada (exige el token de la WABA). La
 * pantalla ahora pide cada adjunto al BFF (GET …/mensajes/:id/media), que
 * verifica que la conversación sea de la escuela, que no sea un contacto
 * personal y baja el binario con el token.
 *
 * Este módulo es puro (sin base ni red): qué adjunto trae un mensaje y qué
 * tipos se muestran. Lo usan la ruta del hilo y la del archivo.
 */

/** Tipos de mensaje que traen archivo. El sticker es una imagen webp. */
export const TIPOS_CON_MEDIO = ['image', 'audio', 'video', 'document', 'sticker'] as const;
export type TipoConMedio = typeof TIPOS_CON_MEDIO[number];

/** Lo que la pantalla necesita saber del adjunto, sin el payload de Meta. */
export interface MedioDelMensaje {
    tipo: TipoConMedio;
    mime: string | null;
    /** Nombre del documento (los PDF lo traen); null en fotos y audios. */
    nombre: string | null;
    caption: string | null;
    /** Nota de voz (`voice: true`) o audio reenviado. */
    voz: boolean;
    /**
     * false = no se puede pedir: el payload no trae id (contacto personal,
     * contenido purgado por privacidad, o echo sin archivo).
     */
    disponible: boolean;
}

/**
 * El adjunto de un mensaje a partir de su `payload` (el objeto que mandó Meta,
 * guardado tal cual por la ingesta). null si el tipo no lleva archivo.
 */
export function medioDelMensaje(tipo: string | null | undefined, payload: any): MedioDelMensaje | null {
    if (!tipo || !(TIPOS_CON_MEDIO as readonly string[]).includes(tipo)) return null;
    const t = tipo as TipoConMedio;
    const m = payload?.[t] ?? null;
    const purgado = Boolean(payload?.privacidad || payload?.purgado_at);
    return {
        tipo: t,
        mime: typeof m?.mime_type === 'string' ? m.mime_type.split(';')[0].trim() : null,
        nombre: typeof m?.filename === 'string' && m.filename.trim() ? m.filename.trim().slice(0, 200) : null,
        caption: typeof m?.caption === 'string' && m.caption.trim() ? m.caption : null,
        voz: t === 'audio' && m?.voice === true,
        disponible: !purgado && typeof m?.id === 'string' && m.id.length > 0,
    };
}

/** El id de Meta del adjunto, o null. */
export function idDelMedio(tipo: string | null | undefined, payload: any): string | null {
    if (!tipo || !(TIPOS_CON_MEDIO as readonly string[]).includes(tipo)) return null;
    if (payload?.privacidad || payload?.purgado_at) return null;
    const id = payload?.[tipo]?.id;
    return typeof id === 'string' && id ? id : null;
}

/**
 * Lo que el visor acepta bajar de Meta. Fuera de esto (ejecutables, zip…) el
 * BFF no hace de proxy: se le dice a la escuela que lo abra en el celular.
 */
export const MIMES_VISOR: ReadonlySet<string> = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr', 'audio/webm',
    'video/mp4', 'video/3gpp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
]);

/** Tope del visor: el máximo de WhatsApp para audio/video (16 MB). Documentos más grandes, en el celular. */
export const MAX_BYTES_VISOR = 16 * 1024 * 1024;

/** Nombre de archivo seguro para Content-Disposition (sin comillas ni saltos). */
export function nombreSeguro(nombre: string | null | undefined, tipo: string, mime: string | null): string {
    const base = String(nombre ?? '').replace(/[\r\n"\\/]+/g, ' ').replace(/[^\x20-\x7E]+/g, '_').trim().slice(0, 120);
    if (base) return base;
    const ext = mime === 'application/pdf' ? 'pdf'
        : mime?.startsWith('image/') ? mime.slice(6)
        : mime?.startsWith('audio/') ? 'ogg'
        : mime?.startsWith('video/') ? 'mp4' : 'bin';
    return `whatsapp-${tipo}.${ext}`;
}
