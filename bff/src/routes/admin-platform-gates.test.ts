/**
 * Gates de PLATAFORMA en rutas que leen/escriben datos de TODAS las escuelas.
 *
 * Los agujeros que estas pruebas vigilan (cerrados 2026-10-10):
 *
 *  1. `/api/v1/admin/access-logs` colgaba de requireRole('super_admin','admin').
 *     requireRole deja pasar SIEMPRE a 'owner'/'admin' (PRIVILEGED_ROLES) y,
 *     detrás de requireAuth, esos son roles de MEMBRESÍA: cualquier dueño de
 *     escuela leía los ingresos por torniquete de todas las escuelas.
 *  2. `/api/v1/upgrade-requests`: GET filtraba solo a 'school_admin' → un dueño
 *     veía las solicitudes de todas las escuelas; PATCH/process sin correlación.
 *  3. `/api/v1/payment-providers`: isAdminGlobal() leía `profiles.role IN
 *     ('admin','super_admin')`, y el signup copiaba raw_user_meta_data.role al
 *     perfil: registrarse con {role:'super_admin'} daba la pasarela de TODAS.
 *  4. requireMarketplaceAuth tomaba req.role de profiles.role ('admin' pasa
 *     PRIVILEGED_ROLES en vendor-products / vendor-services).
 *  5. Branding (`GET /schools/:id/branding/audit`): 'owner'/'admin' saltaban el
 *     match de escuela → un dueño leía la bitácora de marca de cualquier escuela.
 *
 * Se usa el requireAuth REAL (supabase y authCache moqueados): la identidad se
 * resuelve por token, como en producción. Cada "atacante" tiene en `profiles`
 * el rol privilegiado autoasignado, para que la prueba se ponga roja si alguien
 * vuelve a confiar en esa columna.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Record<string, any>[]>,
    tokens: {} as Record<string, { id: string; email: string }>,
    updates: [] as { tabla: string; cuerpo: any }[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let esUpdate = false;
        const api: any = {
            select: () => api,
            eq: (col: string, val: any) => { filas = filas.filter(f => f[col] === val); return api; },
            in: (col: string, vals: any[]) => { filas = filas.filter(f => vals.includes(f[col])); return api; },
            order: () => api,
            gte: () => api,
            lt: () => api,
            range: (a: number, b: number) => { filas = filas.slice(a, b + 1); return api; },
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (cuerpo: any) => { esUpdate = true; estado.updates.push({ tabla, cuerpo }); return api; },
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            single: async () => ({ data: filas[0] ?? (esUpdate ? {} : null), error: null }),
            then: (ok: any, err: any) => Promise.resolve({ data: filas, error: null }).then(ok, err),
        };
        return api;
    }
    return {
        supabase: {
            from: (tabla: string) => builder(tabla),
            rpc: async () => ({ data: { ok: true }, error: null }),
            auth: {
                getUser: async (token: string) => {
                    const user = estado.tokens[token];
                    return user
                        ? { data: { user }, error: null }
                        : { data: { user: null }, error: { message: 'invalid token' } };
                },
            },
        },
    };
});

vi.mock('../utils/authCache', () => ({
    getCachedUser: (_t: string, resolve: any) => resolve(),
    getCachedMembership: (_u: string, _s: any, _t: string, resolve: any) => resolve(),
    invalidateUserAuthCache: () => { },
}));

const accessAdminRouter = (await import('./access-admin.routes')).default;
const upgradeRequestsRouter = (await import('./upgrade-requests.routes')).default;
const paymentProvidersRouter = (await import('./payment-providers.routes')).default;
const schoolsRouter = (await import('./schools.routes')).default;
const { requireMarketplaceAuth } = await import('../middlewares/authMiddleware');
const { requirePlatformAdmin } = await import('../middlewares/requirePlatformAdmin');

// ─── Datos ───────────────────────────────────────────────────────────────────
const ESCUELA_A = 'e0000000-0000-4000-8000-00000000000a';
const ESCUELA_B = 'e0000000-0000-4000-8000-00000000000b';

const DUENO_A = 'u0000000-0000-4000-8000-000000000001';      // owner de A
const ADMIN_A = 'u0000000-0000-4000-8000-000000000002';      // membresía 'admin' de A
const PLATAFORMA = 'u0000000-0000-4000-8000-000000000003';   // platform_admins activo
const PADRE_SUPER_FALSO = 'u0000000-0000-4000-8000-000000000004'; // padre en A + profiles.role='admin'
const PLATAFORMA_INACTIVO = 'u0000000-0000-4000-8000-000000000005';

const TOKEN: Record<string, string> = {
    [DUENO_A]: 't-dueno', [ADMIN_A]: 't-admin', [PLATAFORMA]: 't-plat',
    [PADRE_SUPER_FALSO]: 't-padre', [PLATAFORMA_INACTIVO]: 't-plat-off',
};

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
    estado.tablas = {
        schools: [
            { id: ESCUELA_A, owner_id: DUENO_A, name: 'A' },
            { id: ESCUELA_B, owner_id: 'otro', name: 'B' },
        ],
        school_members: [
            { school_id: ESCUELA_A, profile_id: DUENO_A, role: 'owner', status: 'active', branch_id: null, joined_at: '2026-01-01' },
            { school_id: ESCUELA_A, profile_id: ADMIN_A, role: 'admin', status: 'active', branch_id: null, joined_at: '2026-01-01' },
            { school_id: ESCUELA_A, profile_id: PADRE_SUPER_FALSO, role: 'parent', status: 'active', branch_id: null, joined_at: '2026-01-01' },
            { school_id: ESCUELA_A, profile_id: PLATAFORMA_INACTIVO, role: 'parent', status: 'active', branch_id: null, joined_at: '2026-01-01' },
        ],
        platform_admins: [
            { profile_id: PLATAFORMA, is_active: true },
            { profile_id: PLATAFORMA_INACTIVO, is_active: false },
        ],
        profiles: [
            { id: DUENO_A, role: 'school' },
            { id: ADMIN_A, role: 'school' },
            { id: PLATAFORMA, role: 'super_admin' },
            // Lo que dejaba un signup con raw_user_meta_data.role='super_admin'.
            { id: PADRE_SUPER_FALSO, role: 'admin' },
            { id: PLATAFORMA_INACTIVO, role: 'super_admin' },
        ],
        access_events: [
            { id: 'ev-a', school_id: ESCUELA_A, user_id: null, occurred_at: '2026-10-01' },
            { id: 'ev-b', school_id: ESCUELA_B, user_id: null, occurred_at: '2026-10-01' },
        ],
        plan_upgrade_requests: [
            { id: 'ur-a', school_id: ESCUELA_A, status: 'pending' },
            { id: 'ur-b', school_id: ESCUELA_B, status: 'pending' },
        ],
        school_payment_providers: [
            { id: 'pp-b', school_id: ESCUELA_B, provider: 'wompi', is_default: true },
        ],
        payment_provider_secrets: [],
        branding_change_log: [
            { id: 'bl-b', school_id: ESCUELA_B },
        ],
    };
    estado.tokens = Object.fromEntries(
        Object.entries(TOKEN).map(([id, t]) => [t, { id, email: `${id}@test.co` }]),
    );
    estado.updates = [];

    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin/access-logs', accessAdminRouter);
    app.use('/api/v1/upgrade-requests', upgradeRequestsRouter);
    app.use('/api/v1/payment-providers', paymentProvidersRouter);
    app.use('/api/v1/schools', schoolsRouter);
    app.get('/sonda-marketplace', requireMarketplaceAuth, (req: any, res) => res.json({ role: req.role }));
    app.get('/sonda-plataforma', (req: any, _res, next) => { req.user = req.headers['x-user'] ? { id: req.headers['x-user'] } : undefined; next(); },
        requirePlatformAdmin, (_req, res) => res.json({ ok: true }));
    app.use((err: any, _req: any, res: any, _next: any) => res.status(500).json({ error: err?.message ?? 'boom' }));

    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
});

async function pedir(metodo: string, ruta: string, quien: string, body?: any, extra: Record<string, string> = {}) {
    const r = await fetch(baseUrl + ruta, {
        method: metodo,
        headers: { Authorization: `Bearer ${TOKEN[quien]}`, 'Content-Type': 'application/json', ...extra },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try { json = await r.json(); } catch { /* sin cuerpo */ }
    return { status: r.status, json };
}

