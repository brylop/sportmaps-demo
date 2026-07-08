/**
 * invoicing.service — orquesta la emisión de una factura electrónica a partir
 * de un pago de SportMaps.
 *
 * Flujo: payment 'paid' → arma InvoiceRequest canónico con datos fiscales del
 * pagador → resuelve el PAC del dueño → llama al adaptador → persiste en
 * electronic_invoices + electronic_invoice_items.
 *
 * Idempotente: si el pago ya tiene una factura aceptada/enviada, la devuelve.
 * El reference_code (SM-<paymentId>) + unique(owner,reference_code) evita
 * duplicados aunque se dispare dos veces.
 */

import { supabase } from '../config/supabase';
import { resolveInvoiceProvider, OwnerType } from './invoice-provider.resolver';
import { getAdapter } from './invoicing';
import { InvoiceRequest, InvoiceLine } from './invoicing/types';

export interface EmitResult {
    ok: boolean;
    invoiceId?: string;
    status?: string;
    error?: string;
}

export async function emitInvoiceForPayment(paymentId: string): Promise<EmitResult> {
    // 1. Idempotencia: ¿ya hay factura viva para este pago?
    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('id, status')
        .eq('payment_id', paymentId)
        .in('status', ['accepted', 'sent', 'queued'])
        .maybeSingle();
    if (existing && existing.status !== 'queued') {
        return { ok: true, invoiceId: existing.id, status: existing.status };
    }

    // 2. Cargar el pago (fuente de verdad de monto/concepto/dueño).
    const { data: payment } = await supabase
        .from('payments')
        .select('id, amount, concept, school_id, parent_id')
        .eq('id', paymentId)
        .maybeSingle();
    if (!payment) return { ok: false, error: 'payment_not_found' };
    if (!payment.school_id) return { ok: false, error: 'payment_without_school' };
    if (!payment.parent_id) return { ok: false, error: 'payment_without_payer' };

    // Fase 1/2: el dueño emisor es la escuela. (vendor/organizer llegan luego.)
    const ownerType: OwnerType = 'school';
    const ownerId: string = payment.school_id;

    // 3. Resolver el facturador del dueño.
    const cfg = await resolveInvoiceProvider(ownerType, ownerId);
    if (!cfg) return { ok: false, error: 'no_invoice_provider' };
    const adapter = getAdapter(cfg.provider);
    if (!adapter) return { ok: false, error: `adapter_not_found:${cfg.provider}` };
    if (!cfg.config?.numbering_range_id) {
        return { ok: false, error: 'provider_missing_numbering_range' };
    }

    // 4. Datos fiscales del pagador.
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, document_type, document_number, billing_address, billing_state_dane, billing_city_dane')
        .eq('id', payment.parent_id)
        .maybeSingle();
    if (!profile?.document_number) return { ok: false, error: 'customer_missing_fiscal_data' };

    // 5. Armar el request canónico.
    //    Servicios deportivos/educativos suelen ser EXCLUIDOS de IVA → default
    //    excluido salvo que la config de la escuela diga lo contrario.
    const isExcluded = cfg.config.tax_excluded !== false;
    const taxRate = Number(cfg.config.default_tax_rate ?? 0);
    const referenceCode = `SM-${paymentId}`;

    const items: InvoiceLine[] = [{
        codeReference: `PAY-${paymentId.slice(0, 8)}`,
        name: payment.concept || 'Servicio deportivo',
        quantity: 1,
        unitPrice: Number(payment.amount),
        taxRate,
        isExcluded,
    }];

    const request: InvoiceRequest = {
        referenceCode,
        documentType: 'invoice',
        customer: {
            documentType: profile.document_type || 'CC',
            identification: profile.document_number,
            name: profile.full_name || 'Consumidor final',
            email: profile.email,
            phone: profile.phone,
            address: profile.billing_address,
            department: profile.billing_state_dane,
            city: profile.billing_city_dane,
        },
        items,
        observation: `Pago SportMaps: ${payment.concept ?? ''}`.trim(),
    };

    // 6. Fila draft/queued (idempotente por unique owner+reference_code).
    const { data: draft, error: draftErr } = await supabase
        .from('electronic_invoices')
        .upsert(
            {
                owner_type: ownerType,
                owner_id: ownerId,
                provider: cfg.provider,
                payment_id: paymentId,
                document_type: 'invoice',
                reference_code: referenceCode,
                status: 'queued',
                currency: 'COP',
                customer_snapshot: request.customer,
            },
            { onConflict: 'owner_type,owner_id,reference_code' },
        )
        .select('id')
        .single();
    if (draftErr || !draft) return { ok: false, error: draftErr?.message || 'draft_failed' };
    const invoiceId = draft.id as string;

    // 7. Emitir con el adaptador.
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

    // 8. Persistir resultado.
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

    // 9. Líneas (reescritas por si es reintento).
    await supabase.from('electronic_invoice_items').delete().eq('invoice_id', invoiceId);
    await supabase.from('electronic_invoice_items').insert(
        items.map((it, idx) => ({
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
