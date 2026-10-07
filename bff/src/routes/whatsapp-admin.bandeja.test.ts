/**
 * Bandeja de comprobantes (2026-10-07): listado agrupado, barrido de lo ya
 * registrado y «Marcar resuelto» / «Descartar».
 *
 * Lo que vigila:
 *  - Solo administración de ESA escuela; una fila de B no se cierra desde A.
 *  - Cerrar es idempotente (409 la segunda vez) y exige motivo.
 *  - El barrido cierra solo `ya_registrado` con pago vivo, sin tocar payments.
 *  - El contador de GET / es el de «requiere acción».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    usuario: { id: 'admin-a' },
    escrituras: [] as { tabla: string; cambios: Fila }[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let cambios: Fila | null = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            is: (c: string, v: any) => { filas = filas.filter((f) => (f[c] ?? null) === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            gte: (c: string, v: any) => { filas = filas.filter((f) => f[c] >= v); return api; },
            order: () => api,
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (c: Fila) => { cambios = c; return api; },
            upsert: (c: Fila) => { cambios = c; return api; },
            maybeSingle: async () => resolver(true),
            single: async () => resolver(true),
            then: (ok: any, ko: any) => Promise.resolve(resolver(false)).then(ok, ko),
        };
        function resolver(uno: boolean) {
            if (cambios) {
                estado.escrituras.push({ tabla, cambios });
                for (const f of filas) Object.assign(f, cambios);
            }
            return { data: uno ? filas[0] ?? null : filas, error: null };
        }
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async () => ({ data: null, error: null }),
            storage: { from: () => ({ createSignedUrls: async (paths: string[]) =>
                ({ data: paths.map((p) => ({ path: p, signedUrl: `https://firmada/${p}` })), error: null }) }) },
        },
    };
});

vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => { req.user = { ...estado.usuario }; next(); },
}));
vi.mock('../services/whatsapp.service', () => ({
    decryptToken: () => 'tok', sendTextMessage: async () => ({ ok: true, waMessageId: 'w' }),
    aFormatoWhatsApp: (t: string) => t,
}));
vi.mock('../services/whatsapp-onboarding.service', () => ({ conectarEscuela: async () => ({ ok: true }) }));
vi.mock('../services/whatsapp-bot.service', () => ({ vocativosDeEscuela: async () => [] }));
vi.mock('../services/whatsapp-ponerse-al-dia.service', () => ({
    contarBorradoresHuerfanos: async () => ({ conversaciones: 0, borradores: 0 }),
    ponerseAlDia: async () => undefined,
}));

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

const q = (id: string, school_id: string, status: string, error_message: string | null, extra: Fila = {}) => ({
    id, school_id, status, error_message, wa_phone_number: '573000000001', message_type: 'image',
    created_at: '2026-10-06T12:00:00Z', storage_path: null, result_ref_id: null, ...extra,
});

beforeEach(() => {
    estado.usuario = { id: 'admin-a' };
    estado.escrituras = [];
    estado.tablas = {
        platform_admins: [],
        schools: [{ id: A, owner_id: 'admin-a' }, { id: B, owner_id: 'otro' }],
        school_members: [],
        school_whatsapp_integrations: [{ id: 'int-a', school_id: A }],
        whatsapp_settings: [{ integration_id: 'int-a', mode: 'auto', ai_enabled: true }],
        whatsapp_messages: [],
        whatsapp_account_events: [],
        whatsapp_conversations: [
            { id: 'conv-1', integration_id: 'int-a', contact_wa_id: '573000000001', contact_name: 'Mamá', contact_kind: 'familia' },
            { id: 'conv-2', integration_id: 'int-a', contact_wa_id: '573000000002', contact_name: 'Lu', contact_kind: 'personal' },
        ],
        payments: [
            { id: 'pay-paid', school_id: A, status: 'paid', concept: 'Mensualidad 10/2026', ocr_reference: null },
            { id: 'pay-anulado', school_id: A, status: 'cancelled', concept: 'Mensualidad 09/2026', ocr_reference: null },
        ],
        whatsapp_inbound_queue: [
            q('f-varios', A, 'ignored', 'recuperado: varios_cobros — 2 cobros', { storage_path: 'A/whatsapp/f-varios.jpeg' }),
            q('f-ruido', A, 'ignored', 'no es un comprobante'),
            q('f-personal', A, 'ignored', 'contacto_no_atendido', { wa_phone_number: '573000000002' }),
            q('f-ya', A, 'ignored', 'recuperado: ya_registrado — ya hay un pago paid', { result_ref_id: 'pay-paid' }),
            q('f-ya-anulado', A, 'ignored', 'recuperado: ya_registrado — x', { result_ref_id: 'pay-anulado' }),
            q('f-esperando', A, 'waiting_user', null),
            q('f-b', B, 'ignored', 'familia_sin_cuenta'),
            q('f-cerrada', A, 'ignored', 'cerrado_escuela: descartado — x | no es un comprobante'),
        ],
    };
});

describe('GET /:schoolId/bandeja', () => {
    it('403 si no administra la escuela', async () => {
        estado.usuario = { id: 'intruso' };
        expect((await llamar('GET', `/${A}/bandeja`)).status).toBe(403);
    });

    it('agrupa, firma miniaturas, enlaza el chat y cierra sola la ya registrada con pago vivo', async () => {
        const r = await llamar('GET', `/${A}/bandeja`);
        expect(r.status).toBe(200);
        const ids = r.json.filas.map((f: any) => f.id);
        // Ni la de otra escuela, ni la ya cerrada, ni la que el barrido cerró.
        expect(ids).not.toContain('f-b');
        expect(ids).not.toContain('f-cerrada');
        expect(ids).not.toContain('f-ya');
        // La del pago anulado se queda: ahí puede faltar plata.
        expect(ids).toContain('f-ya-anulado');
        expect(r.json.cerradas_solas).toBe(1);
        expect(ids[0]).toBe('f-varios');                       // acción primero
        const varios = r.json.filas[0];
        expect(varios.grupo).toBe('accion');
        expect(varios.conversacion_id).toBe('conv-1');
        expect(varios.archivo_url).toBe('https://firmada/A/whatsapp/f-varios.jpeg');
        expect(r.json.filas.find((f: any) => f.id === 'f-personal').grupo).toBe('informativo');
        expect(r.json.resumen).toEqual({ accion: 1, revisar: 1, informativo: 3, total: 5 });

        // El barrido no escribió en payments.
        expect(estado.escrituras.some((e) => e.tabla === 'payments')).toBe(false);
        const ya = estado.tablas.whatsapp_inbound_queue.find((f) => f.id === 'f-ya')!;
        expect(ya.status).toBe('ignored');
        expect(ya.error_message).toMatch(/^cerrado_escuela: resuelto_auto — el pago ya está registrado/);
        expect(ya.error_message).toMatch(/\| recuperado: ya_registrado/);
    });

    it('el barrido es idempotente', async () => {
        await llamar('GET', `/${A}/bandeja`);
        const r2 = await llamar('GET', `/${A}/bandeja`);
        expect(r2.json.cerradas_solas).toBe(0);
    });
});

describe('GET /:schoolId (contador)', () => {
    it('devuelve el resumen: el contador es lo que requiere acción', async () => {
        const r = await llamar('GET', `/${A}`);
        expect(r.status).toBe(200);
        expect(r.json.bandeja_resumen.accion).toBe(1);
        expect(r.json.bandeja.map((f: any) => f.id)).not.toContain('f-cerrada');
    });
});

describe('POST /:schoolId/bandeja/:id/cerrar', () => {
    it('cierra con motivo, conserva el original y pasa waiting_user a ignored', async () => {
        const r = await llamar('POST', `/${A}/bandeja/f-esperando/cerrar`, { accion: 'resuelto', motivo: 'Lo registré en Pagos' });
        expect(r.status).toBe(200);
        const f = estado.tablas.whatsapp_inbound_queue.find((x) => x.id === 'f-esperando')!;
        expect(f.status).toBe('ignored');
        expect(f.error_message).toMatch(/^cerrado_escuela: resuelto — Lo registré en Pagos \(por admin-a\) \| $/);
        // Ya no aparece en la bandeja.
        const l = await llamar('GET', `/${A}/bandeja`);
        expect(l.json.filas.map((x: any) => x.id)).not.toContain('f-esperando');
    });

    it('la segunda vez responde 409', async () => {
        await llamar('POST', `/${A}/bandeja/f-ruido/cerrar`, { accion: 'descartado', motivo: 'foto' });
        const r = await llamar('POST', `/${A}/bandeja/f-ruido/cerrar`, { accion: 'descartado', motivo: 'foto' });
        expect(r.status).toBe(409);
    });

    it('400 sin motivo o con acción inválida', async () => {
        expect((await llamar('POST', `/${A}/bandeja/f-ruido/cerrar`, { accion: 'descartado', motivo: '' })).status).toBe(400);
        expect((await llamar('POST', `/${A}/bandeja/f-ruido/cerrar`, { accion: 'borrar', motivo: 'xxx' })).status).toBe(400);
    });

    it('una fila de otra escuela no se cierra desde la propia (404) ni desde la ajena (403)', async () => {
        expect((await llamar('POST', `/${A}/bandeja/f-b/cerrar`, { accion: 'descartado', motivo: 'xxx' })).status).toBe(404);
        expect((await llamar('POST', `/${B}/bandeja/f-b/cerrar`, { accion: 'descartado', motivo: 'xxx' })).status).toBe(403);
        expect(estado.tablas.whatsapp_inbound_queue.find((x) => x.id === 'f-b')!.error_message).toBe('familia_sin_cuenta');
    });

    it('un miembro coach de la escuela no puede cerrar', async () => {
        estado.usuario = { id: 'coach-a' };
        estado.tablas.school_members = [{ school_id: A, profile_id: 'coach-a', role: 'coach', status: 'active' }];
        expect((await llamar('POST', `/${A}/bandeja/f-ruido/cerrar`, { accion: 'descartado', motivo: 'xxx' })).status).toBe(403);
    });
});
