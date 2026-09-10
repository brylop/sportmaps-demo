/**
 * invoice-provider.resolver — decide qué facturador (PAC) usar para un dueño.
 *
 * Análogo a payment-provider.resolver pero para facturación electrónica. Lee
 * electronic_invoice_providers (owner_type/owner_id) y devuelve la config con
 * credenciales completas. SOLO uso interno del BFF (service_role): las
 * credenciales NUNCA se exponen al cliente.
 */

import { supabase } from '../config/supabase';
import { ProviderConfig } from './invoicing/types';

export type OwnerType = 'school' | 'vendor' | 'organizer';

/**
 * Resuelve el facturador efectivo para un dueño: is_default gana, si no el
 * primer enabled. Devuelve null si el dueño no tiene facturador configurado.
 *
 * `includeDisabled` es para RECONCILIAR, no para emitir: apagar el facturador
 * detiene la emisión, pero las facturas que YA salieron siguen necesitando que
 * se les complete número y CUFE. Sin esta opción, apagar el facturador dejaba
 * esos documentos huérfanos para siempre.
 */
export async function resolveInvoiceProvider(
    ownerType: OwnerType,
    ownerId: string,
    opts?: { includeDisabled?: boolean },
): Promise<ProviderConfig | null> {
    let query = supabase
        .from('electronic_invoice_providers')
        .select('provider, credentials, config, sandbox, is_default')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId);

    if (!opts?.includeDisabled) query = query.eq('enabled', true);

    const { data, error } = await query.order('is_default', { ascending: false });

    if (error) {
        console.error('[invoice-provider.resolver]', error.message);
        return null;
    }

    const row = (data ?? [])[0];
    if (!row) return null;

    return {
        provider: row.provider,
        sandbox: row.sandbox,
        credentials: (row.credentials as Record<string, any>) ?? {},
        config: (row.config as Record<string, any>) ?? {},
    };
}
