/**
 * Entrantes al número de SportMaps (spec canal-whatsapp-plataforma §3.3, D4,
 * D12): ACTIVAR con código solo desde el número registrado, PAUSAR, silencio
 * con desconocidos (sin guardar su texto) y reintentos de Meta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
    const llamadas: { table: string; ops: [string, any[]][] }[] = [];
    let respuesta: (table: string, ops: [string, any[]][]) => any = () => ({ data: null, error: null });
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        llamadas.push({ table, ops });
        const b: any = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'like', 'order', 'limit', 'update', 'insert', 'upsert']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        b.maybeSingle = () => Promise.resolve(respuesta(table, ops));
        b.single = () => Promise.resolve(respuesta(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(respuesta(table, ops)).then(res, rej);
        return b;
    }
    const enviados: { to: string; texto: string }[] = [];
    return {
        llamadas, enviados,
        setRespuesta: (f: typeof respuesta) => { respuesta = f; },
        supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) },
    };
});
vi.mock('../config/supabase', () => ({ supabase: h.supabase }));
vi.mock('./whatsapp.service', () => ({
    sendTextMessage: vi.fn(async (_i: any, to: string, texto: string) => { h.enviados.push({ to, texto }); return { ok: true, waMessageId: `wamid.out${h.enviados.length}` }; }),
    sendCtaUrl: vi.fn(async (_i: any, to: string, texto: string) => { h.enviados.push({ to, texto }); return { ok: true, waMessageId: `wamid.out${h.enviados.length}` }; }),
    sendRawPayload: vi.fn(async () => ({ ok: true })),
    decryptToken: (x: string) => x,
}));
vi.mock('./plataforma-wa-pruebas.service', () => ({
    atenderPrueba: vi.fn(async () => undefined),
    haySesionDePrueba: vi.fn(async () => false),
}));

import {
    atenderEntrantePlataforma, comandoDeSuscripcion, textoDeActivacion, nuevoCodigo, enlaceDeActivacion,
} from './plataforma-wa-entrante.service';
import { invalidarCanal } from './plataforma-wa.service';
import { atenderPrueba } from './plataforma-wa-pruebas.service';

const CANAL = { phone_number_id: '999', waba_id: '888', display_phone_number: '573202683539', access_token_encrypted: 'gcm:x', status: 'activo' };
const DUEÑA = '573001112233';
const AHORA = Date.parse('2026-10-09T15:00:00.000Z');

function msg(texto: string, de = DUEÑA, id = 'wamid.in1') {
    return {
        phoneNumberId: '999', contactWaId: de, contactName: null, waMessageId: id, type: 'text', textBody: texto,
        waTimestamp: new Date(AHORA).toISOString(), mediaId: null, mediaMimeType: null, mediaCaption: null, raw: {},
    };
}

let pendiente: any;
let duplicado = false;
beforeEach(() => {
    h.llamadas.length = 0;
    h.enviados.length = 0;
    duplicado = false;
    invalidarCanal();
    process.env.PLATFORM_WA_ENABLED = 'true';
    delete process.env.PLATFORM_WA_TESTERS;
    delete process.env.PLATFORM_WA_RESPUESTA_COMERCIAL;
    pendiente = {
        id: 'sub-1', school_id: 'esc-1', profile_id: 'dueña', contact_wa_id: DUEÑA, estado: 'pendiente',
        codigo: 'K7P2QX', codigo_expira_at: new Date(AHORA + 86400_000).toISOString(),
    };
    h.setRespuesta((table, ops) => {
        if (table === 'platform_wa_canal') return { data: CANAL, error: null };
        if (table === 'platform_wa_mensajes' && ops.some(([m]) => m === 'insert')) {
            const fila = ops.find(([m]) => m === 'insert')![1][0];
            if (fila.direccion === 'entrante' && duplicado) return { data: null, error: { code: '23505' } };
            return { data: null, error: null };
        }
        if (table === 'platform_wa_mensajes') return { data: [], error: null };
        if (table === 'platform_wa_suscripciones' && ops.some(([m, a]) => m === 'eq' && a[0] === 'codigo')) return { data: pendiente, error: null };
        if (table === 'platform_wa_suscripciones' && ops.some(([m]) => m === 'update')) return { data: null, error: null };
        if (table === 'platform_wa_suscripciones') return { data: [], error: null };
        if (table === 'platform_wa_escuelas') return { data: { habilitado: true }, error: null };
        if (table === 'schools') return { data: { owner_id: 'dueña', name: 'Escuela Uno' }, error: null };
        if (table === 'school_members') return { data: [], error: null };
        return { data: null, error: null };
    });
});
afterEach(() => { delete process.env.PLATFORM_WA_ENABLED; });

describe('comandoDeSuscripcion', () => {
    it('ACTIVAR con y sin código, y el texto prellenado de la app', () => {
        expect(comandoDeSuscripcion('ACTIVAR')).toEqual({ tipo: 'activar', codigo: null });
        expect(comandoDeSuscripcion('activar k7p2qx')).toEqual({ tipo: 'activar', codigo: 'K7P2QX' });
        expect(comandoDeSuscripcion(textoDeActivacion('Dynasty Volley Club', 'K7P2QX'))).toEqual({ tipo: 'activar', codigo: 'K7P2QX' });
        expect(comandoDeSuscripcion('ACTIVAR AVISOS')).toEqual({ tipo: 'activar', codigo: null });
    });
    it('DESACTIVAR no es ACTIVAR; una negación no activa; charla suelta no es comando', () => {
        expect(comandoDeSuscripcion('DESACTIVAR')).toEqual({ tipo: 'desactivar' });
        expect(comandoDeSuscripcion('Pausar')).toEqual({ tipo: 'desactivar' });
        expect(comandoDeSuscripcion('no quiero activar')).toBeNull();
        expect(comandoDeSuscripcion('hola, cómo activo la cuenta?')).toBeNull();
        expect(comandoDeSuscripcion('ayuda')).toEqual({ tipo: 'ayuda' });
    });
    it('código y enlace wa.me', () => {
        expect(nuevoCodigo()).toMatch(/^[A-Z0-9]{6}$/);
        const url = enlaceDeActivacion('+57 320 268 3539', 'Escuela Uno', 'K7P2QX');
        expect(url.startsWith('https://wa.me/573202683539?text=')).toBe(true);
        expect(comandoDeSuscripcion(decodeURIComponent(url.split('text=')[1]))).toEqual({ tipo: 'activar', codigo: 'K7P2QX' });
    });
});

describe('atenderEntrantePlataforma', () => {
    it('ACTIVAR <código> desde el número registrado: activa con el wa_message_id como prueba', async () => {
        const r = await atenderEntrantePlataforma(msg('Quiero recibir … ACTIVAR K7P2QX') as any, AHORA);
        expect(r).toBe('activada');
        const upd = h.llamadas.find((l) => l.table === 'platform_wa_suscripciones' && l.ops.some(([m]) => m === 'update'))!;
        expect(upd.ops[0][1][0]).toMatchObject({ estado: 'activa', consentimiento_ref: 'wamid.in1', codigo: null });
        expect(h.enviados[0].texto).toMatch(/Listo/);
    });

    it('el mismo código desde OTRO número no activa nada', async () => {
        const r = await atenderEntrantePlataforma(msg('ACTIVAR K7P2QX', '573009998877') as any, AHORA);
        expect(r).toBe('codigo_de_otro_numero');
        expect(h.llamadas.some((l) => l.table === 'platform_wa_suscripciones' && l.ops.some(([m]) => m === 'update'))).toBe(false);
    });

    it('código vencido', async () => {
        pendiente.codigo_expira_at = new Date(AHORA - 1000).toISOString();
        expect(await atenderEntrantePlataforma(msg('ACTIVAR K7P2QX') as any, AHORA)).toBe('codigo_invalido');
    });

    it('PAUSAR revoca todo lo del número', async () => {
        h.setRespuesta((table, ops) => {
            if (table === 'platform_wa_canal') return { data: CANAL, error: null };
            if (table === 'platform_wa_suscripciones' && !ops.some(([m]) => m === 'update')) return { data: [{ ...pendiente, estado: 'activa' }], error: null };
            return { data: null, error: null };
        });
        expect(await atenderEntrantePlataforma(msg('PAUSAR') as any, AHORA)).toBe('desactivada');
        const upd = h.llamadas.find((l) => l.table === 'platform_wa_suscripciones' && l.ops.some(([m]) => m === 'update'))!;
        expect(upd.ops[0][1][0]).toMatchObject({ estado: 'revocada', motivo_revocacion: 'whatsapp' });
    });

    it('desconocido: silencio y su texto NO se guarda', async () => {
        const r = await atenderEntrantePlataforma(msg('Hola, quiero info de SportMaps para mi club', '573005556677') as any, AHORA);
        expect(r).toBe('silencio');
        expect(h.enviados).toHaveLength(0);
        const ins = h.llamadas.find((l) => l.table === 'platform_wa_mensajes' && l.ops.some(([m]) => m === 'insert'))!;
        expect(ins.ops[0][1][0]).toMatchObject({ clase: 'desconocido', texto: null });
    });

    it('reintento de Meta (wa_message_id repetido): no se procesa dos veces', async () => {
        duplicado = true;
        expect(await atenderEntrantePlataforma(msg('ACTIVAR K7P2QX') as any, AHORA)).toBe('duplicado');
        expect(h.enviados).toHaveLength(0);
    });

    it('flag apagado: un no-tester no recibe nada; el tester va al modo pruebas igual', async () => {
        delete process.env.PLATFORM_WA_ENABLED;
        expect(await atenderEntrantePlataforma(msg('ACTIVAR K7P2QX') as any, AHORA)).toBe('apagado');
        process.env.PLATFORM_WA_TESTERS = '573128463555';
        expect(await atenderEntrantePlataforma(msg('/escuela dynasty-volley-club', '573128463555', 'wamid.t1') as any, AHORA)).toBe('prueba');
        expect(atenderPrueba).toHaveBeenCalledTimes(1);
    });
});
