/**
 * factus-v2.adapter — InvoicingAdapter para cuentas Factus API V2.
 *
 * Mismo PAC que factus.adapter.ts, pero algunas empresas quedan aprovisionadas
 * en la V2 de su API (Dynasty: /v1/... da 403 "Version de API no disponible
 * para esta empresa", /v2/... responde bien). El OAuth es idéntico; el payload
 * de emisión NO lo es — V2 cambió ids de catálogo interno por códigos DIAN y
 * agrupó campos:
 *
 *   V1                              → V2
 *   identification_document_id: 3   → identification_document_code: "13"
 *   tribute_id: "21"                → tribute_code: "ZZ"
 *   legal_organization_id           → legal_organization_code
 *   payment_form + payment_method_code (sueltos)
 *                                   → payment_details: [{payment_form, payment_method_code, amount}]
 *   unit_measure_id: 70             → unit_measure_code: "94"
 *   tax_rate + tribute_id (planos)  → taxes: [{code, rate}]   (obligatorio, no acepta [])
 *   respuesta en data.bill.{...}    → respuesta en data.{...} + links.{qr,public_url} + totals.{...}
 *
 * VALIDADO e2e contra sandbox V2 (factura SETP990018445, CUFE real, validada).
 * Notas del sandbox: `price` sigue siendo IVA-incluido; la respuesta NO trae un
 * id numérico del documento (solo reference_code/number) ni `qr_image` base64
 * como V1, solo la URL del QR; los `errors` que vienen en la respuesta son
 * notificaciones blandas de la DIAN (RUT01/FAJ43b/FAK08) y NO impiden la
 * validación — se guardan en dian_response.
 *
 * DIFERENCIA CRÍTICA SANDBOX vs PRODUCCIÓN (verificada con Dynasty): el sandbox
 * responde SÍNCRONO con el documento completo ("Created" + number + cufe), pero
 * producción responde solo un acuse, sin `data`:
 *     { "status": "Accepted", "message": "Documento en proceso de validación" }
 * La validación ante la DIAN ocurre después, en segundo plano. Por eso en
 * producción el resultado cae a status 'sent' (enviada, todavía sin número ni
 * CUFE) y la completa después `fetchByReference` desde
 * reconcilePendingInvoices, que consulta GET /v2/bills por reference_code.
 *
 * Idempotencia CONFIRMADA: reenviar el mismo reference_code devuelve el MISMO
 * documento (mismo número y CUFE), no crea otro. Eso es lo que hace inofensivo
 * que los tres BFF de Render corran este cron sobre la misma base compartida, y
 * también lo que permite REINTENTAR una emisión que falló por transporte sin
 * riesgo de duplicar el documento.
 *
 * TODA petición sale con `AbortSignal.timeout`. Sin timeout, un cuelgue durante
 * un redeploy de Render dejaba la fila en 'queued' —contada como facturada— y
 * sin rescate posible.
 *
 * NOTAS CRÉDITO (emitCreditNote): POST /v2/credit-notes/validate. Es otra
 * colección con OTRO rango de numeración y otra resolución de la DIAN, no una
 * variante de /v2/bills — de ahí que `fetchCreditNoteByReference` exista
 * separada de `fetchByReference`. La nota crédito es el ÚNICO camino para
 * deshacer una factura ya emitida: el número de la factura queda consumido para
 * siempre, así que "corregir" es emitir un documento nuevo que la anule.
 *
 * cfg.credentials: { base_url?, client_id, client_secret, username, password }
 * cfg.config:      ver ProviderConfig en ./types
 */

import {
    InvoicingAdapter,
    InvoiceRequest,
    InvoiceLine,
    InvoiceResult,
    CreditNoteRequest,
    ProviderConfig,
    PacTransportError,
    pacJsonFetch,
    normalizeDaneMunicipality,
    resolvePaymentMethodCode,
    creditNoteNumberingRangeId,
    CREDIT_NOTE_OBSERVATION_MAX,
} from './types';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
const PROD_URL = 'https://api.factus.com.co';

