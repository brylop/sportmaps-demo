/**
 * factus.adapter — InvoicingAdapter para Factus (PAC Colombia).
 *
 * Auth:     OAuth2 password grant (form-urlencoded). Token cacheado en memoria
 *           por client_id hasta ~expiración (3600s).
 * Emisión:  POST /v1/bills/validate.
 *
 * cfg.credentials: { base_url?, client_id, client_secret, username, password }
 * cfg.config:      ver ProviderConfig en ./types
 *
 * VALIDADO contra sandbox: data.bill trae { id, number, cufe, qr, qr_image,
 * public_url, document.code, taxable_amount, tax_amount, total, validated }.
 * Nota: `price` del item es IVA-incluido → Factus back-calcula base + IVA.
 *
 * LIMITACIÓN CONOCIDA DE V1 — el municipio del cliente NO puede viajar acá.
 * V1 espera `municipality_id`, que es el id INTERNO del catálogo de Factus (el
 * de la escuela demo es 169 = Bogotá) y se obtenía consumiendo un endpoint de
 * V1; V2 lo reemplazó por `municipality_code`, que sí es el código DANE.
 * Confirmado en developers.factus.com.co/buenas-practicas/cambios-v2-v1: «el
 * valor se ha modificado de id por código». Nuestro dato del cliente es DANE,
 * así que mandarlo como id de V1 apuntaría a OTRO municipio: por eso se manda
 * únicamente el default del emisor y el código del cliente se ignora aquí.
 * Para facturar de verdad con el municipio del adquirente hay que usar V2 (o
 * implementar la traducción DANE → id de V1 contra su endpoint).
 */

import {
    InvoicingAdapter,
    InvoiceRequest,
    InvoiceResult,
    ProviderConfig,
    PacTransportError,
    pacJsonFetch,
    defaultMunicipalityLegacyId,
    resolvePaymentMethodCode,
} from './types';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
const PROD_URL = 'https://api.factus.com.co';

/** Presupuesto de tiempo por petición. Ver pacJsonFetch en ./types. */
const EMIT_TIMEOUT_MS = 25_000;
const READ_TIMEOUT_MS = 15_000;

/** Transporte compartido (timeout + res.ok antes de parsear + clasificación). */
const pacFetch = (url: string, init: RequestInit, timeoutMs: number) =>
    pacJsonFetch('Factus', url, init, timeoutMs);

// Tipo de documento SportMaps → identification_document_id de Factus (códigos DIAN).
const DOC_TYPE_MAP: Record<string, number> = {
    RC: 1, TI: 2, CC: 3, CE: 5, NIT: 6, PASAPORTE: 7,
};

interface CachedToken { token: string; expiresAt: number; }
const tokenCache = new Map<string, CachedToken>();

function baseUrl(cfg: ProviderConfig): string {
    return cfg.credentials.base_url || (cfg.sandbox ? SANDBOX_URL : PROD_URL);
}

