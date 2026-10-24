/**
 * Torneos en vivo — /api/v1/tournament-live
 *   · Organizador (school / school_admin): ajustes, calendario por formato, anotar, anotadores sin cuenta, log.
 *   · Anotador sin cuenta: token en la ruta (solo el hash vive en la base).
 *   · Público: GET /public/:slug/live (sin login, caché de 5 s, solo equipos y marcadores).
 * Spec: docs/specs/torneos-en-vivo-multideporte-plan.md
 */
import { Router, Response, Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import {
  Actor, LiveError, authScorekeeper, buildCategoryStandings, createScorekeeper, generateCategoryFixtures, getConfig, hashToken,
  listScorekeepers, loadEvent, loadMatch, loadMatches, patchConfig, performMatchAction, publicLive, revokeScorekeeper,
  scorerMatches, takeMatch, toMatchDto, touchScorekeeper, LiveEvent,
} from '../services/tournament/tournament-live.service';
import { resolveConfig } from '../services/tournament/scoring.shared';

const router = Router();
const prod = process.env.NODE_ENV === 'production';

// Varias familias comparten la wifi del coliseo: el tope por IP es alto a propósito; la carga real
// la contiene la caché de 5 s del BFF (una consulta a la base cada 5 s por torneo).
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, max: prod ? 3000 : 20000, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.', code: 'rate_limited' },
});
const scorerLimiter = rateLimit({
  windowMs: 60 * 1000, max: prod ? 600 : 5000, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `scorer-${hashToken(String(req.params.token ?? '')).slice(0, 16)}-${ipKeyGenerator(req.ip ?? '')}`,
  message: { error: 'Demasiadas acciones seguidas. Espera un momento.', code: 'rate_limited' },
});
const orgLimiter = rateLimit({
  windowMs: 60 * 1000, max: prod ? 600 : 5000, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Espera un momento.', code: 'rate_limited' },
});

function fail(res: Response, req: Request, err: unknown) {
  if (err instanceof LiveError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.extra ?? {}) });
  }
  (req as any).log?.error({ err }, 'Error inesperado en torneos en vivo');
  return res.status(500).json({ error: 'Error interno del servidor', code: 'interno' });
}

/** El torneo debe ser de la escuela del usuario. */
async function ownedEvent(req: AuthenticatedRequest, eventId: string): Promise<LiveEvent> {
  const schoolId = req.schoolId;
  if (!schoolId) throw new LiveError(403, 'sin_escuela', 'No se pudo resolver la escuela del usuario.');
  const ev = await loadEvent(eventId);
  if (!ev || ev.school_id !== schoolId) throw new LiveError(404, 'torneo_no_encontrado', 'Torneo no encontrado');
  const { data } = await supabase.from('events').select('creator_role').eq('id', eventId).maybeSingle();
  if ((data as any)?.creator_role !== 'school') throw new LiveError(404, 'torneo_no_encontrado', 'Torneo no encontrado');
  return ev;
}

const org = [orgLimiter, requireAuth, requireRole('school', 'school_admin')] as const;

const userActor = (req: AuthenticatedRequest): Actor => ({ type: 'user', id: req.user!.id, label: 'Administración' });

// ── Organizador ──────────────────────────────────────────────────────────────

router.get('/school/:id/config', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try { return res.json(await getConfig(await ownedEvent(req, String(req.params.id)))); } catch (e) { return fail(res, req, e); }
});

router.patch('/school/:id/config', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try { return res.json(await patchConfig(await ownedEvent(req, String(req.params.id)), req.body ?? {})); } catch (e) { return fail(res, req, e); }
});

router.post('/school/:id/categories/:catId/fixtures', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    const out = await generateCategoryFixtures(ev, String(req.params.catId), req.body?.format, req.body?.config ?? {});
    return res.status(201).json(out);
  } catch (e) { return fail(res, req, e); }
});

router.get('/school/:id/matches', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    const rows = await loadMatches(ev.id, req.query.category_id ? String(req.query.category_id) : null);
    return res.json(rows.map((m) => toMatchDto(m, resolveConfig(ev.scoring_config, m.category_id))));
  } catch (e) { return fail(res, req, e); }
});

router.get('/school/:id/standings', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    const st = await buildCategoryStandings(ev, req.query.category_id ? String(req.query.category_id) : null);
    return res.json({ ...st, scorers: [] });
  } catch (e) { return fail(res, req, e); }
});

