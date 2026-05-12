/**
 * MockProvider — default cuando no hay aggregator real.
 *
 * - quote(): usa RPC get_shipping_quote_mock (tarifas planas / tabla shipping_rates)
 * - createLabel(): genera tracking_number aleatorio + label PDF placeholder
 * - track(): devuelve estado simulado (picked_up -> in_transit -> delivered)
 *
 * Para producción real, reemplazar por MoxProvider con credenciales.
 */

import { randomUUID, randomBytes } from 'crypto';
import { supabase } from '../../config/supabase';
import {
    ShippingProvider, QuoteRequest, QuoteResponse,
    CreateLabelRequest, CreateLabelResponse,
    TrackingResponse, TrackingEvent,
} from './types';

export class MockShippingProvider implements ShippingProvider {
    name = 'mock';

    async quote(req: QuoteRequest): Promise<QuoteResponse> {
        const { data, error } = await supabase.rpc('get_shipping_quote_mock', {
            p_origin_city:       req.origin.city,
            p_destination_city:  req.destination.city,
            p_weight_grams:      req.weight_grams,
            p_vendor_profile_id: req.vendor_profile_id ?? null,
        });

        if (error) {
            console.error('mock get_shipping_quote error', error);
            // Fallback hardcoded si la RPC falla
            return {
                provider: 'mock',
                quotes: [
                    { carrier_code: 'coordinadora', service: 'standard', cost: 14000, currency: 'COP', days_min: 2, days_max: 4 },
                ],
            };
        }

        const raw = data as any;
        return {
            provider: 'mock',
            quotes:   (raw.quotes || []).map((q: any) => ({
                carrier_code: q.carrier_code,
                service:      q.service,
                cost:         Number(q.cost),
                currency:     'COP',
                days_min:     Number(q.days_min),
                days_max:     Number(q.days_max),
                free_above:   q.free_above ? Number(q.free_above) : undefined,
            })),
            raw_response: raw,
            expires_at:   new Date(Date.now() + 15 * 60_000).toISOString(),
        };
    }

    async createLabel(req: CreateLabelRequest): Promise<CreateLabelResponse> {
        // Tracking number plausible (prefijo carrier + 10 digitos)
        const prefix = (req.carrier_code || 'SM').slice(0, 3).toUpperCase();
        const random = randomBytes(5).toString('hex').toUpperCase();
        const tracking = `${prefix}${random}`;

        const estimatedDays = req.service === 'express' ? 2 : 4;
        const estimatedDelivery = new Date();
        estimatedDelivery.setDate(estimatedDelivery.getDate() + estimatedDays);

        // PDF placeholder URL (en prod seria un PDF real generado por el aggregator)
        const labelUrl = `https://placehold.co/600x400/png?text=Mock+Label+${tracking}`;

        return {
            tracking_number:     tracking,
            tracking_url:        `https://example.com/track/${tracking}`,
            label_url:           labelUrl,
            label_format:        'pdf',
            cost:                0, // mock — el costo real se setea al crear el shipment
            estimated_delivery:  estimatedDelivery.toISOString(),
            raw_response: { mock: true, generated_at: new Date().toISOString() },
        };
    }

    async track(tracking_number: string, carrier_code?: string): Promise<TrackingResponse> {
        // Simulacion: si el tracking termina en par, "in_transit"; impar, "delivered"
        const isEven = parseInt(tracking_number.slice(-1), 16) % 2 === 0;
        const status = isEven ? 'in_transit' : 'delivered';

        const events: TrackingEvent[] = [
            { code: 'LABEL_CREATED', description: 'Etiqueta generada', occurred_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
            { code: 'PICKED_UP',     description: 'Recogido en origen', location: 'CDC Bogotá', occurred_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
            { code: 'IN_TRANSIT',    description: 'En tránsito', location: 'Hub central', occurred_at: new Date(Date.now() - 86400_000).toISOString() },
        ];

        if (status === 'delivered') {
            events.push({
                code: 'DELIVERED',
                description: 'Entregado al destinatario',
                occurred_at: new Date().toISOString(),
            });
        }

        return {
            tracking_number,
            status,
            events,
            delivered_at: status === 'delivered' ? new Date().toISOString() : undefined,
            estimated_delivery: new Date(Date.now() + 86400_000).toISOString(),
            raw_response: { mock: true, carrier_code },
        };
    }

    parseWebhook(payload: unknown, _headers: Record<string, string>): TrackingResponse | null {
        const p = payload as any;
        if (!p?.tracking_number || !p?.status) return null;
        return {
            tracking_number: p.tracking_number,
            status:          p.status,
            events:          p.events || [],
            delivered_at:    p.delivered_at,
            raw_response:    payload,
        };
    }
}
