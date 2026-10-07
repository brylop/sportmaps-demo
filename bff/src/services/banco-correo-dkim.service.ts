/**
 * Verifica que un aviso de «entró plata» lo escribió el BANCO, y a la ESCUELA.
 *
 * POR QUÉ DKIM Y NO UNA LISTA DE REMITENTES
 *
 * El «From:» de un correo lo escribe cualquiera. Lo que no se puede falsificar
 * es la firma DKIM: el banco firma con su llave privada y publica la pública en
 * su DNS (`smtp1._domainkey.notificaciones.nequi.com.co`). Verificarla aquí,
 * sobre el MIME crudo, y contra el DNS del banco, es lo único que hace que el
 * aviso valga más que el pantallazo del papá (plan maestro de cobros, principio
 * 6). Nequi además publica DMARC p=REJECT.
 *
 * QUÉ SE EXIGE (todo, o se rechaza)
 *
 *   1. Un solo From:, de un dominio de banco en lista blanca.
 *   2. Una firma DKIM `pass` de un dominio de ESE banco, alineada con el From:
 *      (alineación relajada de DMARC: mismo dominio organizacional).
 *   3. Sin `l=` (si la firma cubre solo parte del cuerpo, alguien puede pegar
 *      un «Recibiste 900.000…» debajo sin romperla) y sin rsa-sha1.
 *   4. El To: está entre los encabezados FIRMADOS, hay uno solo, y es uno de
 *      los buzones que la escuela registró. Sin esto, un aviso REAL del Nequi
 *      de cualquier persona (que se manda plata a sí misma) reenviado a la
 *      dirección de la escuela pasaría. Con esto, el aviso prueba a qué buzón
 *      le escribió el banco.
 *
 * REENVÍOS DE GMAIL — qué pasa con cada uno
 *
 *   · Filtro de reenvío automático (el que se le pide configurar a la
 *     escuela): Gmail reenvía el mensaje ORIGINAL, sin tocar el cuerpo ni los
 *     encabezados firmados; agrega los suyos arriba. La firma del banco sigue
 *     válida → se verifica el mensaje tal cual llega.
 *   · Botón «Reenviar» (en línea): Gmail arma un correo NUEVO con el texto
 *     citado. La firma del banco desaparece → se RECHAZA (`dkim_invalido`).
 *     No hay forma honesta de verificar una cita.
 *   · «Reenviar como archivo adjunto»: el original viaja intacto como
 *     `message/rfc822` → se verifica el ADJUNTO (via_adjunto = true).
 *
 * El texto que se lee después (monto, fecha, nombre) sale SIEMPRE del mensaje
 * cuya firma se verificó, nunca del sobre del reenvío.
 */

import crypto from 'crypto';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import { dkimVerify } from 'mailauth/lib/dkim/verify';
import type { DKIMResult, DNSResolver } from 'mailauth';

export type BancoDkim = 'nequi' | 'bancolombia';

/**
 * Dominios autorizados por banco. Salen de correos reales (memoria
 * project_notificaciones_banco_por_correo_dkim y los tests del parser):
 *   Nequi:       From notificaciones@nequi.com.co, d=notificaciones.nequi.com.co
 *   Bancolombia: From alertasynotificaciones@an.notificacionesbancolombia.com
 * Se acepta el dominio exacto o un subdominio («an.notificacionesbancolombia.com»).
 * Agregar un banco = agregar aquí + un patrón en banco-correo-parser.
 */
export const DOMINIOS_BANCO: Record<BancoDkim, readonly string[]> = {
    nequi: ['nequi.com.co'],
    bancolombia: ['notificacionesbancolombia.com', 'bancolombia.com.co', 'bancolombia.com'],
};

/** Gmail manda el código de confirmación del reenvío desde aquí. */
const DOMINIO_GOOGLE = 'google.com';

export type MotivoRechazo =
    | 'mime_invalido'
    | 'from_multiple'
    | 'remitente_no_es_banco'
    | 'dkim_invalido'
    | 'dkim_algoritmo_debil'
    | 'dkim_cuerpo_parcial'
    | 'to_no_firmado'
    | 'to_multiple'
    | 'buzon_no_configurado'
    | 'buzon_no_registrado';

export interface ResultadoVerificacion {
    ok: boolean;
    motivo: MotivoRechazo | null;
    /** 'aviso' = notificación de banco; 'confirmacion_reenvio' = código de Gmail. */
    tipo: 'aviso' | 'confirmacion_reenvio' | null;
    banco: BancoDkim | null;
    from: string | null;
    dkimDomain: string | null;
    dkimSelector: string | null;
    signedTo: string[];
    messageId: string | null;
    subject: string | null;
    /** sha256 hex del cuerpo (bytes tras la línea en blanco) del mensaje verificado. */
    bodySha256: string;
    /** Texto plano del mensaje verificado (de text/plain o convertido del HTML). */
    texto: string;
    viaAdjunto: boolean;
}

