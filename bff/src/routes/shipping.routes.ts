/**
 * shipping.routes — Cotizacion, generacion de guias, tracking, webhook.
 *
 * Publico:
 *  POST /api/v1/shipping/quote               cotizar (anonimos OK)
 *  GET  /api/v1/shipping/carriers            lista carriers activos
 *  GET  /api/v1/shipping/tracking/:number    tracking publico (sin auth)
 *  POST /api/v1/webhooks/shipping/:provider  webhook entrante
 *
 * Autenticado (vendor):
 *  GET  /api/v1/vendor/shipping/settings     leer config envios del vendor
 *  PUT  /api/v1/vendor/shipping/settings     actualizar
 *  POST /api/v1/vendor/shipments/:id/label   genera guia (crea shipment + label)
 *  POST /api/v1/vendor/shipments/:id/cancel  cancela guia
 *  POST /api/v1/vendor/shipments/:id/pickup  agenda recoleccion
 *  GET  /api/v1/vendor/shipments             lista envios del vendor
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireMarketplaceAuth, optionalAuth, auditLog } from '../middlewares/authMiddleware';
import { supabase } from '../config/supabase';
import { getShippingProvider, QuoteRequest } from '../services/shipping';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Public: GET /shipping/carriers
// ─────────────────────────────────────────────────────────────────────────────
router.get('/carriers', async (_req: Request, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('shipping_carriers')
            .select('id, code, name, logo_url, coverage, supports_cod, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) return res.status(500).json({ ok: false, error: 'Error obteniendo carriers.' });
        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public: POST /shipping/quote
// ─────────────────────────────────────────────────────────────────────────────
const QuoteSchema = z.object({
    origin:      z.object({
        address_line: z.string().min(2),
        city:         z.string().min(2),
        state:        z.string().optional(),
        postal_code:  z.string().optional(),
        country:      z.string().default('CO'),
    }),
    destination: z.object({
        address_line: z.string().min(2),
        city:         z.string().min(2),
        state:        z.string().optional(),
        postal_code:  z.string().optional(),
        country:      z.string().default('CO'),
    }),
    weight_grams:      z.number().int().positive(),
    declared_value:    z.number().nonnegative(),
    dimensions:        z.object({
        length_cm: z.number().positive(),
        width_cm:  z.number().positive(),
        height_cm: z.number().positive(),
    }).optional(),
    vendor_profile_id: z.string().uuid().optional(),
    cart_id:           z.string().optional(),
});

router.post('/quote', optionalAuth, async (req: Request, res: Response) => {
    try {
        const parsed = QuoteSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.', issues: parsed.error.format() });
        }

        const provider = getShippingProvider();
        const quoteReq: QuoteRequest = {
            origin:            parsed.data.origin,
            destination:       parsed.data.destination,
            weight_grams:      parsed.data.weight_grams,
            declared_value:    parsed.data.declared_value,
            dimensions:        parsed.data.dimensions,
            vendor_profile_id: parsed.data.vendor_profile_id,
        };

        const result = await provider.quote(quoteReq);

        // Cachear quote en DB para reusar al checkout
        const { data: cached } = await supabase
            .from('shipping_rate_quotes')
            .insert({
                user_id:        (req as any).user?.id ?? null,
                cart_id:        parsed.data.cart_id ?? null,
                origin:         parsed.data.origin,
                destination:    parsed.data.destination,
                weight_grams:   parsed.data.weight_grams,
                declared_value: parsed.data.declared_value,
                dimensions:     parsed.data.dimensions ?? null,
                quotes:         result.quotes,
                provider:       result.provider,
                raw_response:   result.raw_response ?? null,
                expires_at:     result.expires_at ?? new Date(Date.now() + 15 * 60_000).toISOString(),
            })
            .select('id, expires_at')
            .single();

        return res.json({
            ok: true,
            data: {
                quote_id:  cached?.id,
                provider:  result.provider,
                quotes:    result.quotes,
                expires_at: cached?.expires_at,
            },
        });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Public: GET /shipping/tracking/:number
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tracking/:number', async (req: Request, res: Response) => {
    try {
        const { number } = req.params;

        // Cargar shipment local primero
        const { data: shipment } = await supabase
            .from('shipments')
            .select('id, status, carrier_code, events, tracking_url, estimated_delivery, shipped_at, delivered_at')
            .eq('tracking_number', number)
            .maybeSingle();

        if (!shipment) {
            return res.status(404).json({ ok: false, error: 'Tracking no encontrado.' });
        }

        // Refrescar contra el provider (best effort)
        try {
            const provider = getShippingProvider();
            const fresh = await provider.track(number, shipment.carrier_code ?? undefined);

            // Actualizar shipment con eventos nuevos
            await supabase
                .from('shipments')
                .update({
                    status:        fresh.status,
                    events:        fresh.events,
                    delivered_at:  fresh.delivered_at ?? shipment.delivered_at,
                })
                .eq('id', shipment.id);

            return res.json({ ok: true, data: { ...shipment, ...fresh } });
        } catch (provErr) {
            // Si el provider falla, devolvemos lo que tenemos en DB
            return res.json({ ok: true, data: shipment });
        }
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Autenticado: vendor settings + label/cancel/pickup
// ─────────────────────────────────────────────────────────────────────────────
const auth = Router();
auth.use(requireMarketplaceAuth);

async function getVendorProfileId(userId: string): Promise<string | null> {
    const { data } = await supabase.from('vendor_profiles').select('id').eq('user_id', userId).maybeSingle();
    return (data as any)?.id ?? null;
}

// GET /vendor/shipping/settings
auth.get('/vendor/shipping/settings', async (req: Request, res: Response) => {
    try {
        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const { data, error } = await supabase
            .from('vendor_shipping_settings')
            .select('*')
            .eq('vendor_profile_id', vpId)
            .maybeSingle();

        if (error) return res.status(500).json({ ok: false, error: 'Error obteniendo settings.' });
        return res.json({ ok: true, data: data || null });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// PUT /vendor/shipping/settings
const SettingsSchema = z.object({
    origin_address:           z.record(z.unknown()).optional(),
    origin_city:              z.string().optional().nullable(),
    origin_state:             z.string().optional().nullable(),
    origin_postal_code:       z.string().optional().nullable(),
    origin_country:           z.string().optional(),
    default_box_length_cm:    z.number().int().positive().optional().nullable(),
    default_box_width_cm:     z.number().int().positive().optional().nullable(),
    default_box_height_cm:    z.number().int().positive().optional().nullable(),
    default_weight_grams:     z.number().int().positive().optional().nullable(),
    free_shipping_min_amount: z.number().nonnegative().optional().nullable(),
    ready_to_ship_hours:      z.number().int().min(0).max(168).optional(),
    accepts_pickup_in_store:  z.boolean().optional(),
    pickup_addresses:         z.array(z.record(z.unknown())).optional(),
    accepted_carrier_codes:   z.array(z.string()).optional(),
    return_policy_days:       z.number().int().min(0).max(90).optional(),
    return_policy_text:       z.string().max(2000).optional().nullable(),
});

auth.put('/vendor/shipping/settings', async (req: Request, res: Response) => {
    try {
        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const parsed = SettingsSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Datos invalidos.', issues: parsed.error.format() });
        }

        const { data, error } = await supabase
            .from('vendor_shipping_settings')
            .upsert({ vendor_profile_id: vpId, ...parsed.data }, { onConflict: 'vendor_profile_id' })
            .select()
            .single();

        if (error) {
            req.log?.error({ err: error }, 'Error guardando shipping settings');
            return res.status(500).json({ ok: false, error: 'Error guardando settings.' });
        }
        await auditLog(req, 'vendor_shipping_settings_update', 'vendor_shipping_settings', vpId);
        return res.json({ ok: true, data });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// POST /vendor/shipments/:id/label — crear guia
const LabelSchema = z.object({
    carrier_code:   z.string(),
    service:        z.string(),
    quote_id:       z.string().uuid().optional(),
});

auth.post('/vendor/shipments/:id/label', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const parsed = LabelSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ ok: false, error: 'Body invalido.' });
        }

        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        // Cargar shipment + order + destination
        const { data: shipment, error: e1 } = await supabase
            .from('shipments')
            .select('id, order_id, vendor_profile_id, weight_grams, dimensions, origin, destination, tracking_number, orders!inner(shipping_address, total_amount)')
            .eq('id', id)
            .eq('vendor_profile_id', vpId)
            .maybeSingle();

        if (e1 || !shipment) {
            return res.status(404).json({ ok: false, error: 'Envio no encontrado.' });
        }
        if (shipment.tracking_number) {
            return res.status(409).json({ ok: false, error: 'Este envio ya tiene guia.' });
        }

        const provider = getShippingProvider();
        const dst = (shipment.destination as any) ?? ((shipment.orders as any)?.shipping_address) ?? {};
        const orig = (shipment.origin as any) ?? {};

        const label = await provider.createLabel({
            shipment_id:    id as string,
            carrier_code:   parsed.data.carrier_code,
            service:        parsed.data.service,
            origin:         orig,
            destination:    dst,
            weight_grams:   shipment.weight_grams || 500,
            declared_value: Number((shipment.orders as any)?.total_amount || 0),
            dimensions:     (shipment.dimensions as any) || undefined,
            reference:      shipment.order_id,
        });

        const { data: updated } = await supabase
            .from('shipments')
            .update({
                tracking_number:     label.tracking_number,
                tracking_url:        label.tracking_url ?? null,
                label_url:           label.label_url,
                label_format:        label.label_format,
                carrier_code:        parsed.data.carrier_code,
                provider:            provider.name,
                shipping_cost:       label.cost,
                estimated_delivery:  label.estimated_delivery ? new Date(label.estimated_delivery).toISOString().slice(0, 10) : null,
                status:              'label_created',
                raw_response:        label.raw_response ?? null,
            })
            .eq('id', id)
            .select()
            .single();

        await auditLog(req, 'shipment_label_create', 'shipments', id as string);
        return res.status(201).json({ ok: true, data: updated });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
    }
});

// POST /vendor/shipments/:id/cancel
auth.post('/vendor/shipments/:id/cancel', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const { data: shipment } = await supabase
            .from('shipments')
            .select('id, tracking_number, carrier_code, status')
            .eq('id', id)
            .eq('vendor_profile_id', vpId)
            .maybeSingle();

        if (!shipment) return res.status(404).json({ ok: false, error: 'Envio no encontrado.' });
        if (!shipment.tracking_number) return res.status(400).json({ ok: false, error: 'Sin guia para cancelar.' });
        if (['delivered', 'in_transit', 'out_for_delivery'].includes(shipment.status as string)) {
            return res.status(409).json({ ok: false, error: 'No se puede cancelar un envio en transito.' });
        }

        const provider = getShippingProvider();
        if (provider.cancelLabel) {
            try { await provider.cancelLabel(shipment.tracking_number, shipment.carrier_code ?? undefined); }
            catch (e) { req.log?.warn({ err: e }, 'cancelLabel fallo en provider — marcamos localmente'); }
        }

        await supabase
            .from('shipments')
            .update({ status: 'failed' })
            .eq('id', id);

        await auditLog(req, 'shipment_cancel', 'shipments', id as string);
        return res.json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
    }
});

// POST /vendor/shipments/:id/pickup
auth.post('/vendor/shipments/:id/pickup', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { pickup_date } = req.body as { pickup_date?: string };
        if (!pickup_date) return res.status(400).json({ ok: false, error: 'pickup_date requerido.' });

        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const provider = getShippingProvider();
        if (!provider.schedulePickup) {
            // Sin soporte de pickup en el provider — marcamos localmente
            await supabase.from('shipments').update({ pickup_at: pickup_date }).eq('id', id);
            return res.json({ ok: true, data: { pickup_id: null, scheduled_locally: true } });
        }

        const { data: shipment } = await supabase
            .from('shipments')
            .select('origin')
            .eq('id', id)
            .eq('vendor_profile_id', vpId)
            .maybeSingle();

        const pickup = await provider.schedulePickup({
            shipment_ids:   [id as string],
            pickup_date,
            pickup_address: (shipment?.origin as any) || {},
        });

        await supabase.from('shipments').update({ pickup_at: pickup.confirmed_at }).eq('id', id);
        return res.json({ ok: true, data: pickup });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
    }
});

// GET /vendor/shipments — listar envios del vendor
auth.get('/vendor/shipments', async (req: Request, res: Response) => {
    try {
        const vpId = await getVendorProfileId(req.user.id);
        if (!vpId) return res.status(403).json({ ok: false, error: 'No tienes vendor_profile.' });

        const { status } = req.query;
        let q = supabase
            .from('shipments')
            .select('id, order_id, carrier_code, tracking_number, status, shipping_cost, estimated_delivery, shipped_at, delivered_at, created_at')
            .eq('vendor_profile_id', vpId)
            .order('created_at', { ascending: false });

        if (status) q = q.eq('status', status as string);

        const { data, error } = await q;
        if (error) return res.status(500).json({ ok: false, error: 'Error obteniendo envios.' });
        return res.json({ ok: true, data: data || [] });
    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno.' });
    }
});

// El router `auth` exporta las rutas `/vendor/shipping/...` y `/vendor/shipments/...`.
// Se monta separado en `/api/v1` (no bajo `/api/v1/shipping`) para que los paths
// resuelvan correctamente.
export const vendorShippingRouter = auth;

// ─────────────────────────────────────────────────────────────────────────────
// Webhook: POST /webhooks/shipping/:provider
// Recibe eventos del aggregator/carrier y actualiza shipment.status + events
// ─────────────────────────────────────────────────────────────────────────────
export const shippingWebhookRouter = Router();

shippingWebhookRouter.post('/:provider', async (req: Request, res: Response) => {
    try {
        const provider = getShippingProvider();
        if (!provider.parseWebhook) {
            return res.status(501).json({ ok: false, error: 'Provider no soporta webhooks.' });
        }

        const parsed = provider.parseWebhook(req.body, req.headers as Record<string, string>);
        if (!parsed) {
            return res.status(400).json({ ok: false, error: 'Payload no reconocido.' });
        }

        const { error } = await supabase
            .from('shipments')
            .update({
                status:        parsed.status,
                events:        parsed.events,
                delivered_at:  parsed.delivered_at ?? null,
                raw_response:  parsed.raw_response ?? null,
            })
            .eq('tracking_number', parsed.tracking_number);

        if (error) {
            req.log?.warn({ err: error }, 'Error actualizando shipment desde webhook');
            return res.status(500).json({ ok: false, error: 'Error procesando webhook.' });
        }
        return res.json({ ok: true });
    } catch (err: any) {
        return res.status(500).json({ ok: false, error: err?.message || 'Error interno.' });
    }
});

export default router;
