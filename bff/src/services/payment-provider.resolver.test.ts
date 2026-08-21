/**
 * Tests del resolver de pasarela — la pieza que decide EN QUÉ CUENTA cae la plata.
 *
 * La invariante que importa: las llaves de ENV pertenecen a UNA escuela real, así
 * que solo son legítimas para ella (la que está en 'aggregator'). Cualquier otro
 * camino que termine en ENV le manda el dinero de una escuela a la cuenta
 * comercial de otra. Por eso casi todo acá afirma "devuelve null", no "devuelve
 * credenciales": el fail-closed ES la funcionalidad.
 *
 * `loadProviderConfig` tenía la mitad de estas reglas y caía a ENV donde
 * `resolveProvider` bloqueaba; ahora comparten `leerModoDePago`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Stub de supabase ──────────────────────────────────────────────────────
// Encadena select/eq/order/maybeSingle y filtra por los .eq() aplicados, que es
// todo lo que el resolver usa. `await`ear el builder devuelve el arreglo.

type Fila = Record<string, any>;
let tablas: Record<string, Fila[]> = {};

function builder(tabla: string) {
    let filas = [...(tablas[tabla] ?? [])];
    const api: any = {
        select: () => api,
        eq: (col: string, val: any) => {
            filas = filas.filter(f => f[col] === val);
            return api;
        },
        in: () => api,
        order: () => api,
        maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
        single: async () => ({ data: filas[0] ?? null, error: null }),
        then: (resolve: any) => Promise.resolve({ data: filas, error: null }).then(resolve),
    };
    return api;
}

vi.mock('../config/supabase', () => ({
    supabase: { from: (tabla: string) => builder(tabla) },
}));

// Los secretos se guardan cifrados; acá se devuelven tal cual para no depender
// de PAYMENT_TOKENS_ENC_KEY en el entorno de test.
vi.mock('../utils/payment-crypto', () => ({
    decryptSecretOrNull: (v: string | null) => v ?? null,
    encryptSecret: (v: string) => v,
}));

vi.mock('./mercadopago.service', () => ({
    esCredencialDePrueba: (t?: string) => !!t?.startsWith('TEST-'),
}));

import { resolveProvider, loadProviderConfig } from './payment-provider.resolver';

const ESCUELA = 'aaaaaaaa-0000-4000-8000-000000000001';
const VENDOR = 'bbbbbbbb-0000-4000-8000-000000000002';

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
    tablas = {};
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_ENV';
    process.env.WOMPI_PRIVATE_KEY = 'prv_prod_ENV';
    process.env.WOMPI_EVENTS_SECRET = 'events_ENV';
    process.env.WOMPI_INTEGRITY_SECRET = 'integrity_ENV';
    process.env.MARKETPLACE_DEFAULT_PROVIDER = 'wompi';
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
    vi.restoreAllMocks();
});

/** Escuela con una pasarela propia conectada y sus secretos presentes. */
function conCuentaPropia(modo: string, extra: Partial<Fila> = {}) {
    tablas.schools = [{ id: ESCUELA, payment_mode: modo }];
    tablas.school_payment_providers = [{
        id: 'prov-1',
        school_id: ESCUELA,
        provider: 'wompi',
        public_key: 'pub_prod_PROPIA',
        sandbox: false,
        is_default: true,
        enabled: true,
        connect_status: 'connected',
        ...extra,
    }];
    tablas.payment_provider_secrets = [{
        provider_id: 'prov-1',
        private_key_enc: 'prv_prod_PROPIA',
        integrity_secret_enc: 'integrity_PROPIA',
        events_secret_enc: 'events_PROPIA',
        access_token_enc: null,
        refresh_token_enc: null,
    }];
}

