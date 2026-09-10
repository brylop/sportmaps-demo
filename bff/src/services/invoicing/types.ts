/**
 * invoicing/types — contrato canónico de facturación electrónica (multi-PAC)
 * y los pocos helpers que TODOS los adaptadores tienen que compartir.
 *
 * SportMaps arma un InvoiceRequest canónico; cada facturador (Factus, Siigo,
 * Alegra, …) es un InvoicingAdapter que lo traduce a SU API. El resto del
 * sistema no conoce el PAC concreto. Agregar un facturador = implementar esta
 * interface y registrarlo en ./index.ts. CERO cambios de esquema (ver
 * migración 20260708000001).
 *
 * Los helpers del final (normalización del código DANE, mapa de medios de pago,
 * clasificación de errores del PAC) viven acá y no en un módulo aparte porque
 * son la ÚNICA copia: cada vez que uno de ellos se duplicó dentro de un
 * adaptador, la copia se desincronizó y el bug volvió una capa más abajo (ver
 * el comentario de `normalizeDaneMunicipality`).
 */

export type DocumentKind = 'invoice' | 'credit_note' | 'debit_note';

/** Datos fiscales del adquirente (el papá/atleta que paga). */
export interface InvoiceCustomer {
    documentType: string;             // CC | CE | NIT | PASAPORTE | TI | RC
    identification: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    department?: string | null;       // texto libre (profiles.billing_state_dane)
    city?: string | null;             // texto libre (profiles.billing_city_dane)
    /**
     * Código DANE del municipio del cliente: 5 dígitos, CON el cero inicial
     * ('05001' Medellín, '11001' Bogotá). Es un STRING y no un número a
     * propósito: `Number('05001')` da 5001, que no es ningún municipio del
     * catálogo, y así se rompían los 148 municipios de Antioquia (05xxx) y
     * Atlántico (08xxx) — Medellín, Envigado, Barranquilla, Soledad…
     * null = no lo sabemos (ver `resolveCustomerMunicipality`).
     */
    municipalityCode?: string | null;
}

/** Una línea de la factura. unitPrice es IVA-incluido salvo isExcluded. */
export interface InvoiceLine {
    codeReference: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountRate?: number;            // %
    taxRate: number;                  // 19 | 5 | 0
    isExcluded?: boolean;             // excluido de IVA (educación/deporte)
}

export interface InvoiceRequest {
    referenceCode: string;            // idempotencia (generado por nosotros)
    documentType: DocumentKind;
    customer: InvoiceCustomer;
    items: InvoiceLine[];
    observation?: string;
    /**
     * Medio de pago REAL tal como lo guarda SportMaps ('cash' | 'transfer' |
     * 'pse' | 'card' | 'other' | null). Es el valor crudo, no un código del
     * PAC: traducirlo es trabajo del adaptador (`resolvePaymentMethodCode`),
     * porque el catálogo de códigos es de la DIAN vía Factus y otro PAC podría
     * usar otro. Sin este campo el adaptador clavaba '10' = efectivo para
     * TODO: 350 de 443 pagos de Dynasty (79%, $53,8M) se habrían declarado en
     * efectivo sin haberlo sido, y eso rompe cualquier cruce con el extracto.
     */
    paymentMethod?: string | null;
}

// ─── Nota crédito (el único camino para deshacer una factura) ─────────────────

/**
 * Concepto de corrección de la DIAN. Catálogo oficial completo, verificado en
 * developers.factus.com.co/notas-credito (consultado 2026-09-10):
 *
 *   1  Devolución parcial de los bienes y/o no aceptación parcial del servicio
 *   2  Anulación de factura electrónica          ← el que anula
 *   3  Rebaja o descuento parcial o total
 *   4  Ajuste de precio
 *   5  Descuento comercial por pronto pago
 *   6  Descuento comercial por volumen de ventas
 *
 * Va como STRING porque el API lo declara string, y el catálogo se escribe
 * COMPLETO acá aunque hoy sólo se use el 2: el día que alguien necesite un
 * ajuste de precio, el código válido tiene que estar a la vista y no en el
 * historial de un chat.
 */
