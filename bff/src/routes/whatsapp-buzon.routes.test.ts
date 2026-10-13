/**
 * Buzón Fase 1 (2026-10-13): búsqueda en servidor, adjuntos por el BFF y
 * «Enviar plantilla» desde el hilo.
 *
 * Lo que vigila:
 *  - Búsqueda: encuentra fuera de las 200 más recientes, sin tildes, por
 *    teléfono, por texto de mensaje y por nombre del deportista; pagina; nunca
 *    devuelve conversaciones de otra escuela.
 *  - Adjuntos: solo administración de ESA escuela; conversación o mensaje de
 *    otra escuela → 404; contacto personal → 403 sin tocar Meta; sirve la copia
 *    de Storage antes que ir a Meta; si Meta ya no lo tiene → 410.
 *  - Plantillas: sin consentimiento / dado de baja / personal / con botón de
 *    enlace / variables incompletas → NO se llama a Meta. Con todo en regla se
 *    envía UNA vez por el camino común (sendRawPayload, moqueado) y queda en el
 *    hilo. Freno de abuso por conversación.
 *
 * Cero red y cero base: Supabase y el envío a Meta están moqueados. Ningún
 * mensaje real sale de acá.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    usuario: { id: 'admin-a' },
    puedePlantilla: true,
    rpcs: [] as { fn: string; args: any }[],
    storage: {} as Record<string, Buffer>,
    descargas: [] as string[],
    envios: [] as any[],
    descarga: { ok: true, buffer: Buffer.from('META'), mimeType: 'image/jpeg' } as any,
    envio: { ok: true, waMessageId: 'wamid.test' } as any,
}));

/** LIKE de SQL → RegExp (sin distinguir mayúsculas, como ILIKE). */
function likeARegex(patron: string): RegExp {
    let r = '';
    for (let i = 0; i < patron.length; i++) {
        const c = patron[i];
        if (c === '\\' && i + 1 < patron.length) { r += patron[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
        if (c === '%') r += '.*';
        else if (c === '_') r += '.';
        else r += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${r}$`, 'is');
}

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let cambios: Fila | null = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            ilike: (c: string, p: string) => { const re = likeARegex(p); filas = filas.filter((f) => f[c] != null && re.test(String(f[c]))); return api; },
            not: (c: string, op: string, v: any) => { if (op === 'is' && v === null) filas = filas.filter((f) => f[c] != null); return api; },
            order: (c: string, o?: { ascending?: boolean }) => {
                filas = [...filas].sort((a, b) => String(a[c] ?? '').localeCompare(String(b[c] ?? '')) * (o?.ascending === false ? -1 : 1));
                return api;
            },
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (c: Fila) => { cambios = c; return api; },
            maybeSingle: async () => resolver(true),
            single: async () => resolver(true),
            then: (ok: any, ko: any) => Promise.resolve(resolver(false)).then(ok, ko),
        };
        function resolver(uno: boolean) {
            if (cambios) for (const f of filas) Object.assign(f, cambios);
            return { data: uno ? filas[0] ?? null : filas, error: null };
        }
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (fn: string, args: any) => {
                estado.rpcs.push({ fn, args });
                if (fn === 'wa_can_send_template') return { data: estado.puedePlantilla, error: null };
                return { data: { ok: true }, error: null };
            },
            storage: {
                from: () => ({
                    download: async (ruta: string) => {
                        const b = estado.storage[ruta];
                        return b ? { data: new Blob([b]), error: null } : { data: null, error: { message: 'no' } };
                    },
                }),
            },
        },
    };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { ...estado.usuario }; next(); },
}));

// El router de administración se reemplaza por lo mínimo: así la prueba no
// arrastra el bot entero. La autorización real (`administraEstaEscuela`) tiene
// su propia prueba en whatsapp-admin.*.test.
vi.mock('./whatsapp-admin.routes', () => ({
    administraEstaEscuela: async (userId: string, schoolId: string) =>
        (estado.tablas.schools ?? []).some((s) => s.id === schoolId && s.owner_id === userId),
    enriquecerConversaciones: async (_s: string, data: any[]) => ({ tomaDisponible: true, filas: data }),
    estadoDeVentana: (l: string | null) => ({ ventana_abierta: !!l && Date.now() - Date.parse(l) < 86_400_000, ventana_vence: null }),
    integracionParaEnviar: async (schoolId: string) =>
        (estado.tablas.school_whatsapp_integrations ?? []).find((i) => i.school_id === schoolId) ?? null,
}));

vi.mock('../services/whatsapp.service', () => ({
    downloadMedia: async (_i: any, mediaId: string) => { estado.descargas.push(mediaId); return estado.descarga; },
    sendRawPayload: async (_i: any, payload: any) => { estado.envios.push(payload); return estado.envio; },
}));

vi.mock('../services/whatsapp-tomada.service', () => ({
    HORAS_TOMADA_AL_RESPONDER: 2,
    tomarConversacion: async () => ({ ok: true }),
}));

const router = (await import('./whatsapp-buzon.routes')).default;
const { patronSinTildes, fragmento, ultimos10 } = await import('./whatsapp-buzon.routes');
const { reiniciarCuposPlantilla } = await import('../services/whatsapp-plantilla-manual.service');

const A = 'school-a';
const B = 'school-b';

async function llamar(method: string, path: string, body?: any) {
    const app = express();
    app.use(express.json());
    app.use('/', router);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    try {
        const r = await fetch(`http://127.0.0.1:${port}${path}`, {
            method, headers: { 'content-type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        const tipo = r.headers.get('content-type') ?? '';
        if (tipo.includes('application/json')) return { status: r.status, json: await r.json() as any, headers: r.headers };
        return { status: r.status, cuerpo: Buffer.from(await r.arrayBuffer()), headers: r.headers, json: null as any };
    } finally {
        server.close();
    }
}

/** 250 conversaciones de relleno (más que las 200 que veía la búsqueda local). */
function relleno(): Fila[] {
    return Array.from({ length: 250 }, (_, i) => ({
        id: `relleno-${i}`, school_id: A, integration_id: 'int-a', contact_wa_id: `5730000${String(i).padStart(5, '0')}`,
        contact_name: `Contacto ${i}`, contact_kind: 'familia', status: 'closed',
        last_message_at: `2026-10-${String(10 + (i % 3)).padStart(2, '0')}T10:00:00Z`, last_inbound_at: null,
    }));
}

const PLANTILLA = (extra: Fila = {}) => ({
    integration_id: 'int-a', waba_id: 'waba-a', name: 'clase_cancelada', language: 'es_CO',
    category: 'UTILITY', status: 'APPROVED',
    components: [{ type: 'BODY', text: 'Hola {{1}}, la clase de {{2}} fue cancelada.', example: { body_text: [['Ana', 'Sami']] } }],
    ...extra,
});

beforeEach(() => {
    estado.usuario = { id: 'admin-a' };
    estado.puedePlantilla = true;
    estado.rpcs = [];
    estado.descargas = [];
    estado.envios = [];
    estado.storage = {};
    estado.descarga = { ok: true, buffer: Buffer.from('META'), mimeType: 'image/jpeg' };
    estado.envio = { ok: true, waMessageId: 'wamid.test' };
    reiniciarCuposPlantilla();
    estado.tablas = {
        schools: [{ id: A, owner_id: 'admin-a' }, { id: B, owner_id: 'admin-b' }],
        school_whatsapp_integrations: [
            { id: 'int-a', school_id: A, waba_id: 'waba-a', phone_number_id: 'p-a', access_token_encrypted: 'x' },
            { id: 'int-b', school_id: B, waba_id: 'waba-b', phone_number_id: 'p-b', access_token_encrypted: 'y' },
        ],
        whatsapp_conversations: [
            ...relleno(),
            // La más vieja de todas: la búsqueda local no la veía.
            { id: 'conv-vieja', school_id: A, integration_id: 'int-a', contact_wa_id: '573001112233', contact_name: 'María Pérez',
              contact_kind: 'familia', status: 'closed', last_message_at: '2026-01-02T10:00:00Z', last_inbound_at: '2026-01-02T10:00:00Z', parent_id: 'padre-1' },
            { id: 'conv-marta', school_id: A, integration_id: 'int-a', contact_wa_id: '573009998877', contact_name: 'Marta Ruiz',
              contact_kind: 'familia', status: 'closed', last_message_at: '2026-01-03T10:00:00Z', last_inbound_at: null },
            { id: 'conv-personal', school_id: A, integration_id: 'int-a', contact_wa_id: '573005550000', contact_name: 'Prima',
              contact_kind: 'personal', status: 'closed', last_message_at: '2026-10-01T10:00:00Z', last_inbound_at: null },
            { id: 'conv-b', school_id: B, integration_id: 'int-b', contact_wa_id: '573001112244', contact_name: 'María de B',
              contact_kind: 'familia', status: 'closed', last_message_at: '2026-10-12T10:00:00Z', last_inbound_at: null },
        ],
        whatsapp_messages: [
            { id: 'm-1', conversation_id: 'conv-vieja', integration_id: 'int-a', type: 'text', text_body: 'Quiero la información de la mensualidad', created_at: '2026-01-02T10:00:00Z' },
            { id: 'm-img', conversation_id: 'conv-vieja', integration_id: 'int-a', type: 'image', wa_message_id: 'wamid.img',
              payload: { image: { id: 'meta-img-1', mime_type: 'image/jpeg' } }, created_at: '2026-01-02T10:01:00Z' },
            { id: 'm-doc', conversation_id: 'conv-vieja', integration_id: 'int-a', type: 'document', wa_message_id: 'wamid.doc',
              payload: { document: { id: 'meta-doc-1', mime_type: 'application/pdf', filename: 'recibo.pdf' } }, created_at: '2026-01-02T10:02:00Z' },
            { id: 'm-purgado', conversation_id: 'conv-vieja', integration_id: 'int-a', type: 'image', wa_message_id: 'wamid.p',
              payload: { privacidad: 'personal_sin_contenido' }, created_at: '2026-01-02T10:03:00Z' },
            { id: 'm-personal', conversation_id: 'conv-personal', integration_id: 'int-a', type: 'image', wa_message_id: 'wamid.per',
              payload: { image: { id: 'meta-per' } }, created_at: '2026-10-01T10:00:00Z' },
            { id: 'm-b', conversation_id: 'conv-b', integration_id: 'int-b', type: 'image', wa_message_id: 'wamid.b',
              payload: { image: { id: 'meta-b' } }, text_body: 'información mensualidad', created_at: '2026-10-12T10:00:00Z' },
        ],
        whatsapp_inbound_queue: [],
        children: [{ school_id: A, full_name: 'Samuel Pérez', parent_id: 'padre-1', parent_phone_temp: null }],
        unregistered_athletes: [],
        profiles: [{ id: 'padre-1', phone: '3001112233' }],
        whatsapp_optins: [],
        whatsapp_template_status: [
            PLANTILLA(),
            PLANTILLA({ name: 'pago_confirmado', components: [
                { type: 'BODY', text: 'Pago {{1}} de {{2}}.' },
                { type: 'BUTTONS', buttons: [{ type: 'URL', url: 'https://sportmaps.co/p/{{1}}', text: 'Ver' }] }] }),
            PLANTILLA({ name: 'promo', category: 'MARKETING' }),
            PLANTILLA({ name: 'pendiente', status: 'PENDING' }),
        ],
    };
});

// ─── Búsqueda ────────────────────────────────────────────────────────────────

describe('utilidades de búsqueda', () => {
    it('el patrón no distingue tildes y escapa los comodines', () => {
        expect(likeARegex(patronSinTildes('maria')).test('María Pérez')).toBe(true);
        expect(likeARegex(patronSinTildes('50%')).test('pagó 500')).toBe(false);
        expect(likeARegex(patronSinTildes('50%')).test('el 50% ya')).toBe(true);
    });
    it('ultimos10 y fragmento', () => {
        expect(ultimos10('+57 300 111 2233')).toBe('3001112233');
        expect(ultimos10('123')).toBeNull();
        expect(fragmento('a'.repeat(100) + 'mensualidad' + 'b'.repeat(100), 'MENSUALIDAD')).toMatch(/^…a+mensualidadb+…$/);
    });
});

describe('GET /:schoolId/buzon/buscar', () => {
    it('403 si no administra la escuela; 400 con menos de 2 caracteres', async () => {
        estado.usuario = { id: 'intruso' };
        expect((await llamar('GET', `/${A}/buzon/buscar?q=maria`)).status).toBe(403);
        estado.usuario = { id: 'admin-a' };
        expect((await llamar('GET', `/${A}/buzon/buscar?q=m`)).status).toBe(400);
    });

    it('encuentra por nombre sin tildes una conversación fuera de las 200 más recientes, y descarta parecidos', async () => {
        const r = await llamar('GET', `/${A}/buzon/buscar?q=maria`);
        expect(r.status).toBe(200);
        const ids = r.json.conversaciones.map((c: any) => c.id);
        expect(ids).toContain('conv-vieja');
        expect(ids).not.toContain('conv-marta');      // «m_r__» casa con Marta: se descarta
        expect(ids).not.toContain('conv-b');          // otra escuela
        expect(r.json.conversaciones.find((c: any) => c.id === 'conv-vieja').coincidencia.tipo).toBe('nombre');
    });

    it('por teléfono, por texto del mensaje (con fragmento) y por nombre del deportista', async () => {
        const tel = await llamar('GET', `/${A}/buzon/buscar?q=1112233`);
        expect(tel.json.conversaciones.map((c: any) => c.id)).toEqual(['conv-vieja']);
        expect(tel.json.conversaciones[0].coincidencia.tipo).toBe('telefono');

        const msg = await llamar('GET', `/${A}/buzon/buscar?q=informacion`);
        expect(msg.json.conversaciones.map((c: any) => c.id)).toEqual(['conv-vieja']);
        expect(msg.json.conversaciones[0].coincidencia).toMatchObject({ tipo: 'mensaje' });
        expect(msg.json.conversaciones[0].coincidencia.texto).toMatch(/información/);

        const dep = await llamar('GET', `/${A}/buzon/buscar?q=samuel`);
        expect(dep.json.conversaciones.map((c: any) => c.id)).toEqual(['conv-vieja']);
        expect(dep.json.conversaciones[0].coincidencia).toEqual({ tipo: 'deportista', texto: 'Samuel Pérez' });
    });

    it('pagina sobre el total del servidor', async () => {
        const p1 = await llamar('GET', `/${A}/buzon/buscar?q=contacto&limite=50`);
        expect(p1.json.total).toBe(250);
        expect(p1.json.conversaciones).toHaveLength(50);
        expect(p1.json.hay_mas).toBe(true);
        const ult = await llamar('GET', `/${A}/buzon/buscar?q=contacto&limite=50&offset=200`);
        expect(ult.json.conversaciones).toHaveLength(50);
        expect(ult.json.hay_mas).toBe(false);
    });
});

// ─── Adjuntos ────────────────────────────────────────────────────────────────

describe('GET …/mensajes/:id/media', () => {
    const ruta = (conv: string, msg: string, school = A) => `/${school}/conversaciones/${conv}/mensajes/${msg}/media`;

    it('403 si no administra; 404 si la conversación o el mensaje son de otra escuela', async () => {
        estado.usuario = { id: 'admin-b' };
        expect((await llamar('GET', ruta('conv-vieja', 'm-img'))).status).toBe(403);
        estado.usuario = { id: 'admin-a' };
        expect((await llamar('GET', ruta('conv-b', 'm-b'))).status).toBe(404);
        // Conversación propia + id de un mensaje ajeno.
        expect((await llamar('GET', ruta('conv-vieja', 'm-b'))).status).toBe(404);
        expect(estado.descargas).toEqual([]);
    });

    it('contacto personal → 403 sin ir a Meta; sin adjunto o purgado → 404', async () => {
        expect((await llamar('GET', ruta('conv-personal', 'm-personal'))).status).toBe(403);
        expect((await llamar('GET', ruta('conv-vieja', 'm-purgado'))).status).toBe(404);
        expect((await llamar('GET', ruta('conv-vieja', 'm-1'))).status).toBe(404);
        expect(estado.descargas).toEqual([]);
    });

    it('baja de Meta con el token de la escuela y responde privado', async () => {
        const r = await llamar('GET', ruta('conv-vieja', 'm-img'));
        expect(r.status).toBe(200);
        expect(r.cuerpo!.toString()).toBe('META');
        expect(r.headers.get('content-type')).toBe('image/jpeg');
        expect(r.headers.get('cache-control')).toMatch(/private/);
        expect(estado.descargas).toEqual(['meta-img-1']);
    });

    it('un documento va como descarga con su nombre', async () => {
        estado.descarga = { ok: true, buffer: Buffer.from('%PDF'), mimeType: 'application/pdf' };
        const r = await llamar('GET', ruta('conv-vieja', 'm-doc'));
        expect(r.status).toBe(200);
        expect(r.headers.get('content-disposition')).toBe('attachment; filename="recibo.pdf"');
    });

    it('si el comprobante ya está en Storage se sirve de ahí, sin Meta', async () => {
        estado.tablas.whatsapp_inbound_queue = [
            { school_id: A, wa_message_id: 'wamid.img', storage_path: 'A/whatsapp/x.jpeg', media_mime_type: 'image/jpeg' },
        ];
        estado.storage['A/whatsapp/x.jpeg'] = Buffer.from('GUARDADO');
        const r = await llamar('GET', ruta('conv-vieja', 'm-img'));
        expect(r.cuerpo!.toString()).toBe('GUARDADO');
        expect(estado.descargas).toEqual([]);
    });

    it('Meta ya no lo tiene → 410 con explicación', async () => {
        estado.descarga = { ok: false, error: 'graph_media_404' };
        const r = await llamar('GET', ruta('conv-vieja', 'm-img'));
        expect(r.status).toBe(410);
        expect(r.json.detalle).toMatch(/ya no tiene/);
    });
});

// ─── Plantillas desde el hilo ────────────────────────────────────────────────

describe('plantillas desde el hilo', () => {
    const envio = (body: any, conv = 'conv-vieja') => llamar('POST', `/${A}/conversaciones/${conv}/plantilla`, body);

    it('lista: solo la de texto se puede mandar; las demás dicen por qué', async () => {
        const r = await llamar('GET', `/${A}/conversaciones/conv-vieja/plantillas`);
        expect(r.status).toBe(200);
        expect(r.json.puede_enviar).toBe(true);
        const porNombre = Object.fromEntries(r.json.plantillas.map((p: any) => [p.nombre, p]));
        expect(porNombre.clase_cancelada).toMatchObject({ enviable: true, variables: 2, ejemplos: ['Ana', 'Sami'] });
        expect(porNombre.pago_confirmado).toMatchObject({ enviable: false, motivo: 'necesita_enlace' });
        expect(porNombre.promo).toMatchObject({ enviable: false, motivo: 'no_es_utility' });
        expect(porNombre.pendiente).toMatchObject({ enviable: false, motivo: 'no_aprobada' });
        expect(r.json.plantillas[0].nombre).toBe('clase_cancelada');   // las enviables primero
    });

    it('sin consentimiento: la lista lo dice y el envío responde 409 sin llamar a Meta', async () => {
        estado.puedePlantilla = false;
        const l = await llamar('GET', `/${A}/conversaciones/conv-vieja/plantillas`);
        expect(l.json).toMatchObject({ puede_enviar: false, motivo: 'sin_consentimiento' });
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] });
        expect(r.status).toBe(409);
        expect(r.json.error).toBe('sin_consentimiento');
        expect(estado.envios).toEqual([]);
    });

    it('dado de baja (STOP) → 409 dado_de_baja', async () => {
        estado.puedePlantilla = false;
        estado.tablas.whatsapp_optins = [{ integration_id: 'int-a', contact_wa_id: '573001112233', opted_in_at: '2026-01-01', opted_out_at: '2026-02-01' }];
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] });
        expect(r.status).toBe(409);
        expect(r.json.error).toBe('dado_de_baja');
        expect(estado.envios).toEqual([]);
    });

    it('contacto personal → 409 sin preguntar ni enviar', async () => {
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] }, 'conv-personal');
        expect(r.status).toBe(409);
        expect(r.json.error).toBe('contacto_personal');
        expect(estado.envios).toEqual([]);
    });

    it('plantilla con botón de enlace, no aprobada o con variables incompletas → no se envía', async () => {
        expect((await envio({ nombre: 'pago_confirmado', variables: ['a', 'b'] })).status).toBe(409);
        expect((await envio({ nombre: 'pendiente', variables: ['a', 'b'] })).status).toBe(409);
        const incompleta = await envio({ nombre: 'clase_cancelada', variables: ['Ana', '  '] });
        expect(incompleta.status).toBe(400);
        expect(incompleta.json.detalle).toMatch(/\{\{2\}\}/);
        expect((await envio({ nombre: 'no_existe', variables: [] })).status).toBe(404);
        expect(estado.envios).toEqual([]);
    });

    it('de otra escuela → 404', async () => {
        const r = await llamar('POST', `/${A}/conversaciones/conv-b/plantilla`, { nombre: 'clase_cancelada', variables: ['a', 'b'] });
        expect(r.status).toBe(404);
        expect(estado.envios).toEqual([]);
    });

    it('con todo en regla se envía una vez, queda en el hilo y la conversación atendida', async () => {
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] });
        expect(r.status).toBe(201);
        expect(r.json.texto).toBe('Hola Ana, la clase de Sami fue cancelada.');
        expect(estado.envios).toHaveLength(1);
        expect(estado.envios[0]).toMatchObject({
            to: '573001112233', type: 'template',
            template: { name: 'clase_cancelada', language: { code: 'es_CO' } },
        });
        // Sin botón: solo el body con sus dos parámetros.
        expect(estado.envios[0].template.components).toEqual([
            { type: 'body', parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: 'Sami' }] },
        ]);
        const registro = estado.rpcs.find((x) => x.fn === 'wa_record_outbound_message');
        expect(registro?.args).toMatchObject({ p_type: 'template', p_ai_generated: false,
            p_payload: { manual: true, por: 'admin-a', plantilla: 'clase_cancelada' } });
        const conv = estado.tablas.whatsapp_conversations.find((c) => c.id === 'conv-vieja')!;
        expect(conv).toMatchObject({ status: 'closed', assigned_to: 'admin-a' });
    });

    it('si Meta rechaza → 502 y no se registra en el hilo', async () => {
        estado.envio = { ok: false, error: '(#132001) Template name does not exist' };
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] });
        expect(r.status).toBe(502);
        expect(estado.rpcs.some((x) => x.fn === 'wa_record_outbound_message')).toBe(false);
    });

    it('freno: la cuarta plantilla a la misma persona en una hora → 429', async () => {
        for (let i = 0; i < 3; i++) {
            expect((await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] })).status).toBe(201);
        }
        const r = await envio({ nombre: 'clase_cancelada', variables: ['Ana', 'Sami'] });
        expect(r.status).toBe(429);
        expect(estado.envios).toHaveLength(3);
    });
});
