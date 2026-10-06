/**
 * Mejora 9 (2026-10-06): tomar / soltar desde el buzón, y que responder desde
 * el buzón tome la conversación 2 h.
 *
 * Router real sobre una base falsa que FILTRA por eq/in y aplica los UPDATE
 * sobre las filas filtradas (así el `school_id` del filtro se prueba de
 * verdad). Sin red: el envío a Meta y `requireAuth` están moqueados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    usuario: { id: 'admin-1' },
    /** Columnas que «no existen» (migración sin aplicar). */
    columnasFaltantes: [] as string[],
    enviados: [] as string[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        const filtros: ((f: Fila) => boolean)[] = [];
        let cambio: Fila | null = null;
        let columnas = '';
        let limite = Infinity;
        const resolver = () => {
            const faltante = estado.columnasFaltantes.find((c) => columnas.includes(c) || (cambio && c in cambio));
            if (faltante) {
                return { data: null, error: { code: '42703', message: `column whatsapp_conversations.${faltante} does not exist` } };
            }
            const filas = (estado.tablas[tabla] ?? []).filter((f) => filtros.every((p) => p(f)));
            if (cambio) for (const f of filas) Object.assign(f, cambio);
            return { data: filas.slice(0, limite).map((f) => ({ ...f })), error: null };
        };
        const api: any = {
            select: (c = '') => { columnas += c; return api; },
            eq: (col: string, val: any) => { filtros.push((f) => f[col] === val); return api; },
            in: (col: string, vals: any[]) => { filtros.push((f) => vals.includes(f[col])); return api; },
            order: () => api, gte: () => api, is: () => api, not: () => api, or: () => api,
            limit: (n: number) => { limite = n; return api; },
            update: (c: Fila) => { cambio = c; return api; },
            maybeSingle: async () => { const r = resolver(); return { data: r.data?.[0] ?? null, error: r.error }; },
            single: async () => { const r = resolver(); return { data: r.data?.[0] ?? null, error: r.error }; },
            then: (ok: any, err: any) => Promise.resolve(resolver()).then(ok, err),
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { id: estado.usuario.id }; next(); },
}));
vi.mock('../services/whatsapp.service', () => ({
    decryptToken: vi.fn(),
    aFormatoWhatsApp: (t: string) => t,
    sendTextMessage: vi.fn(async (_i: any, _to: string, texto: string) => {
        estado.enviados.push(texto);
        return { ok: true, waMessageId: 'wamid.out' };
    }),
}));
vi.mock('../services/whatsapp-onboarding.service', () => ({ conectarEscuela: vi.fn() }));

import router from './whatsapp-admin.routes';

const ESCUELA = 'school-1';
const OTRA = 'school-2';
const CONV = 'conv-1';
const ahora = () => Date.now();

let server: http.Server;
let base = '';

