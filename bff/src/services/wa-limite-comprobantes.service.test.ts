import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpcMock = vi.fn();
vi.mock('../config/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpcMock(...a) } }));

const {
    interpretarCupo, reservarCupoOcr, frenarSiExcedeLimite, MENSAJE_COMPROBANTE_A_REVISION, PASO_LIMITE,
} = await import('./wa-limite-comprobantes.service');

function deps(guardadoOk = true) {
    return {
        guardarArchivo: vi.fn(() => Promise.resolve({ ok: guardadoOk })),
        responder: vi.fn(() => Promise.resolve({ ok: true })),
        cerrar: vi.fn(() => Promise.resolve()),
    };
}

beforeEach(() => { rpcMock.mockReset(); });

describe('interpretarCupo', () => {
    it('permitido explícito → pasa', () => {
        expect(interpretarCupo({ permitido: true, motivo: 'ok' }, null)).toEqual({ permitido: true, motivo: 'ok' });
    });
    it('límite por número o por escuela → frena', () => {
        expect(interpretarCupo({ permitido: false, motivo: 'limite_numero' }, null))
            .toEqual({ permitido: false, motivo: 'limite_numero' });
        expect(interpretarCupo({ permitido: false, motivo: 'limite_escuela' }, null))
            .toEqual({ permitido: false, motivo: 'limite_escuela' });
    });
    it('falla ABIERTO: error, sin datos (RPC sin aplicar) o motivo desconocido', () => {
        expect(interpretarCupo(null, { message: 'function does not exist' }).permitido).toBe(true);
        expect(interpretarCupo(null, null).permitido).toBe(true);
        expect(interpretarCupo({ permitido: false, motivo: 'fila_inexistente' }, null).permitido).toBe(true);
    });
});

describe('reservarCupoOcr', () => {
    it('manda SOLO el id de la fila (escuela y número los saca la base)', async () => {
        rpcMock.mockResolvedValue({ data: { permitido: true, motivo: 'ok' }, error: null });
        await reservarCupoOcr('q-1');
        expect(rpcMock).toHaveBeenCalledWith('wa_reservar_cupo_ocr', { p_queue_id: 'q-1' });
    });
    it('una excepción no tumba el worker: se lee igual', async () => {
        rpcMock.mockImplementation(() => { throw new Error('red'); });
        expect((await reservarCupoOcr('q-1')).permitido).toBe(true);
    });
});

describe('frenarSiExcedeLimite', () => {
    it('dentro del cupo: no toca nada y el worker sigue al OCR', async () => {
        rpcMock.mockResolvedValue({ data: { permitido: true, motivo: 'ok' }, error: null });
        const d = deps();
        expect(await frenarSiExcedeLimite('q-1', d)).toBe(false);
        expect(d.guardarArchivo).not.toHaveBeenCalled();
        expect(d.responder).not.toHaveBeenCalled();
        expect(d.cerrar).not.toHaveBeenCalled();
    });

    it('pasado del tope: guarda el archivo, responde neutro y cierra escalada (sin OCR)', async () => {
        rpcMock.mockResolvedValue({ data: { permitido: false, motivo: 'limite_numero' }, error: null });
        const d = deps();
        expect(await frenarSiExcedeLimite('q-1', d)).toBe(true);
        expect(d.guardarArchivo).toHaveBeenCalledOnce();
        expect(d.responder).toHaveBeenCalledWith(MENSAJE_COMPROBANTE_A_REVISION, PASO_LIMITE);
        expect(d.cerrar).toHaveBeenCalledWith({ result_type: 'escalated', error_message: 'limite_ocr: limite_numero' });
        // El mensaje no le enseña la regla a quien abusa.
        expect(MENSAJE_COMPROBANTE_A_REVISION.toLowerCase()).not.toMatch(/l[ií]mite|intentos|demasiad/);
    });

    it('si no se pudo guardar el archivo, para sin responder (bajarYGuardar ya reintentó/cerró)', async () => {
        rpcMock.mockResolvedValue({ data: { permitido: false, motivo: 'limite_escuela' }, error: null });
        const d = deps(false);
        expect(await frenarSiExcedeLimite('q-1', d)).toBe(true);
        expect(d.responder).not.toHaveBeenCalled();
        expect(d.cerrar).not.toHaveBeenCalled();
    });

    it('RPC sin aplicar (data null): se lee como siempre', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'Could not find the function' } });
        const d = deps();
        expect(await frenarSiExcedeLimite('q-1', d)).toBe(false);
    });
});
