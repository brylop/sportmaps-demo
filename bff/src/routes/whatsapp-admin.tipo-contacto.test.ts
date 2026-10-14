/**
 * Tipo de contacto desde el buzón y la bandeja (2026-10-13). Datos inventados.
 *
 * Lo que vigila:
 *  - PATCH …/tipo acepta personal | negocio | otro_club | plataforma | familia
 *    (+ tambien_familia) y la forma vieja { personal }.
 *  - Al marcar no-familia se cierran en lote las filas abiertas de ESE número
 *    y de ESA escuela, con «cerrado_escuela: descartado — contacto marcado
 *    como … | <motivo previo>», estado ignored.
 *  - Con «también es familia» se quedan las que pueden ser el pago del hijo.
 *  - Volver a «familia» no cierra nada.
 *  - GET /bandeja sugiere marcar (nunca marca) números sin ficha con ráfaga.
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
            like: (c: string, p: string) => {
                const prefijo = p.replace(/%$/, '');
                filas = filas.filter((f) => String(f[c] ?? '').startsWith(prefijo)); return api;
            },
            // Solo «col.ilike.%sufijo» separados por coma (numerosConFicha).
            or: (expr: string) => {
                const conds = expr.split(',').map((x) => {
                    const [col, , patron] = x.split('.');
                    return { col, sufijo: patron.replace(/^%/, '') };
                });
                filas = filas.filter((f) => conds.some((k) => String(f[k.col] ?? '').endsWith(k.sufijo)));
                return api;
            },
            not: () => api,
            order: () => api,
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (c: Fila) => { cambios = c; return api; },
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
            storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
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

const mod = await import('./whatsapp-admin.routes');
const router = mod.default;

const A = 'school-a';
const B = 'school-b';
const PROVEEDOR = '573000000050';
const PAPA = '573000000060';
const OTRO = '573000000070';

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

const base = Date.parse('2026-10-09T19:00:00Z');
const q = (id: string, school_id: string, wa: string, status: string, error_message: string | null, extra: Fila = {}) => ({
    id, school_id, status, error_message, wa_phone_number: wa, message_type: 'image',
    created_at: new Date(base).toISOString(), storage_path: null, result_ref_id: null, matched_child_id: null,
    media_caption: null, ...extra,
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
        payments: [],
        children: [{ id: 'child-1', school_id: A, parent_phone_temp: '3000000070', parent_id: null }],
        unregistered_athletes: [],
        profiles: [],
        whatsapp_conversations: [
            { id: 'conv-prov', school_id: A, integration_id: 'int-a', contact_wa_id: PROVEEDOR, contact_name: 'Pedro', contact_kind: 'desconocido', tambien_familia: false },
            { id: 'conv-papa', school_id: A, integration_id: 'int-a', contact_wa_id: PAPA, contact_name: 'Juan', contact_kind: 'familia', tambien_familia: false },
            { id: 'conv-otro', school_id: A, integration_id: 'int-a', contact_wa_id: OTRO, contact_name: 'Luis', contact_kind: 'desconocido', tambien_familia: false },
        ],
        whatsapp_inbound_queue: [
            ...Array.from({ length: 7 }, (_, i) => q(`prov-${i}`, A, PROVEEDOR, 'ignored', 'contacto_no_atendido',
                { created_at: new Date(base + i * 600_000).toISOString() })),
            q('prov-b', B, PROVEEDOR, 'ignored', 'contacto_no_atendido'),
            q('prov-cerrada', A, PROVEEDOR, 'ignored', 'cerrado_escuela: resuelto — x | contacto_no_atendido'),
            q('papa-foto', A, PAPA, 'ignored', 'sin pagos pendientes'),
            q('papa-cobro', A, PAPA, 'ignored', 'recuperado: varios_cobros — 2 cobros', { matched_child_id: 'child-9' }),
            q('papa-espera', A, PAPA, 'waiting_user', null),
            ...Array.from({ length: 7 }, (_, i) => q(`otro-${i}`, A, OTRO, 'ignored', 'contacto_no_atendido',
                { created_at: new Date(base + i * 600_000).toISOString() })),
        ],
    };
});

const fila = (id: string) => estado.tablas.whatsapp_inbound_queue.find((f) => f.id === id)!;
const conv = (id: string) => estado.tablas.whatsapp_conversations.find((c) => c.id === id)!;

describe('PATCH /:schoolId/conversaciones/:id/tipo', () => {
    it('marca negocio y cierra en lote las abiertas de ese número en esa escuela', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/conv-prov/tipo`, { tipo: 'negocio' });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ ok: true, contact_kind: 'negocio', tambien_familia: false, filas_cerradas: 7 });
        expect(conv('conv-prov')).toMatchObject({ contact_kind: 'negocio', tambien_familia: false });
        expect(fila('prov-0')).toMatchObject({
            status: 'ignored',
            error_message: 'cerrado_escuela: descartado — contacto marcado como negocio (por admin-a) | contacto_no_atendido',
        });
        // La de otra escuela y la ya cerrada no se tocan.
        expect(fila('prov-b').error_message).toBe('contacto_no_atendido');
        expect(fila('prov-cerrada').error_message).toBe('cerrado_escuela: resuelto — x | contacto_no_atendido');
        // Ningún pago tocado.
        expect(estado.escrituras.some((e) => e.tabla === 'payments')).toBe(false);
    });

    it('otro club y plataforma usan su etiqueta', async () => {
        await llamar('PATCH', `/${A}/conversaciones/conv-prov/tipo`, { tipo: 'otro_club' });
        expect(fila('prov-1').error_message).toMatch(/^cerrado_escuela: descartado — contacto marcado como otro club /);
    });

    it('personal + también es familia: deja las que pueden ser el pago del hijo', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/conv-papa/tipo`, { tipo: 'personal', tambien_familia: true });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ contact_kind: 'personal', tambien_familia: true, filas_cerradas: 1 });
        expect(fila('papa-foto').error_message).toMatch(/^cerrado_escuela: descartado — contacto marcado como personal/);
        expect(fila('papa-cobro').error_message).toBe('recuperado: varios_cobros — 2 cobros');
        expect(fila('papa-espera')).toMatchObject({ status: 'waiting_user', error_message: null });
    });

    it('volver a familia limpia la marca y no cierra nada', async () => {
        conv('conv-papa').contact_kind = 'personal';
        conv('conv-papa').tambien_familia = true;
        const r = await llamar('PATCH', `/${A}/conversaciones/conv-papa/tipo`, { tipo: 'familia', tambien_familia: true });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ contact_kind: null, tambien_familia: false, filas_cerradas: 0 });
        expect(fila('papa-foto').error_message).toBe('sin pagos pendientes');
    });

    it('la forma vieja { personal: true } sigue funcionando y también cierra', async () => {
        const r = await llamar('PATCH', `/${A}/conversaciones/conv-prov/tipo`, { personal: true });
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ contact_kind: 'personal', filas_cerradas: 7 });
        expect(conv('conv-prov').tambien_familia).toBe(false);
    });

    it('400 con un tipo que no existe; 403 sin permiso; 404 de otra escuela', async () => {
        expect((await llamar('PATCH', `/${A}/conversaciones/conv-prov/tipo`, { tipo: 'proveedor' })).status).toBe(400);
        expect((await llamar('PATCH', `/${A}/conversaciones/conv-prov/tipo`, { tipo: 'negocio', extra: 1 })).status).toBe(400);
        expect((await llamar('PATCH', `/${B}/conversaciones/conv-prov/tipo`, { tipo: 'negocio' })).status).toBe(403);
        estado.tablas.schools.push({ id: 'school-c', owner_id: 'admin-a' });
        expect((await llamar('PATCH', `/school-c/conversaciones/conv-prov/tipo`, { tipo: 'negocio' })).status).toBe(404);
        expect(fila('prov-0').error_message).toBe('contacto_no_atendido');
    });
});

describe('marcaPedida', () => {
    it('traduce las dos formas', () => {
        expect(mod.marcaPedida({ personal: true })).toEqual({ tipo: 'personal', tambienFamilia: false });
        expect(mod.marcaPedida({ personal: false })).toEqual({ tipo: null, tambienFamilia: false });
        expect(mod.marcaPedida({ tipo: 'plataforma' })).toEqual({ tipo: 'plataforma', tambienFamilia: false });
        expect(mod.marcaPedida({ tipo: 'familia', tambien_familia: true })).toEqual({ tipo: null, tambienFamilia: false });
    });
});

describe('GET /:schoolId/bandeja — marcas y sugerencias', () => {
    it('sugiere el número sin ficha con ráfaga, no el que tiene ficha; no marca nada', async () => {
        const r = await llamar('GET', `/${A}/bandeja`);
        expect(r.status).toBe(200);
        const numeros = r.json.sugerencias_marca.map((s: any) => s.wa_phone_number);
        expect(numeros).toEqual([PROVEEDOR]);           // OTRO está en la ficha de child-1
        expect(r.json.sugerencias_marca[0]).toMatchObject({ motivo: 'rafaga', adjuntos_24h: 7, tipo_sugerido: 'negocio',
            conversacion_id: 'conv-prov' });
        expect(estado.escrituras.some((e) => e.tabla === 'whatsapp_conversations')).toBe(false);
    });

    it('las filas de un contacto marcado no entran ni cuentan', async () => {
        conv('conv-prov').contact_kind = 'negocio';
        const r = await llamar('GET', `/${A}/bandeja`);
        const ids = r.json.filas.map((f: any) => f.id);
        expect(ids.some((id: string) => id.startsWith('prov-'))).toBe(false);
        expect(r.json.resumen.total).toBe(ids.length);
        expect(r.json.sugerencias_marca.map((s: any) => s.wa_phone_number)).not.toContain(PROVEEDOR);
    });

    it('también es familia: lo del cobro se queda en acción, lo demás es informativo', async () => {
        conv('conv-papa').contact_kind = 'personal';
        conv('conv-papa').tambien_familia = true;
        const r = await llamar('GET', `/${A}/bandeja`);
        const por = (id: string) => r.json.filas.find((f: any) => f.id === id);
        expect(por('papa-cobro')).toMatchObject({ grupo: 'accion', tambien_familia: true });
        expect(por('papa-foto').grupo).toBe('informativo');
    });
});
