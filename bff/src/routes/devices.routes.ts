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
            // Upsert directo con el service_role + req.user.id (de requireAuth).
            // NO usamos el RPC register_user_device porque depende de auth.uid(),
            // que es NULL cuando el BFF llama con el cliente service_role → siempre
            // devolvía { ok:false, error:'auth_required' }. Solo incluimos los
            // campos opcionales presentes para no pisar valores previos (replica
            // el COALESCE del RPC).
            const row: Record<string, any> = {
                user_id:        req.user.id,
                device_id:      body.device_id,
                platform:       body.platform,
                user_agent:     ua,
                last_seen_at:   new Date().toISOString(),
                revoked_at:     null,
                revoked_reason: null,
            };
            if (body.push_token != null)    row.push_token    = body.push_token;
            if (body.push_provider != null) row.push_provider = body.push_provider;
            if (body.app_version != null)   row.app_version   = body.app_version;
            if (body.os_version != null)    row.os_version    = body.os_version;
            if (body.device_model != null)  row.device_model  = body.device_model;
            if (body.locale != null)        row.locale        = body.locale;
            if (body.timezone != null)      row.timezone      = body.timezone;

            const { data, error } = await supabase
                .from('user_devices')
                .upsert(row, { onConflict: 'user_id,device_id' })
                .select('id')
                .single();

            if (error) {
                req.log?.error({ err: error }, 'user_devices upsert failed');
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }
            return res.json({ ok: true, id: data?.id });
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
            // Update directo con req.user.id (mismo motivo que /register: el RPC
            // revoke_user_device depende de auth.uid(), NULL con service_role).
            const { error } = await supabase
                .from('user_devices')
                .update({
                    revoked_at: new Date().toISOString(),
                    revoked_reason: reason,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', req.user.id)
                .eq('device_id', deviceId);
            if (error) {
                return res.status(500).json({ error: 'server_error', detail: error.message });
            }
            return res.json({ ok: true });
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