/**
 * Presupuesto de tiempo por petición al PAC. 25s para emitir (el PAC firma y
 * habla con la DIAN) y 15s para consultar. Cualquiera de los dos vencido es un
 * fallo de transporte, NO un rechazo: el documento pudo quedar creado.
 */
const EMIT_TIMEOUT_MS = 25_000;
const READ_TIMEOUT_MS = 15_000;

// Tipo de documento SportMaps → código DIAN (V2 usa el código oficial, no el
// id del catálogo interno de Factus que usaba V1).
const DOC_TYPE_CODE: Record<string, string> = {
    RC: '11',         // Registro civil
    TI: '12',         // Tarjeta de identidad
    CC: '13',         // Cédula de ciudadanía
    CE: '22',         // Cédula de extranjería
    NIT: '31',        // NIT
    PASAPORTE: '41',  // Pasaporte
};

interface CachedToken { token: string; expiresAt: number; }
const tokenCache = new Map<string, CachedToken>();

function baseUrl(cfg: ProviderConfig): string {
    return cfg.credentials.base_url || (cfg.sandbox ? SANDBOX_URL : PROD_URL);
}

/** Transporte compartido (timeout + res.ok antes de parsear + clasificación). */
const pacFetch = (url: string, init: RequestInit, timeoutMs: number) =>
    pacJsonFetch('Factus V2', url, init, timeoutMs);

async function getToken(cfg: ProviderConfig): Promise<string> {
    const cacheKey = `v2:${baseUrl(cfg)}:${cfg.credentials.client_id}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const body = new URLSearchParams({
        grant_type: 'password',
        client_id: cfg.credentials.client_id,
        client_secret: cfg.credentials.client_secret,
        username: cfg.credentials.username,
        password: cfg.credentials.password,
    });
    const res = await pacFetch(`${baseUrl(cfg)}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    }, READ_TIMEOUT_MS);

    const json = res.json ?? {};
    if (!res.ok || !json.access_token) {
        // Credenciales vencidas o mal cargadas es un problema NUESTRO, no un
        // rechazo de la DIAN: se lanza como transporte para que la factura
        // quede reintentable en vez de morir como 'rejected'.
        throw new PacTransportError(
            `Factus V2 auth failed: ${json.error_description || json.message || res.status}`,
            res.status,
        );
    }
    tokenCache.set(cacheKey, {
        token: json.access_token,
        expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
    });
    return json.access_token;
}

function toNum(v: unknown): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

// ─── Líneas y totales (compartidos por factura y nota crédito) ────────────────
//
// Las tres funciones de acá abajo las usan `emit` y `emitCreditNote`, y viven
// FUERA de las dos a propósito. La nota crédito tiene que declarar exactamente
// las mismas líneas que la factura que anula —si los totales no cuadran, la DIAN
// empareja mal los dos documentos y la anulación queda a medias—, así que una
// segunda copia del cálculo es una divergencia esperando ocurrir. Es el mismo
// motivo por el que `normalizeDaneMunicipality` acabó en un solo lugar: las dos
// veces que este tipo de helper se duplicó, una de las copias se quedó vieja.

/**
 * Precio unitario NETO (sin impuesto) que espera V2.
 *
 * `price` en V2 es «Precio por unidad del producto o servicio sin impuestos
 * incluidos ni descuentos, valor neto» (doc oficial). NO es como V1, que recibía
 * el precio con IVA incluido y lo desglosaba hacia atrás. Nuestro canónico
 * (InvoiceLine.unitPrice) viene con IVA incluido, así que acá hay que sacarle el
 * impuesto: para un excluido son iguales, pero el día que se facture algo
 * gravado (artículos deportivos al 19%) mandar el total como si fuera base
 * infla el documento un 19%.
 */
