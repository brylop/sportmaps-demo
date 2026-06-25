/**
 * whatsapp — Webhook único multi-tenant de la WhatsApp Cloud API (Bloque 6).
 *
 * Endpoints:
 *   GET  /api/v1/webhooks/whatsapp  → verificación del webhook (challenge de Meta)
 *   POST /api/v1/webhooks/whatsapp  → recepción de mensajes/estados de TODAS las escuelas
 *
 * Seguridad (decisión de arquitectura #2):
 *  - GET: valida hub.verify_token contra WHATSAPP_VERIFY_TOKEN.
 *  - POST: valida HMAC-SHA256 (X-Hub-Signature-256) sobre el RAW body con
 *    WHATSAPP_APP_SECRET. Rechaza requests no firmados (401).
 *  - Routing multi-tenant por phone_number_id -> integración -> school_id.
 *  - Idempotencia por wa_message_id (UNIQUE en BD).
 *  - Bloqueo por número (kill-switch, riesgo R14) antes de procesar.
 *
 * IMPORTANTE: este router necesita el RAW body para el HMAC. En index.ts,
 * express.json se monta con un `verify` que guarda req.rawBody (Buffer).
 *
 * La respuesta al webhook SIEMPRE es rápida (200) — el procesamiento del bot
 * (DeepSeek, intents, OTP) se hace fuera del ciclo de respuesta. En WA2 esto
 * se encola con pg-boss; aquí dejamos el punto de entrada (handleInbound).
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
    verifyWebhookSignature,
    resolveIntegration,
    parseInboundMessages,
    markAsRead,
    type WhatsAppIntegration,
    type ParsedInboundMessage,
} from '../services/whatsapp.service';

const router = Router();

// ─── GET: verificación del webhook (Meta challenge) ──────────────────────────
router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expected = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && expected && token === expected) {
        req.log?.info('WhatsApp webhook verified');
        // Meta espera el challenge crudo, status 200.
        return res.status(200).send(String(challenge ?? ''));
    }
    req.log?.warn({ mode }, 'WhatsApp webhook verification failed');
    return res.sendStatus(403);
});

// ─── POST: recepción de eventos ──────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
    // 1. Validar firma HMAC sobre el RAW body.
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const signature = req.header('x-hub-signature-256');

    if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
        req.log?.warn('WhatsApp webhook: invalid or missing signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const body = req.body;

    // 2. Responder 200 de inmediato (Meta reintenta si tardamos / fallamos).
    //    El procesamiento sigue async tras enviar la respuesta.
    res.status(200).json({ received: true });

    // 3. Procesar fuera del ciclo de respuesta.
    try {
        const messages = parseInboundMessages(body);
        for (const msg of messages) {
            await processInboundMessage(req, msg).catch((err) => {
                req.log?.error({ err: err?.message || err, waMessageId: msg.waMessageId }, 'WhatsApp message processing failed');
            });
        }
        // Aquí también se procesarían los `statuses` (delivered/read/failed) en WA4.
    } catch (err: any) {
        req.log?.error({ err: err?.message || err }, 'WhatsApp webhook processing error');
    }
});

// ─── Procesamiento de un mensaje entrante ────────────────────────────────────
async function processInboundMessage(req: Request, msg: ParsedInboundMessage): Promise<void> {
    if (!msg.phoneNumberId || !msg.contactWaId || !msg.waMessageId) {
        req.log?.warn({ msg }, 'WhatsApp: inbound message missing required fields');
        return;
    }

    // 1. Routing multi-tenant: phone_number_id -> integración activa.
    const integration = await resolveIntegration(msg.phoneNumberId);
    if (!integration) {
        req.log?.warn({ phoneNumberId: msg.phoneNumberId }, 'WhatsApp: no active integration for phone_number_id');
        return;
    }

    // 2. Kill-switch: número bloqueado (global o por integración) → ignorar.
    const { data: blocked } = await supabase.rpc('wa_is_blocked', {
        p_integration_id: integration.id,
        p_contact_wa_id: msg.contactWaId,
    });
    if (blocked === true) {
        req.log?.info({ contactWaId: msg.contactWaId }, 'WhatsApp: blocked number, ignoring');
        return;
    }

    // 3. Ingesta idempotente (upsert conversación + insert mensaje).
    const { data: ingest, error: ingestErr } = await supabase.rpc('wa_ingest_inbound_message', {
        p_integration_id: integration.id,
        p_school_id: integration.school_id,
        p_contact_wa_id: msg.contactWaId,
        p_contact_name: msg.contactName,
        p_wa_message_id: msg.waMessageId,
        p_type: msg.type,
        p_text_body: msg.textBody,
        p_payload: msg.raw,
        p_wa_timestamp: msg.waTimestamp,
    });

    if (ingestErr) {
        req.log?.error({ err: ingestErr, waMessageId: msg.waMessageId }, 'WhatsApp: ingest RPC failed');
        return;
    }

    // Reintento de Meta sobre un mensaje ya procesado → no re-disparar el bot.
    if ((ingest as any)?.duplicate === true) {
        req.log?.info({ waMessageId: msg.waMessageId }, 'WhatsApp: duplicate message, skipping');
        return;
    }

    const conversationId = (ingest as any)?.conversation_id as string;

    // 4. Marcar como leído (best-effort, no bloquea).
    void markAsRead(integration, msg.waMessageId);

    // 5. Disparar el bot. En WA2 esto encola en pg-boss y corre DeepSeek +
    //    intents + identificación OTP. Por ahora dejamos el punto de entrada.
    await handleBotTurn(req, integration, conversationId, msg);
}

/**
 * Punto de entrada del bot (WA2). Aquí entrará:
 *  - verificación de identidad (OTP por email si el contacto no está identificado)
 *  - DeepSeek V3 con function-calling sobre los 5 intents core
 *  - modo asistido (crea draft para aprobación) vs auto (envía directo)
 *
 * Se deja como stub explícito para no enviar respuestas sin tool exitoso
 * (decisión #6: cero alucinaciones). No responde nada hasta WA2.
 */
async function handleBotTurn(
    req: Request,
    _integration: WhatsAppIntegration,
    conversationId: string,
    msg: ParsedInboundMessage,
): Promise<void> {
    req.log?.info(
        { conversationId, type: msg.type, contactWaId: msg.contactWaId },
        'WhatsApp: inbound stored. Bot turn pending (WA2: DeepSeek + OTP + intents).',
    );
    // TODO(WA2): encolar en pg-boss → identificación OTP → DeepSeek tool-calling
    // → draft (modo asistido) o envío directo (modo auto).
}

export default router;
