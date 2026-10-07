/**
 * Seguimiento del prospecto (Dynasty 2026-10-07, conversación `…edc0e7`):
 *
 *   «Hola quiero averiguar» → el bot saluda con el enlace y pregunta para
 *   quién es la clase de cortesía → «Tengo 23 años y soy mujer he estado en
 *   otros clubs» + «Qué horarios tiene. ?» → el bot NO respondió nada.
 *
 * Causas: (1) con `responder_desconocidos=true` los dos mensajes corrieron como
 * UN turno con el texto del último, y la pregunta de perfil no leía la ráfaga;
 * «Qué horarios tiene. ?» trae «?» y el flujo se soltaba; (2) la puerta del
 * prospecto frenaba todo lo que llegara en los 10 min siguientes a la primera
 * respuesta.
 *
 * Mismo andamiaje que whatsapp-clase-cortesia-bot.test.ts: Supabase con builder
 * encadenable, `debeAtender` mockeado, modo asistido (las respuestas quedan
 * como borradores). Ni base ni Meta.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Ops = [string, any[]][];
    const state: {
        resolve: (table: string, ops: Ops) => any;
        rpc: (fn: string, args: any) => any;
        inserts: { table: string; row: any }[];
    } = { resolve: () => ({ data: null, error: null }), rpc: () => ({ data: null, error: null }), inserts: [] };
    function makeBuilder(table: string) {
        const ops: Ops = [];
        const b: any = {};
        const chain = (name: string) => (...args: any[]) => { ops.push([name, args]); return b; };
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lte', 'or', 'order', 'limit', 'is', 'not', 'neq', 'filter', 'contains']) b[m] = chain(m);
        b.insert = (row: any) => { state.inserts.push({ table, row }); ops.push(['insert', [row]]); return b; };
        b.update = (row: any) => { ops.push(['update', [row]]); return b; };
        b.upsert = (row: any) => { ops.push(['upsert', [row]]); return b; };
        b.maybeSingle = () => { ops.push(['maybeSingle', []]); return Promise.resolve(state.resolve(table, ops)); };
        b.single = () => { ops.push(['maybeSingle', []]); return Promise.resolve(state.resolve(table, ops)); };
        b.then = (res: any, rej: any) => Promise.resolve(state.resolve(table, ops)).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: {
            from: (t: string) => makeBuilder(t),
            rpc: (fn: string, args: any) => Promise.resolve(state.rpc(fn, args)),
        },
        debeAtender: vi.fn(),
        botEncendido: vi.fn(),
        chatWithTools: vi.fn(),
        sendToUser: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return { ...real, debeAtender: h.debeAtender, botEncendido: h.botEncendido };
});
vi.mock('./llm.service', () => ({ chatWithTools: h.chatWithTools }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.txt' })),
    sendInteractiveButtons: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.btn' })),
    aFormatoWhatsApp: (t: string) => t,
    verifyWebhookSignature: vi.fn(),
    resolveIntegration: vi.fn(),
    parseInboundMessages: vi.fn(() => []),
    parseStatuses: vi.fn(() => []),
    markAsRead: vi.fn(),
}));
vi.mock('./whatsapp-optin.service', () => ({ estaDadoDeBaja: vi.fn(async () => false), AVISO_DADO_DE_BAJA: '' }));
vi.mock('./whatsapp-horario.service', () => ({
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false })),
    mensajeDeEscalamiento: vi.fn(() => 'En breve te contactan.'),
}));
vi.mock('./push.service', () => ({ sendToUser: h.sendToUser }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({ mediosDePago: vi.fn() }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', () => ({
    avisarEscalamientoPorCorreo: vi.fn(async () => {}),
    destinatariosDeEscuela: vi.fn(async () => ({ escuela: 'Dynasty', correos: [] })),
    enviarConReserva: vi.fn(async () => 'enviado'),
    etiquetaDeContacto: vi.fn(() => 'Sofía Gutierrez'),
}));
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: vi.fn() }));
vi.mock('./whatsapp-coexistence.service', () => ({
    procesarEchos: vi.fn(), procesarHistorial: vi.fn(), registrarAppState: vi.fn(),
}));
vi.mock('./whatsapp-prospecto-lead.service', () => ({ registrarLeadDeProspecto: vi.fn(async () => {}) }));

import { handleBotTurn } from '../routes/whatsapp';
import { runBotTurn, escribioDespuesDeLaRespuesta } from './whatsapp-bot.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-sofia';
const TEL = '573153601042';
const req = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any;

const hace = (seg: number) => new Date(Date.now() - seg * 1000).toISOString();

// Etiquetas reales de Dynasty (school_trial_slots, 2026-10-07), en 2030 para
// que la prueba no caduque.
const SLOTS = [
    { id: 's-sen', label: 'SENIORS', slot_date: '2030-01-14', start_time: '19:00:00', end_time: '21:00:00', location: 'Coliseo Dynasty', max_capacity: 5, reserved_count: 0, team_id: null },
    { id: 's-mf', label: 'MENORES FEMENINO · White', slot_date: '2030-01-14', start_time: '16:00:00', end_time: '18:00:00', location: 'Coliseo Dynasty', max_capacity: 5, reserved_count: 0, team_id: null },
    { id: 's-im', label: 'INFANTIL MASCULINO', slot_date: '2030-01-15', start_time: '15:00:00', end_time: '17:00:00', location: 'Coliseo Dynasty', max_capacity: 5, reserved_count: 0, team_id: null },
    { id: 's-ne', label: 'NUEVA ERA', slot_date: '2030-01-16', start_time: '18:00:00', end_time: '20:00:00', location: 'Coliseo Dynasty', max_capacity: 5, reserved_count: 0, team_id: null },
];

const SALUDO_CON_PERFIL = {
    step: 'desconocido_tema_escolar', flujo: 'clase_cortesia', paso_cortesia: 'perfil',
    datos_cortesia: { dia: null, intentos: 0 },
};
const SALUDO_SIN_FLUJO = { step: 'desconocido_tema_escolar', intencion: 'inscripcion', con_enlace: true };

type Fila = { wa_message_id: string | null; direction: 'inbound' | 'outbound'; text_body: string;
    payload?: any; ai_generated: boolean; created_at: string; wa_timestamp?: string | null };

/** La conversación real: saludo, respuesta del bot y lo que ella escribió después. */
function conversacion(op: { saliente?: any; despues?: string[]; respuestaHace?: number } = {}): Fila[] {
    const respuesta = op.respuestaHace ?? 40;
    const filas: Fila[] = [
        { wa_message_id: 'wamid.0', direction: 'inbound', text_body: 'Hola quiero averiguar', ai_generated: false, created_at: hace(80_000) },
        { wa_message_id: 'wamid.bot', direction: 'outbound', text_body: 'Hola 👋 Soy el asistente…', payload: op.saliente ?? SALUDO_CON_PERFIL, ai_generated: true, created_at: hace(respuesta) },
    ];
    (op.despues ?? []).forEach((t, i, arr) => filas.push({
        wa_message_id: `wamid.${i + 1}`, direction: 'inbound', text_body: t, ai_generated: false,
        created_at: hace(arr.length - i),
    }));
    return filas;
}

