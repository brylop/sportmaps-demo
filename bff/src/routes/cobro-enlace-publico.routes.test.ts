/**
 * Enlace público de un cobro (/api/v1/public/cobro/:token).
 *
 * Lo que se vigila es lo que se podría romper sin que nadie lo note:
 *   · token mal formado / inexistente → 404 idéntico (sin oráculo);
 *     vencido / revocado → 410.
 *   · el POST paga SOLO el cobro del token, aunque el cuerpo nombre otro.
 *   · cobro ya pagado → se muestra pagado y no se abre checkout.
 *   · escuela sin pasarela → sin pago en línea, con cuentas para transferir.
 *   · pasarela en sandbox → no se ofrece a un enlace público (13 "firma
 *     inválida" en Dynasty, ago-sep 2026).
 *   · la vista no filtra correo/teléfono del acudiente.
 *
 * Cero red y cero base: Supabase y el resolver de pasarela están moqueados.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

type Fila = Record<string, any>;

const estado = vi.hoisted(() => ({
    tablas: {} as Record<string, Fila[]>,
    /** token → fila de la RPC cobro_enlace_publico_resolver */
    tokens: {} as Record<string, Fila>,
    rpcError: null as null | { message: string },
    resolved: null as any,
    inserts: [] as { tabla: string; fila: Fila }[],
    rpcLlamadas: [] as { nombre: string; args: any }[],
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas: Fila[] = [...(estado.tablas[tabla] ?? [])];
        let modo: 'select' | 'update' = 'select';
        let cambios: Fila = {};
        const resultado = () => {
            if (modo === 'update') {
                for (const f of filas) Object.assign(f, cambios);
                return { data: null, error: null };
            }
            return { data: filas, error: null };
        };
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter(f => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter(f => vs.includes(f[c])); return api; },
            gte: (c: string, v: any) => { filas = filas.filter(f => f[c] >= v); return api; },
            lt: (c: string, v: any) => { filas = filas.filter(f => f[c] < v); return api; },
            order: () => api,
            limit: () => api,
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            single: async () => ({ data: filas[0] ?? null, error: filas[0] ? null : { message: 'no rows' } }),
            update: (c: Fila) => { modo = 'update'; cambios = c; return api; },
            insert: async (fila: Fila) => {
                estado.inserts.push({ tabla, fila });
                (estado.tablas[tabla] ??= []).push({ ...fila });
                return { data: null, error: null };
            },
            then: (ok: any, ko: any) => Promise.resolve(resultado()).then(ok, ko),
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (nombre: string, args: any) => {
                estado.rpcLlamadas.push({ nombre, args });
                if (estado.rpcError) return { data: null, error: estado.rpcError };
                if (nombre === 'cobro_enlace_publico_resolver') {
                    const f = estado.tokens[args.p_token];
                    return { data: f ? [f] : [], error: null };
                }
                if (nombre === 'cobro_enlace_publico_emitir') {
                    return { data: [{ enlace_token: 'AbCdEfGhIjKlMnOpQrStUvWx', vence_en: '2026-11-03T00:00:00Z' }], error: null };
                }
                if (nombre === 'school_is_operational') return { data: true, error: null };
                if (nombre === 'is_user_payment_blocked') return { data: { blocked: false }, error: null };
                return { data: null, error: null };
            },
        },
    };
});

vi.mock('../services/payment-provider.resolver', () => ({
    resolveProvider: vi.fn(async () => estado.resolved),
}));

vi.mock('../services/whatsapp-medios-de-pago.service', () => ({
    mediosDePago: vi.fn(async () => ({
        cuentas: [{ tipo: 'Nequi', titular: 'Club Prueba', numero: '3001234567' }],
        enlace_para_pagar: 'https://checkout.wompi.co/l/Hj5s7R',
        link_de_pago: 'https://checkout.wompi.co/l/Hj5s7R',
        instrucciones_del_enlace: 'x',
        puede_enviar_comprobante_por_whatsapp: true,
    })),
}));