async function getToken(cfg: ProviderConfig): Promise<string> {
    const cacheKey = `${baseUrl(cfg)}:${cfg.credentials.client_id}`;
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
            `Factus auth failed: ${json.error_description || json.message || res.status}`,
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

export const factusAdapter: InvoicingAdapter = {
    provider: 'factus',

    async emit(req: InvoiceRequest, cfg: ProviderConfig): Promise<InvoiceResult> {
        const token = await getToken(cfg);
        const isCompany = req.customer.documentType === 'NIT';

        // Id interno del catálogo V1 (NO el código DANE del cliente; ver el
        // encabezado). Se manda solo si el dueño lo configuró.
        const municipalityLegacyId = defaultMunicipalityLegacyId(cfg);

        const payload = {
            numbering_range_id: cfg.config.numbering_range_id,
            reference_code: req.referenceCode,
            observation: req.observation ?? '',
            payment_form: '1',            // 1 = contado
            // Medio de pago REAL. V1 y V2 comparten el nombre del campo y la
            // tabla de códigos de la DIAN; lo que cambió en V2 es que viaja
            // dentro de payment_details. Antes acá iba '10' clavado, que NO es
            // un genérico: es «efectivo», y declaraba en efectivo plata que
            // entró por transferencia.
            payment_method_code: resolvePaymentMethodCode(req.paymentMethod, cfg),
            customer: {
                identification: req.customer.identification,
                // Acá `names` viaja SIEMPRE, también para una persona jurídica, y
                // es deliberado: NO es el mismo bug que se corrigió en V2. Factus
                // retiró de su sitio la tabla de campos de V1 (hoy solo documenta
                // V2) y su página de cambios V1→V2 enumera los campos del cliente
                // que se renombraron —identification_document_id,
                // legal_organization_id, tribute_id, municipality_id— sin mencionar
                // `company`/`names`, lo que sugiere que V1 tiene los mismos dos
                // campos con la misma semántica. Al no poder confirmarlo contra
                // doc de V1, se agrega `company` para que la razón social viaje
                // donde debe y se conserva `names`: si V1 no conociera `company`
                // descartaría la clave y quedaría igual que hoy, mientras que
                // omitir `names` dejaría a la empresa sin nombre alguno.
                // PENDIENTE DE VERIFICAR contra un sandbox V1: si `company` se
                // refleja en la factura, quitar el `names` duplicado.
                names: req.customer.name,
                ...(isCompany ? { company: req.customer.name } : {}),
                address: req.customer.address ?? '',
                email: req.customer.email ?? '',
                phone: req.customer.phone ?? '',
                legal_organization_id: isCompany ? '1' : '2',   // 1=jurídica, 2=natural
                tribute_id: '21',                                // No responsable de IVA (consumidor)
                identification_document_id: String(DOC_TYPE_MAP[req.customer.documentType] ?? 3),
                // Sin dato configurado la clave NO viaja: antes se mandaba
                // `municipality_id: ''`, que es un valor que no identifica
                // ningún municipio y que el PAC descarta en silencio.
                ...(municipalityLegacyId ? { municipality_id: municipalityLegacyId } : {}),
            },
            items: req.items.map((it) => ({
                code_reference: it.codeReference,
                name: it.name,
                quantity: it.quantity,
                discount_rate: it.discountRate ?? 0,
                price: it.unitPrice,                             // IVA incluido
                tax_rate: (it.isExcluded ? 0 : it.taxRate).toFixed(2),
                unit_measure_id: 70,                             // unidad
                standard_code_id: 1,
                is_excluded: it.isExcluded ? 1 : 0,
                tribute_id: 1,                                   // IVA
                withholding_taxes: [],
            })),
        };

        const res = await pacFetch(`${baseUrl(cfg)}/v1/bills/validate`, {
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
        // el contenido y lo rechazó. Los fallos de transporte —donde el
        // documento PUDO quedar creado ante la DIAN— ya salieron por excepción
        // desde pacFetch para que la fila quede reintentable.
        if (!res.ok) {
            return {
                status: 'rejected',
                errorMessage: json?.message || `Factus HTTP ${res.status}`,
                raw: json ?? res.body,
            };
        }

        const bill = json?.data?.bill ?? {};
        return {
            status: 'accepted',
            providerBillId: bill.id != null ? String(bill.id) : null,
            prefix: null,
            number: bill.number ?? null,
            dianCode: bill?.document?.code ?? null,
            cufe: bill.cufe ?? null,
            qrUrl: bill.qr ?? null,
            qrImage: bill.qr_image ?? null,
            publicUrl: bill.public_url ?? null,
            pdfUrl: null,                       // Factus expone descarga aparte (fase 3)
            xmlUrl: null,
            taxableAmount: toNum(bill.taxable_amount),
            taxAmount: toNum(bill.tax_amount),
            total: toNum(bill.total),
            validatedAt: bill.validated ?? null,
            errorMessage: null,
            raw: json,
        };
    },
};