function base(op: { filas: Fila[]; pasos?: string[]; responderDesconocidos?: boolean; slots?: any[] }) {
    const pasos = new Set(op.pasos ?? ['desconocido_tema_escolar']);
    h.state.resolve = (table, ops) => {
        const eqs = ops.filter(([m]) => m === 'eq').map(([, a]) => a);
        const paso = eqs.find((a) => String(a[0]).endsWith('>>step'))?.[1];
        if ((table === 'whatsapp_messages' || table === 'whatsapp_message_drafts') && paso) {
            return { count: pasos.has(paso) ? 1 : 0, error: null };
        }
        if (table === 'whatsapp_messages') {
            const direccion = eqs.find((a) => a[0] === 'direction')?.[1];
            const esUno = ops.some(([m]) => m === 'maybeSingle');
            if (direccion === 'outbound' && esUno) {
                const ultimo = [...op.filas].filter((f) => f.direction === 'outbound')
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                return { data: ultimo ? { payload: ultimo.payload, created_at: ultimo.created_at } : null, error: null };
            }
            if (direccion === 'inbound') {
                return { data: op.filas.filter((f) => f.direction === 'inbound'), error: null };
            }
            if (!direccion) return { data: op.filas, error: null };
            return { data: null, error: null };
        }
        if (table === 'whatsapp_message_drafts') return { data: null, count: 0, error: null };
        if (table === 'whatsapp_conversations') {
            return { data: { id: CONV, parent_id: null, identified: false, status: 'open', contact_name: 'Sofía Gutierrez', tomada_por: null, tomada_hasta: null }, error: null };
        }
        if (table === 'whatsapp_settings') {
            return { data: { ai_enabled: true, mode: 'assisted', responder_desconocidos: op.responderDesconocidos ?? false, responder_prospectos: true }, error: null };
        }
        if (table === 'school_trial_slots') return { data: op.slots ?? SLOTS, error: null };
        if (table === 'school_join_qr_codes') return { data: [{ slug: 'dynasty-inscripcion', target_type: 'open', signup_count: 121 }], error: null };
        if (table === 'schools') return { data: { name: 'DYNASTY VOLLEY CLUB', owner_id: 'owner-1', slug: 'dynasty-volley-club', address: null }, error: null };
        if (table === 'teams' || table === 'school_branches' || table === 'school_members') return { data: [], error: null };
        return { data: null, error: null };
    };
    h.state.rpc = (fn) => {
        if (fn === 'wa_identify_by_phone') return { data: { estado: 'desconocido' }, error: null };
        return { data: null, error: null };
    };
    h.botEncendido.mockResolvedValue(true);
    h.debeAtender.mockResolvedValue({
        atender: op.responderDesconocidos === true, tipo: 'desconocido', botEncendido: true, tomada: false,
    });
}

