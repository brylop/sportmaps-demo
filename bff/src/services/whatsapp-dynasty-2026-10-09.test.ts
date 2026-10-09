/**
 * Dynasty 2026-10-09 (caso inventado, equivalente al real): la mamá manda la
 * foto del comprobante + «Buen día». Salieron DOS respuestas en el mismo
 * minuto: el modelo con el estado de cuenta («Recibí tu imagen… ¿Cuál cobro
 * quieres pagar?») y la cola preguntando a cuál cobro aplicarlo.
 *
 * Regla: si la ráfaga trae un archivo que la cola va a procesar (o está
 * procesando), el turno del bot NO habla de pagos ni contesta el saludo. La
 * única respuesta es la de la cola. Lo que no es de pagos sigue su curso.
 *
 * Andamiaje de whatsapp-bot-dynasty-2026-10-06.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Ops = [string, any[]][];
    const state: {
        mensajes: any[];
        pasosEnviados: string[];
        optin: any;
        conv: any;
        candado: string | null;
        pagos: any[];
        cola: any[];
        perfiles: any[];
        inserts: { table: string; row: any }[];
        updates: { table: string; row: any; ops: Ops }[];
        rpcCalls: { fn: string; args: any }[];
    } = {
        mensajes: [], pasosEnviados: [], optin: null, conv: null, candado: null, pagos: [], cola: [], perfiles: [],
        inserts: [], updates: [], rpcCalls: [],
    };
    const pide = (ops: Ops, m: string, pred: (a: any[]) => boolean) => ops.some(([n, a]) => n === m && pred(a));

    function resolve(table: string, ops: Ops): any {
        const stepEq = ops.find(([n, a]) => n === 'eq' && String(a[0]).endsWith('>>step'));
        if (table === 'whatsapp_messages' && stepEq) {
            return { count: state.pasosEnviados.filter((p) => p === stepEq[1][1]).length, error: null };
        }
        if (table === 'whatsapp_message_drafts' && stepEq) return { count: 0, error: null };
        if (table === 'whatsapp_messages') return { data: state.mensajes, error: null };
        if (table === 'whatsapp_conversations') {
            const esCandado = ops.some(([n, a]) => n === 'update' && a[0] && 'bot_turno_hasta' in a[0]);
            if (esCandado) {
                const fila = ops.find(([n]) => n === 'update')![1][0];
                if (fila.bot_turno_hasta === null) { state.candado = null; return { data: null, error: null }; }
                if (state.candado && new Date(state.candado).getTime() > Date.now()) return { data: [], error: null };
                state.candado = fila.bot_turno_hasta;
                return { data: [{ id: 'conv-1' }], error: null };
            }
            return { data: state.conv, error: null };
        }
        if (table === 'whatsapp_optins') return { data: state.optin, error: null };
        if (table === 'whatsapp_settings') return { data: { ai_enabled: true, mode: 'assisted' }, error: null };
        if (table === 'whatsapp_inbound_queue') return { data: state.cola, error: null };
        if (table === 'schools') return { data: { name: 'Dynasty', owner_id: 'owner-1' }, error: null };
        if (table === 'school_members') return { data: [], error: null };
        if (table === 'profiles') {
            return pide(ops, 'in', () => true) ? { data: state.perfiles, error: null } : { data: { full_name: 'Acudiente' }, error: null };
        }
        return { data: null, error: null };
    }

    function makeBuilder(table: string) {
        const ops: Ops = [];
        const b: any = {};
        const chain = (name: string) => (...args: any[]) => { ops.push([name, args]); return b; };
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lt', 'lte', 'or', 'order', 'limit', 'is', 'not']) b[m] = chain(m);
        b.insert = (row: any) => { state.inserts.push({ table, row }); ops.push(['insert', [row]]); return b; };
        b.update = (row: any) => { state.updates.push({ table, row, ops }); ops.push(['update', [row]]); return b; };
        b.maybeSingle = () => Promise.resolve(resolve(table, ops));
        b.single = () => Promise.resolve(resolve(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(resolve(table, ops)).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: {
            from: (t: string) => makeBuilder(t),
            rpc: (fn: string, args: any) => {
                state.rpcCalls.push({ fn, args });
                if (fn === 'wa_identify_by_phone') return Promise.resolve({ data: { estado: 'identificado', parent_id: 'parent-1' }, error: null });
                if (fn === 'wa_get_payment_status') return Promise.resolve({ data: state.pagos, error: null });
                return Promise.resolve({ data: null, error: null });
            },
        },
        debeAtender: vi.fn(),
        botEncendido: vi.fn(),
        chatWithTools: vi.fn(),
        sendTextMessage: vi.fn(),
        sendInteractiveButtons: vi.fn(),
        sendToUser: vi.fn(),
        mediosDePago: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return {
        ...real,
        debeAtender: h.debeAtender,
        botEncendido: h.botEncendido,
        temaEscolar: real.temaEscolar,
        preguntaPrecioComoProspecto: real.preguntaPrecioComoProspecto,
    };
});
vi.mock('./llm.service', () => ({ chatWithTools: h.chatWithTools }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: h.sendTextMessage,
    sendInteractiveButtons: h.sendInteractiveButtons,
    aFormatoWhatsApp: (t: string) => t,
    markAsRead: vi.fn(),
}));
vi.mock('./whatsapp-optin.service', () => ({ estaDadoDeBaja: vi.fn(async () => false), AVISO_DADO_DE_BAJA: '' }));
vi.mock('./whatsapp-horario.service', () => ({
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false })),
    mensajeDeEscalamiento: vi.fn(() => 'Ya le avisé a la escuela.'),
}));
vi.mock('./push.service', () => ({ sendToUser: h.sendToUser }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({ mediosDePago: h.mediosDePago }));
vi.mock('./whatsapp-info-escuela.service', () => ({ infoDeEscuela: vi.fn(), fallbackInfoEscuela: vi.fn() }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', () => ({ avisarEscalamientoPorCorreo: vi.fn(async () => {}) }));

import { runBotTurn, _limpiarCacheVocativos, callarPorComprobanteEnCola } from './whatsapp-bot.service';
import { adjuntoEnLaRafaga, hablaDePagoOEstado } from './whatsapp-reglas-turno';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-1';
const TEL = '573001112233';

const borradores = () => h.state.inserts.filter((i) => i.table === 'whatsapp_message_drafts');
const hace = (s: number) => new Date(Date.now() - s * 1000).toISOString();
const foto = (segundos: number) => ({ wa_message_id: `wamid.img${segundos}`, direction: 'inbound', type: 'image',
    text_body: null, payload: {}, ai_generated: null, wa_timestamp: hace(segundos), created_at: hace(segundos) });
const texto = (t: string, segundos: number, id = `wamid.txt${segundos}`) => ({ wa_message_id: id, direction: 'inbound',
    type: 'text', text_body: t, payload: {}, ai_generated: null, wa_timestamp: hace(segundos), created_at: hace(segundos) });

beforeEach(() => {
    vi.clearAllMocks();
    _limpiarCacheVocativos();
    Object.assign(h.state, {
        mensajes: [], pasosEnviados: [], optin: { opted_in: true }, candado: null, pagos: [], cola: [],
        perfiles: [{ full_name: 'Milena Ríos' }],
        conv: { id: CONV, parent_id: 'parent-1', identified: true, status: 'closed', contact_name: 'A.' },
        inserts: [], updates: [], rpcCalls: [],
    });
    h.botEncendido.mockResolvedValue(true);
    h.debeAtender.mockResolvedValue({ atender: true, tipo: 'familia', botEncendido: true });
    h.chatWithTools.mockResolvedValue({ text: 'Respuesta del modelo', toolCalls: [], provider: 'test' });
    h.sendTextMessage.mockResolvedValue({ ok: true, waMessageId: 'wamid.out' });
    h.sendInteractiveButtons.mockResolvedValue({ ok: true, waMessageId: 'wamid.btn' });
    h.mediosDePago.mockResolvedValue({ cuentas: [], enlace_para_pagar: 'https://x' });
    h.state.pagos = [
        { concept: 'Mensualidad 08/2026', status: 'overdue', debe_pagarse: true, saldo: 200000, vencido: true },
        { concept: 'Mensualidad 09/2026', status: 'overdue', debe_pagarse: true, saldo: 200000, vencido: true },
        { concept: 'Mensualidad 10/2026', status: 'pending', debe_pagarse: true, saldo: 200000 },
    ];
});

describe('foto del comprobante + «Buen día»: una sola respuesta (la de la cola)', () => {
    it('con la foto en la ráfaga, el turno no contesta nada ni llama al modelo', async () => {
        h.state.mensajes = [foto(20), texto('Buen día', 15, 'w1')];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Buen día', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
        expect(h.sendTextMessage).not.toHaveBeenCalled();
    });

    it('la foto todavía no está en los mensajes pero ya está en la cola: también calla', async () => {
        h.state.mensajes = [texto('Buenas tardes', 10, 'w1')];
        h.state.cola = [{ status: 'pending', created_at: hace(5) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Buenas tardes', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('la cola ya contestó la foto: el saludo que venía con ella tampoco recibe estado de cuenta', async () => {
        h.state.mensajes = [
            foto(40),
            { wa_message_id: 'wamid.q', direction: 'outbound', type: 'text', text_body: 'pregunta de la cola',
                payload: { step: 'ask_cual_pago', queue_id: 'q-1' }, ai_generated: true, wa_timestamp: hace(10), created_at: hace(10) },
            texto('Buen día', 5, 'w1'),
        ];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Buen día', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('foto + «¿cuánto debo?»: lo contesta la cola, no el modelo', async () => {
        h.state.mensajes = [foto(20), texto('cuánto debo en total', 15, 'w1')];
        await runBotTurn(INTEGRATION, CONV, TEL, 'cuánto debo en total', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
    });

    it('foto + una pregunta que no es de pagos: esa sí sigue su curso', async () => {
        h.state.mensajes = [foto(20), texto('¿A qué hora es el entreno del sábado?', 15, 'w1')];
        await runBotTurn(INTEGRATION, CONV, TEL, '¿A qué hora es el entreno del sábado?', 'w1');
        expect(h.chatWithTools.mock.calls.length + borradores().length).toBeGreaterThan(0);
    });

    it('sin foto, el saludo se atiende como siempre', async () => {
        h.state.mensajes = [texto('Buen día', 5, 'w1')];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Buen día', 'w1');
        expect(h.chatWithTools.mock.calls.length + borradores().length).toBeGreaterThan(0);
    });
});

describe('reglas puras', () => {
    it('adjuntoEnLaRafaga: solo archivos de la familia después de la última respuesta del bot', () => {
        expect(adjuntoEnLaRafaga([foto(30)])).toBe(true);
        expect(adjuntoEnLaRafaga([{ ...foto(30), type: 'document' }])).toBe(true);
        expect(adjuntoEnLaRafaga([{ ...foto(30), type: 'sticker' }])).toBe(false);
        // Una foto vieja (antes de una respuesta del bot) ya tuvo su respuesta.
        expect(adjuntoEnLaRafaga([foto(60), { direction: 'outbound', payload: { step: 'llm_text' }, created_at: hace(30) }]))
            .toBe(false);
        // …pero la respuesta de la COLA a esa foto no corta la ráfaga.
        expect(adjuntoEnLaRafaga([foto(60),
            { direction: 'outbound', payload: { step: 'ask_cual_pago', queue_id: 'q' }, created_at: hace(30) }])).toBe(true);
        // Más de 5 minutos: ya no es la ráfaga.
        expect(adjuntoEnLaRafaga([foto(6 * 60)])).toBe(false);
    });

    it('callarPorComprobanteEnCola: saludo, nada o tema de pagos sí; otra pregunta no', () => {
        for (const t of ['Buen día', '', 'Hola, buenas tardes', 'Ahí va el pago de octubre', 'cuánto debo?', 'gracias']) {
            expect(callarPorComprobanteEnCola(t), t).toBe(true);
        }
        for (const t of ['¿A qué hora es el entreno del sábado?', 'Buen día\nMañana Sofía no puede ir']) {
            expect(callarPorComprobanteEnCola(t), t).toBe(false);
        }
        expect(hablaDePagoOEstado('me pueden mandar el estado de cuenta')).toBe(true);
    });
});
