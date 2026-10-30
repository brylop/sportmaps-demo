/**
 * T1 · Webhook `history` de Coexistence: lo importado se guarda con su fecha
 * REAL (`created_at = wa_timestamp`), en lote, sin duplicar, y no despierta
 * nada del bot.
 *
 * Antes: `guardarMensaje` no fijaba `created_at` (todo quedaba «de hoy»),
 * escribía de a un mensaje, mandaba `status` crudo de Meta (played / pending /
 * error / null violan el CHECK y el NOT NULL) y `type: media_placeholder`
 * (viola el CHECK de tipo): la fila se perdía en silencio.
 *
 * Supabase en memoria que filtra de verdad (eq / in / gte / lte / order /
 * limit). Datos inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Fila = Record<string, any>;

const h = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    llamadas: [] as { tabla: string; op: string; filas: number }[],
    fallarLote: false,
    enviarConReserva: null as any,
    avisarEscalacionAlEquipo: null as any,
}));

vi.mock('../config/supabase', () => {
    const valor = (f: Fila, c: string) => {
        if (c.includes('->>')) { const [col, sub] = c.split('->>'); return f[col]?.[sub]; }
        if (c.includes('->')) { const [col, sub] = c.split('->'); return f[col]?.[sub]; }
        return f[c];
    };
    function builder(tabla: string) {
        const filtros: ((f: Fila) => boolean)[] = [];
        let orden: { c: string; asc: boolean } | null = null;
        let limite = Infinity;
        let escritura: { op: 'upsert' | 'insert' | 'update'; datos: any; opciones?: any } | null = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filtros.push((f) => valor(f, c) === v); return api; },
            neq: (c: string, v: any) => { filtros.push((f) => valor(f, c) !== v); return api; },
            in: (c: string, vs: any[]) => { filtros.push((f) => vs.includes(valor(f, c))); return api; },
            is: (c: string, v: any) => { filtros.push((f) => (valor(f, c) ?? null) === v); return api; },
            not: (c: string, _op: string, _v: any) => { filtros.push((f) => valor(f, c) != null); return api; },
            gte: (c: string, v: any) => { filtros.push((f) => valor(f, c) != null && valor(f, c) >= v); return api; },
            gt: (c: string, v: any) => { filtros.push((f) => valor(f, c) != null && valor(f, c) > v); return api; },
            lte: (c: string, v: any) => { filtros.push((f) => valor(f, c) != null && valor(f, c) <= v); return api; },
            lt: (c: string, v: any) => { filtros.push((f) => valor(f, c) != null && valor(f, c) < v); return api; },
            order: (c: string, o?: { ascending?: boolean }) => { orden = { c, asc: o?.ascending !== false }; return api; },
            limit: (n: number) => { limite = n; return api; },
            upsert: (datos: any, opciones?: any) => { escritura = { op: 'upsert', datos, opciones }; return api; },
            insert: (datos: any) => { escritura = { op: 'insert', datos }; return api; },
            update: (datos: any) => { escritura = { op: 'update', datos }; return api; },
            maybeSingle: async () => resolver(true),
            single: async () => resolver(true),
            then: (ok: any, ko: any) => Promise.resolve(resolver(false)).then(ok, ko),
        };
        function resolver(uno: boolean) {
            h.tablas[tabla] ??= [];
            const t = h.tablas[tabla];
            if (escritura?.op === 'upsert' || escritura?.op === 'insert') {
                const lista: Fila[] = Array.isArray(escritura.datos) ? escritura.datos : [escritura.datos];
                h.llamadas.push({ tabla, op: escritura.op, filas: lista.length });
                if (tabla === 'whatsapp_messages' && h.fallarLote && lista.length > 1) {
                    return { data: null, error: { message: 'lote rechazado (simulado)' } };
                }
                const claves = String(escritura.opciones?.onConflict ?? '').split(',').filter(Boolean);
                const nuevas: Fila[] = [];
                for (const fila of lista) {
                    const ya = claves.length ? t.find((f) => claves.every((k) => f[k] === fila[k])) : null;
                    if (ya) { if (!escritura.opciones?.ignoreDuplicates) Object.assign(ya, fila); continue; }
                    const nueva = { id: `${tabla}-${t.length + 1}`, ...fila };
                    t.push(nueva);
                    nuevas.push(nueva);
                }
                return { data: uno ? nuevas[0] ?? null : nuevas, error: null };
            }
            let filas = t.filter((f) => filtros.every((p) => p(f)));
            if (escritura?.op === 'update') { for (const f of filas) Object.assign(f, escritura.datos); }
            if (orden) {
                const { c, asc } = orden;
                filas = [...filas].sort((a, b) => (valor(a, c) < valor(b, c) ? -1 : valor(a, c) > valor(b, c) ? 1 : 0) * (asc ? 1 : -1));
            }
            filas = filas.slice(0, limite);
            return { data: uno ? filas[0] ?? null : filas, error: null };
        }
        return api;
    }
    return { supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('./whatsapp.service', () => ({
    resolveIntegration: async (id: string) => (id === 'pn-monster' ? { id: 'int-1', school_id: 'school-1' } : null),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('./avisos-correo.service', async () => {
    const real = await vi.importActual<typeof import('./avisos-correo.service')>('./avisos-correo.service');
    h.enviarConReserva = vi.fn(async () => 'enviado');
    return { ...real, correosDeSoporte: () => ['soporte@sportmaps.co'], enviarConReserva: (...a: any[]) => h.enviarConReserva(...a) };
});
vi.mock('./whatsapp-escalaciones.service', () => {
    h.avisarEscalacionAlEquipo = vi.fn(async () => 1);
    return { avisarEscalacionAlEquipo: (...a: any[]) => h.avisarEscalacionAlEquipo(...a) };
});
vi.mock('./llm.service', () => ({ chatWithTools: vi.fn() }));
vi.mock('./push.service', () => ({ sendToUser: vi.fn() }));
vi.mock('../utils/emailClient', () => ({ emailClient: { send: vi.fn() } }));

const { procesarHistorial, estadoDeHistorial, fechaDeHistorial } = await import('./whatsapp-coexistence.service');
const { escuelaActiva, revisarPendientesSinRespuesta, _reiniciarRevisionDePendientes } = await import('./whatsapp-modo-discreto');
const { entrantesDeTexto } = await import('./whatsapp-bot.service');

const AHORA = Date.now();
const DIA = 86_400_000;
/** Epoch en segundos de hace `ms`. */
const hace = (ms: number) => String(Math.floor((AHORA - ms) / 1000));
const iso = (seg: string) => new Date(Number(seg) * 1000).toISOString();

