/**
 * POST /api/v1/webhooks/resend-inbound — la firma Svix es la puerta.
 * Sin firma válida no se descarga, no se verifica y no se escribe nada.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import crypto from 'crypto';
import type { AddressInfo } from 'net';
import express from 'express';

vi.mock('../config/supabase', () => ({ supabase: {} }));

import { crearRouterResendInbound } from './resend-inbound.routes';
import type { DepsProceso, RepoAvisosBanco } from '../services/banco-correo-cruce.service';

const SECRETO_B64 = Buffer.from('secreto-webhook-de-prueba-123456').toString('base64');
let llamadas: string[];
let server: http.Server;
let base: string;

const repo: RepoAvisosBanco = {
    buzonPorToken: async () => { llamadas.push('buzonPorToken'); return { schoolId: 's1', mailboxes: [] }; },
    flagActivo: async () => { llamadas.push('flagActivo'); return false; },
    avisoPorEntrega: async () => null,
    insertarAviso: async () => { llamadas.push('insertarAviso'); return { id: 'n1' }; },
    pagosCandidatos: async () => [],
    aplicarCruce: async () => 'sin_cruce',
};
const deps: DepsProceso = {
    repo,
    fuente: { mimeCrudo: async () => { llamadas.push('mimeCrudo'); return Buffer.from(''); } },
    dominioEntrada: 'entrada.sportmaps.co',
};

function firmar(id: string, ts: number, cuerpo: string) {
    return 'v1,' + crypto.createHmac('sha256', Buffer.from(SECRETO_B64, 'base64'))
        .update(`${id}.${ts}.${cuerpo}`).digest('base64');
}

async function post(cuerpo: string, cab: Record<string, string>) {
    const r = await fetch(`${base}/api/v1/webhooks/resend-inbound`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...cab }, body: cuerpo,
    });
    return { status: r.status, json: await r.json() };
}

const CUERPO = JSON.stringify({
    type: 'email.received',
    data: { email_id: 'e1', to: ['pagos@gmail.com'], received_for: ['banco+0123456789abcdef0123@entrada.sportmaps.co'] },
});

beforeAll(async () => {
    process.env.RESEND_INBOUND_WEBHOOK_SECRET = `whsec_${SECRETO_B64}`;
    const app = express();
    app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
    app.use('/api/v1/webhooks/resend-inbound', crearRouterResendInbound(() => deps));
    server = app.listen(0);
    await new Promise((ok) => server.once('listening', ok));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());
beforeEach(() => { llamadas = []; });

describe('resend-inbound', () => {
    it('sin cabeceras Svix → 401 y no toca nada', async () => {
        const r = await post(CUERPO, {});
        expect(r.status).toBe(401);
        expect(llamadas).toEqual([]);
    });

    it('firma inválida → 401 y no toca nada', async () => {
        const ts = Math.floor(Date.now() / 1000);
        const r = await post(CUERPO, { 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': 'v1,' + Buffer.alloc(32).toString('base64') });
        expect(r.status).toBe(401);
        expect(llamadas).toEqual([]);
    });

    it('firma de OTRO cuerpo (payload cambiado en tránsito) → 401', async () => {
        const ts = Math.floor(Date.now() / 1000);
        const sig = firmar('msg_1', ts, CUERPO);
        const r = await post(CUERPO.replace('e1', 'e2'), { 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': sig });
        expect(r.status).toBe(401);
        expect(llamadas).toEqual([]);
    });

    it('firma válida → procesa (aquí: flag apagado → ignorado, 200)', async () => {
        const ts = Math.floor(Date.now() / 1000);
        const r = await post(CUERPO, { 'svix-id': 'msg_1', 'svix-timestamp': String(ts), 'svix-signature': firmar('msg_1', ts, CUERPO) });
        expect(r.status).toBe(200);
        expect(r.json).toEqual({ resultado: 'ignorado' });
        expect(llamadas).toEqual(['buzonPorToken', 'flagActivo']);
    });

    it('falla de infraestructura → 500 (Resend reintenta)', async () => {
        const original = repo.flagActivo;
        repo.flagActivo = async () => { throw new Error('db caída'); };
        const ts = Math.floor(Date.now() / 1000);
        const r = await post(CUERPO, { 'svix-id': 'msg_2', 'svix-timestamp': String(ts), 'svix-signature': firmar('msg_2', ts, CUERPO) });
        repo.flagActivo = original;
        expect(r.status).toBe(500);
    });
});
