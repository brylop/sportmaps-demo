/**
 * whatsapp-chat-exportado — entiende el .zip de «Exportar chat → Incluir
 * archivos» de WhatsApp: quién mandó cada foto y cuándo.
 *
 * Para qué: los comprobantes que las familias de Dynasty mandaron ANTES del
 * 2026-10-02 (cuando se conectó el número por Coexistence) solo existen en el
 * celular de la dueña. Subirlos uno por uno son cientos de clics; exportar el
 * chat de cada familia es uno.
 *
 * Los dos formatos que produce WhatsApp en español:
 *
 *   iOS      `[5/09/26, 10:23:11 a. m.] Juan Pérez: ‎<adjunto: 00000012-PHOTO-2026-09-05-10-23-11.jpg>`
 *   Android  `5/9/26, 10:23 a. m. - Juan Pérez: IMG-20260905-WA0012.jpg (archivo adjunto)`
 *
 * Las fechas del texto van día/mes en español. Si el archivo trae la fecha en
 * el nombre (IMG-YYYYMMDD, PHOTO-YYYY-MM-DD) manda esa: no depende del idioma
 * del teléfono.
 *
 * Funciones puras: se prueban con texto, sin zip ni base.
 */

export interface AdjuntoDelChat {
    archivo: string;
    remitente: string;
    /** ISO yyyy-mm-dd (o yyyy-mm-ddTHH:MM si se sabe la hora). */
    fecha: string | null;
}

export interface RemitenteDelChat {
    nombre: string;
    /** Últimos 10 dígitos si el remitente aparece como número (contacto no guardado). */
    telefono: string | null;
    adjuntos: number;
}

export interface ChatAnalizado {
    remitentes: RemitenteDelChat[];
    adjuntos: AdjuntoDelChat[];
}

/** Caracteres invisibles de dirección que WhatsApp mete en nombres y adjuntos. */
const INVISIBLES = /[‎‏‪-‮⁦-⁩﻿]/g;

const RE_IOS = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s?m\.?|AM|PM)?\]\s+([^:]+?):\s(.*)$/i;
const RE_ANDROID = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s*([ap]\.?\s?m\.?|AM|PM)?\s+-\s+([^:]+?):\s(.*)$/i;
const RE_ARCHIVO = /[\w\-. ()]+?\.(?:jpe?g|png|webp|pdf)/gi;

/** Teléfono colombiano de 10 dígitos si el «nombre» es en realidad un número. */
export function telefonoDelRemitente(nombre: string): string | null {
    if (/[a-záéíóúñ]/i.test(nombre)) return null;
    const digitos = nombre.replace(/\D/g, '');
    if (digitos.length < 10) return null;
    const t = digitos.slice(-10);
    return /^3\d{9}$/.test(t) ? t : null;
}

/** Fecha embebida en el nombre del archivo, si la hay. */
export function fechaDelNombre(archivo: string): string | null {
    // Android: IMG-20260905-WA0012.jpg, DOC-20260905-WA0003.pdf
    const a = archivo.match(/(?:IMG|DOC|PTT|VID)-(\d{4})(\d{2})(\d{2})-WA/i);
    if (a) return `${a[1]}-${a[2]}-${a[3]}`;
    // iOS: 00000012-PHOTO-2026-09-05-10-23-11.jpg
    const i = archivo.match(/-(?:PHOTO|DOCUMENT|IMAGE)-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/i);
    if (i) return `${i[1]}-${i[2]}-${i[3]}T${i[4]}:${i[5]}`;
    return null;
}

const dos = (n: number) => String(n).padStart(2, '0');

function fechaDeLinea(a: string, b: string, c: string, diaPrimero: boolean): string | null {
    const x = Number(a), y = Number(b);
    let anio = Number(c);
    if (anio < 100) anio += 2000;
    const dia = diaPrimero ? x : y;
    const mes = diaPrimero ? y : x;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${anio}-${dos(mes)}-${dos(dia)}`;
}

/**
 * Analiza el texto del chat contra los archivos que trae el zip. Solo cuentan
 * los adjuntos cuyo archivo está en el zip (`archivosDelZip`, en minúsculas o
 * no: se compara sin mayúsculas).
 */
export function analizarChat(texto: string, archivosDelZip: string[]): ChatAnalizado {
    const enZip = new Map(archivosDelZip.map((n) => [n.toLowerCase(), n]));
    const lineas = texto.replace(INVISIBLES, '').replace(/[  ]/g, ' ').split(/\r?\n/);

    // Día/mes salvo que alguna línea demuestre lo contrario (segundo número > 12).
    let diaPrimero = true;
    for (const l of lineas) {
        const m = l.match(RE_IOS) ?? l.match(RE_ANDROID);
        if (m && Number(m[2]) > 12 && Number(m[1]) <= 12) { diaPrimero = false; break; }
    }

    const adjuntos: AdjuntoDelChat[] = [];
    const vistos = new Set<string>();
    for (const l of lineas) {
        const m = l.match(RE_IOS) ?? l.match(RE_ANDROID);
        if (!m) continue;
        const remitente = m[7].trim();
        const cuerpo = m[8];
        for (const candidato of cuerpo.match(RE_ARCHIVO) ?? []) {
            const limpio = candidato.trim().replace(/^.*[<:]\s*/, '');
            // El candidato puede arrastrar texto previo con espacios ("ver
            // IMG-….jpg"); si entero no está en el zip, se prueba su última palabra.
            const real = enZip.get(limpio.toLowerCase())
                ?? enZip.get((limpio.split(' ').pop() ?? '').toLowerCase());
            if (!real || vistos.has(real)) continue;
            vistos.add(real);
            adjuntos.push({
                archivo: real,
                remitente,
                fecha: fechaDelNombre(real) ?? fechaDeLinea(m[1], m[2], m[3], diaPrimero),
            });
        }
    }

    const porRemitente = new Map<string, RemitenteDelChat>();
    for (const a of adjuntos) {
        const r = porRemitente.get(a.remitente) ?? { nombre: a.remitente, telefono: telefonoDelRemitente(a.remitente), adjuntos: 0 };
        r.adjuntos++;
        porRemitente.set(a.remitente, r);
    }
    return {
        remitentes: Array.from(porRemitente.values()).sort((x, y) => y.adjuntos - x.adjuntos),
        adjuntos,
    };
}

/** El archivo de texto del chat dentro del zip: `_chat.txt` (iOS) o el único .txt (Android). */
export function archivoDelChat(nombres: string[]): string | null {
    const ios = nombres.find((n) => n.toLowerCase() === '_chat.txt');
    if (ios) return ios;
    const txts = nombres.filter((n) => n.toLowerCase().endsWith('.txt'));
    return txts.length === 1 ? txts[0] : null;
}

export function mimeDeArchivo(nombre: string): string | null {
    const ext = nombre.toLowerCase().split('.').pop();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'pdf') return 'application/pdf';
    return null;
}