const ESCUELA = '573194505150';
const ANA = '573001110001';
const BETO = '573001110002';
const CARO = '573001110003';
const PERSONAL = '573001110009';
const SALUDO = 'Gracias por comunicarte con Monster´s Volley Club 🏐 En breve te respondemos.';

/** Webhook `history` con un trozo. */
const webhook = (threads: any[], metadata: any = { phase: 1, chunk_order: 1, progress: 40 }) => ({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-monster', changes: [{
        field: 'history',
        value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: ESCUELA, phone_number_id: 'pn-monster' },
            history: [{ metadata, threads }],
        },
    }] }],
});
const texto = (id: string, from: string, ts: string, body: string, status = 'read') =>
    ({ from, id, timestamp: ts, type: 'text', text: { body }, history_context: { status } });

const mensajes = () => h.tablas.whatsapp_messages;
const msg = (id: string) => mensajes().find((m) => m.wa_message_id === id)!;
const conv = (contacto: string) => h.tablas.whatsapp_conversations.find((c) => c.contact_wa_id === contacto)!;
const upsertsDe = (tabla: string) => h.llamadas.filter((l) => l.tabla === tabla && l.op === 'upsert');
const eventos = () => h.tablas.whatsapp_account_events ?? [];

beforeEach(() => {
    h.tablas = {
        whatsapp_conversations: [{
            id: 'conv-personal', integration_id: 'int-1', school_id: 'school-1', contact_wa_id: PERSONAL,
            status: 'closed', contact_kind: 'personal', tambien_familia: false,
        }],
        whatsapp_messages: [],
        whatsapp_account_events: [],
        whatsapp_settings: [],
        school_whatsapp_integrations: [],
        schools: [{ id: 'school-1', name: 'Monster´s Volley Club' }],
    };
    h.llamadas = [];
    h.fallarLote = false;
    h.enviarConReserva.mockClear();
    h.avisarEscalacionAlEquipo.mockClear();
    _reiniciarRevisionDePendientes();
});