export type CorrectionConceptCode = '1' | '2' | '3' | '4' | '5' | '6';

export const CORRECTION_CONCEPTS: Record<CorrectionConceptCode, string> = {
    '1': 'Devolución parcial de los bienes y/o no aceptación parcial del servicio',
    '2': 'Anulación de factura electrónica',
    '3': 'Rebaja o descuento parcial o total',
    '4': 'Ajuste de precio',
    '5': 'Descuento comercial por pronto pago',
    '6': 'Descuento comercial por volumen de ventas',
};

/** Anulación total: el concepto que usa `voidInvoice` salvo que le pidan otro. */
export const CORRECTION_CONCEPT_ANULACION: CorrectionConceptCode = '2';

export function isCorrectionConceptCode(v: unknown): v is CorrectionConceptCode {
    return Object.prototype.hasOwnProperty.call(CORRECTION_CONCEPTS, String(v));
}

/**
 * Nota crédito canónica. Es una FACTURA AL REVÉS y comparte casi todo con
 * InvoiceRequest, pero tiene dos campos propios que no existen en una factura
 * y que son lo que la ata al documento que anula.
 *
 * `customer` SÍ ESTÁ ACÁ, y esto es una corrección sobre el diseño original,
 * no el diseño original: la doc de campos de V2 dice que el objeto `customer`
 * es OPCIONAL en la nota crédito y que, si no viaja, el API toma los datos del
 * adquirente de la factura referenciada. **Verificado contra el sandbox real
 * de Dynasty: es falso.** Omitir `customer` responde 422 con
 * `"El campo customer es obligatorio"` — el PAC no copia nada. Así que se
 * manda siempre, con el MISMO snapshot que se guardó al emitir la factura
 * original (`electronic_invoices.customer_snapshot`), no reconstruido desde
 * `profiles` hoy: `profiles` se edita (una cédula corregida, un nombre
 * completado), y una nota crédito a nombre de un adquirente DISTINTO del que
 * figura en la factura no empareja ante la DIAN.
 */
export const CREDIT_NOTE_OBSERVATION_MAX = 500;

export interface CreditNoteRequest {
    referenceCode: string;            // idempotencia (generado por nosotros)
    /**
     * NÚMERO de la factura que se anula ('DYTY1', 'SETP990000001'), NO un id
     * interno nuestro ni el uuid de la fila. Obligatorio salvo que
     * customization_id sea 22 (nota crédito sin referencia), que no usamos.
     */
    billNumber: string;
    correctionConceptCode: CorrectionConceptCode;
    /** El adquirente de la FACTURA ORIGINAL. Ver el comentario de arriba: es obligatorio, el PAC no lo copia solo. */
    customer: InvoiceCustomer;
    items: InvoiceLine[];
    /** Máx. CREDIT_NOTE_OBSERVATION_MAX caracteres; el adaptador lo recorta. */
    observation?: string;
    /** Mismo medio de pago crudo de SportMaps que en InvoiceRequest. */
    paymentMethod?: string | null;
}

/** Resultado normalizado de cualquier PAC. raw → electronic_invoices.dian_response. */
export interface InvoiceResult {
    status: 'accepted' | 'rejected' | 'sent';
    providerBillId?: string | null;
    prefix?: string | null;
    number?: string | null;
    dianCode?: string | null;
    cufe?: string | null;
    qrUrl?: string | null;
    qrImage?: string | null;
    publicUrl?: string | null;
    pdfUrl?: string | null;
    xmlUrl?: string | null;
    taxableAmount?: number | null;
    taxAmount?: number | null;
    total?: number | null;
    validatedAt?: string | null;
    errorMessage?: string | null;
    raw: unknown;
}

