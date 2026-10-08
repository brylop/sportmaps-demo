/**
 * Consentimiento de WhatsApp (2026-10-08): enlace «ACTIVAR AVISOS» desde
 * /p/:token y el correo, y repregunta a quien ignoró la pregunta.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
    const llamadas: { table: string; ops: [string, any[]][] }[] = [];
    let respuesta: (table: string, ops: [string, any[]][]) => any = () => ({ data: null, count: 0, error: null });
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        llamadas.push({ table, ops });
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'gt', 'gte', 'lt', 'lte', 'or', 'order', 'limit', 'is', 'not', 'update', 'insert']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        b.maybeSingle = () => Promise.resolve(respuesta(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(respuesta(table, ops)).then(res, rej);
        return b;
    }
    return {
        llamadas,
        setRespuesta: (f: typeof respuesta) => { respuesta = f; },
        supabase: { from: (t: string) => builder(t), rpc: vi.fn(async () => ({ data: null, error: null })) },
    };
});
vi.mock('../config/supabase', () => ({ supabase: h.supabase }));

import {
    esActivacionDeAvisos, textoActivarAvisos, enlaceActivarAvisos, enlaceActivarAvisosParaPagador,
} from './whatsapp-activar-avisos';
import {
    consentimientoYaPreguntado, yaSePreguntoConsentimiento, DIAS_PARA_REPREGUNTAR,
} from './whatsapp-bot.service';
import { cuerpoCorreoEstado } from './estado-de-cuenta.service';

beforeEach(() => {
    h.llamadas.length = 0;
    h.setRespuesta(() => ({ data: null, count: 0, error: null }));
});

describe('esActivacionDeAvisos', () => {
    it('el texto prellenado activa, aunque la familia edite el principio', () => {
        expect(esActivacionDeAvisos(textoActivarAvisos('Escuela Uno'))).toBe(true);
        expect(esActivacionDeAvisos('ACTIVAR AVISOS')).toBe(true);
        expect(esActivacionDeAvisos('activar avisos.')).toBe(true);
        expect(esActivacionDeAvisos('Buenas, quiero los avisos. Activar avisos')).toBe(true);
    });
    it('una negación o «activar» suelto NO activan', () => {
        expect(esActivacionDeAvisos('no quiero activar avisos')).toBe(false);
        expect(esActivacionDeAvisos('No. Activar avisos')).toBe(false);
        expect(esActivacionDeAvisos('desactivar avisos')).toBe(false);
        expect(esActivacionDeAvisos('activar')).toBe(false);
        expect(esActivacionDeAvisos('cómo hago para activar avisos en la app?')).toBe(false);
        expect(esActivacionDeAvisos('')).toBe(false);
        expect(esActivacionDeAvisos(null)).toBe(false);
    });
});

describe('enlaceActivarAvisos', () => {
    it('wa.me con el texto codificado', () => {
        const e = enlaceActivarAvisos('+57 300 000 0000', 'Escuela Uno')!;
        expect(e.startsWith('https://wa.me/573000000000?text=')).toBe(true);
        expect(decodeURIComponent(e.split('text=')[1])).toBe(textoActivarAvisos('Escuela Uno'));
    });
    it('sin número de la escuela → null', () => {
        expect(enlaceActivarAvisos(null, 'X')).toBeNull();
        expect(enlaceActivarAvisos('123', 'X')).toBeNull();
    });
});

describe('enlaceActivarAvisosParaPagador', () => {
    const resp = (optin: any) => (table: string) => {
        if (table === 'school_whatsapp_integrations') return { data: { id: 'int-1', display_phone_number: '573000000000' }, error: null };
        if (table === 'profiles') return { data: { phone: '3001112233' }, error: null };
        if (table === 'whatsapp_optins') return { data: optin, error: null };
        return { data: null, error: null };
    };
    it('sin opt-in → enlace; consulta el opt-in del número del perfil', async () => {
        h.setRespuesta(resp(null));
        expect(await enlaceActivarAvisosParaPagador('s-1', 'p-1', 'Escuela Uno')).toMatch(/^https:\/\/wa\.me\//);
        const q = h.llamadas.find((l) => l.table === 'whatsapp_optins')!;
        expect(q.ops).toContainEqual(['eq', ['contact_wa_id', '573001112233']]);
    });
    it('con opt-in vigente → null (no se ofrece lo que ya dio)', async () => {
        h.setRespuesta(resp({ opted_in_at: '2026-10-07T00:00:00Z', opted_out_at: null }));
        expect(await enlaceActivarAvisosParaPagador('s-1', 'p-1', 'Escuela Uno')).toBeNull();
    });
    it('dado de baja → se ofrece (reactivarlo es decisión suya)', async () => {
        h.setRespuesta(resp({ opted_in_at: null, opted_out_at: '2026-10-07T00:00:00Z' }));
        expect(await enlaceActivarAvisosParaPagador('s-1', 'p-1', 'Escuela Uno')).not.toBeNull();
    });
    it('escuela sin WhatsApp activo → null', async () => {
        h.setRespuesta(() => ({ data: null, error: null }));
        expect(await enlaceActivarAvisosParaPagador('s-1', 'p-1', 'Escuela Uno')).toBeNull();
    });
});

describe('repregunta del consentimiento', () => {
    const ahora = Date.parse('2026-10-30T15:00:00Z');
    const haceDias = (d: number) => new Date(ahora - d * 86_400_000).toISOString();

    it('nunca preguntado → no', () => {
        expect(consentimientoYaPreguntado([], false, ahora)).toBe(false);
    });
    it('preguntado hace menos de DIAS_PARA_REPREGUNTAR → sí (no se repite)', () => {
        expect(consentimientoYaPreguntado([haceDias(DIAS_PARA_REPREGUNTAR - 1)], false, ahora)).toBe(true);
    });
    it('ignorado hace más de DIAS_PARA_REPREGUNTAR → se puede volver a preguntar', () => {
        expect(consentimientoYaPreguntado([haceDias(DIAS_PARA_REPREGUNTAR + 1)], false, ahora)).toBe(false);
    });
    it('dijo que no → nunca más', () => {
        expect(consentimientoYaPreguntado([haceDias(60)], true, ahora)).toBe(true);
    });
    it('tope de 3 preguntas (borrador + saliente de la misma hora cuentan como una)', () => {
        const t = Date.parse(haceDias(40));
        const misma = [new Date(t).toISOString(), new Date(t + 60_000).toISOString()];
        expect(consentimientoYaPreguntado([...misma, haceDias(25)], false, ahora)).toBe(false);
        expect(consentimientoYaPreguntado([...misma, haceDias(25), haceDias(20)], false, ahora)).toBe(true);
    });
    it('yaSePreguntoConsentimiento: con un «no» registrado corta sin mirar fechas', async () => {
        h.setRespuesta((table, ops) => {
            const rechazo = ops.some(([m, a]) => m === 'eq' && a[0] === 'payload->>step' && a[1] === 'consent_rechazado');
            return { data: null, count: rechazo ? 1 : 0, error: null };
        });
        expect(await yaSePreguntoConsentimiento('conv-1', ahora)).toBe(true);
        expect(h.llamadas).toHaveLength(1);
    });
    it('yaSePreguntoConsentimiento: pregunta vieja sin respuesta → false', async () => {
        h.setRespuesta((table, ops) => {
            const pregunta = ops.some(([m, a]) => m === 'eq' && a[0] === 'payload->>step' && a[1] === 'ask_consent');
            return { data: pregunta ? [{ created_at: haceDias(20) }] : [], count: 0, error: null };
        });
        expect(await yaSePreguntoConsentimiento('conv-1', ahora)).toBe(false);
    });
});

describe('correo del estado de cuenta', () => {
    const base = {
        escuela: 'Escuela Uno',
        familia: { clave: 'a@b.co', email: 'a@b.co', waId: null, nombre: 'Ana', perfilId: null, filas: [], avisadaHoy: false },
        appBase: 'https://app.example.co', bffBase: 'https://bff.example.co', medios: [], qrEscuelaUrl: null,
        whatsappComprobante: null,
    } as any;
    it('ofrece activar WhatsApp solo si viene el enlace', () => {
        expect(cuerpoCorreoEstado(base)).not.toContain('Actívalos aquí');
        const html = cuerpoCorreoEstado({ ...base, whatsappAvisos: enlaceActivarAvisos('573000000000', 'Escuela Uno') });
        expect(html).toContain('Actívalos aquí');
        expect(html).toContain('https://wa.me/573000000000?text=');
    });
});
