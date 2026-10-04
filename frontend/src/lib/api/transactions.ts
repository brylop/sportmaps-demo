/**
 * Transaction API Service - Centralizes all post-payment logic
 * Axis 6: Enrollment & Order Consolidation
 */
import { supabase } from '@/integrations/supabase/client';
import { checkoutAPI, CheckoutPayload } from './checkout';
import type { QuoteOption } from '@/hooks/useShipping';
import { PRODUCT_PURCHASE_UNAVAILABLE } from '@/lib/store/storeErrors';

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
            const { userId, items, paymentMethod, reference } = params;
            const results: any[] = [];

            // Tienda v2 F0 (M-F0-3, T15): `authenticated` ya no puede insertar
            // `orders`/`order_items`/`shipments`, así que la compra de productos
            // por este camino quedó rota por diseño. Se corta ANTES de procesar
            // inscripciones o citas del mismo carrito para no dejar la compra a
            // medias. Los productos se compran por el checkout del BFF
            // (CartCheckoutModal → useWompiCheckout.startCartCheckout).
            if (items.some(i => i.type === 'product')) {
                return { success: false, error: PRODUCT_PURCHASE_UNAVAILABLE };
            }

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
