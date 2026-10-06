import { describe, it, expect, vi } from 'vitest';

// planChange.service importa el cliente de Supabase al cargarse; la lógica que se
// prueba acá (buildPlanChangeAdvice) es pura y no lo usa.
vi.mock('../config/supabase', () => ({ supabase: {} }));

import { buildPlanChangeAdvice, NEAR_END_DAYS } from './planChange.service';
import { athleteKey } from '../utils/accessBlockMechanism';

const base = {
    currentPlanName: 'PGR8x2',
    newPlanName: 'PGR12x3',
    included: 960,
};

describe('buildPlanChangeAdvice (reglas del owner, 2026-10-05)', () => {
    it('sin pago del período: solo cambia, sin diálogo de cobro', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 0, newPrice: 700000, consumed: 120, daysLeft: 20 });
        expect(r.scenario).toBe('sin_pago');
        expect(r.needs_choice).toBe(false);
        expect(r.recommended).toBeNull();
        expect(r.full_amount).toBe(700000);
    });

    it('con pago y horas a medias: parcial = diferencia, decide el admin', () => {
        // Ejemplo del owner: pagó 200, el plan nuevo vale 300 → parcial de 100.
        const r = buildPlanChangeAdvice({ ...base, paid: 200000, newPrice: 300000, consumed: 240, daysLeft: 15 });
        expect(r.scenario).toBe('pago_con_horas');
        expect(r.needs_choice).toBe(true);
        expect(r.recommended).toBe('partial');
        expect(r.partial_amount).toBe(100000);
        expect(r.full_amount).toBe(300000);
    });

    it('ya gastó todas las horas y quedan días: recomienda pago completo', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 489000, newPrice: 700000, consumed: 960, daysLeft: 12 });
        expect(r.scenario).toBe('horas_agotadas');
        expect(r.recommended).toBe('full');
        expect(r.needs_choice).toBe(true);
    });

    it('horas agotadas el último día del período: no hay días que proteger, aplica el caso general', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 489000, newPrice: 700000, consumed: 960, daysLeft: 0 });
        expect(r.scenario).not.toBe('horas_agotadas');
    });

    it('cerca del cierre y con pocas horas: recomienda esperar al día 1', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 489000, newPrice: 700000, consumed: 900, daysLeft: NEAR_END_DAYS });
        expect(r.scenario).toBe('cierre_de_periodo');
        expect(r.recommended).toBe('wait');
        expect(r.needs_choice).toBe(true); // el admin todavía puede cambiarlo ahora
    });

    it('cerca del cierre pero con muchas horas: no recomienda esperar', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 489000, newPrice: 700000, consumed: 120, daysLeft: 3 });
        expect(r.scenario).toBe('pago_con_horas');
    });

    it('si lo pagado supera el precio del plan nuevo, el parcial es 0 (nunca negativo)', () => {
        const r = buildPlanChangeAdvice({ ...base, paid: 800000, newPrice: 700000, consumed: 120, daysLeft: 10 });
        expect(r.partial_amount).toBe(0);
    });

    it('plan sin horas configuradas: no marca horas agotadas', () => {
        const r = buildPlanChangeAdvice({ ...base, included: null, paid: 489000, newPrice: 700000, consumed: 0, daysLeft: 10 });
        expect(r.scenario).toBe('pago_con_horas');
    });
});

describe('athleteKey (bloqueo por mora de menores)', () => {
    it('cada menor tiene su propia clave (antes todos caían en a:null)', () => {
        const a = athleteKey({ child_id: 'child-1', user_id: null, unregistered_athlete_id: null });
        const b = athleteKey({ child_id: 'child-2', user_id: null, unregistered_athlete_id: null });
        expect(a).toBe('c:child-1');
        expect(b).toBe('c:child-2');
        expect(a).not.toBe(b);
    });

    it('adulto y atleta sin cuenta conservan su clave', () => {
        expect(athleteKey({ user_id: 'u1' })).toBe('u:u1');
        expect(athleteKey({ unregistered_athlete_id: 'a1' })).toBe('a:a1');
    });

    it('una fila que no identifica a nadie se ignora', () => {
        expect(athleteKey({ child_id: null, user_id: null, unregistered_athlete_id: null })).toBeNull();
    });

    it('si el cobro es de un menor, manda el menor aunque traiga user_id del acudiente', () => {
        expect(athleteKey({ child_id: 'c1', user_id: 'parent-1' })).toBe('c:c1');
    });
});