export interface OpcionesVerificacion {
    /** Buzones de la escuela a los que escribe el banco (bank_email_inboxes.mailboxes). */
    buzones: string[];
    /** Nuestra dirección de recepción de esa escuela (banco+<token>@…). */
    direccionEntrada: string;
    /** DNS inyectable: en tests, la llave pública de prueba. En prod, el DNS real. */
    resolver?: DNSResolver;
}

const dominioDe = (correo: string | null | undefined) =>
    (correo ?? '').toLowerCase().trim().split('@').pop() ?? '';

/** «an.notificacionesbancolombia.com» pertenece a «notificacionesbancolombia.com». */
export function dominioPertenece(dominio: string, base: string): boolean {
    const d = dominio.toLowerCase().replace(/\.$/, '');
    const b = base.toLowerCase();
    return d === b || d.endsWith(`.${b}`);
}

export function bancoDeDominio(dominio: string): BancoDkim | null {
    for (const [banco, bases] of Object.entries(DOMINIOS_BANCO) as [BancoDkim, readonly string[]][]) {
        if (bases.some((b) => dominioPertenece(dominio, b))) return banco;
    }
    return null;
}

/** Separa encabezados y cuerpo crudo (acepta CRLF o LF). */
function partir(mime: Buffer): { cabecera: string; cuerpo: Buffer } {
    const crlf = mime.indexOf('\r\n\r\n');
    const lf = mime.indexOf('\n\n');
    let corte = -1;
    let largo = 0;
    if (crlf >= 0 && (lf < 0 || crlf <= lf)) { corte = crlf; largo = 4; }
    else if (lf >= 0) { corte = lf; largo = 2; }
    if (corte < 0) return { cabecera: mime.toString('latin1'), cuerpo: Buffer.alloc(0) };
    return { cabecera: mime.subarray(0, corte).toString('latin1'), cuerpo: mime.subarray(corte + largo) };
}

/** Cuántas veces aparece un encabezado (al inicio de línea, sin contar los plegados). */
function contarEncabezado(cabecera: string, nombre: string): number {
    const re = new RegExp(`^${nombre}\\s*:`, 'gim');
    return (cabecera.match(re) ?? []).length;
}

function direcciones(campo: AddressObject | AddressObject[] | undefined): string[] {
    const lista = Array.isArray(campo) ? campo : campo ? [campo] : [];
    return lista.flatMap((a) => a.value.map((v) => (v.address ?? '').toLowerCase().trim())).filter(Boolean);
}

/** Encabezados que cubre la firma, en minúscula («Date: To: From» → ['date','to','from']). */
function encabezadosFirmados(r: DKIMResult): string[] {
    const keys = r.signingHeaders?.keys ?? '';
    return keys.toLowerCase().split(/[:\s]+/).filter(Boolean);
}

function base(mime: Buffer, parsed: ParsedMail | null): ResultadoVerificacion {
    return {
        ok: false,
        motivo: null,
        tipo: null,
        banco: null,
        from: null,
        dkimDomain: null,
        dkimSelector: null,
        signedTo: [],
        messageId: parsed?.messageId ?? null,
        subject: parsed?.subject ?? null,
        bodySha256: crypto.createHash('sha256').update(partir(mime).cuerpo).digest('hex'),
        texto: '',
        viaAdjunto: false,
    };
}

async function verificarUno(mime: Buffer, op: OpcionesVerificacion): Promise<{ r: ResultadoVerificacion; parsed: ParsedMail | null }> {
    let parsed: ParsedMail | null = null;
    try {
        parsed = await simpleParser(mime, { skipImageLinks: true });
    } catch {
        return { r: { ...base(mime, null), motivo: 'mime_invalido' }, parsed: null };
    }
    const r = base(mime, parsed);
    const { cabecera } = partir(mime);

    if (contarEncabezado(cabecera, 'from') !== 1) return { r: { ...r, motivo: 'from_multiple' }, parsed };

    let dk;
    try {
        dk = await dkimVerify(mime, op.resolver ? { resolver: op.resolver } : {});
    } catch {
        return { r: { ...r, motivo: 'dkim_invalido' }, parsed };
    }
    if (dk.fromFields !== 1 || dk.headerFrom.length !== 1) return { r: { ...r, motivo: 'from_multiple' }, parsed };

    const from = dk.headerFrom[0].toLowerCase();
    const fromDomain = dominioDe(from);
    r.from = from;

    const esGoogle = dominioPertenece(fromDomain, DOMINIO_GOOGLE);
    const banco = esGoogle ? null : bancoDeDominio(fromDomain);
    if (!esGoogle && !banco) return { r: { ...r, motivo: 'remitente_no_es_banco' }, parsed };

    const basesValidas = esGoogle ? [DOMINIO_GOOGLE] : DOMINIOS_BANCO[banco!];
    const firma = dk.results.find((s) =>
        s.status?.result === 'pass'
        && !!s.status.aligned
        && !!s.signingDomain
        && basesValidas.some((b) => dominioPertenece(s.signingDomain!, b)));
    if (!firma) return { r: { ...r, banco, motivo: 'dkim_invalido' }, parsed };

    r.banco = banco;
    r.dkimDomain = firma.signingDomain ?? null;
    r.dkimSelector = firma.selector ?? null;

    if ((firma.algo ?? '').toLowerCase() === 'rsa-sha1') return { r: { ...r, motivo: 'dkim_algoritmo_debil' }, parsed };
    if (firma.canonBodyLengthLimited) return { r: { ...r, motivo: 'dkim_cuerpo_parcial' }, parsed };
    if (!encabezadosFirmados(firma).includes('to')) return { r: { ...r, motivo: 'to_no_firmado' }, parsed };
    if (contarEncabezado(cabecera, 'to') !== 1) return { r: { ...r, motivo: 'to_multiple' }, parsed };

    const para = direcciones(parsed.to);
    r.signedTo = para;

    if (esGoogle) {
        // El código de confirmación de Gmail viene dirigido a NUESTRA dirección.
        if (!para.includes(op.direccionEntrada.toLowerCase())) return { r: { ...r, motivo: 'buzon_no_registrado' }, parsed };
        return { r: { ...r, ok: true, tipo: 'confirmacion_reenvio', texto: parsed.text ?? '' }, parsed };
    }

    const buzones = op.buzones.map((b) => b.toLowerCase().trim()).filter(Boolean);
    if (buzones.length === 0) return { r: { ...r, motivo: 'buzon_no_configurado' }, parsed };
    if (!para.some((p) => buzones.includes(p))) return { r: { ...r, motivo: 'buzon_no_registrado' }, parsed };

    return { r: { ...r, ok: true, tipo: 'aviso', texto: parsed.text ?? '' }, parsed };
}

