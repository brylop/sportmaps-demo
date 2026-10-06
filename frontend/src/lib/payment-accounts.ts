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

/** Categorías de cobro (CHECK de payments.payment_category). */
export type PaymentChargeCategory = 'mensualidad' | 'inscripcion' | 'articulos' | 'torneo' | 'otro' | 'seguro' | 'excedente';
const CHARGE_CATEGORIES: PaymentChargeCategory[] = ['mensualidad', 'inscripcion', 'articulos', 'torneo', 'otro', 'seguro', 'excedente'];

export interface PaymentAccount {
    id: string;
    type: PaymentAccountType;
    /** Etiqueta libre para distinguir dos llaves del mismo tipo ("Bre-B Davivienda"). */
    label: string;
    value: string;
    /** false = la escuela la conserva pero deja de mostrarla al acudiente. */
    active: boolean;
    /**
     * Si trae categorías, la llave SOLO vale para esos cobros: se muestra al
     * acudiente únicamente al pagar uno de ellos, el bot de WhatsApp no la
     * ofrece, y el verificador la acepta solo para ese concepto (para otro, el
     * comprobante queda en revisión). Caso Dynasty 2026-10-05: Nequi personal de
     * la dueña, solo para inscripciones. Ausente/vacía = vale para todo.
     */
    only_for?: PaymentChargeCategory[];
}

/** ¿La llave sirve para pagar un cobro de esta categoría? Desconocida = solo las generales. */
export function accountAppliesTo(account: Pick<PaymentAccount, 'only_for'>, category: PaymentChargeCategory | null | undefined): boolean {
    if (!account.only_for || account.only_for.length === 0) return true;
    return !!category && account.only_for.includes(category);
}

/**
 * Categoría de un cobro: `payment_category` si es específica; si falta o es
 * 'otro', el texto del concepto (`payment_type` NO distingue matrícula de
 * mensualidad). Misma regla que `categoriaDeCobro` del BFF.
 */
export function chargeCategoryOf(
    paymentCategory: string | null | undefined,
    concept: string | null | undefined,
): PaymentChargeCategory | null {
    const isCat = (v: unknown): v is PaymentChargeCategory => CHARGE_CATEGORIES.includes(v as PaymentChargeCategory);
    if (isCat(paymentCategory) && paymentCategory !== 'otro') return paymentCategory;
    const c = (concept ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (c) {
        if (/matricul|inscrip/.test(c)) return 'inscripcion';
        if (/mensualidad|mensual/.test(c)) return 'mensualidad';
        if (/torneo/.test(c)) return 'torneo';
        if (/uniforme|articulo|kit\b|dotacion/.test(c)) return 'articulos';
    }
    return paymentCategory === 'otro' ? 'otro' : null;
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
        // Se conserva `only_for`: si este parseo la descartara, guardar el panel
        // borraría la restricción y la llave volvería a valer para todo.
        const onlyFor = Array.isArray(row.only_for)
            ? (row.only_for as unknown[]).filter((c): c is PaymentChargeCategory => CHARGE_CATEGORIES.includes(c as PaymentChargeCategory))
            : [];
        out.push({
            id: typeof row.id === 'string' && row.id ? row.id : newAccountId(),
            type: type as PaymentAccountType,
            label: typeof row.label === 'string' ? row.label : '',
            value,
            // Solo `false` explícito oculta: un registro viejo sin la clave se muestra.
            active: row.active !== false,
            ...(onlyFor.length > 0 ? { only_for: onlyFor } : {}),
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
 * las que estan apagadas (y entonces ve también las restringidas).
 * `category`: el cobro que se va a pagar. Al acudiente solo se le muestran las
 * llaves generales y las restringidas a esa categoría (`only_for`).
 */
export function resolvePaymentAccounts(
    source: (LegacyAccountColumns & { payment_accounts?: unknown }) | null | undefined,
    { onlyActive = true, category = null }: { onlyActive?: boolean; category?: PaymentChargeCategory | null } = {},
): PaymentAccount[] {
    if (!source) return [];
    const parsed = parsePaymentAccounts(source.payment_accounts);
    const accounts = parsed.length > 0 ? parsed : legacyColumnsToAccounts(source);
    return onlyActive ? accounts.filter(a => a.active && accountAppliesTo(a, category)) : accounts;
}

/**
 * Espejo de la lista hacia las columnas viejas: la PRIMERA llave activa de cada
 * tipo. Se sigue guardando porque hay lectores fuera de este flujo (clientes ya
 * desplegados, el select de respaldo del BFF) que aun apuntan ahi.
 */
export function accountsToLegacyColumns(accounts: PaymentAccount[]): Required<Omit<LegacyAccountColumns, 'breb_key'>> {
    // Las restringidas (`only_for`) NO se espejan: las columnas sueltas las leen
    // caminos que no conocen la restricción (bot, RPCs de pago) y la volverían
    // una llave para todo.
    const firstOf = (type: PaymentAccountType) =>
        accounts.find(a => a.active && !(a.only_for && a.only_for.length > 0) && a.type === type && a.value.trim())?.value.trim() ?? null;
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
