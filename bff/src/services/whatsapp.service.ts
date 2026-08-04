/**
 * whatsapp.service — Capa de integración con la WhatsApp Cloud API (Meta).
 *
 * Modelo Tech Provider multi-tenant (Bloque 6, decisión #1):
 *  - UN webhook (`POST /api/v1/webhooks/whatsapp`) recibe los mensajes de
 *    TODAS las escuelas.
 *  - El routing se resuelve por `phone_number_id` -> integración -> school_id.
 *  - Cada escuela conecta SU número vía Embedded Signup; su access token
 *    queda cifrado en `school_whatsapp_integrations.access_token_encrypted`.
 *
 * Seguridad:
 *  - Verificación HMAC-SHA256 del webhook sobre el RAW body (decisión arq. #2).
 *  - Token Meta cifrado en reposo con AES-256-GCM, clave en env
 *    WHATSAPP_TOKEN_ENC_KEY (32 bytes hex/base64). Rotación soportada
 *    (token_rotated_at). Honra decisión #9 (clave en env + rotación);
 *    se usa AES-GCM en Node en vez de pgcrypto porque el BFF necesita la
 *    clave en env de todos modos para llamar a Graph API.
 *
 * NUNCA exponer WHATSAPP_TOKEN_ENC_KEY ni WHATSAPP_APP_SECRET al cliente.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase';

const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface WhatsAppIntegration {
    id: string;
    school_id: string;
    phone_number_id: string;
    waba_id: string | null;
    display_phone_number: string | null;
    access_token_encrypted: string | null;
    verify_token: string | null;
    status: string;
}

// ─── Cifrado del access token (AES-256-GCM) ───────────────────────────────────

/**
 * Deriva la clave de 32 bytes desde WHATSAPP_TOKEN_ENC_KEY.
 * Acepta la clave en hex (64 chars) o base64. Si no parsea a 32 bytes,
 * la deriva con SHA-256 (permite passphrase arbitraria en dev).
 */
function getEncKey(): Buffer {
    const raw = process.env.WHATSAPP_TOKEN_ENC_KEY;
    if (!raw) {
        throw new Error('WHATSAPP_TOKEN_ENC_KEY no configurado en el BFF.');
    }
    // hex de 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    // base64 de 32 bytes
    try {
        const b = Buffer.from(raw, 'base64');
        if (b.length === 32) return b;
    } catch { /* sigue */ }
    // fallback: derivar de passphrase
    return crypto.createHash('sha256').update(raw).digest();
}

