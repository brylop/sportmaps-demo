/**
 * Fábrica de correos firmados con DKIM REAL para los tests de la conciliación
 * por correo del banco. Genera llaves RSA de prueba, firma con mailauth (la
 * misma librería que verifica) y expone un resolver de DNS falso que publica
 * la llave pública como lo haría el banco en `<selector>._domainkey.<dominio>`.
 *
 * Así los tests ejercitan la verificación criptográfica de verdad, sin red.
 */
import crypto from 'crypto';
import { dkimSign } from 'mailauth/lib/dkim/sign';

export interface Llave { privada: string; txt: string }

export function nuevaLlave(): Llave {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    return {
        privada: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        txt: `v=DKIM1; k=rsa; p=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`,
    };
}

/** DNS falso: { 'smtp1._domainkey.notificaciones.nequi.com.co': llave.txt } */
export function resolverDe(registros: Record<string, string>) {
    return async (nombre: string, tipo: string) => {
        const txt = registros[nombre.toLowerCase()];
        if (tipo === 'TXT' && txt) return [[txt]];
        const e: any = new Error(`ENOTFOUND ${nombre}`);
        e.code = 'ENOTFOUND';
        throw e;
    };
}

export function armarCorreo(o: {
    from: string;
    to: string;
    subject?: string;
    messageId?: string;
    cuerpo: string;
    extraHeaders?: string[];
}): string {
    return [
        `From: ${o.from}`,
        `To: ${o.to}`,
        `Subject: ${o.subject ?? 'Notificación'}`,
        `Message-ID: ${o.messageId ?? `<${crypto.randomUUID()}@banco.test>`}`,
        'Date: Tue, 15 Sep 2026 16:19:00 -0500',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        ...(o.extraHeaders ?? []),
        '',
        o.cuerpo,
        '',
    ].join('\r\n');
}

export async function firmar(
    correo: string,
    o: { dominio: string; selector: string; llave: Llave; headerList?: string[]; maxBodyLength?: number },
): Promise<string> {
    const r = await dkimSign(correo, {
        signatureData: [{
            signingDomain: o.dominio,
            selector: o.selector,
            privateKey: o.llave.privada,
            ...(o.headerList ? { headerList: o.headerList } : {}),
            ...(o.maxBodyLength !== undefined ? { maxBodyLength: o.maxBodyLength } : {}),
        }],
    } as any);
    if (!r.signatures) throw new Error(`no se firmó: ${JSON.stringify(r.errors)}`);
    return r.signatures + correo;
}

/** «Reenviar como archivo adjunto» de Gmail: el original como message/rfc822. */
export function comoAdjunto(original: string, o: { from: string; to: string }): string {
    const limite = 'LIMITE123';
    return [
        `From: ${o.from}`,
        `To: ${o.to}`,
        'Subject: Fwd: Notificación',
        `Message-ID: <${crypto.randomUUID()}@gmail.test>`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${limite}"`,
        '',
        `--${limite}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Te reenvío el aviso.',
        `--${limite}`,
        'Content-Type: message/rfc822',
        'Content-Disposition: attachment; filename="aviso.eml"',
        '',
        original,
        `--${limite}--`,
        '',
    ].join('\r\n');
}
