// Espejo de nombres comerciales de ACADEMY_TIERS (frontend/src/config/saas-plans.ts).
// Solo para mostrar en el PDF/email — la fuente de verdad de precios vive en
// la RPC generate_school_subscription_invoice (supabase/migrations).
export const ACADEMY_PLAN_NAMES: Record<string, string> = {
    starter: 'Free Start',
    start: 'Escuela Start',
    crecimiento: 'Escuela Crecimiento',
    profesional: 'Escuela Pro',
    elite: 'Escuela Elite',
    enterprise: 'Custom',
};

// Espejo de ADDONS (frontend/src/config/saas-plans.ts). Solo nombres.
export const ADDON_NAMES: Record<string, string> = {
    accounting: 'Contabilidad',
    invoicing: 'Facturación electrónica',
    tournaments: 'Torneos',
    store: 'Tienda escolar',
    nutrition: 'Nutrición',
    biomech: 'Biomecánica',
    access_control: 'Control de acceso',
    pwa_branding: 'PWA con tu marca',
    whitelabel: 'App nativa propia',
    whatsapp: 'WhatsApp campañas',
    wompi: 'Pasarela Wompi',
    mp: 'Pasarela MercadoPago',
};

export interface SaasInvoiceLineItem {
    kind: 'plan' | 'addon';
    code: string;
    amount_cents: number;
    negotiated?: boolean;
}

export interface SaasInvoiceLine {
    label: string;
    amount_cents: number;
}

/**
 * Líneas visibles de una factura. `line_items` existe desde la migración
 * 20260929183752; las facturas anteriores lo traen vacío y su total es
 * solo el plan, así que se arma una línea única con el total.
 */
export function invoiceLines(invoice: { plan_code: string; amount_cents: number; line_items?: SaasInvoiceLineItem[] | null }): SaasInvoiceLine[] {
    const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
    if (items.length === 0) {
        return [{ label: `Plan ${ACADEMY_PLAN_NAMES[invoice.plan_code] ?? invoice.plan_code}`, amount_cents: invoice.amount_cents }];
    }
    return items.map((it) => ({
        label: it.kind === 'plan'
            ? `Plan ${ACADEMY_PLAN_NAMES[it.code] ?? it.code}`
            : `Adicional: ${ADDON_NAMES[it.code] ?? it.code}`,
        amount_cents: it.amount_cents,
    }));
}
