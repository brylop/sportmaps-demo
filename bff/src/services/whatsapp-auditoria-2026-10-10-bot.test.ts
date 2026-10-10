/**
 * Auditoría del bot de WhatsApp, 2026-10-10 — lo que vive en whatsapp-bot.service:
 *
 *  3. «Sí, acepto» del consentimiento desde un número sin cuenta: respuesta
 *     amable, nunca el pedido del correo.
 *  5. La segunda llamada del turno manda las MISMAS herramientas (tool_choice
 *     'none') para que la caché de prompt se reutilice.
 *  7. «Identificación ambigua» + «escalado» salían en dos mensajes a 3 s: uno solo.
 *
 * Mismo andamiaje que whatsapp-bot-memoria-botones.test.ts. Datos inventados.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Ops = [string, any[]][];
    const state: {
        resolve: (table: string, ops: Ops) => any;
        rpc: (fn: string, args: any) => any;
        inserts: { table: string; row: any }[];
        updates: { table: string; row: any }[];
        rpcCalls: { fn: string; args: any }[];
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
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lte', 'or', 'order', 'limit', 'is', 'not']) {
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
            rpc: (fn: string, args: any) => {
                state.rpcCalls.push({ fn, args });
                return Promise.resolve(state.rpc(fn, args));
            },
        },
        debeAtender: vi.fn(),
        botEncendido: vi.fn(),
        chatWithTools: vi.fn(),
        sendTextMessage: vi.fn(),
        sendInteractiveButtons: vi.fn(),
        sendCtaUrl: vi.fn(),
        sendToUser: vi.fn(),
        mediosDePago: vi.fn(),
        avisarEscalamientoPorCorreo: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return {
        // Lo puro (puerta de prospecto, intereses…) va REAL; `ajustesDeAtencion`
        // también: con la fila mockeada vacía, `responder_prospectos` queda prendido.
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
    sendCtaUrl: h.sendCtaUrl,
    aFormatoWhatsApp: (t: string) => t,
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
vi.mock('./whatsapp-medios-de-pago.service', () => ({
    mediosDePago: h.mediosDePago,
    // Con los cobros de la familia (enlace /p/:token de cada uno); acá sin cobros.
    mediosDePagoDeFamilia: async (schoolId: string) => ({ ...(await h.mediosDePago(schoolId)), cobros_pendientes: [] }),
}));
vi.mock('./whatsapp-info-escuela.service', () => ({ infoDeEscuela: vi.fn(), fallbackInfoEscuela: vi.fn() }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', () => ({ avisarEscalamientoPorCorreo: h.avisarEscalamientoPorCorreo }));

import {
    runBotTurn, atenderDesconocido, respuestaConsentimientoSinCuenta, BOTON,
    PASO_CONSENTIMIENTO_SIN_CUENTA, TEXTO_IDENTIFICACION_AMBIGUA,
} from './whatsapp-bot.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-1';
const PADRE = 'parent-1';
const TEL = '573000000001';

const enviados = () => [
    ...h.sendTextMessage.mock.calls.map((c: any[]) => ({ texto: c[2] as string })),
    ...h.sendInteractiveButtons.mock.calls.map((c: any[]) => ({ texto: c[2] as string })),
];
const steps = () => h.state.rpcCalls.filter((c) => c.fn === 'wa_record_outbound_message')
    .map((c) => c.args?.p_payload?.step);

function base(op: { identified: boolean; estadoTelefono?: string; parent?: string | null }) {
    h.state.resolve = (table) => {
        if (table === 'whatsapp_conversations') {
            return { data: { id: CONV, parent_id: op.identified ? PADRE : (op.parent ?? null), identified: op.identified,
                status: 'closed', contact_name: 'Contacto' }, error: null };
        }
        if (table === 'whatsapp_settings') return { data: { ai_enabled: true, mode: 'auto', assisted_until: null }, error: null };
        if (table === 'whatsapp_optins') return { data: { opted_in_at: '2026-09-01T00:00:00Z', opted_out_at: null }, error: null };
        if (table === 'schools') return { data: { name: 'Escuela Ejemplo', owner_id: 'owner-1' }, error: null };
        if (table === 'school_members') return { data: [], error: null };
        if (table === 'whatsapp_messages') return { data: [], count: 0, error: null };
        return { data: null, error: null };
    };
    h.state.rpc = (fn) => {
        if (fn === 'wa_identify_by_phone') {
            return { data: { estado: op.estadoTelefono ?? 'identificado', parent_id: op.identified ? PADRE : null }, error: null };
        }
        if (fn === 'wa_get_payment_status') {
            return { data: [{ concept: 'Mensualidad Octubre', saldo: 170000, due_date: '2026-10-10', debe_pagarse: true }], error: null };
        }
        return { data: null, error: null };
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    h.state.inserts = [];
    h.state.updates = [];
    h.state.rpcCalls = [];
    h.chatWithTools.mockResolvedValue({ text: 'Listo', toolCalls: [], provider: 'test' });
    h.sendTextMessage.mockResolvedValue({ ok: true, waMessageId: 'wamid.out' });
    h.sendInteractiveButtons.mockResolvedValue({ ok: true, waMessageId: 'wamid.btn' });
    h.sendCtaUrl.mockResolvedValue({ ok: true, waMessageId: 'wamid.cta' });
    h.botEncendido.mockResolvedValue(true);
    h.debeAtender.mockResolvedValue({ atender: true, tipo: 'familia', botEncendido: true });
    h.mediosDePago.mockResolvedValue({ cuentas: [], enlace_para_pagar: null });
    h.avisarEscalamientoPorCorreo.mockResolvedValue(undefined);
});

describe('3. botón del consentimiento desde un número sin cuenta', () => {
    it('respuestaConsentimientoSinCuenta (pura)', () => {
        expect(respuestaConsentimientoSinCuenta(BOTON.CONSENTIR_SI, 'Sí, acepto')).toMatch(/Gracias/);
        expect(respuestaConsentimientoSinCuenta(null, 'Sí, acepto')).toMatch(/Gracias/);
        expect(respuestaConsentimientoSinCuenta(BOTON.CONSENTIR_NO, 'No, gracias')).toMatch(/no te enviaré avisos/);
        // «no, gracias» escrito a mano NO es el botón (puede ser cualquier otra cosa).
        expect(respuestaConsentimientoSinCuenta(null, 'No, gracias')).toBeNull();
        expect(respuestaConsentimientoSinCuenta(null, 'hola')).toBeNull();
    });

    it('«Sí, acepto» → UNA respuesta amable con su step, sin pedir el correo', async () => {
        base({ identified: false, estadoTelefono: 'desconocido' });
        const r = await atenderDesconocido(INTEGRATION, CONV, TEL, 'Sí, acepto', BOTON.CONSENTIR_SI);
        expect(r).toBe('consentimiento_sin_cuenta');
        const out = enviados();
        expect(out).toHaveLength(1);
        expect(out[0].texto).toMatch(/no puedo activar los avisos/);
        expect(out[0].texto).not.toMatch(/correo/i);
        expect(steps()).toEqual([PASO_CONSENTIMIENTO_SIN_CUENTA]);
    });

    it('«No, gracias» → acuse corto', async () => {
        base({ identified: false, estadoTelefono: 'desconocido' });
        expect(await atenderDesconocido(INTEGRATION, CONV, TEL, 'No, gracias', BOTON.CONSENTIR_NO))
            .toBe('consentimiento_sin_cuenta');
        expect(enviados()[0].texto).toMatch(/no te enviaré avisos/);
    });
});

describe('7. número en dos cuentas: UN mensaje, no dos', () => {
    it('la explicación y el aviso de escalamiento salen juntos', async () => {
        base({ identified: false, estadoTelefono: 'ambiguo' });
        await runBotTurn(INTEGRATION, CONV, TEL, 'hola, cuánto debo', 'wamid.in1');
        const out = enviados();
        expect(out).toHaveLength(1);
        expect(out[0].texto).toContain(TEXTO_IDENTIFICACION_AMBIGUA);
        expect(out[0].texto).toContain('En breve te contactan.');
        expect(steps()).toEqual(['escalated']);
    });
});

describe('5. caché de prompt: la segunda llamada manda las mismas herramientas', () => {
    it('estado de pagos: 2.ª llamada con tools idénticas y toolChoice none', async () => {
        base({ identified: true });
        h.chatWithTools
            .mockResolvedValueOnce({ toolCalls: [{ name: 'get_payment_status', args: {} }], provider: 'test' })
            .mockResolvedValueOnce({ text: 'Debes $170.000 de octubre.', provider: 'test' });
        await runBotTurn(INTEGRATION, CONV, TEL, '¿y el de mi otra hija?', 'wamid.in2');
        expect(h.chatWithTools).toHaveBeenCalledTimes(2);
        const [primera, segunda] = h.chatWithTools.mock.calls.map((c: any[]) => c[0]);
        expect(primera.tools.length).toBeGreaterThan(0);
        expect(segunda.tools).toEqual(primera.tools);
        expect(segunda.system).toBe(primera.system);
        expect(segunda.toolChoice).toBe('none');
        expect(primera.toolChoice ?? 'auto').toBe('auto');
    });
});
