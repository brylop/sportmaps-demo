/**
 * Tienda de la escuela — lado administración (Tienda → Ajustes → Cobros).
 *
 * Contrato con la base (migración 20261008163336):
 *   my_school_store(p_school_id)                 → la tienda de la escuela si la administro
 *   store_admin_settings(p_vendor_profile_id)    → estado, llaves enmascaradas, sedes, pasarelas, ajustes
 *   set_store_payment_settings(p_vendor_profile_id, p_settings)
 *
 * Lógica pura (sin React) para poder probarla con vitest.
 */

export const SCHOOL_STORE_SETTINGS_PATH = '/tienda-escuela/ajustes';
/** Donde la escuela edita sus llaves de pago y conecta Wompi / Mercado Pago. */
export const SCHOOL_PAYMENTS_CONFIG_PATH = '/payments-automation?tab=config';
export const STORE_ADDON_UPSELL_PATH = '/mi-plan?upsell=store';

export type AccountIneligibleReason = 'inactive' | 'empty' | 'payment_link' | 'restricted';

export interface StoreAdminAccount {
    id: string;
    type: string;
    label?: string;
    bank?: string;
    value_masked?: string;
    eligible: boolean;
    selected: boolean;
    reason?: AccountIneligibleReason | null;
}

export interface StoreAdminBranch {
    id: string;
    name: string;
    address?: string;
    is_main: boolean;
    selected: boolean;
}

export interface StorePaymentSettingsRow {
    vendor_profile_id: string;
    accept_wompi: boolean;
    accept_mercadopago: boolean;
    accept_transfer: boolean;
    accept_cash_pickup: boolean;
    transfer_instructions: string | null;
    transfer_hold_hours: number;
    cash_hold_hours: number;
    transfer_account_ids: string[] | null;
    allow_shipping: boolean;
    pickup_branch_ids: string[] | null;
}

export interface StoreAdminStatus {
    selling: boolean;
    store_enabled: boolean;
    in_pilot: boolean;
    addon: boolean | null;
    operational: boolean | null;
    can_sell_products: boolean;
}

export interface StoreAdminSettings {
    store: { id: string; slug: string | null; display_name: string | null; vendor_type: string; school_id: string | null };
    status: StoreAdminStatus;
    settings: StorePaymentSettingsRow | null;
    accounts: StoreAdminAccount[];
    branches: StoreAdminBranch[];
    gateways: { wompi: boolean; mercadopago: boolean };
}

/** Estado editable del formulario. */
export interface StoreSettingsForm {
    acceptTransfer: boolean;
    /** true = todas las llaves aptas (también las que se agreguen después). */
    allAccounts: boolean;
    accountIds: string[];
    acceptCash: boolean;
    acceptWompi: boolean;
    acceptMercadoPago: boolean;
    allowShipping: boolean;
    /** true = todas las sedes activas. */
    allBranches: boolean;
    branchIds: string[];
    transferInstructions: string;
}

/** Valores que usa enable_school_store si la tienda todavía no tiene fila. */
export const DEFAULT_TRANSFER_INSTRUCTIONS = 'Escribe la referencia del pedido en la descripción de la transferencia.';

export function formFromAdminSettings(a: StoreAdminSettings): StoreSettingsForm {
    const s = a.settings;
    const eligibleIds = a.accounts.filter(x => x.eligible).map(x => x.id);
    return {
        acceptTransfer: s ? s.accept_transfer : eligibleIds.length > 0,
        allAccounts: !s || s.transfer_account_ids === null,
        accountIds: s?.transfer_account_ids
            ? s.transfer_account_ids.filter(id => eligibleIds.includes(id))
            : eligibleIds,
        acceptCash: s ? s.accept_cash_pickup : true,
        acceptWompi: !!s?.accept_wompi && a.gateways.wompi,
        acceptMercadoPago: !!s?.accept_mercadopago && a.gateways.mercadopago,
        allowShipping: s ? s.allow_shipping : false,
        allBranches: !s || s.pickup_branch_ids === null,
        branchIds: s?.pickup_branch_ids ?? a.branches.map(b => b.id),
        transferInstructions: s?.transfer_instructions ?? DEFAULT_TRANSFER_INSTRUCTIONS,
    };
}

