/**
 * Autorización del facturador electrónico (DIAN) — el control de acceso REAL.
 *
 * Este router entra a la base con service_role, así que RLS no filtra nada: si
 * `canManageFinances()` dice sí, se escriben credenciales del PAC y se quema
 * numeración de la resolución DIAN. Por eso lo que se afirma acá es casi todo
 * "403", no "200": el fail-closed ES la funcionalidad.
 *
 * Los dos agujeros que se cerraron y que estas pruebas vigilan:
 *
 *  1. `canManageFinances` caía a `profiles.role === 'school_admin' || 'owner'`
 *     IGNORANDO el ownerId. Un admin (real o autoasignado) de CUALQUIER escuela
 *     administraba el facturador de TODAS.
 *  2. El escape hatch de `requireAuth` leía `profiles.role` para dar membresía
 *     de plataforma. `authenticated` tiene GRANT de UPDATE sobre esa columna y
 *     la policy es `USING (auth.uid() = id)` — o sea que el propio usuario se
 *     escribía `role='super_admin'` y recibía la escuela que nombrara en
 *     `x-school-id`. Ahora la fuente es `platform_admins`, que el cliente no
 *     puede escribir.
 *
 * Para que las pruebas atrapen la vuelta del bug, cada usuario "atacante"
 * TIENE su fila en `profiles` con el rol privilegiado autoasignado: el código
 * viejo lo habría dejado pasar leyendo justamente esa columna. Si alguien
 * vuelve a mirar `profiles.role`, estas pruebas se ponen rojas.
 *
 * Cero red y cero base: Supabase (incluido `auth.getUser`) está moqueado, y el
 * servicio de emisión también — ninguna prueba de acá puede tocar un PAC.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    /** Base de datos falsa: tabla → filas. Una tabla ausente = cero filas. */
    tablas: {} as Record<string, Record<string, any>[]>,
    /** Usuario que inyecta el requireAuth FALSO con el que se prueba el router. */
    usuarioRouter: { id: '', email: 'quien@test.co' },
    /** token → usuario, para el `auth.getUser` del requireAuth REAL. */
    tokens: {} as Record<string, { id: string; email: string }>,
    /** Efectos que NO deben ocurrir cuando la autorización dice no. */
    llamadas: { emit: [] as string[], backfill: [] as any[], deletes: [] as string[] },
}));

