/**
 * invoicing.service — orquesta la emisión de facturas electrónicas desde dos
 * orígenes, con el MISMO adaptador/PAC y modelo multi-owner:
 *
 *   1) payments (flujo escuela)        → emitInvoiceForPayment
 *   2) marketplace_transactions (tiendas/servicios/eventos) → emitInvoiceForMarketplaceTx
 *
 * Núcleo común en runEmission(). Idempotente por reference_code +
 * unique(owner, reference_code) y por el enlace (payment_id / mtx_id).
 */

import { supabase } from '../config/supabase';
import { resolveInvoiceProvider, OwnerType } from './invoice-provider.resolver';
import { getAdapter } from './invoicing';
import { InvoiceRequest, InvoiceLine, InvoiceCustomer, ProviderConfig } from './invoicing/types';

export interface EmitResult {
    ok: boolean;
    invoiceId?: string;
    status?: string;
    error?: string;
}

// ─── Helpers compartidos ──────────────────────────────────────────────────────

/** Datos fiscales del comprador desde su perfil. null si le faltan. */
async function loadCustomer(userId: string): Promise<InvoiceCustomer | null> {
    const { data: p } = await supabase
        .from('profiles')
        .select('full_name, email, phone, document_type, document_number, billing_address, billing_state_dane, billing_city_dane')
        .eq('id', userId)
        .maybeSingle();
    if (!p?.document_number) return null;
    return {
        documentType: p.document_type || 'CC',
        identification: p.document_number,
        name: p.full_name || 'Consumidor final',
        email: p.email,
        phone: p.phone,
        address: p.billing_address,
        department: p.billing_state_dane,
        city: p.billing_city_dane,
    };
}

/** Impuesto por defecto según la config del PAC del dueño. */
function taxDefaults(cfg: ProviderConfig): { isExcluded: boolean; taxRate: number } {
    return {
        isExcluded: cfg.config.tax_excluded !== false, // default excluido salvo config
        taxRate: Number(cfg.config.default_tax_rate ?? 0),
    };
}

/**
 * Núcleo: crea la fila draft (idempotente), llama al adaptador y persiste el
 * resultado + líneas. `link` conecta la factura con su origen.
 */
async function runEmission(params: {
    ownerType: OwnerType;
    ownerId: string;
    cfg: ProviderConfig;
    request: InvoiceRequest;
    link: { payment_id?: string; marketplace_transaction_id?: string };
}): Promise<EmitResult> {
    const { ownerType, ownerId, cfg, request, link } = params;

    const adapter = getAdapter(cfg.provider);
    if (!adapter) return { ok: false, error: `adapter_not_found:${cfg.provider}` };
    if (!cfg.config?.numbering_range_id) return { ok: false, error: 'provider_missing_numbering_range' };

    const { data: draft, error: draftErr } = await supabase
        .from('electronic_invoices')
        .upsert(
            {
                owner_type: ownerType,
                owner_id: ownerId,
                provider: cfg.provider,
                document_type: 'invoice',
                reference_code: request.referenceCode,
                status: 'queued',
                currency: 'COP',
                customer_snapshot: request.customer,
                ...link,
            },
            { onConflict: 'owner_type,owner_id,reference_code' },
        )
        .select('id')
        .single();
    if (draftErr || !draft) return { ok: false, error: draftErr?.message || 'draft_failed' };
    const invoiceId = draft.id as string;

    let result;
    try {
        result = await adapter.emit(request, cfg);
    } catch (e: any) {
        await supabase.from('electronic_invoices').update({
            status: 'rejected',
            error_message: e?.message ?? String(e),
            updated_at: new Date().toISOString(),
        }).eq('id', invoiceId);
        return { ok: false, invoiceId, error: e?.message ?? 'emit_threw' };
    }

    await supabase.from('electronic_invoices').update({
        status: result.status,
        provider_bill_id: result.providerBillId ?? null,
        prefix: result.prefix ?? null,
        number: result.number ?? null,
        dian_code: result.dianCode ?? null,
        cufe: result.cufe ?? null,
        qr_url: result.qrUrl ?? null,
        qr_image: result.qrImage ?? null,
        public_url: result.publicUrl ?? null,
        pdf_url: result.pdfUrl ?? null,
        xml_url: result.xmlUrl ?? null,
        taxable_amount: result.taxableAmount ?? null,
        tax_amount: result.taxAmount ?? null,
        total: result.total ?? null,
        dian_response: result.raw ?? null,
        error_message: result.errorMessage ?? null,
        validated_at: result.validatedAt ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
    }).eq('id', invoiceId);

    await supabase.from('electronic_invoice_items').delete().eq('invoice_id', invoiceId);
    await supabase.from('electronic_invoice_items').insert(
        request.items.map((it, idx) => ({
            invoice_id: invoiceId,
            line_no: idx + 1,
            code_reference: it.codeReference,
            name: it.name,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            discount_rate: it.discountRate ?? 0,
            is_excluded: it.isExcluded ?? false,
            tax_rate: it.isExcluded ? 0 : it.taxRate,
            tax_code: '01',
            taxable_amount: result.taxableAmount ?? null,
            tax_amount: result.taxAmount ?? null,
            total: result.total ?? null,
        })),
    );

    return { ok: result.status === 'accepted', invoiceId, status: result.status };
}

