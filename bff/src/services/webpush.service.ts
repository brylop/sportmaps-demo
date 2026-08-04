// bff/src/services/webpush.service.ts
//
// Emisor Web Push (VAPID) del despachador unificado. Lee las suscripciones de
// `push_subscriptions` (service_role, bypass RLS) y envía. Limpia suscripciones
// muertas: FCM/navegador devuelve 404 (Not Found) o 410 (Gone) → se BORRA la
// fila (a diferencia del nativo que se "revoca", aquí la fila ya no sirve nunca).
//
// Payload limitado a ~4KB (límite de Web Push): si `data` infla el JSON por
// encima del margen, se DROPPEA `data` (título/cuerpo/url siempre viajan).

import { supabase } from '../config/supabase';
import { isWebPushConfigured, webpush } from '../config/webpush';

export interface WebPushPayload {
    title: string;
    body: string;
    url: string;
    type: string;
    data?: Record<string, unknown>;
}

export interface WebPushResult {
    sent: number;
    failed: number;
    revoked: number;
    lastError?: string; // detalle del último fallo no-fatal (p.ej. 403 VAPID mismatch)
}

const MAX_PAYLOAD_BYTES = 3800; // margen bajo el límite real (~4096) de Web Push

/** Serializa el payload y dropea `data` si excede el margen de tamaño. */
function serializePayload(payload: WebPushPayload): string {
    let json = JSON.stringify(payload);
    if (Buffer.byteLength(json, 'utf8') > MAX_PAYLOAD_BYTES) {
        json = JSON.stringify({ ...payload, data: {} });
    }
    return json;
}

/**
 * Envía un web push a todas las suscripciones del usuario.
 * No-op seguro si VAPID no está configurado (sent/failed/revoked = 0).
 */
export async function sendWebPushToUser(userId: string, payload: WebPushPayload): Promise<WebPushResult> {
    if (!isWebPushConfigured()) return { sent: 0, failed: 0, revoked: 0 };

    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId);

    if (error || !subs || subs.length === 0) {
        return { sent: 0, failed: 0, revoked: 0 };
    }

    const body = serializePayload(payload);
    const dead: string[] = [];
    let sent = 0;
    let failed = 0;
    let lastError: string | undefined;

    await Promise.all(
        subs.map(async (s) => {
            try {
                await webpush.sendNotification(
                    { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                    body,
                );
                sent++;
            } catch (err: any) {
                const code = err?.statusCode;
                if (code === 404 || code === 410) {
                    dead.push(s.id); // suscripción muerta → borrar
                } else {
                    failed++;
                    // Guardamos el detalle para diagnóstico (403 = VAPID mismatch, etc.)
                    lastError = `web ${code ?? ''} ${String(err?.body || err?.message || '').slice(0, 200)}`.trim();
                }
            }
        }),
    );

    let revoked = 0;
    if (dead.length > 0) {
        const { error: delErr, count } = await supabase
            .from('push_subscriptions')
            .delete({ count: 'exact' })
            .in('id', dead);
        if (!delErr) revoked = count ?? dead.length;
    }

    return { sent, failed, revoked, lastError };
}
