/**
 * Factura electrónica desde el enlace público (/api/v1/public/cobro/:token/factura).
 *
 * El token es la única credencial y el enlace se puede reenviar. Se vigila:
 *   · token mal formado, inexistente o vencido → 404 igual (sin oráculo), y
 *     ni siquiera se llama a la base con un token mal formado;
 *   · el GET devuelve SOLO un resumen enmascarado (últimos 4, correo con •••);
 *   · el PUT escribe por la RPC del TOKEN: el cuerpo no puede elegir a quién
 *     se le guardan los datos (aunque mande profile_id / school_id);
 *   · validación antes de ir a la base: 400 con el mensaje para la familia.
 *
 * La RPC se simula con la misma semántica que la SQL (por_token /
 * guardar_por_token): resuelve el pagador por el cobro del token.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const TOKEN_A = 'TokenAAAAAAAAAAAAAAAAAAA';
const TOKEN_B = 'TokenBBBBBBBBBBBBBBBBBBB';
const TOKEN_VENCIDO = 'TokenVencidoXXXXXXXXXXXX';

const estado = vi.hoisted(() => ({
    llamadas: [] as { nombre: string; args: any }[],
    /** token → pagador (lo que resuelve factura_pagador_de_cobro). */
    pagadorDe: {} as Record<string, string>,
    /** pagador → fila guardada */
    filas: {} as Record<string, any>,
    rpcCaida: false,
}));

vi.mock('../config/supabase', () => ({
    supabase: {
        from: () => { throw new Error('las rutas de factura no leen tablas directo'); },
        rpc: async (nombre: string, args: any) => {
            estado.llamadas.push({ nombre, args });
            if (estado.rpcCaida) return { data: null, error: { message: 'function does not exist' } };
            const pagador = estado.pagadorDe[args.p_token];
            if (nombre === 'factura_pagador_por_token') {
                if (!pagador) return { data: { ok: false, error: 'token_invalido' }, error: null };
                const f = estado.filas[pagador];
                return {
                    data: {
                        ok: true, pagador: true, preferencia: f?.preference ?? 'sin_respuesta',
                        tieneDatos: !!f?.document_number, tipoDocumento: f?.document_type ?? null,
                        documentoTermina: f?.document_number ? f.document_number.slice(-4) : null,
                        correoEnmascarado: f?.invoice_email ? `${f.invoice_email.slice(0, 2)}•••@${f.invoice_email.split('@')[1]}` : null,
                    },
                    error: null,
                };
            }
            if (nombre === 'factura_pagador_guardar_por_token') {
                if (!pagador) return { data: { ok: false, error: 'token_invalido' }, error: null };
                estado.filas[pagador] = {
                    preference: args.p_preferencia, document_type: args.p_tipo,
                    document_number: args.p_numero, legal_name: args.p_nombre, invoice_email: args.p_correo,
                };
                return { data: { ok: true }, error: null };
            }
            return { data: null, error: null };
        },
    },
}));

vi.mock('../services/payment-provider.resolver', () => ({ resolveProvider: vi.fn(async () => null) }));
vi.mock('../services/whatsapp-medios-de-pago.service', () => ({ mediosDePago: vi.fn(async () => ({ cuentas: [] })) }));

import router from './cobro-enlace-publico.routes';

let base = '';
let server: http.Server;

beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/public/cobro', router);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/public/cobro`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(() => {
    estado.llamadas = [];
    estado.pagadorDe = { [TOKEN_A]: 'familia-A', [TOKEN_B]: 'familia-B' };
    estado.filas = {
        'familia-B': {
            preference: 'quiere', document_type: 'CC', document_number: '52825050',
            legal_name: 'Adriana Manrique', invoice_email: 'adriana@correo.com',
        },
    };
    estado.rpcCaida = false;
});

