/**
 * factus.adapter — InvoicingAdapter para Factus (PAC Colombia).
 *
 * Auth:     OAuth2 password grant (form-urlencoded). Token cacheado en memoria
 *           por client_id hasta ~expiración (3600s).
 * Emisión:  POST /v1/bills/validate.
 *
 * cfg.credentials: { base_url?, client_id, client_secret, username, password }
 * cfg.config:      { numbering_range_id, default_municipality_id? }
 *
 * VALIDADO contra sandbox: data.bill trae { id, number, cufe, qr, qr_image,
 * public_url, document.code, taxable_amount, tax_amount, total, validated }.
 * Nota: `price` del item es IVA-incluido → Factus back-calcula base + IVA.
 */

import { InvoicingAdapter, InvoiceRequest, InvoiceResult, ProviderConfig } from './types';

const SANDBOX_URL = 'https://api-sandbox.factus.com.co';
const PROD_URL = 'https://api.factus.com.co';

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
    const res = await fetch(`${baseUrl(cfg)}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json.access_token) {
        throw new Error(`Factus auth failed: ${json.error_description || json.message || res.status}`);
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

        const payload = {
            numbering_range_id: cfg.config.numbering_range_id,
            reference_code: req.referenceCode,
            observation: req.observation ?? '',
            payment_form: '1',            // 1 = contado
            payment_method_code: '10',    // 10 = genérico
            customer: {
                identification: req.customer.identification,
                names: req.customer.name,
                address: req.customer.address ?? '',
                email: req.customer.email ?? '',
                phone: req.customer.phone ?? '',
                legal_organization_id: isCompany ? '1' : '2',   // 1=jurídica, 2=natural
                tribute_id: '21',                                // No responsable de IVA (consumidor)
                identification_document_id: String(DOC_TYPE_MAP[req.customer.documentType] ?? 3),
                municipality_id: String(
                    req.customer.municipalityId ?? cfg.config.default_municipality_id ?? '',
                ),
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

        const res = await fetch(`${baseUrl(cfg)}/v1/bills/validate`, {
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
                errorMessage: json?.message || `Factus HTTP ${res.status}`,
                raw: json,
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
