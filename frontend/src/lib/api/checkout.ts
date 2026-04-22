
// Checkout API Service
// Phase: Adapter for V4 Migration
import { supabase } from '@/integrations/supabase/client';
import { emailClient } from '@/lib/email-client';

export interface CheckoutPayload {
    student_id: string; // The ID of the person being enrolled (child or user)
    class_id: string | null;                // legacy team/program id
    offering_plan_id?: string | null;       // v2.1: plan id de offering_plans
    school_id: string;
    parent_id: string;
    amount: number;
    payment_method: string;
    is_child_enrollment?: boolean; // New flag to distinguish
}

export interface CheckoutResult {
    success: boolean;
    order_id?: string;
    enrollment_id?: string;
    error?: string;
}

class CheckoutAPI {

    /**
     * Process a full enrollment checkout
     * V4 Goal: This will call the NestJS /checkout endpoint
     */
    async processEnrollment(payload: CheckoutPayload): Promise<CheckoutResult> {
        try {
            // 1. Validate Target
            if (!payload.school_id) {
                throw new Error('School ID is required for checkout');
            }

            // 2. Execute Atomic Transaction via RPC
            const { data, error: rpcError } = await supabase.rpc(
                'process_enrollment_checkout',
                {
                    p_student_id: payload.student_id,
                    p_class_id: payload.class_id ?? null,
                    p_school_id: payload.school_id,
                    p_parent_id: payload.parent_id,
                    p_amount: payload.amount,
                    p_payment_method: payload.payment_method,
                    p_is_child_enrollment: !!payload.is_child_enrollment,
                    p_offering_plan_id: payload.offering_plan_id ?? null,
                } as any
            );
            const result = data as any;

            if (rpcError) {
                console.error('RPC Error details:', rpcError);
                throw rpcError;
            }

            if (!result || !result.success) {
                throw new Error('Transaction failed without throwing SQL error');
            }

            // 3. Send In-App Notification
            await supabase.rpc('notify_user', {
                p_user_id: payload.parent_id,
                p_title: 'Inscripción Exitosa',
                p_message: 'El pago ha sido procesado y la inscripción está activa.',
                p_type: 'payment_success'
            });

            // 4. Send Transactional Emails (non-blocking)
            try {
                const { data: parentProfile } = await supabase
                    .from('profiles')
                    .select('email, full_name')
                    .eq('id', payload.parent_id)
                    .maybeSingle();

                const { data: school } = await supabase
                    .from('schools')
                    .select('name')
                    .eq('id', payload.school_id)
                    .maybeSingle();

                let program: { name: string } | null = null;
                if (payload.offering_plan_id) {
                    // v2.1: obtiene nombre desde offering (via plan)
                    const { data } = await supabase
                        .from('offering_plans')
                        .select('name, offerings(name)')
                        .eq('id', payload.offering_plan_id)
                        .maybeSingle();
                    const off = (data as any)?.offerings;
                    const offName = Array.isArray(off) ? off[0]?.name : off?.name;
                    if (offName) program = { name: offName };
                } else if (payload.class_id) {
                    const { data } = await supabase
                        .from('teams')
                        .select('name')
                        .eq('id', payload.class_id)
                        .maybeSingle();
                    if (data) program = data as { name: string };
                }

                if (parentProfile?.email) {
                    // Payment confirmation email
                    await emailClient.send({
                        type: 'payment_confirmation',
                        to: parentProfile.email,
                        data: {
                            userName: parentProfile.full_name || 'Usuario',
                            schoolName: school?.name || 'Tu Escuela',
                            amount: `$${payload.amount.toLocaleString('es-CO')}`,
                            concept: `Inscripción ${program?.name || 'Programa'}`,
                            reference: (result.enrollment_id || '').slice(0, 8).toUpperCase(),
                        },
                    });

                    // Enrollment confirmation email
                    await emailClient.send({
                        type: 'enrollment_confirmation',
                        to: parentProfile.email,
                        data: {
                            userName: parentProfile.full_name || 'Usuario',
                            teamName: program?.name || 'Programa',
                            schoolName: school?.name || 'Tu Escuela',
                        },
                    });
                }
            } catch (emailErr) {
                console.warn('Email sending failed (non-blocking):', emailErr);
            }

            return { success: true, enrollment_id: result.enrollment_id };

        } catch (error: any) {
            console.error('Checkout failed:', error);
            return {
                success: false,
                error: error.message || 'Error procesando el pago e inscripción'
            };
        }
    }
}

export const checkoutAPI = new CheckoutAPI();
