/**
 * shipping/types — Interface comun para providers de envio.
 *
 * Implementaciones:
 *  - MockProvider:        usa RPC get_shipping_quote_mock (default, no aggregator)
 *  - MoxProvider:         aggregator CO (TODO: necesita credenciales)
 *  - DrenvioProvider:     aggregator LatAm (TODO)
 *  - ServientregaDirect:  direct API (TODO)
 *
 * Elegir provider via env SHIPPING_PROVIDER=mock|mox|drenvio
 */

export interface Address {
    name?:         string;
    phone?:        string;
    email?:        string;
    address_line:  string;
    city:          string;
    state?:        string;
    postal_code?:  string;
    country:       string;
    reference?:    string;
}

export interface Dimensions {
    length_cm: number;
    width_cm:  number;
    height_cm: number;
}

export interface QuoteRequest {
    origin:         Address;
    destination:    Address;
    weight_grams:   number;
    declared_value: number;
    dimensions?:    Dimensions;
    /** vendor_profile_id para que el provider considere tarifas del vendor */
    vendor_profile_id?: string;
}

export interface QuoteOption {
    carrier_code: string;
    service:      string;
    cost:         number;
    currency:     string;
    days_min:     number;
    days_max:     number;
    /** Si el envio es gratis tras superar este monto en el carrito */
    free_above?:  number;
    /** Si el carrier permite cash on delivery para esta ruta */
    supports_cod?: boolean;
}

export interface QuoteResponse {
    provider:       string;
    quotes:         QuoteOption[];
    raw_response?:  unknown;
    expires_at?:    string;
}

export interface CreateLabelRequest {
    shipment_id:    string;
    carrier_code:   string;
    service:        string;
    origin:         Address;
    destination:    Address;
    weight_grams:   number;
    declared_value: number;
    dimensions?:    Dimensions;
    cod_amount?:    number;
    reference?:     string;
}

export interface CreateLabelResponse {
    tracking_number: string;
    tracking_url?:   string;
    label_url:       string;
    label_format:    'pdf' | 'zpl' | 'png';
    cost:            number;
    estimated_delivery?: string;
    raw_response?:   unknown;
}

export interface TrackingEvent {
    code:        string;
    description: string;
    location?:   string;
    occurred_at: string;
}

export interface TrackingResponse {
    tracking_number: string;
    status:          'pending' | 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'lost' | 'failed';
    events:          TrackingEvent[];
    delivered_at?:   string;
    estimated_delivery?: string;
    raw_response?:   unknown;
}

export interface PickupRequest {
    shipment_ids: string[];
    pickup_date:  string;
    pickup_address: Address;
}

export interface PickupResponse {
    pickup_id:        string;
    confirmed_at:     string;
    pickup_window:    { start: string; end: string };
    raw_response?:    unknown;
}

export interface ShippingProvider {
    name: string;

    /** Cotizar opciones de envio para un carrito */
    quote(req: QuoteRequest): Promise<QuoteResponse>;

    /** Crear guia / label de envio */
    createLabel(req: CreateLabelRequest): Promise<CreateLabelResponse>;

    /** Consultar tracking */
    track(tracking_number: string, carrier_code?: string): Promise<TrackingResponse>;

    /** Agendar recoleccion en el origen */
    schedulePickup?(req: PickupRequest): Promise<PickupResponse>;

    /** Cancelar una guia (si el carrier lo soporta) */
    cancelLabel?(tracking_number: string, carrier_code?: string): Promise<void>;

    /** Procesar webhook entrante del carrier/aggregator */
    parseWebhook?(payload: unknown, headers: Record<string, string>): TrackingResponse | null;
}