const put = (token: string, body: any) => fetch(`${base}/${token}/factura`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('GET /:token/factura', () => {
    it('token mal formado → 404 sin tocar la base', async () => {
        const r = await fetch(`${base}/corto/factura`);
        expect(r.status).toBe(404);
        expect(estado.llamadas).toHaveLength(0);
    });

    it('token inexistente o vencido → 404 igual', async () => {
        const r = await fetch(`${base}/${TOKEN_VENCIDO}/factura`);
        expect(r.status).toBe(404);
        expect((await r.json()).code).toBe('no_existe');
    });

    it('devuelve solo el resumen enmascarado del pagador DE ESE cobro', async () => {
        const r = await fetch(`${base}/${TOKEN_B}/factura`);
        expect(r.status).toBe(200);
        const j = await r.json();
        expect(j).toMatchObject({ disponible: true, pagador: true, preferencia: 'quiere', documentoTermina: '5050', correoEnmascarado: 'ad•••@correo.com' });
        const crudo = JSON.stringify(j);
        expect(crudo).not.toContain('52825050');
        expect(crudo).not.toContain('Adriana');
        expect(crudo).not.toContain('adriana@');
        expect(r.headers.get('cache-control')).toBe('no-store');
    });

    it('el token de otra familia no ve los datos de esta', async () => {
        const j = await (await fetch(`${base}/${TOKEN_A}/factura`)).json();
        expect(j.tieneDatos).toBe(false);
        expect(j.documentoTermina).toBeNull();
    });

    it('migración sin aplicar → disponible:false (la página esconde el bloque)', async () => {
        estado.rpcCaida = true;
        const j = await (await fetch(`${base}/${TOKEN_A}/factura`)).json();
        expect(j.disponible).toBe(false);
    });
});

describe('PUT /:token/factura', () => {
    it('guarda por el TOKEN: el cuerpo no elige a quién (profile_id/school_id se ignoran)', async () => {
        const r = await put(TOKEN_A, {
            preferencia: 'quiere', tipoDocumento: 'NIT', numeroDocumento: '901.929.705-1',
            nombre: 'Inversiones SAS', correo: 'Conta@Empresa.co',
            profile_id: 'familia-B', school_id: 'otra', p_profile_id: 'familia-B',
        });
        expect(r.status).toBe(200);
        const llamada = estado.llamadas.find((l) => l.nombre === 'factura_pagador_guardar_por_token')!;
        expect(Object.keys(llamada.args).sort()).toEqual([
            'p_ciudad', 'p_correo', 'p_depto', 'p_direccion', 'p_nombre', 'p_numero', 'p_preferencia', 'p_tipo', 'p_token',
        ]);
        expect(llamada.args).toMatchObject({ p_token: TOKEN_A, p_numero: '901929705', p_correo: 'conta@empresa.co' });
        // La familia B quedó intacta.
        expect(estado.filas['familia-B'].document_number).toBe('52825050');
        expect(estado.filas['familia-A'].document_number).toBe('901929705');
    });

    it("'no_quiere' no exige datos", async () => {
        const r = await put(TOKEN_A, { preferencia: 'no_quiere' });
        expect(r.status).toBe(200);
        expect(estado.filas['familia-A'].preference).toBe('no_quiere');
    });

    it('datos inválidos → 400 con el mensaje, sin llamar a la base', async () => {
        const r = await put(TOKEN_A, { preferencia: 'quiere', tipoDocumento: 'CC', numeroDocumento: '12', nombre: 'Ana Gómez' });
        expect(r.status).toBe(400);
        const j = await r.json();
        expect(j.code).toBe('documento_invalido');
        expect(j.error).toMatch(/documento/);
        expect(estado.llamadas).toHaveLength(0);
    });

    it('token vencido → 404', async () => {
        const r = await put(TOKEN_VENCIDO, { preferencia: 'no_quiere' });
        expect(r.status).toBe(404);
    });

    it('base sin la migración → 503 con mensaje amable', async () => {
        estado.rpcCaida = true;
        const r = await put(TOKEN_A, { preferencia: 'no_quiere' });
        expect(r.status).toBe(503);
    });
});
