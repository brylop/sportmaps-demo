/**
 * Source of truth para bancos colombianos, tipos de cuenta y tipos de documento.
 *
 * Reemplaza a las listas inline en hooks/usePayouts.ts y constantes duplicadas
 * en VendorOnboardingPage. Cualquier formulario nuevo que capture datos
 * bancarios debe consumir desde aqui.
 */

export interface BankOption {
    value: string;
    label: string;
}

export interface BankGroup {
    group: string;
    options: BankOption[];
}

export interface AccountTypeOption {
    value: string;
    label: string;
    hint?: string;
    /** Si es true, el "número" en realidad es un alias/celular/llave en vez de un número de cuenta. */
    isWallet?: boolean;
}

export interface DocumentTypeOption {
    value: string;
    label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bancos colombianos — agrupados por tipo (tradicional vs neobancos/billeteras)
// ─────────────────────────────────────────────────────────────────────────────
export const COLOMBIAN_BANKS: BankGroup[] = [
    {
        group: 'Bancos tradicionales',
        options: [
            { value: 'bancolombia',                    label: 'Bancolombia' },
            { value: 'davivienda',                     label: 'Davivienda' },
            { value: 'banco_bogota',                   label: 'Banco de Bogotá' },
            { value: 'bbva',                           label: 'BBVA Colombia' },
            { value: 'av_villas',                      label: 'Banco AV Villas' },
            { value: 'banco_popular',                  label: 'Banco Popular' },
            { value: 'banco_occidente',                label: 'Banco de Occidente' },
            { value: 'itau',                           label: 'Itaú Colombia' },
            { value: 'scotiabank',                     label: 'Scotiabank Colpatria' },
            { value: 'banco_caja_social',              label: 'Banco Caja Social' },
            { value: 'banco_falabella',                label: 'Banco Falabella' },
            { value: 'banco_agrario',                  label: 'Banco Agrario' },
            { value: 'banco_pichincha',                label: 'Banco Pichincha' },
            { value: 'banco_gnb',                      label: 'Banco GNB Sudameris' },
            { value: 'banco_serfinanza',               label: 'Banco Serfinanza' },
            { value: 'bancoomeva',                     label: 'Bancoomeva' },
            { value: 'banco_cooperativo_coopcentral',  label: 'Banco Cooperativo Coopcentral' },
            { value: 'bancow',                         label: 'BancoW' },
            { value: 'bancamia',                       label: 'Bancamía' },
        ],
    },
    {
        group: 'Neobancos y billeteras digitales',
        options: [
            { value: 'nequi',     label: 'Nequi' },
            { value: 'daviplata', label: 'Daviplata' },
            { value: 'lulo_bank', label: 'Lulo Bank' },
            { value: 'nu',        label: 'Nu Colombia' },
            { value: 'rappipay',  label: 'RappiPay' },
            { value: 'movii',     label: 'Movii' },
            { value: 'powwi',     label: 'Powwi' },
            { value: 'tpaga',     label: 'tpaga' },
            { value: 'iris',      label: 'Iris (Bancolombia)' },
            { value: 'uala',      label: 'Ualá' },
            { value: 'bancolombia_a_la_mano', label: 'Bancolombia a la Mano' },
        ],
    },
];

/** Mapa value -> label para mostrar etiquetas legibles. */
export const BANK_LABEL: Record<string, string> = Object.fromEntries(
    COLOMBIAN_BANKS.flatMap(g => g.options.map(o => [o.value, o.label])),
);

/**
 * Lista plana de bancos (compat con hooks/usePayouts.ts BANK_OPTIONS).
 * Se mantiene para no romper imports existentes.
 */
export const BANK_OPTIONS_FLAT: BankOption[] = COLOMBIAN_BANKS.flatMap(g => g.options);


// ─────────────────────────────────────────────────────────────────────────────
// Tipos de cuenta — tradicionales + billeteras + Bre-B interoperabilidad
// ─────────────────────────────────────────────────────────────────────────────
export const ACCOUNT_TYPES: AccountTypeOption[] = [
    { value: 'ahorros',                label: 'Cuenta de ahorros' },
    { value: 'corriente',              label: 'Cuenta corriente' },
    { value: 'nequi',                  label: 'Nequi',                  hint: 'Solo número de celular',                                                             isWallet: true },
    { value: 'daviplata',              label: 'Daviplata',              hint: 'Solo número de celular',                                                             isWallet: true },
    { value: 'bre_b',                  label: 'Bre-B',                  hint: 'Llave única interoperable (celular, correo, cédula o @llave)',                       isWallet: true },
    { value: 'bancolombia_a_la_mano',  label: 'Bancolombia a la Mano',  hint: 'Cuenta digital sin trámite',                                                          isWallet: true },
    { value: 'wallet',                 label: 'Otra billetera digital',                                                                                              isWallet: true },
];

/** Mapa value -> label para mostrar etiquetas legibles. */
export const ACCOUNT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
    ACCOUNT_TYPES.map(t => [t.value, t.label]),
);

/** Devuelve true si el tipo de cuenta funciona con celular/alias en vez de número tradicional. */
export function isWalletAccountType(type: string | undefined | null): boolean {
    if (!type) return false;
    return ACCOUNT_TYPES.find(t => t.value === type)?.isWallet ?? false;
}

/** Devuelve el placeholder apropiado para el campo "número de cuenta" segun el tipo seleccionado. */
export function accountNumberPlaceholder(type: string | undefined | null): string {
    if (type === 'nequi' || type === 'daviplata') return '300 123 4567';
    if (type === 'bre_b') return '@tu_llave  /  correo  /  cédula  /  celular';
    if (type === 'bancolombia_a_la_mano') return 'Número de celular';
    if (type === 'wallet') return 'Identificador de la billetera';
    return '123-456789-00';
}

/** Devuelve el label apropiado para el campo "número de cuenta" segun el tipo seleccionado. */
export function accountNumberLabel(type: string | undefined | null): string {
    return isWalletAccountType(type) ? 'Número / Llave' : 'Número de cuenta';
}


// ─────────────────────────────────────────────────────────────────────────────
// Tipos de documento del titular
// ─────────────────────────────────────────────────────────────────────────────
export const DOCUMENT_TYPES: DocumentTypeOption[] = [
    { value: 'CC',   label: 'Cédula de ciudadanía' },
    { value: 'CE',   label: 'Cédula de extranjería' },
    { value: 'NIT',  label: 'NIT' },
    { value: 'PASS', label: 'Pasaporte' },
    { value: 'PEP',  label: 'Permiso especial (PEP)' },
];

export const DOCUMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
    DOCUMENT_TYPES.map(t => [t.value, t.label]),
);