/** Hilos de un trozo real: preguntas de hace 60 días, saludo automático, un audio, una reacción. */
function hilosDeMonster() {
    const t60 = hace(60 * DIA);
    const t20 = hace(20 * DIA);
    return [
        { id: ANA, messages: [
            texto('wamid.A1', ANA, t60, 'Hola, quiero inscribir a mi hija en voleibol'),
            texto('wamid.A2', ESCUELA, String(Number(t60) + 600), 'Hola Ana, claro: martes y jueves 4 pm', 'played'),
            { from: ANA, id: 'wamid.A3', timestamp: String(Number(t60) + 700), type: 'media_placeholder', history_context: { status: 'read' } },
            { from: ANA, id: 'wamid.A4', timestamp: String(Number(t60) + 800), type: 'reaction', reaction: { emoji: '👍' } },
            texto('wamid.A1', ANA, t60, 'Hola, quiero inscribir a mi hija en voleibol'), // Meta repite
        ] },
        // El saludo de la app a 3 contactos en minutos: es automático.
        ...[BETO, CARO, ANA].map((c, i) => ({ id: c, messages: [
            texto(`wamid.in-${i}`, c, String(Number(t20) + i * 60), '¿Tienen clase de prueba?'),
            texto(`wamid.saludo-${i}`, ESCUELA, String(Number(t20) + i * 60 + 2), SALUDO, i === 1 ? 'pending' : 'error'),
        ] })),
        { id: PERSONAL, messages: [texto('wamid.P1', PERSONAL, t20, 'Mami, ¿me recoges?')] },
    ];
}

