import { describe, it, expect } from 'vitest';
import { invoiceLines } from './saasInvoicing.constants';

describe('invoiceLines', () => {
    it('factura anterior a line_items: una sola línea con el total del plan', () => {
        const lines = invoiceLines({ plan_code: 'elite', amount_cents: 24900000, line_items: [] });
        expect(lines).toEqual([{ label: 'Plan Escuela Elite', amount_cents: 24900000 }]);
    });

    it('line_items null se trata igual que vacío', () => {
        const lines = invoiceLines({ plan_code: 'start', amount_cents: 6900000, line_items: null });
        expect(lines).toHaveLength(1);
        expect(lines[0].amount_cents).toBe(6900000);
    });

    it('plan negociado + adicional: una línea por elemento, en orden', () => {
        const lines = invoiceLines({
            plan_code: 'elite',
            amount_cents: 31800000,
            line_items: [
                { kind: 'plan', code: 'elite', amount_cents: 24900000, negotiated: true },
                { kind: 'addon', code: 'invoicing', amount_cents: 6900000 },
            ],
        });
        expect(lines).toEqual([
            { label: 'Plan Escuela Elite', amount_cents: 24900000 },
            { label: 'Adicional: Facturación electrónica', amount_cents: 6900000 },
        ]);
        expect(lines.reduce((s, l) => s + l.amount_cents, 0)).toBe(31800000);
    });

    it('addon sin nombre conocido muestra su código', () => {
        const lines = invoiceLines({
            plan_code: 'start',
            amount_cents: 100,
            line_items: [{ kind: 'addon', code: 'nuevo_addon', amount_cents: 100 }],
        });
        expect(lines[0].label).toBe('Adicional: nuevo_addon');
    });
});