// ─── Origen 1: pagos de escuela (tabla payments) ───────────────────────────────

export async function emitInvoiceForPayment(paymentId: string): Promise<EmitResult> {
    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('id, status')
        .eq('payment_id', paymentId)
        .in('status', ['accepted', 'sent'])
        .maybeSingle();
    if (existing) return { ok: true, invoiceId: existing.id, status: existing.status };

    const { data: payment } = await supabase
        .from('payments')
        .select('id, amount, concept, school_id, parent_id')
        .eq('id', paymentId)
        .maybeSingle();
    if (!payment) return { ok: false, error: 'payment_not_found' };
    if (!payment.school_id) return { ok: false, error: 'payment_without_school' };
    if (!payment.parent_id) return { ok: false, error: 'payment_without_payer' };

    const ownerType: OwnerType = 'school';
    const ownerId: string = payment.school_id;

    const cfg = await resolveInvoiceProvider(ownerType, ownerId);
    if (!cfg) return { ok: false, error: 'no_invoice_provider' };

    const customer = await loadCustomer(payment.parent_id);
    if (!customer) return { ok: false, error: 'customer_missing_fiscal_data' };

    const { isExcluded, taxRate } = taxDefaults(cfg);
    const request: InvoiceRequest = {
        referenceCode: `SM-${paymentId}`,
        documentType: 'invoice',
        customer,
        items: [{
            codeReference: `PAY-${paymentId.slice(0, 8)}`,
            name: payment.concept || 'Servicio deportivo',
            quantity: 1,
            unitPrice: Number(payment.amount),
            taxRate,
            isExcluded,
        }],
        observation: `Pago SportMaps: ${payment.concept ?? ''}`.trim(),
    };

    return runEmission({ ownerType, ownerId, cfg, request, link: { payment_id: paymentId } });
}

// ─── Origen 2: ventas de marketplace (tiendas/servicios/eventos) ───────────────

export async function emitInvoiceForMarketplaceTx(txId: string): Promise<EmitResult> {
    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('id, status')
        .eq('marketplace_transaction_id', txId)
        .in('status', ['accepted', 'sent'])
        .maybeSingle();
    if (existing) return { ok: true, invoiceId: existing.id, status: existing.status };

    const { data: tx } = await supabase
        .from('marketplace_transactions')
        .select('id, checkout_type, user_id, vendor_profile_id, order_id, gross_amount, description, status')
        .eq('id', txId)
        .maybeSingle();
    if (!tx) return { ok: false, error: 'tx_not_found' };
    if (tx.status !== 'paid') return { ok: false, error: 'tx_not_paid' };
    if (!tx.user_id) return { ok: false, error: 'tx_without_buyer' };

    // Líneas crudas + resolución de tienda escolar (por school_id del producto).
    type RawLine = { name: string; quantity: number; unitPrice: number };
    const rawLines: RawLine[] = [];
    let schoolIdFromProducts: string | null = null;

    if (tx.order_id) {
        const { data: oi } = await supabase
            .from('order_items')
            .select('quantity, unit_price, product:products(name, school_id)')
            .eq('order_id', tx.order_id);
        for (const row of oi ?? []) {
            const prod: any = Array.isArray((row as any).product) ? (row as any).product[0] : (row as any).product;
            if (prod?.school_id && !schoolIdFromProducts) schoolIdFromProducts = prod.school_id;
            rawLines.push({
                name: prod?.name || 'Producto',
                quantity: Number((row as any).quantity) || 1,
                unitPrice: Number((row as any).unit_price) || 0,
            });
        }
    }
    if (rawLines.length === 0) {
        rawLines.push({
            name: tx.description || `Venta ${tx.checkout_type}`,
            quantity: 1,
            unitPrice: Number(tx.gross_amount) || 0,
        });
    }

    // Emisor: vendor externo (vendor_profile_id) o tienda escolar (school_id del producto).
    let ownerType: OwnerType;
    let ownerId: string;
    if (tx.vendor_profile_id) {
        ownerType = 'vendor';
        ownerId = tx.vendor_profile_id;
    } else if (schoolIdFromProducts) {
        ownerType = 'school';
        ownerId = schoolIdFromProducts;
    } else {
        return { ok: false, error: 'cannot_resolve_owner' };
    }

    const cfg = await resolveInvoiceProvider(ownerType, ownerId);
    if (!cfg) return { ok: false, error: 'no_invoice_provider' };

    const customer = await loadCustomer(tx.user_id);
    if (!customer) return { ok: false, error: 'customer_missing_fiscal_data' };

    const { isExcluded, taxRate } = taxDefaults(cfg);
    const items: InvoiceLine[] = rawLines.map((l, idx) => ({
        codeReference: `MTX-${txId.slice(0, 8)}-${idx + 1}`,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate,
        isExcluded,
    }));

    const request: InvoiceRequest = {
        referenceCode: `SM-MTX-${txId}`,
        documentType: 'invoice',
        customer,
        items,
        observation: `Venta SportMaps: ${tx.description ?? tx.checkout_type}`.trim(),
    };

    return runEmission({ ownerType, ownerId, cfg, request, link: { marketplace_transaction_id: txId } });
}

