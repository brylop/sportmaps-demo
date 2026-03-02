/**
 * Transaction API Service - Centralizes all post-payment logic
 * Axis 6: Enrollment & Order Consolidation
 */
import { supabase } from '@/integrations/supabase/client';
import { checkoutAPI, CheckoutPayload } from './checkout';

export interface ProductOrderPayload {
    productId: string;
    quantity: number;
    price: number;
    name: string;
    vendorId?: string;
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
    }): Promise<TransactionResult> {
        try {
            const { userId, email, items, paymentMethod, reference } = params;
            const results: any[] = [];

            for (const item of items) {
                if (item.type === 'enrollment') {
                    const res = await checkoutAPI.processEnrollment({
                        student_id: item.metadata.childId || userId,
                        parent_id: userId,
                        class_id: item.metadata.programId,
                        school_id: item.metadata.schoolId,
                        amount: item.price,
                        payment_method: paymentMethod,
                        is_child_enrollment: !!item.metadata.childId,
                    });
                    if (!res.success) throw new Error(res.error || `Error en inscripción: ${item.name}`);
                    results.push({ type: 'enrollment', id: res.enrollment_id });
                }

                if (item.type === 'product') {
                    const res = await this.createProductOrder({
                        userId,
                        email,
                        paymentMethod,
                        product: {
                            productId: item.metadata.productId,
                            quantity: item.quantity,
                            price: item.price,
                            name: item.name,
                            vendorId: item.metadata.vendorId
                        }
                    });
                    results.push({ type: 'product', id: res.details?.orderId });
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

    private async createProductOrder(params: {
        userId: string;
        email: string;
        paymentMethod: string;
        product: ProductOrderPayload;
    }): Promise<TransactionResult> {
        const { userId, email, paymentMethod, product } = params;

        // Note: To ensure atomicity (all or nothing), this should move to a PostgreSQL RPC.
        // For now, we do sequential inserts. If itemError fails, order remains 'pending' (orphan).
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                user_id: userId,
                total_amount: product.price * product.quantity,
                status: 'pending',
                shipping_address: { pending: true },
                contact_email: email,
                payment_method: paymentMethod,
            })
            .select()
            .single();

        if (orderError) throw orderError;

        const { error: itemError } = await supabase
            .from('order_items')
            .insert({
                order_id: order.id,
                product_id: product.productId,
                quantity: product.quantity,
                unit_price: product.price,
            });

        if (itemError) throw itemError;

        if (product.vendorId) {
            await supabase.rpc('notify_user', {
                p_user_id: product.vendorId,
                p_title: 'Nueva Venta',
                p_message: `Vendiste ${product.quantity}x ${product.name}`,
                p_type: 'sale',
                p_link: '/orders',
            });
        }

        return { success: true, details: { orderId: order.id } };
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