function netUnit(it: InvoiceLine): number {
    return it.isExcluded || !it.taxRate
        ? Number(it.unitPrice)
        : Number(it.unitPrice) / (1 + Number(it.taxRate) / 100);
}

/** Lo que el pagador pagó de verdad: el total CON impuesto. */
function totalConImpuesto(items: InvoiceLine[]): number {
    return items.reduce((acc, it) => acc + Number(it.unitPrice) * Number(it.quantity ?? 1), 0);
}

function mapItems(items: InvoiceLine[]) {
    return items.map((it) => ({
        code_reference: it.codeReference,
        name: it.name,
        quantity: Number(it.quantity ?? 1).toFixed(2),
        discount_rate: Number(it.discountRate ?? 0).toFixed(2),
        price: netUnit(it).toFixed(2),          // NETO, sin impuesto
        unit_measure_code: '94',                // 94 = unidad
        standard_code: '999',                   // el que usa el ejemplo oficial
        // `is_excluded` va DENTRO de cada objeto de `taxes` y es BOOLEANO — no
        // al nivel del ítem ni como 1/0. Mandarlo mal es el mismo fallo
        // silencioso de municipality_id: V2 descarta la clave desconocida sin
        // avisar, y el ítem sale GRAVADO AL 0% en vez de EXCLUIDO, que ante la
        // DIAN no es lo mismo. La respuesta del sandbox ya lo delataba
        // (devolvía is_excluded:false pese a que mandábamos 1).
        // Para un excluido el ejemplo oficial manda SOLO la bandera, sin code
        // ni rate.
        taxes: it.isExcluded
            ? [{ is_excluded: true }]
            : [{ code: '01', rate: Number(it.taxRate).toFixed(2) }],
    }));
}

/**
 * `payment_details` de V2: array con UN pago de contado por el total.
 * Igual en factura y en nota crédito (el API declara el mismo campo).
 */
function paymentDetails(items: InvoiceLine[], paymentMethod: string | null | undefined, cfg: ProviderConfig) {
    return [{
        payment_form: '1',                                          // 1 = pago de contado
        // Medio de pago REAL (ver resolvePaymentMethodCode en ./types). Antes
        // iba '10' = efectivo clavado para todo, incluidas 350 transferencias
        // de Dynasty.
        payment_method_code: resolvePaymentMethodCode(paymentMethod, cfg),
        amount: totalConImpuesto(items).toFixed(2),                 // la doc declara string
    }];
}

/**
 * Separa un RECHAZO de la DIAN de una simple notificación.
 *
 * Factus mete las dos cosas en el mismo campo `errors`, y hay que
 * distinguirlas por el texto:
 *   - "Regla: FAK08, Notificación: ..."  → aviso blando, el documento vale
 *   - "Regla: 90, Rechazo: Documento procesado anteriormente" → RECHAZADO
 * El formato también varía (objeto indexado por regla, o array de strings),
 * así que se normaliza a lista de textos antes de mirar.
 *
 * Sin esto un documento rechazado por la DIAN se quedaba para siempre como
 * "enviada, esperando validación" y nadie se enteraba: exactamente lo que
 * pasó con DYTY1 el 2026-09-09 (rechazo por regla 90).
 */
function dianRejection(errors: unknown): string | null {
    const textos: string[] = Array.isArray(errors)
        ? errors.map((e) => String(e))
        : errors && typeof errors === 'object'
            ? Object.values(errors as Record<string, unknown>).map((e) => String(e))
            : [];
    const rechazos = textos.filter((t) => /rechazo/i.test(t));
    return rechazos.length > 0 ? rechazos.join(' | ') : null;
}

/**
 * Mapea un documento V2 (`data` de bills/validate síncrono, o de
 * GET /v2/bills/{number}) al resultado canónico. El total llega como
 * `totals.total` en el detalle y como `total` plano en el listado.
 */