const qr = vi.hoisted(() => ({ textos: [] as string[] }));
vi.mock('qrcode', () => ({
    default: {
        toBuffer: vi.fn(async (texto: string) => {
            qr.textos.push(texto);
            return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        }),
    },
}));

import router from './cobro-enlace-publico.routes';
import { emitirTokenCobro, nombreCorto, estadoPublico, montosEnLinea } from '../services/cobro-enlace-publico.service';
import { anunciaComprobante } from '../services/whatsapp-reglas-turno';

const ESCUELA = '2d509571-0000-4000-8000-000000000001';
const COBRO_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const COBRO_B = 'bbbbbbbb-0000-4000-8000-00000000000b';
const TOKEN_A = 'TokenAAAAAAAAAAAAAAAAAAA';   // 24
const TOKEN_VENCIDO = 'TokenVencidoXXXXXXXXXXXX';
const TOKEN_REVOCADO = 'TokenRevocadoXXXXXXXXXXX';
const TOKEN_NO_EXISTE = 'NoExisteNoExisteNoExiste';

const CREDS_PROD = {
    provider: 'wompi', publicKey: 'pub_prod_x', accessToken: 'prv_prod_x', integritySecret: 'prod_integrity_x',
    webhookSecret: 'evt', sandbox: false, isDefault: true, source: 'env',
};

function cobro(id: string, extra: Fila = {}): Fila {
    return {
        id, school_id: ESCUELA, amount: 150000, status: 'pending', concept: 'Mensualidad',
        due_date: '2099-10-05', payment_date: null, period_year: 2026, period_month: 10,
        child_id: 'child-1', user_id: null, parent_id: 'parent-1', unregistered_athlete_id: null,
        requires_review: false, ...extra,
    };
}

let base = '';
let server: http.Server;

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/public/cobro', router);
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/public/cobro`;
});
afterAll(() => { server.close(); });

beforeEach(() => {
    process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV = 'true';
    estado.tablas = {
        payments: [cobro(COBRO_A), cobro(COBRO_B, { amount: 999999, child_id: 'child-2', parent_id: 'parent-2' })],
        children: [
            { id: 'child-1', full_name: 'Samuel Rodríguez Pérez' },
            { id: 'child-2', full_name: 'Otra Persona' },
        ],
        schools: [{ id: ESCUELA, name: 'Club Prueba', logo_url: 'https://x/logo.png' }],
        school_settings: [{ school_id: ESCUELA, online_fee_pct: 5 }],
        school_whatsapp_integrations: [{ school_id: ESCUELA, display_phone_number: '+57 300 111 2233', status: 'active' }],
        profiles: [{ id: 'parent-1', full_name: 'Carolina Pérez', email: 'caro@correo.co', phone: '3009998877' }],
        payment_links: [],
    };
    estado.tokens = {
        [TOKEN_A]: { payment_id: COBRO_A, school_id: ESCUELA, vence_en: '2099-01-01T00:00:00Z', estado: 'vigente' },
        [TOKEN_VENCIDO]: { payment_id: COBRO_A, school_id: ESCUELA, vence_en: '2020-01-01T00:00:00Z', estado: 'vencido' },
        [TOKEN_REVOCADO]: { payment_id: COBRO_A, school_id: ESCUELA, vence_en: '2099-01-01T00:00:00Z', estado: 'revocado' },
    };
    estado.rpcError = null;
    estado.resolved = { ...CREDS_PROD };
    estado.inserts = [];
    estado.rpcLlamadas = [];
});

const get = (t: string) => fetch(`${base}/${t}`);
const pagar = (t: string, body: any = {}) => fetch(`${base}/${t}/pagar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('token inválido / vencido / revocado', () => {
    it('mal formado y no existente responden el MISMO 404, y el mal formado no llega a la base', async () => {
        const a = await get('corto');
        const b = await get(TOKEN_NO_EXISTE);
        expect(a.status).toBe(404);
        expect(b.status).toBe(404);
        expect(await a.json()).toEqual(await b.json());
        expect(estado.rpcLlamadas.filter(l => l.args?.p_token === 'corto')).toHaveLength(0);
    });

    it('vencido → 410 vencido; revocado → 410 revocado (GET y POST)', async () => {
        const v = await get(TOKEN_VENCIDO);
        expect(v.status).toBe(410);
        expect((await v.json()).code).toBe('vencido');
        const r = await pagar(TOKEN_REVOCADO);
        expect(r.status).toBe(410);
        expect((await r.json()).code).toBe('revocado');
        expect(estado.inserts).toHaveLength(0);
    });
});