/**
 * Verifica el correo tal como llegó y, si no pasa, el original adjunto
 * (`message/rfc822`, reenvío «como adjunto»). Nunca lanza.
 */
export async function verificarCorreoBancario(mime: Buffer, op: OpcionesVerificacion): Promise<ResultadoVerificacion> {
    const { r, parsed } = await verificarUno(mime, op);
    if (r.ok || !parsed) return r;

    const adjuntos = (parsed.attachments ?? [])
        .filter((a) => (a.contentType ?? '').toLowerCase() === 'message/rfc822')
        .slice(0, 3);
    let ultimo: ResultadoVerificacion | null = null;
    for (const a of adjuntos) {
        const interno = await verificarUno(Buffer.from(a.content), op);
        if (interno.r.ok) return { ...interno.r, viaAdjunto: true };
        ultimo = { ...interno.r, viaAdjunto: true };
    }
    // Con adjunto, el motivo útil es el del original; sin adjunto, el del sobre.
    return ultimo ?? r;
}

/** Extrae el código y el enlace del correo de confirmación de reenvío de Gmail. */
export function leerConfirmacionReenvio(texto: string): { codigo: string | null; enlace: string | null } {
    const codigo = /(?:c[oó]digo de confirmaci[oó]n|confirmation code)\s*:?\s*(\d{6,12})/i.exec(texto)?.[1] ?? null;
    const enlace = /(https:\/\/(?:mail-settings\.google\.com|mail\.google\.com)\/\S+)/i.exec(texto)?.[1] ?? null;
    return { codigo, enlace };
}

// ─── Firma del webhook de Resend (Svix) ─────────────────────────────────────

/**
 * Verifica `svix-signature` sobre el cuerpo CRUDO, como documenta Resend/Svix:
 *   firmado = `${svix-id}.${svix-timestamp}.${cuerpo}`
 *   firma   = base64(HMAC-SHA256(base64decode(secreto sin «whsec_»), firmado))
 *   cabecera: «v1,<firma> v1,<otra>» (varias al rotar el secreto)
 * Rechaza timestamps a más de 5 min (replay). Comparación en tiempo constante.
 * Se implementa a mano (25 líneas) para no sumar la dependencia `svix`.
 */
export function verificarFirmaSvix(
    cuerpo: Buffer | string,
    cab: { id?: string | null; timestamp?: string | null; signature?: string | null },
    secreto: string | undefined,
    ahoraSeg: number = Math.floor(Date.now() / 1000),
    toleranciaSeg = 300,
): boolean {
    if (!secreto || !cab.id || !cab.timestamp || !cab.signature) return false;
    const ts = Number(cab.timestamp);
    if (!Number.isFinite(ts) || Math.abs(ahoraSeg - ts) > toleranciaSeg) return false;

    const llave = Buffer.from(secreto.startsWith('whsec_') ? secreto.slice(6) : secreto, 'base64');
    if (llave.length === 0) return false;
    const firmado = Buffer.concat([
        Buffer.from(`${cab.id}.${cab.timestamp}.`, 'utf8'),
        Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(cuerpo, 'utf8'),
    ]);
    const esperada = crypto.createHmac('sha256', llave).update(firmado).digest();

    return cab.signature.split(' ').some((parte) => {
        const [version, valor] = parte.split(',');
        if (version !== 'v1' || !valor) return false;
        const recibida = Buffer.from(valor, 'base64');
        return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
    });
}