function mapBill(d: any, raw: unknown): InvoiceResult {
    const rechazo = dianRejection(d?.errors);
    return {
        // is_validated=false por sí solo NO es rechazo (puede estar en cola),
        // pero un "Rechazo" en errors sí es terminal.
        status: d?.is_validated ? 'accepted' : (rechazo ? 'rejected' : 'sent'),
        // V2 no devuelve un id numérico del documento; el número es su
        // identificador estable ante el PAC y la DIAN.
        providerBillId: d?.number ?? null,
        prefix: d?.numbering_range?.prefix ?? null,
        number: d?.number ?? null,
        dianCode: d?.document_type?.code ?? null,
        cufe: d?.cufe ?? null,
        qrUrl: d?.links?.qr ?? null,
        qrImage: null,                       // V2 no manda el QR en base64
        // Mientras la DIAN no valida, Factus devuelve la URL pública sin el
        // hash del documento (".../documents/bills/"), que no sirve para nada:
        // se descarta para no dejarle al pagador un botón que abre una ruta muerta.
        //
        // El segmento del tipo de documento va COMODÍN y no clavado en `bills`:
        // la nota crédito publica en otra ruta (".../documents/credit-notes/…"),
        // y con el patrón viejo una nota crédito perfectamente válida se quedaba
        // sin URL pública — el mismo síntoma que un documento sin validar, pero
        // por un motivo distinto e invisible. Lo que se sigue exigiendo es lo
        // único que importaba: que haya algo DESPUÉS del tipo de documento.
        publicUrl: /\/documents\/[a-z-]+\/.+/.test(String(d?.links?.public_url ?? ''))
            ? d.links.public_url
            : null,
        pdfUrl: null,                        // descarga aparte (no implementada)
        xmlUrl: null,
        taxableAmount: toNum(d?.totals?.taxable_amount),
        taxAmount: toNum(d?.totals?.tax_amount),
        total: toNum(d?.totals?.total ?? d?.total),
        validatedAt: d?.validated_at ?? null,
        errorMessage: rechazo,
        raw,
    };
}

/**
 * Consulta un documento por NUESTRO reference_code, en dos saltos.
 *
 * `coleccion` es el segmento de la URL: 'bills' para facturas, 'credit-notes'
 * para notas crédito. Está parametrizado en vez de duplicado porque el
 * procedimiento tiene tres decisiones sutiles (qué es null, qué se devuelve si
 * el detalle falla, qué sale por excepción) y mantenerlas iguales en dos copias
 * es lo que en este módulo ya salió mal dos veces.
 */
async function fetchDocumentByReference(
    coleccion: 'bills' | 'credit-notes',
    referenceCode: string,
    cfg: ProviderConfig,
): Promise<InvoiceResult | null> {
    const token = await getToken(cfg);
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    const listRes = await pacFetch(
        `${baseUrl(cfg)}/v2/${coleccion}?filter%5Breference_code%5D=${encodeURIComponent(referenceCode)}`,
        { headers },
        READ_TIMEOUT_MS,
    );
    if (!listRes.ok) return null;
    const listJson = listRes.json;
    const rows = listJson?.data?.data;
    const number = Array.isArray(rows) && rows.length > 0 ? rows[0]?.number : null;
    if (!number) return null;

    // El detalle es el que trae cufe y links; si el PAC lo rechaza, devolvemos
    // lo del listado (número y total) en vez de perder el hallazgo. Un fallo de
    // transporte sí sale por excepción: mejor volver a intentarlo en el
    // siguiente barrido que escribir un dato a medias.
    const detRes = await pacFetch(
        `${baseUrl(cfg)}/v2/${coleccion}/${encodeURIComponent(String(number))}`,
        { headers },
        READ_TIMEOUT_MS,
    );
    if (!detRes.ok) return mapBill(rows[0], listJson);
    return mapBill(detRes.json?.data ?? rows[0], detRes.json);
}