// ─── Supabase moqueado ───────────────────────────────────────────────────────
// El builder FILTRA de verdad en .eq() y en .in(): sin eso, la prueba del
// padre/atleta con membresía activa pasaría por accidente (el filtro real es
// justamente `.in('role', ADMIN_MEMBER_ROLES)`).
vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        const api: any = {
            select: () => api,
            eq: (col: string, val: any) => { filas = filas.filter(f => f[col] === val); return api; },
            in: (col: string, vals: any[]) => { filas = filas.filter(f => vals.includes(f[col])); return api; },
            order: () => api,
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            single: async () => ({ data: filas[0] ?? null, error: null }),
            delete: () => { estado.llamadas.deletes.push(tabla); return api; },
            upsert: () => api,
            insert: () => api,
            then: (ok: any, err: any) => Promise.resolve({ data: filas, error: null }).then(ok, err),
        };
        return api;
    }
    return {
        supabase: {
            from: (tabla: string) => builder(tabla),
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

// La cache de auth no es lo que se prueba acá, y con TTL de 60 s contaminaría
// una prueba con la resolución de la anterior (misma llave usuario::escuela).
// Pass-through: cada request resuelve contra la base falsa del momento.
vi.mock('../utils/authCache', () => ({
    getCachedUser: (_t: string, resolve: any) => resolve(),
    getCachedMembership: (_u: string, _s: any, _t: string, resolve: any) => resolve(),
    invalidateUserAuthCache: () => { },
}));

// Emisión moqueada: registra que la llamaron y NUNCA sale a la red.
vi.mock('../services/invoicing.service', () => ({
    emitInvoiceForPayment: async (paymentId: string) => {
        estado.llamadas.emit.push(paymentId);
        return { ok: true, status: 'sent', number: 'SETP-1' };
    },
    backfillInvoices: async (args: any) => {
        estado.llamadas.backfill.push(args);
        return { emitted: 0, skipped: 0, failed: 0 };
    },
}));

vi.mock('../services/invoicing', () => ({
    listSupportedProviders: () => ['factus'],
}));

// requireAuth FALSO para las pruebas del ROUTER: la identidad ya está
// resuelta, lo que se prueba es la correlación usuario ↔ dueño de la factura.
vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (req: any, _res: any, next: any) => {
        req.user = { ...estado.usuarioRouter };
        next();
    },
    requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const invoicingRouter = (await import('./invoicing.routes')).default;

// El middleware REAL, sin el mock de arriba, para probar el escape hatch.
// Sus dependencias (supabase, authCache) sí siguen moqueadas.
const { requireAuth: requireAuthReal } =
    await vi.importActual<typeof import('../middlewares/authMiddleware')>('../middlewares/authMiddleware');

// ─── Datos ───────────────────────────────────────────────────────────────────

const ESCUELA = 'e0000000-0000-4000-8000-000000000001';
const OTRA_ESCUELA = 'e0000000-0000-4000-8000-000000000002';

const DUENO = 'u0000000-0000-4000-8000-000000000001';
const ADMIN_DE_ESTA = 'u0000000-0000-4000-8000-000000000002';
const ADMIN_DE_OTRA = 'u0000000-0000-4000-8000-000000000003';
const SUPER_AUTOASIGNADO = 'u0000000-0000-4000-8000-000000000004';
const PLATAFORMA_ACTIVO = 'u0000000-0000-4000-8000-000000000005';
const PLATAFORMA_INACTIVO = 'u0000000-0000-4000-8000-000000000006';
const PADRE_PAGADOR = 'u0000000-0000-4000-8000-000000000007';
const TERCERO = 'u0000000-0000-4000-8000-000000000008';
const VENDEDOR = 'u0000000-0000-4000-8000-000000000009';
const ORGANIZADOR = 'u0000000-0000-4000-8000-000000000010';
/** Sin ninguna relación: ni dueño, ni miembro, ni plataforma. Se le va poniendo el rol autoasignado. */
const AJENO = 'u0000000-0000-4000-8000-000000000011';
/** profiles.role='admin' autoasignado — el bypass GLOBAL del chequeo viejo. */
const ADMIN_GLOBAL_FALSO = 'u0000000-0000-4000-8000-000000000012';

const VENDOR_PROFILE = 'v0000000-0000-4000-8000-000000000001';
const PAGO = 'p0000000-0000-4000-8000-000000000001';
const PROVEEDOR_ID = 'f0000000-0000-4000-8000-000000000001';

let server: http.Server;
let baseUrl: string;

beforeEach(async () => {
    estado.tablas = {
        schools: [
            { id: ESCUELA, owner_id: DUENO },
            { id: OTRA_ESCUELA, owner_id: TERCERO },
        ],
        school_members: [
            { school_id: ESCUELA, profile_id: ADMIN_DE_ESTA, role: 'school_admin', status: 'active', branch_id: null, joined_at: '2026-01-01' },
            { school_id: OTRA_ESCUELA, profile_id: ADMIN_DE_OTRA, role: 'school_admin', status: 'active', branch_id: null, joined_at: '2026-01-01' },
        ],
        platform_admins: [
            { profile_id: PLATAFORMA_ACTIVO, is_active: true },
            { profile_id: PLATAFORMA_INACTIVO, is_active: false },
        ],
        // Roles autoasignados: el código viejo leía ESTA tabla —
        // `profiles.role === 'admin'` como bypass global y
        // `'school_admin' || 'owner'` como bypass por escuela— y por eso todos
        // los "atacantes" de abajo pasaban. Estas filas existen para que las
        // pruebas se pongan rojas si alguien vuelve a confiar en esa columna.
        profiles: [
            { id: SUPER_AUTOASIGNADO, role: 'super_admin' },
            { id: ADMIN_GLOBAL_FALSO, role: 'admin' },
            { id: ADMIN_DE_OTRA, role: 'school_admin' },
            { id: PLATAFORMA_INACTIVO, role: 'super_admin' },
            { id: TERCERO, role: 'school_admin' },
            { id: DUENO, role: 'school' },
            { id: ADMIN_DE_ESTA, role: 'school_admin' },
        ],
        electronic_invoice_providers: [
            { id: PROVEEDOR_ID, owner_type: 'school', owner_id: ESCUELA, provider: 'factus', enabled: true, is_default: true, config: {}, sandbox: true },
        ],
        vendor_profiles: [{ id: VENDOR_PROFILE, user_id: VENDEDOR }],
        payments: [{ id: PAGO, school_id: ESCUELA, status: 'paid', parent_id: PADRE_PAGADOR }],
        electronic_invoices: [
            { id: 'inv-1', owner_type: 'school', owner_id: ESCUELA, payment_id: PAGO, number: 'SETP-1', status: 'sent' },
        ],
    };
    estado.usuarioRouter = { id: DUENO, email: 'quien@test.co' };
    estado.tokens = {};
    estado.llamadas = { emit: [], backfill: [], deletes: [] };

    const app = express();
    app.use(express.json());
    app.use('/api/v1/invoicing', invoicingRouter);
    // Sonda del middleware REAL: refleja lo que requireAuth dejó en el request.
    app.get('/sonda', requireAuthReal, (req: any, res) =>
        res.status(200).json({ userId: req.user.id, role: req.role, schoolId: req.schoolId }));
    app.use((err: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ error: err?.message ?? 'boom' }));

    server = http.createServer(app);
    await new Promise<void>(resolve => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
});

/** Corre la petición COMO ese usuario (identidad ya resuelta). */
async function como(userId: string, path: string, init: RequestInit = {}) {
    estado.usuarioRouter = { id: userId, email: `${userId}@test.co` };
    const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    return { status: res.status, body: await res.json() as any };
}

/** Sonda del requireAuth real: token válido + header de escuela opcional. */
async function sonda(userId: string | null, schoolId?: string) {
    const token = 'tok-' + (userId ?? 'invalido');
    if (userId) estado.tokens[token] = { id: userId, email: `${userId}@test.co` };
    const res = await fetch(`${baseUrl}/sonda`, {
        headers: {
            Authorization: `Bearer ${token}`,
            ...(schoolId ? { 'x-school-id': schoolId } : {}),
        },
    });
    return { status: res.status, body: await res.json() as any };
}

const providersDeEstaEscuela = `/api/v1/invoicing/providers/school/${ESCUELA}`;

// ─────────────────────────────────────────────────────────────────────────────
describe('canManageFinances — quién administra el facturador de una escuela', () => {
    it('el dueño de la escuela entra aunque no tenga fila en school_members', async () => {
        // Son 64 dueños reales sin fila de membresía: sin este camino, el
        // facturador queda inoperable para ellos.
        const { status, body } = await como(DUENO, providersDeEstaEscuela);
        expect(status).toBe(200);
        expect(body.providers).toHaveLength(1);
    });

    it('un admin con membresía activa en ESA escuela entra', async () => {
        const { status } = await como(ADMIN_DE_ESTA, providersDeEstaEscuela);
        expect(status).toBe(200);
    });

    it('un admin de OTRA escuela NO ve el facturador de esta escuela', async () => {
        // LA prueba del módulo. El chequeo viejo era `profiles.role ===
        // 'school_admin'` sin mirar ownerId: este usuario (school_admin real de
        // OTRA_ESCUELA, y con esa misma fila en profiles) recibía 200 y las
        // credenciales del PAC de todas las escuelas de la plataforma.
        const { status, body } = await como(ADMIN_DE_OTRA, providersDeEstaEscuela);
        expect(status).toBe(403);
        expect(body.error).toBe('forbidden');
        expect(body.providers).toBeUndefined();
    });

    it.each(['parent', 'athlete', 'coach'])(
        "una membresía activa con rol '%s' no administra el facturador",
        async (rol) => {
            // Lo que OTORGA permisos no se delega: la lista es la de
            // user_admin_school_ids(), no la de staff.
            estado.tablas.school_members.push({
                school_id: ESCUELA, profile_id: TERCERO, role: rol, status: 'active', joined_at: '2026-01-01',
            });
            const { status } = await como(TERCERO, providersDeEstaEscuela);
            expect(status).toBe(403);
        },
    );

    it.each(['admin', 'owner', 'school_admin', 'super_admin'])(
        "un profiles.role='%s' autoasignado, sin membresía ni platform_admins, no administra el facturador",
        async (rol) => {
            // El vector exacto de la escalada: `authenticated` tiene GRANT de
            // UPDATE sobre profiles.role y la policy `USING (auth.uid() = id)`
            // ata la FILA pero no la COLUMNA. Un rol autoasignado no es una
            // credencial. Los tres primeros valores son los que el chequeo
            // viejo aceptaba; 'super_admin' se afirma para que la nueva
            // isPlatformAdmin() no vuelva a leer esta columna.
            estado.tablas.profiles.push({ id: AJENO, role: rol });
            const { status } = await como(AJENO, providersDeEstaEscuela);
            expect(status).toBe(403);
        },
    );

    it('quien está en platform_admins con is_active=true administra cualquier facturador', async () => {
        // El fix ABRE este camino: el super admin real recibía 403 en su propio
        // panel porque el chequeo viejo buscaba profiles.role === 'admin' y su
        // rol es 'super_admin'.
        const { status } = await como(PLATAFORMA_ACTIVO, providersDeEstaEscuela);
        expect(status).toBe(200);
    });

    it.each([
        { etiqueta: 'is_active=false', fila: { profile_id: TERCERO, is_active: false } },
        { etiqueta: 'is_active=null', fila: { profile_id: TERCERO, is_active: null } },
        { etiqueta: 'sin la columna is_active', fila: { profile_id: TERCERO } },
    ])('figurar en platform_admins con $etiqueta NO alcanza', async ({ fila }) => {
        // Sin el .eq('is_active', true) del chequeo, una fila desactivada (o a
        // medio crear) volvería a dar alcance de plataforma.
        estado.tablas.platform_admins.push(fila);
        const { status } = await como(TERCERO, providersDeEstaEscuela);
        expect(status).toBe(403);
    });

    it.each(['pending', 'inactive', 'suspended', 'removed'])(
        "una membresía admin con status '%s' no cuenta",
        async (status_) => {
            estado.tablas.school_members.push({
                school_id: ESCUELA, profile_id: TERCERO, role: 'school_admin', status: status_, joined_at: '2026-01-01',
            });
            const { status } = await como(TERCERO, providersDeEstaEscuela);
            expect(status).toBe(403);
        },
    );

    it('una escuela que no existe no autoriza a nadie (owner_id null vs userId undefined)', async () => {
        // Borde: schools devuelve null y school_members no tiene filas. Si el
        // chequeo comparara `school?.owner_id === undefined` con un userId
        // ausente, un id inventado abriría la puerta.
        const { status } = await como(TERCERO, '/api/v1/invoicing/providers/school/e0000000-0000-4000-8000-0000000000ff');
        expect(status).toBe(403);
    });

    it('un ownerType desconocido se rechaza con 400 y no se consulta nada', async () => {
        const { status, body } = await como(PLATAFORMA_ACTIVO, `/api/v1/invoicing/providers/colegio/${ESCUELA}`);
        expect(status).toBe(400);
        expect(body.error).toBe('invalid_owner_type');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('canManageFinances — dueños que no son escuela', () => {
    it('el dueño del vendor_profile administra su propio facturador', async () => {
        const { status } = await como(VENDEDOR, `/api/v1/invoicing/providers/vendor/${VENDOR_PROFILE}`);
        expect(status).toBe(200);
    });

    it("un profiles.role='admin' autoasignado no administra el facturador de un vendor ajeno", async () => {
        // El bypass viejo (isAdminGlobal) era ANTES del switch por ownerType:
        // abría vendor y organizer igual que escuela.
        const { status } = await como(ADMIN_GLOBAL_FALSO, `/api/v1/invoicing/providers/vendor/${VENDOR_PROFILE}`);
        expect(status).toBe(403);
    });

    it('un vendor_profile inexistente no autoriza a nadie', async () => {
        // user_id de una fila ausente es undefined; el usuario tampoco puede
        // ser undefined, pero el borde se afirma explícito.
        const { status } = await como(VENDEDOR, '/api/v1/invoicing/providers/vendor/v0000000-0000-4000-8000-0000000000ff');
        expect(status).toBe(403);
    });

    it('el organizador administra su facturador solo cuando el ownerId es él mismo', async () => {
        const propio = await como(ORGANIZADOR, `/api/v1/invoicing/providers/organizer/${ORGANIZADOR}`);
        expect(propio.status).toBe(200);
        const ajeno = await como(ORGANIZADOR, `/api/v1/invoicing/providers/organizer/${TERCERO}`);
        expect(ajeno.status).toBe(403);
    });

    it("un profiles.role='admin' autoasignado no administra el facturador de un organizador ajeno", async () => {
        const { status } = await como(ADMIN_GLOBAL_FALSO, `/api/v1/invoicing/providers/organizer/${ORGANIZADOR}`);
        expect(status).toBe(403);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /providers/:id — se correlaciona con el dueño de la fila', () => {
    it('un admin de otra escuela no borra el facturador y no se ejecuta el delete', async () => {
        const { status } = await como(ADMIN_DE_OTRA, `/api/v1/invoicing/providers/${PROVEEDOR_ID}`, { method: 'DELETE' });
        expect(status).toBe(403);
        expect(estado.llamadas.deletes).toEqual([]);
    });

    it('el dueño sí borra su facturador', async () => {
        const { status } = await como(DUENO, `/api/v1/invoicing/providers/${PROVEEDOR_ID}`, { method: 'DELETE' });
        expect(status).toBe(200);
        expect(estado.llamadas.deletes).toEqual(['electronic_invoice_providers']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /emit/:paymentId — nadie quema numeración DIAN ajena', () => {
    it('un admin de otra escuela no emite la factura de un pago que no es suyo', async () => {
        const { status } = await como(ADMIN_DE_OTRA, `/api/v1/invoicing/emit/${PAGO}`, { method: 'POST' });
        expect(status).toBe(403);
        expect(estado.llamadas.emit).toEqual([]);
    });

    it("un pago que no está 'paid' no llega al servicio de emisión", async () => {
        // Un número de la resolución DIAN gastado en un cobro pendiente o
        // anulado no se recupera. Antes esta ruta no miraba payments.status.
        estado.tablas.payments = [{ id: PAGO, school_id: ESCUELA, status: 'pending', parent_id: PADRE_PAGADOR }];
        const { status, body } = await como(DUENO, `/api/v1/invoicing/emit/${PAGO}`, { method: 'POST' });
        expect(status).toBe(422);
        expect(body.error).toBe('payment_not_paid');
        expect(estado.llamadas.emit).toEqual([]);
    });

    it("el dueño sí emite un pago 'paid' (si esto no pasara, los 403 de arriba serían vacuos)", async () => {
        const { status } = await como(DUENO, `/api/v1/invoicing/emit/${PAGO}`, { method: 'POST' });
        expect(status).toBe(200);
        expect(estado.llamadas.emit).toEqual([PAGO]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /backfill — el barrido no es una puerta trasera', () => {
    const cuerpo = { method: 'POST', body: JSON.stringify({ from: '2026-08-01', to: '2026-08-31' }) };

    it('un admin de otra escuela no barre la cartera de esta escuela', async () => {
        const { status } = await como(ADMIN_DE_OTRA, `/api/v1/invoicing/backfill/school/${ESCUELA}`, cuerpo);
        expect(status).toBe(403);
        expect(estado.llamadas.backfill).toEqual([]);
    });

    it('con el facturador apagado el barrido responde 409 y no corre', async () => {
        estado.tablas.electronic_invoice_providers = [
            { ...estado.tablas.electronic_invoice_providers[0], enabled: false },
        ];
        const { status, body } = await como(DUENO, `/api/v1/invoicing/backfill/school/${ESCUELA}`, cuerpo);
        expect(status).toBe(409);
        expect(body.error).toBe('invoicing_disabled');
        expect(estado.llamadas.backfill).toEqual([]);
    });

    it('el dueño con facturador encendido sí barre el rango', async () => {
        const { status } = await como(DUENO, `/api/v1/invoicing/backfill/school/${ESCUELA}`, cuerpo);
        expect(status).toBe(200);
        expect(estado.llamadas.backfill).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /by-payment/:paymentId — el pagador ve la suya, nadie más', () => {
    it('el padre que pagó ve la factura de su pago', async () => {
        const { status, body } = await como(PADRE_PAGADOR, `/api/v1/invoicing/by-payment/${PAGO}`);
        expect(status).toBe(200);
        expect(body.invoice.number).toBe('SETP-1');
    });

    it("un tercero con profiles.role='school_admin' autoasignado no ve la factura de un pago ajeno", async () => {
        const { status, body } = await como(TERCERO, `/api/v1/invoicing/by-payment/${PAGO}`);
        expect(status).toBe(403);
        expect(body.invoice).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('requireAuth — el escape hatch de plataforma sale de platform_admins', () => {
    it("profiles.role='super_admin' autoasignado no da membresía de la escuela del header", async () => {
        // El bug: el escape hatch leía profiles.role y devolvía
        // { schoolId: targetSchoolId } — el propio atacante elegía la escuela.
        const { status, body } = await sonda(SUPER_AUTOASIGNADO, ESCUELA);
        expect(status).toBe(403);
        expect(body.schoolId).toBeUndefined();
    });

    it("profiles.role='admin' autoasignado tampoco da membresía de una escuela ajena", async () => {
        // La otra mitad de la lista privilegiada del chequeo viejo era 'admin'.
        const { status, body } = await sonda(ADMIN_GLOBAL_FALSO, ESCUELA);
        expect(status).toBe(403);
        expect(body.schoolId).toBeUndefined();
    });

    it('quien está en platform_admins activo entra como super_admin con la escuela del header', async () => {
        const { status, body } = await sonda(PLATAFORMA_ACTIVO, ESCUELA);
        expect(status).toBe(200);
        expect(body.role).toBe('super_admin');
        expect(body.schoolId).toBe(ESCUELA);
    });

    it('platform_admins con is_active=false no entra por el escape hatch', async () => {
        const { status } = await sonda(PLATAFORMA_INACTIVO, ESCUELA);
        expect(status).toBe(403);
    });

    it('una membresía activa en la escuela del header entra con su rol real', async () => {
        // Control: sin esto, los 403 de arriba podrían venir de una sonda rota.
        const { status, body } = await sonda(ADMIN_DE_ESTA, ESCUELA);
        expect(status).toBe(200);
        expect(body.role).toBe('school_admin');
        expect(body.schoolId).toBe(ESCUELA);
    });

    it('la membresía de OTRA escuela no sirve para la escuela nombrada en el header', async () => {
        const { status } = await sonda(ADMIN_DE_OTRA, ESCUELA);
        expect(status).toBe(403);
    });

    it('un token que Supabase rechaza no llega a consultar permisos', async () => {
        const { status } = await sonda(null, ESCUELA);
        expect(status).toBe(401);
    });
});
