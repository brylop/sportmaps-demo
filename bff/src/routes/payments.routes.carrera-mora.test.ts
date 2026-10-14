/**
 * create-session (payments.routes): el link 'pending' que se reusa —también el
 * de la carrera 23505— tiene que tener la tarifa y la base VIGENTES. La mora
 * (2026-10-14) se suma a `payments.amount`: un link de antes cobraría de menos.
 * Sin red ni base: solo las decisiones puras.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/supabase', () => ({ supabase: { from: () => ({}) } }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: {} }) }));

import { linkDesactualizado, decidirLinkDeCarrera } from './payments.routes';

describe('linkDesactualizado', () => {
    it('misma tarifa y misma base (tolerancia 0,5) → vigente', () => {
        expect(linkDesactualizado({ fee_pct: 5, base_amount: '150000.00' }, 5, 150000.4))
            .toEqual({ staleFee: false, staleBase: false });
    });
    it('base de antes de la mora → obsoleto', () => {
        expect(linkDesactualizado({ fee_pct: 5, base_amount: 150000 }, 5, 160000).staleBase).toBe(true);
    });
    it('sin base → obsoleto (no se sabe qué cobra)', () => {
        expect(linkDesactualizado({ fee_pct: 5, base_amount: null }, 5, 160000).staleBase).toBe(true);
    });
});

describe('decidirLinkDeCarrera (23505)', () => {
    it('la ganadora con montos vigentes se reusa', () => {
        expect(decidirLinkDeCarrera({ fee_pct: 5, base_amount: 160000 }, { feePct: 5, baseAmount: 160000, montoVigente: 160000 }))
            .toBe('reusar');
    });
    it('ESTA request leyó el monto antes de la mora y la ganadora ya trae el vigente → se reusa la ganadora', () => {
        expect(decidirLinkDeCarrera({ fee_pct: 5, base_amount: 160000 }, { feePct: 5, baseAmount: 150000, montoVigente: 160000 }))
            .toBe('reusar');
    });
    it('la ganadora quedó con la base vieja y esta request tiene la vigente → se expira y se recrea', () => {
        expect(decidirLinkDeCarrera({ fee_pct: 5, base_amount: 150000 }, { feePct: 5, baseAmount: 160000, montoVigente: 160000 }))
            .toBe('recrear');
    });
    it('el cobro cambió de valor después de que ESTA request lo leyó → no se crea nada, se reintenta', () => {
        expect(decidirLinkDeCarrera({ fee_pct: 5, base_amount: 150000 }, { feePct: 5, baseAmount: 150000, montoVigente: 160000 }))
            .toBe('monto_cambio');
    });
    it('otra tarifa en la ganadora → se recrea', () => {
        expect(decidirLinkDeCarrera({ fee_pct: 0, base_amount: 160000 }, { feePct: 5, baseAmount: 160000, montoVigente: 160000 }))
            .toBe('recrear');
    });
});