/**
 * Config resuelta desde electronic_invoice_providers (secretos, solo BFF).
 *
 * Claves de `config` que entiende el flujo (todas opcionales salvo la primera):
 *   numbering_range_id            rango de numeración del PAC (sin él no se emite)
 *   credit_note_numbering_range_id  rango de NOTA CRÉDITO. Es OTRO rango, con
 *                                 otro prefijo y otra resolución DIAN (en el
 *                                 sandbox de Dynasty: 5224/SETP para facturas,
 *                                 5225/NC para notas crédito). Ver
 *                                 `creditNoteNumberingRangeId`: sin esta clave
 *                                 NO se emite nota crédito.
 *   default_municipality_id       municipio del EMISOR. Se lee como STRING, ver
 *                                 `defaultMunicipalityCode`. OJO: el significado
 *                                 depende de la versión del API — en V2 es el
 *                                 código DANE ('11001'), en V1 es el id interno
 *                                 del catálogo de Factus ('169'). No son
 *                                 intercambiables.
 *   customer_municipality_policy  'fallback' (default) | 'omit' | 'require'.
 *                                 Ver `resolveCustomerMunicipality`.
 *   payment_method_codes          overrides { <nuestro medio>: <código DIAN> }
 *                                 para los medios que no pudimos confirmar en
 *                                 la tabla oficial. Ver `resolvePaymentMethodCode`.
 *   tax_excluded / default_tax_rate            mensualidades y servicios
 *   products_tax_excluded / products_tax_rate  productos físicos de tienda
 */
export interface ProviderConfig {
    provider: string;
    sandbox: boolean;
    credentials: Record<string, any>;  // Factus: {base_url?, client_id, client_secret, username, password}
    config: Record<string, any>;
}

export interface InvoicingAdapter {
    readonly provider: string;
    emit(req: InvoiceRequest, cfg: ProviderConfig): Promise<InvoiceResult>;
    /**
     * Consulta el estado real del documento en el PAC a partir del
     * reference_code que nosotros generamos. Necesario para los PACs que
     * validan ASÍNCRONO (Factus V2 en producción responde solo un acuse:
     * la factura nace sin número ni CUFE de nuestro lado y hay que
     * completarla después). Devuelve null si el PAC no conoce esa referencia.
     * Opcional: un PAC síncrono (Factus V1) no la necesita.
     */
    fetchByReference?(referenceCode: string, cfg: ProviderConfig): Promise<InvoiceResult | null>;
    /**
     * Emite la nota crédito que anula (o corrige) una factura ya emitida.
     *
     * OPCIONAL porque no todo adaptador la implementa: Factus V1 no la tiene
     * escrita y su única cuenta es la Escuela Demo en sandbox. Un dueño con un
     * PAC sin este método tiene que enterarse con un motivo claro
     * ('credit_note_not_supported:<provider>') y no con un
     * `adapter.emitCreditNote is not a function` a mitad del handler.
     */
    emitCreditNote?(req: CreditNoteRequest, cfg: ProviderConfig): Promise<InvoiceResult>;
    /**
     * `fetchByReference` para NOTAS CRÉDITO. Va aparte y no como un parámetro
     * de la otra porque en el PAC son DOS colecciones distintas: la nota
     * crédito no aparece en /v2/bills y preguntar por ella ahí devuelve «no
     * existe», que es indistinguible de «todavía no validó».
     *
     * Sin esto, en PRODUCCIÓN la nota crédito se queda sin número para siempre:
     * Factus V2 responde a la emisión solo con un acuse, así que la fila nace
     * en 'sent' con todo en null y la única forma de completarla es volver a
     * preguntar por reference_code. Una anulación sin número es una anulación
     * que no se puede demostrar.
     */
    fetchCreditNoteByReference?(referenceCode: string, cfg: ProviderConfig): Promise<InvoiceResult | null>;
}

