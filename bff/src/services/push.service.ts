// bff/src/services/push.service.ts
//
// Emisor de push notifications (FCM HTTP v1 via firebase-admin).
// Lee los push_token de user_devices y envia. Limpia tokens muertos
// (FCM responde UNREGISTERED → se revoca la fila para no reintentar).
//
// Web push (push_provider='web_push') NO se envia por aqui — FCM admin
// maneja apns/fcm de apps nativas. Los web_push se ignoran de momento.

import type { SendResponse } from 'firebase-admin/messaging';
import { getMessaging } from '../config/firebase';
import { supabase } from '../config/supabase';

export interface PushPayload {
    title: string;
    body: string;
    /** data arbitraria (deep link, ids). Todos los valores DEBEN ser string (requisito FCM). */
    data?: Record<string, string>;
}

export interface PushResult {
    enabled: boolean;
    sent: number;
    failed: number;
    revoked: number;
    reason?: string;
}

// Codigos de error de FCM que indican un token definitivamente invalido.
const DEAD_TOKEN_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
]);

/**
 * Envia un push a todos los dispositivos nativos activos de un usuario.
 * No-op seguro si push no esta configurado (devuelve enabled:false).
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<PushResult> {
    const messaging = getMessaging();
    if (!messaging) {
        return { enabled: false, sent: 0, failed: 0, revoked: 0, reason: 'push_not_configured' };
    }

    // Tokens activos (no revocados) de apps nativas.
    const { data: devices, error } = await supabase
        .from('user_devices')
        .select('push_token')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .not('push_token', 'is', null)
        .in('push_provider', ['fcm', 'apns']);

    if (error) {
        return { enabled: true, sent: 0, failed: 0, revoked: 0, reason: error.message };
    }

    const tokens = Array.from(
        new Set((devices ?? []).map((d) => d.push_token).filter((t): t is string => !!t)),
    );
    if (tokens.length === 0) {
        return { enabled: true, sent: 0, failed: 0, revoked: 0, reason: 'no_active_tokens' };
    }

    const resp = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
    });

    // Detectar tokens muertos y revocarlos.
    const deadTokens: string[] = [];
    resp.responses.forEach((r: SendResponse, i: number) => {
        if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
            deadTokens.push(tokens[i]);
        }
    });

    let revoked = 0;
    if (deadTokens.length > 0) {
        const { error: revErr, count } = await supabase
            .from('user_devices')
            .update({
                revoked_at: new Date().toISOString(),
                revoked_reason: 'push_token_unregistered',
                updated_at: new Date().toISOString(),
            }, { count: 'exact' })
            .in('push_token', deadTokens);
        if (!revErr) revoked = count ?? deadTokens.length;
    }

    return {
        enabled: true,
        sent: resp.successCount,
        failed: resp.failureCount,
        revoked,
    };
}
