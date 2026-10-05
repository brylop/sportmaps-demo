/**
 * Regresión de seguridad SEG-26: POST /api/v1/payments/extract-receipt
 * (OWASP LLM 2025: LLM02 divulgación de info sensible; API Top 10: API1 BOLA).
 *
 * Antes, con `schoolId` en el body, el endpoint devolvía
 * `DESTINO_NO_COINCIDE.detail.comparedAgainst` = todas las cuentas bancarias de
 * ESA escuela, así que cualquier autenticado leía las cuentas de cualquier
 * escuela mandando su id. El fix (payments.routes.ts) poda `comparedAgainst`
 * del response: el veredicto sigue viajando, las cuentas no.
 *
 * Este test arrancó como PoC de la vulnerabilidad; ahora afirma que la fuga
 * está cerrada. Si alguien vuelve a filtrar `comparedAgainst`, falla.
 *
 * Cero red externa: Supabase, el OCR y la validación del JWT son mocks. El
 * único HTTP es contra un express local en un puerto efímero.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';

const h = vi.hoisted(() => {
    const state = {
        ocr: null as any,
        tablas: {} as Record<string, Record<string, any>[]>,
    };
    function builder(tabla: string) {
        let filas = [...(state.tablas[tabla] ?? [])];
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            neq: (c: string, v: any) => { filas = filas.filter((f) => f[c] !== v); return api; },
            not: () => api,
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            single: async () => ({ data: filas[0] ?? null, error: null }),
            maybeSingle: async () => ({ data: filas[0] ?? null, error: null }),
            then: (ok: any, ko: any) => Promise.resolve({ data: filas, error: null }).then(ok, ko),
        };
        return api;
    }
    return { state, supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) } };
});

vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('../middlewares/authMiddleware', () => ({
    requireAuth: (_q: any, _s: any, n: any) => n(),
    requireRole: () => (_q: any, _s: any, n: any) => n(),
}));
vi.mock('../services/wompi.service', () => ({}));
vi.mock('../services/mercadopago.service', () => ({ generateMpReference: vi.fn() }));
vi.mock('../services/payment-provider.resolver', () => ({ resolveProvider: vi.fn() }));
vi.mock('../services/ocr.service', () => ({ extractReceipt: vi.fn(async () => h.state.ocr) }));
// El JWT de un usuario cualquiera (un acudiente de OTRA escuela, o una cuenta
// recién creada): getUser lo acepta. No hay consulta de membresía.
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'intruso' } }, error: null }) } }),
}));

import paymentsRouter from './payments.routes';

const ESCUELA_AJENA = '11111111-1111-4111-8111-111111111111';

async function post(body: any) {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/v1/payments', paymentsRouter);
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as AddressInfo;
    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/payments/extract-receipt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-de-cualquiera' },
            body: JSON.stringify(body),
        });
        return { status: res.status, json: await res.json() as any };
    } finally {
        server.close();
    }
}

beforeEach(() => {
    h.state.tablas = {
        school_settings: [{
            school_id: ESCUELA_AJENA, receipt_date_window_days: 5,
            bank_account_number: '478170006942', nequi_number: '3009998877', breb_key: '@escuelaajena',
            payment_accounts: [], transfer_key: null, breb_number: null, daviplata_number: '3105554433',
        }],
        payments: [{ id: 'p-ajeno', school_id: ESCUELA_AJENA, receipt_reference_norm: 'M55556666' }],
    };
    h.state.ocr = {
        amount: 1000, currency: 'COP', date: '2026-10-05', time: null, bank: 'Nequi',
        reference: 'M55556666', destination: '3000000000', destinationName: null, originName: null,
        isReceipt: true, isTransactionList: false, missingFields: [], provider: 'mock',
    };
});

describe('SEG-26: /extract-receipt no filtra las cuentas de la escuela del schoolId', () => {
    it('el veredicto DESTINO_NO_COINCIDE ya NO trae comparedAgainst con las cuentas', async () => {
        const { status, json } = await post({ imageBase64: 'A'.repeat(200), mimeType: 'image/png', schoolId: ESCUELA_AJENA });

        expect(status).toBe(200);
        const destino = (json.verdictReasons ?? []).find((r: any) => r.code === 'DESTINO_NO_COINCIDE');
        // El veredicto sigue presente (la lógica funciona)...
        expect(destino).toBeTruthy();
        // ...pero las cuentas de la escuela ya no viajan al cliente.
        expect(destino?.detail?.comparedAgainst).toBeUndefined();
        // Y por si acaso: ninguna cuenta aparece en TODO el JSON de respuesta.
        const blob = JSON.stringify(json);
        for (const cuenta of ['478170006942', '3009998877', '3105554433']) {
            expect(blob).not.toContain(cuenta);
        }
    });
});