/**
 * Rango de numeración de NOTA CRÉDITO del dueño. null = no configurado.
 *
 * Se exige SIEMPRE, aunque el API lo declare opcional «si la empresa tiene un
 * solo rango activo», y eso es deliberado: desde acá no hay forma de saber
 * cuántos rangos tiene activos la empresa, y el modo de fallar al adivinar es
 * el peor posible. PRODUCCIÓN de Dynasty tiene UN solo rango activo y es el de
 * FACTURAS (2697, prefijo DYTY): omitir la clave ahí no haría que el PAC
 * eligiera «el rango de notas crédito», haría que gastara un número de la
 * resolución de FACTURAS en una nota crédito. Un número de resolución quemado
 * no se recupera.
 *
 * Así que si falta, no se emite y el motivo dice qué hacer: crear el rango de
 * nota crédito en el portal del PAC y anotar su id acá. Eso NO lo arregla el
 * código.
 */
export function creditNoteNumberingRangeId(cfg: ProviderConfig): number | string | null {
    const raw = cfg.config?.credit_note_numbering_range_id;
    if (raw == null) return null;
    // El id viaja como número en la fila de Dynasty y como string si alguien lo
    // escribe a mano en el formulario; los dos son válidos para el PAC. Lo que
    // NO vale es una cadena vacía, que es lo que deja un input dejado en blanco
    // y que el PAC descartaría en silencio cayendo otra vez al rango por
    // defecto (= el de facturas).
    const s = String(raw).trim();
    if (!s || !/^\d+$/.test(s)) return null;
    return typeof raw === 'number' ? raw : s;
}

// ─── Municipio (código DANE) ──────────────────────────────────────────────────

/**
 * Normaliza un código DANE de municipio a los 5 dígitos CON el cero inicial.
 *
 * Los códigos DANE son 2 dígitos de departamento + 3 de municipio, y hay dos
 * departamentos que empiezan en cero: Antioquia (05) y Atlántico (08), 148
 * municipios entre los dos. Cualquier paso por `Number()` les come el cero
 * ('05001' → 5001) y el resultado no existe en el catálogo: el PAC lo descarta
 * y la factura sale sin municipio, o peor, con otro.
 *
 * Ese bug se cerró en el selector del formulario (MunicipalitySelect guarda
 * string) y volvió a aparecer una capa más abajo, en `loadCustomer`, que hacía
 * `Number(cityRaw)`. Por eso la normalización vive en UN solo lugar y devuelve
 * string: un valor de 4 dígitos es un cero comido en algún viaje anterior por
 * un número, así que se le repone.
 */
export function normalizeDaneMunicipality(raw: unknown): string | null {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!/^\d{4,5}$/.test(s)) return null;   // texto libre ("Bogota"), vacío, o basura
    return s.padStart(5, '0');
}

/**
 * `default_municipality_id` del EMISOR leído como código DANE (V2).
 * Se lee siempre como string y se normaliza, porque la fila de Dynasty lo tiene
 * guardado como número JSON (11001) y una escuela de Medellín lo tendría como
 * 5001 — el mismo cero comido.
 */
export function defaultMunicipalityCode(cfg: ProviderConfig): string | null {
    return normalizeDaneMunicipality(cfg.config?.default_municipality_id);
}

/**
 * `default_municipality_id` leído como id INTERNO del catálogo de Factus V1
 * (sin padding: '169' es Bogotá en V1, no un código DANE).
 * Confirmado en developers.factus.com.co/buenas-practicas/cambios-v2-v1:
 * «pasamos de usar el nombre municipality_id a municipality_code, el valor se
 * ha modificado de id por código». Son dos espacios de nombres distintos.
 */
export function defaultMunicipalityLegacyId(cfg: ProviderConfig): string | null {
    const raw = cfg.config?.default_municipality_id;
    if (raw == null) return null;
    const s = String(raw).trim();
    return /^\d{1,6}$/.test(s) ? s : null;
}

export type CustomerMunicipalityPolicy = 'fallback' | 'omit' | 'require';

