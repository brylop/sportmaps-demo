import { describe, expect, it } from 'vitest';
import { COBROS_Y_PAGOS_FLAG_STORAGE_KEY, isCobrosYPagosEnabled } from './cobrosYPagosFlag';

const storage = (v: string | null) => ({ getItem: (k: string) => (k === COBROS_Y_PAGOS_FLAG_STORAGE_KEY ? v : null) });

describe('isCobrosYPagosEnabled', () => {
    it('apagado por defecto (producción no cambia)', () => {
        expect(isCobrosYPagosEnabled({}, storage(null))).toBe(false);
        expect(isCobrosYPagosEnabled({ VITE_COBROS_Y_PAGOS: 'off' }, storage(null))).toBe(false);
    });
    it('encendido por variable de build', () => {
        for (const v of ['on', 'true', '1', 'ON']) expect(isCobrosYPagosEnabled({ VITE_COBROS_Y_PAGOS: v }, storage(null))).toBe(true);
    });
    it('encendido solo en este navegador por localStorage', () => {
        expect(isCobrosYPagosEnabled({}, storage('on'))).toBe(true);
        expect(isCobrosYPagosEnabled({}, storage('nope'))).toBe(false);
    });
    it('localStorage que lanza (modo privado) = apagado', () => {
        expect(isCobrosYPagosEnabled({}, { getItem: () => { throw new Error('blocked'); } })).toBe(false);
    });
});
