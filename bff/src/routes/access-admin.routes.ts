/**
 * access-admin.routes — Vista SUPER-ADMIN de logs de control de acceso.
 * Montado en /api/v1/admin/access-logs. Gateado a super_admin/admin.
 *
 *  - GET /events       → eventos de acceso de TODAS las escuelas (access_events)
 *  - GET /device-log   → tráfico crudo del protocolo ADMS (adms_device_log)
 */
import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

router.use(requireAuth);
router.use(requireRole('super_admin', 'admin'));

// ─── GET /api/v1/admin/access-logs/events ────────────────────────────────────
// Eventos de acceso cross-escuela, enriquecidos con nombre y dispositivo.
router.get('/events', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset   = parseInt(req.query.offset as string) || 0;
    const schoolId = req.query.school_id as string | undefined;
    const date     = req.query.date as string | undefined;

    let query = supabase
      .from('access_events')
      .select(`
        id, school_id, direction, access_granted, denial_reason,
        check_in_method, zk_user_id, occurred_at, user_id, unregistered_athlete_id,
        turnstile_devices!access_events_device_id_fkey(device_name, serial_number, direction)
      `)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (schoolId) query = query.eq('school_id', schoolId);
    if (date) {
      const startUTC = `${date}T05:00:00+00:00`;
      const endUTC   = new Date(new Date(startUTC).getTime() + 86400000).toISOString();
      query = query.gte('occurred_at', startUTC).lt('occurred_at', endUTC);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((events || []).map((e: any) => e.user_id).filter(Boolean))];
    const uaIds   = [...new Set((events || []).map((e: any) => e.unregistered_athlete_id).filter(Boolean))];
    const schoolIds = [...new Set((events || []).map((e: any) => e.school_id).filter(Boolean))];

    const profileMap: Record<string, string> = {};
    const uaMap: Record<string, string> = {};
    const schoolMap: Record<string, string> = {};

    if (userIds.length) {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
      (data || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });
    }
    if (uaIds.length) {
      const { data } = await supabase.from('unregistered_athletes').select('id, full_name').in('id', uaIds);
      (data || []).forEach((u: any) => { uaMap[u.id] = u.full_name; });
    }
    if (schoolIds.length) {
      const { data } = await supabase.from('schools').select('id, name').in('id', schoolIds);
      (data || []).forEach((s: any) => { schoolMap[s.id] = s.name; });
    }

    const enriched = (events || []).map((e: any) => ({
      ...e,
      school_name: schoolMap[e.school_id] ?? e.school_id,
      user_name:
        (e.user_id && profileMap[e.user_id]) ? profileMap[e.user_id]
        : (e.unregistered_athlete_id && uaMap[e.unregistered_athlete_id]) ? uaMap[e.unregistered_athlete_id]
        : `ZK#${e.zk_user_id}`,
    }));

    return res.json({ events: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener eventos de acceso' });
  }
});

// ─── GET /api/v1/admin/access-logs/device-log ────────────────────────────────
// Tráfico crudo del protocolo ADMS (handshake, attlog_batch, getrequest, devicecmd, error).
router.get('/device-log', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit     = Math.min(parseInt(req.query.limit as string) || 150, 500);
    const offset    = parseInt(req.query.offset as string) || 0;
    const sn        = req.query.sn as string | undefined;
    const eventType = req.query.event_type as string | undefined;

    let query = supabase
      .from('adms_device_log')
      .select('id, sn, event_type, detail, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sn) query = query.eq('sn', sn);
    if (eventType) query = query.eq('event_type', eventType);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ logs: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: 'Error al obtener el log de dispositivo' });
  }
});

export default router;
