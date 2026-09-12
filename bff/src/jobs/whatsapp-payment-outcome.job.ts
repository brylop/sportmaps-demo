/**
 * whatsapp-payment-outcome.job — devolver el desenlace al chat donde entró.
 *
 * El bot le prometió al acudiente «la escuela lo está revisando y te confirma en
 * poco tiempo». Cuando la escuela aprueba, hoy sale un correo y una notificación
 * in-app; **por WhatsApp no salía nada**. El papá se quedaba esperando en el
 * canal donde había empezado la conversación.
 *
 * Medido el 2026-09-11: el pago se aprobó a las 18:33:58 y a las 18:36 el
 * acudiente seguía preguntando «¿aún no ha sido aprobado?». El sistema sabía y
 * no lo contaba por donde él estaba mirando.
 *
 * Va como job y no enganchado al botón de aprobar porque hay MÁS DE UN camino de
 * aprobación en la app (uno estampa `reconciliation_status`, el otro no, y las
 * notificaciones que emiten tienen títulos distintos). Enganchar uno dejaría el
 * otro mudo. Acá se observa el RESULTADO, que es lo único común a todos.
 *
 * La fila de la cola es el registro de «este pago entró por WhatsApp»: enlaza el
 * comprobante con el pago y con el teléfono. `outcome_notified_at` evita repetir.
 */

import { supabase } from '../config/supabase';
import { sendTextMessage, aFormatoWhatsApp, type WhatsAppIntegration } from '../services/whatsapp.service';
import { estaDadoDeBaja, AVISO_DADO_DE_BAJA } from '../services/whatsapp-optin.service';
import type { Logger } from 'pino';

const LOTE = 25;

const cop = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/** Estados que son un DESENLACE: hay algo que contarle al acudiente. */
const RESUELTOS = ['paid', 'rejected', 'glosado'];

export async function runWhatsAppPaymentOutcome(log?: Logger): Promise<{ avisados: number }> {
    // Comprobantes que entraron por WhatsApp, se aplicaron a un pago, y ese pago
    // ya se resolvió sin que nadie se lo haya contado al acudiente.
    const { data: filas, error } = await supabase
        .from('whatsapp_inbound_queue')
        .select('id, integration_id, school_id, wa_phone_number, result_ref_id')
        .eq('result_type', 'payment_receipt')
        .is('outcome_notified_at', null)
        .not('result_ref_id', 'is', null)
        .limit(LOTE);

    if (error) {
        log?.error?.({ err: error.message }, '[wa-outcome] no se pudo listar');
        return { avisados: 0 };
    }
    if (!filas || filas.length === 0) return { avisados: 0 };

    let avisados = 0;

    for (const fila of filas) {
        const { data: pago } = await supabase
            .from('payments')
            .select('id, status, amount, concept, rejection_reason')
            .eq('id', fila.result_ref_id as string)
            .maybeSingle();

        // Todavía en revisión: no hay nada que contar. Se vuelve a mirar en la
        // siguiente vuelta.
        if (!pago || !RESUELTOS.includes(pago.status as string)) continue;

        const { data: integration } = await supabase
            .from('school_whatsapp_integrations')
            .select('*')
            .eq('id', fila.integration_id as string)
            .maybeSingle();

        if (!integration) {
            // Sin integración no hay por dónde avisar. Se marca para no volver a
            // intentarlo en cada vuelta, para siempre.
            await supabase.from('whatsapp_inbound_queue')
                .update({ outcome_notified_at: new Date().toISOString() })
                .eq('id', fila.id);
            continue;
        }

        const monto = cop(Number(pago.amount));
        let texto: string;
        if (pago.status === 'paid') {
            texto = `¡Listo! ✅ La escuela confirmó tu pago de *${monto}* por *${pago.concept}*. Queda al día.`;
        } else if (pago.status === 'rejected') {
            // El motivo importa: un rechazo sin explicación deja al acudiente sin
            // saber qué corregir, que es justo el caso que originó todo esto.
            const motivo = pago.rejection_reason
                ? `\n\n${pago.rejection_reason}`
                : '';
            texto =
                `La escuela revisó tu comprobante de *${monto}* por *${pago.concept}* y no lo pudo validar.${motivo}` +
                '\n\nSi tienes el comprobante correcto, mándalo por acá y lo valido enseguida.';
        } else {
            texto =
                `La escuela necesita una aclaración sobre tu pago de *${monto}* por *${pago.concept}*. ` +
                'Te van a escribir para resolverlo.';
        }

        const dadoDeBaja = await estaDadoDeBaja(fila.integration_id as string, fila.wa_phone_number as string);
        const final = aFormatoWhatsApp(dadoDeBaja ? texto + AVISO_DADO_DE_BAJA : texto);

        const enviado = await sendTextMessage(
            integration as WhatsAppIntegration, fila.wa_phone_number as string, final,
        );

        // Solo se marca si SALIÓ. Si Graph falló, la siguiente vuelta reintenta:
        // perder el aviso de que su plata quedó confirmada es peor que repetirlo.
        if (!enviado.ok) {
            log?.warn?.({ queueId: fila.id, err: enviado.error }, '[wa-outcome] no salió, se reintenta');
            continue;
        }

        const { data: conv } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('integration_id', fila.integration_id as string)
            .eq('contact_wa_id', fila.wa_phone_number as string)
            .maybeSingle();

        if (conv?.id) {
            await supabase.rpc('wa_record_outbound_message', {
                p_conversation_id: conv.id,
                p_integration_id: fila.integration_id,
                p_wa_message_id: enviado.waMessageId || `local-${crypto.randomUUID()}`,
                p_type: 'text',
                p_text_body: final,
                p_payload: { step: `resultado_${pago.status}`, queue_id: fila.id, payment_id: pago.id },
                p_ai_generated: true,
                p_to_wa_id: fila.wa_phone_number,
            });
        }

        await supabase.from('whatsapp_inbound_queue')
            .update({ outcome_notified_at: new Date().toISOString() })
            .eq('id', fila.id);

        avisados++;
        log?.info?.({ queueId: fila.id, paymentId: pago.id, estado: pago.status }, '[wa-outcome] avisado');
    }

    return { avisados };
}
