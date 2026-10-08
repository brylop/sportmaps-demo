/**
 * Comprobantes que se escalaban por no saber de quién eran (Dynasty, 28-sep →
 * 08-oct: 43 de 188) y medios de pago sin /my-payments. Casos inventados.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
    fichas: [] as any[],
    sinRegistrar: [] as any[],
    updates: [] as any[],
    rpcPagos: [] as any[],
};

function makeChain(result: any, table?: string) {
    const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, or: () => chain, is: () => chain,
        ilike: () => chain, limit: () => chain, order: () => chain, gte: () => chain,
        update: (v: any) => { if (table === 'whatsapp_inbound_queue') state.updates.push(v); return chain; },
        maybeSingle: () => Promise.resolve(result),
        then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    };
    return chain;
}

vi.mock('../config/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === 'children') return makeChain({ data: state.fichas, error: null }, table);
            if (table === 'unregistered_athletes') return makeChain({ data: state.sinRegistrar, error: null }, table);
            if (table === 'school_settings') return makeChain({ data: { payment_accounts: [], nequi_number: '3001112222' }, error: null }, table);
            return makeChain({ data: null, error: null }, table);
        }),
        rpc: vi.fn((name: string) => Promise.resolve(name === 'wa_get_payment_status'
            ? { data: state.rpcPagos, error: null } : { data: null, error: null })),
    },
}));

const aplicarComprobanteDeFichaMock = vi.fn((..._a: any[]) => Promise.resolve());
vi.mock('../jobs/whatsapp-queue.job', () => ({
    aplicarComprobanteDeFicha: (...a: any[]) => aplicarComprobanteDeFichaMock(...a),
}));

const conEnlacesDePagoMock = vi.fn();
vi.mock('./whatsapp-enlaces-de-pago.service', () => ({
    conEnlacesDePago: (...a: any[]) => conEnlacesDePagoMock(...a),
}));

const {
    candidatosPorNombre, botonesDeCobros, textoDeEleccion, resolverRespuestaDeDeportista,
    fichasPorTelefono, PREGUNTA_DEPORTISTA,
} = await import('./whatsapp-comprobante-de-ficha.service');
const { mediosDePago, mediosDePagoDeFamilia } = await import('./whatsapp-medios-de-pago.service');

const FICHAS = [
    { id: 'c-ana', nombre: 'Ana Lucía Torres Vega', tipo: 'child' as const },
    { id: 'c-ana2', nombre: 'Ana María Rojas Díaz', tipo: 'child' as const },
    { id: 'u-tomas', nombre: 'Tomás Quintero Lara', tipo: 'unregistered' as const },
];

beforeEach(() => {
    vi.clearAllMocks();
    state.fichas = [];
    state.sinRegistrar = [];
    state.updates = [];
    state.rpcPagos = [];
});

describe('candidatosPorNombre — (b) el deportista por nombre', () => {
    it('nombre y apellido → UNA ficha (sin tildes ni mayúsculas)', () => {
        expect(candidatosPorNombre(['es de ana lucia torres'], FICHAS).map((f) => f.id)).toEqual(['c-ana']);
        expect(candidatosPorNombre(['TOMAS QUINTERO'], FICHAS).map((f) => f.id)).toEqual(['u-tomas']);
    });

    it('solo el primer nombre no alcanza (media escuela se llama Ana)', () => {
        expect(candidatosPorNombre(['es de Ana'], FICHAS)).toEqual([]);
    });

    it('dos fichas igual de nombradas → las dos (el llamador no aplica)', () => {
        const gemelas = [...FICHAS, { id: 'c-ana3', nombre: 'Ana Lucía Torres Pinto', tipo: 'child' as const }];
        expect(candidatosPorNombre(['Ana Lucía Torres'], gemelas)).toHaveLength(2);
    });

    it('gana la que más palabras acierta', () => {
        const parecidas = [...FICHAS, { id: 'c-ana3', nombre: 'Ana Lucía Torres Pinto', tipo: 'child' as const }];
        expect(candidatosPorNombre(['Ana Lucía Torres Vega'], parecidas).map((f) => f.id)).toEqual(['c-ana']);
    });

    it('usa también el concepto y el nombre de quien paga que lee el comprobante', () => {
        expect(candidatosPorNombre([null, 'Mensualidad Tomas Quintero', 'Pedro Gómez'], FICHAS).map((f) => f.id))
            .toEqual(['u-tomas']);
    });
});

describe('botonesDeCobros — (c) varios cobros', () => {
    const OPC = [
        { id: 'p1', amount: 150000, concept: 'Mensualidad 09/2026', due_date: '2026-09-10', child_id: 'c1', atleta: 'Laura Peña' },
        { id: 'p2', amount: 150000, concept: 'Mensualidad 10/2026', due_date: '2026-10-10', child_id: 'c1', atleta: 'Laura Peña' },
    ];

    it('concepto + monto, numerados y ≤ 20 caracteres', () => {
        const b = botonesDeCobros(OPC);
        expect(b.map((x) => x.title)).toEqual(['1. Sep $150.000', '2. Oct $150.000']);
        expect(b.map((x) => x.id)).toEqual(['sm_cobro_1', 'sm_cobro_2']);
        for (const x of b) expect(x.title.length).toBeLessThanOrEqual(20);
        expect(b[0].descripcion).toContain('Mensualidad 09/2026');
    });

    it('de varios deportistas: con el primer nombre', () => {
        const b = botonesDeCobros([OPC[0], { ...OPC[1], child_id: 'c2', atleta: 'Martín Peña' }]);
        expect(b[1].title).toBe('2. Martín $150.000');
        for (const x of b) expect(x.title.length).toBeLessThanOrEqual(20);
    });

    it('el botón tocado vale por su número, no por el monto del título', () => {
        expect(textoDeEleccion('sm_cobro_2', '2. Oct $15.000')).toBe('2');
        expect(textoDeEleccion(null, 'el de octubre')).toBe('el de octubre');
        expect(textoDeEleccion('otro_boton', 'hola')).toBe('hola');
    });
});

describe('fichasPorTelefono — (a) familia sin cuenta', () => {
    it('cruza por los últimos 10 dígitos del celular de la ficha', async () => {
        state.fichas = [{ id: 'c1', parent_phone_temp: '+57 300 555 0101' }, { id: 'c2', parent_phone_temp: '3009990000' }];
        state.sinRegistrar = [{ id: 'u1', guardian_phone: '573005550101', phone: null }];
        expect(await fichasPorTelefono('school-1', '573005550101')).toEqual({ childIds: ['c1'], unregisteredIds: ['u1'] });
    });

    it('un fijo no se cruza', async () => {
        expect(await fichasPorTelefono('school-1', '6012345678')).toEqual({ childIds: [], unregisteredIds: [] });
    });
});

describe('resolverRespuestaDeDeportista — la respuesta a la pregunta', () => {
    const responder = vi.fn((..._a: any[]) => Promise.resolve());

    it('un único candidato → se aplica por la ficha', async () => {
        state.fichas = [{ id: 'c-ana', full_name: 'Ana Lucía Torres Vega' }, { id: 'c-otra', full_name: 'Ana María Rojas' }];
        expect(await resolverRespuestaDeDeportista({ id: 'q1', school_id: 'school-1' }, 'Ana Lucía Torres', responder)).toBe(true);
        expect(aplicarComprobanteDeFichaMock).toHaveBeenCalledWith('q1', { childIds: ['c-ana'], unregisteredIds: [] }, responder);
        expect(responder).not.toHaveBeenCalled();
    });

    it('ningún candidato (o varios) → a la escuela, sin repreguntar', async () => {
        state.fichas = [{ id: 'c-ana', full_name: 'Ana Lucía Torres Vega' }];
        expect(await resolverRespuestaDeDeportista({ id: 'q1', school_id: 'school-1' }, 'Ana', responder)).toBe(true);
        expect(aplicarComprobanteDeFichaMock).not.toHaveBeenCalled();
        expect(responder).toHaveBeenCalledTimes(1);
        expect(responder.mock.calls[0][1]).toBe('deportista_a_la_escuela');
        expect(state.updates[0]).toMatchObject({ status: 'ignored', result_type: 'escalated' });
    });

    it('la pregunta es corta y pide el nombre completo', () => {
        expect(PREGUNTA_DEPORTISTA).toContain('¿De qué deportista es este pago? Escríbeme su nombre completo');
        expect(PREGUNTA_DEPORTISTA.length).toBeLessThan(120);
    });
});

describe('medios de pago — nunca /my-payments', () => {
    it('sin link de la escuela, enlace_para_pagar es null', async () => {
        const m = await mediosDePago('school-1');
        expect(m.enlace_para_pagar).toBeNull();
        expect(JSON.stringify(m)).not.toContain('my-payments');
    });

    it('familia identificada con cobros: cada uno con su /p/:token', async () => {
        state.rpcPagos = [{ concept: 'Mensualidad 10/2026', amount: 150000, due_date: '2026-10-10', debe_pagarse: true }];
        conEnlacesDePagoMock.mockImplementation(async (pagos: any[]) =>
            pagos.map((p) => ({ ...p, enlace_pago: 'https://app.sportmaps.co/p/tok-ejemplo' })));
        const m = await mediosDePagoDeFamilia('school-1', 'parent-1', { integrationId: 'int-1', waPhone: '573000000000' });
        expect(m.cobros_pendientes).toEqual([{
            concepto: 'Mensualidad 10/2026', monto: 150000, vence: '2026-10-10',
            enlace_pago: 'https://app.sportmaps.co/p/tok-ejemplo',
        }]);
        expect(conEnlacesDePagoMock).toHaveBeenCalledWith(state.rpcPagos, 'parent-1', 'school-1',
            { integrationId: 'int-1', waPhone: '573000000000' });
        expect(JSON.stringify(m)).not.toContain('my-payments');
    });

    it('sin familia identificada: solo los medios, sin cobros', async () => {
        const m = await mediosDePagoDeFamilia('school-1', null);
        expect(m.cobros_pendientes).toEqual([]);
        expect(conEnlacesDePagoMock).not.toHaveBeenCalled();
    });
});
