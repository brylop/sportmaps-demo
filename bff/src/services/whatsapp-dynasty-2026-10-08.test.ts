/**
 * Bugs de Dynasty del 2026-10-08 (`responder_desconocidos=true`). Ejemplos
 * inventados, equivalentes a los reales:
 *
 *  1. Escalación duplicada en una ráfaga: una sola escalación abierta por
 *     conversación, un solo re-aviso, y el retiro escala como «retiro».
 *  2. (audio de desconocido: ver whatsapp-notas-de-voz.test.ts)
 *  3. «Cualquier inquietud quedo pendiente» y otros cierres no reciben ask_email.
 *  4. Entrenador(a) de otro club / empresa / proveedor: ni plantilla de
 *     prospecto ni pedido de correo; al buzón.
 *  5. «¿Cambiaron el horario de hoy?»: el horario del día.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
    type Ops = [string, any[]][];
    const state = {
        filas: [] as any[],
        conv: { id: 'conv-1', parent_id: null, identified: false, status: 'closed', contact_name: 'Contacto' } as any,
        equipos: [] as any[],
        updates: [] as { table: string; row: any; ops: Ops }[],
        inserts: [] as { table: string; row: any }[],
    };
    const tieneOp = (ops: Ops, n: string) => ops.some(([m]) => m === n);
    const eqDe = (ops: Ops, col: string) => ops.find(([m, a]) => m === 'eq' && a[0] === col)?.[1][1];
    function resolver(table: string, ops: Ops): any {
        const head = ops.some(([m, a]) => m === 'select' && a[1]?.head);
        if (table === 'whatsapp_messages') {
            if (tieneOp(ops, 'update')) return { data: null, error: null };
            const step = eqDe(ops, 'payload->>step');
            const dir = eqDe(ops, 'direction');
            let filas = state.filas.slice();
            if (dir) filas = filas.filter((f) => f.direction === dir);
            if (step) filas = filas.filter((f) => f.payload?.step === step);
            if (head) return { count: filas.length, error: null };
            return { data: filas.map((f) => ({ ...f })), error: null };
        }
        if (table === 'whatsapp_message_drafts') return head ? { count: 0, error: null } : { data: null, error: null };
        if (table === 'whatsapp_settings') return { data: { ai_enabled: true, mode: 'auto' }, error: null };
        if (table === 'whatsapp_optins') return { data: null, error: null };
        if (table === 'whatsapp_conversations') {
            if (tieneOp(ops, 'update')) {
                const row = ops.find(([m]) => m === 'update')![1][0];
                if ('bot_turno_hasta' in row) return { data: [{ id: 'conv-1' }], error: null };
                return { data: null, error: null };
            }
            return { data: { ...state.conv }, error: null };
        }
        if (table === 'teams') return { data: state.equipos, error: null };
        if (table === 'schools') return { data: { name: 'Club Demo', owner_id: 'owner-1' }, error: null };
        if (table === 'school_members') return { data: [], error: null };
        if (table === 'profiles') return { data: [{ id: 'owner-1', full_name: 'Marcela Gómez' }], error: null };
        return { data: null, error: null };
    }
    function makeBuilder(table: string) {
        const ops: Ops = [];
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lt', 'lte', 'or', 'order', 'limit', 'is', 'not']) {
            b[m] = (...args: any[]) => { ops.push([m, args]); return b; };
        }
        b.insert = (row: any) => { state.inserts.push({ table, row }); ops.push(['insert', [row]]); return b; };
        b.update = (row: any) => { state.updates.push({ table, row, ops }); ops.push(['update', [row]]); return b; };
        b.upsert = b.insert;
        b.maybeSingle = () => Promise.resolve(resolver(table, ops));
        b.single = b.maybeSingle;
        b.then = (res: any, rej: any) => Promise.resolve(resolver(table, ops)).then(res, rej);
        return b;
    }
    return {
        state,
        supabase: {
            from: (t: string) => makeBuilder(t),
            rpc: vi.fn(async (fn: string) => (fn === 'wa_identify_by_phone'
                ? { data: { estado: state.conv.parent_id ? 'identificado' : 'no_encontrado', parent_id: state.conv.parent_id }, error: null }
                : { data: null, error: null })),
        },
        debeAtender: vi.fn(),
        chatWithTools: vi.fn(),
        sendTextMessage: vi.fn(),
        sendInteractiveButtons: vi.fn(),
    };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./whatsapp-atencion.service', async () => {
    const real = await vi.importActual<typeof import('./whatsapp-atencion.service')>('./whatsapp-atencion.service');
    return { ...real, debeAtender: h.debeAtender, botEncendido: vi.fn(async () => true) };
});
vi.mock('./llm.service', () => ({ chatWithTools: h.chatWithTools }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: h.sendTextMessage,
    sendInteractiveButtons: h.sendInteractiveButtons,
    aFormatoWhatsApp: (t: string) => t,
    verifyWebhookSignature: vi.fn(),
    resolveIntegration: vi.fn(),
    parseInboundMessages: vi.fn(() => []),
    parseStatuses: vi.fn(() => []),
    markAsRead: vi.fn(),
    downloadMedia: vi.fn(),
    AUDIO_MIME_PERMITIDOS: new Set(['audio/ogg']),
    AUDIO_MAX_BYTES: 16 * 1024 * 1024,
}));
vi.mock('./whatsapp-optin.service', () => ({ estaDadoDeBaja: vi.fn(async () => false), AVISO_DADO_DE_BAJA: '' }));
vi.mock('./whatsapp-horario.service', () => ({
    estadoDeHorario: vi.fn(async () => ({ fueraDeHorario: false })),
    mensajeDeEscalamiento: vi.fn(() => 'Voy a pasar tu caso con una persona del equipo.'),
}));
vi.mock('./push.service', () => ({ sendToUser: vi.fn(async () => undefined) }));
vi.mock('./whatsapp-medios-de-pago.service', () => ({ mediosDePago: vi.fn(async () => null) }));
vi.mock('./whatsapp-respuesta-de-cobro.service', () => ({ resolverRespuestaDeCobro: vi.fn(async () => false) }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));
vi.mock('./avisos-correo.service', async () => {
    const real = await vi.importActual<typeof import('./avisos-correo.service')>('./avisos-correo.service');
    return { ...real, avisarEscalamientoPorCorreo: vi.fn(async () => {}) };
});
vi.mock('./whatsapp-queue.service', () => ({ encolarAdjunto: vi.fn() }));
vi.mock('./whatsapp-coexistence.service', () => ({
    procesarEchos: vi.fn(), procesarHistorial: vi.fn(), registrarAppState: vi.fn(),
}));

import { handleBotTurn } from '../routes/whatsapp';
import { _olvidarPresentaciones, _olvidarReservasDePaso, _limpiarCacheVocativos } from './whatsapp-bot.service';
import {
    esSolicitudDeRetiro, estadoDeEscalacion, decidirEscalacion, unaPorConversacion, textoDelAvisoAlEquipo,
    MENSAJE_ESCALACION_RETIRO,
} from './whatsapp-escalaciones.service';
import {
    esCierreDeCortesia, pideAlgo, seIdentificaComoExterno, preguntaHorarioDeHoy, mencionaCambioOCierre,
} from './whatsapp-desconocido-reglas';
import { franjasDelDia, textoHorarioDeHoy, hoyEnBogota } from './whatsapp-info-escuela.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const CONV = 'conv-1';
const req = { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any;
const hace = (s: number) => new Date(Date.now() - s * 1000).toISOString();

let n = 0;
function entrante(texto: string, segundosAtras = 1) {
    const id = `wamid.in${++n}`;
    const t = hace(segundosAtras);
    h.state.filas.push({ wa_message_id: id, direction: 'inbound', type: 'text', text_body: texto,
        payload: {}, ai_generated: null, wa_timestamp: t, created_at: t });
    return {
        phoneNumberId: 'pn-1', contactWaId: '573009998877', contactName: 'Contacto',
        waMessageId: id, type: 'text', textBody: texto, raw: { id }, waTimestamp: t,
    } as any;
}
function saliente(step: string, segundosAtras: number, extra: Record<string, any> = {}, ai = true) {
    const t = hace(segundosAtras);
    h.state.filas.push({ wa_message_id: `wamid.out${++n}`, direction: 'outbound', type: 'text', text_body: 'x',
        payload: { step, ...extra }, ai_generated: ai, wa_timestamp: t, created_at: t });
}
const enviados = () => [
    ...h.sendTextMessage.mock.calls.map((c) => String(c[2])),
    ...h.sendInteractiveButtons.mock.calls.map((c) => String(c[2])),
];
const pasosGuardados = () => h.supabase.rpc.mock.calls
    .filter((c: any[]) => c[0] === 'wa_record_outbound_message')
    .map((c: any[]) => c[1]?.p_payload?.step);
const notificaciones = () => h.state.inserts.filter((i) => i.table === 'notifications').map((i) => i.row);

beforeEach(() => {
    vi.clearAllMocks();
    _olvidarPresentaciones();
    _olvidarReservasDePaso();
    _limpiarCacheVocativos?.();
    h.state.filas = [];
    h.state.inserts = [];
    h.state.updates = [];
    h.state.equipos = [];
    h.state.conv = { id: CONV, parent_id: null, identified: false, status: 'closed', contact_name: 'Contacto' };
    h.debeAtender.mockResolvedValue({ atender: true, tipo: 'desconocido', botEncendido: true, tomada: false });
    h.chatWithTools.mockResolvedValue({ text: 'ok', toolCalls: [], provider: 'test' });
    h.sendTextMessage.mockResolvedValue({ ok: true, waMessageId: 'wamid.out' });
    h.sendInteractiveButtons.mockResolvedValue({ ok: true, waMessageId: 'wamid.btn' });
});

// ─── 1. Escalación duplicada y retiro ────────────────────────────────────────

describe('solicitud de retiro', () => {
    it.each([
        'Les cuento que mi hijo Tomás ya no va a seguir en el club',
        'Les aviso que mi hija no va a continuar el próximo mes',
        'Quiero retirarla del grupo de los sábados',
        'Para que lo actualicen y no me sigan cobrando',
        'Por favor dejen de cobrarme la mensualidad, ya no asiste',
        'Necesito darlo de baja del equipo',
    ])('«%s» → retiro', (t) => expect(esSolicitudDeRetiro(t)).toBe(true));

    it.each([
        'Mi hija no va a ir hoy al entreno, está enferma',
        'Voy a cancelar la mensualidad de octubre esta tarde',
        '¿Dónde puedo retirar el uniforme?',
        'Ya pagué la mensualidad',
        '¿A qué hora es la clase del sábado?',
    ])('«%s» → no es retiro', (t) => expect(esSolicitudDeRetiro(t)).toBe(false));

    it('el motivo del modelo también cuenta («retiro/baja»)', () => {
        expect(esSolicitudDeRetiro('Acudiente informa que su hija no continuará (retiro/baja)')).toBe(true);
    });

    it('el aviso al equipo lo dice explícito', () => {
        const a = textoDelAvisoAlEquipo({ etapa: 'inicial', urgencia: 'normal', categoria: null, tema: 'retiro' }, 'Laura');
        expect(a.titulo).toBe('Solicitud de retiro: Laura');
        expect(a.cuerpo).toMatch(/retirar a un deportista/);
    });
});

describe('una sola escalación abierta por conversación', () => {
    const fila = (direction: string, seg: number, extra: Record<string, any> = {}) => ({
        direction, type: 'text', text_body: 'x', created_at: hace(seg), ...extra,
    });

    it('escalated sin respuesta de la escuela + nuevo entrante → no se repite', () => {
        const e = estadoDeEscalacion([
            fila('inbound', 60), fila('outbound', 50, { payload: { step: 'escalated', urgencia: 'normal' }, ai_generated: true }),
            fila('inbound', 10),
        ]);
        expect(e.abierta).toBe(true);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: null })).toBe('nada');
    });

    it('si una persona de la escuela ya contestó, la escalación siguiente es nueva', () => {
        const e = estadoDeEscalacion([
            fila('outbound', 300, { payload: { step: 'escalated' }, ai_generated: true }),
            fila('outbound', 200, { payload: {}, ai_generated: false, text_body: 'Hola, ya te ayudo' }),
            fila('inbound', 10),
        ]);
        expect(e.abierta).toBe(false);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: null })).toBe('nueva');
    });

    it('conversación cerrada → nueva', () => {
        const e = estadoDeEscalacion([fila('outbound', 300, { payload: { step: 'escalated' }, ai_generated: true })], true);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: null })).toBe('nueva');
    });

    it('abierta normal + llega algo urgente → nueva (el mensaje urgente sí sale)', () => {
        const e = estadoDeEscalacion([fila('outbound', 60, { payload: { step: 'escalated', urgencia: 'normal' }, ai_generated: true })]);
        expect(decidirEscalacion(e, { urgencia: 'urgente', tema: null })).toBe('nueva');
    });

    it('abierta genérica + llega el retiro → solo al equipo (a la familia no se le repite)', () => {
        const e = estadoDeEscalacion([fila('outbound', 60, { payload: { step: 'escalated' }, ai_generated: true })]);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: 'retiro' })).toBe('solo_equipo');
    });

    it('abierta por retiro + otro mensaje del retiro → nada', () => {
        const e = estadoDeEscalacion([fila('outbound', 60, { payload: { step: 'escalated', tema: 'retiro' }, ai_generated: true })]);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: 'retiro' })).toBe('nada');
    });

    it('«Dejo tu mensaje para …» en ESTE turno → no se manda además «Voy a pasar tu caso»', () => {
        const e = estadoDeEscalacion([
            fila('inbound', 30), fila('outbound', 5, { payload: { step: 'mensaje_para_persona' }, ai_generated: true }),
        ]);
        expect(e.mensajeParaPersonaEnTurno).toBe(true);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: null })).toBe('solo_equipo');
    });

    it('«Dejo tu mensaje…» de un turno ANTERIOR no frena la escalación del retiro', () => {
        const e = estadoDeEscalacion([
            fila('inbound', 90), fila('outbound', 80, { payload: { step: 'mensaje_para_persona' }, ai_generated: true }),
            fila('inbound', 20),
        ]);
        expect(decidirEscalacion(e, { urgencia: 'normal', tema: 'retiro' })).toBe('nueva');
    });

    it('re-aviso: dos escalaciones pendientes de la misma conversación → una sola', () => {
        const r = unaPorConversacion([
            { id: 'b', conversationId: 'c1', createdAt: hace(1700) },
            { id: 'a', conversationId: 'c1', createdAt: hace(1750) },
            { id: 'x', conversationId: 'c2', createdAt: hace(1800) },
        ]);
        expect(r.revisar.map((e) => e.id).sort()).toEqual(['a', 'x']);
        expect(r.duplicadas.map((e) => e.id)).toEqual(['b']);
    });
});

describe('ráfaga de una familia: saludo → retiro → «que no me sigan cobrando»', () => {
    beforeEach(() => {
        h.state.conv = { id: CONV, parent_id: 'parent-1', identified: true, status: 'open', contact_name: 'Acudiente' };
        h.debeAtender.mockResolvedValue({ atender: true, tipo: 'familia', botEncendido: true, tomada: false });
    });

    it('el retiro escala UNA vez, sin modelo, con el texto de retiro y aviso «Solicitud de retiro»', async () => {
        saliente('mensaje_para_persona', 60);
        await handleBotTurn(req, INTEGRATION, CONV, entrante('Te cuento que Lucía ya no va a seguir entrenando con ustedes'));
        expect(h.chatWithTools).not.toHaveBeenCalled();
        expect(enviados()).toHaveLength(1);
        expect(enviados()[0]).toContain(MENSAJE_ESCALACION_RETIRO);
        expect(pasosGuardados()).toContain('escalated');
        await new Promise((r) => setTimeout(r, 0));
        expect(notificaciones().some((n) => String(n.title).startsWith('Solicitud de retiro'))).toBe(true);
    });

    it('el siguiente mensaje de la ráfaga, con la escalación abierta, no manda otra', async () => {
        saliente('mensaje_para_persona', 120);
        h.state.filas.push({ wa_message_id: 'wamid.prev', direction: 'inbound', type: 'text',
            text_body: 'Lucía ya no va a seguir en el club', payload: {}, ai_generated: null, created_at: hace(90), wa_timestamp: hace(90) });
        saliente('escalated', 60, { urgencia: 'normal', tema: 'retiro', plazo_min: 30 });
        await handleBotTurn(req, INTEGRATION, CONV, entrante('Y que no nos sigan los cobros, por favor'));
        expect(enviados()).toEqual([]);
        expect(h.chatWithTools).not.toHaveBeenCalled();
    });
});

// ─── 3. Cierres de cortesía ──────────────────────────────────────────────────

describe('cierres de cortesía', () => {
    const equipo = new Map([['marce', 'Marcela'], ['marcela', 'Marcela']]);
    it.each([
        'Cualquier inquietud quedo pendiente',
        'Quedo atenta',
        'Quedo pendiente, gracias',
        'Cualquier cosa me avisas',
        'Listo, estamos en contacto',
        'Gracias por la información',
        'Muchas gracias por la atención, quedo atento',
        'Dale Marce, cualquier cosa me cuentas',
        'Estaré pendiente',
        'A la orden',
    ])('«%s» → cierre', (t) => expect(esCierreDeCortesia(t, equipo)).toBe(true));

    it.each([
        '¿Cualquier duda le escribo a usted?',
        'Quedo atenta a los horarios para mi hija',
        'Quiero inscribir a mi hija',
        'Hola',
        '¿Cuánto vale la mensualidad?',
    ])('«%s» → no es cierre', (t) => expect(esCierreDeCortesia(t, equipo)).toBe(false));

    it('pideAlgo', () => {
        expect(pideAlgo('¿Tienen clases para adultos?')).toBe(true);
        expect(pideAlgo('Me puedes enviar los horarios')).toBe(true);
        expect(pideAlgo('Quedan invitados')).toBe(false);
    });

    it('desconocido: saludo + charla + «Cualquier inquietud quedo pendiente» → sin «escríbeme tu correo»', async () => {
        entrante('Hola Marcela', 30);
        entrante('Cómo estás?', 28);
        entrante('Te mando un abrazo grande', 20);
        await handleBotTurn(req, INTEGRATION, CONV, entrante('Cualquier inquietud quedo pendiente'));
        expect(enviados()).toEqual([]);
        expect(pasosGuardados()).not.toContain('ask_email');
    });

    it('si antes en la ráfaga preguntó algo, el cierre no lo calla', async () => {
        entrante('¿Tienen horario para adultos los martes?', 20);
        await handleBotTurn(req, INTEGRATION, CONV, entrante('Quedo atenta'));
        expect(enviados().length).toBeGreaterThan(0);
    });
});

// ─── 4. Otra institución / proveedor ─────────────────────────────────────────

describe('se presenta como de otra institución', () => {
    it.each([
        'Buenos días, hablas con Paula entrenadora del club Albatros, queríamos saber si pueden venir a un amistoso el sábado',
        'Somos de la empresa Deportes Andinos y queremos ofrecerles uniformes',
        'Le escribo de parte de la Liga de Voleibol para la reunión de delegados',
        'Quedan invitados, ojalá nos puedan acompañar con todos los grupos',
        'Hola, soy el coordinador del colegio San Martín',
        'Les escribo desde la fundación Semillas para proponer una alianza comercial',
        'Les enviamos la cotización de los balones',
    ])('«%s» → externo', (t) => expect(seIdentificaComoExterno(t)).toBe(true));

    it.each([
        'Hola, soy la mamá de Sofía, ¿hablo con la profe?',
        'Quiero inscribir a mi hija en el club',
        'Mi hija entrena con la profe de la sede norte',
        '¿Tienen clases para niños de 8 años?',
        'Hola, ¿hablas con la entrenadora?',
    ])('«%s» → no es externo', (t) => expect(seIdentificaComoExterno(t)).toBe(false));

    it('entrenadora de otro club que invita a un amistoso: ni enlace de inscripción ni correo, al buzón', async () => {
        await handleBotTurn(req, INTEGRATION, CONV, entrante(
            'Buenos días, hablas con Paula entrenadora del club Albatros, queríamos invitarlos a jugar ' +
            'un amistoso el domingo en nuestro club, con los grupos infantil y mayores'));
        expect(enviados()).toEqual([]);
        expect(h.state.updates.some((u) => u.table === 'whatsapp_conversations' && u.row.status === 'open')).toBe(true);
    });

    it('lo que escriba después la misma persona tampoco recibe la plantilla de prospecto', async () => {
        entrante('Hola, soy la entrenadora del club Albatros', 3600);
        await handleBotTurn(req, INTEGRATION, CONV, entrante('¿A qué hora les queda bien el sábado para las categorías infantiles?'));
        expect(enviados()).toEqual([]);
    });
});

// ─── 5. Horario de hoy ───────────────────────────────────────────────────────

describe('horario de hoy', () => {
    it.each([
        '¿Cambiaron el horario de hoy?',
        'hay entreno hoy?',
        'A qué hora es la clase hoy',
        'Hoy se canceló el entrenamiento?',
    ])('«%s» → pregunta por hoy', (t) => expect(preguntaHorarioDeHoy(t)).toBe(true));

    it.each([
        'Mi hijo hoy no puede ir a clase',
        '¿Cuáles son los horarios?',
        'Hoy hace mucho calor',
    ])('«%s» → no', (t) => expect(preguntaHorarioDeHoy(t)).toBe(false));

    it('franjasDelDia', () => {
        const sch = [{ day: 4, time: '16:00', end: '18:00', place: 'Coliseo' }, { day: 6, time: '08:00' }];
        expect(franjasDelDia(sch, 4)).toBe('16:00 a 18:00 (Coliseo)');
        expect(franjasDelDia(sch, 1)).toBeNull();
    });

    it('texto: grupos de hoy + aviso de cambios; sin horarios cargados → null', () => {
        const t = textoHorarioDeHoy({ dia: 'jueves', grupos: [{ nombre: 'Infantil', franjas: '16:00 a 18:00' }], conHorario: 3 }, true);
        expect(t).toContain('hoy *jueves* entrenan');
        expect(t).toContain('• *Infantil*: 16:00 a 18:00');
        expect(t).toContain('cambio de última hora');
        expect(t).toContain('Ya le pasé tu mensaje');
        expect(textoHorarioDeHoy({ dia: 'jueves', grupos: [], conHorario: 3 }, false)).toContain('no hay entrenamientos programados');
        expect(textoHorarioDeHoy({ dia: 'jueves', grupos: [], conHorario: 0 }, false)).toBeNull();
        expect(mencionaCambioOCierre('estoy afuera y está cerrado')).toBe(true);
    });

    it('desconocido: «¿Cambiaron el horario de hoy?» → horario del día, sin pedir correo', async () => {
        const dow = new Date(`${hoyEnBogota()}T12:00:00Z`).getUTCDay();
        h.state.equipos = [
            { name: 'Infantil Femenino', active: true, schedule: [{ day: dow, time: '16:00', end: '18:00', place: 'Coliseo' }] },
            { name: 'Mayores', active: true, schedule: [{ day: (dow + 1) % 7, time: '19:00' }] },
        ];
        entrante('Llegamos a la cancha y no hay nadie', 20);
        await handleBotTurn(req, INTEGRATION, CONV, entrante('¿Cambiaron el horario de hoy?'));
        expect(enviados()).toHaveLength(1);
        expect(enviados()[0]).toContain('Infantil Femenino');
        expect(enviados()[0]).not.toContain('Mayores');
        expect(enviados()[0]).not.toMatch(/correo/);
        expect(pasosGuardados()).toEqual(['horarios_de_hoy']);
    });
});