async function post(path: string, body: unknown = {}) {
    const r = await fetch(`${base}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
}
async function get(path: string) {
    const r = await fetch(`${base}${path}`);
    return { status: r.status, body: await r.json().catch(() => null) };
}
const conv = () => estado.tablas.whatsapp_conversations.find((c) => c.id === CONV)!;

beforeEach(async () => {
    estado.usuario = { id: 'admin-1' };
    estado.columnasFaltantes = [];
    estado.enviados = [];
    estado.tablas = {
        platform_admins: [],
        schools: [{ id: ESCUELA, owner_id: 'owner-1' }, { id: OTRA, owner_id: 'owner-2' }],
        school_members: [{ school_id: ESCUELA, profile_id: 'admin-1', role: 'admin', status: 'active' }],
        profiles: [{ id: 'admin-1', full_name: 'Milena' }],
        school_whatsapp_integrations: [{ id: 'int-1', school_id: ESCUELA }],
        whatsapp_conversations: [{
            id: CONV, school_id: ESCUELA, contact_wa_id: '573001112233', contact_name: 'Acudiente',
            identified: true, status: 'open', last_inbound_at: new Date().toISOString(),
            tomada_por: null, tomada_hasta: null,
        }],
        whatsapp_messages: [],
        whatsapp_message_drafts: [],
    };
    const app = express();
    app.use(express.json());
    app.use('/wa', router);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((r) => server.close(() => r())));

describe('POST tomar / soltar', () => {
    it('tomar: 12 h por defecto, a nombre de quien la toma', async () => {
        const r = await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`);
        expect(r.status).toBe(200);
        expect(conv().tomada_por).toBe('admin-1');
        const horas = (new Date(conv().tomada_hasta).getTime() - ahora()) / 3600_000;
        expect(horas).toBeGreaterThan(11.9);
        expect(horas).toBeLessThanOrEqual(12);
    });

    it('tomar acepta `horas` (1–72) y rechaza fuera de rango', async () => {
        expect((await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`, { horas: 3 })).status).toBe(200);
        const horas = (new Date(conv().tomada_hasta).getTime() - ahora()) / 3600_000;
        expect(horas).toBeGreaterThan(2.9);
        expect(horas).toBeLessThanOrEqual(3);
        expect((await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`, { horas: 500 })).status).toBe(400);
    });

    it('soltar deja las dos columnas en null', async () => {
        await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`);
        const r = await post(`/wa/${ESCUELA}/conversaciones/${CONV}/soltar`);
        expect(r.status).toBe(200);
        expect(conv().tomada_por).toBeNull();
        expect(conv().tomada_hasta).toBeNull();
    });

    it('quien no administra la escuela recibe 403 y no cambia nada', async () => {
        estado.usuario = { id: 'padre-1' };
        expect((await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`)).status).toBe(403);
        expect(conv().tomada_por).toBeNull();
    });

    it('un admin de OTRA escuela no toma una conversación ajena (filtro por school_id)', async () => {
        estado.tablas.school_members.push({ school_id: OTRA, profile_id: 'admin-2', role: 'admin', status: 'active' });
        estado.usuario = { id: 'admin-2' };
        expect((await post(`/wa/${OTRA}/conversaciones/${CONV}/tomar`)).status).toBe(404);
        expect(conv().tomada_por).toBeNull();
    });

    it('sin la migración: 409 toma_no_disponible y la lista dice toma_disponible=false', async () => {
        estado.columnasFaltantes = ['tomada_'];
        expect((await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`)).body?.error).toBe('toma_no_disponible');
        const lista = await get(`/wa/${ESCUELA}/conversaciones?vista=todas`);
        expect(lista.status).toBe(200);
        expect(lista.body.toma_disponible).toBe(false);
    });

    it('la lista y el detalle muestran «Atendida por» con el nombre', async () => {
        await post(`/wa/${ESCUELA}/conversaciones/${CONV}/tomar`);
        const lista = await get(`/wa/${ESCUELA}/conversaciones?vista=todas`);
        expect(lista.body.toma_disponible).toBe(true);
        expect(lista.body.conversaciones[0].toma).toMatchObject({ tomada_por: 'admin-1', tomada_por_nombre: 'Milena' });
        const det = await get(`/wa/${ESCUELA}/conversaciones/${CONV}`);
        expect(det.body.conversacion.toma).toMatchObject({ tomada_por_nombre: 'Milena' });
    });

    it('una toma vencida no se muestra', async () => {
        Object.assign(conv(), { tomada_por: 'admin-1', tomada_hasta: new Date(ahora() - 60_000).toISOString() });
        const lista = await get(`/wa/${ESCUELA}/conversaciones?vista=todas`);
        expect(lista.body.conversaciones[0].toma).toBeNull();
    });
});

describe('responder desde el buzón toma la conversación', () => {
    it('la toma por 2 h', async () => {
        const r = await post(`/wa/${ESCUELA}/conversaciones/${CONV}/responder`, { texto: 'Hola, ya te ayudo' });
        expect(r.status).toBe(201);
        expect(estado.enviados).toEqual(['Hola, ya te ayudo']);
        expect(conv().tomada_por).toBe('admin-1');
        const horas = (new Date(conv().tomada_hasta).getTime() - ahora()) / 3600_000;
        expect(horas).toBeGreaterThan(1.9);
        expect(horas).toBeLessThanOrEqual(2);
    });

    it('no acorta una toma más larga ya vigente', async () => {
        const largo = new Date(ahora() + 10 * 3600_000).toISOString();
        Object.assign(conv(), { tomada_por: 'admin-1', tomada_hasta: largo });
        await post(`/wa/${ESCUELA}/conversaciones/${CONV}/responder`, { texto: 'otra' });
        expect(conv().tomada_hasta).toBe(largo);
    });

    it('sin la migración responde igual (201)', async () => {
        estado.columnasFaltantes = ['tomada_'];
        const r = await post(`/wa/${ESCUELA}/conversaciones/${CONV}/responder`, { texto: 'Hola' });
        expect(r.status).toBe(201);
        expect(estado.enviados).toHaveLength(1);
    });
});
