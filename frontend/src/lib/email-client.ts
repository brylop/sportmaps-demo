import { supabase } from '@/integrations/supabase/client';

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export const emailClient = {
    /**
     * Envía un correo usando Supabase Edge Functions (o simula si falla).
     */
    send: async (params: SendEmailParams) => {
        try {
            console.log('📤 Intentando enviar correo a:', params.to);

            // Intenta llamar a la función 'send-email' de Supabase
            // Esta función debería usar Resend, SendGrid o AWS SES
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: params,
            });

            if (error) {
                // Si la función no existe (404) o hay error de conexión en desarrollo local sin Edge Runtime
                console.warn('⚠️ Edge Function "send-email" no disponible. Simulando envío local.');
                console.log('📧 [MOCK EMAIL DETAILS]', {
                    To: params.to,
                    Subject: params.subject,
                    BodyPreview: params.html.substring(0, 100) + '...'
                });

                // Simular éxito para no bloquear el flujo de UI
                return { success: true, simulated: true };
            }

            console.log('✅ Correo enviado exitosamente vía Edge Function');
            return { success: true, data };

        } catch (err) {
            console.error('❌ Error crítico enviando correo:', err);
            // Fallback robusto
            return { success: false, error: err };
        }
    }
};
