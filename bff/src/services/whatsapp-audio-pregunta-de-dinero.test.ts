/**
 * Una pregunta de dinero abierta (cobro, deportista, mes, concepto: toda fila
 * `waiting_user` de la cola) NO se contesta por nota de voz transcrita: el
 * resolver recibe solo texto y no distingue «el de Sara» de «el de Sala», y
 * elegir aplica un comprobante. Se pide escrito, en los tres caminos:
 * familia identificada, familia sin cuenta (no identificada) y desconocido.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
    preguntaAbierta: true,
    resolver: vi.fn(async (..._a: any[]) => true),
    identificada: true,
}));

vi.mock('../config/supabase', () => {
    const builder = (table: string) => {
        const resolve = () => {
            if (table === 'whatsapp_inbound_queue') return { data: h.preguntaAbierta ? { id: 'q-1' } : null, error: null };
            if (table === 'whatsapp_conversations') {
                return { data: { id: 'conv-1', parent_id: h.identificada ? 'p-1' : null, identified: h.identificada, status: 'open' }, error: null };
            }
            if (table === 'whatsapp_settings') return { data: { ai_enabled: true, mode: 'auto' }, error: null };
            return { data: null, error: null, count: 0 };
        };
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lte', 'or', 'order', 'limit', 'is', 'not', 'neq', 'filter', 'contains', 'ilike', 'insert', 'update', 'upsert']) b[m] = () => b;
        b.maybeSingle = () => Promise.resolve(resolve());
        b.single = () => Promise.resolve(resolve());
        b.then = (res: any, rej: any) => Promise.resolve(resolve()).then(res, rej);
        return b;
    };
    return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null, error: null }) } };
});
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return { ...real, botEncendido: vi.fn(async () => true), debeAtender: vi.fn() };
});
vi.mock('./llm.service', () => ({ chatWithTools: vi.fn() }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.txt' })),
    sendInteractiveButtons: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.btn' })),
    aFormatoWhatsApp: (t: string) => t,
    markAsRead: vi.fn(),
}));
vi.mock('./whatsapp-optin.service', () => ({ estaDadoDeBaja: vi.fn(async () => false), AVISO_DADO_DE_BAJA: '' }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: (...a: any[]) => h.resolver(...a) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: vi.fn() }));
vi.mock('./whatsapp-prospecto-lead.service', () => ({ registrarLeadDeProspecto: vi.fn(async () => {}) }));

import { runBotTurn, atenderDesconocido, simularEnvios, TEXTO_COBRO_POR_AUDIO } from './whatsapp-bot.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;

beforeEach(() => {
    h.preguntaAbierta = true;
    h.identificada = true;
    h.resolver.mockClear();
});

describe('nota de voz con una pregunta de dinero abierta', () => {
    it('familia identificada: pide que lo escriban y NO resuelve', async () => {
        const { salidas } = await simularEnvios(() =>
            runBotTurn(INTEGRATION, 'conv-1', '573001112233', 'el de Sara', 'wamid.a', false, null, { origen: 'audio' }));
        expect(h.resolver).not.toHaveBeenCalled();
        expect(salidas.some((s) => s.step === 'cobro_por_audio' && s.texto.includes('escribas'))).toBe(true);
    });

    it('familia sin cuenta (no identificada): pide que lo escriban, no cae en el OTP ni resuelve', async () => {
        h.identificada = false;
        const { salidas } = await simularEnvios(() =>
            runBotTurn(INTEGRATION, 'conv-1', '573001112233', 'es de Sofía de octubre', 'wamid.b', false, null, { origen: 'audio' }));
        expect(h.resolver).not.toHaveBeenCalled();
        expect(salidas.map((s) => s.step)).toEqual(['cobro_por_audio']);
    });

    it('desconocido (sin ficha) por audio: pide escrito y NO resuelve', async () => {
        const { salidas, resultado } = await simularEnvios(() =>
            atenderDesconocido(INTEGRATION, 'conv-1', '573001112233', 'es de Sofía', null, null, 'audio'));
        expect(resultado).toBe('pregunta_de_comprobante');
        expect(h.resolver).not.toHaveBeenCalled();
        expect(salidas[0]).toMatchObject({ step: 'cobro_por_audio', texto: TEXTO_COBRO_POR_AUDIO });
    });

    it('el mismo desconocido por TEXTO sí resuelve (el cambio es solo para audio)', async () => {
        const { resultado } = await simularEnvios(() =>
            atenderDesconocido(INTEGRATION, 'conv-1', '573001112233', 'es de Sofía'));
        expect(h.resolver).toHaveBeenCalledTimes(1);
        expect(resultado).toBe('pregunta_de_comprobante');
    });
});
