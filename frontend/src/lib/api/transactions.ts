/**
 * Transaction API Service - Centralizes all post-payment logic
 * Axis 6: Enrollment & Order Consolidation
 */
import { supabase } from '@/integrations/supabase/client';
import { checkoutAPI, CheckoutPayload } from './checkout';
import type { QuoteOption } from '@/hooks/useShipping';

export interface ProductOrderPayload {
    productId: string;
    quantity: number;
    price: number;
    name: string;
    vendorId?: string;
    vendorProfileId?: string;
}

export interface ShippingInfo {
    address: {
        line1: string;
        line2?: string;
        city: string;
        department: string;
        postalCode?: string;
        country?: string;
    };
    contactPhone: string;
    contactEmail: string;
    customerName: string;
    quote: QuoteOption;
    quoteId: string | null;
}

export interface AppointmentPayload {
    professionalId: string;
    appointmentDate: string;
    appointmentTime: string;
    serviceType: string;
    name: string;
}

export interface TransactionResult {
    success: boolean;
    error?: string;
    details?: any;
}

class TransactionAPI {
    /**
     * Process all items in a purchase (Cart consolidation)
     */
    async processPurchase(params: {
        userId: string;
        email: string;
        items: any[];
        paymentMethod: string;
        reference: string;
        shipping?: ShippingInfo;
    }): Promise<TransactionResult> {
        try {
            const { userId, email, items, paymentMethod, reference, shipping } = params;
            const results: any[] = [];

            // Agrupamos productos en una sola order (el shipping va con esa order).
            // Si en el futuro hay multi-vendor real, se debe particionar aqui.
            const productItems = items.filter(i => i.type === 'product');

            for (const item of items) {
                if (item.type === 'enrollment') {
                    const res = await checkoutAPI.processEnrollment({
                        student_id: item.metadata.childId || userId,
                        parent_id: userId,
                        class_id: item.metadata.teamId ?? null,
                        offering_plan_id: item.metadata.offeringPlanId ?? null,
                        school_id: item.metadata.schoolId,
                        amount: item.price,
                        payment_method: paymentMethod,
                        is_child_enrollment: !!item.metadata.childId,
                    });
                    if (!res.success) throw new Error(res.error || `Error en inscripción: ${item.name}`);
                    results.push({ type: 'enrollment', id: res.enrollment_id });
                }

                if (item.type === 'appointment') {
                    const res = await this.createAppointment({
                        userId,
                        appointment: {
                            professionalId: item.metadata.professionalId,
                            appointmentDate: item.metadata.appointmentDate,
                            appointmentTime: item.metadata.appointmentTime || '10:00',
                            serviceType: item.metadata.serviceType || item.name,
                            name: item.name
                        }
                    });
                    results.push({ type: 'appointment', id: res.details?.appointmentId });
                }
            }

            // Una sola order que agrupa todos los productos
            if (productItems.length > 0) {
                const res = await this.createProductOrder({
                    userId,
                    email,
                    paymentMethod,
                    reference,
                    products: productItems.map(item => ({
                        productId: item.metadata.productId,
                        quantity: item.quantity,
                        price: item.price,
                        name: item.name,
                        vendorId: item.metadata.vendorId,
                        vendorProfileId: item.metadata.vendorProfileId,
                    })),
                    shipping,
                });
                results.push({ type: 'product', id: res.details?.orderId, shipmentId: res.details?.shipmentId });
            }

            // Final summary notification
            const itemSummary = items.map(i => `${i.name}`).join(', ');
            await supabase.rpc('notify_user', {
                p_user_id: userId,
                p_title: 'Compra Exitosa',
                p_message: `Pedido #${reference} confirmado: ${itemSummary}`,
                p_type: 'payment',
                p_link: '/my-payments',
            });

            return { success: true, details: results };
        } catch (error: any) {
            console.error('Transaction failed:', error);
            return { success: false, error: error.message };
        }
    }

