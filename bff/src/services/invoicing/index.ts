/**
 * invoicing — registro de adaptadores de facturación electrónica.
 *
 * Para sumar un PAC nuevo (Siigo, Alegra, …): crear su *.adapter.ts que
 * implemente InvoicingAdapter y registrarlo aquí. Nada más.
 */

import { InvoicingAdapter } from './types';
import { factusAdapter } from './factus.adapter';

const adapters: Record<string, InvoicingAdapter> = {
    [factusAdapter.provider]: factusAdapter,
    // siigo:  siigoAdapter,
    // alegra: alegraAdapter,
};

export function getAdapter(provider: string): InvoicingAdapter | null {
    return adapters[provider] ?? null;
}

export function listSupportedProviders(): string[] {
    return Object.keys(adapters);
}

export * from './types';
