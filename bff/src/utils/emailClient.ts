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
                console.error('❌ Edge Function "send-email" falló:', error);
                
                // Si estamos en desarrollo, podemos simular el envío; de lo contrario, reportamos el error
                const isDev = process.env.NODE_ENV === 'development' || process.env.SIMULATE_EMAILS === 'true';
                
                if (isDev) {
                    console.warn('⚠️ Simulando envío local para desarrollo.');
                    return { success: true, simulated: true };
                }

                return { success: false, error };
            }

            console.log(`✅ Correo enviado exitosamente vía Edge Function (${params.to})`);
            return { success: true, data };

        } catch (err) {
            console.error('❌ Error crítico enviando correo:', err);
            return { success: false, error: err };
        }
    }
};
