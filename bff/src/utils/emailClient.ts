import { supabase } from '../config/supabase';

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
            console.log('📤 Intentando enviar correo masivo a:', params.to);

            // Llamar a la función 'send-email' de Supabase (igual que el frontend)
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: params,
            });

            if (error) {
                console.warn('⚠️ Edge Function "send-email" falló en BFF. Simulando envío local para desarrollo.');
                console.log('📧 [MOCK EMAIL DETAILS]', {
                    To: params.to,
                    Subject: params.subject,
                    BodyPreview: params.html.substring(0, 100) + '...'
                });
                return { success: true, simulated: true };
            }

            console.log(`✅ Correo enviado exitosamente vía Edge Function (${params.to})`);
            return { success: true, data };

        } catch (err) {
            console.error('❌ Error crítico enviando correo:', err);
            return { success: false, error: err };
        }
    }
};