describe('procesarHistorial · fecha real, lote, idempotencia', () => {
    it('created_at = wa_timestamp (la fecha real del mensaje), no la de importación', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        const a1 = msg('wamid.A1');
        expect(a1.created_at).toBe(iso(hace(60 * DIA)));
        expect(a1.wa_timestamp).toBe(a1.created_at);
        for (const m of mensajes()) expect(m.created_at).toBe(m.wa_timestamp);
        expect(Date.parse(a1.created_at)).toBeLessThan(AHORA - 59 * DIA);
    });

    it('un upsert de mensajes por trozo (no uno por mensaje) y las conversaciones en lote', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        expect(upsertsDe('whatsapp_messages')).toHaveLength(1);
        expect(upsertsDe('whatsapp_messages')[0].filas).toBe(mensajes().length);
        // 3 contactos nuevos en UNA escritura; el personal ya existía.
        expect(upsertsDe('whatsapp_conversations')).toEqual([{ tabla: 'whatsapp_conversations', op: 'upsert', filas: 3 }]);
    });

    it('idempotente por wa_message_id: Meta reenvía el trozo y no se duplica nada', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        const n = mensajes().length;
        await procesarHistorial(webhook(hilosDeMonster()));
        expect(mensajes()).toHaveLength(n);
        expect(new Set(mensajes().map((m) => m.wa_message_id)).size).toBe(n);
        expect(h.tablas.whatsapp_conversations).toHaveLength(4);
    });

    it('lo que el CHECK no admite se normaliza en vez de perderse; la reacción no se guarda', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        expect(msg('wamid.A1')).toMatchObject({ direction: 'inbound', status: 'received', type: 'text', ai_generated: false });
        expect(msg('wamid.A2')).toMatchObject({ direction: 'outbound', status: 'read' });        // played
        expect(msg('wamid.saludo-1')).toMatchObject({ status: 'queued' });                         // pending
        expect(msg('wamid.saludo-0')).toMatchObject({ status: 'failed' });                         // error
        expect(msg('wamid.A3')).toMatchObject({ type: 'unsupported', payload: { type: 'media_placeholder' } });
        expect(mensajes().find((m) => m.wa_message_id === 'wamid.A4')).toBeUndefined();
        for (const m of mensajes()) {
            expect(['received', 'queued', 'sent', 'delivered', 'read', 'failed']).toContain(m.status);
            expect(m.payload.historial).toBe(true);
        }
    });

    it('el saludo automático de la app queda marcado `automatico` (no es «la escuela le escribió»)', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        for (const i of [0, 1, 2]) expect(msg(`wamid.saludo-${i}`).payload.automatico).toBe(true);
        expect(msg('wamid.A2').payload.automatico).toBeUndefined();
    });

    it('contacto marcado personal: solo metadatos, igual que en vivo', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        const p = msg('wamid.P1');
        expect(p.text_body).toBeNull();
        expect(p.payload).toEqual({
            privacidad: 'personal_sin_contenido', id: 'wamid.P1', type: 'text',
            timestamp: hace(20 * DIA), from: PERSONAL, historial: true,
        });
    });

    it('las conversaciones que crea nacen cerradas y sin last_inbound_at', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        for (const c of [ANA, BETO, CARO]) {
            expect(conv(c)).toMatchObject({ status: 'closed', integration_id: 'int-1', school_id: 'school-1' });
            expect(conv(c).last_inbound_at).toBeUndefined();
        }
    });

    it('más de 500 mensajes: de a 500 por upsert', async () => {
        const muchos = Array.from({ length: 1201 }, (_, i) =>
            texto(`wamid.M${i}`, ANA, String(Number(hace(90 * DIA)) + i), `mensaje ${i}`));
        await procesarHistorial(webhook([{ id: ANA, messages: muchos }]));
        expect(upsertsDe('whatsapp_messages').map((l) => l.filas)).toEqual([500, 500, 201]);
        expect(mensajes()).toHaveLength(1201);
    });

    it('si un lote falla se reintenta de a uno: el historial no se puede volver a pedir', async () => {
        h.fallarLote = true;
        await procesarHistorial(webhook(hilosDeMonster()));
        expect(mensajes().length).toBeGreaterThan(5);
        expect(msg('wamid.A1').created_at).toBe(iso(hace(60 * DIA)));
    });

    it('mensaje sin fecha: no se guarda con la de hoy', async () => {
        await procesarHistorial(webhook([{ id: ANA, messages: [{ from: ANA, id: 'wamid.X', type: 'text', text: { body: 'hola' } }] }]));
        expect(mensajes()).toHaveLength(0);
    });
});

describe('procesarHistorial · «¿ya sincronizó?» y el rechazo de la escuela', () => {
    it('progress: 100 queda registrado una sola vez y sin el contenido de los mensajes', async () => {
        const fin = { phase: 2, chunk_order: 7, progress: 100 };
        await procesarHistorial(webhook(hilosDeMonster(), fin));
        await procesarHistorial(webhook(hilosDeMonster(), fin));
        const completos = eventos().filter((e) => e.field === 'history_sync' && e.nuevo_estado === 'completo');
        expect(completos).toHaveLength(1);
        expect(completos[0]).toMatchObject({
            integration_id: 'int-1', school_id: 'school-1', phone_number_id: 'pn-monster', waba_id: 'waba-monster',
            payload: { field: 'history', metadata: fin },
        });
        expect(JSON.stringify(completos[0].payload)).not.toContain('quiero inscribir');
    });

    it('un trozo intermedio no registra nada', async () => {
        await procesarHistorial(webhook(hilosDeMonster(), { phase: 0, chunk_order: 1, progress: 55 }));
        expect(eventos()).toHaveLength(0);
    });

    it('error 2593109 (la escuela no comparte el historial): queda «rechazado» y avisa UNA vez a la plataforma', async () => {
        const rechazo = {
            entry: [{ id: 'waba-monster', changes: [{ field: 'history', value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: ESCUELA, phone_number_id: 'pn-monster' },
                history: [{ errors: [{
                    code: 2593109,
                    title: 'History sync is turned off by the business from the WhatsApp Business App',
                    message: 'History sync is turned off by the business from the WhatsApp Business App',
                    error_data: { details: 'History sharing is turned off by the business' },
                }] }],
            } }] }],
        };
        await procesarHistorial(rechazo);
        await procesarHistorial(rechazo); // Meta reintenta el webhook
        const rechazados = eventos().filter((e) => e.field === 'history_sync' && e.nuevo_estado === 'rechazado');
        expect(rechazados).toHaveLength(1);
        expect(rechazados[0].motivo).toBe('2593109: History sharing is turned off by the business');
        expect(mensajes()).toHaveLength(0);
        expect(h.enviarConReserva).toHaveBeenCalledTimes(1);
        expect(h.enviarConReserva.mock.calls[0][0]).toMatchObject({
            clave: 'wa_historial:rechazado:history:int-1', schoolId: 'school-1', refId: 'int-1',
            destinos: ['soporte@sportmaps.co'],
        });
        expect(h.enviarConReserva.mock.calls[0][0].respaldo.subject).toContain('Monster´s Volley Club');
    });
});