describe('requirePlatformAdmin', () => {
    it('401 sin usuario, 403 con fila inactiva, 200 con fila activa', async () => {
        expect((await fetch(baseUrl + '/sonda-plataforma')).status).toBe(401);
        expect((await fetch(baseUrl + '/sonda-plataforma', { headers: { 'x-user': PLATAFORMA_INACTIVO } })).status).toBe(403);
        expect((await fetch(baseUrl + '/sonda-plataforma', { headers: { 'x-user': PADRE_SUPER_FALSO } })).status).toBe(403);
        expect((await fetch(baseUrl + '/sonda-plataforma', { headers: { 'x-user': PLATAFORMA } })).status).toBe(200);
    });
});

describe('/api/v1/admin/access-logs — solo plataforma', () => {
    it.each([
        ['dueño de escuela', DUENO_A],
        ['admin de escuela', ADMIN_A],
        ['padre con profiles.role=admin', PADRE_SUPER_FALSO],
    ])('%s → 403 (antes PRIVILEGED_ROLES lo dejaba leer todas las escuelas)', async (_n, quien) => {
        const r = await pedir('GET', '/api/v1/admin/access-logs/events', quien);
        expect(r.status).toBe(403);
    });

    it('admin de plataforma → 200 con eventos de todas las escuelas', async () => {
        const r = await pedir('GET', '/api/v1/admin/access-logs/events', PLATAFORMA);
        expect(r.status).toBe(200);
        expect(r.json.events.map((e: any) => e.id).sort()).toEqual(['ev-a', 'ev-b']);
    });
});

