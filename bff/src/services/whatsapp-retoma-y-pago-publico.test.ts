/**
 * Auditoría del bot de Dynasty 2026-10-07 — los caminos del bot (con mocks):
 *
 *  - …5281: «En que horario se puede ir a cancelar la mensualidad» desde un
 *    número no registrado → los medios de pago SIN pedir el correo; «¿hay
 *    atención presencial mañana?» sin horario configurado → no se inventa y se
 *    escala una vez.
 *  - …4445 / …5281: dos presentaciones del asistente al mismo contacto en
 *    minutos → una sola cada 24 h.
 *  - …1042: la escuela mandó solo una imagen y nadie volvió → a los 30 min el
 *    bot retoma con lo que sabe (la dirección) y dice que lo demás lo confirma
 *    la escuela; re-aviso al equipo.
 *
 * Mismo andamiaje que whatsapp-prospecto-seguimiento.test.ts. Teléfonos de
 * ejemplo. Modo asistido: lo que «sale» queda como borrador.
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
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lte', 'or', 'order', 'limit', 'is', 'not', 'neq', 'filter', 'contains', 'ilike']) b[m] = chain(m);
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
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false, proximaAtencion: null })),
    mensajeDeEscalamiento: vi.fn(() => 'Voy a pasar tu caso con una persona del equipo. En breve te contactan.'),
}));
vi.mock('./push.service', () => ({ sendToUser: h.sendToUser }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({
    mediosDePago: vi.fn(async () => ({
        cuentas: [{ tipo: 'Bre-B Bancolombia', titular: 'Dynasty Volley Club', numero: '@dynastyejemplo' }],
        enlace_para_pagar: 'https://checkout.wompi.co/l/EJEMPLO',
        link_de_pago: 'https://checkout.wompi.co/l/EJEMPLO',
        instrucciones_del_enlace: null,
        puede_enviar_comprobante_por_whatsapp: true,
    })),
}));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', () => ({
    avisarEscalamientoPorCorreo: vi.fn(async () => {}),
    destinatariosDeEscuela: vi.fn(async () => ({ escuela: 'Dynasty', correos: [] })),
    enviarConReserva: vi.fn(async () => 'enviado'),
    etiquetaDeContacto: vi.fn(() => 'Contacto de prueba'),
    uuidDeClave: (k: string) => `uuid:${k}`,
}));
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: vi.fn() }));
vi.mock('./whatsapp-coexistence.service', () => ({
    procesarEchos: vi.fn(), procesarHistorial: vi.fn(), registrarAppState: vi.fn(),
}));
vi.mock('./whatsapp-prospecto-lead.service', () => ({ registrarLeadDeProspecto: vi.fn(async () => {}) }));

import { atenderDesconocido, revisarRetomas } from './whatsapp-bot.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-ejemplo';
const TEL = '573000005281';

type Fila = { wa_message_id: string | null; direction: 'inbound' | 'outbound'; type?: string; text_body: string | null;
    payload?: any; ai_generated: boolean; created_at: string };
const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function base(op: { filas?: Fila[]; yaPresentado?: boolean; pasos?: string[] } = {}) {
    const filas = op.filas ?? [];
    const pasos = new Set(op.pasos ?? []);
    h.state.resolve = (table, ops) => {
        const eqs = ops.filter(([m]) => m === 'eq').map(([, a]) => a);
        const paso = eqs.find((a) => String(a[0]).endsWith('>>step'))?.[1];
        const presentacion = ops.some(([m, a]) => m === 'ilike' && String(a[1]).includes('asistente'));
        const esUpdate = ops.some(([m]) => m === 'update');
        if (table === 'whatsapp_messages' || table === 'whatsapp_message_drafts') {
            if (presentacion) return { count: op.yaPresentado ? 1 : 0, error: null };
            if (paso) return { count: pasos.has(paso) ? 1 : 0, data: [], error: null };
        }
        if (table === 'whatsapp_messages') {
            if (esUpdate) return { data: [{ id: 'm-reservada' }], error: null };
            const direccion = eqs.find((a) => a[0] === 'direction')?.[1];
            if (direccion === 'inbound' && ops.some(([m]) => m === 'order')) {
                // Candidatas de la retoma.
                return { data: [{ conversation_id: CONV, integration_id: 'int-1' }], error: null };
            }
            if (direccion === 'inbound') return { data: filas.filter((f) => f.direction === 'inbound'), error: null };
            if (!direccion) return { data: filas, error: null };
            return { data: null, count: 0, error: null };
        }
        if (table === 'whatsapp_message_drafts') return { data: null, count: 0, error: null };
        if (table === 'whatsapp_conversations') {
            return { data: { id: CONV, contact_wa_id: TEL, parent_id: null, identified: false, status: 'open', contact_name: null, tomada_por: null, tomada_hasta: null }, error: null };
        }
        if (table === 'school_whatsapp_integrations') return { data: INTEGRATION, error: null };
        if (table === 'whatsapp_settings') {
            return { data: { ai_enabled: true, mode: 'assisted', responder_desconocidos: false, responder_prospectos: true }, error: null };
        }
        if (table === 'school_settings') return { data: { business_hours: null }, error: null };
        if (table === 'school_join_qr_codes') return { data: [{ slug: 'dynasty-inscripcion', target_type: 'open', signup_count: 121 }], error: null };
        if (table === 'schools') return { data: { name: 'DYNASTY VOLLEY CLUB', owner_id: 'owner-1', slug: 'dynasty', address: 'Cl. 12 Bis #71g-09, Bogotá' }, error: null };
        if (table === 'school_trial_slots' || table === 'teams' || table === 'school_branches' || table === 'school_members') return { data: [], error: null };
        return { data: null, error: null };
    };
    h.state.rpc = () => ({ data: null, error: null });
    h.botEncendido.mockResolvedValue(true);
    h.debeAtender.mockResolvedValue({ atender: false, tipo: 'desconocido', botEncendido: true, tomada: false });
}

const borradores = () => h.state.inserts.filter((i) => i.table === 'whatsapp_message_drafts').map((i) => i.row);
const avisos = () => h.state.inserts.filter((i) => i.table === 'notifications').map((i) => i.row);

beforeEach(() => {
    vi.clearAllMocks();
    h.state.inserts = [];
});

describe('…5281: cómo pagar es público', () => {
    it('«En que horario se puede ir a cancelar la mensualidad» → cuentas y link, sin pedir el correo', async () => {
        base();
        const r = await atenderDesconocido(INTEGRATION, CONV, TEL, 'En que horario se puede ir a cancelar la mensualidad');
        expect(r).toBe('medios_de_pago_escalado');
        const [medios] = borradores();
        expect(medios.tool_context).toMatchObject({ step: 'medios_de_pago_publicos', pagar: true, presencial: true });
        expect(medios.proposed_text).toContain('@dynastyejemplo');
        expect(medios.proposed_text).toContain('https://checkout.wompi.co/l/EJEMPLO');
        expect(medios.proposed_text).not.toMatch(/correo|No reconozco/i);
        expect(medios.proposed_text.length).toBeLessThanOrEqual(600);
        // Sin horario presencial configurado: no se inventa; se escala una vez.
        expect(medios.proposed_text).not.toMatch(/Atención presencial:/);
        expect(borradores().some((b) => b.tool_context?.step === 'escalated')).toBe(true);
    });

    it('«¿Cómo cancelo el mes de octubre?» → medios de pago, sin escalar', async () => {
        base();
        const r = await atenderDesconocido(INTEGRATION, CONV, TEL, '¿Cómo cancelo el mes de octubre?');
        expect(r).toBe('medios_de_pago');
        expect(borradores()).toHaveLength(1);
        expect(borradores()[0].proposed_text).toContain('Puedes pagar así');
    });

    it('ya se le dieron en las últimas 6 h → no se repite', async () => {
        base({ pasos: ['medios_de_pago_publicos'] });
        const r = await atenderDesconocido(INTEGRATION, CONV, TEL, 'Hay atención presencial en el club mañana ?');
        expect(r).toBe('frenado');
        expect(borradores()).toHaveLength(0);
    });

    it('«cuánto debo» SÍ pide identificarse, explicando por qué en una línea', async () => {
        base();
        await atenderDesconocido(INTEGRATION, CONV, TEL, 'Cuánto debo de la mensualidad de mi hija');
        const [b] = borradores();
        expect(b.tool_context).toMatchObject({ step: 'desconocido_tema_escolar', intencion: 'pagos' });
        expect(b.proposed_text).toContain('datos privados');
        expect(b.proposed_text).toContain('la escuela te ubica');
    });
});

describe('…4445 / …5281: UNA presentación cada 24 h', () => {
    it('si ya se presentó (p. ej. con el «ask_email»), la plantilla del prospecto no saluda otra vez', async () => {
        base({ yaPresentado: true });
        await atenderDesconocido(INTEGRATION, CONV, TEL, 'Quiero inscribir a mi hija en voleibol');
        const [b] = borradores();
        expect(b.tool_context).toMatchObject({ step: 'desconocido_tema_escolar' });
        expect(b.proposed_text).not.toContain('asistente automático');
        expect(b.proposed_text.startsWith('Hola')).toBe(false);
    });

    it('primera vez: se presenta', async () => {
        base({ yaPresentado: false });
        await atenderDesconocido(INTEGRATION, CONV, TEL, 'Quiero inscribir a mi hija en voleibol');
        expect(borradores()[0].proposed_text).toContain('Soy el *asistente automático*');
    });
});

describe('…1042: la escuela mandó solo una imagen y nadie volvió', () => {
    const filas: Fila[] = [
        { wa_message_id: 'bot-1', direction: 'outbound', type: 'text', text_body: 'Hola 👋 Soy el asistente…', payload: { step: 'desconocido_tema_escolar' }, ai_generated: true, created_at: hace(80) },
        { wa_message_id: 'esc-1', direction: 'outbound', type: 'image', text_body: null, ai_generated: false, created_at: hace(45) },
        { wa_message_id: 'in-1', direction: 'inbound', type: 'text', text_body: 'Cuánto es la mensualidad y qué dirección es', ai_generated: false, created_at: hace(35) },
    ];

    it('a los 30 min: contesta la dirección, dice que lo demás lo confirma la escuela y re-avisa', async () => {
        base({ filas });
        const r = await revisarRetomas(Date.now());
        expect(r.respondidas).toBe(1);
        const [b] = borradores();
        expect(b.tool_context).toMatchObject({ step: 'retoma_respuesta' });
        expect(b.proposed_text).toContain('Cl. 12 Bis #71g-09');
        expect(b.proposed_text).toContain('Lo demás te lo confirma la escuela');
        expect(avisos().length).toBeGreaterThan(0);
        expect(avisos()[0]).toMatchObject({ data: expect.objectContaining({ etapa: 'reaviso' }) });
    });

    it('la conversación tomada por una persona → nada', async () => {
        base({ filas });
        h.debeAtender.mockResolvedValue({ atender: false, tipo: 'desconocido', botEncendido: true, tomada: true });
        await revisarRetomas(Date.now());
        expect(borradores()).toHaveLength(0);
        expect(avisos()).toHaveLength(0);
    });

    it('solo «Hola» pendiente tras «ya pasé tu mensaje» (…4445) → algo honesto UNA vez', async () => {
        base({ filas: [
            { wa_message_id: 'bot-1', direction: 'outbound', type: 'text', text_body: '¡Gracias! 🙌 Ya pasé tu mensaje a la escuela…', payload: { step: 'prospecto_seguimiento' }, ai_generated: true, created_at: hace(40) },
            { wa_message_id: 'in-1', direction: 'inbound', type: 'text', text_body: 'Hola', ai_generated: false, created_at: hace(35) },
        ] });
        await revisarRetomas(Date.now());
        const [b] = borradores();
        expect(b.tool_context).toMatchObject({ step: 'retoma_sin_respuesta' });
        expect(b.proposed_text).toContain('Todavía nadie de la escuela ha podido contestarte');
    });

    it('…y si ya lo dijo en 24 h, no lo repite', async () => {
        base({ pasos: ['retoma_sin_respuesta'], filas: [
            { wa_message_id: 'bot-1', direction: 'outbound', type: 'text', text_body: 'Ya pasé tu mensaje…', payload: { step: 'prospecto_seguimiento' }, ai_generated: true, created_at: hace(40) },
            { wa_message_id: 'in-1', direction: 'inbound', type: 'text', text_body: 'Hola', ai_generated: false, created_at: hace(35) },
        ] });
        await revisarRetomas(Date.now());
        expect(borradores()).toHaveLength(0);
    });
});