describe('resolveProvider', () => {
    it("'unset' bloquea y NO cae a las llaves de ENV", async () => {
        tablas.schools = [{ id: ESCUELA, payment_mode: 'unset' }];
        expect(await resolveProvider({ schoolId: ESCUELA })).toBeNull();
    });

    it("'direct' sin pasarela habilitada bloquea", async () => {
        tablas.schools = [{ id: ESCUELA, payment_mode: 'direct' }];
        tablas.school_payment_providers = [];
        expect(await resolveProvider({ schoolId: ESCUELA })).toBeNull();
    });

    it("'direct' con secretos ausentes bloquea en vez de caer a ENV", async () => {
        conCuentaPropia('direct');
        tablas.payment_provider_secrets = [];
        expect(await resolveProvider({ schoolId: ESCUELA })).toBeNull();
    });

    it("'direct' devuelve las credenciales PROPIAS, nunca las de ENV", async () => {
        conCuentaPropia('direct');
        const r = await resolveProvider({ schoolId: ESCUELA });
        expect(r?.source).toBe('school_direct');
        expect(r?.accessToken).toBe('prv_prod_PROPIA');
        expect(r?.publicKey).toBe('pub_prod_PROPIA');
        expect(r?.accessToken).not.toBe(process.env.WOMPI_PRIVATE_KEY);
    });

    it("'connected_pending_webhook' SÍ cobra: exigir 'connected' seria un deadlock", async () => {
        conCuentaPropia('direct', { connect_status: 'connected_pending_webhook' });
        expect((await resolveProvider({ schoolId: ESCUELA }))?.source).toBe('school_direct');
    });

    it('un estado de conexión roto bloquea', async () => {
        conCuentaPropia('direct', { connect_status: 'expired' });
        expect(await resolveProvider({ schoolId: ESCUELA })).toBeNull();
    });

    it("'aggregator' es el UNICO camino de escuela que llega a ENV", async () => {
        tablas.schools = [{ id: ESCUELA, payment_mode: 'aggregator' }];
        const r = await resolveProvider({ schoolId: ESCUELA });
        expect(r?.source).toBe('env');
        expect(r?.accessToken).toBe('prv_prod_ENV');
    });

    it('sin escuela ni vendor bloquea: un cobro sin dueño no puede cobrar', async () => {
        expect(await resolveProvider({})).toBeNull();
    });

    it('vendor sin credenciales propias bloquea', async () => {
        tablas.vendor_payment_providers = [];
        expect(await resolveProvider({ vendorId: VENDOR })).toBeNull();
    });
});

describe('loadProviderConfig — mismas reglas que resolveProvider', () => {
    it("'unset' devuelve null (antes caía a ENV)", async () => {
        tablas.schools = [{ id: ESCUELA, payment_mode: 'unset' }];
        expect(await loadProviderConfig({ provider: 'wompi', schoolId: ESCUELA })).toBeNull();
    });

    it("'direct' con secretos ausentes devuelve null (antes caía a ENV: ruteo de dinero ajeno)", async () => {
        conCuentaPropia('direct');
        tablas.payment_provider_secrets = [];
        expect(await loadProviderConfig({ provider: 'wompi', schoolId: ESCUELA })).toBeNull();
    });

    it("'direct' resoluble devuelve las credenciales propias", async () => {
        conCuentaPropia('direct');
        const r = await loadProviderConfig({ provider: 'wompi', schoolId: ESCUELA });
        expect(r?.accessToken).toBe('prv_prod_PROPIA');
    });

    it("'aggregator' sí llega a ENV", async () => {
        tablas.schools = [{ id: ESCUELA, payment_mode: 'aggregator' }];
        expect((await loadProviderConfig({ provider: 'wompi', schoolId: ESCUELA }))?.source).toBe('env');
    });

    it('vendor identificado sin credenciales devuelve null', async () => {
        tablas.vendor_payment_providers = [];
        expect(await loadProviderConfig({ provider: 'wompi', vendorId: VENDOR })).toBeNull();
    });

    it('SIN dueño identificable sí usa ENV: los cobros MP viejos viven en esa cuenta', async () => {
        const r = await loadProviderConfig({ provider: 'wompi' });
        expect(r?.source).toBe('env');
    });
});
