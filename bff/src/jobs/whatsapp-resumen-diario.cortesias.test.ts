/**
 * Resumen de las 7: sección «Clases de cortesía de HOY y MAÑANA» + «Leads
 * nuevos sin agendar». Tolera que la tabla de leads falle.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listar: vi.fn(), falla: false }));

vi.mock('../config/supabase', () => ({ supabase: {} }));
vi.mock('../services/cortesia-reservas.service', async (orig) => {
    const real: any = await orig();
    return {
        ...real,
        listarCortesias: async (...a: any[]) => {
            if (h.falla) throw new Error('relation does not exist');
            return h.listar(...a);
        },
    };
});

import { cortesiasDelResumen, resumenVacio } from './whatsapp-resumen-diario.job';

const AHORA = Date.parse('2026-10-06T12:00:00Z'); // 7 a. m. en Bogotá

beforeEach(() => { h.listar.mockReset(); h.falla = false; });

describe('cortesiasDelResumen', () => {
    it('pide hoy y mañana, marca el día y enmascara el teléfono; solo leads nuevos', async () => {
        h.listar.mockResolvedValue({
            reservas: [
                { nombre: 'Ana', paraQuien: 'Menor de 12 años', grupo: 'Menores', fecha: '2026-10-06', horaInicio: '17:00', sede: 'Coliseo', telefono: '3001112233' },
                { nombre: 'Luis', paraQuien: 'Adulto (30 años)', grupo: 'Adultos', fecha: '2026-10-07', horaInicio: '19:30', sede: null, telefono: '3009998877' },
            ],
            sinAgendar: [
                { nombre: 'Gina', paraQuien: 'Edad sin informar', telefono: '3105556677', origen: 'whatsapp', estado: 'new', creadoEn: '2026-10-05T17:00:00Z' },
                { nombre: 'Ya hablado', paraQuien: 'x', telefono: '1', origen: 'web', estado: 'contacted', creadoEn: '2026-10-05T17:00:00Z' },
            ],
        });
        const r = await cortesiasDelResumen('s1', AHORA);
        expect(h.listar).toHaveBeenCalledWith('s1', { desde: '2026-10-06', hasta: '2026-10-07', diasLeads: 7 }, AHORA);
        expect(r.cortesias.map((c) => [c.dia, c.hora, c.telefono])).toEqual([
            ['hoy', '5:00 p. m.', '••• ••• 2233'],
            ['mañana', '7:30 p. m.', '••• ••• 8877'],
        ]);
        expect(r.leadsSinAgendar.map((l) => [l.nombre, l.origen])).toEqual([['Gina', 'WhatsApp']]);
        expect(resumenVacio({ familias: [], comprobantes: [], prospectos: [], ...r })).toBe(false);
    });

    it('si la consulta falla, la sección sale vacía y el resumen no se cae', async () => {
        h.falla = true;
        const r = await cortesiasDelResumen('s1', AHORA);
        expect(r).toEqual({ cortesias: [], leadsSinAgendar: [] });
        expect(resumenVacio({ familias: [], comprobantes: [], prospectos: [], ...r })).toBe(true);
    });
});
