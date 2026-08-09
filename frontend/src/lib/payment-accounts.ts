/**
 * Llaves de pago de una escuela — fuente unica para el panel y para el acudiente.
 *
 * Viven en school_settings.payment_accounts (jsonb, migracion 20260809095613).
 * Antes cada canal era una columna suelta y solo cabia un valor por tipo; hoy la
 * escuela registra las que necesite y ESA lista es la que ve el acudiente en su
 * modal de pago y contra la que el OCR compara el destino del comprobante
 * (bff/services/receipt-verdict, check 4 DESTINO_NO_COINCIDE).
 *
 * Las columnas viejas (nequi_number, daviplata_number, breb_number, breb_key,
 * transfer_key) siguen existiendo como respaldo de lectura: `resolvePaymentAccounts`
 * las convierte al vuelo cuando la lista todavia no fue guardada, para que ninguna
 * escuela quede sin datos de pago entre el deploy y el primer guardado.
 */

export type PaymentAccountType = 'breb' | 'nequi' | 'daviplata' | 'transfer_key';

export interface PaymentAccount {
    id: string;
    type: PaymentAccountType;
    /** Etiqueta libre para distinguir dos llaves del mismo tipo ("Bre-B Davivienda"). */
    label: string;
    value: string;
    /** false = la escuela la conserva pero deja de mostrarla al acudiente. */
    active: boolean;
}

export const PAYMENT_ACCOUNT_TYPES: { value: PaymentAccountType; label: string; placeholder: string }[] = [
    { value: 'breb',         label: 'Bre-B',                  placeholder: 'Celular, correo, cédula o @alias' },
    { value: 'nequi',        label: 'Nequi',                  placeholder: 'Celular' },
    { value: 'daviplata',    label: 'Daviplata',              placeholder: 'Celular' },
    { value: 'transfer_key', label: 'Llave de transferencia', placeholder: 'Celular, correo o alias' },
];

export function accountTypeLabel(type: string): string {
    return PAYMENT_ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;
}

export function accountPlaceholder(type: string): string {
    return PAYMENT_ACCOUNT_TYPES.find(t => t.value === type)?.placeholder ?? 'Valor de la llave';
}

/** Lo que se muestra al acudiente: la etiqueta si la escuela la escribió, si no el tipo. */
export function accountDisplayLabel(account: PaymentAccount): string {
    const label = account.label?.trim();
    if (!label) return accountTypeLabel(account.type);
    // Evita "Nequi · Nequi" cuando la etiqueta ya es el nombre del canal.
    if (label.toLowerCase() === accountTypeLabel(account.type).toLowerCase()) return label;
    return `${label} · ${accountTypeLabel(account.type)}`;
}

const VALID_TYPES = new Set<string>(PAYMENT_ACCOUNT_TYPES.map(t => t.value));

/** Ids estables para el editor: crypto.randomUUID no existe en contextos no seguros. */
export function newAccountId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `acc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Normaliza lo que venga de la BD (jsonb sin esquema garantizado) a PaymentAccount[].
 * Descarta elementos sin valor o de tipo desconocido en vez de romper el render.
 */
export function parsePaymentAccounts(raw: unknown): PaymentAccount[] {
    if (!Array.isArray(raw)) return [];
    const out: PaymentAccount[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const row = item as Record<string, unknown>;
        const type = String(row.type ?? '');
        const value = typeof row.value === 'string' ? row.value.trim() : '';
        if (!VALID_TYPES.has(type) || !value) continue;
        out.push({
            id: typeof row.id === 'string' && row.id ? row.id : newAccountId(),
            type: type as PaymentAccountType,
            label: typeof row.label === 'string' ? row.label : '',
            value,
            // Solo `false` explícito oculta: un registro viejo sin la clave se muestra.
            active: row.active !== false,
        });
    }
    return out;
}

/** Columnas legacy de school_settings, en el orden en que se mostraban antes. */
export interface LegacyAccountColumns {
    nequi_number?: string | null;
    daviplata_number?: string | null;
    breb_number?: string | null;
    breb_key?: string | null;
    transfer_key?: string | null;
}

const LEGACY_MAP: { column: keyof LegacyAccountColumns; type: PaymentAccountType }[] = [
    { column: 'transfer_key',     type: 'transfer_key' },
    { column: 'nequi_number',     type: 'nequi' },
    { column: 'daviplata_number', type: 'daviplata' },
    { column: 'breb_number',      type: 'breb' },
    { column: 'breb_key',         type: 'breb' },
];

/** Misma normalización que normalizeDestination() en el BFF, para deduplicar. */
function normalizeValue(value: string): string {
    return value.toUpperCase().replace(/[\s.-]/g, '');
}

export function legacyColumnsToAccounts(source: LegacyAccountColumns | null | undefined): PaymentAccount[] {
    if (!source) return [];
    const seen = new Set<string>();
    const out: PaymentAccount[] = [];
    for (const { column, type } of LEGACY_MAP) {
        const value = (source[column] ?? '').toString().trim();
        if (!value) continue;
        const key = `${type}:${normalizeValue(value)}`;
        if (seen.has(key)) continue;   // breb_key y breb_number suelen ser la misma llave
        seen.add(key);
        out.push({ id: `legacy_${column}`, type, label: accountTypeLabel(type), value, active: true });
    }
    return out;
}

/**
 * Llaves a mostrar al acudiente: la lista si existe, si no las columnas viejas.
 * `onlyActive` por defecto — el panel del admin pasa false para editar también
 * las que estan apagadas.
 */
export function resolvePaymentAccounts(
    source: (LegacyAccountColumns & { payment_accounts?: unknown }) | null | undefined,
    { onlyActive = true }: { onlyActive?: boolean } = {},
): PaymentAccount[] {
    if (!source) return [];
    const parsed = parsePaymentAccounts(source.payment_accounts);
    const accounts = parsed.length > 0 ? parsed : legacyColumnsToAccounts(source);
    return onlyActive ? accounts.filter(a => a.active) : accounts;
}

/**
 * Espejo de la lista hacia las columnas viejas: la PRIMERA llave activa de cada
 * tipo. Se sigue guardando porque hay lectores fuera de este flujo (clientes ya
 * desplegados, el select de respaldo del BFF) que aun apuntan ahi.
 */
export function accountsToLegacyColumns(accounts: PaymentAccount[]): Required<Omit<LegacyAccountColumns, 'breb_key'>> {
    const firstOf = (type: PaymentAccountType) =>
        accounts.find(a => a.active && a.type === type && a.value.trim())?.value.trim() ?? null;
    return {
        nequi_number:     firstOf('nequi'),
        daviplata_number: firstOf('daviplata'),
        breb_number:      firstOf('breb'),
        transfer_key:     firstOf('transfer_key'),
    };
}

/** Payload listo para jsonb: sin espacios sobrantes y sin filas a medio llenar. */
export function serializePaymentAccounts(accounts: PaymentAccount[]): PaymentAccount[] {
    return accounts
        .map(a => ({ ...a, label: a.label.trim(), value: a.value.trim() }))
        .filter(a => a.value.length > 0);
}