/**
 * Qué hacer cuando NO sabemos el municipio del cliente. Tres estados, uno por
 * dueño, en `config.customer_municipality_policy`:
 *
 *   'fallback' (DEFAULT) — usa el municipio del emisor, pero DEJANDO RASTRO
 *       (warning en log + motivo en el resultado del backfill). Es lo que hacía
 *       el código antes, y sigue siendo el default por una razón concreta: hoy
 *       0 de los 147 pagos de septiembre de Dynasty tienen código DANE, así que
 *       cortar la emisión de entrada dejaría a la escuela sin poder facturar
 *       NADA. El default no rompe; simplemente ya no miente en silencio.
 *   'omit' — no sustituye: manda la factura sin municipio del cliente
 *       (`customer.municipality_code` es OPCIONAL en la doc oficial de Factus;
 *       la DIAN devuelve la notificación blanda FAK08 y valida igual).
 *   'require' — FAIL-CLOSED: la emisión se rechaza ANTES de llamar al PAC con
 *       'customer_missing_municipality'. Es el estado al que hay que llegar
 *       cuando el frontend ya capture el municipio y el rezago esté facturado.
 *
 * El problema real que esto ataja: con el fallback, familias que viven en
 * Mosquera y en Madrid tienen facturas que dicen Bogotá, porque
 * default_municipality_id de Dynasty es 11001.
 */
export function customerMunicipalityPolicy(cfg: ProviderConfig): CustomerMunicipalityPolicy {
    const raw = String(cfg.config?.customer_municipality_policy ?? '').trim().toLowerCase();
    return raw === 'require' || raw === 'omit' || raw === 'fallback' ? raw : 'fallback';
}

export interface MunicipalityResolution {
    /** Código DANE a enviar, ya normalizado. null = no se envía el campo. */
    code: string | null;
    /** Motivo de rechazo (policy 'require' sin dato). Si viene, NO se emite. */
    reject: string | null;
    /** Se usó el municipio del emisor en lugar del del cliente. */
    usedOwnerFallback: boolean;
}

/**
 * Resuelve el municipio del cliente aplicando la política del dueño.
 * Se llama UNA vez, en el servicio, antes de crear la fila y antes de hablar
 * con el PAC — no en el adaptador: si el corte viviera en el adaptador, la
 * factura ya habría nacido en 'queued' y quedaría contada como facturada.
 */
export function resolveCustomerMunicipality(
    customer: InvoiceCustomer,
    cfg: ProviderConfig,
): MunicipalityResolution {
    const own = normalizeDaneMunicipality(customer.municipalityCode);
    if (own) return { code: own, reject: null, usedOwnerFallback: false };

    const policy = customerMunicipalityPolicy(cfg);
    if (policy === 'require') {
        return { code: null, reject: 'customer_missing_municipality', usedOwnerFallback: false };
    }
    if (policy === 'omit') return { code: null, reject: null, usedOwnerFallback: false };

    const fallback = defaultMunicipalityCode(cfg);
    return { code: fallback, reject: null, usedOwnerFallback: fallback != null };
}

// ─── Medios de pago (códigos DIAN vía Factus) ─────────────────────────────────

/**
 * Códigos de método de pago de la tabla oficial de Factus
 * (developers.factus.com.co/tablas-de-referencia/tablas, «Códigos de métodos de
 * pago», consultada 2026-09-10). El catálogo completo es:
 *
 *   1    Medio de pago no definido        47   Transferencia
 *   10   Efectivo                         48   Tarjeta Crédito
 *   20   Cheque                           49   Tarjeta Débito
 *   42   Consignación                      71   Bonos
 *   72   Vales                            ZZZ  Otro
 *
 * V1 y V2 usan el MISMO código con el mismo nombre de campo
 * (`payment_method_code`); lo que cambió en V2 es que viaja dentro del array
 * `payment_details` en vez de suelto.
 */
export const FACTUS_PAYMENT_METHOD_CATALOG = new Set([
    '1', '10', '20', '42', '47', '48', '49', '71', '72', 'ZZZ',
]);

/** Código a usar cuando no podemos afirmar cuál fue el medio: «no definido». */
export const PAYMENT_METHOD_UNDEFINED = '1';

