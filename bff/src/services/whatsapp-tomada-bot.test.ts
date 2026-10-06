/**
 * Mejora 9 (2026-10-06): «Tomar la conversación». Con la conversación tomada
 * por una persona del buzón el bot no corre el modelo ni envía ni deja
 * borrador; al vencer la toma vuelve a hablar.
 *
 * Mismo andamiaje que whatsapp-atencion-bot.test.ts (Supabase encadenable,
 * `debeAtender` mockeado). `conversacionTomada` va REAL: lee
 * `whatsapp_conversations.tomada_*` del mock.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Ops = [string, any[]][];
    const state: {
        resolve: (table: string, ops: Ops) => any;
        rpc: (fn: string, args: any) => any;
        inserts: { table: string; row: any }[];
        updates: { table: string; row: any }[];
        rpcCalls: string[];
    } = {
        resolve: () => ({ data: null, error: null }),
        rpc: () => ({ data: null, error: null }),
        inserts: [],
        updates: [],
        rpcCalls: [],
    };
    function makeBuilder(table: string) {
        const ops: Ops = [];
        const b: any = {};
        const chain = (name: string) => (...args: any[]) => { ops.push([name, args]); return b; };
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lte', 'or', 'order', 'limit', 'update', 'is', 'not']) {
            b[m] = chain(m);
        }
        b.insert = (row: any) => { state.inserts.push({ table, row }); ops.push(['insert', [row]]); return b; };
        b.update = (row: any) => { state.updates.push({ table, row }); ops.push(['update', [row]]); return b; };
        b.maybeSingle = () => Promise.resolve(state.resolve(table, ops));
        b.single = () => Promise.resolve(state.resolve(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(state.resolve(table, ops)).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: {
            from: (t: string) => makeBuilder(t),
            rpc: (fn: string, args: any) => { state.rpcCalls.push(fn); return Promise.resolve(state.rpc(fn, args)); },
        },
        debeAtender: vi.fn(),
        botEncendido: vi.fn(),
        chatWithTools: vi.fn(),
        sendTextMessage: vi.fn(),
        sendToUser: vi.fn(),
        encolarAdjunto: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
// `temaEscolar` va REAL: es la regla que se está probando de punta a punta.
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return {
        debeAtender: h.debeAtender,
        botEncendido: h.botEncendido,
        temaEscolar: real.temaEscolar,
        preguntaPrecioComoProspecto: real.preguntaPrecioComoProspecto,
    };
});
vi.mock('./llm.service', () => ({ chatWithTools: h.chatWithTools }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: h.sendTextMessage,
    sendInteractiveButtons: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.btn' })),
    aFormatoWhatsApp: (t: string) => t,
    verifyWebhookSignature: vi.fn(),
    resolveIntegration: vi.fn(),
    parseInboundMessages: vi.fn(() => []),
    parseStatuses: vi.fn(() => []),
    markAsRead: vi.fn(),
}));
vi.mock('./whatsapp-optin.service', () => ({
    estaDadoDeBaja: vi.fn(async () => false),
    AVISO_DADO_DE_BAJA: '\n\n(baja)',
}));
vi.mock('./whatsapp-horario.service', () => ({
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false })),
    mensajeDeEscalamiento: vi.fn(() => 'En breve te contactan.'),
}));
vi.mock('./push.service', () => ({ sendToUser: h.sendToUser }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({ mediosDePago: vi.fn() }));
vi.mock('./whatsapp-info-escuela.service', () => ({ infoDeEscuela: vi.fn(), fallbackInfoEscuela: vi.fn() }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
// El correo de escalamiento es no bloqueante y lo prueba su propio archivo;
// acá solo estorbaría con logs del agente de correo.
vi.mock('./avisos-correo.service', () => ({ avisarEscalamientoPorCorreo: vi.fn(async () => {}) }));
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: h.encolarAdjunto }));
vi.mock('./whatsapp-coexistence.service', () => ({
    procesarEchos: vi.fn(), procesarHistorial: vi.fn(), registrarAppState: vi.fn(),
}));

import { handleBotTurn } from '../routes/whatsapp';
import { runBotTurn, deliver } from './whatsapp-bot.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-1';
const PADRE = 'parent-1';
const req = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any;

const mensaje = (over: Record<string, any> = {}) => ({
    phoneNumberId: 'pn-1', contactWaId: '573001112233', contactName: 'Acudiente',
    waMessageId: 'wamid.1', type: 'text', textBody: '¿cuánto debo?', raw: {}, waTimestamp: null,
    ...over,
}) as any;

/** Base de una familia ya identificada y con consentimiento: el turno llega al LLM. */
let toma: Record<string, any> = {};
const EN_UNA_HORA = () => new Date(Date.now() + 3600_000).toISOString();
const HACE_UNA_HORA = () => new Date(Date.now() - 3600_000).toISOString();