const borradores = () => h.state.inserts.filter((i) => i.table === 'whatsapp_message_drafts').map((i) => i.row);
const mensaje = (textBody: string, waMessageId: string) => ({
    phoneNumberId: 'pn-1', contactWaId: TEL, contactName: 'Sofía Gutierrez',
    waMessageId, type: 'text', textBody, raw: {}, waTimestamp: null,
}) as any;

beforeEach(() => {
    vi.clearAllMocks();
    h.state.inserts = [];
});

describe('la secuencia real de Dynasty (…edc0e7)', () => {
    it('ráfaga agrupada (responder_desconocidos=true): «23 años, mujer» + «Qué horarios tiene. ?» → horarios de adultos', async () => {
        const despues = ['Tengo 23 años y soy mujer he estado en otros clubs', 'Qué horarios tiene. ?'];
        base({ filas: conversacion({ despues }), responderDesconocidos: true });

        // El turno de la ráfaga corre con el texto del ÚLTIMO mensaje.
        await runBotTurn(INTEGRATION, CONV, TEL, despues[1], 'wamid.2');

        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(1);
        const b = borradores()[0];
        expect(b.tool_context).toMatchObject({ flujo: 'clase_cortesia', paso_cortesia: 'elegir_franja' });
        expect(b.proposed_text).toContain('para adultos');
        expect(b.proposed_text).toContain('SENIORS');
        expect(b.proposed_text).not.toContain('MENORES FEMENINO');
        expect(b.proposed_text).not.toContain('INFANTIL MASCULINO');
    });

    it('mensaje por mensaje (puerta del desconocido): «Tengo 23 años y soy mujer…» responde la pregunta de perfil', async () => {
        const despues = ['Tengo 23 años y soy mujer he estado en otros clubs'];
        base({ filas: conversacion({ despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));

        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].proposed_text).toContain('SENIORS');
        expect(borradores()[0].proposed_text).not.toContain('INFANTIL MASCULINO');
    });

    it('«Qué horarios tiene. ?» en la pregunta de perfil, sin decir para quién → muestra todos (no se calla)', async () => {
        const despues = ['Qué horarios tiene. ?'];
        base({ filas: conversacion({ despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));

        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].proposed_text).toContain('Si me dices *para quién es*');
        expect(borradores()[0].tool_context).toMatchObject({ paso_cortesia: 'elegir_franja' });
    });
});

