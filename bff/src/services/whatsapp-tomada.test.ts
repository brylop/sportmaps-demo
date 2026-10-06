/**
 * Mejora 9: la regla de «tomada» y su efecto en `debeAtender` (REAL).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    conv: {} as Record<string, any>,
    errorConv: null as any,
}));

vi.mock('../config/supabase', () => {
    function builder(tabla: string) {
        let columnas = '';
        const api: any = {
            select: (c = '') => { columnas += c; return api; },
            eq: () => api, in: () => api, or: () => api, limit: () => api, update: () => api,
            maybeSingle: async () => {
                if (tabla === 'whatsapp_settings') return { data: { ai_enabled: true, responder_desconocidos: false }, error: null };
                if (tabla === 'whatsapp_conversations') {
                    if (columnas.includes('tomada_') && estado.errorConv) return { data: null, error: estado.errorConv };
                    return { data: { id: 'conv-1', ...estado.conv }, error: null };
                }
                return { data: null, error: null };
            },
            then: (ok: any, err: any) => Promise.resolve({ data: null, error: null }).then(ok, err),
        };
        return api;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: async (fn: string) => fn === 'wa_identify_by_phone'
                ? { data: { estado: 'identificado', parent_id: 'p-1' }, error: null }
                : { data: null, error: null },
        },
    };
});

import { tomadaVigente, conversacionTomada, HORAS_TOMADA_DEFAULT } from './whatsapp-tomada.service';
import { debeAtender } from './whatsapp-atencion.service';

const INTEGRATION = { id: 'int-1', school_id: 'school-1' } as any;
const en = (ms: number) => new Date(Date.now() + ms).toISOString();

beforeEach(() => {
    estado.conv = {};
    estado.errorConv = null;
});

describe('tomadaVigente (pura)', () => {
    it('vigente solo con dueño y fecha futura', () => {
        expect(tomadaVigente({ tomada_por: 'a', tomada_hasta: en(60_000) })).toBe(true);
        expect(tomadaVigente({ tomada_por: 'a', tomada_hasta: en(-60_000) })).toBe(false);
        expect(tomadaVigente({ tomada_por: null, tomada_hasta: en(60_000) })).toBe(false);
        expect(tomadaVigente({ tomada_por: 'a', tomada_hasta: null })).toBe(false);
        expect(tomadaVigente(null)).toBe(false);
    });
    it('default de 12 horas', () => {
        expect(HORAS_TOMADA_DEFAULT).toBe(12);
    });
});

describe('debeAtender con la conversación tomada', () => {
    it('tomada vigente → atender=false y tomada=true (familia, bot prendido)', async () => {
        estado.conv = { tomada_por: 'admin-1', tomada_hasta: en(3600_000) };
        const d = await debeAtender(INTEGRATION, 'conv-1', '573001112233');
        expect(d).toMatchObject({ atender: false, tomada: true, tipo: 'familia', botEncendido: true });
    });

    it('toma vencida → vuelve a atender', async () => {
        estado.conv = { tomada_por: 'admin-1', tomada_hasta: en(-1) };
        const d = await debeAtender(INTEGRATION, 'conv-1', '573001112233');
        expect(d).toMatchObject({ atender: true, tomada: false });
    });

    it('sin la migración (columna inexistente) → se comporta como antes', async () => {
        estado.errorConv = { code: '42703', message: 'column whatsapp_conversations.tomada_por does not exist' };
        expect(await conversacionTomada('conv-1')).toBe(false);
        const d = await debeAtender(INTEGRATION, 'conv-1', '573001112233');
        expect(d).toMatchObject({ atender: true, tomada: false });
    });
});
