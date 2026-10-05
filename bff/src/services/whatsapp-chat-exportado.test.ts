/**
 * Importar un chat exportado de WhatsApp: el lector de zip y el análisis de
 * `_chat.txt` (quién mandó cada foto y cuándo), con los dos formatos que
 * produce WhatsApp en español.
 */
import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import { leerZip, ZipInvalidoError } from '../utils/zip-lector';
import { analizarChat, archivoDelChat, fechaDelNombre, telefonoDelRemitente, mimeDeArchivo } from './whatsapp-chat-exportado';

/** Zip mínimo (guardado o deflate) para probar sin librerías. */
function armarZip(archivos: { nombre: string; datos: Buffer; deflate?: boolean }[]): Buffer {
    const locales: Buffer[] = [];
    const centrales: Buffer[] = [];
    let offset = 0;
    for (const a of archivos) {
        const nombre = Buffer.from(a.nombre, 'utf8');
        const comp = a.deflate ? zlib.deflateRawSync(a.datos) : a.datos;
        const l = Buffer.alloc(30);
        l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(0x800, 6); l.writeUInt16LE(a.deflate ? 8 : 0, 8);
        l.writeUInt32LE(comp.length, 18); l.writeUInt32LE(a.datos.length, 22); l.writeUInt16LE(nombre.length, 26);
        locales.push(l, nombre, comp);
        const c = Buffer.alloc(46);
        c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(a.deflate ? 8 : 0, 10);
        c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(a.datos.length, 24); c.writeUInt16LE(nombre.length, 28);
        c.writeUInt32LE(offset, 42);
        centrales.push(c, nombre);
        offset += 30 + nombre.length + comp.length;
    }
    const central = Buffer.concat(centrales);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
    fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(offset, 16);
    return Buffer.concat([...locales, central, fin]);
}

describe('leerZip', () => {
    it('lee archivos guardados y comprimidos, sin carpetas', () => {
        const zip = armarZip([
            { nombre: '_chat.txt', datos: Buffer.from('hola chat'), deflate: true },
            { nombre: 'carpeta/IMG-20260905-WA0001.jpg', datos: Buffer.from('jpeg') },
        ]);
        const e = leerZip(zip);
        expect(e.map((x) => x.nombre)).toEqual(['_chat.txt', 'IMG-20260905-WA0001.jpg']);
        expect(e[0].leer().toString()).toBe('hola chat');
        expect(e[1].leer().toString()).toBe('jpeg');
    });

    it('rechaza lo que no es zip y corta un archivo inflado por encima del tope', () => {
        expect(() => leerZip(Buffer.from('no soy un zip pero tengo más de veintidós bytes'))).toThrow(ZipInvalidoError);
        const bomba = armarZip([{ nombre: 'a.jpg', datos: Buffer.alloc(200_000), deflate: true }]);
        const [a] = leerZip(bomba, { maxBytesPorArchivo: 1000 });
        expect(() => a.leer()).toThrow(ZipInvalidoError);
    });
});

describe('analizarChat', () => {
    it('Android en español: remitente, archivo y fecha del nombre del archivo', () => {
        const txt = [
            '5/9/26, 10:23 a. m. - Dynasty: Hola, le comparto los datos de pago',
            '5/9/26, 10:24 a. m. - Dynasty: IMG-20260905-WA0010.jpg (archivo adjunto)',
            '5/9/26, 6:02 p. m. - Juan Pérez: IMG-20260905-WA0012.jpg (archivo adjunto)',
            'Pago de septiembre',
            '3/10/26, 7:15 a. m. - Juan Pérez: DOC-20261003-WA0003.pdf (archivo adjunto)',
            '3/10/26, 7:16 a. m. - Juan Pérez: IMG-20261003-WA0099.jpg (archivo adjunto)', // no viene en el zip
        ].join('\n');
        const r = analizarChat(txt, ['IMG-20260905-WA0010.jpg', 'IMG-20260905-WA0012.jpg', 'DOC-20261003-WA0003.pdf']);
        expect(r.adjuntos).toEqual([
            { archivo: 'IMG-20260905-WA0010.jpg', remitente: 'Dynasty', fecha: '2026-09-05' },
            { archivo: 'IMG-20260905-WA0012.jpg', remitente: 'Juan Pérez', fecha: '2026-09-05' },
            { archivo: 'DOC-20261003-WA0003.pdf', remitente: 'Juan Pérez', fecha: '2026-10-03' },
        ]);
        expect(r.remitentes[0]).toEqual({ nombre: 'Juan Pérez', telefono: null, adjuntos: 2 });
    });

    it('iOS: corchetes, marcas invisibles y contacto sin guardar (número)', () => {
        const txt = [
            '[5/09/26, 10:23:11 a. m.] ‪+57 300 123 4567‬: ‎<adjunto: 00000012-PHOTO-2026-09-05-10-23-11.jpg>',
            '[6/09/26, 9:00:00 a. m.] Dynasty: listo, gracias',
        ].join('\n');
        const r = analizarChat(txt, ['00000012-PHOTO-2026-09-05-10-23-11.jpg']);
        expect(r.adjuntos).toEqual([
            { archivo: '00000012-PHOTO-2026-09-05-10-23-11.jpg', remitente: '+57 300 123 4567', fecha: '2026-09-05T10:23' },
        ]);
        expect(r.remitentes[0].telefono).toBe('3001234567');
    });

    it('sin fecha en el nombre usa la de la línea, día/mes', () => {
        const r = analizarChat('7/9/26, 8:00 a. m. - Ana: comprobante.jpg (archivo adjunto)', ['comprobante.jpg']);
        expect(r.adjuntos[0].fecha).toBe('2026-09-07');
    });
});

describe('utilidades', () => {
    it('archivo del chat, mime, teléfono y fecha del nombre', () => {
        expect(archivoDelChat(['a.jpg', '_chat.txt'])).toBe('_chat.txt');
        expect(archivoDelChat(['Chat de WhatsApp con Juan.txt', 'a.jpg'])).toBe('Chat de WhatsApp con Juan.txt');
        expect(archivoDelChat(['a.txt', 'b.txt'])).toBeNull();
        expect(mimeDeArchivo('x.JPG')).toBe('image/jpeg');
        expect(mimeDeArchivo('x.opus')).toBeNull();
        expect(telefonoDelRemitente('Juan 3001234567')).toBeNull();
        expect(telefonoDelRemitente('+57 1 2345678')).toBeNull();
        expect(fechaDelNombre('IMG-20261003-WA0001.jpg')).toBe('2026-10-03');
    });
});