describe('vista del cobro', () => {
    it('muestra datos mínimos, con recargo en línea y sin datos del acudiente', async () => {
        const res = await get(TOKEN_A);
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const v = await res.json();
        expect(v.escuela).toEqual({ nombre: 'Club Prueba', logoUrl: 'https://x/logo.png' });
        expect(v.deportista).toBe('Samuel R.');
        expect(v.periodo).toBe('octubre 2026');
        expect(v.monto).toBe(150000);
        expect(v.estado).toBe('pendiente');
        expect(v.enLinea).toEqual({ proveedor: 'wompi', recargoPct: 5, recargo: 7500, total: 157500 });
        expect(v.transferencia.cuentas).toHaveLength(1);
        // Link de pago genérico de la escuela (Wompi de Dynasty): convive con el
        // pago en línea propio, que va primero en la página.
        expect(v.transferencia.linkDePago).toBe('https://checkout.wompi.co/l/Hj5s7R');
        expect(v.transferencia.whatsappComprobante).toMatch(/^https:\/\/wa\.me\/573001112233\?text=/);
        // P3 (análisis 2026-10-06): el texto precargado trae la referencia corta
        // del cobro y el bot lo reconoce como anuncio de comprobante.
        const textoWa = decodeURIComponent(String(v.transferencia.whatsappComprobante).split('?text=')[1]);
        expect(textoWa).toContain('(ref. AAAAAAAA)');
        expect(anunciaComprobante(textoWa)).toMatchObject({ tipo: 'precargado', ref: 'aaaaaaaa', periodo: 'octubre 2026' });
        const crudo = JSON.stringify(v);
        expect(crudo).not.toContain('caro@correo.co');
        expect(crudo).not.toContain('3009998877');
        expect(crudo).not.toContain(COBRO_A);
        expect(crudo).not.toContain('999999'); // monto del otro cobro
    });

    it('cobro pagado → estado pagado, sin pago en línea ni cuentas', async () => {
        estado.tablas.payments[0].status = 'paid';
        estado.tablas.payments[0].payment_date = '2026-10-02';
        const v = await (await get(TOKEN_A)).json();
        expect(v.estado).toBe('pagado');
        expect(v.fechaPago).toBe('2026-10-02');
        expect(v.enLinea).toBeNull();
        expect(v.transferencia.cuentas).toHaveLength(0);
        expect(v.transferencia.linkDePago).toBeNull();
    });

    it('escuela sin pasarela → sin pago en línea, con cuentas y comprobante por WhatsApp', async () => {
        estado.resolved = null;
        const v = await (await get(TOKEN_A)).json();
        expect(v.enLinea).toBeNull();
        expect(v.transferencia.cuentas[0].numero).toBe('3001234567');
        expect(v.transferencia.whatsappComprobante).toContain('wa.me');
    });

    it('pasarela en sandbox → no se ofrece en línea al enlace público', async () => {
        estado.resolved = { ...CREDS_PROD, publicKey: 'pub_test_x', sandbox: true };
        const v = await (await get(TOKEN_A)).json();
        expect(v.enLinea).toBeNull();
    });

    it("llaves de ENV ('aggregator') sin PAGO_PUBLICO_PERMITE_LLAVES_ENV → sin pago en línea", async () => {
        delete process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV;
        const v = await (await get(TOKEN_A)).json();
        expect(v.enLinea).toBeNull();
        const res = await pagar(TOKEN_A);
        expect(res.status).toBe(409);
        expect(estado.inserts).toHaveLength(0);
    });

    it("cuenta propia ('school_direct') no necesita el flag de ENV", async () => {
        delete process.env.PAGO_PUBLICO_PERMITE_LLAVES_ENV;
        estado.resolved = { ...CREDS_PROD, source: 'school_direct' };
        const v = await (await get(TOKEN_A)).json();
        expect(v.enLinea?.total).toBe(157500);
    });

    it('sin integrity secret (no se puede firmar sin sesión) → sin pago en línea', async () => {
        estado.resolved = { ...CREDS_PROD, integritySecret: null };
        const v = await (await get(TOKEN_A)).json();
        expect(v.enLinea).toBeNull();
    });
});

