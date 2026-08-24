/**
 * Tests del mapeo de estados de MercadoPago.
 *
 * Lo que importa: `in_mediation` es una DISPUTA con la plata retenida por MP, no
 * un fallo. Caía en el default 'failed' y le decía a la escuela que el cobro
 * había rebotado mientras MP todavía lo tenía.
 *
 * El default sigue siendo 'failed' a propósito, y NO se alinea con el de Wompi
 * ('pending'): los nueve estados documentados de MP están todos mapeados, así
 * que llegar al default significa un estado desconocido.
 */

import { describe, it, expect } from 'vitest';
import { mapMpStatus } from './mercadopago.service';

describe('mapMpStatus', () => {
    it('in_mediation es pending: hay disputa y MP retiene, no es un fallo', () => {
        expect(mapMpStatus('in_mediation')).toBe('pending');
    });

    it('cubre los nueve estados documentados de MP', () => {
        expect(mapMpStatus('approved')).toBe('paid');
        expect(mapMpStatus('pending')).toBe('pending');
        expect(mapMpStatus('in_process')).toBe('pending');
        expect(mapMpStatus('authorized')).toBe('pending');
        expect(mapMpStatus('in_mediation')).toBe('pending');
        expect(mapMpStatus('rejected')).toBe('rejected');
        expect(mapMpStatus('cancelled')).toBe('rejected');
        expect(mapMpStatus('refunded')).toBe('refunded');
        expect(mapMpStatus('charged_back')).toBe('refunded');
    });

    it('un estado desconocido NO se toma por pagado', () => {
        expect(mapMpStatus('algo_que_mp_invente')).not.toBe('paid');
        expect(mapMpStatus('')).not.toBe('paid');
        expect(mapMpStatus(undefined as any)).not.toBe('paid');
    });

    it('no depende de la caja del texto', () => {
        expect(mapMpStatus('APPROVED')).toBe('paid');
        expect(mapMpStatus('In_Mediation')).toBe('pending');
    });
});
