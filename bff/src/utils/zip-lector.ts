/**
 * zip-lector — lee un .zip en memoria, sin dependencias.
 *
 * Existe para el importador de chats exportados de WhatsApp («Exportar chat →
 * Incluir archivos» produce un .zip con `_chat.txt` y las fotos). El BFF no
 * tenía librería de zip y para esto alcanza con el directorio central y dos
 * métodos (guardado y deflate), que son los que usan iOS y Android.
 *
 * Defensas, porque el archivo lo sube un usuario:
 *   - tope de entradas y de tamaño descomprimido por archivo (bomba de zip:
 *     `maxOutputLength` corta el inflado aunque el encabezado mienta);
 *   - zip cifrado, zip64 o método desconocido → error claro, no se adivina;
 *   - los nombres se reducen a su último segmento: nunca se usan como ruta.
 */

import zlib from 'node:zlib';

export interface EntradaZip {
    /** Nombre sin carpetas (último segmento). */
    nombre: string;
    /** Tamaño descomprimido declarado. */
    tamano: number;
    /** Descomprime bajo demanda. Lanza si supera `maxBytesPorArchivo`. */
    leer: () => Buffer;
}

export class ZipInvalidoError extends Error {
    constructor(message: string) { super(message); this.name = 'ZipInvalidoError'; }
}

const FIRMA_FIN = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;

export function leerZip(
    buf: Buffer,
    opciones: { maxEntradas?: number; maxBytesPorArchivo?: number } = {},
): EntradaZip[] {
    const maxEntradas = opciones.maxEntradas ?? 5000;
    const maxBytes = opciones.maxBytesPorArchivo ?? 20 * 1024 * 1024;

    // El registro de fin está en los últimos 22 bytes + comentario (≤ 65535).
    let fin = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
        if (buf.readUInt32LE(i) === FIRMA_FIN) { fin = i; break; }
    }
    if (fin < 0) throw new ZipInvalidoError('no es un archivo .zip');

    const total = buf.readUInt16LE(fin + 10);
    const inicioCentral = buf.readUInt32LE(fin + 16);
    if (total === 0xffff || inicioCentral === 0xffffffff) throw new ZipInvalidoError('zip64 no soportado');
    if (total > maxEntradas) throw new ZipInvalidoError(`el zip tiene demasiados archivos (${total})`);

    const entradas: EntradaZip[] = [];
    let p = inicioCentral;
    for (let n = 0; n < total; n++) {
        if (p + 46 > buf.length || buf.readUInt32LE(p) !== FIRMA_CENTRAL) throw new ZipInvalidoError('directorio del zip dañado');
        const flags = buf.readUInt16LE(p + 8);
        const metodo = buf.readUInt16LE(p + 10);
        const comprimido = buf.readUInt32LE(p + 20);
        const tamano = buf.readUInt32LE(p + 24);
        const largoNombre = buf.readUInt16LE(p + 28);
        const largoExtra = buf.readUInt16LE(p + 30);
        const largoComentario = buf.readUInt16LE(p + 32);
        const offsetLocal = buf.readUInt32LE(p + 42);
        const nombreCompleto = buf.subarray(p + 46, p + 46 + largoNombre).toString((flags & 0x800) ? 'utf8' : 'latin1');
        p += 46 + largoNombre + largoExtra + largoComentario;

        if (nombreCompleto.endsWith('/')) continue; // carpeta
        const nombre = nombreCompleto.split(/[\\/]/).pop() ?? '';
        // Los metadatos de macOS no son archivos del chat.
        if (!nombre || nombreCompleto.startsWith('__MACOSX/') || nombre.startsWith('._')) continue;
        if (flags & 0x1) throw new ZipInvalidoError('el zip está cifrado');

        entradas.push({
            nombre,
            tamano,
            leer: () => {
                if (tamano > maxBytes) throw new ZipInvalidoError(`${nombre} supera el tamaño permitido`);
                if (offsetLocal + 30 > buf.length || buf.readUInt32LE(offsetLocal) !== FIRMA_LOCAL) {
                    throw new ZipInvalidoError(`entrada dañada: ${nombre}`);
                }
                const inicio = offsetLocal + 30 + buf.readUInt16LE(offsetLocal + 26) + buf.readUInt16LE(offsetLocal + 28);
                const datos = buf.subarray(inicio, inicio + comprimido);
                if (metodo === 0) return Buffer.from(datos);
                if (metodo === 8) {
                    try {
                        return zlib.inflateRawSync(datos, { maxOutputLength: maxBytes });
                    } catch {
                        throw new ZipInvalidoError(`no se pudo descomprimir ${nombre}`);
                    }
                }
                throw new ZipInvalidoError(`método de compresión ${metodo} no soportado (${nombre})`);
            },
        });
    }
    return entradas;
}