/** Body de set_store_payment_settings. Nunca manda llaves no aptas ni sedes ajenas. */
export function settingsPayload(f: StoreSettingsForm, a: Pick<StoreAdminSettings, 'accounts' | 'branches' | 'gateways'>) {
    const eligible = new Set(a.accounts.filter(x => x.eligible).map(x => x.id));
    const branches = new Set(a.branches.map(b => b.id));
    return {
        accept_transfer: f.acceptTransfer,
        accept_cash_pickup: f.acceptCash,
        accept_wompi: f.acceptWompi && a.gateways.wompi,
        accept_mercadopago: f.acceptMercadoPago && a.gateways.mercadopago,
        transfer_account_ids: f.allAccounts ? null : f.accountIds.filter(id => eligible.has(id)),
        allow_shipping: f.allowShipping,
        // Sin sedes registradas no hay qué elegir: null = la principal.
        pickup_branch_ids: f.allBranches || a.branches.length === 0 ? null : f.branchIds.filter(id => branches.has(id)),
        transfer_instructions: f.transferInstructions.trim() || null,
    };
}

/** Errores de validación ANTES de llamar a la base (mismos que la base, con copy). */
export function validateStoreSettings(f: StoreSettingsForm, a: Pick<StoreAdminSettings, 'accounts' | 'branches'>): string | null {
    if (!f.acceptTransfer && !f.acceptCash && !f.acceptWompi && !f.acceptMercadoPago) {
        return 'Deja al menos un medio de pago encendido.';
    }
    const eligible = a.accounts.filter(x => x.eligible);
    if (f.acceptTransfer && eligible.length === 0) {
        return 'Para recibir transferencias registra primero una cuenta de la escuela que no sea solo para inscripciones.';
    }
    if (f.acceptTransfer && !f.allAccounts && f.accountIds.filter(id => eligible.some(e => e.id === id)).length === 0) {
        return 'Elige al menos una cuenta para mostrar en la tienda.';
    }
    if (!f.allBranches && a.branches.length > 0 && f.branchIds.length === 0) {
        return 'Elige al menos una sede de retiro.';
    }
    return null;
}

const REASON_LABEL: Record<AccountIneligibleReason, string> = {
    restricted: 'Solo para otro uso (por ejemplo, inscripciones)',
    inactive: 'Apagada',
    empty: 'Sin número',
    payment_link: 'Link de pago: no aplica para la tienda',
};

export function accountReasonLabel(reason: AccountIneligibleReason | null | undefined): string | null {
    return reason ? REASON_LABEL[reason] ?? null : null;
}

/** Mensaje de habilitación de la tienda (SportMaps la habilita tras activarla). */
export function storeStatusMessage(st: StoreAdminStatus): { tone: 'ok' | 'wait' | 'action'; title: string; description: string } {
    if (st.selling) {
        return {
            tone: 'ok',
            title: 'Tu tienda está abierta',
            description: 'Tus deportistas y familias ya pueden comprar con el enlace de la tienda.',
        };
    }
    if (st.addon === false) {
        return {
            tone: 'action',
            title: 'Falta el adicional Tienda',
            description: 'Agrégalo en Mi plan para poder vender.',
        };
    }
    if (st.operational === false) {
        return {
            tone: 'action',
            title: 'Tu cuenta no está operativa',
            description: 'Revisa el estado de tu plan en Mi plan para volver a vender.',
        };
    }
    return {
        tone: 'wait',
        title: 'SportMaps está habilitando tu tienda',
        description:
            'Ya puedes cargar productos y dejar listos los cobros. Te avisamos cuando quede abierta para comprar; ' +
            'mientras tanto el enlace muestra que la tienda todavía no está disponible.',
    };
}

/** Enlace público de la tienda. */
export function storePublicUrl(origin: string, slug: string): string {
    return `${origin.replace(/\/+$/, '')}/tienda/${encodeURIComponent(slug)}`;
}

/** Copy de los errores de set_store_payment_settings. */
export function storeSettingsErrorMessage(err: unknown): string {
    const msg = String((err as { message?: string } | null)?.message ?? err ?? '');
    if (msg.includes('NO_TRANSFER_ACCOUNTS')) return 'No hay cuentas para mostrar: elige al menos una o apaga la transferencia.';
    if (msg.includes('INVALID_TRANSFER_ACCOUNT')) return 'Una de las cuentas elegidas está apagada o es solo para otro uso.';
    if (msg.includes('GATEWAY_NOT_CONFIGURED')) return 'Esa pasarela no está conectada. Conéctala en Pagos → Configuración.';
    if (msg.includes('PICKUP_BRANCH_REQUIRED')) return 'Elige al menos una sede de retiro.';
    if (msg.includes('INVALID_PICKUP_BRANCH')) return 'Una de las sedes elegidas ya no está activa.';
    if (msg.includes('NO_PAYMENT_METHODS')) return 'Deja al menos un medio de pago encendido.';
    if (msg.includes('NOT_OWNER') || msg.includes('42501')) return 'Solo el dueño o un administrador de la escuela puede cambiar los cobros.';
    return 'No se pudieron guardar los cambios. Intenta de nuevo.';
}
