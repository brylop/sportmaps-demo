import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentBlock } from './PaymentBlock';
import { emptyPaymentDraft, type PaymentDraft } from './drafts';

vi.mock('@/integrations/supabase/client', () => ({
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) },
}));
// El uploader real trae Supabase y OCR: aquí solo importa cuándo avisa y en qué orden.
vi.mock('@/components/common/FileUpload', () => ({
    FileUpload: ({ onUploadComplete, onValidationResult }: any) => (
        <button
            type="button" data-testid="subir"
            onClick={() => {
                // Mismo orden que el real: primero el resultado del OCR y enseguida la URL, en el mismo evento.
                onValidationResult({ extractedAmount: 451_500, verdict: 'verde' });
                onUploadComplete('uid/comprobante.png');
            }}
        >
            subir
        </button>
    ),
}));
vi.mock('@/components/billing/BillingDetailsForm', () => ({ BillingDetailsForm: () => null }));

const HOY = '2026-10-21';

/** Con estado REAL (como el modal): un segundo cambio en el mismo evento no puede pisar al primero. */
function Harness({ inicial, onState }: { inicial: PaymentDraft; onState?: (p: PaymentDraft) => void }) {
    const [p, setP] = useState(inicial);
    return (
        <PaymentBlock
            value={p}
            onChange={(next) => { setP(next); onState?.(next); }}
            today={HOY} schoolId="s1" totalToPay={451_500} expectedAmount={451_500}
            paymentCategory={null} payerProfileId={null} payerName={null} payerKind="guardian" invoicingEnabled={false}
        />
    );
}

const radio = (nombre: string) => screen.getByRole('radio', { name: new RegExp(nombre) });

describe('<PaymentBlock /> método de pago', () => {
    it('arranca en efectivo', () => {
        render(<Harness inicial={emptyPaymentDraft(HOY, true)} />);
        expect(radio('Efectivo').getAttribute('aria-checked')).toBe('true');
        expect(radio('Transferencia').getAttribute('aria-checked')).toBe('false');
    });

    it('de Transferencia se puede volver a Efectivo (el caso reportado: se quedaba en Transferencia)', () => {
        render(<Harness inicial={emptyPaymentDraft(HOY, true)} />);
        fireEvent.click(radio('Transferencia'));
        expect(radio('Transferencia').getAttribute('aria-checked')).toBe('true');
        fireEvent.click(radio('Efectivo'));
        expect(radio('Efectivo').getAttribute('aria-checked')).toBe('true');
        expect(radio('Transferencia').getAttribute('aria-checked')).toBe('false');
    });

    it('con un comprobante cargado, pasar a Efectivo cambia el método Y quita el comprobante', () => {
        const estados: PaymentDraft[] = [];
        render(<Harness inicial={{ ...emptyPaymentDraft(HOY, true), method: 'transfer', receiptUrl: 'uid/x.png', ocr: { verdict: 'verde' } as any }} onState={(p) => estados.push(p)} />);
        fireEvent.click(radio('Efectivo'));
        const final = estados[estados.length - 1];
        expect(final.method).toBe('cash');
        expect(final.receiptUrl).toBeNull();
        expect(final.ocr).toBeNull();
        expect(radio('Efectivo').getAttribute('aria-checked')).toBe('true');
    });

    it('ir y venir entre los dos métodos varias veces siempre queda en el último clic', () => {
        render(<Harness inicial={emptyPaymentDraft(HOY, true)} />);
        for (const m of ['Transferencia', 'Efectivo', 'Transferencia', 'Efectivo', 'Efectivo']) fireEvent.click(radio(m));
        expect(radio('Efectivo').getAttribute('aria-checked')).toBe('true');
    });
});

describe('<PaymentBlock /> carga del comprobante', () => {
    it('el resultado del OCR y la URL llegan juntos, sin pisarse', () => {
        const estados: PaymentDraft[] = [];
        render(<Harness inicial={{ ...emptyPaymentDraft(HOY, true), method: 'transfer' }} onState={(p) => estados.push(p)} />);
        fireEvent.click(screen.getByTestId('subir'));
        const final = estados[estados.length - 1];
        expect(final.receiptUrl).toBe('uid/comprobante.png');
        expect(final.ocr).toMatchObject({ extractedAmount: 451_500 });
    });
});
