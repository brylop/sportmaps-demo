/**
 * Verificación DKIM de los avisos del banco, con firmas REALES (llaves RSA de
 * prueba + DNS falso). Lo que se vigila es lo que permitiría registrar como
 * confirmado un pago que el banco nunca avisó.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
    bancoDeDominio,
    leerConfirmacionReenvio,
    verificarCorreoBancario,
    verificarFirmaSvix,
} from './banco-correo-dkim.service';
import { armarCorreo, comoAdjunto, firmar, nuevaLlave, resolverDe, type Llave } from '../../test/correo-firmado';

const BUZON = 'pagos.escuela@gmail.com';
const ENTRADA = 'banco+0123456789abcdef0123@entrada.sportmaps.co';
const NEQUI_FROM = 'Nequi <notificaciones@nequi.com.co>';
const NEQUI_D = 'notificaciones.nequi.com.co';
const CUERPO = '¡Hola! Recibiste 400.000 de ANA MARIA PEREZ GOMEZ el 15 de septiembre de 2026 a las 4:19 p.m, desde el banco Bancolombia.';

let nequi: Llave;
let bancolombia: Llave;
let google: Llave;
let atacante: Llave;
let resolver: ReturnType<typeof resolverDe>;

beforeAll(() => {
    nequi = nuevaLlave();
    bancolombia = nuevaLlave();
    google = nuevaLlave();
    atacante = nuevaLlave();
    resolver = resolverDe({
        [`smtp1._domainkey.${NEQUI_D}`]: nequi.txt,
        'sel._domainkey.an.notificacionesbancolombia.com': bancolombia.txt,
        '20230601._domainkey.google.com': google.txt,
        'x._domainkey.evil.com': atacante.txt,
    });
});

const op = (extra: Partial<{ buzones: string[] }> = {}) => ({ buzones: [BUZON], direccionEntrada: ENTRADA, resolver, ...extra });

async function avisoNequi(o: { to?: string; cuerpo?: string; headerList?: string[]; maxBodyLength?: number } = {}) {
    return firmar(armarCorreo({ from: NEQUI_FROM, to: o.to ?? BUZON, cuerpo: o.cuerpo ?? CUERPO, messageId: '<aviso-1@nequi.com.co>' }), {
        dominio: NEQUI_D, selector: 'smtp1', llave: nequi, headerList: o.headerList, maxBodyLength: o.maxBodyLength,
    });
}

describe('DKIM — lo que SÍ pasa', () => {
    it('aviso de Nequi firmado, alineado, al buzón registrado', async () => {
        const r = await verificarCorreoBancario(Buffer.from(await avisoNequi()), op());
        expect(r).toMatchObject({
            ok: true, motivo: null, tipo: 'aviso', banco: 'nequi',
            from: 'notificaciones@nequi.com.co', dkimDomain: NEQUI_D, dkimSelector: 'smtp1',
            signedTo: [BUZON], messageId: '<aviso-1@nequi.com.co>', viaAdjunto: false,
        });
        expect(r.texto).toContain('Recibiste 400.000');
        expect(r.bodySha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('el buzón se compara sin mayúsculas', async () => {
        const r = await verificarCorreoBancario(Buffer.from(await avisoNequi()), op({ buzones: ['Pagos.Escuela@Gmail.com '] }));
        expect(r.ok).toBe(true);
    });

    it('reenvío AUTOMÁTICO de Gmail (agrega encabezados arriba, no toca lo firmado) sigue válido', async () => {
        const firmado = await avisoNequi();
        const reenviado = [
            'Received: from mail-sor-f41.google.com by inbound.resend.app',
            `X-Forwarded-To: ${ENTRADA}`,
            `X-Forwarded-For: ${BUZON} ${ENTRADA}`,
            `Delivered-To: ${BUZON}`,
            firmado,
        ].join('\r\n');
        const r = await verificarCorreoBancario(Buffer.from(reenviado), op());
        expect(r.ok).toBe(true);
    });

    it('reenvío COMO ADJUNTO: se verifica el original adjunto', async () => {
        const sobre = comoAdjunto(await avisoNequi(), { from: BUZON, to: ENTRADA });
        const r = await verificarCorreoBancario(Buffer.from(sobre), op());
        expect(r).toMatchObject({ ok: true, viaAdjunto: true, banco: 'nequi', signedTo: [BUZON] });
        expect(r.texto).toContain('ANA MARIA PEREZ GOMEZ');
    });

    it('Bancolombia desde un subdominio de notificacionesbancolombia.com', async () => {
        const correo = await firmar(armarCorreo({
            from: 'alertasynotificaciones@an.notificacionesbancolombia.com', to: BUZON,
            cuerpo: 'Bancolombia: recibiste una transferencia de ANA PEREZ por $400000.00 en tu cuenta *6943 el 15/09/26 a las 16:09.',
        }), { dominio: 'an.notificacionesbancolombia.com', selector: 'sel', llave: bancolombia });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: true, banco: 'bancolombia' });
    });

    it('confirmación de reenvío de Gmail a nuestra dirección', async () => {
        const correo = await firmar(armarCorreo({
            from: 'Gmail Team <forwarding-noreply@google.com>', to: ENTRADA,
            cuerpo: 'Código de confirmación: 123456789\r\nhttps://mail-settings.google.com/mail/vf-abc123',
        }), { dominio: 'google.com', selector: '20230601', llave: google });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: true, tipo: 'confirmacion_reenvio' });
        expect(leerConfirmacionReenvio(r.texto)).toEqual({
            codigo: '123456789', enlace: 'https://mail-settings.google.com/mail/vf-abc123',
        });
    });
});

describe('DKIM — lo que se RECHAZA', () => {
    it('cuerpo alterado después de firmar (400.000 → 900.000)', async () => {
        const alterado = (await avisoNequi()).replace('400.000', '900.000');
        const r = await verificarCorreoBancario(Buffer.from(alterado), op());
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_invalido' });
    });

    it('sin firma: un From de Nequi escrito por cualquiera', async () => {
        const r = await verificarCorreoBancario(Buffer.from(armarCorreo({ from: NEQUI_FROM, to: BUZON, cuerpo: CUERPO })), op());
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_invalido' });
    });

    it('firma válida pero de OTRO dominio (d=evil.com) con From de Nequi', async () => {
        const correo = await firmar(armarCorreo({ from: NEQUI_FROM, to: BUZON, cuerpo: CUERPO }),
            { dominio: 'evil.com', selector: 'x', llave: atacante });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_invalido' });
    });

    it('firmado con la llave equivocada para el selector de Nequi', async () => {
        const correo = await firmar(armarCorreo({ from: NEQUI_FROM, to: BUZON, cuerpo: CUERPO }),
            { dominio: NEQUI_D, selector: 'smtp1', llave: atacante });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_invalido' });
    });

    it('DNS del banco no responde → no hay forma de verificar', async () => {
        const r = await verificarCorreoBancario(Buffer.from(await avisoNequi()), { ...op(), resolver: resolverDe({}) });
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_invalido' });
    });

    it('remitente que no es banco (aunque esté bien firmado)', async () => {
        const correo = await firmar(armarCorreo({ from: 'pagos@evil.com', to: BUZON, cuerpo: CUERPO }),
            { dominio: 'evil.com', selector: 'x', llave: atacante });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'remitente_no_es_banco' });
    });

    it('reenvío EN LÍNEA (botón «Reenviar»): la firma del banco no sobrevive', async () => {
        const enLinea = armarCorreo({
            from: BUZON, to: ENTRADA,
            cuerpo: `---------- Forwarded message ---------\r\nDe: Nequi <notificaciones@nequi.com.co>\r\n\r\n${CUERPO}`,
        });
        const r = await verificarCorreoBancario(Buffer.from(enLinea), op());
        expect(r.ok).toBe(false);
        expect(r.motivo).toBe('remitente_no_es_banco');
    });

    it('aviso REAL de Nequi pero a OTRO buzón (alguien que se mandó plata a sí mismo)', async () => {
        const r = await verificarCorreoBancario(Buffer.from(await avisoNequi({ to: 'atacante@gmail.com' })), op());
        expect(r).toMatchObject({ ok: false, motivo: 'buzon_no_registrado' });
    });

    it('la escuela no registró buzones → fail-closed', async () => {
        const r = await verificarCorreoBancario(Buffer.from(await avisoNequi()), op({ buzones: [] }));
        expect(r).toMatchObject({ ok: false, motivo: 'buzon_no_configurado' });
    });

    it('To: fuera de los encabezados firmados', async () => {
        const correo = await avisoNequi({ headerList: ['From', 'Subject', 'Date', 'Message-ID'] });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'to_no_firmado' });
    });

    it('un segundo To: agregado arriba para colar otro buzón', async () => {
        const correo = `To: ${BUZON}\r\n` + (await avisoNequi({ to: 'atacante@gmail.com' }));
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r.ok).toBe(false);
        expect(['to_multiple', 'dkim_invalido']).toContain(r.motivo);
    });

    it('firma con l= (cubre solo parte del cuerpo)', async () => {
        const correo = await avisoNequi({ maxBodyLength: 20 });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'dkim_cuerpo_parcial' });
    });

    it('confirmación de Gmail dirigida a otra dirección', async () => {
        const correo = await firmar(armarCorreo({
            from: 'forwarding-noreply@google.com', to: 'otra@entrada.sportmaps.co', cuerpo: 'Código de confirmación: 1',
        }), { dominio: 'google.com', selector: '20230601', llave: google });
        const r = await verificarCorreoBancario(Buffer.from(correo), op());
        expect(r).toMatchObject({ ok: false, motivo: 'buzon_no_registrado' });
    });

    it('basura en vez de MIME no lanza', async () => {
        const r = await verificarCorreoBancario(Buffer.from('esto no es un correo'), op());
        expect(r.ok).toBe(false);
    });
});

describe('lista blanca de dominios', () => {
    it('subdominios sí, dominios parecidos no', () => {
        expect(bancoDeDominio('notificaciones.nequi.com.co')).toBe('nequi');
        expect(bancoDeDominio('an.notificacionesbancolombia.com')).toBe('bancolombia');
        expect(bancoDeDominio('nequi.com.co.evil.com')).toBeNull();
        expect(bancoDeDominio('falsonequi.com.co')).toBeNull();
    });
});

describe('firma del webhook (Svix)', () => {
    const secretoB64 = Buffer.from('secreto-de-prueba-32-bytes-12345').toString('base64');
    const SECRETO = `whsec_${secretoB64}`;
    const cuerpo = Buffer.from('{"type":"email.received","data":{"email_id":"e1"}}');
    const ahora = 1_791_400_000;
    const firmarSvix = (id: string, ts: number, body: Buffer, secreto = secretoB64) =>
        'v1,' + crypto.createHmac('sha256', Buffer.from(secreto, 'base64'))
            .update(Buffer.concat([Buffer.from(`${id}.${ts}.`), body])).digest('base64');

    it('válida', () => {
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_1', timestamp: String(ahora), signature: firmarSvix('msg_1', ahora, cuerpo) }, SECRETO, ahora)).toBe(true);
    });
    it('varias firmas (rotación): basta una válida', () => {
        const sig = `v1,AAAA ${firmarSvix('msg_1', ahora, cuerpo)}`;
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_1', timestamp: String(ahora), signature: sig }, SECRETO, ahora)).toBe(true);
    });
    it('cuerpo alterado', () => {
        const sig = firmarSvix('msg_1', ahora, cuerpo);
        expect(verificarFirmaSvix(Buffer.from(cuerpo.toString().replace('e1', 'e2')), { id: 'msg_1', timestamp: String(ahora), signature: sig }, SECRETO, ahora)).toBe(false);
    });
    it('secreto equivocado', () => {
        const sig = firmarSvix('msg_1', ahora, cuerpo, Buffer.from('otro-secreto').toString('base64'));
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_1', timestamp: String(ahora), signature: sig }, SECRETO, ahora)).toBe(false);
    });
    it('timestamp viejo (replay) o id cambiado', () => {
        const sig = firmarSvix('msg_1', ahora - 600, cuerpo);
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_1', timestamp: String(ahora - 600), signature: sig }, SECRETO, ahora)).toBe(false);
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_2', timestamp: String(ahora), signature: firmarSvix('msg_1', ahora, cuerpo) }, SECRETO, ahora)).toBe(false);
    });
    it('sin secreto configurado o sin cabeceras → falso', () => {
        expect(verificarFirmaSvix(cuerpo, { id: 'msg_1', timestamp: String(ahora), signature: firmarSvix('msg_1', ahora, cuerpo) }, undefined, ahora)).toBe(false);
        expect(verificarFirmaSvix(cuerpo, {}, SECRETO, ahora)).toBe(false);
    });
});