/** Cifra un token Meta. Formato de salida: gcm:<iv_hex>:<tag_hex>:<ciphertext_hex> */
export function encryptToken(plaintext: string): string {
    const key = getEncKey();
    const iv = crypto.randomBytes(12); // 96-bit nonce recomendado para GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

/** Descifra un token Meta producido por encryptToken. */
export function decryptToken(encrypted: string): string {
    const key = getEncKey();
    const parts = encrypted.split(':');
    if (parts.length !== 4 || parts[0] !== 'gcm') {
        throw new Error('Formato de token cifrado inválido.');
    }
    const [, ivHex, tagHex, ctHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return pt.toString('utf8');
}

// ─── Verificación HMAC del webhook ────────────────────────────────────────────

/**
 * Valida la firma X-Hub-Signature-256 que Meta envía sobre el RAW body.
 * Protocolo: 'sha256=' + HMAC_SHA256(rawBody, APP_SECRET).
 * Usa comparación en tiempo constante para evitar timing attacks.
 *
 * @param rawBody  Buffer/string EXACTO recibido (no el JSON re-serializado).
 * @param signatureHeader  valor del header 'x-hub-signature-256'.
 */
export function verifyWebhookSignature(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        // Sin secret no podemos verificar — fail closed.
        return false;
    }
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
        return false;
    }
    const expected = crypto
        .createHmac('sha256', appSecret)
        .update(rawBody)
        .digest('hex');
    const received = signatureHeader.slice('sha256='.length);

    // timingSafeEqual exige buffers del mismo largo.
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

// ─── Resolución de tenant (cache LRU simple) ─────────────────────────────────

interface CacheEntry { value: WhatsAppIntegration | null; expires: number; }
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const TENANT_CACHE_MAX = 500;
const tenantCache = new Map<string, CacheEntry>();

/**
 * Resuelve la integración (escuela) por phone_number_id. Cachea 5 min.
 * Devuelve null si no existe o no está activa.
 */
export async function resolveIntegration(
    phoneNumberId: string,
): Promise<WhatsAppIntegration | null> {
    const now = Date.now();
    const cached = tenantCache.get(phoneNumberId);
    if (cached && cached.expires > now) {
        return cached.value;
    }

    const { data, error } = await supabase
        .from('school_whatsapp_integrations')
        .select('id, school_id, phone_number_id, waba_id, display_phone_number, access_token_encrypted, verify_token, status')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle();

    const value: WhatsAppIntegration | null =
        error || !data || data.status !== 'active' ? null : (data as WhatsAppIntegration);

    // Evicción simple por tamaño (LRU aproximado: borra el primero insertado).
    if (tenantCache.size >= TENANT_CACHE_MAX) {
        const firstKey = tenantCache.keys().next().value;
        if (firstKey !== undefined) tenantCache.delete(firstKey);
    }
    tenantCache.set(phoneNumberId, { value, expires: now + TENANT_CACHE_TTL_MS });
    return value;
}

/** Invalida el cache de un número (llamar al conectar/desconectar/suspender). */
export function invalidateTenantCache(phoneNumberId?: string): void {
    if (phoneNumberId) tenantCache.delete(phoneNumberId);
    else tenantCache.clear();
}

// ─── Envío de mensajes (Graph API) ────────────────────────────────────────────

export interface SendTextResult {
    ok: boolean;
    waMessageId?: string;
    error?: string;
}

/**
 * Envía un mensaje de texto al contacto vía Cloud API.
 * Requiere que la integración tenga access_token_encrypted válido.
 *
 * Nota Meta: fuera de la ventana de servicio de 24h solo se permiten
 * plantillas aprobadas (sendTemplate). Para respuestas dentro de la ventana
 * (el contacto escribió en <24h) el texto libre está permitido.
 */
export async function sendTextMessage(
    integration: WhatsAppIntegration,
    toWaId: string,
    text: string,
): Promise<SendTextResult> {
    if (!integration.access_token_encrypted) {
        return { ok: false, error: 'integration_without_token' };
    }
    let token: string;
    try {
        token = decryptToken(integration.access_token_encrypted);
    } catch {
        return { ok: false, error: 'token_decrypt_failed' };
    }

    try {
        const res = await fetch(`${GRAPH_BASE_URL}/${integration.phone_number_id}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: toWaId,
                type: 'text',
                text: { preview_url: false, body: text },
            }),
        });

        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: json?.error?.message || `graph_${res.status}` };
        }
        return { ok: true, waMessageId: json?.messages?.[0]?.id };
    } catch (err: any) {
        return { ok: false, error: err?.message || 'network_error' };
    }
}

/**
 * Marca un mensaje entrante como leído (check azul). Best-effort, no bloquea.
 */
export async function markAsRead(
    integration: WhatsAppIntegration,
    waMessageId: string,
): Promise<void> {
    if (!integration.access_token_encrypted) return;
    let token: string;
    try {
        token = decryptToken(integration.access_token_encrypted);
    } catch {
        return;
    }
    try {
        await fetch(`${GRAPH_BASE_URL}/${integration.phone_number_id}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: waMessageId,
            }),
        });
    } catch {
        /* best-effort */
    }
}

// ─── Helpers de parsing del payload entrante ─────────────────────────────────

export interface ParsedInboundMessage {
    phoneNumberId: string;
    contactWaId: string;
    contactName: string | null;
    waMessageId: string;
    type: string;
    textBody: string | null;
    waTimestamp: string;       // ISO
    raw: any;
}

/**
 * Extrae los mensajes entrantes de un payload de webhook de WhatsApp.
 * Un payload puede traer varias entries/changes/messages.
 */
export function parseInboundMessages(body: any): ParsedInboundMessage[] {
    const out: ParsedInboundMessage[] = [];
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
            const value = change?.value;
            if (!value || change?.field !== 'messages') continue;
            const phoneNumberId: string = value?.metadata?.phone_number_id || '';
            const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
            const nameByWaId: Record<string, string> = {};
            for (const c of contacts) {
                if (c?.wa_id) nameByWaId[c.wa_id] = c?.profile?.name || '';
            }
            const messages = Array.isArray(value?.messages) ? value.messages : [];
            for (const m of messages) {
                const type: string = m?.type || 'unsupported';
                let textBody: string | null = null;
                if (type === 'text') textBody = m?.text?.body ?? null;
                else if (type === 'button') textBody = m?.button?.text ?? null;
                else if (type === 'interactive') {
                    textBody = m?.interactive?.button_reply?.title
                        || m?.interactive?.list_reply?.title
                        || null;
                }
                const epoch = Number(m?.timestamp || 0);
                out.push({
                    phoneNumberId,
                    contactWaId: m?.from || '',
                    contactName: nameByWaId[m?.from] || null,
                    waMessageId: m?.id || '',
                    type,
                    textBody,
                    waTimestamp: epoch ? new Date(epoch * 1000).toISOString() : new Date().toISOString(),
                    raw: m,
                });
            }
        }
    }
    return out;
}