    private async createProductOrder(params: {
        userId: string;
        email: string;
        paymentMethod: string;
        reference: string;
        products: ProductOrderPayload[];
        shipping?: ShippingInfo;
    }): Promise<TransactionResult> {
        const { userId, email, paymentMethod, reference, products, shipping } = params;

        const subtotal = products.reduce((acc, p) => acc + p.price * p.quantity, 0);
        const shippingCost = shipping?.quote?.cost ?? 0;
        const totalAmount = subtotal + shippingCost;

        // Vendor primario para esta orden (multi-vendor real requeriria split).
        const primaryVendorId = products.find(p => p.vendorId)?.vendorId || null;
        const primaryVendorProfileId = products.find(p => p.vendorProfileId)?.vendorProfileId || null;

        const shippingAddressJson = shipping
            ? {
                line1: shipping.address.line1,
                line2: shipping.address.line2 || null,
                city: shipping.address.city,
                department: shipping.address.department,
                postal_code: shipping.address.postalCode || null,
                country: shipping.address.country || 'CO',
            }
            : { pending: true };

        // Sin `: Record<string, unknown>`: esa anotacion anulaba la inferencia y
        // el insert dejaba de verificarse contra las columnas reales de `orders`.
        const orderInsert = {
            user_id: userId,
            vendor_id: primaryVendorId,
            total_amount: totalAmount,
            shipping_cost: shippingCost,
            tax_total: 0,
            status: 'pending',
            shipping_address: shippingAddressJson,
            contact_email: shipping?.contactEmail || email,
            contact_phone: shipping?.contactPhone || null,
            customer_name: shipping?.customerName || null,
            payment_method: paymentMethod,
            // `payment_provider` es un enum de la base con SOLO 'wompi' y
            // 'mercadopago'. Antes pasaba el valor crudo cuando no era 'wompi', y
            // CheckoutPage manda 'manual' cuando el pago no va por pasarela: el
            // insert de la orden fallaba por violacion de enum. La columna admite
            // NULL, que es justo lo que corresponde a un pago sin pasarela.
            payment_provider:
                paymentMethod === 'wompi' ? 'wompi' as const
                : paymentMethod === 'mercadopago' ? 'mercadopago' as const
                : null,
            provider_reference: reference,
            wompi_reference: paymentMethod === 'wompi' ? reference : null,
            carrier: shipping?.quote?.carrier_code || null,
            notes: shipping?.quoteId ? `quote_id=${shipping.quoteId}` : null,
        };

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert(orderInsert)
            .select()
            .single();

        if (orderError) throw orderError;

        const orderItems = products.map(p => ({
            order_id: order.id,
            product_id: p.productId,
            quantity: p.quantity,
            unit_price: p.price,
            subtotal: p.price * p.quantity,
            vendor_id: p.vendorId || null,
        }));

        const { error: itemError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemError) throw itemError;

        // Crear shipment (uno por orden, agrupa todos los productos).
        let shipmentId: string | null = null;
        if (shipping) {
            const { data: shipment, error: shipmentErr } = await supabase
                .from('shipments')
                .insert({
                    order_id: order.id,
                    vendor_profile_id: primaryVendorProfileId,
                    status: 'pending',
                    carrier: shipping.quote.carrier_code,
                    carrier_code: shipping.quote.carrier_code,
                    shipping_cost: shipping.quote.cost,
                    destination: shippingAddressJson,
                    estimated_delivery: this.estimateDeliveryDate(shipping.quote.days_max),
                })
                .select('id')
                .single();

            if (shipmentErr) {
                // No-blocking — la order ya esta creada y el vendor puede crear el shipment despues.
                console.warn('Shipment insert failed (non-blocking):', shipmentErr);
            } else {
                shipmentId = shipment?.id || null;
            }
        }

        // Notificar a cada vendor (puede haber varios)
        const vendorIdsNotified = new Set<string>();
        for (const p of products) {
            if (p.vendorId && !vendorIdsNotified.has(p.vendorId)) {
                vendorIdsNotified.add(p.vendorId);
                await supabase.rpc('notify_user', {
                    p_user_id: p.vendorId,
                    p_title: 'Nueva Venta',
                    p_message: `Vendiste ${p.quantity}x ${p.name}`,
                    p_type: 'sale',
                    p_link: '/orders',
                });
            }
        }

        return { success: true, details: { orderId: order.id, shipmentId } };
    }

    private estimateDeliveryDate(daysMax: number): string {
        const d = new Date();
        d.setDate(d.getDate() + daysMax);
        return d.toISOString().slice(0, 10);
    }

    private async createAppointment(params: {
        userId: string;
        appointment: AppointmentPayload;
    }): Promise<TransactionResult> {
        const { userId, appointment } = params;

        const { data: appt, error } = await supabase
            .from('wellness_appointments')
            .insert({
                professional_id: appointment.professionalId,
                athlete_id: userId,
                appointment_date: appointment.appointmentDate,
                appointment_time: appointment.appointmentTime,
                service_type: appointment.serviceType,
                status: 'confirmed',
            })
            .select()
            .single();

        if (error) throw error;

        await supabase.rpc('notify_user', {
            p_user_id: appointment.professionalId,
            p_title: 'Nueva Cita',
            p_message: `Nueva cita para ${appointment.name} el ${appointment.appointmentDate}`,
            p_type: 'appointment',
            p_link: '/wellness/schedule',
        });

        return { success: true, details: { appointmentId: appt.id } };
    }
}

export const transactionsAPI = new TransactionAPI();
