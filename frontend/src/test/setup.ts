import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for components that use it
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// ResizeObserver e IntersectionObserver van como CLASES, no como
// `vi.fn().mockImplementation(() => ({...}))`.
//
// Con una arrow function como implementación, `new ResizeObserver(cb)` lanza
// «is not a constructor»: una arrow no puede construirse. Nada lo notaba porque
// ningún test abría un Popover — y floating-ui, que es el motor de Popover y
// Select de Radix, los CONSTRUYE. O sea que este mock reventaba de entrada
// cualquier prueba de componente que abriera un desplegable: MunicipalitySelect,
// el tipo de documento, los Select de toda la app.
//
// Se agrega `takeRecords` y las props de solo lectura de IntersectionObserver
// porque son parte de la interfaz real y alguna librería las lee.
class ResizeObserverMock implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock;

class IntersectionObserverMock implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
}
global.IntersectionObserver = IntersectionObserverMock;
