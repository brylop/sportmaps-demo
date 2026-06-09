// bff/src/routes/devices.routes.ts
//
// Endpoints para registro y gestion de dispositivos del usuario (Fase 6.1).
// Preparado para Capacitor (mobile) pero tambien util para web PWA.
//
//   POST   /api/v1/devices/register   → upsert device del caller
//   DELETE /api/v1/devices/:deviceId  → revocar device
//   GET    /api/v1/devices            → listar mis devices

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireCsrfHeader } from '../middlewares/csrfHeader';

const router = Router();

// Rate limit: 5 registros/min/user — protege de loops accidentales
// (un bug que llame register en cada render del frontend) sin afectar
// uso normal (1 registro por sesion).
const deviceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 5 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `device-${(req as any).user?.id || req.ip}`,
});

const RegisterSchema = z.object({
    device_id:     z.string().min(1).max(255),
    platform:      z.enum(['web', 'ios', 'android']),
    push_token:    z.string().max(2048).optional(),
    push_provider: z.enum(['apns', 'fcm', 'web_push']).optional(),
    app_version:   z.string().max(64).optional(),
    os_version:    z.string().max(64).optional(),
    device_model:  z.string().max(128).optional(),
    locale:        z.string().max(16).optional(),
    timezone:      z.string().max(64).optional(),
});

router.post(
    '/register',
    requireAuth,
    requireCsrfHeader,
    deviceLimiter,
    async (req: Request, res: Response) => {
        const parsed = RegisterSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
        }
        const body = parsed.data;
        const ua = req.headers['user-agent'] || null;

        try {
            const { data, error } = await supabase.rpc('register_user_device', {
                p_device_id:     body.device_id,
                p_platform:      body.platform,
                p_push_token:    body.push_token ?? null,
                p_push_provider: body.push_provider ?? null,
                p_app_version:   body.app_version ?? null,
                p_os_version:    body.os_version ?? null,
                p_device_model:  body.device_model ?? null,
                p_locale:        body.locale ?? null,
                p_timezone:      body.timezone ?? null,
                p_user_agent:    ua,
            });

            if (error) {
                req.log?.error({ err: error }, 'register_user_device RPC failed');
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }
            if (!data?.ok) {
                return res.status(400).json(data);
            }
            return res.json(data);
        } catch (err: any) {
            req.log?.error({ err }, 'Error POST /devices/register');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

router.delete(
    '/:deviceId',
    requireAuth,
    requireCsrfHeader,
    async (req: Request, res: Response) => {
        const deviceId = req.params.deviceId;
        const reason = (req.query.reason as string) || 'user_logout';
        try {
            const { data, error } = await supabase.rpc('revoke_user_device', {
                p_device_id: deviceId,
                p_reason: reason,
            });
            if (error) {
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }
            return res.json(data);
        } catch (err: any) {
            req.log?.error({ err }, 'Error DELETE /devices/:id');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response) => {
        try {
            const { data, error } = await supabase
                .from('user_devices')
                .select('id, device_id, platform, push_provider, app_version, os_version, device_model, locale, timezone, first_seen_at, last_seen_at, revoked_at')
                .eq('user_id', req.user.id)
                .order('last_seen_at', { ascending: false });

            if (error) return res.status(500).json({ error: 'server_error' });
            return res.json({ ok: true, devices: data ?? [] });
        } catch (err: any) {
            req.log?.error({ err }, 'Error GET /devices');
            return res.status(500).json({ error: 'server_error' });
        }
    },
);

export default router;
