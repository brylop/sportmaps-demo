import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export interface ShippingAddress {
    address_line: string;
    city:         string;
    state?:       string;
    postal_code?: string;
    country?:     string;
    name?:        string;
    phone?:       string;
}

export interface QuoteOption {
    carrier_code: string;
    service:      string;
    cost:         number;
    currency:     string;
    days_min:     number;
    days_max:     number;
    free_above?:  number;
}

export interface QuoteResult {
    quote_id:    string;
    provider:    string;
    quotes:      QuoteOption[];
    expires_at:  string;
}

export interface ShippingCarrier {
    id:               string;
    code:             string;
    name:             string;
    logo_url:         string | null;
    coverage:         'intracity' | 'national' | 'international';
    supports_cod:     boolean;
}

export interface VendorShippingSettings {
    vendor_profile_id:        string;
    origin_address:           Record<string, unknown>;
    origin_city:              string | null;
    origin_state:             string | null;
    origin_postal_code:       string | null;
    origin_country:           string;
    default_box_length_cm:    number | null;
    default_box_width_cm:     number | null;
    default_box_height_cm:    number | null;
    default_weight_grams:     number | null;
    free_shipping_min_amount: number | null;
    ready_to_ship_hours:      number;
    accepts_pickup_in_store:  boolean;
    pickup_addresses:         Array<Record<string, unknown>>;
    accepted_carrier_codes:   string[];
    return_policy_days:       number;
    return_policy_text:       string | null;
}

export interface Shipment {
    id:                  string;
    order_id:            string;
    carrier_code:        string | null;
    tracking_number:     string | null;
    status:              'pending' | 'label_created' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'lost' | 'failed';
    shipping_cost:       number;
    estimated_delivery:  string | null;
    shipped_at:          string | null;
    delivered_at:        string | null;
    created_at:          string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries publicas
// ─────────────────────────────────────────────────────────────────────────────

export function useShippingCarriers() {
    return useQuery({
        queryKey: ['shipping', 'carriers'],
        staleTime: 10 * 60_000,
        queryFn: async (): Promise<ShippingCarrier[]> => {
            const res = await fetch(`${API_URL}/api/v1/shipping/carriers`);
            if (!res.ok) throw new Error('Error cargando carriers.');
            const json = await res.json();
            return (json.data as ShippingCarrier[]) || [];
        },
    });
}

export function useShipmentTracking(trackingNumber?: string) {
    return useQuery({
        queryKey: ['shipping', 'tracking', trackingNumber],
        enabled: !!trackingNumber,
        queryFn: async () => {
            const res = await fetch(`${API_URL}/api/v1/shipping/tracking/${trackingNumber}`);
            if (!res.ok) throw new Error('Tracking no encontrado.');
            const json = await res.json();
            return json.data;
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Quote (mutation porque cambia datos cada vez)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteInput {
    origin:         ShippingAddress;
    destination:    ShippingAddress;
    weight_grams:   number;
    declared_value: number;
    dimensions?:    { length_cm: number; width_cm: number; height_cm: number };
    vendor_profile_id?: string;
    cart_id?:       string;
}

export function useShippingQuote() {
    return useMutation({
        mutationFn: async (input: QuoteInput): Promise<QuoteResult> => {
            const res = await fetch(`${API_URL}/api/v1/shipping/quote`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    ...input,
                    origin:      { country: 'CO', ...input.origin },
                    destination: { country: 'CO', ...input.destination },
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error cotizando.');
            return json.data as QuoteResult;
        },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor: settings + shipments
// ─────────────────────────────────────────────────────────────────────────────

export function useVendorShippingSettings() {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-shipping-settings', session?.user.id],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<VendorShippingSettings | null> => {
            const res = await fetch(`${API_URL}/api/v1/vendor/shipping/settings`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` },
            });
            if (!res.ok) throw new Error('Error cargando settings.');
            const json = await res.json();
            return (json.data as VendorShippingSettings) || null;
        },
    });
}

export function useUpdateVendorShippingSettings() {
    const { session } = useAuth();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (settings: Partial<VendorShippingSettings>) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/shipping/settings`, {
                method:  'PUT',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify(settings),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error guardando.');
            return json.data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-shipping-settings'] }),
    });
}

export function useVendorShipments(status?: string) {
    const { session } = useAuth();
    return useQuery({
        queryKey: ['vendor-shipments', session?.user.id, status],
        enabled: !!session?.access_token,
        queryFn: async (): Promise<Shipment[]> => {
            const url = `${API_URL}/api/v1/vendor/shipments${status ? `?status=${status}` : ''}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
            if (!res.ok) throw new Error('Error');
            const json = await res.json();
            return (json.data as Shipment[]) || [];
        },
    });
}

export function useShipmentMutations() {
    const { session } = useAuth();
    const qc = useQueryClient();
    const headers = () => ({
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
    });

    const createLabel = useMutation({
        mutationFn: async ({ shipmentId, carrier_code, service, quote_id }: { shipmentId: string; carrier_code: string; service: string; quote_id?: string }) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/shipments/${shipmentId}/label`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ carrier_code, service, quote_id }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error generando guía.');
            return json.data as Shipment;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-shipments'] }),
    });

    const cancelShipment = useMutation({
        mutationFn: async (shipmentId: string) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/shipments/${shipmentId}/cancel`, {
                method: 'POST', headers: headers(),
            });
            if (!res.ok) throw new Error('Error cancelando.');
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-shipments'] }),
    });

    const schedulePickup = useMutation({
        mutationFn: async ({ shipmentId, pickup_date }: { shipmentId: string; pickup_date: string }) => {
            const res = await fetch(`${API_URL}/api/v1/vendor/shipments/${shipmentId}/pickup`, {
                method: 'POST', headers: headers(),
                body: JSON.stringify({ pickup_date }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Error agendando recolección.');
            return json.data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-shipments'] }),
    });

    return { createLabel, cancelShipment, schedulePickup };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
export const SHIPMENT_STATUS_LABEL: Record<Shipment['status'], string> = {
    pending:          'Pendiente',
    label_created:    'Guía generada',
    picked_up:        'Recolectado',
    in_transit:       'En tránsito',
    out_for_delivery: 'En reparto',
    delivered:        'Entregado',
    returned:         'Devuelto',
    lost:             'Extraviado',
    failed:           'Fallido',
};

export const SHIPMENT_STATUS_COLOR: Record<Shipment['status'], string> = {
    pending:          'bg-slate-100 text-slate-700',
    label_created:    'bg-blue-100 text-blue-800',
    picked_up:        'bg-amber-100 text-amber-800',
    in_transit:       'bg-amber-100 text-amber-800',
    out_for_delivery: 'bg-purple-100 text-purple-800',
    delivered:        'bg-emerald-100 text-emerald-800',
    returned:         'bg-orange-100 text-orange-800',
    lost:             'bg-red-100 text-red-800',
    failed:           'bg-red-100 text-red-800',
};

export const CARRIER_LABEL: Record<string, string> = {
    servientrega:       'Servientrega',
    coordinadora:       'Coordinadora',
    interrapidisimo:    'Interrapidísimo',
    envia_colvanes:     'Envía Colvanes',
    tcc:                'TCC',
    mensajeros_urbanos: 'Mensajeros Urbanos',
    picap:              'Picap',
    rappi_cargo:        'Rappi Cargo',
    pickup_in_store:    'Recoger en tienda',
    vendor_delivers:    'Envío del vendedor',
};
