/**
 * Torneos: que cada pago quede con torneo, deportista y QUIÉN PAGÓ (spec
 * whatsapp-conversacion-v2-dynasty §3.6). Dynasty hoy tiene 0 ítems en el
 * catálogo: debe degradar bien, no inventar nada.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { items: [] as any[], pagos: [] as any[], cola: [] as any[], itemsError: false };

function chain(result: () => any) {
    const c: any = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'ilike', 'in', 'is', 'or']) c[m] = () => c;
    c.then = (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject);
    return c;
}
vi.mock('../config/supabase', () => ({
    supabase: {
        from: (table: string) => {
            if (table === 'school_tournament_items') return chain(() => (state.itemsError ? { data: null, error: { message: 'x' } } : { data: state.items, error: null }));
            if (table === 'payments') return chain(() => ({ data: state.pagos, error: null }));
            if (table === 'whatsapp_inbound_queue') return chain(() => ({ data: state.cola, error: null }));
            return chain(() => ({ data: [], error: null }));
        },
    },
}));

import {
    cruzarTorneo, motivoTorneo, textoCruceTorneo, agruparPagosDeTorneo, itemDelPago, listarPagosDeTorneo,
    cargarItemsDeTorneo, type ItemDeTorneo,
} from './whatsapp-torneos-pago.service';

const COPA: ItemDeTorneo = { id: 'i1', name: 'Torneo Interclubes Dynasty', price: 80000, per_athlete: true, allow_installments: true, event_id: null };
const FESTIVAL: ItemDeTorneo = { id: 'i2', name: 'Festival de Voleibol Playa', price: 120000, per_athlete: true, allow_installments: false, event_id: null };

beforeEach(() => { state.items = []; state.pagos = []; state.cola = []; state.itemsError = false; });

describe('cruzarTorneo', () => {
    it('catálogo vacío (Dynasty hoy): sin_catalogo, no se inventa nada', () => {
        expect(cruzarTorneo({ textos: ['pago del torneo'], monto: 80000, items: [] })).toEqual({ tipo: 'sin_catalogo' });
    });
    it('el texto nombra el torneo y el monto es el del ítem → propuesto, monto exacto', () => {
        const r = cruzarTorneo({ textos: ['pago interclubes de Sofía'], monto: 80000, items: [COPA, FESTIVAL] });
        expect(r).toMatchObject({ tipo: 'propuesto', via: 'nombre_y_monto', monto: 'exacto' });
        expect((r as any).item.id).toBe('i1');
    });
    it('sin nombre en el texto pero el monto es el de UN ítem → propuesto por monto', () => {
        const r = cruzarTorneo({ textos: ['torneo'], monto: 120000, items: [COPA, FESTIVAL] });
        expect(r).toMatchObject({ tipo: 'propuesto', via: 'monto' });
        expect((r as any).item.id).toBe('i2');
    });
    it('monto con el recargo del enlace de pago (5 %) = pago completo', () => {
        const r = cruzarTorneo({ textos: ['interclubes'], monto: 84000, items: [COPA] });
        expect(r).toMatchObject({ tipo: 'propuesto', monto: 'con_recargo' });
    });
    it('monto menor al ítem con cuotas permitidas → abono con su saldo', () => {
        const r = cruzarTorneo({ textos: ['interclubes'], monto: 40000, items: [COPA] });
        expect(r).toMatchObject({ tipo: 'propuesto', monto: 'abono', saldo: 40000 });
    });
    it('monto menor al ítem SIN cuotas → monto distinto (bandeja), no abono', () => {
        const r = cruzarTorneo({ textos: ['festival voleibol playa'], monto: 60000, items: [FESTIVAL] });
        expect(r).toMatchObject({ tipo: 'propuesto', monto: 'distinto' });
    });
    it('nada coincide → sin_coincidencia; dos ítems nombrados sin desempate → ambiguo', () => {
        expect(cruzarTorneo({ textos: ['torneo'], monto: 99999, items: [COPA, FESTIVAL] })).toEqual({ tipo: 'sin_coincidencia' });
        const otro: ItemDeTorneo = { ...COPA, id: 'i3', name: 'Torneo Interclubes Infantil', price: 70000 };
        const r = cruzarTorneo({ textos: ['interclubes'], monto: 55555, items: [COPA, otro] });
        expect(r.tipo).toBe('ambiguo');
    });
    it('ítems inactivos no cuentan', () => {
        expect(cruzarTorneo({ textos: ['interclubes'], monto: 80000, items: [{ ...COPA, active: false }] })).toEqual({ tipo: 'sin_catalogo' });
    });
});

describe('motivoTorneo: quién pagó siempre visible', () => {
    it('sin catálogo: empieza por «otro_concepto: torneo», nombra a quien pagó y degrada a registrar a mano', () => {
        const m = motivoTorneo({ quienPago: 'Carolina Gómez', monto: 80000, cruce: { tipo: 'sin_catalogo' }, evidencia: 'pago torneo' });
        expect(m.startsWith('otro_concepto: torneo')).toBe(true);
        expect(m).toContain('pagó: Carolina Gómez');
        expect(m).toContain('deportista: sin identificar');
        expect(m).toContain('no tiene torneos cargados');
        expect(m.length).toBeLessThanOrEqual(500);
    });
    it('con catálogo: torneo, precio y por deportista; con el deportista conocido', () => {
        const cruce = cruzarTorneo({ textos: ['interclubes'], monto: 40000, items: [COPA] });
        const m = motivoTorneo({ quienPago: 'Carolina Gómez', deportista: 'Sofía Pérez', monto: 40000, cruce });
        expect(m).toContain('Torneo Interclubes Dynasty');
        expect(m).toContain('por deportista');
        expect(m).toContain('deportista: Sofía Pérez');
        expect(m).toContain('abono');
    });
    it('sin nombre de quien pagó, lo dice', () => {
        expect(motivoTorneo({ quienPago: null, monto: 1, cruce: { tipo: 'sin_coincidencia' } })).toContain('pagó: no se leyó en el comprobante');
    });
    it('textoCruceTorneo cubre el ambiguo', () => {
        expect(textoCruceTorneo({ tipo: 'ambiguo', items: [COPA, FESTIVAL] }, 1)).toContain('Festival de Voleibol Playa');
    });
});

describe('cargarItemsDeTorneo', () => {
    it('lee el catálogo activo de la escuela', async () => {
        state.items = [{ id: 'i1', name: 'Copa', price: '50000.00', per_athlete: true, allow_installments: false, event_id: null, active: true }];
        expect(await cargarItemsDeTorneo('s1')).toEqual([expect.objectContaining({ id: 'i1', price: 50000, per_athlete: true })]);
    });
    it('un error de lectura degrada a catálogo vacío', async () => {
        state.itemsError = true;
        expect(await cargarItemsDeTorneo('s1')).toEqual([]);
    });
});

describe('«Torneos: quién pagó qué»', () => {
    const pago = (id: string, concepto: string, estado: string, monto: number, extra: Record<string, unknown> = {}) => ({
        id, status: estado, concept: concepto, amount: monto, amount_paid: null, ocr_amount: monto, ocr_origin_name: 'Carolina Gómez',
        payment_date: null, due_date: '2026-10-20', child: { full_name: 'Sofía Pérez' }, sin_registrar: null, ...extra,
    });

    it('itemDelPago liga el concepto del cobro con el ítem del catálogo', () => {
        expect(itemDelPago('Torneo Interclubes Dynasty — Sofía Pérez', [COPA, FESTIVAL])?.id).toBe('i1');
        expect(itemDelPago('Mensualidad 10/2026', [COPA, FESTIVAL])).toBeNull();
    });

    it('agrupa por torneo con deportista, quién pagó y totales; lo que no liga queda aparte', () => {
        const filas = [
            { pagoId: 'a', estado: 'paid', concepto: 'Interclubes — Sofía', deportista: 'Sofía Pérez', quienPago: 'Carolina Gómez', monto: 80000, abonado: null, montoLeido: 80000, fechaPago: null, vence: null },
            { pagoId: 'b', estado: 'partial', concepto: 'Interclubes — Tomás', deportista: 'Tomás Pérez', quienPago: 'Carolina Gómez', monto: 80000, abonado: 30000, montoLeido: 30000, fechaPago: null, vence: null },
            { pagoId: 'c', estado: 'pending', concepto: 'Interclubes — Ana', deportista: 'Ana', quienPago: null, monto: 80000, abonado: null, montoLeido: null, fechaPago: null, vence: null },
            { pagoId: 'd', estado: 'paid', concepto: 'Torneo Nacional', deportista: 'Luis', quienPago: 'Luis Padre', monto: 50000, abonado: null, montoLeido: 50000, fechaPago: null, vence: null },
        ];
        const { torneos, sinCatalogo } = agruparPagosDeTorneo(filas, [COPA]);
        expect(torneos).toHaveLength(1);
        expect(torneos[0]).toMatchObject({ torneo: 'Torneo Interclubes Dynasty', totalCobrado: 110000, totalPorCobrar: 50000 + 80000 });
        expect(sinCatalogo?.pagos.map((p) => p.pagoId)).toEqual(['d']);
        expect(sinCatalogo?.totalCobrado).toBe(50000);
    });

    it('listarPagosDeTorneo: con catálogo vacío, todos los pagos van a «sin torneo» con quién pagó; la bandeja aparte', async () => {
        state.pagos = [pago('p1', 'Torneo de verano — Sofía', 'paid', 60000), pago('p2', 'Torneo de verano — Tomás', 'awaiting_approval', 60000, { ocr_origin_name: 'Carolina Gómez' })];
        state.cola = [
            { id: 'q1', created_at: '2026-10-20T10:00:00Z', error_message: 'recuperado: otro_concepto — otro_concepto: torneo | Propuesta → pagó: X' },
            { id: 'q2', created_at: '2026-10-21T10:00:00Z', error_message: 'cerrado_escuela: resuelto | otro_concepto: torneo' },
        ];
        const r = await listarPagosDeTorneo('s1');
        expect(r.torneos).toEqual([]);
        expect(r.sinCatalogo?.pagos).toHaveLength(2);
        expect(r.sinCatalogo?.pagos[0]).toMatchObject({ quienPago: 'Carolina Gómez', deportista: 'Sofía Pérez' });
        expect(r.porRegistrar.map((f) => f.filaId)).toEqual(['q1']);
    });

    it('listarPagosDeTorneo nunca lanza: un error devuelve el reporte vacío', async () => {
        const { supabase } = await import('../config/supabase');
        const original = (supabase as any).from;
        (supabase as any).from = () => { throw new Error('caído'); };
        try {
            expect(await listarPagosDeTorneo('s1')).toEqual({ torneos: [], sinCatalogo: null, porRegistrar: [] });
        } finally {
            (supabase as any).from = original;
        }
    });
});
