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

// ─── Legacy interface (backward compat) ───
interface SendRawEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export const emailClient = {
    /**
     * Envía un correo tipado usando la Edge Function unificada 'send-email'.
     * La función selecciona la plantilla HTML según el tipo.
     */
    send: async (params: SendEmailParams) => {
        try {
            console.log('📤 Enviando correo:', params.type, '→', params.to);

            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    type: params.type,
                    to: params.to,
                    data: params.data,
                },
            });

            if (error) {
                console.warn('⚠️ Edge Function "send-email" falló:', error.message);
                console.log('📧 [MOCK EMAIL]', {
                    Type: params.type,
                    To: params.to,
                    Data: params.data,
                });
                return { success: true, simulated: true };
            }

            if (data?.simulated) {
                console.warn('⚠️ Correo simulado (RESEND_API_KEY no configurada)');
                return { success: true, simulated: true };
            }

            console.log('✅ Correo enviado exitosamente:', data?.id);
            return { success: true, data };
        } catch (err) {
            console.error('❌ Error crítico enviando correo:', err);
            return { success: false, error: err };
        }
    },

    /**
     * Legacy: Envía un correo con HTML crudo (para compatibilidad).
     * @deprecated Use send() con tipos en su lugar.
     */
    sendRaw: async (params: SendRawEmailParams) => {
        try {
            console.log('📤 Intentando enviar correo (raw) a:', params.to);

            const { data, error } = await supabase.functions.invoke('send-email', {
                body: params,
            });

            if (error) {
                console.warn('⚠️ Edge Function "send-email" no disponible. Simulando envío local.');
                console.log('📧 [MOCK EMAIL DETAILS]', {
                    To: params.to,
                    Subject: params.subject,
                    BodyPreview: params.html.substring(0, 100) + '...',
                });
                return { success: true, simulated: true };
            }

            console.log('✅ Correo enviado exitosamente vía Edge Function');
            return { success: true, data };
        } catch (err) {
            console.error('❌ Error crítico enviando correo:', err);
            return { success: false, error: err };
        }
    },
};
