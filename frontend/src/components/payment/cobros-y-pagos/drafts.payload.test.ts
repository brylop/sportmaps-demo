import { describe, expect, it } from 'vitest';
import { emptyPaymentDraft, paymentPayload } from './drafts';
import { requestSignature } from '@/lib/cobrosYPagos';

const conComprobante = () => ({
    ...emptyPaymentDraft('2026-10-21', true),
    method: 'transfer' as const,
    receiptUrl: 'uid/x.png',
    ocr: { extractedAmount: 387_000, verdict: 'verde' } as any,
});

describe('paymentPayload con comprobante', () => {
    it('es estable entre llamadas: la hora del veredicto no cambia con cada render (la firma de la vista previa no se rompe)', async () => {
        const p = conComprobante();
        const a = JSON.stringify(paymentPayload(p));
        await new Promise((r) => setTimeout(r, 15));
        const b = JSON.stringify(paymentPayload(p));
        expect(b).toBe(a);
        expect(requestSignature({ payment: paymentPayload(p) } as any)).toBe(requestSignature({ payment: paymentPayload(p) } as any));
    });

    it('una lectura nueva del OCR sí es otro cuerpo', async () => {
        const a = JSON.stringify(paymentPayload(conComprobante()));
        await new Promise((r) => setTimeout(r, 15));
        const b = JSON.stringify(paymentPayload(conComprobante()));
        expect(b).not.toBe(a);
    });

    it('sin veredicto no inventa la hora', () => {
        const p = { ...conComprobante(), ocr: { extractedAmount: 1 } as any };
        expect((paymentPayload(p).ocr as Record<string, unknown>).receipt_verdict_at).toBeNull();
    });
});
