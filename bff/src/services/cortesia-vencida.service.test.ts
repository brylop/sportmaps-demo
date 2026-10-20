import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: vi.fn() } }));

import { esCortesiaVencida, type InscripcionCortesia } from './cortesia-vencida.service';

const HOY = '2026-10-20';
const base: InscripcionCortesia = {
    id: 'e1', school_id: 's1', child_id: 'c1', user_id: null,
    start_date: '2026-10-10', monthly_fee: null, offering_plan_id: null, fee_is_manual: false,
};

describe('esCortesiaVencida', () => {
    it('sin cuota ni plan y más de 7 días → vencida', () => {
        expect(esCortesiaVencida(base, null, 7, HOY)).toBe(true);
    });
    it('cumple exactamente 7 días hoy → vencida', () => {
        expect(esCortesiaVencida({ ...base, start_date: '2026-10-13' }, null, 7, HOY)).toBe(true);
    });
    it('la semana sigue (6 días) → no', () => {
        expect(esCortesiaVencida({ ...base, start_date: '2026-10-14' }, null, 7, HOY)).toBe(false);
    });
    it('con cuota → no; becado con cuota 0 → no', () => {
        expect(esCortesiaVencida({ ...base, monthly_fee: 210000 }, null, 7, HOY)).toBe(false);
        expect(esCortesiaVencida({ ...base, monthly_fee: 0, fee_is_manual: true }, null, 7, HOY)).toBe(false);
    });
    it('con un plan que cobra → no; con el plan CORTESÍA de $0 → sí', () => {
        expect(esCortesiaVencida({ ...base, offering_plan_id: 'p1' }, 210000, 7, HOY)).toBe(false);
        expect(esCortesiaVencida({ ...base, offering_plan_id: 'p0' }, 0, 7, HOY)).toBe(true);
    });
    it('una cortesía de hace más de 30 días es dato viejo → no se avisa', () => {
        expect(esCortesiaVencida({ ...base, start_date: '2026-09-01' }, null, 7, HOY)).toBe(false);
    });
    it('respeta los días configurados', () => {
        expect(esCortesiaVencida({ ...base, start_date: '2026-10-14' }, null, 5, HOY)).toBe(true);
    });
});
