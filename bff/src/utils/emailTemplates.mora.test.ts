/**
 * Correos de cobro con mora (2026-10-14): `amount` ya es el total (la mora va
 * dentro de payments.amount) y debajo va «Mensualidad $X · Recargo por mora $Y
 * · Total $Z». Sin mora, el correo queda igual que antes.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./schoolBrandingResolver', () => ({
    resolveSchoolBranding: vi.fn(async () => ({ schoolName: 'Escuela de Prueba', primaryColor: '#248223' })),
    escapeHtml: (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}));
vi.mock('./emailLayout', () => ({ buildBrandedEmail: (o: any) => `${o.bodyHtml}|${o.closingHtml}` }));

import { BrandedEmailTemplates } from './emailTemplates';

const vencido = { parentName: 'Acudiente', amount: '$165.000', childName: 'Atleta', dueDate: '5 oct 2026', paymentLink: 'https://app/x', schoolId: 's' };
const recordatorio = {
    concepto: 'pendiente_directo' as const, parentName: 'Carolina', athletes: 'Samuel', amount: '$165.000',
    period: 'octubre 2026', dueDate: '5 de octubre', daysOverdue: 12, paymentLink: 'https://app/p/tok', schoolId: 's',
};
const MORA = { base: '$150.000', fee: '$15.000' };

describe('paymentOverdue con mora', () => {
    it('muestra el total y su desglose', async () => {
        const { html } = await BrandedEmailTemplates.paymentOverdue({ ...vencido, lateFee: MORA });
        expect(html).toContain('Monto a pagar:</strong> $165.000');
        expect(html).toContain('Mensualidad $150.000 · Recargo por mora $15.000 · Total $165.000');
    });

    it('cobro único: el valor base no se llama «Mensualidad»', async () => {
        const { html } = await BrandedEmailTemplates.paymentOverdue({ ...vencido, chargeLabel: 'Seguro', lateFee: MORA });
        expect(html).toContain('Valor del cobro $150.000 · Recargo por mora $15.000 · Total $165.000');
    });

    it('sin mora: igual que antes', async () => {
        const { html } = await BrandedEmailTemplates.paymentOverdue({ ...vencido, lateFee: null });
        expect(html).not.toContain('Recargo por mora');
        const { html: sinParam } = await BrandedEmailTemplates.paymentOverdue(vencido);
        expect(sinParam).toBe(html);
    });
});

describe('recordatorioCobro con mora', () => {
    it('el desglose va bajo «Total a pagar»', async () => {
        const { html } = await BrandedEmailTemplates.recordatorioCobro({ ...recordatorio, lateFee: MORA });
        const iTotal = html.indexOf('Total a pagar');
        const iDesglose = html.indexOf('Mensualidad $150.000 · Recargo por mora $15.000 · Total $165.000');
        expect(iTotal).toBeGreaterThanOrEqual(0);
        expect(iDesglose).toBeGreaterThan(iTotal);
    });

    it('sin mora: sin desglose', async () => {
        const { html } = await BrandedEmailTemplates.recordatorioCobro(recordatorio);
        expect(html).not.toContain('Recargo por mora');
    });

    it('escapa los valores del desglose', async () => {
        const { html } = await BrandedEmailTemplates.recordatorioCobro({ ...recordatorio, lateFee: { base: '<b>1</b>', fee: '$1' } });
        expect(html).not.toContain('<b>1</b>');
        expect(html).toContain('&lt;b&gt;1&lt;/b&gt;');
    });
});