describe('lo importado no despierta al bot', () => {
    it('entrantesDeTexto (7 y 30 días) no ve lo de hace 60 días; con la fecha de importación lo veía', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        const convAna = conv(ANA).id;
        expect(await entrantesDeTexto(convAna, 30)).toEqual(['¿Tienen clase de prueba?']); // el de hace 20 días
        expect(await entrantesDeTexto(convAna, 7)).toEqual([]);
        expect(await entrantesDeTexto(conv(BETO).id, 7)).toEqual([]);
    });

    it('modo discreto: la historia de hace 20 días no calla al bot', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        for (const c of [ANA, BETO, CARO]) expect(await escuelaActiva(conv(c).id)).toBe(false);
    });

    it('modo discreto: lo que la dueña escribió de verdad hace 2 h sí cuenta (es real, igual que un eco en vivo)', async () => {
        const t = hace(2 * 3600_000);
        await procesarHistorial(webhook([{ id: BETO, messages: [
            texto('wamid.B1', BETO, String(Number(t) - 300), '¿A qué hora es el entreno?'),
            texto('wamid.B2', ESCUELA, t, 'A las 5, te espero'),
        ] }]));
        expect(await escuelaActiva(conv(BETO).id)).toBe(true);
    });

    it('aviso de pendientes: una pregunta de hace 2 h sin respuesta en la historia no avisa a nadie', async () => {
        const t = hace(2 * 3600_000);
        await procesarHistorial(webhook([{ id: CARO, messages: [
            texto('wamid.C1', CARO, t, '¿Cuánto vale la mensualidad?'),
        ] }]));
        h.tablas.whatsapp_conversations.find((c) => c.contact_wa_id === CARO)!.contact_kind = 'familia';
        const r = await revisarPendientesSinRespuesta(AHORA, true);
        expect(r.avisadas).toBe(0);
        expect(h.avisarEscalacionAlEquipo).not.toHaveBeenCalled();
    });

    it('nada de lo importado queda en la cola de entrantes ni abre conversaciones', async () => {
        await procesarHistorial(webhook(hilosDeMonster()));
        expect(h.tablas.whatsapp_inbound_queue ?? []).toHaveLength(0);
        expect(h.tablas.whatsapp_conversations.filter((c) => c.status === 'open')).toHaveLength(0);
        expect(h.tablas.whatsapp_message_drafts ?? []).toHaveLength(0);
    });
});

describe('piezas puras', () => {
    it('estadoDeHistorial: lo de Meta al CHECK de la tabla', () => {
        expect(estadoDeHistorial('inbound', 'read')).toBe('received');
        expect(estadoDeHistorial('outbound', 'delivered')).toBe('delivered');
        expect(estadoDeHistorial('outbound', 'played')).toBe('read');
        expect(estadoDeHistorial('outbound', 'pending')).toBe('queued');
        expect(estadoDeHistorial('outbound', 'error')).toBe('failed');
        expect(estadoDeHistorial('outbound', undefined)).toBe('sent');
    });

    it('fechaDeHistorial no lanza con basura', () => {
        expect(fechaDeHistorial('1761836400')).toBe('2025-10-30T15:00:00.000Z');
        expect(fechaDeHistorial('abc')).toBeNull();
        expect(fechaDeHistorial(undefined)).toBeNull();
        expect(fechaDeHistorial('')).toBeNull();
    });
});
