import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarConexion, estaSinConexion, resetPwaCaches, resetPwaCachesAndReload } from './resetCaches';

const original = {
    caches: (globalThis as any).caches,
    sw: Object.getOwnPropertyDescriptor(globalThis.navigator, 'serviceWorker'),
    location: window.location,
    onLine: Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine'),
};

function ponerSinConexion(sin: boolean) {
    Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, get: () => !sin });
}

function instalarFalsos(opts: { claves?: string[]; registros?: { unregister: () => Promise<boolean> }[] } = {}) {
    const borrados: string[] = [];
    (globalThis as any).caches = {
        keys: vi.fn(async () => opts.claves ?? ['workbox-precache-v2', 'runtime-assets']),
        delete: vi.fn(async (k: string) => { borrados.push(k); return true; }),
    };
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistrations: vi.fn(async () => opts.registros ?? []) },
    });
    return { borrados };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

afterEach(() => {
    (globalThis as any).caches = original.caches;
    if (original.sw) Object.defineProperty(globalThis.navigator, 'serviceWorker', original.sw);
    else delete (globalThis.navigator as any).serviceWorker;
    Object.defineProperty(window, 'location', { configurable: true, value: original.location });
    if (original.onLine) Object.defineProperty(globalThis.navigator, 'onLine', original.onLine);
    else delete (globalThis.navigator as any).onLine;
});

describe('resetPwaCaches', () => {
    it('borra TODOS los cachés y NO desregistra el service worker por defecto', async () => {
        const unregister = vi.fn(async () => true);
        const { borrados } = instalarFalsos({ registros: [{ unregister }] });
        await resetPwaCaches();
        expect(borrados).toEqual(['workbox-precache-v2', 'runtime-assets']);
        expect(unregister).not.toHaveBeenCalled();
    });

    it('con unregister:true desregistra todos los service workers', async () => {
        const a = vi.fn(async () => true);
        const b = vi.fn(async () => true);
        instalarFalsos({ registros: [{ unregister: a }, { unregister: b }] });
        await resetPwaCaches({ unregister: true });
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it('sin cachés guardados no falla', async () => {
        const { borrados } = instalarFalsos({ claves: [] });
        await expect(resetPwaCaches({ unregister: true })).resolves.toBeUndefined();
        expect(borrados).toEqual([]);
    });

    it('nunca lanza: caches.keys() rechaza y getRegistrations() rechaza', async () => {
        (globalThis as any).caches = { keys: vi.fn(async () => { throw new Error('sin permiso'); }), delete: vi.fn() };
        Object.defineProperty(globalThis.navigator, 'serviceWorker', {
            configurable: true,
            value: { getRegistrations: vi.fn(async () => { throw new Error('bloqueado'); }) },
        });
        await expect(resetPwaCaches({ unregister: true })).resolves.toBeUndefined();
    });

    it('navegador sin Cache Storage ni service worker: no hace nada', async () => {
        delete (globalThis as any).caches;
        delete (globalThis.navigator as any).serviceWorker;
        await expect(resetPwaCaches({ unregister: true })).resolves.toBeUndefined();
    });
});

describe('resetPwaCachesAndReload', () => {
    it('limpia ANTES de recargar', async () => {
        const orden: string[] = [];
        (globalThis as any).caches = {
            keys: vi.fn(async () => ['a']),
            delete: vi.fn(async () => { orden.push('limpió'); return true; }),
        };
        const reload = vi.fn(() => { orden.push('recargó'); });
        Object.defineProperty(window, 'location', { configurable: true, value: { ...original.location, reload } });
        await resetPwaCachesAndReload();
        expect(orden).toEqual(['limpió', 'recargó']);
    });

    it('recarga aunque la limpieza falle', async () => {
        (globalThis as any).caches = { keys: vi.fn(async () => { throw new Error('x'); }), delete: vi.fn() };
        const reload = vi.fn();
        Object.defineProperty(window, 'location', { configurable: true, value: { ...original.location, reload } });
        await resetPwaCachesAndReload({ unregister: true });
        expect(reload).toHaveBeenCalledTimes(1);
    });
});

// Sin señal: abrir una pantalla no descargada recargaba y la app quedaba en la página
// de error del navegador. Sin red no se limpia ni se recarga: se espera a `online`.
describe('sin conexión', () => {
    it('estaSinConexion refleja navigator.onLine', () => {
        ponerSinConexion(true);
        expect(estaSinConexion()).toBe(true);
        ponerSinConexion(false);
        expect(estaSinConexion()).toBe(false);
    });

    it('resetPwaCaches no borra nada sin red (se perdería el shell que abre offline)', async () => {
        const unregister = vi.fn(async () => true);
        const { borrados } = instalarFalsos({ registros: [{ unregister }] });
        ponerSinConexion(true);
        await resetPwaCaches({ unregister: true });
        expect(borrados).toEqual([]);
        expect(unregister).not.toHaveBeenCalled();
    });

    it('resetPwaCachesAndReload espera al evento online antes de limpiar y recargar', async () => {
        const orden: string[] = [];
        (globalThis as any).caches = {
            keys: vi.fn(async () => ['a']),
            delete: vi.fn(async () => { orden.push('limpió'); return true; }),
        };
        const reload = vi.fn(() => { orden.push('recargó'); });
        Object.defineProperty(window, 'location', { configurable: true, value: { ...original.location, reload } });
        ponerSinConexion(true);

        const p = resetPwaCachesAndReload();
        await new Promise((r) => setTimeout(r, 10));
        expect(reload).not.toHaveBeenCalled();
        expect(orden).toEqual([]);

        ponerSinConexion(false);
        window.dispatchEvent(new Event('online'));
        await p;
        expect(orden).toEqual(['limpió', 'recargó']);
    });

    it('esperarConexion con red resuelve de inmediato', async () => {
        ponerSinConexion(false);
        await expect(esperarConexion()).resolves.toBeUndefined();
    });
});
