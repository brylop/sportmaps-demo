// bff/src/routes/internal-notifications.routes.ts
//
// Endpoint INTERNO que dispara el trigger de la base vía pg_net:
//   POST /internal/notifications/dispatch  body: { notification_id }
//
// NO usa JWT de usuario. Se valida con el header `x-notif-secret` contra
// NOTIF_DISPATCH_SECRET (comparación en tiempo constante).
//
// FAIL-CLOSED: si NOTIF_DISPATCH_SECRET no está en el env → 401 SIEMPRE (nunca
// se acepta un dispatch sin secreto configurado).
//
// El envío real es best-effort: si algo falla se responde 202 (retryable) y el
// worker (notifications-dispatch.job) reintenta. El claim es por lease, así que
// un fallo aquí no "quema" la fila.

import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { claimByNotificationId, dispatchDelivery } from '../services/notification.service';

const router = Router();

// Aseguramos parseo JSON aunque el global no cubriera esta ruta.
router.use(express.json());

function secretOk(req: Request): boolean {
    const secret = process.env.NOTIF_DISPATCH_SECRET;
    if (!secret) return false; // fail-closed: sin secreto en env, no se acepta nada
    const got = String(req.header('x-notif-secret') || '');
    const a = Buffer.from(got);
    const b = Buffer.from(secret);
    // timingSafeEqual exige igual longitud; la comparamos primero (fuga de longitud aceptable).
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/dispatch', async (req: Request, res: Response) => {
    if (!secretOk(req)) return res.status(401).json({ error: 'unauthorized' });

    // Gate de despliegue: permite subir el código con el fan-out apagado.
    if (process.env.NOTIF_DISPATCH_ENABLED !== 'true') return res.status(204).end();

    const notificationId = req.body?.notification_id;
    if (!notificationId || typeof notificationId !== 'string') {
        return res.status(400).json({ error: 'notification_id_required' });
    }

    try {
        const delivery = await claimByNotificationId(notificationId);
        if (!delivery) {
            // Ya entregada, con lease vigente, o agotó intentos → no-op (idempotente).
            return res.status(200).json({ ok: true, claimed: false });
        }
        await dispatchDelivery(delivery);
        return res.status(200).json({ ok: true, claimed: true });
    } catch (err: any) {
        // No romper: el worker es la red de seguridad. El lease expira y se retoma.
        req.log?.error?.({ err }, 'internal dispatch failed');
        return res.status(202).json({ ok: false, retryable: true });
    }
});

export default router;
