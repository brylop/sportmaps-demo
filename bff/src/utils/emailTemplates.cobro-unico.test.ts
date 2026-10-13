/**
 * Correos de cobro con un cobro ÚNICO (inscripción, seguro… — 2026-10-10): el
 * texto nombra el cobro en vez de decir «la mensualidad». Sin etiqueta, igual que antes.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./schoolBrandingResolver', () => ({
    resolveSchoolBranding: vi.fn(async () => ({ schoolName: 'Escuela de Prueba' })),
    escapeHtml: (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
}));
vi.mock('./emailLayout', () => ({ buildBrandedEmail: (o: any) => `${o.bodyHtml}|${o.closingHtml}` }));

import { BrandedEmailTemplates } from './emailTemplates';

const base = { parentName: 'Acudiente', amount: '$150.000', childName: 'Atleta', dueDate: '5 oct 2026', paymentLink: 'https://app/x', schoolId: 's' };

describe('paymentOverdue', () => {
    it('cobro único: nombra el cobro y muestra el concepto', async () => {
        const { html } = await BrandedEmailTemplates.paymentOverdue({ ...base, chargeLabel: 'Seguro de accidentes', concept: 'Seguro de accidentes — Plan X' });
        expect(html).toContain('del cobro de <strong>Seguro de accidentes</strong>');
        expect(html).toContain('Concepto:</strong> Seguro de accidentes — Plan X');
        expect(html).not.toContain('mensualidad');
        expect(html).toContain('puedes omitir'); // sin voseo
    });

    it('sin etiqueta: la mensualidad, como siempre', async () => {
        const { html } = await BrandedEmailTemplates.paymentOverdue(base);
        expect(html).toContain('El pago de la mensualidad de');
        expect(html).not.toContain('Concepto:');
    });
});

describe('chargeCreated', () => {
    it('cobro único: «el cobro de Inscripción»; sin etiqueta: «la mensualidad»', async () => {
        const unico = await BrandedEmailTemplates.chargeCreated({ ...base, concept: 'Inscripción — Plan X', chargeLabel: 'Inscripción' });
        expect(unico.html).toContain('Ya está disponible el cobro de <strong>Inscripción</strong>');
        const mens = await BrandedEmailTemplates.chargeCreated({ ...base, concept: 'Mensualidad Octubre' });
        expect(mens.html).toContain('Ya está disponible la mensualidad de');
    });
});