// ─── Triggers automáticos (barridos idempotentes) ──────────────────────────────

const AUTO_EMPTY = { scanned: 0, emitted: 0, failed: 0, skipped: 0 };
const SKIP_ERRORS = new Set(['customer_missing_fiscal_data', 'no_invoice_provider', 'cannot_resolve_owner']);

/** Barre pagos 'paid' recientes de escuelas con facturador activo sin factura. */
export async function autoEmitPendingInvoices(
    opts?: { sinceDays?: number; limit?: number },
): Promise<{ scanned: number; emitted: number; failed: number; skipped: number }> {
    const sinceDays = opts?.sinceDays ?? 3;
    const limit = opts?.limit ?? 100;
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);

    const { data: provs } = await supabase
        .from('electronic_invoice_providers')
        .select('owner_id')
        .eq('owner_type', 'school')
        .eq('enabled', true);
    const schoolIds = [...new Set((provs ?? []).map((p) => p.owner_id))];
    if (schoolIds.length === 0) return AUTO_EMPTY;

    const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'paid')
        .in('school_id', schoolIds)
        .gte('payment_date', since)
        .order('payment_date', { ascending: false })
        .limit(limit);
    const ids = (payments ?? []).map((p) => p.id);
    if (ids.length === 0) return AUTO_EMPTY;

    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('payment_id')
        .in('payment_id', ids)
        .in('status', ['accepted', 'sent', 'queued', 'rejected']);
    const already = new Set((existing ?? []).map((e) => e.payment_id));

    const pending = ids.filter((id) => !already.has(id));
    let emitted = 0, failed = 0, skipped = 0;
    for (const id of pending) {
        try {
            const r = await emitInvoiceForPayment(id);
            if (r.ok) emitted++;
            else if (r.error && SKIP_ERRORS.has(r.error)) skipped++;
            else failed++;
        } catch { failed++; }
    }
    return { scanned: pending.length, emitted, failed, skipped };
}

/** Barre ventas de marketplace 'paid' recientes sin factura (tienda escolar y externa). */
export async function autoEmitPendingMarketplaceInvoices(
    opts?: { sinceDays?: number; limit?: number },
): Promise<{ scanned: number; emitted: number; failed: number; skipped: number }> {
    const sinceDays = opts?.sinceDays ?? 3;
    const limit = opts?.limit ?? 100;
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

    const { data: txs } = await supabase
        .from('marketplace_transactions')
        .select('id')
        .eq('status', 'paid')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
    const ids = (txs ?? []).map((t) => t.id);
    if (ids.length === 0) return AUTO_EMPTY;

    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('marketplace_transaction_id')
        .in('marketplace_transaction_id', ids)
        .in('status', ['accepted', 'sent', 'queued', 'rejected']);
    const already = new Set((existing ?? []).map((e) => e.marketplace_transaction_id));

    const pending = ids.filter((id) => !already.has(id));
    let emitted = 0, failed = 0, skipped = 0;
    for (const id of pending) {
        try {
            const r = await emitInvoiceForMarketplaceTx(id);
            if (r.ok) emitted++;
            else if (r.error && SKIP_ERRORS.has(r.error)) skipped++;
            else failed++;
        } catch { failed++; }
    }
    return { scanned: pending.length, emitted, failed, skipped };
}
