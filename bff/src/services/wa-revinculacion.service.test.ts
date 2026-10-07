import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const rpcMock = vi.fn();
vi.mock('../config/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpcMock(...a) } }));

const {
    revinculacionPendiente, hashCodigo, enmascararCorreo, atenderRevinculacion, MENSAJES,
} = await import('./wa-revinculacion.service');

function deps() {
    return {
        verificarCodigo: vi.fn((_c: string) => Promise.resolve()),
        enviar: vi.fn((_t: string, _p: string) => Promise.resolve()),
        escalar: vi.fn((_m: string) => Promise.resolve()),
        enviarCorreo: vi.fn((_para: string, _c: string) => Promise.resolve()),
        generarCodigo: () => '482913',
    };
}
const CTX = { integrationId: 'int-1', contactWaId: '573001234567', texto: 'hola, cuánto debo' };

beforeEach(() => { rpcMock.mockReset(); });

describe('piezas puras', () => {
    it('revinculacionPendiente solo con el estado exacto de la RPC', () => {
        expect(revinculacionPendiente({ estado: 'revinculacion_pendiente' })).toBe(true);
        expect(revinculacionPendiente({ estado: 'identificado', parent_id: 'p' })).toBe(false);
        expect(revinculacionPendiente(null)).toBe(false);
    });
    it('el hash es el mismo sha256 que compara wa_verify_otp (hashOtp del bot)', () => {
        expect(hashCodigo('123456')).toBe(crypto.createHash('sha256').update('123456').digest('hex'));
    });
    it('enmascara el correo', () => {
        expect(enmascararCorreo('mariana@gmail.com')).toBe('ma*****@gmail.com');
    });
});

describe('atenderRevinculacion', () => {
    it('sin código: genera uno, lo manda al CORREO (no por WhatsApp) y nunca lo escribe en el chat', async () => {
        rpcMock.mockResolvedValue({ data: { ok: true, email: 'mariana@gmail.com' }, error: null });
        const d = deps();

        expect(await atenderRevinculacion(CTX, d)).toBe('codigo_enviado');

        const [nombre, args] = rpcMock.mock.calls[0];
        expect(nombre).toBe('wa_iniciar_revinculacion');
        expect(args.p_otp_hash).toBe(hashCodigo('482913'));
        expect(args).not.toHaveProperty('p_email'); // el correo lo pone la base, no quien escribe
        expect(d.enviarCorreo).toHaveBeenCalledWith('mariana@gmail.com', '482913');
        const [texto, paso] = d.enviar.mock.calls[0];
        expect(paso).toBe('revinculacion_codigo_enviado');
        expect(texto).toContain('ma*****@gmail.com');
        expect(texto).not.toContain('482913');
        expect(texto).not.toContain('mariana@');
    });

    it('con el código de 6 dígitos: lo verifica con el OTP de siempre y no genera otro', async () => {
        const d = deps();
        expect(await atenderRevinculacion({ ...CTX, texto: 'mi código es 482913' }, d)).toBe('codigo_verificado');
        expect(d.verificarCodigo).toHaveBeenCalledWith('482913');
        expect(rpcMock).not.toHaveBeenCalled();
        expect(d.enviarCorreo).not.toHaveBeenCalled();
    });

    it('código vigente: recuerda dónde está, sin mandar otro correo', async () => {
        rpcMock.mockResolvedValue({ data: { ok: false, motivo: 'codigo_vigente', email: 'mariana@gmail.com' }, error: null });
        const d = deps();
        expect(await atenderRevinculacion(CTX, d)).toBe('codigo_vigente');
        expect(d.enviarCorreo).not.toHaveBeenCalled();
        expect(d.enviar).toHaveBeenCalledWith(MENSAJES.codigoVigente('ma*****@gmail.com'), 'revinculacion_codigo_vigente');
    });

    it('sin correo en el perfil: a la escuela, sin datos ni código', async () => {
        rpcMock.mockResolvedValue({ data: { ok: false, motivo: 'sin_correo' }, error: null });
        const d = deps();
        expect(await atenderRevinculacion(CTX, d)).toBe('a_la_escuela');
        expect(d.escalar).toHaveBeenCalledOnce();
        expect(d.enviarCorreo).not.toHaveBeenCalled();
        expect(d.enviar).not.toHaveBeenCalled();
    });

    it('RPC caída o sin revinculación: no manda nada (quien llama escala)', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
        const d = deps();
        expect(await atenderRevinculacion(CTX, d)).toBe('sin_revinculacion');
        expect(d.enviar).not.toHaveBeenCalled();
        expect(d.enviarCorreo).not.toHaveBeenCalled();
    });
});
