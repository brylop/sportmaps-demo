/**
 * shipping/index — Factory de provider segun env.
 *
 *  SHIPPING_PROVIDER=mock      (default)
 *  SHIPPING_PROVIDER=mox       (requiere MOX_API_KEY)
 *  SHIPPING_PROVIDER=drenvio   (requiere DRENVIO_API_KEY)
 *
 * Solo el mock provider esta implementado. Los otros lanzan error
 * indicando que falta la implementacion + credenciales.
 */

import { ShippingProvider } from './types';
import { MockShippingProvider } from './mock-provider';

export * from './types';

let _instance: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
    if (_instance) return _instance;

    const providerName = (process.env.SHIPPING_PROVIDER || 'mock').toLowerCase();

    switch (providerName) {
        case 'mock':
            _instance = new MockShippingProvider();
            break;

        case 'mox':
            throw new Error(
                'MoxProvider no implementado todavía. Para activarlo: setear SHIPPING_PROVIDER=mock o agregar la implementación en services/shipping/mox-provider.ts y registrarla aquí.',
            );

        case 'drenvio':
            throw new Error(
                'DrenvioProvider no implementado todavía.',
            );

        default:
            throw new Error(`SHIPPING_PROVIDER desconocido: ${providerName}`);
    }

    return _instance;
}

/** Solo para tests — fuerza un provider especifico */
export function setShippingProvider(p: ShippingProvider) {
    _instance = p;
}
