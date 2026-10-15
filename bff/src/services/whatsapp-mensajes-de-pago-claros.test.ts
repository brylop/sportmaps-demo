/**
 * Mensajes de pago claros (2026-10-15, pedido del usuario):
 *  · Transferencia DIRECTA a la escuela → sin recargo.
 *  · Pago en línea por la app (Wompi) → lleva el recargo, y se dice con su valor.
 *  · Link de la escuela, donde la familia escribe el valor → sin recargo; manda el comprobante.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: () => ({}) } }));

import {
    instruccionesDelLinkConMonto, instruccionesDeLaPaginaDeCobro, instruccionesDelLinkDeLaEscuela,
} from './whatsapp-enlaces-de-pago.service';
import { textoComoPagar, MAX_CARACTERES_MENSAJE } from './whatsapp-pago-publico';
import { SYSTEM_PROMPT } from './whatsapp-bot.service';

describe('pago en línea con recargo: dice el total, el recargo y qué pasa si transfiere directo', () => {
    it('link con monto', () => {
        const t = instruccionesDelLinkConMonto(60, false, { total: 157500, recargo: 7500 });
        expect(t).toContain('El link cobra $157.500 (incluye $7.500 de recargo por pago en línea).');
        expect(t).toContain('Si transfieres directo a la escuela no pagas recargo: son $150.000.');
    });

    it('página del cobro', () => {
        const t = instruccionesDeLaPaginaDeCobro(false, { total: 157500, recargo: 7500 });
        expect(t).toContain('recargo de la app');
        expect(t).toContain('no pagas recargo: son $150.000');
    });

    it('sin recargo no se habla de recargo', () => {
        expect(instruccionesDelLinkConMonto(60, false, { total: 150000, recargo: 0 })).not.toMatch(/recargo/i);
        expect(instruccionesDeLaPaginaDeCobro(false, { total: 150000, recargo: 0 })).not.toMatch(/recargo/i);
    });
});

describe('link de la escuela: la familia escribe el valor, sin recargo', () => {
    it('con monto', () => {
        const t = instruccionesDelLinkDeLaEscuela(150000);
        expect(t).toContain('escribe $150.000 (sin recargo)');
        expect(t).toContain('comprobante');
    });

    it('sin monto conocido', () => {
        expect(instruccionesDelLinkDeLaEscuela(null)).toContain('escribe el valor de tu cobro (sin recargo)');
    });
});

describe('«cómo pagar» público', () => {
    const DATOS = {
        cuentas: [
            { tipo: 'Bre-B Bancolombia', titular: 'Dynasty Volley Club', numero: '@dynasty1' },
            { tipo: 'Nequi', titular: null, numero: '3001234567' },
        ],
        linkDePago: 'https://checkout.wompi.co/l/EJEMPLO',
    };

    it('dice que es sin recargo y que en el link escribe el valor de su cobro', () => {
        const t = textoComoPagar({ pregunta: { pagar: true, presencial: false }, datos: DATOS, horario: null });
        expect(t).toContain('Puedes pagar así (sin recargo)');
        expect(t).toContain('En línea (escribes el valor de tu cobro): https://checkout.wompi.co/l/EJEMPLO');
        expect(t).toContain('comprobante');
        expect(t.length).toBeLessThanOrEqual(MAX_CARACTERES_MENSAJE);
    });
});

describe('instrucción del modelo', () => {
    it('la transferencia directa no lleva recargo y no se inventan porcentajes', () => {
        expect(SYSTEM_PROMPT).toContain('TRANSFERENCIA DIRECTA');
        expect(SYSTEM_PROMPT).toContain('NO lleva');
        expect(SYSTEM_PROMPT).toMatch(/Nunca inventes un recargo/);
    });
});
