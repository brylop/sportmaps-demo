/**
 * ventas-servicios.service — envoltorio de las RPC del carril B de ventas por
 * WhatsApp (mig. 20261007095911). Supabase mockeado: aquí se prueba el mapeo,
 * la tolerancia a la migración sin aplicar y que nada lance. La lógica de la
 * base (cupos, idempotencia, permisos) la cubre _smoke/ventas_wa_f0_smoke.sql.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => ({
    llamadas: [] as { fn: string; args: Record<string, unknown> }[],
    respuesta: {} as Record<string, { data?: unknown; error?: unknown; lanza?: boolean }>,
}));

vi.mock('../config/supabase', () => ({
    supabase: {
        rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
            estado.llamadas.push({ fn, args });
            const r = estado.respuesta[fn] ?? { data: null, error: null };
            if (r.lanza) throw new Error('red caída');
            return { data: r.data ?? null, error: r.error ?? null };
        }),
    },
}));

import {
    anularCobrosSueltosVencidos,
    catalogoServicios,
    crearCobroSuelto,
    esMigracionPendiente,
    servicioDesdeFila,
} from './ventas-servicios.service';

const SIN_FUNCION = { code: 'PGRST202', message: 'Could not find the function public.wa_crear_cobro_suelto' };

const entrada = {
    schoolId: 'esc-1',
    itemId: 'item-1',
    parentId: 'padre-1',
    childId: 'hijo-1',
    idempotencyKey: 'venta-9f3c-0001',
    conversationId: 'conv-1',
};

beforeEach(() => {
    estado.llamadas = [];
    estado.respuesta = {};
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('esMigracionPendiente', () => {
    it('reconoce función, tabla y columna inexistentes', () => {
        expect(esMigracionPendiente({ code: 'PGRST202' })).toBe(true);
        expect(esMigracionPendiente({ code: '42883' })).toBe(true);
        expect(esMigracionPendiente({ code: '42P01' })).toBe(true);
        expect(esMigracionPendiente({ code: '42703' })).toBe(true);
        expect(esMigracionPendiente({ code: 'XX000', message: 'function public.x does not exist' })).toBe(true);
    });
    it('un error cualquiera no es migración pendiente', () => {
        expect(esMigracionPendiente({ code: '23505', message: 'duplicate key' })).toBe(false);
        expect(esMigracionPendiente(null)).toBe(false);
    });
});

describe('catalogoServicios', () => {
    it('mapea los ítems de la RPC y pasa búsqueda y límite acotados', async () => {
        estado.respuesta.wa_catalogo_servicios = {
            data: {
                habilitado: true,
                items: [
                    {
                        id: 'item-1', nombre: 'Clase de perfeccionamiento', descripcion: 'Técnica',
                        tipo: 'clase_extra', precio: '25000.00', imagen_url: 'https://x.co/a.jpg',
                        inicia_en: '2026-10-09T21:00:00Z', termina_en: null,
                        cupos: 10, cupos_restantes: 3, por_atleta: true,
                    },
                    { id: 'roto' }, // sin nombre: se descarta
                ],
            },
        };
        const r = await catalogoServicios('esc-1', { buscar: '  perfeccionamiento  ', limite: 99 });
        expect(r).toEqual({
            ok: true,
            habilitado: true,
            items: [{
                id: 'item-1', nombre: 'Clase de perfeccionamiento', descripcion: 'Técnica', tipo: 'clase_extra',
                precio: 25000, imagenUrl: 'https://x.co/a.jpg', iniciaEn: '2026-10-09T21:00:00Z', terminaEn: null,
                cupos: 10, cuposRestantes: 3, porAtleta: true,
            }],
        });
        expect(estado.llamadas[0]).toEqual({
            fn: 'wa_catalogo_servicios',
            args: { p_school_id: 'esc-1', p_buscar: 'perfeccionamiento', p_limite: 20 },
        });
    });

    it('escuela apagada: habilitado false sin ítems', async () => {
        estado.respuesta.wa_catalogo_servicios = { data: { habilitado: false, items: [] } };
        expect(await catalogoServicios('esc-1')).toEqual({ ok: true, habilitado: false, items: [] });
    });

    it('sin escuela no llama a la base', async () => {
        expect(await catalogoServicios('')).toEqual({ ok: true, habilitado: false, items: [] });
        expect(estado.llamadas).toHaveLength(0);
    });

    it('migración sin aplicar → migracion_pendiente', async () => {
        estado.respuesta.wa_catalogo_servicios = { error: SIN_FUNCION };
        const r = await catalogoServicios('esc-1');
        expect(r.ok).toBe(false);
        expect(!r.ok && r.code).toBe('migracion_pendiente');
    });

    it('error de red → error, sin lanzar', async () => {
        estado.respuesta.wa_catalogo_servicios = { lanza: true };
        const r = await catalogoServicios('esc-1');
        expect(!r.ok && r.code).toBe('error');
    });

    it('tipo desconocido cae a otro y por_atleta ausente es true', () => {
        expect(servicioDesdeFila({ id: 'a', nombre: 'b', tipo: 'rifa', precio: 1 })).toMatchObject({ tipo: 'otro', porAtleta: true, cupos: null });
    });
});

describe('crearCobroSuelto', () => {
    it('cobro nuevo: mapea la respuesta y pasa los parámetros', async () => {
        estado.respuesta.wa_crear_cobro_suelto = {
            data: {
                ok: true, idempotente: false, payment_id: 'pay-1', monto: 25000,
                concepto: 'Clase de perfeccionamiento · 09/10 · Luis', categoria: 'clase_extra',
                estado: 'pending', vence_at: '2026-10-07T16:00:00Z', cupos_restantes: 2,
            },
        };
        const r = await crearCobroSuelto(entrada);
        expect(r).toEqual({
            ok: true, paymentId: 'pay-1', idempotente: false, monto: 25000,
            concepto: 'Clase de perfeccionamiento · 09/10 · Luis', categoria: 'clase_extra',
            estado: 'pending', venceEn: '2026-10-07T16:00:00Z', cuposRestantes: 2,
        });
        expect(estado.llamadas[0]).toEqual({
            fn: 'wa_crear_cobro_suelto',
            args: {
                p_school_id: 'esc-1', p_item_id: 'item-1', p_parent_id: 'padre-1', p_child_id: 'hijo-1',
                p_idempotency_key: 'venta-9f3c-0001', p_conversation_id: 'conv-1', p_minutos_vigencia: 60,
            },
        });
    });

    it('acota la vigencia a 15–120 minutos', async () => {
        estado.respuesta.wa_crear_cobro_suelto = { data: { ok: false, codigo: 'sin_cupos' } };
        await crearCobroSuelto({ ...entrada, minutosVigencia: 5 });
        await crearCobroSuelto({ ...entrada, minutosVigencia: 500 });
        expect(estado.llamadas.map((l) => l.args.p_minutos_vigencia)).toEqual([15, 120]);
    });

    it('idempotente: devuelve el mismo cobro marcado como tal', async () => {
        estado.respuesta.wa_crear_cobro_suelto = {
            data: { ok: true, idempotente: true, payment_id: 'pay-1', monto: 25000, concepto: 'x', categoria: 'clase_extra', estado: 'pending', vence_at: 'v', cupos_restantes: null },
        };
        const r = await crearCobroSuelto(entrada);
        expect(r.ok && r.idempotente).toBe(true);
        expect(r.ok && r.cuposRestantes).toBeNull();
    });

    it('ya_inscrito trae el payment existente para reenviar su link', async () => {
        estado.respuesta.wa_crear_cobro_suelto = { data: { ok: false, codigo: 'ya_inscrito', payment_id: 'pay-viejo' } };
        expect(await crearCobroSuelto(entrada)).toMatchObject({ ok: false, code: 'ya_inscrito', paymentId: 'pay-viejo' });
    });

    it.each(['ventas_deshabilitadas', 'sin_cupos', 'atleta_requerido', 'familia_no_valida', 'clave_reutilizada', 'item_vencido'])(
        'propaga el código %s',
        async (codigo) => {
            estado.respuesta.wa_crear_cobro_suelto = { data: { ok: false, codigo } };
            const r = await crearCobroSuelto(entrada);
            expect(r).toMatchObject({ ok: false, code: codigo });
            expect(!r.ok && r.error.length).toBeGreaterThan(0);
        },
    );

    it('código desconocido de la base → error', async () => {
        estado.respuesta.wa_crear_cobro_suelto = { data: { ok: false, codigo: 'algo_nuevo' } };
        expect(await crearCobroSuelto(entrada)).toMatchObject({ ok: false, code: 'error' });
    });

    it('clave corta o vacía no llega a la base', async () => {
        expect(await crearCobroSuelto({ ...entrada, idempotencyKey: 'corta' })).toMatchObject({ code: 'clave_invalida' });
        expect(await crearCobroSuelto({ ...entrada, idempotencyKey: '' })).toMatchObject({ code: 'clave_invalida' });
        expect(estado.llamadas).toHaveLength(0);
    });

    it('sin acudiente no llega a la base', async () => {
        expect(await crearCobroSuelto({ ...entrada, parentId: '' })).toMatchObject({ code: 'familia_no_valida' });
        expect(estado.llamadas).toHaveLength(0);
    });

    it('migración sin aplicar → migracion_pendiente', async () => {
        estado.respuesta.wa_crear_cobro_suelto = { error: SIN_FUNCION };
        expect(await crearCobroSuelto(entrada)).toMatchObject({ ok: false, code: 'migracion_pendiente' });
    });

    it('error de base o de red → error, sin lanzar', async () => {
        estado.respuesta.wa_crear_cobro_suelto = { error: { code: '23514', message: 'check violation' } };
        expect(await crearCobroSuelto(entrada)).toMatchObject({ ok: false, code: 'error' });
        estado.respuesta.wa_crear_cobro_suelto = { lanza: true };
        expect(await crearCobroSuelto(entrada)).toMatchObject({ ok: false, code: 'error' });
    });
});

describe('anularCobrosSueltosVencidos', () => {
    it('devuelve lo anulado', async () => {
        estado.respuesta.wa_anular_cobros_sueltos_vencidos = {
            data: { revisados: 2, anulados: 2, payment_ids: ['p1', 'p2'] },
        };
        expect(await anularCobrosSueltosVencidos()).toEqual({
            ok: true, migracionPendiente: false, revisados: 2, anulados: 2, paymentIds: ['p1', 'p2'],
        });
        expect(estado.llamadas[0].args).toEqual({ p_limite: 200, p_margen_minutos: 15 });
    });

    it('acota límite y margen', async () => {
        estado.respuesta.wa_anular_cobros_sueltos_vencidos = { data: { revisados: 0, anulados: 0, payment_ids: [] } };
        await anularCobrosSueltosVencidos({ limite: 0, margenMinutos: -5 });
        expect(estado.llamadas[0].args).toEqual({ p_limite: 1, p_margen_minutos: 0 });
    });

    it('migración sin aplicar → migracionPendiente, sin lanzar', async () => {
        estado.respuesta.wa_anular_cobros_sueltos_vencidos = { error: { code: '42883', message: 'function does not exist' } };
        expect(await anularCobrosSueltosVencidos()).toMatchObject({ ok: false, migracionPendiente: true, anulados: 0 });
    });

    it('error de red → ok false, sin lanzar', async () => {
        estado.respuesta.wa_anular_cobros_sueltos_vencidos = { lanza: true };
        expect(await anularCobrosSueltosVencidos()).toMatchObject({ ok: false, migracionPendiente: false });
    });
});
