/**
 * Traducción de los códigos del motor de facturación (bff/src/services/
 * invoicing.service.ts) a español. Compartida por la pestaña de facturas, la
 * emisión por rango, el panel de datos faltantes y el botón de emitir un pago:
 * un `customer_missing_fiscal_data` en pantalla no le dice a nadie qué hacer.
 */

export const REASON_LABEL: Record<string, string> = {
    customer_missing_fiscal_data: 'Al pagador le falta documento o dirección',
    customer_missing_municipality: 'Al pagador le falta el municipio (código DANE)',
    customer_missing_email: 'Al pagador le falta el correo, o el que tiene no es válido',
    payment_without_payer: 'El cobro no tiene pagador vinculado',
    payment_without_school: 'El cobro no tiene escuela',
    payment_not_found: 'El cobro ya no existe',
    payment_not_paid: 'El cobro no está cobrado',
    no_invoice_provider: 'No hay facturador activo configurado',
    cannot_resolve_owner: 'No se pudo resolver a nombre de quién factura',
    provider_missing_numbering_range: 'Al facturador le falta el rango de numeración',
    draft_failed: 'No se pudo preparar el documento',
    emit_threw: 'El proveedor falló al recibir el documento',
    pac_transport_error: 'No se pudo confirmar con el proveedor (queda en cola para reintentar)',
    already_invoiced: 'Ya tenía factura viva',
    dry_run: 'Solo simulación: no se emitió',
    date_range_invalid: 'El rango de fechas no es válido',
    forbidden: 'Tu cuenta no puede emitir facturas de esta escuela',
};

/** Avisos que no impidieron emitir. */
export const WARNING_LABEL: Record<string, string> = {
    cliente_sin_correo: 'Salió sin correo del comprador (el proveedor lo permite)',
    municipio_del_emisor_por_falta_del_cliente: 'Salió con el municipio de la escuela: el pagador no tiene código DANE',
};

/**
 * Prefijo con el que el motor marca un fallo de TRANSPORTE (red, timeout, 5xx).
 * No es un rechazo: el documento pudo quedar creado en el PAC, así que la fila
 * se queda 'queued' para que la reconciliación la complete.
 */
export const TRANSPORT_PREFIX = 'transporte:';

export function reasonLabel(reason: string | null | undefined): string {
    if (!reason) return 'Sin motivo reportado';
    if (REASON_LABEL[reason]) return REASON_LABEL[reason];
    if (reason.startsWith(TRANSPORT_PREFIX)) {
        return `Fallo de comunicación con el proveedor: ${reason.slice(TRANSPORT_PREFIX.length).trim()}`;
    }
    const conPrefijo = Object.keys(REASON_LABEL).find((k) => reason.startsWith(`${k}:`));
    if (conPrefijo) return REASON_LABEL[conPrefijo];
    // Lo que no está en el mapa es el mensaje crudo del PAC: se muestra tal cual.
    return reason;
}

export function warningLabel(w: string): string {
    const k = Object.keys(WARNING_LABEL).find((key) => w === key || w.startsWith(`${key}:`));
    return k ? WARNING_LABEL[k] : w;
}
