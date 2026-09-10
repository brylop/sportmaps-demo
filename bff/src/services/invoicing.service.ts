/**
 * invoicing.service — orquesta la emisión de facturas electrónicas desde dos
 * orígenes, con el MISMO adaptador/PAC y modelo multi-owner:
 *
 *   1) payments (flujo escuela)        → emitInvoiceForPayment
 *   2) marketplace_transactions (tiendas/servicios/eventos) → emitInvoiceForMarketplaceTx
 *
 * Núcleo común en runEmission(). Idempotente por reference_code +
 * unique(owner, reference_code) y por el enlace (payment_id / mtx_id).
 *
 * Dos caminos para disparar la emisión de pagos, y no son intercambiables:
 *   - autoEmitPendingInvoices: cron, ventana CORTA (3 días), el día a día.
 *   - backfillInvoices:        a mano, rango de fechas explícito y tope, para
 *                              el rezago. Es el único camino para facturar un
 *                              mes cerrado.
 */

import { supabase } from '../config/supabase';
import { resolveInvoiceProvider, OwnerType } from './invoice-provider.resolver';
import { getAdapter } from './invoicing';
import {
    InvoiceRequest,
    InvoiceLine,
    InvoiceCustomer,
    ProviderConfig,
    normalizeDaneMunicipality,
    resolveCustomerMunicipality,
    isRetryablePacError,
    TRANSPORT_ERROR_PREFIX,
} from './invoicing/types';

export interface EmitResult {
    ok: boolean;
    invoiceId?: string;
    status?: string;
    error?: string;
    /**
     * Avisos que no impiden emitir pero que alguien tiene que ver, p. ej. que
     * se usó el municipio del emisor porque el del cliente no está. Antes eso
     * pasaba en silencio y por eso nadie sabía que había facturas de familias
     * de Mosquera y de Madrid que decían Bogotá.
     */
    warnings?: string[];
}

// ─── Helpers compartidos ──────────────────────────────────────────────────────