router.post('/school/:id/matches/:matchId/actions', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    const out = await performMatchAction(ev, String(req.params.matchId), userActor(req), {
      action: req.body?.action, client_action_id: req.body?.client_action_id ?? null,
      expected_version: Number.isInteger(req.body?.expected_version) ? req.body.expected_version : null,
    });
    return res.json({ ok: true, ...out });
  } catch (e) { return fail(res, req, e); }
});

router.post('/school/:id/matches/:matchId/take', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    return res.json(await takeMatch(ev, String(req.params.matchId), userActor(req)));
  } catch (e) { return fail(res, req, e); }
});

router.get('/school/:id/scorekeepers', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try { const ev = await ownedEvent(req, String(req.params.id)); return res.json(await listScorekeepers(ev.id)); } catch (e) { return fail(res, req, e); }
});

router.post('/school/:id/scorekeepers', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    const origin = String(process.env.FRONTEND_URL || req.get('origin') || 'https://app.sportmaps.co');
    return res.status(201).json(await createScorekeeper(ev, req.user!.id, req.body ?? {}, origin));
  } catch (e) { return fail(res, req, e); }
});

router.delete('/school/:id/scorekeepers/:sid', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try { const ev = await ownedEvent(req, String(req.params.id)); return res.json(await revokeScorekeeper(ev.id, String(req.params.sid))); } catch (e) { return fail(res, req, e); }
});

router.get('/school/:id/log', ...org, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ev = await ownedEvent(req, String(req.params.id));
    let q = supabase.from('tournament_match_log')
      .select('id, match_id, action, actor_type, actor_id, created_at, before_state, after_state')
      .eq('event_id', ev.id).order('created_at', { ascending: false }).limit(100);
    if (req.query.match_id) q = q.eq('match_id', String(req.query.match_id));
    const { data } = await q;
    return res.json(data ?? []);
  } catch (e) { return fail(res, req, e); }
});

// ── Anotador sin cuenta ──────────────────────────────────────────────────────

router.get('/scorer/:token', scorerLimiter, async (req: Request, res: Response) => {
  try {
    const sk = await authScorekeeper(String(req.params.token));
    return res.json({
      event: { id: sk.event.id, title: sk.event.title, sport: sk.event.sport, slug: sk.event.slug },
      scorekeeper: { label: sk.label, court: sk.court },
      matches: await scorerMatches(sk),
    });
  } catch (e) { return fail(res, req, e); }
});

router.post('/scorer/:token/matches/:matchId/actions', scorerLimiter, async (req: Request, res: Response) => {
  try {
    const sk = await authScorekeeper(String(req.params.token));
    const m = await loadMatch(sk.event.id, String(req.params.matchId));
    if (m && sk.court && m.court && m.court !== sk.court) throw new LiveError(403, 'otra_cancha', 'Este enlace es de otra cancha');
    const out = await performMatchAction(sk.event, String(req.params.matchId), { type: 'scorekeeper', id: sk.id, label: sk.label }, {
      action: req.body?.action, client_action_id: req.body?.client_action_id ?? null,
      expected_version: Number.isInteger(req.body?.expected_version) ? req.body.expected_version : null,
    });
    touchScorekeeper(sk.id).catch(() => { /* best-effort */ });
    return res.json({ ok: true, ...out });
  } catch (e) { return fail(res, req, e); }
});

router.post('/scorer/:token/matches/:matchId/take', scorerLimiter, async (req: Request, res: Response) => {
  try {
    const sk = await authScorekeeper(String(req.params.token));
    return res.json(await takeMatch(sk.event, String(req.params.matchId), { type: 'scorekeeper', id: sk.id, label: sk.label }));
  } catch (e) { return fail(res, req, e); }
});

// ── Público ──────────────────────────────────────────────────────────────────

router.get('/public/:slug/live', publicLimiter, async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9][a-z0-9-]{0,120}$/.test(slug)) return res.status(404).json({ error: 'Torneo no encontrado', code: 'torneo_no_encontrado' });
    const out = await publicLive(slug);
    if (!out) return res.status(404).json({ error: 'Torneo no encontrado', code: 'torneo_no_encontrado' });
    res.setHeader('Cache-Control', 'public, max-age=5');
    res.setHeader('ETag', out.etag);
    res.setHeader('X-Robots-Tag', 'noindex');
    if (req.get('if-none-match') === out.etag) return res.status(304).end();
    return res.json(out.payload);
  } catch (e) { return fail(res, req, e); }
});

export default router;