describe('POST /:token/pagar', () => {
    it('crea el payment_link del cobro DEL TOKEN aunque el cuerpo nombre otro cobro', async () => {
        const res = await pagar(TOKEN_A, { paymentId: COBRO_B, amount: 1 });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reference).toMatch(/^SCH-/);
        expect(body.amountInCents).toBe(15750000);
        expect(body.publicKey).toBe('pub_prod_x');
        expect(body.signature).toMatch(/^[a-f0-9]{64}$/);
        expect(estado.inserts).toHaveLength(1);
        const link = estado.inserts[0].fila;
        expect(link.payment_id).toBe(COBRO_A);
        expect(link.gross_amount).toBe(157500);
        expect(link.base_amount).toBe(150000);
        expect(link.fee_pct).toBe(5);
        expect(link.payment_provider).toBe('wompi');
    });

    it('reusa el link pending vigente con los mismos montos (no crea otra referencia)', async () => {
        estado.tablas.payment_links.push({
            id: 'l1', payment_id: COBRO_A, payment_provider: 'wompi', status: 'pending',
            provider_reference: 'SCH-PREVIO-ABC', wompi_reference: 'SCH-PREVIO-ABC',
            gross_amount: 157500, base_amount: 150000, fee_pct: 5, expires_at: '2099-01-01T00:00:00Z',
        });
        const res = await pagar(TOKEN_A);
        expect(res.status).toBe(200);
        expect((await res.json()).reference).toBe('SCH-PREVIO-ABC');
        expect(estado.inserts).toHaveLength(0);
    });

    it('cobro ya pagado → 409 ya_pagado, sin escribir', async () => {
        estado.tablas.payments[0].status = 'paid';
        const res = await pagar(TOKEN_A);
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe('ya_pagado');
        expect(estado.inserts).toHaveLength(0);
    });

    it('sin pasarela → 409 sin_pago_en_linea, sin escribir', async () => {
        estado.resolved = null;
        const res = await pagar(TOKEN_A);
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe('sin_pago_en_linea');
        expect(estado.inserts).toHaveLength(0);
    });

    it('cobro con requires_review → 409, sin escribir', async () => {
        estado.tablas.payments[0].requires_review = true;
        const res = await pagar(TOKEN_A);
        expect(res.status).toBe(409);
        expect(estado.inserts).toHaveLength(0);
    });
});

describe('emitirTokenCobro (botón de WhatsApp)', () => {
    it('devuelve el token de la RPC', async () => {
        expect(await emitirTokenCobro(COBRO_A)).toBe('AbCdEfGhIjKlMnOpQrStUvWx');
    });
    it('si la RPC falla (migración sin aplicar) devuelve null → cae al correo', async () => {
        estado.rpcError = { message: 'function cobro_enlace_publico_emitir does not exist' };
        expect(await emitirTokenCobro(COBRO_A)).toBeNull();
    });
});

describe('helpers', () => {
    it('nombreCorto', () => {
        expect(nombreCorto('Samuel Rodríguez Pérez')).toBe('Samuel R.');
        expect(nombreCorto('Samuel')).toBe('Samuel');
        expect(nombreCorto('  ')).toBeNull();
    });
    it('estadoPublico: pending con fecha pasada se ve vencido', () => {
        expect(estadoPublico('pending', '2026-10-01', '2026-10-04')).toBe('vencido');
        expect(estadoPublico('pending', '2026-10-05', '2026-10-04')).toBe('pendiente');
        expect(estadoPublico('awaiting_approval', null, '2026-10-04')).toBe('en_revision');
    });
    it('montosEnLinea = create-session (redondeo al peso)', () => {
        expect(montosEnLinea(180000, 5)).toEqual({ recargo: 9000, total: 189000 });
        expect(montosEnLinea(94500, 3)).toEqual({ recargo: 2835, total: 97335 });
    });
});

