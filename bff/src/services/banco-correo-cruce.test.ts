/**
 * Cruce determinístico aviso ↔ pagos, e idempotencia del procesamiento.
 *
 * Reglas que no se pueden romper:
 *   · solo un pago YA pagado queda 'conciliado';
 *   · un pago pendiente nunca se aprueba: queda 'candidato';
 *   · si hay más de un pago posible, decide una persona ('ambiguo');
 *   · la misma entrega o el mismo contenido no se procesa dos veces.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EntradaBancaria } from './banco-correo-parser.service';
import {
    decidirCruce,
    destinoCompatible,
    procesarEventoResend,
    tokenDeDestinatarios,
    type AvisoGuardado,
    type DepsProceso,
    type FilaAviso,
    type PagoCandidato,
    type RepoAvisosBanco,
} from './banco-correo-cruce.service';
import { armarCorreo, firmar, nuevaLlave, resolverDe, type Llave } from '../../test/correo-firmado';

const entrada = (o: Partial<EntradaBancaria> = {}): EntradaBancaria => ({
    banco: 'nequi', monto: 400000, remitente: 'ANA MARIA PEREZ GOMEZ', fecha: '2026-09-15',
    hora: '16:19', bancoOrigen: 'Bancolombia', destino: null, ...o,
});

let n = 0;
const pago = (o: Partial<PagoCandidato> = {}): PagoCandidato => ({
    id: `p${++n}`, status: 'paid', amount: 400000, amount_paid: null,
    payment_date: '2026-09-16', ocr_date: '2026-09-15', due_date: '2026-09-05',
    reconciliation_status: null, ocr_destination: null, ocr_origin_name: null,
    nombre_pagador: null, ya_conciliado_por_aviso: false, ...o,
});

describe('decidirCruce', () => {
    it('UN pago pagado con monto y fecha → conciliado', () => {
        const p = pago();
        expect(decidirCruce(entrada(), [p])).toMatchObject({ estado: 'conciliado', paymentId: p.id, base: 'monto_fecha' });
    });

    it('acepta reconciliation_status «pendiente» (el que estampa la aprobación)', () => {
        const p = pago({ reconciliation_status: 'pendiente' });
        expect(decidirCruce(entrada(), [p]).estado).toBe('conciliado');
    });

    it('monto distinto por un peso → sin cruce', () => {
        expect(decidirCruce(entrada(), [pago({ amount: 399999 })]).estado).toBe('sin_cruce');
    });

    it('usa amount_paid del pago pagado', () => {
        const p = pago({ amount: 450000, amount_paid: 400000 });
        expect(decidirCruce(entrada(), [p]).paymentId).toBe(p.id);
    });

    it('fecha del comprobante a más de 1 día → sin cruce', () => {
        expect(decidirCruce(entrada(), [pago({ ocr_date: '2026-09-12' })]).estado).toBe('sin_cruce');
    });

    it('sin fecha de comprobante: payment_date entre −1 y +3 días (la escuela aprueba después)', () => {
        expect(decidirCruce(entrada(), [pago({ ocr_date: null, payment_date: '2026-09-18' })]).estado).toBe('conciliado');
        expect(decidirCruce(entrada(), [pago({ ocr_date: null, payment_date: '2026-09-20' })]).estado).toBe('sin_cruce');
    });

    it('ya conciliado (por otro aviso o por extracto) no se reclama dos veces', () => {
        expect(decidirCruce(entrada(), [pago({ ya_conciliado_por_aviso: true })]).estado).toBe('sin_cruce');
        expect(decidirCruce(entrada(), [pago({ reconciliation_status: 'confirmado' })]).estado).toBe('sin_cruce');
    });

    it('pago PENDIENTE que coincide → candidato, NUNCA conciliado', () => {
        const p = pago({ status: 'awaiting_approval' });
        expect(decidirCruce(entrada(), [p])).toMatchObject({ estado: 'candidato', paymentId: p.id });
        const q = pago({ status: 'pending', ocr_date: null, due_date: '2026-09-05' });
        expect(decidirCruce(entrada(), [q])).toMatchObject({ estado: 'candidato', paymentId: q.id });
    });

    it('cancelados / rechazados no entran', () => {
        expect(decidirCruce(entrada(), [pago({ status: 'cancelled' }), pago({ status: 'rejected' })]).estado).toBe('sin_cruce');
    });

    it('dos familias pagan lo mismo el mismo día → ambiguo', () => {
        const a = pago(); const b = pago();
        expect(decidirCruce(entrada(), [a, b])).toMatchObject({ estado: 'ambiguo', paymentId: null, candidatos: [a.id, b.id] });
    });

    it('el nombre desempata', () => {
        const a = pago({ nombre_pagador: 'Carlos Ruiz Mora' });
        const b = pago({ ocr_origin_name: 'Ana María Pérez' });
        expect(decidirCruce(entrada(), [a, b])).toMatchObject({ estado: 'conciliado', paymentId: b.id, base: 'monto_fecha_nombre' });
    });

    it('un pagado y un pendiente del mismo monto sin nombre → ambiguo (no tapar un comprobante falso)', () => {
        expect(decidirCruce(entrada(), [pago(), pago({ status: 'awaiting_approval' })]).estado).toBe('ambiguo');
    });

    it('único por monto+fecha pero el comprobante dice OTRO pagador → candidato, no conciliado', () => {
        const p = pago({ ocr_origin_name: 'CARLOS RUIZ MORA' });
        expect(decidirCruce(entrada(), [p])).toMatchObject({ estado: 'candidato', paymentId: p.id });
    });

    it('cuenta destino: últimos 4 dígitos', () => {
        expect(destinoCompatible('6943', '0012345696943')).toBe(true);
        expect(destinoCompatible('*6943', '001234561111')).toBe(false);
        expect(destinoCompatible(null, '001234561111')).toBe(true);
        expect(decidirCruce(entrada({ destino: '6943' }), [pago({ ocr_destination: '3001111111' })]).estado).toBe('sin_cruce');
    });
});

describe('tokenDeDestinatarios', () => {
    it('encuentra la dirección en received_for (reenvío automático: el To es el buzón de la escuela)', () => {
        const r = tokenDeDestinatarios({
            type: 'email.received',
            data: { email_id: 'e', to: ['pagos@gmail.com'], received_for: ['Banco <banco+0123456789abcdef0123@entrada.sportmaps.co>'] },
        }, 'entrada.sportmaps.co');
        expect(r).toEqual({ token: '0123456789abcdef0123', direccion: 'banco+0123456789abcdef0123@entrada.sportmaps.co' });
    });
    it('otro dominio o token mal formado → null', () => {
        expect(tokenDeDestinatarios({ type: 'email.received', data: { to: ['banco+0123456789abcdef0123@evil.com'] } }, 'entrada.sportmaps.co')).toBeNull();
        expect(tokenDeDestinatarios({ type: 'email.received', data: { to: ['banco+xyz@entrada.sportmaps.co'] } }, 'entrada.sportmaps.co')).toBeNull();
    });
});

// ─── procesarEventoResend con repo en memoria y firmas DKIM reales ──────────

const TOKEN = '0123456789abcdef0123';
const DOMINIO = 'entrada.sportmaps.co';
const ENTRADA = `banco+${TOKEN}@${DOMINIO}`;
const BUZON = 'pagos.escuela@gmail.com';
const ESCUELA = 'school-1';

let llave: Llave;
let resolver: ReturnType<typeof resolverDe>;
beforeAll(() => {
    llave = nuevaLlave();
    resolver = resolverDe({ 'smtp1._domainkey.notificaciones.nequi.com.co': llave.txt });
});

async function avisoFirmado(o: { messageId?: string; cuerpo?: string } = {}) {
    return firmar(armarCorreo({
        from: 'Nequi <notificaciones@nequi.com.co>', to: BUZON, messageId: o.messageId ?? '<m1@nequi.com.co>',
        cuerpo: o.cuerpo ?? 'Recibiste 400.000 de ANA MARIA PEREZ GOMEZ el 15 de septiembre de 2026 a las 4:19 p.m, desde el banco Bancolombia.',
    }), { dominio: 'notificaciones.nequi.com.co', selector: 'smtp1', llave });
}

class RepoMemoria implements RepoAvisosBanco {
    flag = true;
    avisos: (FilaAviso & { id: string })[] = [];
    pagos: PagoCandidato[] = [];
    aplicados: { noticeId: string; estado: string; paymentId: string | null }[] = [];
    fallarAplicar = 0;

    async buzonPorToken(t: string) { return t === TOKEN ? { schoolId: ESCUELA, mailboxes: [BUZON] } : null; }
    async flagActivo() { return this.flag; }
    async avisoPorEntrega(id: string): Promise<AvisoGuardado | null> {
        const a = this.avisos.find((x) => x.resend_email_id === id);
        return a ? { ...a } : null;
    }
    async insertarAviso(f: FilaAviso) {
        if (this.avisos.some((a) => a.resend_email_id === f.resend_email_id
            || ((a.message_id ?? '') === (f.message_id ?? '') && a.body_sha256 === f.body_sha256))) return 'duplicado' as const;
        const id = `n${this.avisos.length + 1}`;
        this.avisos.push({ ...f, id });
        return { id };
    }
    async pagosCandidatos() { return this.pagos; }
    async aplicarCruce(noticeId: string, estado: string, paymentId: string | null) {
        if (this.fallarAplicar > 0) { this.fallarAplicar--; throw new Error('db caída'); }
        const a = this.avisos.find((x) => x.id === noticeId)!;
        if (a.estado !== 'verificado') return a.estado;
        (a as any).estado = estado;
        this.aplicados.push({ noticeId, estado, paymentId });
        if (estado === 'conciliado') {
            const p = this.pagos.find((x) => x.id === paymentId)!;
            p.reconciliation_status = 'confirmado';
        }
        return estado;
    }
}

describe('procesarEventoResend', () => {
    let repo: RepoMemoria;
    let mimes: Record<string, string>;
    let deps: DepsProceso;
    const evento = (emailId: string) => ({ type: 'email.received', data: { email_id: emailId, to: [BUZON], received_for: [ENTRADA] } });

    beforeEach(() => {
        repo = new RepoMemoria();
        mimes = {};
        deps = {
            repo,
            fuente: { mimeCrudo: async (id) => Buffer.from(mimes[id]) },
            dominioEntrada: DOMINIO,
            resolver,
        };
    });

    it('aviso válido + pago pagado → conciliado (y solo ese pago)', async () => {
        const p = pago(); repo.pagos = [p, pago({ amount: 150000 })];
        mimes.e1 = await avisoFirmado();
        const r = await procesarEventoResend(evento('e1'), deps);
        expect(r).toMatchObject({ resultado: 'procesado', estado: 'conciliado', paymentId: p.id });
        expect(repo.avisos[0]).toMatchObject({ estado: 'conciliado', monto: 400000, fecha: '2026-09-15', banco: 'nequi', dkim_domain: 'notificaciones.nequi.com.co' });
        expect(p.reconciliation_status).toBe('confirmado');
        expect(repo.pagos[1].reconciliation_status).toBeNull();
    });

    it('idempotente: la MISMA entrega dos veces no cruza dos veces', async () => {
        repo.pagos = [pago()];
        mimes.e1 = await avisoFirmado();
        await procesarEventoResend(evento('e1'), deps);
        const r2 = await procesarEventoResend(evento('e1'), deps);
        expect(r2).toEqual({ resultado: 'duplicado' });
        expect(repo.avisos).toHaveLength(1);
        expect(repo.aplicados).toHaveLength(1);
    });

    it('idempotente: el MISMO aviso reenviado otra vez (otra entrega, mismo message-id y cuerpo)', async () => {
        repo.pagos = [pago(), pago()];
        const mime = await avisoFirmado();
        mimes.e1 = mime; mimes.e2 = mime;
        await procesarEventoResend(evento('e1'), deps);
        expect(await procesarEventoResend(evento('e2'), deps)).toEqual({ resultado: 'duplicado' });
        expect(repo.avisos).toHaveLength(1);
    });

    it('reintento tras caída entre guardar y cruzar: retoma el cruce', async () => {
        const p = pago(); repo.pagos = [p];
        mimes.e1 = await avisoFirmado();
        repo.fallarAplicar = 1;
        await expect(procesarEventoResend(evento('e1'), deps)).rejects.toThrow('db caída');
        expect(repo.avisos[0].estado).toBe('verificado');
        const r = await procesarEventoResend(evento('e1'), deps);
        expect(r).toMatchObject({ resultado: 'procesado', estado: 'conciliado', paymentId: p.id });
    });

    it('DKIM inválido → se guarda como rechazado y NO se cruza', async () => {
        repo.pagos = [pago()];
        mimes.e1 = (await avisoFirmado()).replace('400.000', '900.000');
        const r = await procesarEventoResend(evento('e1'), deps);
        expect(r).toMatchObject({ resultado: 'rechazado', motivo: 'dkim_invalido' });
        expect(repo.avisos[0]).toMatchObject({ estado: 'rechazado', monto: null });
        expect(repo.aplicados).toHaveLength(0);
        expect(repo.pagos[0].reconciliation_status).toBeNull();
    });

    it('pago pendiente → candidato; el pago no cambia', async () => {
        const p = pago({ status: 'awaiting_approval' }); repo.pagos = [p];
        mimes.e1 = await avisoFirmado();
        const r = await procesarEventoResend(evento('e1'), deps);
        expect(r).toMatchObject({ estado: 'candidato', paymentId: p.id });
        expect(p.status).toBe('awaiting_approval');
        expect(p.reconciliation_status).toBeNull();
    });

    it('correo del banco que no es plata entrante → no_es_aviso', async () => {
        mimes.e1 = await avisoFirmado({ cuerpo: 'Tu extracto de septiembre ya está disponible.' });
        expect(await procesarEventoResend(evento('e1'), deps)).toMatchObject({ resultado: 'no_es_aviso' });
    });

    it('flag apagado → ignorado, sin descargar ni guardar nada', async () => {
        repo.flag = false;
        let descargas = 0;
        deps.fuente = { mimeCrudo: async () => { descargas++; return Buffer.from(''); } };
        expect(await procesarEventoResend(evento('e1'), deps)).toEqual({ resultado: 'ignorado', motivo: 'flag_apagado' });
        expect(descargas).toBe(0);
        expect(repo.avisos).toHaveLength(0);
    });

    it('dirección desconocida u otro tipo de evento → ignorado', async () => {
        expect(await procesarEventoResend({ type: 'email.received', data: { email_id: 'e1', to: [`banco+ffffffffffffffffffff@${DOMINIO}`] } }, deps))
            .toEqual({ resultado: 'ignorado', motivo: 'destinatario_desconocido' });
        expect(await procesarEventoResend({ type: 'email.sent', data: { email_id: 'e1' } }, deps))
            .toEqual({ resultado: 'ignorado', motivo: 'tipo_evento' });
    });
});
