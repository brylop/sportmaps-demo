/**
 * Auditoría 2026-10-10 (3): el botón del consentimiento al pie del «pago
 * confirmado» le llegaba a un número que no era el del pagador. Solo va si la
 * conversación está vinculada al MISMO acudiente del cobro.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({
    supabase: { from: () => ({}), rpc: () => Promise.resolve({ data: null, error: null }) },
}));
vi.mock('../services/cobro-enlace-publico.service', () => ({ emitirTokenCobro: () => Promise.resolve(null) }));

import { puedeOfrecerConsentimiento } from './whatsapp-payment-outcome.job';

describe('puedeOfrecerConsentimiento', () => {
    const conv = (parent_id: string | null) => ({ id: 'conv-1', parent_id });

    it('el número del pagador, pago aprobado y sin baja → sí', () => {
        expect(puedeOfrecerConsentimiento('paid', false, conv('parent-1'), 'parent-1')).toBe(true);
    });
    it('el comprobante lo mandó otro número (otro acudiente) → no', () => {
        expect(puedeOfrecerConsentimiento('paid', false, conv('parent-2'), 'parent-1')).toBe(false);
    });
    it('número sin vincular (sin cuenta / sin ficha) → no', () => {
        expect(puedeOfrecerConsentimiento('paid', false, conv(null), 'parent-1')).toBe(false);
    });
    it('cobro sin pagador (menor sin cuenta del acudiente) → no', () => {
        expect(puedeOfrecerConsentimiento('paid', false, conv('parent-1'), null)).toBe(false);
    });
    it('rechazado, glosado, dado de baja o sin conversación → no', () => {
        expect(puedeOfrecerConsentimiento('rejected', false, conv('parent-1'), 'parent-1')).toBe(false);
        expect(puedeOfrecerConsentimiento('glosado', false, conv('parent-1'), 'parent-1')).toBe(false);
        expect(puedeOfrecerConsentimiento('paid', true, conv('parent-1'), 'parent-1')).toBe(false);
        expect(puedeOfrecerConsentimiento('paid', false, null, 'parent-1')).toBe(false);
    });
});