describe('GET /:token/qr.png (QR del correo de estado de cuenta)', () => {
    const getQr = (t: string) => fetch(`${base}/${t}/qr.png`);

    beforeEach(() => { qr.textos = []; delete process.env.FAMILIAS_APP_URL; });

    it('token válido → PNG que codifica SOLO la URL pública del enlace', async () => {
        process.env.FRONTEND_URL = 'http://localhost:5173'; // no debe usarse nunca
        const res = await getQr(TOKEN_A);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('image/png');
        expect(qr.textos).toEqual([`https://app.sportmaps.co/p/${TOKEN_A}`]);
        const buf = Buffer.from(await res.arrayBuffer());
        expect(buf.subarray(0, 4).toString('hex')).toBe('89504e47');
        // Nada del cobro en lo que se codifica ni en los encabezados.
        expect(qr.textos[0]).not.toMatch(/150000|Samuel|caro@|3009998877|localhost/);
    });

    it('token mal formado o inexistente → 404 sin cuerpo y sin dibujar', async () => {
        for (const t of ['corto', TOKEN_NO_EXISTE]) {
            const res = await getQr(t);
            expect(res.status).toBe(404);
            expect(await res.text()).toBe('');
        }
        expect(qr.textos).toHaveLength(0);
    });

    it('vencido / revocado → 410', async () => {
        expect((await getQr(TOKEN_VENCIDO)).status).toBe(410);
        expect((await getQr(TOKEN_REVOCADO)).status).toBe(410);
        expect(qr.textos).toHaveLength(0);
    });

    it('FAMILIAS_APP_URL a localhost → 500, nunca un QR a localhost', async () => {
        process.env.FAMILIAS_APP_URL = 'http://localhost:5173';
        const res = await getQr(TOKEN_A);
        expect(res.status).toBe(500);
        expect(qr.textos).toHaveLength(0);
    });

    it('rate limit por token: no pasa de 60 en 15 min', async () => {
        const t = 'TokenRateRateRateRateRat';
        estado.tokens[t] = { payment_id: COBRO_A, school_id: ESCUELA, vence_en: '2099-01-01T00:00:00Z', estado: 'vigente' };
        let ultimo = 0;
        for (let i = 0; i < 61; i++) ultimo = (await getQr(t)).status;
        expect(ultimo).toBe(429);
    });
});

describe('otros cobros del mismo pagador', () => {
    it('lista los otros pendientes del MISMO pagador con su token, sin ids ni datos del acudiente', async () => {
        estado.tablas.payments.push(cobro('cccccccc-0000-4000-8000-00000000000c', { amount: 80000, concept: 'Uniforme', period_month: 9, due_date: '2026-09-10', status: 'overdue' }));
        const v = await (await get(TOKEN_A)).json();
        expect(v.otrosPendientes).toHaveLength(1); // COBRO_B es de otro pagador
        expect(v.otrosPendientes[0]).toMatchObject({ concepto: 'Uniforme', monto: 80000, vencido: true, token: 'AbCdEfGhIjKlMnOpQrStUvWx' });
        const crudo = JSON.stringify(v);
        expect(crudo).not.toContain('cccccccc');
        expect(crudo).not.toContain('999999');
        expect(crudo).not.toContain('caro@correo.co');
    });

    it('expone el QR de pago de la escuela solo si es https', async () => {
        estado.tablas.school_settings[0].payment_qr_url = 'https://cdn.x/qr.jpg';
        expect((await (await get(TOKEN_A)).json()).transferencia.qrEscuelaUrl).toBe('https://cdn.x/qr.jpg');
        estado.tablas.school_settings[0].payment_qr_url = 'javascript:alert(1)';
        expect((await (await get(TOKEN_A)).json()).transferencia.qrEscuelaUrl).toBeNull();
    });
});