/**
 * Medio de pago de SportMaps → código de la tabla oficial.
 *
 * Solo entran los que se pueden AFIRMAR leyendo la tabla:
 *   cash     → 10  Efectivo
 *   transfer → 47  Transferencia
 *   check    → 20  Cheque          (no lo usa la base hoy, queda listo)
 *   deposit  → 42  Consignación    (idem)
 *
 * Los que NO se pueden confirmar quedan deliberadamente FUERA y caen en
 * '1' = «Medio de pago no definido», que también es un código oficial:
 *   - 'pse': PSE no figura en la tabla. Es un débito a cuenta bancaria y
 *     parecería un 47, pero eso es una inferencia nuestra, no la fuente.
 *   - 'card': la tabla separa Tarjeta Crédito (48) de Tarjeta Débito (49) y
 *     `payments` guarda solo 'card' — no hay dónde distinguirlas (se revisó
 *     payment_method, payment_channel y payment_provider).
 *   - 'other' y NULL: por definición no se sabe.
 *
 * Antes TODO iba con '10' = efectivo clavado, que no es un genérico: es una
 * afirmación falsa sobre plata que entró por el banco. '1' no afirma nada.
 *
 * Quien SÍ sepa (el contador de la escuela) lo fija sin deploy con
 * `config.payment_method_codes`, p. ej. { "pse": "47", "card": "48" }. Se
 * valida contra el catálogo para no mandarle al PAC un código inventado.
 */
const CONFIRMED_PAYMENT_METHOD_CODES: Record<string, string> = {
    cash: '10',
    transfer: '47',
    check: '20',
    cheque: '20',
    deposit: '42',
    consignacion: '42',
};

export function resolvePaymentMethodCode(
    method: string | null | undefined,
    cfg: ProviderConfig,
): string {
    const key = String(method ?? '').trim().toLowerCase();
    if (!key) return PAYMENT_METHOD_UNDEFINED;

    const overrides = cfg.config?.payment_method_codes;
    if (overrides && typeof overrides === 'object') {
        const raw = (overrides as Record<string, unknown>)[key];
        if (raw != null) {
            const code = String(raw).trim().toUpperCase();
            if (FACTUS_PAYMENT_METHOD_CATALOG.has(code)) return code;
            console.warn(
                `[invoicing] payment_method_codes.${key}='${raw}' no está en el catálogo oficial; se ignora`,
            );
        }
    }

    return CONFIRMED_PAYMENT_METHOD_CODES[key] ?? PAYMENT_METHOD_UNDEFINED;
}

// ─── Fallo de transporte ≠ rechazo de la DIAN ─────────────────────────────────

/**
 * Prefijo con el que se marca en `electronic_invoices.error_message` un fallo
 * NUESTRO (red, timeout, 5xx, 429, credenciales). Sirve para que el barrido
 * pueda reintentar esas filas y NO las de un rechazo real de la DIAN.
 */
export const TRANSPORT_ERROR_PREFIX = 'transporte:';

/**
 * Fallo de transporte contra el PAC: la petición no llegó, no volvió, o volvió
 * ilegible. Lo importante es que en ese escenario el documento PUDO quedar
 * creado ante la DIAN con su número consumido, así que NO es un rechazo.
 *
 * El bug que cierra: el adaptador hacía `await res.json()` ANTES de mirar
 * `res.ok`. Con un 502/504/429 de cuerpo HTML o vacío el parseo lanzaba, el
 * catch de arriba escribía status='rejected', y la reconciliación excluye
 * 'rejected' → número quemado, documento vivo en la DIAN, y para nosotros
 * «Rechazada» para siempre.
 */
export class PacTransportError extends Error {
    readonly retryable = true as const;
    readonly httpStatus?: number;
    constructor(message: string, httpStatus?: number) {
        super(message);
        this.name = 'PacTransportError';
        this.httpStatus = httpStatus;
    }
}

