/**
 * El estado de pagos del bot sin modelo (respaldo) y lo que recibe el modelo,
 * con pagos únicos (2026-10-10). Datos inventados.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({
    supabase: { from: () => ({}), rpc: () => Promise.resolve({ data: null, error: null }) },
}));

const { fallbackPaymentText, contenidoEstadoDePagos } = await import('./whatsapp-bot.service');

const pend = (concept: string, saldo: number, tipo?: string, extra: any = {}) => ({
    concept, saldo, amount: saldo, due_date: '2026-10-10', status: 'pending', debe_pagarse: true, vencido: false,
    ...(tipo ? { tipo_cobro: tipo } : {}), ...extra,
});

describe('estado de pagos con mensualidad + inscripción + seguro', () => {
    const pagos = [
        pend('Plan PGX — Mensualidad completa — Atleta Uno', 180000, 'Mensualidad octubre 2026', { enlace_pago: 'https://app.sportmaps.co/p/aaa' }),
        pend('Inscripción — PGX — Atleta Uno', 300000, 'Inscripción', { enlace_pago: 'https://app.sportmaps.co/p/bbb' }),
        pend('Seguro de accidentes — PGX — Atleta Uno', 35000, 'Seguro de accidentes', { enlace_pago: 'https://app.sportmaps.co/p/ccc' }),
        { concept: 'Mensualidad 09/2026', saldo: 0, status: 'paid', debe_pagarse: false },
    ];

    it('respaldo: cada cobro con su nombre, su concepto debajo, su «Pagar» y el total', () => {
        const t = fallbackPaymentText(pagos);
        expect(t).toContain('• Mensualidad octubre 2026: $180.000');
        expect(t).toContain('• Inscripción: $300.000');
        expect(t).toContain('• Seguro de accidentes: $35.000');
        expect(t).toContain('   Inscripción — PGX — Atleta Uno');
        expect(t).toContain('Pagar: https://app.sportmaps.co/p/bbb');
        expect(t).toContain('*Total pendiente: $515.000*');
        expect(t).not.toContain('Mensualidad 09/2026');
    });

    it('respaldo con un solo pendiente: sin total; sin tipo_cobro, el concepto como antes', () => {
        const t = fallbackPaymentText([pend('Mensualidad 10/2026 - Atleta Uno', 180000)]);
        expect(t).toBe('Estos son tus pagos pendientes:\n• Mensualidad 10/2026 - Atleta Uno: $180.000 — vence 2026-10-10');
    });

    it('el modelo recibe los pagos y el total pendiente calculado', () => {
        const c = JSON.parse(contenidoEstadoDePagos(pagos));
        expect(c.cobros_pendientes).toBe(3);
        expect(c.total_pendiente).toBe(515000);
        expect(c.pagos).toHaveLength(4);
        expect(c.pagos[1].tipo_cobro).toBe('Inscripción');
    });
});