/** Datos fiscales del comprador desde su perfil. null si le faltan. */
async function loadCustomer(userId: string): Promise<InvoiceCustomer | null> {
    const { data: p } = await supabase
        .from('profiles')
        .select('full_name, email, phone, document_type, document_number, billing_address, billing_state_dane, billing_city_dane')
        .eq('id', userId)
        .maybeSingle();
    // El número de documento se normaliza quitando TODO espacio en blanco: hay
    // cédulas guardadas como '1015418301 ' y '4736509 ' (cuatro en Dynasty).
    // Un documento con espacio o el PAC lo rechaza con 422, o —peor— emite la
    // factura a nombre de un identificador que no existe en el RUT. Solo se
    // toca el espacio: puntos y el guion del dígito de verificación del NIT sí
    // son significativos.
    const identification = String(p?.document_number ?? '').replace(/\s+/g, '');
    if (!identification) return null;

    // `billing_city_dane` guarda el CÓDIGO DANE del municipio desde que el
    // formulario usa el selector del catálogo. Los perfiles viejos tienen
    // texto libre ("Bogota", "medellin"), que no sirve como código: en ese
    // caso queda null y decide la política del dueño
    // (resolveCustomerMunicipality), que ya NO sustituye en silencio.
    //
    // El código viaja como STRING de 5 dígitos. La versión anterior hacía
    // `Number(cityRaw)` y `Number('05001')` = 5001, que no es ningún
    // municipio: se rompían los 148 de Antioquia (05xxx) y Atlántico (08xxx)
    // —Medellín, Envigado, Barranquilla, Soledad—. Es el mismo bug que el
    // selector del formulario vino a cerrar, reintroducido una capa más abajo.
    const cityRaw = (p?.billing_city_dane ?? '').trim();
    return {
        documentType: p?.document_type || 'CC',
        identification,
        name: p?.full_name || 'Consumidor final',
        email: p?.email,
        phone: p?.phone,
        address: p?.billing_address,
        department: p?.billing_state_dane,
        city: cityRaw || null,
        municipalityCode: normalizeDaneMunicipality(cityRaw),
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
    link: { payment_id?: string; marketplace_transaction_id?: string; order_id?: string };
}): Promise<EmitResult> {
    const { ownerType, ownerId, cfg, request, link } = params;

    const adapter = getAdapter(cfg.provider);
    if (!adapter) return { ok: false, error: `adapter_not_found:${cfg.provider}` };
    if (!cfg.config?.numbering_range_id) return { ok: false, error: 'provider_missing_numbering_range' };

    // ── Municipio del adquirente ──────────────────────────────────────────────
    // Se resuelve ANTES de crear la fila: si la política del dueño es 'require'
    // y el dato falta, no queremos una fila en 'queued' que el barrido cuente
    // como facturada. Y el fallback al municipio del emisor, cuando aplica,
    // deja aviso — nunca más en silencio.
    const muni = resolveCustomerMunicipality(request.customer, cfg);
    if (muni.reject) return { ok: false, error: muni.reject };

    const warnings: string[] = [];
    if (muni.usedOwnerFallback) {
        warnings.push(`municipio_del_emisor_por_falta_del_cliente:${muni.code}`);
        console.warn(
            `[invoicing] ${request.referenceCode}: el cliente no tiene código DANE; se usa el del emisor (${muni.code}). ` +
            `Para cortar la emisión en estos casos, config.customer_municipality_policy='require'.`,
        );
    }
    const requestConMunicipio: InvoiceRequest = {
        ...request,
        customer: { ...request.customer, municipalityCode: muni.code },
    };

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
                customer_snapshot: requestConMunicipio.customer,
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
        result = await adapter.emit(requestConMunicipio, cfg);
    } catch (e: any) {
        // UN FALLO DE TRANSPORTE NO ES UN RECHAZO. Si la petición no llegó, no
        // volvió o volvió ilegible (red, timeout, 5xx, 429, credenciales), el
        // documento PUDO quedar creado ante la DIAN con su número consumido.
        // Marcarlo 'rejected' era el peor final posible: la reconciliación
        // excluye 'rejected', así que el número quedaba quemado, el documento
        // vivo en la DIAN, y para nosotros «Rechazada» para siempre.
        //
        // Por eso la fila se queda en 'queued' —que reconcilePendingInvoices SÍ
        // barre, consultando al PAC por reference_code— con el motivo marcado
        // con TRANSPORT_ERROR_PREFIX para que el backfill sepa que se puede
        // reintentar (la idempotencia por reference_code está confirmada:
        // reenviar devuelve el MISMO documento, no crea otro).
        const retryable = isRetryablePacError(e);
        const mensaje = e?.message ?? String(e);
        await supabase.from('electronic_invoices').update({
            status: retryable ? 'queued' : 'rejected',
            error_message: retryable ? `${TRANSPORT_ERROR_PREFIX} ${mensaje}` : mensaje,
            updated_at: new Date().toISOString(),
        }).eq('id', invoiceId);
        return {
            ok: false,
            invoiceId,
            error: retryable ? 'pac_transport_error' : (mensaje || 'emit_threw'),
            warnings: [...warnings, mensaje],
        };
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
        requestConMunicipio.items.map((it, idx) => ({
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

    // 'sent' cuenta como OK. Factus V2 en PRODUCCIÓN nunca responde 'accepted'
    // en la emisión: devuelve solo el acuse («Documento en proceso de
    // validación») y la DIAN valida minutos después, así que exigir 'accepted'
    // hacía que TODA emisión real se contara como fallida y que el barrido
    // reportara 0 emitidas con las facturas saliendo bien. Quien completa la
    // fila es reconcilePendingInvoices.
    return {
        ok: result.status === 'accepted' || result.status === 'sent',
        invoiceId,
        status: result.status,
        ...(warnings.length > 0 ? { warnings } : {}),
    };
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
        .select('id, amount, gross_amount, payment_method, status, concept, school_id, parent_id, user_id')
        .eq('id', paymentId)
        .maybeSingle();
    if (!payment) return { ok: false, error: 'payment_not_found' };
    // Solo se factura lo cobrado. Antes no se miraba el estado: se podía emitir
    // una factura fiscal (con número de la resolución DIAN, irrecuperable) por
    // un cobro pendiente o anulado.
    if (payment.status !== 'paid') return { ok: false, error: 'payment_not_paid' };
    if (!payment.school_id) return { ok: false, error: 'payment_without_school' };
    // El comprador es parent_id (menor con acudiente) o, si no hay, user_id
    // (atleta adulto que paga por sí mismo — school_athletes.parent_id sale
    // NULL para athlete_type='adult'; antes esto dejaba sus pagos sin
    // facturar en TODOS los canales, no solo efectivo).
    const payerId = payment.parent_id || payment.user_id;
    if (!payerId) return { ok: false, error: 'payment_without_payer' };

    const ownerType: OwnerType = 'school';
    const ownerId: string = payment.school_id;

    // Los datos del cliente se revisan ANTES del facturador a propósito: con el
    // facturador apagado (Dynasty hoy) todos los pagos reportarían
    // 'no_invoice_provider' y se perdería el diagnóstico útil —quién no tiene
    // pagador y quién no tiene documento—, que es justamente la lista de
    // trabajo que hay que resolver antes de prenderlo.
    const customer = await loadCustomer(payerId);
    if (!customer) return { ok: false, error: 'customer_missing_fiscal_data' };

    const cfg = await resolveInvoiceProvider(ownerType, ownerId);
    if (!cfg) return { ok: false, error: 'no_invoice_provider' };

    const { isExcluded, taxRate } = taxDefaults(cfg);

    // MONTO BRUTO: lo que el pagador pagó de verdad.
    //
    // En un pago online el padre paga `gross_amount` = amount + 5% de recargo, y
    // ese recargo le entra COMPLETO a la escuela (SportMaps no retiene por
    // transacción, monetiza por addon). Facturar `amount` dejaba una
    // mensualidad de 210.000 con extracto de tarjeta por 220.500: el
    // adquirente no puede soportar los 10.500 que pagó. El camino de
    // marketplace, en este mismo servicio, ya facturaba el bruto — esto lo
    // alinea, no es un criterio nuevo.
    //
    // `gross_amount` es NULL en todo pago que no pasó por pasarela (efectivo,
    // transferencia, manual: la mayoría). Contra la base de hoy nunca es menor
    // que `amount` (relación entre 1,00 y 1,05) — pero eso es una OBSERVACIÓN
    // de los datos actuales, no un invariante que nadie sostenga: `??` solo
    // atrapa null/undefined, así que un `gross_amount` en 0 (un bug de la
    // pasarela, una migración, una cortesía mal registrada) emitiría el
    // documento por CERO. Facturar por debajo de lo cobrado no se corrige: se
    // anula con nota crédito, y Dynasty hoy no tiene rango de nota crédito en
    // producción. Por eso el piso es explícito y no una confianza en los datos.
    const unitPrice = Math.max(
        Number(payment.amount) || 0,
        Number(payment.gross_amount) || 0,
    );

    const request: InvoiceRequest = {
        referenceCode: `SM-${paymentId}`,
        documentType: 'invoice',
        customer,
        items: [{
            codeReference: `PAY-${paymentId.slice(0, 8)}`,
            name: payment.concept || 'Servicio deportivo',
            quantity: 1,
            unitPrice,
            taxRate,
            isExcluded,
        }],
        observation: `Pago SportMaps: ${payment.concept ?? ''}`.trim(),
        // Medio de pago real ('transfer' | 'cash' | 'pse' | 'card' | 'other' |
        // null); el adaptador lo traduce al código de la DIAN.
        paymentMethod: payment.payment_method,
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

// ─── Origen 3: ventas de tienda (orders / order_items) ────────────────────────

export async function emitInvoiceForOrder(orderId: string): Promise<EmitResult> {
    const { data: existing } = await supabase
        .from('electronic_invoices')
        .select('id, status')
        .eq('order_id', orderId)
        .in('status', ['accepted', 'sent'])
        .maybeSingle();
    if (existing) return { ok: true, invoiceId: existing.id, status: existing.status };

    const { data: order } = await supabase
        .from('orders')
        .select('id, user_id, status, payment_method')
        .eq('id', orderId)
        .maybeSingle();
    if (!order) return { ok: false, error: 'order_not_found' };
    if (order.status !== 'paid') return { ok: false, error: 'order_not_paid' };
    if (!order.user_id) return { ok: false, error: 'order_without_buyer' };

    const { data: oi } = await supabase
        .from('order_items')
        .select('quantity, unit_price, product:products(name, school_id, vendor_profile_id)')
        .eq('order_id', orderId);
    if (!oi || oi.length === 0) return { ok: false, error: 'order_without_items' };

    // Emisor: tienda escolar (school_id del producto) o vendor externo (vendor_profile_id).
    let schoolId: string | null = null;
    let vendorProfileId: string | null = null;
    type RawLine = { name: string; quantity: number; unitPrice: number };
    const rawLines: RawLine[] = [];
    for (const row of oi) {
        const p: any = Array.isArray((row as any).product) ? (row as any).product[0] : (row as any).product;
        if (p?.school_id && !schoolId) schoolId = p.school_id;
        if (p?.vendor_profile_id && !vendorProfileId) vendorProfileId = p.vendor_profile_id;
        rawLines.push({
            name: p?.name || 'Producto',
            quantity: Number((row as any).quantity) || 1,
            unitPrice: Number((row as any).unit_price) || 0,
        });
    }

    let ownerType: OwnerType;
    let ownerId: string;
    if (schoolId) {
        ownerType = 'school';
        ownerId = schoolId;
    } else if (vendorProfileId) {
        ownerType = 'vendor';
        ownerId = vendorProfileId;
    } else {
        return { ok: false, error: 'cannot_resolve_owner' };
    }

    const cfg = await resolveInvoiceProvider(ownerType, ownerId);
    if (!cfg) return { ok: false, error: 'no_invoice_provider' };

    const customer = await loadCustomer(order.user_id);
    if (!customer) return { ok: false, error: 'customer_missing_fiscal_data' };

    // Productos físicos: GRAVADOS por defecto (IVA 19%), a diferencia de
    // mensualidades/servicios (excluidos). Configurable por el dueño con
    // products_tax_excluded / products_tax_rate.
    const isExcluded = cfg.config.products_tax_excluded === true;
    const taxRate = Number(cfg.config.products_tax_rate ?? 19);
    const items: InvoiceLine[] = rawLines.map((l, idx) => ({
        codeReference: `ORD-${orderId.slice(0, 8)}-${idx + 1}`,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate,
        isExcluded,
    }));

    const request: InvoiceRequest = {
        referenceCode: `SM-ORD-${orderId}`,
        documentType: 'invoice',
        customer,
        items,
        observation: 'Compra tienda SportMaps',
        // `orders` guarda su propio medio de pago, con los mismos valores que
        // payments. Sin esto, la venta de tienda también se declaraba en
        // efectivo.
        paymentMethod: (order as any).payment_method,
    };

    return runEmission({ ownerType, ownerId, cfg, request, link: { order_id: orderId } });
}

// ─── Triggers automáticos (barridos idempotentes) ──────────────────────────────

const AUTO_EMPTY = { scanned: 0, emitted: 0, failed: 0, skipped: 0 };
/**
 * Motivos que NO son un fallo: el pago no se puede facturar todavía (o nunca) y
 * no hay nada que reintentar hasta que cambie el dato de fondo.
 */
const SKIP_ERRORS = new Set([
    'customer_missing_fiscal_data',
    'customer_missing_municipality',
    'no_invoice_provider',
    'cannot_resolve_owner',
    'payment_not_paid',
    'payment_without_payer',
    'payment_without_school',
    'payment_not_found',
]);

/**
 * ¿Esta fila de electronic_invoices significa que el origen YA está facturado?
 *
 * No alcanza con «existe una fila»: el barrido anterior descartaba cualquier
 * fila en accepted/sent/queued/rejected, y con eso una fila que quedó en
 * 'queued' porque el proceso murió entre el upsert y la llamada al PAC contaba
 * como facturada para siempre, sin rescate posible.
 *
 *   accepted / void  → cerrada, no se toca.
 *   sent             → el PAC la acusó; le falta número, y de eso se encarga
 *                      reconcilePendingInvoices, no una emisión nueva.
 *   queued           → NO hubo acuse. Solo cuenta si la reconciliación ya le
 *                      puso número/CUFE; si no, se puede reintentar (la
 *                      idempotencia por reference_code está confirmada).
 *   rejected         → terminal, SALVO que el motivo sea un fallo nuestro de
 *                      transporte, que sí se reintenta.
 *   draft            → nunca salió.
 */
function esFacturaEfectiva(row: {
    status?: string | null;
    number?: string | null;
    cufe?: string | null;
    provider_bill_id?: string | null;
    error_message?: string | null;
}): boolean {
    const tieneDocumento = Boolean(row.number || row.cufe || row.provider_bill_id);
    switch (row.status) {
        case 'accepted':
        case 'void':
        case 'sent':
            return true;
        case 'queued':
            return tieneDocumento;
        case 'rejected':
            return !String(row.error_message ?? '').startsWith(TRANSPORT_ERROR_PREFIX);
        default:
            return false;
    }
}

/** Ids de origen (payments/mtx/orders) que ya tienen factura efectiva. */
async function idsConFacturaEfectiva(
    column: 'payment_id' | 'marketplace_transaction_id' | 'order_id',
    ids: string[],
): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data } = await supabase
        .from('electronic_invoices')
        .select(`${column}, status, number, cufe, provider_bill_id, error_message`)
        .in(column, ids);
    const set = new Set<string>();
    for (const row of (data ?? []) as any[]) {
        const id = row?.[column];
        if (id && esFacturaEfectiva(row)) set.add(id);
    }
    return set;
}

/** Tamaño de página al buscar candidatos. Acota la consulta, no el trabajo. */
const CANDIDATE_PAGE = 500;

/**
 * Recolecta pagos 'paid' pendientes de facturar, paginando los candidatos.
 *
 * El `.limit(100)` anterior estaba MAL PUESTO: se aplicaba antes de descartar
 * los ya facturados, así que el tope acotaba el universo y no el trabajo — con
 * 100 pagos ya facturados en la ventana, el barrido «no encontraba nada» aunque
 * hubiera pendientes justo detrás. Acá el tope se aplica sobre los pendientes.
 */
async function recolectarPagosPendientes(params: {
    aplicarFiltros: (q: any) => any;
    limit: number;
}): Promise<{ pending: string[]; yaFacturados: number; escaneados: number; truncado: boolean }> {
    const { aplicarFiltros, limit } = params;
    const pending: string[] = [];
    let yaFacturados = 0;
    let escaneados = 0;
    let truncado = false;

    for (let offset = 0; ; offset += CANDIDATE_PAGE) {
        const base = supabase.from('payments').select('id, payment_date').eq('status', 'paid');
        const { data, error } = await aplicarFiltros(base)
            // El desempate por id hace estable la paginación: sin él, dos
            // pagos con la misma payment_date pueden salir en las dos páginas
            // o en ninguna.
            .order('payment_date', { ascending: false, nullsFirst: false })
            .order('id', { ascending: true })
            .range(offset, offset + CANDIDATE_PAGE - 1);
        if (error) {
            console.error('[invoicing] recolectarPagosPendientes', error.message);
            break;
        }
        const ids = ((data ?? []) as any[]).map((p) => p.id as string);
        if (ids.length === 0) break;
        escaneados += ids.length;

        const ya = await idsConFacturaEfectiva('payment_id', ids);
        for (const id of ids) {
            if (ya.has(id)) { yaFacturados++; continue; }
            if (pending.length >= limit) { truncado = true; continue; }
            pending.push(id);
        }

        if (ids.length < CANDIDATE_PAGE) break;
        if (pending.length >= limit) { truncado = true; break; }
    }

    return { pending, yaFacturados, escaneados, truncado };
}

/** Barre pagos 'paid' recientes de escuelas con facturador activo sin factura. */
export async function autoEmitPendingInvoices(
    opts?: { sinceDays?: number; limit?: number },
): Promise<{ scanned: number; emitted: number; failed: number; skipped: number }> {
    const sinceDays = opts?.sinceDays ?? 3;
    const limit = opts?.limit ?? 100;
    const sinceDate = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
    // Sin milisegundos: el valor viaja crudo dentro del `or(...)` de PostgREST
    // y no hay razón para meterle más puntuación de la necesaria.
    const sinceTs = `${sinceDate}T00:00:00Z`;

    const { data: provs } = await supabase
        .from('electronic_invoice_providers')
        .select('owner_id')
        .eq('owner_type', 'school')
        .eq('enabled', true);
    const schoolIds = [...new Set((provs ?? []).map((p) => p.owner_id))];
    if (schoolIds.length === 0) return AUTO_EMPTY;

    // La ventana sigue siendo corta (3 días) A PROPÓSITO: el cron es para el
    // día a día y el rezago se factura con backfillInvoices, que recibe rango
    // explícito. Lo que sí se corrige es el EJE: filtrar solo por payment_date
    // dejaba fuera al pago de mora cargado a mano hoy con fecha de pago vieja,
    // que nacía fuera de la ventana y nadie volvía a mirar. Ahora entra por
    // cualquiera de las dos fechas: la del pago o la de la fila.
    const { pending, escaneados } = await recolectarPagosPendientes({
        limit,
        aplicarFiltros: (q) => q
            .in('school_id', schoolIds)
            .or(`payment_date.gte.${sinceDate},created_at.gte.${sinceTs}`),
    });
    // `scanned` sigue significando lo mismo que antes: pendientes procesados,
    // no candidatos leídos (eso es `escaneados`, que solo se registra en log).
    if (pending.length === 0) {
        if (escaneados > 0) console.log(`[invoicing] barrido: ${escaneados} candidatos, ninguno pendiente`);
        return AUTO_EMPTY;
    }

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

// ─── Backfill explícito (el camino para el rezago) ────────────────────────────

export interface BackfillDetail {
    paymentId: string;
    outcome: 'emitted' | 'skipped' | 'failed';
    /** Motivo del skip o del fallo. Vacío en una emisión limpia. */
    reason?: string;
    invoiceId?: string;
    status?: string;
    warnings?: string[];
}

export interface BackfillResult {
    /** emitted + skipped + failed: todo pago sobre el que se decidió algo. */
    attempted: number;
    emitted: number;
    skipped: number;
    failed: number;
    details: BackfillDetail[];
    /** Candidatos leídos en el rango (incluye los ya facturados). */
    scanned: number;
    /**
     * true = se alcanzó el tope, así que PUEDE haber más pendientes en el
     * rango: hay que volver a llamar hasta que salga false (la segunda pasada
     * es inofensiva, ya no hay nada que emitir).
     */
    truncated: boolean;
}

const BACKFILL_LIMIT_DEFAULT = 200;
const BACKFILL_LIMIT_MAX = 500;

/**
 * Factura el rezago de un dueño en un rango de fechas EXPLÍCITO.
 *
 * Existe porque el cron automático no puede alcanzarlo: su ventana es de 3 días
 * (y así debe quedarse), y de los 147 pagos de septiembre de Dynasty sin
 * factura, 110 caen fuera de esa ventana. Agrandar la ventana del cron habría
 * significado que cualquier despliegue disparara un barrido masivo sin que
 * nadie lo pidiera; esto se dispara a mano, con rango y tope.
 *
 * - `from`/`to` en 'YYYY-MM-DD', AMBOS INCLUSIVE, sobre `payment_date`. Un pago
 *   'paid' sin payment_date (66 en la base) entra por `created_at`, o si no
 *   sería invisible para los dos caminos.
 * - IDEMPOTENTE: descarta los que ya tienen factura efectiva
 *   (`esFacturaEfectiva`) y, por debajo, la idempotencia por reference_code del
 *   PAC garantiza que un reintento devuelva el MISMO documento en vez de
 *   quemar otro número. Llamarla dos veces no duplica nada.
 * - Cada pago que no se factura dice POR QUÉ: sin datos fiscales, sin pagador,
 *   ya facturado, no 'paid', sin facturador configurado, sin municipio.
 * - `dryRun` recorre y clasifica sin emitir nada: es la forma de ver la lista
 *   de trabajo antes de prender el facturador.
 *
 * Con el facturador APAGADO (enabled=false, como está Dynasty hoy) no emite
 * nada: cada pago sale como skipped 'no_invoice_provider'. Es deliberado —
 * prender el facturador es una decisión del dueño, no un efecto del backfill.
 */
export async function backfillInvoices(params: {
    ownerType: OwnerType;
    ownerId: string;
    from: string;
    to: string;
    limit?: number;
    dryRun?: boolean;
}): Promise<BackfillResult> {
    const { ownerType, ownerId, from, to } = params;
    const limit = Math.min(Math.max(1, Number(params.limit ?? BACKFILL_LIMIT_DEFAULT)), BACKFILL_LIMIT_MAX);
    const dryRun = params.dryRun === true;

    const vacio = (reason: string): BackfillResult => ({
        attempted: 0, emitted: 0, skipped: 0, failed: 0,
        details: [{ paymentId: '', outcome: 'skipped', reason }],
        scanned: 0, truncated: false,
    });

    const esFecha = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ''));
    // El rango es obligatorio y se valida: sin él, una llamada sin parámetros
    // barrería toda la historia de la escuela y emitiría facturas de años
    // anteriores. La decisión de negocio es facturar SOLO septiembre 2026.
    if (!esFecha(from) || !esFecha(to)) return vacio('invalid_date_range');
    if (from > to) return vacio('invalid_date_range');
    if (!ownerId) return vacio('missing_owner');
    // Solo `payments` tiene este camino: un vendor externo no cobra por acá.
    if (ownerType !== 'school') return vacio('owner_type_not_supported');

    // `to` inclusive: para `created_at` (timestamp) hay que comparar contra el
    // día siguiente, si no se pierde todo lo cargado ese último día.
    const diaSiguiente = new Date(`${to}T00:00:00Z`);
    diaSiguiente.setUTCDate(diaSiguiente.getUTCDate() + 1);
    const fromTs = `${from}T00:00:00Z`;
    const toTs = `${diaSiguiente.toISOString().slice(0, 10)}T00:00:00Z`;

    const { pending, yaFacturados, escaneados, truncado } = await recolectarPagosPendientes({
        limit,
        aplicarFiltros: (q) => q
            .eq('school_id', ownerId)
            .or(
                `and(payment_date.gte.${from},payment_date.lte.${to}),` +
                `and(payment_date.is.null,created_at.gte.${fromTs},created_at.lt.${toTs})`,
            ),
    });

    const details: BackfillDetail[] = [];
    let emitted = 0, skipped = 0, failed = 0;

    // Los ya facturados se reportan agregados y no uno por uno: en un rango de
    // un mes son cientos de filas de ruido y el dato que importa es cuántos.
    if (yaFacturados > 0) {
        skipped += yaFacturados;
        details.push({
            paymentId: '',
            outcome: 'skipped',
            reason: `already_invoiced:${yaFacturados}`,
        });
    }

    for (const paymentId of pending) {
        if (dryRun) {
            skipped++;
            details.push({ paymentId, outcome: 'skipped', reason: 'dry_run' });
            continue;
        }
        try {
            const r = await emitInvoiceForPayment(paymentId);
            if (r.ok) {
                emitted++;
                details.push({
                    paymentId, outcome: 'emitted',
                    invoiceId: r.invoiceId, status: r.status,
                    ...(r.warnings ? { warnings: r.warnings } : {}),
                });
            } else if (r.error && SKIP_ERRORS.has(r.error)) {
                skipped++;
                details.push({ paymentId, outcome: 'skipped', reason: r.error });
            } else {
                failed++;
                details.push({
                    paymentId, outcome: 'failed',
                    reason: r.error ?? 'unknown',
                    invoiceId: r.invoiceId,
                    ...(r.warnings ? { warnings: r.warnings } : {}),
                });
            }
        } catch (e: any) {
            failed++;
            details.push({ paymentId, outcome: 'failed', reason: e?.message ?? String(e) });
        }
    }

    return {
        attempted: emitted + skipped + failed,
        emitted, skipped, failed, details,
        scanned: escaneados,
        truncated: truncado,
    };
}

/**
 * Completa las facturas que quedaron a medias porque el PAC valida ASÍNCRONO.
 *
 * Factus V2 en producción responde a la emisión solo con un acuse
 * ("Documento en proceso de validación"), sin número ni CUFE: la fila nace en
 * 'sent' con casi todo en null y la DIAN valida minutos después. Sin este
 * barrido esa fila se queda así para siempre — el dueño ve "—" en su tabla y
 * el pagador no tiene factura que abrir, aunque el documento exista y esté
 * validado en el PAC.
 *
 * Pregunta por reference_code (que es nuestro, `SM-<paymentId>`) en vez de por
 * el número, justamente porque el número es lo que no tenemos. Idempotente:
 * volver a correrlo sobre una fila ya completa no cambia nada.
 */
export async function reconcilePendingInvoices(
    opts?: { sinceDays?: number; limit?: number },
): Promise<{ scanned: number; completed: number; stillPending: number; failed: number }> {
    const sinceDays = opts?.sinceDays ?? 15;
    const limit = opts?.limit ?? 100;
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

    // 'sent' y 'queued' son los dos estados a medias: enviada sin confirmar, y
    // el upsert previo a llamar al PAC. 'accepted' ya está completa y
    // 'rejected' no tiene nada que reconciliar.
    const { data: rows } = await supabase
        .from('electronic_invoices')
        .select('id, owner_type, owner_id, reference_code, status, cufe, validated_at')
        .in('status', ['sent', 'queued'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (!rows || rows.length === 0) return { scanned: 0, completed: 0, stillPending: 0, failed: 0 };

    let completed = 0, stillPending = 0, failed = 0;

    // Una config de facturador por dueño, no por fila: varias facturas de la
    // misma escuela comparten credenciales y token.
    const cfgCache = new Map<string, ProviderConfig | null>();

    for (const row of rows) {
        try {
            const key = `${row.owner_type}:${row.owner_id}`;
            if (!cfgCache.has(key)) {
                // includeDisabled: apagar el facturador detiene la emisión, pero
                // lo ya emitido igual hay que completarlo.
                cfgCache.set(key, await resolveInvoiceProvider(
                    row.owner_type as OwnerType, row.owner_id, { includeDisabled: true },
                ));
            }
            const cfg = cfgCache.get(key);
            if (!cfg) { failed++; continue; }

            const adapter = getAdapter(cfg.provider);
            // Un PAC síncrono no implementa fetchByReference y no necesita esto.
            if (!adapter?.fetchByReference) { stillPending++; continue; }

            const result = await adapter.fetchByReference(row.reference_code, cfg);
            if (!result) { stillPending++; continue; }

            // Solo se escribe cuando hay algo nuevo que escribir: si la DIAN
            // sigue sin validar, la fila se queda como está. Un rechazo SÍ es
            // algo nuevo aunque no traiga número.
            if (!result.number && !result.cufe && !result.errorMessage) { stillPending++; continue; }

            await supabase.from('electronic_invoices').update({
                status: result.status,
                provider_bill_id: result.providerBillId ?? null,
                prefix: result.prefix ?? null,
                number: result.number ?? null,
                dian_code: result.dianCode ?? null,
                cufe: result.cufe ?? null,
                qr_url: result.qrUrl ?? null,
                public_url: result.publicUrl ?? null,
                taxable_amount: result.taxableAmount ?? null,
                tax_amount: result.taxAmount ?? null,
                total: result.total ?? null,
                dian_response: result.raw ?? null,
                // El rechazo de la DIAN se sube a error_message para que se vea
                // en la UI; enterrado solo en dian_response nadie lo miraba.
                error_message: result.errorMessage ?? null,
                validated_at: result.validatedAt ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
            }).eq('id', row.id);

            if (result.status === 'accepted') completed++;
            else stillPending++;
        } catch {
            failed++;
        }
    }

    return { scanned: rows.length, completed, stillPending, failed };
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

    // Mismo criterio que el barrido de pagos: una fila 'queued' sin número no
    // es una factura, es una emisión que quedó a medias.
    const already = await idsConFacturaEfectiva('marketplace_transaction_id', ids);
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

/** Barre órdenes de tienda 'paid' recientes sin factura (escolar y externa). */
export async function autoEmitPendingOrders(
    opts?: { sinceDays?: number; limit?: number },
): Promise<{ scanned: number; emitted: number; failed: number; skipped: number }> {
    const sinceDays = opts?.sinceDays ?? 3;
    const limit = opts?.limit ?? 100;
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

    const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'paid')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(limit);
    const ids = (orders ?? []).map((o) => o.id);
    if (ids.length === 0) return AUTO_EMPTY;

    // Mismo criterio que el barrido de pagos (ver esFacturaEfectiva).
    const already = await idsConFacturaEfectiva('order_id', ids);
    const pending = ids.filter((id) => !already.has(id));
    let emitted = 0, failed = 0, skipped = 0;
    for (const id of pending) {
        try {
            const r = await emitInvoiceForOrder(id);
            if (r.ok) emitted++;
            else if (r.error && SKIP_ERRORS.has(r.error)) skipped++;
            else failed++;
        } catch { failed++; }
    }
    return { scanned: pending.length, emitted, failed, skipped };
}