function baseDeFamilia(settings: Record<string, any> = { ai_enabled: true, mode: 'assisted' }) {
    h.state.resolve = (table) => {
        if (table === 'whatsapp_conversations') {
            return { data: { id: CONV, parent_id: PADRE, identified: true, status: 'closed', contact_name: 'Acudiente',
                             ...toma }, error: null };
        }
        if (table === 'whatsapp_optins') {
            return { data: { opted_in_at: '2026-09-01T00:00:00Z', opted_out_at: null }, error: null };
        }
        if (table === 'whatsapp_settings') return { data: settings, error: null };
        if (table === 'schools') return { data: { name: 'Dynasty', owner_id: 'owner-1' }, error: null };
        if (table === 'school_members') return { data: [], error: null };
        return { data: null, error: null };
    };
    h.state.rpc = (fn) => {
        if (fn === 'wa_identify_by_phone') return { data: { estado: 'identificado', parent_id: PADRE }, error: null };
        return { data: null, error: null };
    };
}

const borradores = () => h.state.inserts.filter((i) => i.table === 'whatsapp_message_drafts');

beforeEach(() => {
    vi.clearAllMocks();
    h.state.inserts = [];
    h.state.updates = [];
    h.state.rpcCalls = [];
    toma = {};
    h.chatWithTools.mockResolvedValue({ text: 'Estás al día ✅', toolCalls: [], provider: 'test' });
    h.sendTextMessage.mockResolvedValue({ waMessageId: 'wamid.out' });
    h.botEncendido.mockResolvedValue(true);
    h.debeAtender.mockResolvedValue({ atender: true, tipo: 'familia', botEncendido: true, tomada: false });
    baseDeFamilia();
});

describe('conversación tomada desde el buzón', () => {
    it('con la toma VIGENTE el turno no corre el modelo, no envía ni deja borrador', async () => {
        toma = { tomada_por: 'admin-1', tomada_hasta: EN_UNA_HORA() };
        baseDeFamilia({ ai_enabled: true, mode: 'auto', assisted_until: null });
        await runBotTurn(INTEGRATION, CONV, '573001112233', '¿cuánto debo?', 'wamid.1', false, null, {} as any);
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(h.sendTextMessage).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('deliver se niega con la toma vigente (acuses, cortesía, ausencias pasan por acá)', async () => {
        toma = { tomada_por: 'admin-1', tomada_hasta: EN_UNA_HORA() };
        baseDeFamilia({ ai_enabled: true, mode: 'auto', assisted_until: null });
        await deliver(INTEGRATION, CONV, '573001112233', 'Recibí tu archivo 📄', { step: 'acuse_adjunto' });
        expect(h.sendTextMessage).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('webhook: tomada → ni la puerta del desconocido se abre', async () => {
        h.debeAtender.mockResolvedValue({ atender: false, tipo: 'desconocido', botEncendido: true, tomada: true });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje({ textBody: 'quiero inscribir a mi hija' }));
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(h.sendTextMessage).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('al VENCER la toma el bot vuelve a hablar (modo auto envía)', async () => {
        toma = { tomada_por: 'admin-1', tomada_hasta: HACE_UNA_HORA() };
        baseDeFamilia({ ai_enabled: true, mode: 'auto', assisted_until: null });
        await runBotTurn(INTEGRATION, CONV, '573001112233', '¿cuánto debo?', 'wamid.1', false, null, {} as any);
        expect(h.chatWithTools).toHaveBeenCalledTimes(1);
        expect(h.sendTextMessage).toHaveBeenCalledTimes(1);
    });

    it('soltada (columnas en null) el bot habla', async () => {
        toma = { tomada_por: null, tomada_hasta: null };
        await deliver(INTEGRATION, CONV, '573001112233', 'Hola', { step: 'x' });
        expect(borradores()).toHaveLength(1);
    });
});
