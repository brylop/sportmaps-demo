import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PaymentBlock } from './PaymentBlock';
import { emptyPaymentDraft } from './drafts';
import { decidirComprobante } from '@/lib/separarHoras';

vi.mock('@/integrations/supabase/client', () => ({
    supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) },
}));
vi.mock('@/components/common/FileUpload', () => ({ FileUpload: () => <div /> }));
vi.mock('@/components/billing/BillingDetailsForm', () => ({ BillingDetailsForm: () => null }));

const HOY = '2026-10-21';
const conComprobante = { ...emptyPaymentDraft(HOY, true), method: 'transfer' as const, receiptUrl: 'uid/x.png', ocr: { extractedAmount: 387_000, verdict: 'verde' } as any };

const montar = (comprobante: ReturnType<typeof decidirComprobante>, onSepararHoras = vi.fn()) => {
    render(
        <PaymentBlock
            value={conComprobante} onChange={vi.fn()} today={HOY} schoolId="s1" totalToPay={451_500} expectedAmount={451_500}
            paymentCategory={null} payerProfileId={null} payerName={null} payerKind="guardian" invoicingEnabled={false}
            comprobante={comprobante} onSepararHoras={onSepararHoras}
        />,
    );
    return onSepararHoras;
};

const entrada = { metodo: 'transfer' as const, tieneComprobante: true, montoLeido: 387_000, totalAPagar: 451_500, horasAPagar: 64_500 };

describe('<PaymentBlock /> comprobante con horas', () => {
    it('comprobante menor: alerta con el motivo y botón «Separar las horas» que llama al manejador', () => {
        const separar = montar(decidirComprobante(entrada));
        const aviso = screen.getByTestId('cyp-comprobante-horas');
        expect(aviso.getAttribute('role')).toBe('alert');
        expect(aviso.textContent).toContain('No se puede confirmar así');
        fireEvent.click(screen.getByTestId('cyp-separar-horas'));
        expect(separar).toHaveBeenCalledTimes(1);
    });

    it('sin nada que separar (solo horas) avisa pero no ofrece el botón', () => {
        montar(decidirComprobante({ ...entrada, totalAPagar: 64_500, montoLeido: 30_000 }));
        expect(screen.getByTestId('cyp-comprobante-horas')).toBeTruthy();
        expect(screen.queryByTestId('cyp-separar-horas')).toBeNull();
    });

    it('comprobante que cubre todo o sin veredicto: no muestra nada', () => {
        montar(decidirComprobante({ ...entrada, montoLeido: 451_500 }));
        expect(screen.queryByTestId('cyp-comprobante-horas')).toBeNull();
    });
});