/**
 * Objeto `customer` compartido por `emit` (factura) y `emitCreditNote` (nota
 * crédito). Vivió duplicado un momento entre las dos y es exactamente el tipo
 * de bug que ya costó caro en este archivo (ver `normalizeDaneMunicipality`):
 * una sola copia, y el día que cambie el mapeo cambia en los dos documentos a
 * la vez.
 */
function customerPayload(customer: InvoiceRequest['customer']): Record<string, any> {
    const isCompany = customer.documentType === 'NIT';

    // El municipio del cliente ya viene resuelto por el servicio (política del
    // dueño incluida). Acá NO se sustituye por el del emisor: ese fallback
    // silencioso es el que le ponía Bogotá a familias de Mosquera y de Madrid.
    // Si no hay dato, el campo simplemente no viaja — es opcional en la doc
    // oficial de V2.
    const municipalityCode = normalizeDaneMunicipality(customer.municipalityCode);

    return {
        identification: customer.identification,
        identification_document_code: DOC_TYPE_CODE[customer.documentType] ?? '13',
        // La razón social y el nombre de una persona natural son DOS campos
        // distintos, y cada uno es obligatorio SOLO en su caso: `company`
        // cuando legal_organization_code es 1 (jurídica) y `names` cuando es 2
        // (natural) — descripción de campos oficial de V2
        // (developers.factus.com.co/facturas/descripcion-de-campos). Mandar
        // siempre `names` metía la razón social en el campo de persona
        // natural, que para una jurídica V2 reporta como null: la factura de
        // una empresa salía sin nombre de adquiriente y nadie se enteraba,
        // porque el campo que sobra no da error. El ejemplo oficial de persona
        // jurídica manda `company` y NO manda `names`, así que acá se manda
        // uno u otro, nunca los dos.
        ...(isCompany ? { company: customer.name } : { names: customer.name }),
        address: customer.address ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        legal_organization_code: isCompany ? '1' : '2',  // 1=jurídica, 2=natural
        tribute_code: isCompany ? '01' : 'ZZ',           // 01=IVA, ZZ=no aplica
        // OJO: `municipality_code` (código DANE), NO `municipality_id` como en
        // V1. Mandarlo con el nombre viejo NO da error: V2 lo ignora en
        // silencio, el cliente queda sin ciudad ni país y la DIAN devuelve la
        // notificación FAK08 por grupo de dirección incompleto. Verificado en
        // sandbox: con municipality_code el municipio y el país se resuelven y
        // FAK08 desaparece.
        //
        // Y es un STRING de 5 dígitos con el cero inicial. El valor pasaba por
        // Number() aguas arriba, y `Number('05001')` = 5001 no es ningún
        // municipio: se perdían los 148 de Antioquia (05xxx) y Atlántico
        // (08xxx). Cuando no hay dato la clave NO se manda (es opcional) en
        // vez de rellenarla con el municipio del emisor.
        ...(municipalityCode ? { municipality_code: municipalityCode } : {}),
    };
}

