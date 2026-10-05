/**
 * Seguridad N1 (2026-10-05): el navegador nunca marca una inscripción como
 * pagada. `process_enrollment_checkout` creaba un pago 'completed' con el monto
 * que mandara el cliente; quedó solo para service_role (mig 20261005131057).
 * Si alguien vuelve a cablear la RPC desde acá, este test lo detiene.
 */

import { describe, it, expect, vi } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
    supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) },
}));

import { checkoutAPI, ENROLLMENT_CHECKOUT_UNAVAILABLE } from '../lib/api/checkout';

describe('checkoutAPI.processEnrollment — sin pago desde el cliente', () => {
    it('no llama a ninguna RPC ni escribe tablas, aunque el monto sea manipulado', async () => {
        const res = await checkoutAPI.processEnrollment({
            student_id: 'child-1',
            class_id: null,
            offering_plan_id: 'plan-1',
            school_id: 'school-ajena',
            parent_id: 'otro-acudiente',
            amount: 1,
            payment_method: 'cash',
            is_child_enrollment: true,
        });
        expect(res).toEqual({ success: false, error: ENROLLMENT_CHECKOUT_UNAVAILABLE });
        expect(rpc).not.toHaveBeenCalled();
        expect(from).not.toHaveBeenCalled();
    });
});
