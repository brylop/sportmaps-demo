/**
 * whatsapp-bot.service — Orquestador del bot de WhatsApp (WA2).
 *
 * Flujo por cada mensaje entrante ya guardado (llamado desde el webhook):
 *
 *  1. IDENTIFICACIÓN (determinista, sin LLM — más seguro, decisión #4 / R17):
 *     - Si la conversación NO está identificada:
 *         · el mensaje parece email  → arranca OTP (envía código al correo)
 *         · el mensaje parece código  → verifica OTP → vincula parent_id
 *         · si no                    → pide el email registrado
 *     - Sin identificar, el bot NO consulta datos sensibles.
 *
 *  2. INTENTS (con Gemini + tool-calling), solo si está identificada:
 *     - get_payment_status → wa_get_payment_status (pagos de ESTA escuela)
 *     - escalate_to_human  → marca la conversación para atención humana
 *     - El LLM decide la tool; el BFF la ejecuta; el LLM redacta con el resultado.
 *
 *  3. ENTREGA según modo (whatsapp_settings.mode):
 *     - assisted → crea draft (NO envía; el admin aprueba)
 *     - auto     → envía por Graph API + registra outbound
 *
 * Cero respuestas sin tool exitoso (decisión #6): si una tool falla, el bot
 * responde neutro y escala; jamás inventa datos de menores.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { chatWithTools, type LlmTool, type LlmMessage } from './llm.service';
import { sendTextMessage, type WhatsAppIntegration } from './whatsapp.service';

const OTP_TTL_MIN = 10;

// ─── Entrada principal ────────────────────────────────────────────────────────

export async function runBotTurn(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    inboundText: string | null,
): Promise<void> {
    const text = (inboundText || '').trim();

    // Cargar estado de la conversación.
    const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('id, parent_id, identified')
        .eq('id', conversationId)
        .maybeSingle();

    if (!conv) return;

    // 1. No identificado → flujo OTP determinista.
    if (!conv.identified) {
        await handleIdentification(integration, conversationId, contactWaId, text);
        return;
    }

    // 2. Identificado → intents con LLM.
    await handleIntent(integration, conversationId, contactWaId, conv.parent_id, text);
}

// ─── 1. Identificación (OTP por email) ────────────────────────────────────────

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CODE_RE = /\b(\d{6})\b/;

async function handleIdentification(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    text: string,
): Promise<void> {
    const emailMatch = text.match(EMAIL_RE);
    const codeMatch = text.match(CODE_RE);

    // (a) Mandó un código de 6 dígitos → verificar.
    if (codeMatch) {
        const otpHash = hashOtp(codeMatch[1]);
        const { data: res } = await supabase.rpc('wa_verify_otp', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
            p_otp_hash: otpHash,
        });
        const r = res as any;
        if (r?.ok) {
            await deliver(integration, conversationId, contactWaId,
                '✅ ¡Listo! Tu identidad quedó verificada. ¿En qué te ayudo? Puedo contarte el estado de tus pagos.',
                { step: 'otp_verified' });
        } else {
            const reason = r?.reason;
            const msg = reason === 'expired'
                ? 'Ese código expiró. Escríbeme de nuevo tu email registrado y te envío uno nuevo.'
                : reason === 'too_many_attempts'
                ? 'Demasiados intentos. Escríbeme tu email registrado para reiniciar la verificación.'
                : reason === 'wrong_code'
                ? `Ese código no coincide. Te quedan ${r?.attempts_left ?? 0} intentos.`
                : 'No tengo una verificación pendiente. Escríbeme tu email registrado para empezar.';
            await deliver(integration, conversationId, contactWaId, msg, { step: 'otp_failed', reason });
        }
        return;
    }

    // (b) Mandó un email → arrancar OTP.
    if (emailMatch) {
        const email = emailMatch[0].toLowerCase();
        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
        const otpHash = hashOtp(code);
        const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

        const { data: res } = await supabase.rpc('wa_start_identification', {
            p_integration_id: integration.id,
            p_contact_wa_id: contactWaId,
            p_email: email,
            p_otp_hash: otpHash,
            p_expires_at: expiresAt,
        });

        // Solo enviamos el correo si el email corresponde a un usuario real,
        // pero respondemos IGUAL en ambos casos (no permitir enumeración).
        if ((res as any)?.email_matches_parent) {
            await emailClient.send({
                to: email,
                subject: 'Tu código de verificación de SportMaps',
                html: `<p>Tu código de verificación es:</p>
                       <h2 style="letter-spacing:3px">${code}</h2>
                       <p>Vence en ${OTP_TTL_MIN} minutos. Si no lo solicitaste, ignora este correo.</p>`,
                text: `Tu código de verificación de SportMaps es ${code} (vence en ${OTP_TTL_MIN} min).`,
            });
        }

        await deliver(integration, conversationId, contactWaId,
            `Te envié un código de 6 dígitos al correo *${maskEmail(email)}*. Escríbemelo aquí para verificar tu identidad. 🔒`,
            { step: 'otp_sent' });
        return;
    }

    // (c) Ni email ni código → pedir el email.
    await deliver(integration, conversationId, contactWaId,
        'Hola 👋 Para ayudarte con información de tu atleta necesito verificar tu identidad. ' +
        'Escríbeme el *correo electrónico* con el que estás registrado en la escuela.',
        { step: 'ask_email' });
}

// ─── 2. Intents (LLM + tools) ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente de una escuela deportiva en WhatsApp, hablando con el padre/acudiente (ya verificado).
Reglas estrictas:
- Responde SIEMPRE en español, cordial y breve (es WhatsApp).
- NUNCA inventes datos. Si necesitas información de pagos, USA la herramienta get_payment_status.
- Si no puedes ayudar o piden algo fuera de tu alcance, usa escalate_to_human.
- No pidas datos personales ni el email otra vez (ya está identificado).
- Formatea montos en pesos colombianos y fechas en formato legible.`;

const TOOLS: LlmTool[] = [
    {
        name: 'get_payment_status',
        description: 'Devuelve los pagos pendientes o vencidos del acudiente en esta escuela. Úsala cuando pregunte por pagos, mensualidades, saldos o vencimientos.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'escalate_to_human',
        description: 'Escala la conversación a un humano de la escuela. Úsala cuando no puedas resolver o el padre lo pida.',
        parameters: {
            type: 'object',
            properties: { reason: { type: 'string', description: 'Motivo breve de la escalación' } },
            required: [],
        },
    },
];

async function handleIntent(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    parentId: string | null,
    text: string,
): Promise<void> {
    if (!text) return;

    const messages: LlmMessage[] = [{ role: 'user', content: text }];

    let first;
    try {
        first = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
    } catch (err: any) {
        console.error('[whatsapp-bot] LLM error:', err?.message);
        await escalate(integration, conversationId, contactWaId, 'llm_error');
        return;
    }

    // Sin tool → responder texto directo (saludos, agradecimientos).
    if (!first.toolCalls?.length) {
        await deliver(integration, conversationId, contactWaId,
            first.text || 'Puedo ayudarte con el estado de tus pagos. ¿Qué necesitas?',
            { step: 'llm_text', provider: first.provider });
        return;
    }

    const call = first.toolCalls[0];

    if (call.name === 'escalate_to_human') {
        await escalate(integration, conversationId, contactWaId, String((call.args as any)?.reason || 'user_request'));
        return;
    }

    if (call.name === 'get_payment_status') {
        const { data: payments, error } = await supabase.rpc('wa_get_payment_status', {
            p_parent_id: parentId,
            p_school_id: integration.school_id,
        });

        // Tool falló → NO inventar. Escalar.
        if (error) {
            console.error('[whatsapp-bot] wa_get_payment_status error:', error);
            await escalate(integration, conversationId, contactWaId, 'tool_error');
            return;
        }

        // Redacción final con el resultado de la tool.
        messages.push({ role: 'assistant', content: `Llamando get_payment_status` });
        messages.push({ role: 'tool', toolName: 'get_payment_status', content: JSON.stringify(payments) });

        let final;
        try {
            final = await chatWithTools({ system: SYSTEM_PROMPT, messages, tools: TOOLS });
        } catch {
            // Si la 2a llamada falla, redactar un fallback determinista con los datos.
            await deliver(integration, conversationId, contactWaId,
                fallbackPaymentText(payments), { step: 'payment_fallback' });
            return;
        }

        await deliver(integration, conversationId, contactWaId,
            final.text || fallbackPaymentText(payments),
            { step: 'get_payment_status', provider: final.provider, tool_result: payments });
        return;
    }

    // Tool desconocida → escalar.
    await escalate(integration, conversationId, contactWaId, 'unknown_tool');
}

// ─── Entrega: modo asistido (draft) vs auto (envío) ────────────────────────────

async function deliver(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    proposedText: string,
    context: Record<string, unknown>,
): Promise<void> {
    // ¿Modo auto vigente? (auto solo si mode='auto' y ya pasó assisted_until)
    const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('mode, assisted_until, ai_enabled')
        .eq('integration_id', integration.id)
        .maybeSingle();

    const s = settings as any;
    const now = Date.now();
    const autoAllowed =
        s?.ai_enabled !== false &&
        s?.mode === 'auto' &&
        (!s?.assisted_until || new Date(s.assisted_until).getTime() < now);

    if (autoAllowed) {
        const sent = await sendTextMessage(integration, contactWaId, proposedText);
        await supabase.rpc('wa_record_outbound_message', {
            p_conversation_id: conversationId,
            p_integration_id: integration.id,
            p_wa_message_id: sent.waMessageId || `local-${crypto.randomUUID()}`,
            p_type: 'text',
            p_text_body: proposedText,
            p_payload: context,
            p_ai_generated: true,
            p_to_wa_id: contactWaId,
        });
        return;
    }

    // Modo asistido → draft para aprobación (NO se envía).
    await supabase.from('whatsapp_message_drafts').insert({
        conversation_id: conversationId,
        integration_id: integration.id,
        proposed_text: proposedText,
        tool_context: context,
        llm_provider: (context as any)?.provider ?? null,
        status: 'pending',
    });
}

async function escalate(
    integration: WhatsAppIntegration,
    conversationId: string,
    contactWaId: string,
    reason: string,
): Promise<void> {
    await supabase.from('whatsapp_conversations')
        .update({ status: 'open', assigned_to: null, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    await deliver(integration, conversationId, contactWaId,
        'Voy a pasar tu caso con una persona del equipo de la escuela para ayudarte mejor. En breve te contactan. 🙌',
        { step: 'escalated', reason });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashOtp(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
}

function maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const shown = user.slice(0, 2);
    return `${shown}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function fallbackPaymentText(payments: any): string {
    const list = Array.isArray(payments) ? payments : [];
    if (!list.length) return 'No tienes pagos pendientes en este momento. ¡Estás al día! ✅';
    const lines = list.slice(0, 5).map((p: any) => {
        const monto = Number(p.saldo || 0).toLocaleString('es-CO');
        const venc = p.vencido ? ' (vencida)' : '';
        return `• ${p.concept}: $${monto} — vence ${p.due_date}${venc}`;
    });
    return `Estos son tus pagos pendientes:\n${lines.join('\n')}`;
}