/**
 * ¿Este HTTP no-ok es culpa nuestra/del transporte (reintentable) o es un
 * rechazo del PAC sobre el contenido (terminal)?
 *
 * Terminal solo lo que habla del payload: 400 (mal formado), 409 (conflicto),
 * 422 (validación). Todo lo demás —401/403 de credenciales o de versión de API,
 * 404 de endpoint, 408, 429, 5xx— es un problema de nuestro lado o del PAC que
 * se arregla y se reintenta, y quemar la factura como 'rejected' por eso es
 * precisamente lo que dejaba documentos huérfanos.
 */
export function isTerminalPacStatus(httpStatus: number): boolean {
    return httpStatus === 400 || httpStatus === 409 || httpStatus === 422;
}

export interface PacResponse { ok: boolean; status: number; json: any; body: string; }

/**
 * Única puerta de salida hacia un PAC. Hace tres cosas que el código anterior
 * no hacía y que costaron facturas:
 *
 *   1. Pone timeout. `fetch` sin señal espera para siempre, y un cuelgue
 *      durante un redeploy de Render dejaba la fila en 'queued' —contada como
 *      facturada— sin rescate posible.
 *   2. Mira `res.ok` ANTES de parsear. El orden inverso convertía un 502 con
 *      cuerpo HTML en una excepción de parseo, y arriba eso se escribía como
 *      status='rejected' con el documento posiblemente vivo en la DIAN.
 *   3. Distingue el rechazo del PAC sobre el CONTENIDO (400/409/422, terminal:
 *      se devuelve para que el llamador lo reporte) del fallo de TRANSPORTE
 *      (red, timeout, 401/403/404/408/429/5xx, cuerpo ilegible), que se lanza
 *      como PacTransportError para que la fila quede reintentable.
 *
 * Vive acá, compartida, porque las dos veces que este manejo se escribió por
 * adaptador una de las copias se quedó vieja.
 */
export async function pacJsonFetch(
    label: string,
    url: string,
    init: RequestInit,
    timeoutMs: number,
): Promise<PacResponse> {
    let res: Response;
    try {
        res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e: any) {
        const esTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
        throw new PacTransportError(
            esTimeout
                ? `${label} sin respuesta en ${timeoutMs}ms (${url})`
                : `${label} fallo de red: ${e?.message ?? String(e)}`,
        );
    }

    let body = '';
    try {
        body = await res.text();
    } catch (e: any) {
        // La conexión se cortó a mitad del cuerpo: tampoco sabemos qué pasó.
        throw new PacTransportError(`${label} respuesta truncada (HTTP ${res.status}): ${e?.message ?? String(e)}`);
    }

    let json: any = null;
    if (body.trim()) {
        try { json = JSON.parse(body); } catch { json = null; }
    }

    if (!res.ok && !isTerminalPacStatus(res.status)) {
        const detalle = json?.message || json?.error_description || body.slice(0, 200) || '(cuerpo vacío)';
        throw new PacTransportError(`${label} HTTP ${res.status}: ${detalle}`, res.status);
    }
    // 2xx con cuerpo que no es JSON = página de un proxy delante del PAC. No es
    // un rechazo: es que no sabemos si el documento se creó.
    if (res.ok && json === null) {
        throw new PacTransportError(
            `${label} respondió ${res.status} con cuerpo no-JSON: ${body.slice(0, 200) || '(vacío)'}`,
            res.status,
        );
    }

    return { ok: res.ok, status: res.status, json, body };
}

/** ¿Se puede reintentar esta excepción sin dar la factura por rechazada? */
export function isRetryablePacError(e: unknown): boolean {
    if (e instanceof PacTransportError) return true;
    // fetch lanza TypeError en fallo de red y AbortError al vencer el timeout;
    // ninguna de las dos dice nada sobre si el documento existe o no.
    const name = (e as any)?.name;
    if (name === 'AbortError' || name === 'TimeoutError' || name === 'TypeError') return true;
    const code = (e as any)?.cause?.code ?? (e as any)?.code;
    return typeof code === 'string' && /^(ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|EPIPE|UND_ERR)/.test(code);
}
