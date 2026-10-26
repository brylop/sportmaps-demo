import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ sinConexion: false, reset: vi.fn(async () => {}) }));

vi.mock('@/pwa/resetCaches', () => ({
    estaSinConexion: () => h.sinConexion,
    resetPwaCachesAndReload: h.reset,
}));

import ErrorBoundary, { esErrorDeChunk } from './ErrorBoundary';

function Revienta({ mensaje }: { mensaje: string }): JSX.Element {
    throw new Error(mensaje);
}

const CHUNK = 'Failed to fetch dynamically imported module: https://app/assets/Pagos-abc.js';

beforeEach(() => {
    h.sinConexion = false;
    h.reset.mockClear();
    sessionStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('esErrorDeChunk', () => {
    it('reconoce los mensajes de chunk que no cargó', () => {
        expect(esErrorDeChunk(new Error(CHUNK))).toBe(true);
        expect(esErrorDeChunk(new Error("Cannot read properties of undefined (reading 'default')"))).toBe(true);
        expect(esErrorDeChunk(new Error('Loading chunk 42 failed'))).toBe(true);
        expect(esErrorDeChunk(new Error('x is not a function'))).toBe(false);
        expect(esErrorDeChunk(null)).toBe(false);
    });
});

describe('ErrorBoundary', () => {
    it('chunk que falla CON señal: limpia caché y recarga una sola vez', () => {
        render(<ErrorBoundary><Revienta mensaje={CHUNK} /></ErrorBoundary>);
        expect(h.reset).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('chunk-reload')).toBe('1');
    });

    it('chunk que falla SIN señal: no recarga, muestra «Sin conexión» y recarga al volver la red', () => {
        h.sinConexion = true;
        render(<ErrorBoundary><Revienta mensaje={CHUNK} /></ErrorBoundary>);
        expect(h.reset).not.toHaveBeenCalled();
        expect(screen.getByText('Sin conexión')).toBeTruthy();
        // No gasta el guard de una recarga por sesión.
        expect(sessionStorage.getItem('chunk-reload')).toBeNull();

        h.sinConexion = false;
        act(() => { window.dispatchEvent(new Event('online')); });
        expect(h.reset).toHaveBeenCalledTimes(1);
    });

    it('«Reintentar» en un error de chunk hace la reparación completa (no re-renderiza el lazy roto)', () => {
        sessionStorage.setItem('chunk-reload', '1'); // ya se recargó una vez
        render(<ErrorBoundary><Revienta mensaje={CHUNK} /></ErrorBoundary>);
        expect(h.reset).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: /Reintentar/ }));
        expect(h.reset).toHaveBeenCalledWith({ unregister: true });
    });

    it('un error que no es de chunk no recarga', () => {
        render(<ErrorBoundary><Revienta mensaje="x is not a function" /></ErrorBoundary>);
        expect(h.reset).not.toHaveBeenCalled();
        expect(screen.getByText('Algo salió mal')).toBeTruthy();
    });
});
