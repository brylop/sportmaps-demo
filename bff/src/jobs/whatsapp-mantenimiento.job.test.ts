/**
 * Mantenimiento del buzón (Fase A): cierra 'open' inactivas 48 h y expira
 * borradores 'pending' de más de 24 h. Se vigila que sea idempotente y que no
 * pise lo que no le toca (otro status, borradores recientes).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({ tablas: {} as Record<string, Record<string, any>[]> }));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let filas = [...(estado.tablas[tabla] ?? [])];
        let cambios: any = null;
        const api: any = {
            select: () => api,
            eq: (c: string, v: any) => { filas = filas.filter((f) => f[c] === v); return api; },
            in: (c: string, vs: any[]) => { filas = filas.filter((f) => vs.includes(f[c])); return api; },
            lt: (c: string, v: any) => { filas = filas.filter((f) => f[c] < v); return api; },
            // Réplica del filtro de inactividad: last_message_at < corte, o null y updated_at < corte.
            or: (expr: string) => {
                const corte = /last_message_at\.lt\.([^,]+),/.exec(expr)![1];
                filas = filas.filter((f) => (f.last_message_at ? f.last_message_at < corte
                    : f.updated_at < corte));
                return api;
            },
            limit: (n: number) => { filas = filas.slice(0, n); return api; },
            update: (c: any) => { cambios = c; return api; },
            then: (ok: any, ko: any) => {
                if (cambios) for (const f of filas) Object.assign(f, cambios);
                return Promise.resolve({ data: filas.map((f) => ({ id: f.id })), error: null }).then(ok, ko);
            },
        };
        return api;
    }
    return { supabase: { from: (t: string) => builder(t) } };
});

const { runWhatsAppMantenimiento } = await import('./whatsapp-mantenimiento.job');

const AHORA = Date.parse('2026-10-03T12:00:00Z');
const horasAntes = (h: number) => new Date(AHORA - h * 3600_000).toISOString();

beforeEach(() => {
    estado.tablas = {
        whatsapp_conversations: [
            { id: 'vieja', status: 'open', last_message_at: horasAntes(49), updated_at: horasAntes(49) },
            { id: 'reciente', status: 'open', last_message_at: horasAntes(2), updated_at: horasAntes(2) },
            { id: 'sin-mensajes', status: 'open', last_message_at: null, updated_at: horasAntes(72) },
            { id: 'pospuesta', status: 'snoozed', last_message_at: horasAntes(100), updated_at: horasAntes(100) },
        ],
        whatsapp_message_drafts: [
            { id: 'd-viejo', status: 'pending', created_at: horasAntes(25) },
            { id: 'd-nuevo', status: 'pending', created_at: horasAntes(1) },
            { id: 'd-enviado', status: 'sent', created_at: horasAntes(30) },
        ],
    };
});

const statusDe = (t: string, id: string) => estado.tablas[t].find((f) => f.id === id)!.status;

describe('runWhatsAppMantenimiento', () => {
    it('cierra solo las open inactivas 48 h y expira solo los pending de más de 24 h', async () => {
        const r = await runWhatsAppMantenimiento(AHORA);
        expect(r).toEqual({ cerradas: 2, expirados: 1 });
        expect(statusDe('whatsapp_conversations', 'vieja')).toBe('closed');
        expect(statusDe('whatsapp_conversations', 'sin-mensajes')).toBe('closed');
        expect(statusDe('whatsapp_conversations', 'reciente')).toBe('open');
        expect(statusDe('whatsapp_conversations', 'pospuesta')).toBe('snoozed');
        expect(statusDe('whatsapp_message_drafts', 'd-viejo')).toBe('expired');
        expect(statusDe('whatsapp_message_drafts', 'd-nuevo')).toBe('pending');
        expect(statusDe('whatsapp_message_drafts', 'd-enviado')).toBe('sent');
    });

    it('es idempotente: la segunda corrida no toca nada', async () => {
        await runWhatsAppMantenimiento(AHORA);
        const r = await runWhatsAppMantenimiento(AHORA);
        expect(r).toEqual({ cerradas: 0, expirados: 0 });
    });
});
