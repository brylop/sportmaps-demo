/**
 * Canal de plataforma, F1 (spec canal-whatsapp-plataforma): compuertas,
 * horario silencioso, reserva idempotente y elección texto/plantilla.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
    const llamadas: { table: string; ops: [string, any[]][] }[] = [];
    let respuesta: (table: string, ops: [string, any[]][]) => any = () => ({ data: null, error: null });
    function builder(table: string) {
        const ops: [string, any[]][] = [];
        llamadas.push({ table, ops });
        const b: any = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'gte', 'order', 'limit', 'update', 'insert', 'upsert']) {
            b[m] = (...a: any[]) => { ops.push([m, a]); return b; };
        }
        b.maybeSingle = () => Promise.resolve(respuesta(table, ops));
        b.single = () => Promise.resolve(respuesta(table, ops));
        b.then = (res: any, rej: any) => Promise.resolve(respuesta(table, ops)).then(res, rej);
        return b;
    }
    return {
        llamadas,
        setRespuesta: (f: typeof respuesta) => { respuesta = f; },
        supabase: { from: (t: string) => builder(t), rpc: async () => ({ data: null, error: null }) },
    };
});
vi.mock('../config/supabase', () => ({ supabase: h.supabase }));

import {
    avisarPorPlataforma, celularCo, debeSalir, enSilencio, horaColombia, sufijoDeRuta, testersDePlataforma,
    type AvisoPlataforma, type CanalPlataforma,
} from './plataforma-wa.service';
import { conCortafuegos } from '../config/cortafuegos-simulacion';

const CANAL: CanalPlataforma = {
    phone_number_id: '999', waba_id: '888', display_phone_number: '573202683539',
    access_token_encrypted: 'gcm:x', status: 'activo',
};
const SUB = {
    id: 'sub-1', school_id: 'esc-1', profile_id: 'dueña', contact_wa_id: '573001112233', estado: 'activa',
    avisar_comprobantes: true, silencio_desde: 22, silencio_hasta: 7, urgentes_en_silencio: false,
};
const AVISO: AvisoPlataforma = {
    tipo: 'comprobantes', schoolId: 'esc-1', clave: 'comprobantes:esc-1:v3',
    texto: '*2 comprobantes nuevos*', ruta: '/payments-automation?tab=recurrent',
    plantilla: { nombre: 'sm_comprobantes_por_revisar', variables: ['Escuela Uno', '2', '15 min'] },
};
// 2026-10-09 15:00 UTC = 10:00 Colombia.
const DIA = Date.parse('2026-10-09T15:00:00.000Z');
const NOCHE = Date.parse('2026-10-10T04:00:00.000Z'); // 23:00 Colombia

function deps(over: Record<string, any> = {}) {
    return {
        leerCanal: vi.fn(async () => CANAL),
        escuelaHabilitada: vi.fn(async () => true),
        adminsDeEscuela: vi.fn(async () => new Set(['dueña'])),
        ventanaAbiertaCon: vi.fn(async () => false),
        enviarTexto: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.T' })),
        enviarPlantilla: vi.fn(async () => ({ ok: true, waMessageId: 'wamid.P' })),
        ...over,
    };
}

function respuestasNormales(reserva: any = { data: { id: 'env-1' }, error: null }) {
    h.setRespuesta((table, ops) => {
        if (table === 'platform_wa_suscripciones') return { data: [SUB], error: null };
        if (table === 'platform_wa_envios' && ops.some(([m]) => m === 'insert')) return reserva;
        return { data: null, error: null };
    });
}

beforeEach(() => {
    h.llamadas.length = 0;
    process.env.PLATFORM_WA_ENABLED = 'true';
    respuestasNormales();
});
afterEach(() => { delete process.env.PLATFORM_WA_ENABLED; });

describe('puras', () => {
    it('horario silencioso cruza la medianoche', () => {
        expect(horaColombia(DIA)).toBe(10);
        expect(horaColombia(NOCHE)).toBe(23);
        expect(enSilencio(23, 22, 7)).toBe(true);
        expect(enSilencio(6, 22, 7)).toBe(true);
        expect(enSilencio(7, 22, 7)).toBe(false);
        expect(enSilencio(13, 12, 14)).toBe(true);
        expect(enSilencio(10, 0, 0)).toBe(false);
    });
    it('en silencio solo pasa lo urgente, y solo si la dueña lo pidió', () => {
        expect(debeSalir(SUB, false, NOCHE)).toBe(false);
        expect(debeSalir(SUB, true, NOCHE)).toBe(false);
        expect(debeSalir({ ...SUB, urgentes_en_silencio: true }, true, NOCHE)).toBe(true);
        expect(debeSalir(SUB, false, DIA)).toBe(true);
    });
    it('celular CO, testers y sufijo de URL', () => {
        expect(celularCo('320 429 8969')).toBe('573204298969');
        expect(celularCo('+57 320 429 8969')).toBe('573204298969');
        expect(celularCo('6012345678')).toBeNull();
        expect([...testersDePlataforma('573128463555, +57 300 111 2233;x')]).toEqual(['573128463555', '573001112233']);
        expect(testersDePlataforma('')).toEqual(new Set());
        expect(sufijoDeRuta('/whatsapp?tab=cortesias')).toBe('whatsapp?tab=cortesias');
    });
});

describe('avisarPorPlataforma', () => {
    it('flag apagado: nada, ni siquiera lee el canal', async () => {
        delete process.env.PLATFORM_WA_ENABLED;
        const d = deps();
        const r = await avisarPorPlataforma(AVISO, DIA, d);
        expect(r.omitido).toBe('apagado');
        expect(d.leerCanal).not.toHaveBeenCalled();
    });

    it('dentro de un turno simulado no avisa', async () => {
        const d = deps();
        const r = await conCortafuegos({ memoria: {}, rpc: {}, bloqueadas: [] }, () => avisarPorPlataforma(AVISO, DIA, d));
        expect(r.omitido).toBe('simulacion');
    });

    it('canal inactivo o escuela no habilitada: nada', async () => {
        expect((await avisarPorPlataforma(AVISO, DIA, deps({ leerCanal: vi.fn(async () => ({ ...CANAL, status: 'inactivo' })) }))).omitido).toBe('sin_canal');
        expect((await avisarPorPlataforma(AVISO, DIA, deps({ escuelaHabilitada: vi.fn(async () => false) }))).omitido).toBe('escuela_no_habilitada');
    });

    it('ventana cerrada → plantilla con el sufijo de la ruta; filtra por la preferencia del tipo', async () => {
        const d = deps();
        const r = await avisarPorPlataforma(AVISO, DIA, d);
        expect(r.enviados).toBe(1);
        expect(d.enviarPlantilla).toHaveBeenCalledWith(CANAL, '573001112233', expect.objectContaining({
            nombre: 'sm_comprobantes_por_revisar', variables: ['Escuela Uno', '2', '15 min'],
            sufijoUrl: 'payments-automation?tab=recurrent',
        }));
        expect(d.enviarTexto).not.toHaveBeenCalled();
        const subs = h.llamadas.find((l) => l.table === 'platform_wa_suscripciones')!;
        expect(subs.ops).toContainEqual(['eq', ['avisar_comprobantes', true]]);
        expect(subs.ops).toContainEqual(['eq', ['estado', 'activa']]);
        const cierre = h.llamadas.filter((l) => l.table === 'platform_wa_envios').map((l) => l.ops).find((ops) => ops.some(([m]) => m === 'update'))!;
        expect(cierre[0][1][0]).toMatchObject({ estado: 'enviado', via: 'plantilla', wa_message_id: 'wamid.P' });
    });

    it('ventana abierta → texto libre con botón «Ver en la app»', async () => {
        const d = deps({ ventanaAbiertaCon: vi.fn(async () => true) });
        await avisarPorPlataforma(AVISO, DIA, d);
        expect(d.enviarTexto).toHaveBeenCalledWith(CANAL, '573001112233', AVISO.texto, expect.objectContaining({
            enlace: { url: expect.stringMatching(/\/payments-automation\?tab=recurrent$/), texto: 'Ver en la app' },
        }));
        expect(d.enviarPlantilla).not.toHaveBeenCalled();
    });

    it('otro BFF ya reservó (23505): no envía', async () => {
        respuestasNormales({ data: null, error: { code: '23505', message: 'dup' } });
        const d = deps();
        const r = await avisarPorPlataforma(AVISO, DIA, d);
        expect(r).toMatchObject({ enviados: 0, duplicados: 1 });
        expect(d.enviarPlantilla).not.toHaveBeenCalled();
    });

    it('quien dejó de ser admin no recibe; en silencio no se reserva', async () => {
        const sinPermiso = await avisarPorPlataforma(AVISO, DIA, deps({ adminsDeEscuela: vi.fn(async () => new Set(['otra'])) }));
        expect(sinPermiso.sinPermiso).toBe(1);
        h.llamadas.length = 0;
        const noche = await avisarPorPlataforma(AVISO, NOCHE, deps());
        expect(noche.silencio).toBe(1);
        expect(h.llamadas.some((l) => l.table === 'platform_wa_envios')).toBe(false);
    });

    it('el envío que falla queda «fallido» con el detalle', async () => {
        const d = deps({ enviarPlantilla: vi.fn(async () => ({ ok: false, error: 'template not approved' })) });
        const r = await avisarPorPlataforma(AVISO, DIA, d);
        expect(r.fallidos).toBe(1);
        const cierre = h.llamadas.filter((l) => l.table === 'platform_wa_envios').map((l) => l.ops).find((ops) => ops.some(([m]) => m === 'update'))!;
        expect(cierre[0][1][0]).toMatchObject({ estado: 'fallido', detalle: 'template not approved' });
    });
});
