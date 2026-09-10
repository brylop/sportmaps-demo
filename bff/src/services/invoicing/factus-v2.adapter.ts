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
 * CUFE) y hace falta un paso de reconciliación que consulte GET /v2/bills por
 * reference_code y complete number/cufe/validated_at.
 * ESE RECONCILIADOR AÚN NO EXISTE: sin él, una factura de producción se queda
 * en 'sent' para siempre aunque la DIAN ya la haya validado.
 *
 * Idempotencia CONFIRMADA: reenviar el mismo reference_code devuelve el MISMO
 * documento (mismo número y CUFE), no crea otro. Eso es lo que hace inofensivo
 * que los tres BFF de Render corran este cron sobre la misma base compartida.
 *
 * cfg.credentials: { base_url?, client_id, client_secret, username, password }
 * cfg.config:      { numbering_range_id, default_municipality_id? }
 */

import { InvoicingAdapter, InvoiceRequest, InvoiceResult, ProviderConfig } from './types';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
const PROD_URL = 'https://api.factus.com.co';

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
    const res = await fetch(`${baseUrl(cfg)}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json.access_token) {
        throw new Error(`Factus V2 auth failed: ${json.error_description || json.message || res.status}`);
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
        publicUrl: /\/documents\/bills\/.+/.test(String(d?.links?.public_url ?? ''))
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

export const factusV2Adapter: InvoicingAdapter = {
    provider: 'factus_v2',

    async emit(req: InvoiceRequest, cfg: ProviderConfig): Promise<InvoiceResult> {
        const token = await getToken(cfg);
        const isCompany = req.customer.documentType === 'NIT';

        // `price` en V2 es el valor NETO por unidad, sin impuestos ("Precio por
        // unidad del producto o servicio sin impuestos incluidos ni descuentos,
        // valor neto" — doc oficial). NO es como V1, que recibía el precio con
        // IVA incluido y lo desglosaba hacia atrás. Nuestro canónico
        // (InvoiceLine.unitPrice) viene con IVA incluido, así que acá hay que
        // sacarle el impuesto: para un excluido son iguales, pero el día que
        // se facture algo gravado (artículos deportivos al 19%) mandar el total
        // como si fuera base infla la factura un 19%.
        const netUnit = (it: { unitPrice: number; taxRate: number; isExcluded?: boolean }) =>
            it.isExcluded || !it.taxRate
                ? Number(it.unitPrice)
                : Number(it.unitPrice) / (1 + Number(it.taxRate) / 100);

        // El pago es lo que el padre pagó de verdad: el total con impuesto.
        const total = req.items.reduce(
            (acc, it) => acc + Number(it.unitPrice) * Number(it.quantity ?? 1),
            0,
        );

        const payload = {
            numbering_range_id: cfg.config.numbering_range_id,
            reference_code: req.referenceCode,
            observation: req.observation ?? '',
            // Explícito y no por omisión: el default documentado es `true`, y no
            // queremos que Factus le escriba al acudiente por su cuenta con una
            // plantilla que no controlamos. Si algún día se quiere ese correo,
            // es una decisión de producto, no un default heredado.
            send_email: false,
            payment_details: [{
                payment_form: '1',          // 1 = pago de contado
                payment_method_code: '10',  // 10 = efectivo (genérico)
                amount: total.toFixed(2),   // la doc declara string
            }],
            customer: {
                identification: req.customer.identification,
                identification_document_code: DOC_TYPE_CODE[req.customer.documentType] ?? '13',
                // La razón social y el nombre de una persona natural son DOS
                // campos distintos, y cada uno es obligatorio SOLO en su caso:
                // `company` cuando legal_organization_code es 1 (jurídica) y
                // `names` cuando es 2 (natural) — descripción de campos oficial
                // de V2 (developers.factus.com.co/facturas/descripcion-de-campos).
                // Mandar siempre `names` metía la razón social en el campo de
                // persona natural, que para una jurídica V2 reporta como null:
                // la factura de una empresa salía sin nombre de adquiriente y
                // nadie se enteraba, porque el campo que sobra no da error. El
                // ejemplo oficial de persona jurídica manda `company` y NO manda
                // `names`, así que acá se manda uno u otro, nunca los dos.
                ...(isCompany
                    ? { company: req.customer.name }
                    : { names: req.customer.name }),
                address: req.customer.address ?? '',
                email: req.customer.email ?? '',
                phone: req.customer.phone ?? '',
                legal_organization_code: isCompany ? '1' : '2',  // 1=jurídica, 2=natural
                tribute_code: isCompany ? '01' : 'ZZ',           // 01=IVA, ZZ=no aplica
                // OJO: `municipality_code` (código DANE), NO `municipality_id`
                // como en V1. Mandarlo con el nombre viejo NO da error: V2 lo
                // ignora en silencio, el cliente queda sin ciudad ni país y la
                // DIAN devuelve la notificación FAK08 por grupo de dirección
                // incompleto. Verificado en sandbox: con municipality_code el
                // municipio y el país se resuelven y FAK08 desaparece.
                municipality_code: String(
                    req.customer.municipalityId ?? cfg.config.default_municipality_id ?? '',
                ),
            },
            items: req.items.map((it) => ({
                code_reference: it.codeReference,
                name: it.name,
                quantity: Number(it.quantity ?? 1).toFixed(2),
                discount_rate: Number(it.discountRate ?? 0).toFixed(2),
                price: netUnit(it).toFixed(2),          // NETO, sin impuesto
                unit_measure_code: '94',                // 94 = unidad
                standard_code: '999',                   // el que usa el ejemplo oficial
                // `is_excluded` va DENTRO de cada objeto de `taxes` y es
                // BOOLEANO — no al nivel del ítem ni como 1/0. Mandarlo mal es
                // el mismo fallo silencioso de municipality_id: V2 descarta la
                // clave desconocida sin avisar, y el ítem sale GRAVADO AL 0%
                // en vez de EXCLUIDO, que ante la DIAN no es lo mismo. La
                // respuesta del sandbox ya lo delataba (devolvía
                // is_excluded:false pese a que mandábamos 1).
                // Para un excluido el ejemplo oficial manda SOLO la bandera,
                // sin code ni rate.
                taxes: it.isExcluded
                    ? [{ is_excluded: true }]
                    : [{ code: '01', rate: Number(it.taxRate).toFixed(2) }],
            })),
        };

        const res = await fetch(`${baseUrl(cfg)}/v2/bills/validate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        });
        const json = (await res.json()) as any;

        if (!res.ok) {
            return {
                status: 'rejected',
                errorMessage: json?.data?.message || json?.message || `Factus V2 HTTP ${res.status}`,
                raw: json,
            };
        }

        // V2 responde plano en `data` (no hay data.bill como en V1). En
        // producción `data` viene VACÍO (solo el acuse), así que mapBill deja
        // todo en null y el estado cae a 'sent' — lo completa fetchByReference.
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
    async fetchByReference(referenceCode: string, cfg: ProviderConfig): Promise<InvoiceResult | null> {
        const token = await getToken(cfg);
        const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

        const listRes = await fetch(
            `${baseUrl(cfg)}/v2/bills?filter%5Breference_code%5D=${encodeURIComponent(referenceCode)}`,
            { headers },
        );
        if (!listRes.ok) return null;
        const listJson = (await listRes.json()) as any;
        const rows = listJson?.data?.data;
        const number = Array.isArray(rows) && rows.length > 0 ? rows[0]?.number : null;
        if (!number) return null;

        const detRes = await fetch(
            `${baseUrl(cfg)}/v2/bills/${encodeURIComponent(String(number))}`,
            { headers },
        );
        // El detalle es el que trae cufe y links; si falla, al menos devolvemos
        // lo del listado (número y total) en vez de perder el hallazgo.
        if (!detRes.ok) return mapBill(rows[0], listJson);
        const detJson = (await detRes.json()) as any;
        return mapBill(detJson?.data ?? rows[0], detJson);
    },
};