describe('seguimiento del prospecto sin flujo de cortesía abierto', () => {
    it('pregunta horarios 30 s después de la primera respuesta → franjas filtradas por lo que contó', async () => {
        const despues = ['Tengo 23 años y soy mujer he estado en otros clubs', 'Qué horarios tiene. ?'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[1], 'wamid.2'));

        expect(borradores()).toHaveLength(1);
        const b = borradores()[0];
        expect(b.tool_context).toMatchObject({ step: 'prospecto_seguimiento_horarios', flujo: 'clase_cortesia' });
        expect(b.proposed_text).toContain('SENIORS');
        expect(b.proposed_text).not.toContain('INFANTIL MASCULINO');
        expect(b.proposed_text).toContain('clase de cortesía');
    });

    it('lo que llegó ANTES de la respuesta (ráfaga ya cubierta) no se vuelve a contestar', async () => {
        const filas = conversacion({ saliente: SALUDO_SIN_FLUJO, respuestaHace: 1 });
        filas.push({ wa_message_id: 'wamid.1', direction: 'inbound', text_body: 'Qué horarios tiene?',
            ai_generated: false, created_at: hace(3) });
        base({ filas });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje('Qué horarios tiene?', 'wamid.1'));
        expect(borradores()).toHaveLength(0);
    });

    it('si las franjas acaban de salir, no se repiten', async () => {
        const despues = ['Qué horarios tiene?'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }),
            pasos: ['desconocido_tema_escolar', 'cortesia_ofrecer'] });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));
        expect(borradores()).toHaveLength(0);
    });

    it('pide una persona → se escala', async () => {
        const despues = ['Prefiero hablar con una persona'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));
        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].tool_context).toMatchObject({ step: 'escalated', reason: 'prospecto_seguimiento_persona' });
    });

    it('pregunta dónde queda → enlace de inscripción (sin dirección cargada no se inventa)', async () => {
        const despues = ['Y dónde quedan?'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));
        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].tool_context).toMatchObject({ step: 'prospecto_seguimiento_info' });
        expect(borradores()[0].proposed_text).toContain('/join/dynasty-inscripcion');
        expect(borradores()[0].proposed_text).not.toContain('Estamos en');
    });

    it('«Y que lugar es ?» (…909d08) → también es pregunta de sede', async () => {
        const despues = ['Y que lugar es ?'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));
        expect(borradores()[0]?.tool_context).toMatchObject({ step: 'prospecto_seguimiento_info' });
    });

    it('algo sin pregunta concreta → el acuse corto de siempre', async () => {
        const despues = ['Yo jugué varios años en el colegio'];
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues }) });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje(despues[0], 'wamid.1'));
        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].tool_context).toMatchObject({ step: 'prospecto_seguimiento' });
    });
});

describe('a quién NO se le contesta', () => {
    it('la escuela escribió hace poco (silencio de 15 min)', async () => {
        const filas = conversacion({ saliente: SALUDO_SIN_FLUJO });
        filas.push({ wa_message_id: 'wamid.milena', direction: 'outbound', text_body: 'Hola Sofía, ya te cuento',
            ai_generated: false, created_at: hace(20) });
        filas.push({ wa_message_id: 'wamid.1', direction: 'inbound', text_body: 'Qué horarios tiene?',
            ai_generated: false, created_at: hace(2) });
        base({ filas });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje('Qué horarios tiene?', 'wamid.1'));
        expect(borradores()).toHaveLength(0);
    });

    it('contacto personal o staff: nunca, aunque pregunte horarios', async () => {
        for (const tipo of ['personal', 'staff'] as const) {
            base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues: ['Qué horarios tiene?'] }) });
            h.debeAtender.mockResolvedValue({ atender: false, tipo, botEncendido: true, tomada: false });
            await handleBotTurn(req, INTEGRATION, CONV, mensaje('Qué horarios tiene?', 'wamid.1'));
        }
        expect(borradores()).toHaveLength(0);
    });

    it('conversación tomada desde el buzón: nada', async () => {
        base({ filas: conversacion({ saliente: SALUDO_SIN_FLUJO, despues: ['Qué horarios tiene?'] }) });
        h.debeAtender.mockResolvedValue({ atender: false, tipo: 'desconocido', botEncendido: true, tomada: true });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje('Qué horarios tiene?', 'wamid.1'));
        expect(borradores()).toHaveLength(0);
    });

    it('desconocido sin intención escolar en ningún mensaje: silencio', async () => {
        const filas: Fila[] = [
            { wa_message_id: 'wamid.0', direction: 'inbound', text_body: 'Mañana nos vemos en el asado', ai_generated: false, created_at: hace(60) },
            { wa_message_id: 'wamid.1', direction: 'inbound', text_body: '¿A qué hora llegas?', ai_generated: false, created_at: hace(2) },
        ];
        base({ filas, pasos: [] });
        await handleBotTurn(req, INTEGRATION, CONV, mensaje('¿A qué hora llegas?', 'wamid.1'));
        expect(borradores()).toHaveLength(0);
    });
});

describe('escribioDespuesDeLaRespuesta', () => {
    it('compara el último entrante con la última respuesta automática (no con la de una persona)', () => {
        const bot = { direction: 'outbound', ai_generated: true, created_at: hace(30) } as any;
        const persona = { direction: 'outbound', ai_generated: false, created_at: hace(5) } as any;
        const entrante = { direction: 'inbound', ai_generated: false, created_at: hace(10) } as any;
        expect(escribioDespuesDeLaRespuesta([bot, entrante])).toBe(true);
        expect(escribioDespuesDeLaRespuesta([bot, persona, entrante])).toBe(true);
        expect(escribioDespuesDeLaRespuesta([{ ...bot, created_at: hace(1) }, entrante])).toBe(false);
    });
});