describe('/api/v1/upgrade-requests', () => {
    it('GET como dueño → solo las de SU escuela', async () => {
        const r = await pedir('GET', '/api/v1/upgrade-requests', DUENO_A);
        expect(r.status).toBe(200);
        expect(r.json.requests.map((x: any) => x.id)).toEqual(['ur-a']);
    });

    it('GET como admin de escuela → solo las de SU escuela', async () => {
        const r = await pedir('GET', '/api/v1/upgrade-requests', ADMIN_A);
        expect(r.status).toBe(200);
        expect(r.json.requests.map((x: any) => x.id)).toEqual(['ur-a']);
    });

    it('GET como plataforma → todas', async () => {
        const r = await pedir('GET', '/api/v1/upgrade-requests', PLATAFORMA);
        expect(r.status).toBe(200);
        expect(r.json.requests.map((x: any) => x.id).sort()).toEqual(['ur-a', 'ur-b']);
    });

    it('PATCH como dueño → 403 y no escribe', async () => {
        const r = await pedir('PATCH', '/api/v1/upgrade-requests/ur-b', DUENO_A, { status: 'rejected' });
        expect(r.status).toBe(403);
        expect(estado.updates).toHaveLength(0);
    });

    it('POST /process como admin de escuela → 403', async () => {
        const r = await pedir('POST', '/api/v1/upgrade-requests/ur-b/process', ADMIN_A, {});
        expect(r.status).toBe(403);
    });

    it('PATCH como plataforma → 200', async () => {
        const r = await pedir('PATCH', '/api/v1/upgrade-requests/ur-b', PLATAFORMA, { status: 'contacted' });
        expect(r.status).toBe(200);
        expect(estado.updates.map(u => u.tabla)).toEqual(['plan_upgrade_requests']);
    });
});

describe('/api/v1/payment-providers — isAdminGlobal por platform_admins', () => {
    it('padre con profiles.role=admin NO lee la pasarela de otra escuela', async () => {
        const r = await pedir('GET', `/api/v1/payment-providers/school/${ESCUELA_B}`, PADRE_SUPER_FALSO);
        expect(r.status).toBe(403);
    });

    it('plataforma (fila inactiva) tampoco', async () => {
        const r = await pedir('GET', `/api/v1/payment-providers/school/${ESCUELA_B}`, PLATAFORMA_INACTIVO);
        expect(r.status).toBe(403);
    });

    it('plataforma activa sí', async () => {
        const r = await pedir('GET', `/api/v1/payment-providers/school/${ESCUELA_B}`, PLATAFORMA);
        expect(r.status).toBe(200);
        expect(r.json.providers.map((p: any) => p.id)).toEqual(['pp-b']);
    });

    it('el dueño sigue leyendo la de SU escuela', async () => {
        estado.tablas.school_payment_providers.push({ id: 'pp-a', school_id: ESCUELA_A, provider: 'wompi' });
        const r = await pedir('GET', `/api/v1/payment-providers/school/${ESCUELA_A}`, DUENO_A);
        expect(r.status).toBe(200);
    });
});

describe('requireMarketplaceAuth — profiles.role no da privilegio', () => {
    it("profiles.role='admin' sin platform_admins → req.role 'athlete'", async () => {
        const r = await pedir('GET', '/sonda-marketplace', PADRE_SUPER_FALSO);
        expect(r.json.role).toBe('athlete');
    });

    it("profiles.role='super_admin' con fila inactiva → 'athlete'", async () => {
        const r = await pedir('GET', '/sonda-marketplace', PLATAFORMA_INACTIVO);
        expect(r.json.role).toBe('athlete');
    });

    it("plataforma activa → 'super_admin'", async () => {
        const r = await pedir('GET', '/sonda-marketplace', PLATAFORMA);
        expect(r.json.role).toBe('super_admin');
    });

    it('un rol normal pasa tal cual', async () => {
        const r = await pedir('GET', '/sonda-marketplace', DUENO_A);
        expect(r.json.role).toBe('school');
    });
});

describe('GET /api/v1/schools/:id/branding/audit — sin cruce de escuelas', () => {
    it('dueño de A NO lee la bitácora de marca de B', async () => {
        const r = await pedir('GET', `/api/v1/schools/${ESCUELA_B}/branding/audit`, DUENO_A);
        expect(r.status).toBe(403);
    });

    it('admin de A NO lee la de B', async () => {
        const r = await pedir('GET', `/api/v1/schools/${ESCUELA_B}/branding/audit`, ADMIN_A);
        expect(r.status).toBe(403);
    });
});
