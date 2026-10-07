/**
 * Los casos reales de Dynasty del 2026-10-06 (anonimizados), de punta a punta
 * por el bot: docs/analisis/whatsapp-conversaciones-dynasty-2026-10-06.md.
 *
 *  - texto precargado de /p/:token + foto (`355bebed`, `e9e185ce`)
 *  - ráfaga de 4 mensajes en 2 s (`e9ed4b64`)
 *  - mensaje a «Mile» y «¿Milena estás por acá?» (`abe50cda`)
 *  - «ya pagué» (`5af7d51f`)
 *  - STOP 15 s después del sí (`ac209e73`)
 *  - la escuela escribiendo en el chat (`8f9e500b`)
 *  - el modelo caído (`2ddd46fd`)
 *
 * Mismo andamiaje que whatsapp-bot-memoria-botones.test.ts: Supabase con un
 * builder encadenable; el modelo y Meta mockeados.
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

import { runBotTurn, acusarAdjunto, BOTON, BOTONES_CONFIRMAR_BAJA, _limpiarCacheVocativos } from './whatsapp-bot.service';
import { correrTurnoAgrupado } from './whatsapp-turno-agrupado.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-1';
const TEL = '573001112233';
const PRECARGADO = 'Hola, envío el comprobante de pago de Mensualidad 10/2026 - LAURA P (octubre 2026) de Laura. (ref. 3FA2B91C)';

const borradores = () => h.state.inserts.filter((i) => i.table === 'whatsapp_message_drafts');
const pasos = () => borradores().map((b) => b.row.tool_context.step);
const rpcs = (fn: string) => h.state.rpcCalls.filter((c) => c.fn === fn);
const hace = (s: number) => new Date(Date.now() - s * 1000).toISOString();

beforeEach(() => {
    vi.clearAllMocks();
    _limpiarCacheVocativos();
    Object.assign(h.state, {
        mensajes: [], pasosEnviados: [], optin: null, candado: null, pagos: [], cola: [],
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
});

describe('`355bebed` / `e9e185ce`: texto precargado de /p/:token + foto', () => {
    it('el texto precargado recibe «mándame la foto», sin modelo y SIN consentimiento', async () => {
        await runBotTurn(INTEGRATION, CONV, TEL, PRECARGADO, 'wamid.texto');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(pasos()).toEqual(['comprobante_anunciado']);
        const { proposed_text, tool_context } = borradores()[0].row;
        expect(proposed_text).toContain('Mándame la *foto* o el *PDF* del comprobante de *Mensualidad 10/2026 - LAURA P (octubre 2026)*');
        expect(tool_context.cobro_anunciado).toMatchObject({ ref: '3fa2b91c', concepto: 'Mensualidad 10/2026 - LAURA P' });
    });

    it('la foto 11 s después: UN acuse que nombra el cobro anunciado', async () => {
        h.state.mensajes = [
            { wa_message_id: 'wamid.texto', direction: 'inbound', type: 'text', text_body: PRECARGADO, created_at: hace(11) },
            { wa_message_id: 'wamid.foto', direction: 'inbound', type: 'image', text_body: null, created_at: hace(0) },
        ];
        const r = await acusarAdjunto(INTEGRATION, CONV, TEL, 'wamid.foto', null);
        expect(r).toBe('acusado');
        expect(borradores()[0].row.proposed_text)
            .toBe('Recibí el comprobante de *Mensualidad 10/2026 - LAURA P (octubre 2026)* 📄 Lo reviso y te cuento por aquí.');
        expect(borradores()[0].row.tool_context).toMatchObject({ step: 'acuse_adjunto', como_comprobante: true });
    });

    it('ráfaga de fotos: solo la última acusa, y nunca dos acuses en 2 min', async () => {
        h.state.mensajes = [
            { wa_message_id: 'f1', direction: 'inbound', type: 'image', created_at: hace(3) },
            { wa_message_id: 'f2', direction: 'inbound', type: 'image', created_at: hace(2) },
        ];
        expect(await acusarAdjunto(INTEGRATION, CONV, TEL, 'f1', null)).toBe('rafaga');
        h.state.mensajes.push({ direction: 'outbound', ai_generated: true, payload: { step: 'acuse_adjunto' }, created_at: hace(1) });
        // El bot ya dijo algo DESPUÉS de la foto: el acuse (diferido) sobra.
        expect(await acusarAdjunto(INTEGRATION, CONV, TEL, 'f2', null)).toBe('ya_respondido');
        expect(borradores()).toHaveLength(0);
    });

    it('captura de pantalla sin pista de pago: «Recibí tu archivo», no «comprobante»', async () => {
        h.state.mensajes = [{ wa_message_id: 'f1', direction: 'inbound', type: 'image', created_at: hace(1) }];
        await acusarAdjunto(INTEGRATION, CONV, TEL, 'f1', 'Ahí, con eso el bot ya no les responde');
        expect(borradores()[0].row.proposed_text).toBe('Recibí tu archivo 📄 Lo reviso y te cuento por aquí.');
    });
});

describe('una respuesta por comprobante (2026-10-07)', () => {
    it('…9ed973: el texto precargado DESPUÉS de la foto no manda un segundo acuse (responde la cola)', async () => {
        h.state.mensajes = [
            { wa_message_id: 'wamid.foto', direction: 'inbound', type: 'image', text_body: null, created_at: hace(7) },
        ];
        await runBotTurn(INTEGRATION, CONV, TEL, PRECARGADO, 'wamid.texto');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
        expect(h.sendTextMessage).not.toHaveBeenCalled();
    });

    it('…b62e3f 21:08: «ya pagué» con un comprobante EN la cola (< 3 min): calla, el resultado lo dice', async () => {
        h.state.pagos = [{ concept: 'Mensualidad 09/2026', status: 'pending', debe_pagarse: true, saldo: 90000 }];
        h.state.cola = [{ status: 'processing', result_type: null, created_at: hace(6) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'La de septiembre aparece q debo pero ya pagué', 'w1');
        expect(borradores()).toHaveLength(0);
        expect(h.sendTextMessage).not.toHaveBeenCalled();
    });
});

describe('`e9ed4b64`: ráfaga de 4 mensajes en 2 s', () => {
    it('un solo turno, el del último mensaje; sin respuestas fuera de orden ni duplicadas', async () => {
        const ids = ['m1', 'm2', 'm3', 'm4'];
        const textos = ['Hola Milena', 'Buen día', 'Cómo vas?', '¿cuánto debo?'];
        h.state.mensajes = ids.map((id, i) => ({
            wa_message_id: id, direction: 'inbound', type: 'text', text_body: textos[i],
            created_at: new Date(Date.now() - (2000 - i * 500)).toISOString(),
        }));
        const corridos: string[] = [];
        const resultados = await Promise.all(ids.map((id, i) => correrTurnoAgrupado({
            conversationId: CONV, waMessageId: id, esperaMs: 10_000,
            correr: async () => { corridos.push(id); await runBotTurn(INTEGRATION, CONV, TEL, textos[i], id); },
        }, { esperar: async () => {} })));
        expect(resultados).toEqual(['absorbido', 'absorbido', 'absorbido', 'corrido']);
        expect(corridos).toEqual(['m4']);
        expect(h.chatWithTools).toHaveBeenCalledTimes(1);
        // El modelo recibe la ráfaga completa como un solo turno del usuario.
        const { messages } = h.chatWithTools.mock.calls[0][0];
        expect(messages[messages.length - 1].content).toContain('Hola Milena');
        expect(messages[messages.length - 1].content).toContain('¿cuánto debo?');
        expect(h.state.candado).toBeNull();
    });

    it('candado: un segundo turno espera a que el primero termine (nunca dos a la vez)', async () => {
        h.state.mensajes = [{ wa_message_id: 'x', direction: 'inbound', type: 'text', created_at: hace(1) }];
        let enCurso = 0;
        let maximo = 0;
        const correr = async () => {
            enCurso++; maximo = Math.max(maximo, enCurso);
            await new Promise((r) => setTimeout(r, 30));
            enCurso--;
        };
        const deps = { esperar: (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(ms, 10))) };
        const r = await Promise.all([
            correrTurnoAgrupado({ conversationId: CONV, waMessageId: 'x', inmediato: true, correr }, deps),
            correrTurnoAgrupado({ conversationId: CONV, waMessageId: 'x', inmediato: true, correr }, deps),
        ]);
        expect(r).toEqual(['corrido', 'corrido']);
        expect(maximo).toBe(1);
    });
});

describe('`abe50cda`: mensajes para Milena', () => {
    it('«Milena estás por acá?» → escala directo, sin modelo', async () => {
        await runBotTurn(INTEGRATION, CONV, TEL, 'Milena estás por acá?', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(pasos()).toEqual(['escalated']);
        expect(borradores()[0].row.tool_context.reason).toBe('pidio_una_persona');
        expect(h.sendToUser).toHaveBeenCalledTimes(1);
    });

    it('«Mile, puedes ir a…» → «Le dejo tu mensaje a Milena 🙌», nunca «solo puedo ayudar con…»', async () => {
        await runBotTurn(INTEGRATION, CONV, TEL,
            'Mile, puedes ir a comunicación WhatsApp Conversaciones y marcar como personal', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()[0].row.proposed_text).toContain('Le dejo tu mensaje a Milena 🙌');
        expect(borradores()[0].row.proposed_text).not.toMatch(/solo puedo/i);
        expect(h.state.updates.some((u) => u.table === 'whatsapp_conversations' && u.row.status === 'open')).toBe(true);
    });

    it('una sola vez cada 24 h: el segundo mensaje para Mile solo va al buzón', async () => {
        h.state.pasosEnviados = ['mensaje_para_persona'];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Mile otra cosita', 'w2');
        expect(borradores()).toHaveLength(0);
        expect(h.chatWithTools).not.toHaveBeenCalled();
    });
});

describe('`5af7d51f`: «ya pagué»', () => {
    it('primero el comprobante y su estado; sin modelo y sin prometer revisar', async () => {
        h.state.pagos = [
            { concept: 'Mensualidad Octubre', status: 'awaiting_approval', debe_pagarse: false, saldo: 180000 },
        ];
        h.state.cola = [{ status: 'pending', result_type: null, created_at: hace(300) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Aún no aparece el pago en la plataforma', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(pasos()).toEqual(['estado_comprobantes']);
        const texto = borradores()[0].row.proposed_text;
        expect(texto).toContain('pendiente de revisión');
        expect(texto).toContain('*Mensualidad Octubre*: comprobante recibido');
        expect(texto).not.toMatch(/voy a revisar|vencid/i);
    });

    it('sin ningún comprobante: lo dice, pide el archivo y abre el caso en el buzón', async () => {
        h.state.pagos = [{ concept: 'Mensualidad Octubre', status: 'overdue', debe_pagarse: true, saldo: 180000, vencido: true }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Pague el Jueves ☹️', 'w1');
        expect(borradores()[0].row.proposed_text).toContain('No encuentro ningún comprobante');
        expect(h.sendToUser).toHaveBeenCalledTimes(1);
    });
});

describe('`ac209e73`: consentimiento y STOP 15 s después del sí', () => {
    it('«Sí» con la pregunta abierta → opt-in, y la confirmación NO dice «escribe STOP»', async () => {
        h.state.mensajes = [{ direction: 'outbound', ai_generated: true, payload: { step: 'ask_consent' }, created_at: hace(20) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Sí', 'wamid.si');
        expect(rpcs('wa_register_optin')[0].args).toMatchObject({ p_source_ref: 'wamid.si', p_opt_out: false });
        expect(borradores()[0].row.proposed_text).not.toContain('STOP');
        expect(borradores()[0].row.proposed_text).toContain('BAJA');
    });

    it('«Sí» cuando lo último que dijo el bot fue OTRA cosa → no es consentimiento', async () => {
        h.state.mensajes = [
            { direction: 'outbound', ai_generated: true, payload: { step: 'ask_consent' }, created_at: hace(120) },
            { direction: 'outbound', ai_generated: true, payload: { step: 'llm_text' }, created_at: hace(60) },
        ];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Sí', 'w1');
        expect(rpcs('wa_register_optin')).toHaveLength(0);
    });

    it('STOP 15 s después del sí → se repregunta con botones', async () => {
        h.state.mensajes = [{ direction: 'outbound', ai_generated: true, payload: { step: 'opt_in_registrado' }, created_at: hace(15) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'Stop', 'w1', true);
        expect(pasos()).toEqual(['confirmar_baja']);
        expect(borradores()[0].row.tool_context.botones).toEqual(BOTONES_CONFIRMAR_BAJA);
    });

    it('…y «No, mantenerlos» vuelve a activar los avisos', async () => {
        h.state.optin = { opted_in_at: hace(30), opted_out_at: hace(15) };
        h.state.mensajes = [{ direction: 'outbound', ai_generated: true, payload: { step: 'confirmar_baja' }, created_at: hace(5) }];
        await runBotTurn(INTEGRATION, CONV, TEL, 'No, mantenerlos', 'wamid.no', false, BOTON.BAJA_NO);
        expect(rpcs('wa_register_optin')[0].args).toMatchObject({ p_opt_out: false, p_source_ref: 'wamid.no' });
        expect(pasos()).toEqual(['baja_mantenida']);
    });

    it('STOP sin un sí reciente → confirmación normal', async () => {
        await runBotTurn(INTEGRATION, CONV, TEL, 'Stop', 'w1', true);
        expect(pasos()).toEqual(['opt_out_confirmado']);
    });
});

describe('`8f9e500b`: la escuela está escribiendo', () => {
    it('un echo de Milena hace 2 min → el bot se calla (ni modelo ni borrador)', async () => {
        h.state.mensajes = [{ direction: 'outbound', ai_generated: false, text_body: 'El torneo ya queda al día', wa_timestamp: hace(120) }];
        await runBotTurn(INTEGRATION, CONV, TEL, '¿cuánto debo?', 'w1');
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(borradores()).toHaveLength(0);
        expect(h.sendToUser).not.toHaveBeenCalled();
    });

    it('…y tampoco acusa adjuntos', async () => {
        h.state.mensajes = [
            { direction: 'outbound', ai_generated: false, text_body: 'Ok recibido', wa_timestamp: hace(60) },
            { wa_message_id: 'f1', direction: 'inbound', type: 'image', created_at: hace(1) },
        ];
        expect(await acusarAdjunto(INTEGRATION, CONV, TEL, 'f1', null)).toBe('humano');
    });
});

describe('`2ddd46fd`: el modelo no responde', () => {
    it('«¿cuánto debo?» con los dos proveedores caídos → estado de pagos determinista, NO escalación', async () => {
        h.chatWithTools.mockRejectedValue(new Error('todos los proveedores LLM fallaron'));
        h.state.pagos = [{ concept: 'Mensualidad Octubre', saldo: 180000, due_date: '2026-10-10', debe_pagarse: true }];
        await runBotTurn(INTEGRATION, CONV, TEL, '¿cuánto debo?', 'w1');
        expect(pasos()[0]).toBe('payment_fallback');
        expect(pasos()).not.toContain('escalated');
        expect(h.sendToUser).not.toHaveBeenCalled();
    });

    it('algo sin palabra clave → menú con botones, sin «voy a pasar tu caso»', async () => {
        h.chatWithTools.mockRejectedValue(new Error('caído'));
        await runBotTurn(INTEGRATION, CONV, TEL, 'Cuál caso', 'w1');
        expect(pasos()).toEqual(['llm_error_menu']);
        expect(borradores()[0].row.proposed_text).not.toMatch(/tu caso/i);
    });
});

describe('cierres y otros bots', () => {
    it.each(['Gracias', 'Ok', '👍'])('«%s» suelto → silencio', async (t) => {
        await runBotTurn(INTEGRATION, CONV, TEL, t, 'w1');
        expect(borradores()).toHaveLength(0);
        expect(h.chatWithTools).not.toHaveBeenCalled();
    });

    it('auto-respuesta de otro negocio → silencio', async () => {
        await runBotTurn(INTEGRATION, CONV, TEL,
            '¡Hola! 👋 Gracias por escribir a Play Kids. En este momento estamos fuera de horario.', 'w1');
        expect(borradores()).toHaveLength(0);
    });
});
