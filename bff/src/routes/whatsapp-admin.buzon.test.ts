/**
 * Buzón de WhatsApp, Fase A: pestañas familias/otros, `pendiente`, marcar
 * personal, cerrar, y `responder_desconocidos` en ajustes.
 *
 * Lo que más importa vigilar:
 *  - Sin la migración 20261003193624 aplicada, el buzón NO se cae: degrada a la
 *    lista completa sin clasificar.
 *  - El school_id va en el filtro: un admin de A no marca ni cierra hilos de B.
 *  - Los echos de Coexistence (outbound, ai_generated=false) cuentan como respuesta.
 *
 * Cero red y cero base: Supabase está moqueado con un builder que filtra de
 * verdad en eq/in y que puede simular la columna inexistente (error 42703).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    /** Simula que la migración de Fase A NO está aplicada. */
    sinColumnas: false,
    usuario: { id: 'admin-a' },
}));

vi.mock('../config/supabase', () => {
    const COLS_NUEVAS = /contact_kind|responder_desconocidos/;
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let cambios: Fila | null = null;
        let error: any = null;
        const api: any = {
            select: (cols?: string) => {
                if (estado.sinColumnas && cols && COLS_NUEVAS.test(cols)) {
                    error = { code: '42703', message: 'column whatsapp_conversations.contact_kind does not exist' };
                }
                return api;
            },
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            gte: (c: string, v: any) => { filas = filas.filter((f) => f[c] >= v); return api; },
            lt: (c: string, v: any) => { filas = filas.filter((f) => f[c] < v); return api; },
            or: () => api,
            order: () => api,
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (c: Fila) => {
                cambios = c;
                if (estado.sinColumnas && Object.keys(c).some((k) => COLS_NUEVAS.test(k))) {
                    error = { code: 'PGRST204', message: "Could not find the 'contact_kind' column" };
                }
                return api;
            },
            upsert: (c: Fila) => { cambios = c; return api; },
            maybeSingle: async () => resolver(true),
            single: async () => resolver(true),
            then: (ok: any, ko: any) => Promise.resolve(resolver(false)).then(ok, ko),
        };
        function resolver(uno: boolean) {
            if (error) return { data: null, error };
            if (cambios && !(cambios as any).integration_id) {
                for (const f of filas) Object.assign(f, cambios);
            }
            if (cambios && (cambios as any).integration_id) {
                const f = { ...(estado.tablas[tabla]?.[0] ?? {}), ...cambios };
                return { data: f, error: null };
            }
            return { data: uno ? filas[0] ?? null : filas, error: null };
        }
        return api;
    }
    return { supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { ...estado.usuario }; next(); },
}));
vi.mock('../services/whatsapp.service', () => ({
    decryptToken: () => 'tok', sendTextMessage: async () => ({ ok: true, waMessageId: 'w' }),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('../services/whatsapp-onboarding.service', () => ({ conectarEscuela: async () => ({ ok: true }) }));

const router = (await import('./whatsapp-admin.routes')).default;

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
        return { status: r.status, json: await r.json() as any };
    } finally {
        server.close();
    }
}

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

beforeEach(() => {
    estado.sinColumnas = false;
    estado.usuario = { id: 'admin-a' };
    estado.tablas = {
        profiles: [{ id: 'admin-a', role: 'parent' }],
        schools: [{ id: A, owner_id: 'admin-a' }, { id: B, owner_id: 'otro' }],
        school_members: [],
        school_whatsapp_integrations: [{ id: 'int-a', school_id: A }],
        whatsapp_settings: [{ integration_id: 'int-a', mode: 'assisted', ai_enabled: false, responder_desconocidos: false }],
        whatsapp_conversations: [
            // Familia: escribió y nadie respondió → pendiente.
            { id: 'c1', school_id: A, contact_kind: 'familia', status: 'open', last_inbound_at: hace(10), last_message_at: hace(10) },
            // Familia: la dueña respondió desde el celular (echo) → no pendiente.
            { id: 'c2', school_id: A, contact_kind: 'familia_sin_cuenta', status: 'open', last_inbound_at: hace(60), last_message_at: hace(30) },
            { id: 'c3', school_id: A, contact_kind: 'desconocido', status: 'open', last_inbound_at: hace(5), last_message_at: hace(5) },
            { id: 'c4', school_id: A, contact_kind: null, status: 'open', last_inbound_at: hace(5), last_message_at: hace(5) },
            { id: 'c5', school_id: A, contact_kind: 'staff', status: 'open', last_inbound_at: hace(5), last_message_at: hace(5) },
            // Cerrada a mano con el último entrante ("ok gracias") → no pendiente.
            { id: 'c6', school_id: A, contact_kind: 'ambiguo', status: 'closed', last_inbound_at: hace(5), last_message_at: hace(5) },
            { id: 'cb', school_id: B, contact_kind: 'familia', status: 'open', last_inbound_at: hace(5), last_message_at: hace(5) },
        ],
        whatsapp_messages: [
            { conversation_id: 'c2', direction: 'outbound', ai_generated: false, wa_timestamp: hace(30), created_at: hace(1) },
        ],
        whatsapp_message_drafts: [],
    };
});

describe('GET /:schoolId/conversaciones', () => {
    it('por defecto devuelve solo familias, con conteos de las tres pestañas', async () => {
        const r = await llamar('GET', `/${A}/conversaciones`);
        expect(r.status).toBe(200);
        expect(r.json.vista).toBe('familias');
        expect(r.json.clasificacion_disponible).toBe(true);
        expect(r.json.conversaciones.map((c: any) => c.id).sort()).toEqual(['c1', 'c2', 'c6']);
        // NULL (sin clasificar) cae en "otros", no en familias.
        expect(r.json.conteos).toEqual({ familias: 3, otros: 3, todas: 6 });
    });

    it('vista=otros trae staff, desconocido y sin clasificar', async () => {
        const r = await llamar('GET', `/${A}/conversaciones?vista=otros`);
        expect(r.json.conversaciones.map((c: any) => c.id).sort()).toEqual(['c3', 'c4', 'c5']);
    });

    it('pendiente: entrante sin respuesta sí; respondida por echo no; cerrada no', async () => {
        const r = await llamar('GET', `/${A}/conversaciones?vista=familias`);
        const p = Object.fromEntries(r.json.conversaciones.map((c: any) => [c.id, c.pendiente]));
        expect(p).toEqual({ c1: true, c2: false, c6: false });
    });

    it('pendiente: el saludo automático de la app (payload.automatico) no cuenta como respuesta', async () => {
        // "Gracias por comunicarte con Dynasty…" 1 min después del entrante de c1.
        estado.tablas.whatsapp_messages.push({ conversation_id: 'c1', direction: 'outbound', ai_generated: false,
            wa_timestamp: hace(9), created_at: hace(9), payload: { to: '573001112233', automatico: true } });
        let r = await llamar('GET', `/${A}/conversaciones`);
        expect(r.json.conversaciones.find((c: any) => c.id === 'c1').pendiente).toBe(true);

        // Después contesta una persona desde el celular: ya no está pendiente.
        estado.tablas.whatsapp_messages.push({ conversation_id: 'c1', direction: 'outbound', ai_generated: false,
            wa_timestamp: hace(8), created_at: hace(8), payload: { to: '573001112233' } });
        r = await llamar('GET', `/${A}/conversaciones`);
        expect(r.json.conversaciones.find((c: any) => c.id === 'c1').pendiente).toBe(false);
    });

    it('es_prospecto: desconocido al que el asistente contestó en el paso de tema escolar', async () => {
        // El mock filtra eq() por nombre de campo: la fila trae la clave tal cual la pide la ruta.
        estado.tablas.whatsapp_messages.push(
            { conversation_id: 'c3', direction: 'outbound', 'payload->>step': 'desconocido_tema_escolar', created_at: hace(4) },
            // A staff nunca se le marca prospecto aunque hubiera el paso.
            { conversation_id: 'c5', direction: 'outbound', 'payload->>step': 'desconocido_tema_escolar', created_at: hace(4) },
        );
        estado.tablas.whatsapp_message_drafts.push(
            { conversation_id: 'c4', status: 'pending', 'tool_context->>step': 'desconocido_tema_escolar' },
        );
        const r = await llamar('GET', `/${A}/conversaciones?vista=todas`);
        const p = Object.fromEntries(r.json.conversaciones.map((c: any) => [c.id, c.es_prospecto]));
        expect(p).toEqual({ c1: false, c2: false, c3: true, c4: true, c5: false, c6: false });
    });

    it('vista inválida → 400', async () => {
        const r = await llamar('GET', `/${A}/conversaciones?vista=amigos`);
        expect(r.status).toBe(400);
    });

    it('sin la migración aplicada no se cae: devuelve todas sin clasificar', async () => {
        estado.sinColumnas = true;
        const r = await llamar('GET', `/${A}/conversaciones`);
        expect(r.status).toBe(200);
        expect(r.json.clasificacion_disponible).toBe(false);
        expect(r.json.vista).toBe('todas');
        expect(r.json.conteos).toBeNull();
        expect(r.json.conversaciones).toHaveLength(6);
        expect(r.json.conversaciones.every((c: any) => c.contact_kind === null)).toBe(true);
    });

    it('quien no administra la escuela → 403', async () => {
        const r = await llamar('GET', `/${B}/conversaciones`);
        expect(r.status).toBe(403);
    });
});

describe('PATCH /:schoolId/conversaciones/:id/tipo', () => {
    it('marca personal y lo devuelve', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/c3/tipo`, { personal: true });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ ok: true, id: 'c3', contact_kind: 'personal' });
    });

    it('desmarcar deja NULL para que se reclasifique', async () => {
        estado.tablas.whatsapp_conversations[2].contact_kind = 'personal';
        const r = await llamar('PATCH', `/${A}/conversaciones/c3/tipo`, { personal: false });
        expect(r.json.contact_kind).toBeNull();
    });

    it('no toca conversaciones de otra escuela (404, sin cambios)', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/cb/tipo`, { personal: true });
        expect(r.status).toBe(404);
        expect(estado.tablas.whatsapp_conversations.find((c) => c.id === 'cb')!.contact_kind).toBe('familia');
    });

    it('body inválido → 400', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/c3/tipo`, { personal: 'si' });
        expect(r.status).toBe(400);
    });

    it('sin la migración → 409 claro, no 500', async () => {
        estado.sinColumnas = true;
        const r = await llamar('PATCH', `/${A}/conversaciones/c3/tipo`, { personal: true });
        expect(r.status).toBe(409);
        expect(r.json.error).toBe('clasificacion_no_disponible');
    });
});

describe('POST /:schoolId/conversaciones/:id/cerrar', () => {
    it("cierra con status 'closed' (valor que el CHECK admite)", async () => {
        const r = await llamar('POST', `/${A}/conversaciones/c1/cerrar`);
        expect(r.status).toBe(200);
        expect(estado.tablas.whatsapp_conversations.find((c) => c.id === 'c1')!.status).toBe('closed');
    });

    it('otra escuela → 404', async () => {
        const r = await llamar('POST', `/${A}/conversaciones/cb/cerrar`);
        expect(r.status).toBe(404);
        expect(estado.tablas.whatsapp_conversations.find((c) => c.id === 'cb')!.status).toBe('open');
    });
});

describe('ajustes: responder_desconocidos', () => {
    it('el GET lo devuelve', async () => {
        const r = await llamar('GET', `/${A}`);
        expect(r.json.ajustes.responder_desconocidos).toBe(false);
    });

    it('el GET no se cae sin la migración (default false)', async () => {
        estado.sinColumnas = true;
        const r = await llamar('GET', `/${A}`);
        expect(r.status).toBe(200);
        expect(r.json.ajustes.responder_desconocidos).toBe(false);
    });

    it('el PATCH lo acepta', async () => {
        const r = await llamar('PATCH', `/${A}/settings`, { responder_desconocidos: true });
        expect(r.status).toBe(200);
        expect(r.json.responder_desconocidos).toBe(true);
    });

    it('el PATCH sin migración: si lo piden → 409; si no, sigue funcionando', async () => {
        estado.sinColumnas = true;
        const pedido = await llamar('PATCH', `/${A}/settings`, { responder_desconocidos: true });
        expect(pedido.status).toBe(409);
        const otro = await llamar('PATCH', `/${A}/settings`, { ai_enabled: true });
        expect(otro.status).toBe(200);
        expect(otro.json.responder_desconocidos).toBe(false);
    });
});