export const factusV2Adapter: InvoicingAdapter = {
    provider: 'factus_v2',

    async emit(req: InvoiceRequest, cfg: ProviderConfig): Promise<InvoiceResult> {
        const token = await getToken(cfg);

        const payload = {
            numbering_range_id: cfg.config.numbering_range_id,
            reference_code: req.referenceCode,
            observation: req.observation ?? '',
            // Explícito y no por omisión: el default documentado es `true`, y no
            // queremos que Factus le escriba al acudiente por su cuenta con una
            // plantilla que no controlamos. Si algún día se quiere ese correo,
            // es una decisión de producto, no un default heredado.
            send_email: false,
            payment_details: paymentDetails(req.items, req.paymentMethod, cfg),
            customer: customerPayload(req.customer),
            items: mapItems(req.items),
        };

        const res = await pacFetch(`${baseUrl(cfg)}/v2/bills/validate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        }, EMIT_TIMEOUT_MS);
        const json = res.json;

        // Acá solo se llega con un no-ok TERMINAL (400/409/422): el PAC revisó
        // el contenido y lo rechazó, no hay nada que reintentar. Los fallos de
        // transporte ya salieron por excepción desde pacFetch.
        if (!res.ok) {
            return {
                status: 'rejected',
                errorMessage: json?.data?.message || json?.message || `Factus V2 HTTP ${res.status}`,
                raw: json ?? res.body,
            };
        }

        // V2 responde plano en `data` (no hay data.bill como en V1). En
        // producción `data` viene VACÍO (solo el acuse), así que mapBill deja
        // todo en null y el estado cae a 'sent' — lo completa fetchByReference.
        return mapBill(json?.data ?? {}, json);
    },

    /**
     * Emite la NOTA CRÉDITO que anula (o corrige) una factura ya emitida.
     * POST /v2/credit-notes/validate — otra colección, otro rango de
     * numeración, otra resolución de la DIAN. No es un POST a /v2/bills con
     * una bandera.
     *
     * Tres diferencias con la factura que son las que importan:
     *
     *  1. `bill_number` es el NÚMERO de la factura ('DYTY1'), no un id interno
     *     ni el uuid de nuestra fila. Es lo que ata los dos documentos ante la
     *     DIAN, y es obligatorio con customization_id '20'.
     *  2. `customer` SÍ viaja, y es OBLIGATORIO pese a lo que dice la doc. La
     *     descripción de campos de V2 dice que es opcional y que, si falta, el
     *     API copia el adquirente de la factura referenciada — probado contra
     *     el sandbox real de Dynasty y es FALSO: omitirlo responde 422 con
     *     `"El campo customer es obligatorio"`. El valor que viaja es el
     *     snapshot de la factura original (`customer_snapshot`), no uno
     *     reconstruido hoy: `profiles` se edita, y una nota crédito a nombre
     *     de un adquirente distinto del de la factura no empareja ante la
     *     DIAN. `customer.responsibilities` también resultó obligatorio en la
     *     práctica (la doc lo da como opcional con default 'R-99-PN' = "No
     *     responsable"): se manda ese default siempre, incluso para NIT — no
     *     hay en el sistema un dato de responsabilidad fiscal más específico
     *     que mandar.
     *  3. El rango de numeración es OTRO (`credit_note_numbering_range_id`).
     *
     * El resultado se mapea con el MISMO mapBill que la factura porque la
     * respuesta tiene la misma forma (data.number / cufe / links / totals), y
     * eso incluye el comportamiento asíncrono de producción: allá vuelve solo
     * el acuse y la nota nace en 'sent', sin número, hasta que la completa
     * fetchCreditNoteByReference.
     */
    async emitCreditNote(req: CreditNoteRequest, cfg: ProviderConfig): Promise<InvoiceResult> {
        const rangeId = creditNoteNumberingRangeId(cfg);
        // El servicio ya corta antes de llegar acá (error 'missing_credit_note_range'),
        // pero el guard se repite en el adaptador porque el adaptador es el que
        // construye el payload y OMITIR el rango no es una opción neutra: el PAC
        // caería a su rango por defecto, que en producción de Dynasty es el de
        // FACTURAS (2697, prefijo DYTY), y gastaría un número de esa resolución
        // en una nota crédito. Un número de resolución quemado no se recupera.
        // Se lanza Error y no PacTransportError a propósito: no es reintentable,
        // es configuración que falta.
        if (!rangeId) {
            throw new Error(
                'Factus V2: falta config.credit_note_numbering_range_id (rango de numeración de nota crédito)',
            );
        }

        const token = await getToken(cfg);

        const payload = {
            numbering_range_id: rangeId,
            reference_code: req.referenceCode,
            // '20' = nota crédito QUE REFERENCIA una factura electrónica (el
            // default del API). El '22' —sin referencia— existe, pero con él la
            // nota no anula nada concreto: queda un documento suelto que no
            // libera la factura ante la DIAN. Va explícito para que nadie lo
            // cambie creyendo que es un detalle de forma.
            customization_id: '20',
            bill_number: req.billNumber,
            correction_concept_code: req.correctionConceptCode,
            // Tope del API. Se recorta acá y no se rechaza: el motivo lo
            // escribe una persona en un cuadro de texto y perder la anulación
            // completa por el carácter 501 sería absurdo.
            observation: (req.observation ?? '').slice(0, CREDIT_NOTE_OBSERVATION_MAX),
            // NO está en la lista de campos documentados de notas crédito, y va
            // igual: el default documentado del endpoint de facturas es `true`,
            // V2 descarta en silencio las claves que no conoce (ver
            // municipality_id), y el peor caso de mandarlo es que no haga nada.
            // El peor caso de NO mandarlo es que el PAC le escriba al acudiente
            // «se anuló su factura» con una plantilla que no controlamos.
            send_email: false,
            customer: {
                ...customerPayload(req.customer),
                // 'R-99-PN' = No responsable, el default documentado del API.
                // Confirmado contra el sandbox: sin esta clave, el PAC rechaza
                // con "El campo responsabilidades fiscales es obligatorio" — a
                // diferencia de `emit()`, donde nunca hizo falta.
                responsibilities: ['R-99-PN'],
            },
            payment_details: paymentDetails(req.items, req.paymentMethod, cfg),
            items: mapItems(req.items),
        };

        const res = await pacFetch(`${baseUrl(cfg)}/v2/credit-notes/validate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        }, EMIT_TIMEOUT_MS);
        const json = res.json;

        // Igual que en emit: acá solo se llega con un no-ok TERMINAL
        // (400/409/422). Los fallos de transporte salieron por excepción desde
        // pacFetch, y eso es crítico en la nota crédito: si la petición se
        // perdió, la nota PUDO quedar creada y su número consumido, así que
        // darla por rechazada sería inventar que no existe.
        if (!res.ok) {
            return {
                status: 'rejected',
                errorMessage: json?.data?.message || json?.message || `Factus V2 HTTP ${res.status}`,
                raw: json ?? res.body,
            };
        }

        return mapBill(json?.data ?? {}, json);
    },

    /**
     * Busca el documento por el reference_code que generamos nosotros.
     * Dos saltos, porque el listado NO trae cufe ni links:
     *   1) GET /v2/bills?filter[reference_code]=<ref>  → número
     *   2) GET /v2/bills/{número}                      → cufe, links, totals
     * (verificado: el filtro descarta de verdad; una referencia inexistente
     * devuelve total 0, no la lista completa).
     */
    fetchByReference(referenceCode: string, cfg: ProviderConfig): Promise<InvoiceResult | null> {
        return fetchDocumentByReference('bills', referenceCode, cfg);
    },

    /**
     * Lo mismo para la nota crédito, contra /v2/credit-notes.
     *
     * Es OTRA colección, no un filtro de la misma: una nota crédito NO aparece
     * en /v2/bills. Preguntar por ella ahí devuelve la lista vacía, que este
     * adaptador traduce como null = «el PAC no conoce esa referencia» — es
     * decir, exactamente lo mismo que respondería si la nota no existiera. Por
     * eso no alcanza con reutilizar fetchByReference: la reconciliación se
     * quedaría reportando «sigue pendiente» para siempre sobre una nota crédito
     * que hace rato validó.
     */
    fetchCreditNoteByReference(referenceCode: string, cfg: ProviderConfig): Promise<InvoiceResult | null> {
        return fetchDocumentByReference('credit-notes', referenceCode, cfg);
    },
};
