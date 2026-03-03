import { supabase } from '@/integrations/supabase/client';

// ─── Tipos de Correo Soportados ───
export type EmailType =
    | 'payment_confirmation'
    | 'enrollment_confirmation'
    | 'welcome_school'
    | 'parent_invitation'
    | 'payment_reminder';

interface SendEmailParams {
    type: EmailType;
    to: string;
    data: Record<string, string>;
}

export const emailClient = {
    /**
     * Envía un correo tipado usando la Edge Function unificada 'send-email'.
     * La función selecciona la plantilla HTML según el tipo.
     * NO simula ni mockea — si falla, falla de verdad.
     */
    send: async (params: SendEmailParams) => {
        console.log('📤 Enviando correo:', params.type, '→', params.to);

        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                type: params.type,
                to: params.to,
                data: params.data,
            },
        });

        if (error) {
            console.error('❌ Edge Function "send-email" falló:', error.message);
            throw new Error(`Error enviando correo: ${error.message}`);
        }

        console.log('✅ Correo enviado exitosamente:', data?.id);
        return { success: true, data };
    },
};
