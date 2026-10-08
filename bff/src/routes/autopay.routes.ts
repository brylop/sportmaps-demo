/**
 * autopay.routes — Débito automático F3: la familia lo activa y la escuela lo administra.
 * Spec: docs/specs/debito-automatico.md §11. Contrato: frontend/src/lib/api/autopay.ts.
 *
 * Montado en /api/v1/autopay con requireAuth + requireCsrfHeader (escrituras).
 *
 * Reglas:
 *   · Toda escritura va por las RPC SECURITY DEFINER con el actor explícito
 *     (F1 + F3): ellas validan acudiente↔atleta↔escuela, dueño del medio y admin.
 *     Aquí solo se valida forma y se habla con Wompi.
 *   · Credenciales SOLO del resolver de la escuela (fail-closed).
 *   · La tarjeta llega ya tokenizada desde el navegador (tok_…); el número nunca
 *     pasa por aquí. Del celular de Nequi se guardan los últimos 4 y un HMAC.
 *   · Logs sin datos personales: ids y códigos.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middlewares/authMiddleware';
import { resolveProvider } from '../services/payment-provider.resolver';
import {
    wompiCredsFrom,
    fetchAcceptanceTokens,
    fetchMerchantId,
    createPaymentSource,
    voidPaymentSource,
    createNequiToken,
    getNequiTokenStatus,
    type WompiCreds,
} from '../services/wompi.service';
import { nombreMes } from '../services/autopay.service';

const router = Router();

/**
 * UUID con la forma que acepta Postgres. z.string().uuid() exige la variante RFC
 * 4122 y rechaza ids válidos en la base (los de seeds e históricos): lo encontró
 * el E2E contra el gemelo con el id de un niño real del volcado.
 */
const zUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

// ─── Helpers puros (probados en autopay.routes.test.ts) ────────────────────────

/** Mismo cálculo que autopay_payment_total() en la base (D2, D3). */
export function totalConRecargo(amount: number, s: { surchargeMode?: string | null; feePct?: number | null }): number {
    const pct = s.feePct ?? 3;
    return amount + ((s.surchargeMode ?? 'same_as_online') === 'same_as_online' ? Math.round(amount * pct / 100) : 0);
}

/** Tope sugerido (D5): total vigente + 20 %, redondeado hacia arriba a miles. */
export function topeSugerido(total: number | null): number | null {
    if (total == null || total <= 0) return null;
    return Math.ceil((total * 1.2) / 1000) * 1000;
}

export function etiquetaTarjeta(brand: string | null | undefined, lastFour: string): string {
    const b = String(brand ?? '').toUpperCase();
    const nombre = b === 'VISA' ? 'Visa' : b === 'MASTERCARD' ? 'Mastercard' : b === 'AMEX' ? 'Amex' : b ? b[0] + b.slice(1).toLowerCase() : 'Tarjeta';
    return `${nombre} •••• ${lastFour}`;
}

/** Último día del mes de vencimiento de la tarjeta (YYYY-MM-DD). */
export function vencimientoTarjeta(expMonth?: string, expYear?: string): string | null {
    const m = Number(expMonth);
    let y = Number(expYear);
    if (!m || m < 1 || m > 12 || !y) return null;
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
}

/** HMAC del celular (spec §4.1): sin la llave no se guarda nada. */
export function phoneHmac(phone: string, key: string): string {
    return crypto.createHmac('sha256', key).update(phone).digest('hex');
}

export function hoyBogota(now = new Date()): string {
    return new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// ─── Helpers de datos ──────────────────────────────────────────────────────────

async function credsDeEscuela(schoolId: string): Promise<WompiCreds | null> {
    return wompiCredsFrom(await resolveProvider({ schoolId, preferredProvider: 'wompi' }));
}

interface Deportista { childId: string | null; athleteUserId: string | null; name: string; schoolId: string }

/** Deportistas del usuario con inscripción activa: sus hijos y él mismo si es atleta. */
async function deportistasDe(userId: string): Promise<Deportista[]> {
    const { data: hijos } = await supabase.from('children').select('id, full_name').eq('parent_id', userId);
    const hijoIds = ((hijos as any[]) ?? []).map(h => h.id);
    const nombreHijo = new Map(((hijos as any[]) ?? []).map(h => [h.id, h.full_name as string]));

    const consultas = [
        supabase.from('enrollments').select('school_id, user_id, child_id').eq('status', 'active').eq('user_id', userId),
    ];
    if (hijoIds.length) {
        consultas.push(supabase.from('enrollments').select('school_id, user_id, child_id').eq('status', 'active').in('child_id', hijoIds));
    }
    const filas = (await Promise.all(consultas)).flatMap(r => ((r.data as any[]) ?? []));

    const vistos = new Set<string>();
    const out: Deportista[] = [];
    let miNombre: string | null = null;
    for (const e of filas) {
        const childId = e.child_id ?? null;
        const athleteUserId = childId ? null : e.user_id;
        const k = `${e.school_id}:${childId ?? athleteUserId}`;
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (!childId && miNombre == null) {
            const { data: p } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
            miNombre = (p as any)?.full_name ?? 'Yo';
        }
        out.push({ childId, athleteUserId, schoolId: e.school_id, name: childId ? (nombreHijo.get(childId) ?? 'Deportista') : (miNombre ?? 'Yo') });
    }
    return out;
}

async function ajustesDe(schoolIds: string[]) {
    if (!schoolIds.length) return new Map<string, any>();
    const [{ data: ss }, { data: sch }] = await Promise.all([
        supabase.from('school_settings')
            .select('school_id, autopay_enabled, autopay_debits_paused, autopay_surcharge_mode, autopay_days_before_due, online_fee_pct')
            .in('school_id', schoolIds),
        supabase.from('schools').select('id, name').in('id', schoolIds),
    ]);
    const nombres = new Map(((sch as any[]) ?? []).map(s => [s.id, s.name]));
    const m = new Map<string, any>();
    for (const id of schoolIds) {
        const s = ((ss as any[]) ?? []).find(x => x.school_id === id) ?? {};
        m.set(id, {
            name: nombres.get(id) ?? 'Escuela',
            offered: !!s.autopay_enabled,
            paused: !!s.autopay_debits_paused,
            surchargeMode: s.autopay_surcharge_mode ?? 'same_as_online',
            feePct: s.online_fee_pct != null ? Number(s.online_fee_pct) : 3,
            daysBeforeDue: s.autopay_days_before_due ?? 3,
        });
    }
    return m;
}

function filtroAtleta(q: any, d: { childId: string | null; athleteUserId: string | null }) {
    return d.childId
        ? q.eq('child_id', d.childId)
        : q.is('child_id', null).or(`user_id.eq.${d.athleteUserId},and(user_id.is.null,parent_id.eq.${d.athleteUserId})`);
}

async function esFamiliaDeEscuela(userId: string, schoolId: string): Promise<boolean> {
    return (await deportistasDe(userId)).some(d => d.schoolId === schoolId);
}

async function correoDe(userId: string, fallback?: string): Promise<string | null> {
    const { data } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle();
    return (data as any)?.email ?? fallback ?? null;
}

async function avisar(userId: string | null, schoolId: string, title: string, message: string, link: string, data: Record<string, unknown>) {
    if (!userId) return;
    await supabase.from('notifications').insert({
        user_id: userId, school_id: schoolId, type: 'autopay', category: 'payment', title, message, link, data,
    });
}

function ipDe(req: Request): string | null {
    const ip = (req.ip ?? '').replace(/^::ffff:/, '');
    return ip || null;
}

const AceptacionSchema = {
    acceptanceToken: z.string().min(10),
    personalDataAuthToken: z.string().min(10),
    acceptancePermalink: z.string().url().optional(),
    personalDataPermalink: z.string().url().optional(),
};

async function crearConsentimiento(req: Request, body: any, extra: Record<string, unknown>): Promise<string | null> {
    const { data, error } = await supabase.from('payment_consents').insert({
        user_id: req.user.id,
        payment_provider: 'wompi',
        acceptance_token: body.acceptanceToken,
        personal_data_auth_token: body.personalDataAuthToken,
        acceptance_permalink: body.acceptancePermalink ?? null,
        personal_data_permalink: body.personalDataPermalink ?? null,
        accepted_at: new Date().toISOString(),
        ip_address: ipDe(req),
        user_agent: String(req.get('user-agent') ?? '').slice(0, 300) || null,
        metadata: { origin: 'autopay_f3', ...extra },
    }).select('id').single();
    if (error) {
        req.log?.error({ err: error.message }, 'autopay: no se pudo guardar el consentimiento');
        return null;
    }
    return (data as any).id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAMILIA
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/mine', requireAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const deportistas = await deportistasDe(userId);
        const [{ data: subs }, { data: tokens }] = await Promise.all([
            supabase.from('recurring_subscriptions')
                .select('id, school_id, child_id, athlete_user_id, status, suspend_reason, max_amount, payment_token_id')
                .eq('payer_user_id', userId).neq('status', 'cancelled'),
            supabase.from('payment_tokens')
                .select('id, school_id, payment_method_type, display_label, status')
                .eq('user_id', userId).not('school_id', 'is', null).in('status', ['available', 'pending_authorization', 'declined', 'error', 'voided']),
        ]);
        const subsArr = (subs as any[]) ?? [];
        const tokArr = (tokens as any[]) ?? [];
        const schoolIds = [...new Set([...deportistas.map(d => d.schoolId), ...subsArr.map(s => s.school_id)])];
        const ajustes = await ajustesDe(schoolIds);
        const hoy = hoyBogota();

        // Próximo ciclo por suscripción.
        const subIds = subsArr.map(s => s.id);
        const { data: ciclos } = subIds.length
            ? await supabase.from('autopay_cycles')
                .select('id, subscription_id, payment_id, state, next_attempt_on, announced_total, created_at, payments(period_month, period_year)')
                .in('subscription_id', subIds).in('state', ['scheduled', 'noticed', 'in_progress'])
                .order('created_at', { ascending: false })
            : { data: [] as any[] };

        const athletes = [];
        for (const d of deportistas) {
            const aj = ajustes.get(d.schoolId);
            const { data: pagos } = await filtroAtleta(
                supabase.from('payments')
                    .select('id, amount, status, due_date, period_year, period_month')
                    .eq('school_id', d.schoolId).eq('payment_category', 'mensualidad')
                    .not('period_year', 'is', null).neq('status', 'cancelled'),
                d,
            ).order('period_year', { ascending: false }).order('period_month', { ascending: false }).limit(12);
            const lista = (pagos as any[]) ?? [];
            const ultimo = lista[0];
            const currentTotal = ultimo ? totalConRecargo(Number(ultimo.amount), aj) : null;
            const currentPeriod = ultimo && ultimo.status === 'pending' && ultimo.due_date >= hoy
                ? { paymentId: ultimo.id, periodMonth: ultimo.period_month, periodYear: ultimo.period_year, dueDate: ultimo.due_date, total: currentTotal! }
                : null;
            const overdueCount = lista.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < hoy)).length;

            const sub = subsArr.find(s => s.school_id === d.schoolId
                && (d.childId ? s.child_id === d.childId : s.athlete_user_id === d.athleteUserId));
            let subscription = null;
            if (sub) {
                const tok = tokArr.find(t => t.id === sub.payment_token_id);
                const c = ((ciclos as any[]) ?? []).find(x => x.subscription_id === sub.id);
                subscription = {
                    id: sub.id,
                    status: sub.status,
                    suspendReason: sub.suspend_reason,
                    maxAmount: Number(sub.max_amount),
                    method: { tokenId: sub.payment_token_id, schoolId: sub.school_id, type: tok?.payment_method_type ?? 'CARD', label: tok?.display_label ?? 'Medio de pago' },
                    nextDebit: c ? {
                        cycleId: c.id, paymentId: c.payment_id,
                        periodMonth: c.payments?.period_month, periodYear: c.payments?.period_year,
                        state: c.state, date: c.state === 'scheduled' ? null : c.next_attempt_on,
                        total: c.announced_total != null ? Number(c.announced_total) : null,
                        skippable: c.state === 'scheduled' || c.state === 'noticed',
                    } : null,
                };
            }
            athletes.push({
                key: d.childId ? `child:${d.childId}` : `user:${d.athleteUserId}`,
                childId: d.childId, athleteUserId: d.athleteUserId, name: d.name, schoolId: d.schoolId,
                currentTotal, suggestedMax: topeSugerido(currentTotal), currentPeriod, overdueCount, subscription,
            });
        }

        return res.json({
            schools: schoolIds.map(id => {
                const a = ajustes.get(id);
                return {
                    schoolId: id, schoolName: a.name, offered: a.offered,
                    surchargePct: a.surchargeMode === 'same_as_online' ? a.feePct : 0,
                    daysBeforeDue: a.daysBeforeDue,
                };
            }),
            athletes,
            methods: tokArr.filter(t => t.status === 'available').map(t => ({
                tokenId: t.id, schoolId: t.school_id, type: t.payment_method_type, label: t.display_label ?? 'Medio de pago',
            })),
        });
    } catch (e: any) {
        req.log?.error({ err: e?.message }, 'autopay /mine falló');
        return res.status(500).json({ error: 'No pudimos cargar tu débito automático.' });
    }
});

router.get('/setup', requireAuth, async (req: Request, res: Response) => {
    const schoolId = String(req.query.schoolId ?? '');
    if (!zUuid.safeParse(schoolId).success) return res.status(400).json({ error: 'schoolId inválido.' });
    if (!(await esFamiliaDeEscuela(req.user.id, schoolId))) return res.status(403).json({ error: 'No perteneces a esta escuela.' });
    const aj = (await ajustesDe([schoolId])).get(schoolId);
    if (!aj?.offered) return res.status(409).json({ error: 'La escuela no ofrece débito automático.', code: 'autopay_not_offered' });

    const creds = await credsDeEscuela(schoolId);
    if (!creds) return res.status(409).json({ error: 'La escuela no tiene pagos en línea disponibles.', code: 'gateway_unavailable' });
    const t = await fetchAcceptanceTokens(creds);
    if (!t.ok) return res.status(502).json({ error: 'No pudimos conectar con la pasarela. Intenta de nuevo.' });
    return res.json({
        publicKey: creds.publicKey,
        sandbox: creds.sandbox,
        acceptance: {
            acceptanceToken: t.tokens.acceptanceToken,
            personalDataAuthToken: t.tokens.personalDataAuthToken,
            acceptancePermalink: t.tokens.acceptancePermalink,
            personalDataPermalink: t.tokens.personalDataPermalink,
        },
    });
});

const TarjetaSchema = z.object({
    schoolId: zUuid,
    cardToken: z.string().regex(/^tok_[A-Za-z0-9_-]{6,120}$/),
    brand: z.string().max(30).optional(),
    lastFour: z.string().regex(/^\d{4}$/).optional(),
    expMonth: z.string().max(2).optional(),
    expYear: z.string().max(4).optional(),
    ...AceptacionSchema,
});

router.post('/cards', requireAuth, async (req: Request, res: Response) => {
    const p = TarjetaSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Datos incompletos.' });
    const b = p.data;
    if (!(await esFamiliaDeEscuela(req.user.id, b.schoolId))) return res.status(403).json({ error: 'No perteneces a esta escuela.' });
    const creds = await credsDeEscuela(b.schoolId);
    if (!creds) return res.status(409).json({ error: 'La escuela no tiene pagos en línea disponibles.', code: 'gateway_unavailable' });

    const [merchantId, email] = await Promise.all([fetchMerchantId(creds), correoDe(req.user.id, req.user.email)]);
    if (!merchantId || !email) return res.status(502).json({ error: 'No pudimos conectar con la pasarela. Intenta de nuevo.' });

    const consentId = await crearConsentimiento(req, b, { kind: 'card' });
    if (!consentId) return res.status(500).json({ error: 'No pudimos guardar tu autorización.' });

    const ps = await createPaymentSource({
        cardToken: b.cardToken, customerEmail: email, type: 'CARD',
        acceptanceToken: b.acceptanceToken, personalDataAuthToken: b.personalDataAuthToken,
    }, creds);
    if (!ps.ok) {
        req.log?.warn({ statusCode: ps.statusCode }, 'autopay: Wompi no creó la fuente de tarjeta');
        return res.status(422).json({ error: 'La pasarela no aceptó la tarjeta. Revisa los datos o usa otra.', code: 'source_rejected' });
    }

    const lastFour = b.lastFour ?? '••••';
    const { data: reg, error } = await supabase.rpc('autopay_register_token', {
        p_user_id: req.user.id, p_school_id: b.schoolId, p_payment_method_type: 'CARD', p_status: 'available',
        p_provider_payment_source_id: ps.paymentSourceId, p_provider_merchant_id: merchantId,
        p_display_label: etiquetaTarjeta(b.brand, lastFour), p_last_four: b.lastFour ?? null, p_brand: b.brand ?? null,
        p_expires_at: vencimientoTarjeta(b.expMonth, b.expYear),
    });
    if (error || !(reg as any)?.ok) {
        req.log?.error({ err: error?.message ?? (reg as any)?.error }, 'autopay: register_token tarjeta falló');
        return res.status(409).json({ error: 'No pudimos guardar la tarjeta.', code: (reg as any)?.error ?? 'register_failed' });
    }
    const tokenId = (reg as any).token_id;
    await supabase.from('payment_consents').update({ payment_token_id: tokenId }).eq('id', consentId);
    return res.status(201).json({ tokenId, consentId, label: etiquetaTarjeta(b.brand, lastFour), status: 'available' });
});

const NequiSchema = z.object({
    schoolId: zUuid,
    phone: z.string().transform(s => s.replace(/\D/g, '')).pipe(z.string().regex(/^3\d{9}$/)),
    ...AceptacionSchema,
});

/** Con el token Nequi aprobado: crea la fuente con la aceptación guardada y deja el medio disponible. */
async function finalizarNequi(tok: any, creds: WompiCreds, userEmail: string | null): Promise<'available' | 'error'> {
    const { data: consent } = await supabase.from('payment_consents')
        .select('acceptance_token, personal_data_auth_token')
        .eq('payment_token_id', tok.id).order('accepted_at', { ascending: false }).limit(1).maybeSingle();
    const [merchantId, email] = await Promise.all([fetchMerchantId(creds), correoDe(tok.user_id, userEmail ?? undefined)]);
    if (!consent || !merchantId || !email) return 'error';

    const ps = await createPaymentSource({
        cardToken: tok.provider_token_id, customerEmail: email, type: 'NEQUI',
        acceptanceToken: (consent as any).acceptance_token, personalDataAuthToken: (consent as any).personal_data_auth_token,
    }, creds);
    if (!ps.ok) {
        // Otra consulta simultánea pudo ganarle (el token de aceptación es de un solo uso).
        const { data: again } = await supabase.from('payment_tokens').select('status').eq('id', tok.id).maybeSingle();
        return (again as any)?.status === 'available' ? 'available' : 'error';
    }
    const { data: r } = await supabase.rpc('autopay_mark_token', {
        p_token_id: tok.id, p_status: 'available', p_provider_payment_source_id: ps.paymentSourceId, p_provider_merchant_id: merchantId,
    });
    return (r as any)?.ok ? 'available' : 'error';
}

router.post('/nequi', requireAuth, async (req: Request, res: Response) => {
    const p = NequiSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Revisa el número: debe ser un celular de 10 dígitos.' });
    const b = p.data;
    const hmacKey = process.env.AUTOPAY_PHONE_HMAC_KEY;
    if (!hmacKey) {
        req.log?.error('autopay: falta AUTOPAY_PHONE_HMAC_KEY');
        return res.status(503).json({ error: 'Nequi no está disponible por ahora. Usa una tarjeta.' });
    }
    if (!(await esFamiliaDeEscuela(req.user.id, b.schoolId))) return res.status(403).json({ error: 'No perteneces a esta escuela.' });
    const creds = await credsDeEscuela(b.schoolId);
    if (!creds) return res.status(409).json({ error: 'La escuela no tiene pagos en línea disponibles.', code: 'gateway_unavailable' });

    const t = await createNequiToken(b.phone, creds);
    if (!t.ok) return res.status(502).json({ error: 'Nequi no respondió. Intenta de nuevo en un momento.' });

    const consentId = await crearConsentimiento(req, b, { kind: 'nequi' });
    if (!consentId) return res.status(500).json({ error: 'No pudimos guardar tu autorización.' });

    const lastFour = b.phone.slice(-4);
    const label = `Nequi •••• ${lastFour}`;
    const { data: reg, error } = await supabase.rpc('autopay_register_token', {
        p_user_id: req.user.id, p_school_id: b.schoolId, p_payment_method_type: 'NEQUI', p_status: 'pending_authorization',
        p_provider_token_id: t.tokenId, p_display_label: label, p_last_four: lastFour, p_phone_hmac: phoneHmac(b.phone, hmacKey),
    });
    if (error || !(reg as any)?.ok) {
        return res.status(409).json({ error: 'No pudimos registrar tu Nequi.', code: (reg as any)?.error ?? 'register_failed' });
    }
    const tokenId = (reg as any).token_id;
    await supabase.from('payment_consents').update({ payment_token_id: tokenId }).eq('id', consentId);

    let status: 'pending_authorization' | 'available' = 'pending_authorization';
    if (t.status === 'APPROVED') {
        const tok = { id: tokenId, user_id: req.user.id, provider_token_id: t.tokenId };
        if ((await finalizarNequi(tok, creds, req.user.email)) === 'available') status = 'available';
    }
    return res.status(201).json({ tokenId, consentId, label, status });
});

router.get('/tokens/:id', requireAuth, async (req: Request, res: Response) => {
    if (!zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido.' });
    const { data: tok } = await supabase.from('payment_tokens')
        .select('id, user_id, school_id, status, payment_method_type, provider_token_id, display_label')
        .eq('id', req.params.id).maybeSingle();
    if (!tok || (tok as any).user_id !== req.user.id) return res.status(404).json({ error: 'No encontrado.' });
    const t = tok as any;

    if (t.status === 'pending_authorization' && t.payment_method_type === 'NEQUI' && t.provider_token_id) {
        const creds = await credsDeEscuela(t.school_id);
        if (creds) {
            const st = await getNequiTokenStatus(t.provider_token_id, creds);
            if (st === 'APPROVED') {
                t.status = await finalizarNequi(t, creds, req.user.email);
                if (t.status === 'error') await supabase.rpc('autopay_mark_token', { p_token_id: t.id, p_status: 'error' });
            } else if (st === 'DECLINED' || st === 'ERROR') {
                const nuevo = st === 'DECLINED' ? 'declined' : 'error';
                await supabase.rpc('autopay_mark_token', { p_token_id: t.id, p_status: nuevo });
                t.status = nuevo;
            }
        }
    }
    return res.json({ status: t.status, label: t.display_label ?? 'Medio de pago' });
});

const AltaSchema = z.object({
    schoolId: zUuid,
    tokenId: zUuid,
    consentId: z.union([zUuid, z.literal('reuse')]),
    includeCurrentPeriod: z.boolean().default(false),
    athletes: z.array(z.object({
        childId: zUuid.optional(),
        athleteUserId: zUuid.optional(),
        maxAmount: z.number().positive().max(100_000_000),
    }).refine(a => !!a.childId !== !!a.athleteUserId)).min(1).max(10),
});

router.post('/subscriptions', requireAuth, async (req: Request, res: Response) => {
    const p = AltaSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Datos incompletos.' });
    const b = p.data;

    let consentId = b.consentId;
    if (consentId === 'reuse') {
        const { data: c } = await supabase.from('payment_consents').select('id')
            .eq('user_id', req.user.id).eq('payment_token_id', b.tokenId)
            .order('accepted_at', { ascending: false }).limit(1).maybeSingle();
        if (!c) return res.status(409).json({ error: 'Vuelve a autorizar el medio de pago.', code: 'consent_not_found' });
        consentId = (c as any).id;
    }

    const results = [];
    for (const a of b.athletes) {
        const { data, error } = await supabase.rpc('autopay_create_subscription', {
            p_user_id: req.user.id, p_school_id: b.schoolId,
            p_child_id: a.childId ?? null, p_athlete_user_id: a.athleteUserId ?? null,
            p_token_id: b.tokenId, p_max_amount: a.maxAmount, p_consent_id: consentId,
            p_include_current_period: b.includeCurrentPeriod,
        });
        const key = a.childId ? `child:${a.childId}` : `user:${a.athleteUserId}`;
        if (error) results.push({ key, ok: false, error: 'internal_error' });
        else if (!(data as any)?.ok) results.push({ key, ok: false, error: (data as any)?.error });
        else results.push({ key, ok: true, subscriptionId: (data as any).subscription_id });
    }

    if (results.some(r => r.ok)) {
        const { data: tok } = await supabase.from('payment_tokens').select('display_label').eq('id', b.tokenId).maybeSingle();
        const { data: school } = await supabase.from('schools').select('owner_id, name').eq('id', b.schoolId).maybeSingle();
        await avisar(req.user.id, b.schoolId, 'Débito automático activo',
            `Listo. Cada mes te avisaremos cuánto y cuándo debitaremos la mensualidad de tu ${(tok as any)?.display_label ?? 'medio de pago'}. Puedes cancelarlo cuando quieras en Mis Pagos.`,
            '/my-payments#debito', { kind: 'autopay_activated' });
        await avisar((school as any)?.owner_id ?? null, b.schoolId, 'Nueva familia con débito automático',
            `Una familia activó el débito automático (${results.filter(r => r.ok).length} deportista(s)).`,
            '/payments-automation', { kind: 'autopay_activated' });
    }
    return res.status(results.some(r => r.ok) ? 201 : 409).json({ results });
});

const CambioSchema = z.object({
    maxAmount: z.number().positive().max(100_000_000).optional(),
    tokenId: zUuid.optional(),
}).refine(x => x.maxAmount != null || x.tokenId != null);

const ERRORES_CAMBIO: Record<string, string> = {
    suspended_duplicate_charge: 'Tu débito está pausado por un pago doble. La escuela lo reactiva cuando lo resuelva.',
    token_not_available: 'Ese medio de pago todavía no está listo.',
    cancelled: 'Este débito ya fue cancelado.',
};

router.patch('/subscriptions/:id', requireAuth, async (req: Request, res: Response) => {
    const p = CambioSchema.safeParse(req.body);
    if (!p.success || !zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'Datos incompletos.' });
    const { data, error } = await supabase.rpc('autopay_update_subscription', {
        p_user_id: req.user.id, p_subscription_id: req.params.id,
        p_max_amount: p.data.maxAmount ?? null, p_token_id: p.data.tokenId ?? null,
    });
    if (error) return res.status(500).json({ error: 'No pudimos guardar el cambio.' });
    const r = data as any;
    if (!r?.ok) {
        const status = r?.error === 'forbidden' || r?.error === 'not_found' ? 404 : 409;
        return res.status(status).json({ error: ERRORES_CAMBIO[r?.error] ?? 'No pudimos guardar el cambio.', code: r?.error });
    }
    return res.json({ ok: true, reactivated: !!r.reactivated });
});

/** D13: la fuente se anula en Wompi solo si ninguna otra suscripción viva la usa. */
async function anularFuenteSiSobra(r: any, log?: Request['log']) {
    if (!r?.token_unused || !r?.token_id) return;
    const { data: tok } = await supabase.from('payment_tokens')
        .select('id, school_id, status, provider_payment_source_id').eq('id', r.token_id).maybeSingle();
    const t = tok as any;
    if (!t || t.status !== 'available') return;
    const creds = t.provider_payment_source_id ? await credsDeEscuela(t.school_id) : null;
    if (creds) {
        const v = await voidPaymentSource(Number(t.provider_payment_source_id), creds);
        if (!v.ok) log?.warn({ tokenId: t.id }, 'autopay: Wompi no anuló la fuente (se marca anulada igual)');
    }
    await supabase.rpc('autopay_mark_token', { p_token_id: t.id, p_status: 'voided' });
}

router.post('/subscriptions/:id/cancel', requireAuth, async (req: Request, res: Response) => {
    if (!zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido.' });
    const { data, error } = await supabase.rpc('autopay_cancel_subscription', {
        p_actor_id: req.user.id, p_subscription_id: req.params.id, p_reason: 'parent',
    });
    if (error) return res.status(500).json({ error: 'No pudimos cancelar el débito.' });
    const r = data as any;
    if (!r?.ok) return res.status(404).json({ error: 'No encontrado.' });
    await anularFuenteSiSobra(r, req.log);

    const { data: sub } = await supabase.from('recurring_subscriptions').select('school_id').eq('id', req.params.id).maybeSingle();
    if (sub) {
        const { data: school } = await supabase.from('schools').select('owner_id').eq('id', (sub as any).school_id).maybeSingle();
        await avisar((school as any)?.owner_id ?? null, (sub as any).school_id, 'Una familia canceló el débito automático',
            'Una familia canceló su débito automático. Sus mensualidades siguen pendientes como cualquier cobro.',
            '/payments-automation', { kind: 'autopay_cancelled' });
    }
    return res.json({ ok: true });
});

router.post('/cycles/:id/skip', requireAuth, async (req: Request, res: Response) => {
    if (!zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido.' });
    const { data, error } = await supabase.rpc('autopay_parent_skip', { p_user_id: req.user.id, p_cycle_id: req.params.id });
    if (error) return res.status(500).json({ error: 'No pudimos registrar tu aviso.' });
    const r = data as any;
    if (!r?.ok) {
        if (r?.error === 'cycle_not_skippable') {
            return res.status(409).json({ error: 'Este débito ya está en proceso o terminó; ya no se puede omitir.', code: r.error });
        }
        return res.status(404).json({ error: 'No encontrado.' });
    }

    // Avisar a la escuela para que concilie (D8).
    const { data: c } = await supabase.from('autopay_cycles')
        .select('school_id, payment_id, payments(period_month, child_id), recurring_subscriptions(child_id, athlete_user_id)')
        .eq('id', req.params.id).maybeSingle();
    const ciclo = c as any;
    if (ciclo) {
        const { data: school } = await supabase.from('schools').select('owner_id').eq('id', ciclo.school_id).maybeSingle();
        let nombre = 'una familia';
        const childId = ciclo.recurring_subscriptions?.child_id;
        if (childId) {
            const { data: ch } = await supabase.from('children').select('full_name').eq('id', childId).maybeSingle();
            nombre = `la familia de ${String((ch as any)?.full_name ?? '').split(' ')[0] || 'un deportista'}`;
        }
        await avisar((school as any)?.owner_id ?? null, ciclo.school_id, 'Una familia dice que ya pagó',
            `${nombre[0].toUpperCase()}${nombre.slice(1)} dice que ya pagó ${nombreMes(ciclo.payments?.period_month)}. Revisa y registra el pago; no lo debitaremos.`,
            '/payments-automation', { kind: 'autopay_parent_skip', payment_id: ciclo.payment_id });
    }
    return res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ESCUELA
// ═══════════════════════════════════════════════════════════════════════════════

/** Mismo alcance que user_admin_school_ids() (la RPC lo evalúa para el actor). */
async function esAdminDe(userId: string, schoolId: string): Promise<boolean> {
    const { data } = await supabase.rpc('autopay_admin_school_ids_for', { p_user: userId });
    return Array.isArray(data) && (data as string[]).includes(schoolId);
}

function schoolGuard() {
    return async (req: Request, res: Response, next: () => void) => {
        const schoolId = String(req.params.schoolId ?? '');
        if (!zUuid.safeParse(schoolId).success) return res.status(400).json({ error: 'schoolId inválido.' });
        if (!(await esAdminDe(req.user.id, schoolId))) return res.status(403).json({ error: 'Solo la administración de la escuela.' });
        next();
    };
}

router.get('/school/:schoolId/panel', requireAuth, schoolGuard(), async (req: Request, res: Response) => {
    try {
        const schoolId = String(req.params.schoolId);
        const hoy = hoyBogota();
        const anio = Number(hoy.slice(0, 4));
        const mes = Number(hoy.slice(5, 7));
        const aj = (await ajustesDe([schoolId])).get(schoolId);
        const gatewayReady = !!(await credsDeEscuela(schoolId));

        const { data: subs } = await supabase.from('recurring_subscriptions')
            .select('id, payer_user_id, child_id, athlete_user_id, status, suspend_reason, max_amount, payment_token_id')
            .eq('school_id', schoolId).neq('status', 'cancelled');
        const subsArr = (subs as any[]) ?? [];
        const subIds = subsArr.map(s => s.id);

        const [{ data: ciclos }, { data: incidentes }, { data: mensualidades }, { data: tokens }] = await Promise.all([
            subIds.length
                ? supabase.from('autopay_cycles')
                    .select('id, subscription_id, payment_id, state, skip_reason, hold_reason, next_attempt_on, announced_total, attempts_used, updated_at, payments!inner(period_year, period_month, status)')
                    .eq('school_id', schoolId).eq('payments.period_year', anio).eq('payments.period_month', mes)
                : Promise.resolve({ data: [] as any[] }),
            supabase.from('autopay_incidents')
                .select('id, kind, state, payment_id, subscription_id, amount, provider_transaction_id, created_at')
                .eq('school_id', schoolId).in('state', ['open', 'refund_requested']).order('created_at', { ascending: false }),
            supabase.from('payments').select('id', { count: 'exact', head: false })
                .eq('school_id', schoolId).eq('payment_category', 'mensualidad')
                .eq('period_year', anio).eq('period_month', mes).neq('status', 'cancelled'),
            subsArr.length
                ? supabase.from('payment_tokens').select('id, display_label').in('id', [...new Set(subsArr.map(s => s.payment_token_id))])
                : Promise.resolve({ data: [] as any[] }),
        ]);

        // Nombres.
        const childIds = subsArr.map(s => s.child_id).filter(Boolean);
        const userIds = [...new Set([...subsArr.map(s => s.payer_user_id), ...subsArr.map(s => s.athlete_user_id).filter(Boolean)])];
        const [{ data: hijos }, { data: perfiles }] = await Promise.all([
            childIds.length ? supabase.from('children').select('id, full_name').in('id', childIds) : Promise.resolve({ data: [] as any[] }),
            userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] as any[] }),
        ]);
        const nHijo = new Map(((hijos as any[]) ?? []).map(h => [h.id, h.full_name]));
        const nPerfil = new Map(((perfiles as any[]) ?? []).map(p => [p.id, p.full_name]));
        const nToken = new Map(((tokens as any[]) ?? []).map(t => [t.id, t.display_label]));
        const nombreAtleta = (s: any) => (s.child_id ? nHijo.get(s.child_id) : nPerfil.get(s.athlete_user_id)) ?? 'Deportista';
        const subPorId = new Map(subsArr.map(s => [s.id, s]));

        const ciclosArr = (ciclos as any[]) ?? [];
        const cuenta = { paid: 0, noticed: 0, inProgress: 0, paidElsewhere: 0, noDebit: 0, scheduled: 0 };
        let debitado = 0;
        for (const c of ciclosArr) {
            if (c.state === 'paid') { cuenta.paid++; debitado += Number(c.announced_total ?? 0); }
            else if (c.state === 'noticed') cuenta.noticed++;
            else if (c.state === 'in_progress') cuenta.inProgress++;
            else if (c.state === 'scheduled') cuenta.scheduled++;
            else if (c.state === 'skipped' && ['paid_elsewhere', 'parent_skip'].includes(c.skip_reason)) cuenta.paidElsewhere++;
            else if (['skipped', 'exhausted'].includes(c.state)) cuenta.noDebit++;
        }
        const totalMensualidades = ((mensualidades as any[]) ?? []).length;

        return res.json({
            settings: { offered: aj.offered, paused: aj.paused, surchargeMode: aj.surchargeMode, daysBeforeDue: aj.daysBeforeDue },
            gatewayReady,
            kpis: {
                active: subsArr.filter(s => s.status === 'active').length,
                suspended: subsArr.filter(s => s.status === 'suspended').length,
                cycles: cuenta,
                debitedThisMonth: debitado,
                pctByDebit: totalMensualidades ? Math.round((cuenta.paid / totalMensualidades) * 100) : 0,
            },
            rows: subsArr.map(s => {
                const c = ciclosArr.find(x => x.subscription_id === s.id);
                return {
                    subscriptionId: s.id,
                    athleteName: nombreAtleta(s),
                    payerName: nPerfil.get(s.payer_user_id) ?? 'Acudiente',
                    method: nToken.get(s.payment_token_id) ?? 'Medio de pago',
                    status: s.status, suspendReason: s.suspend_reason, maxAmount: Number(s.max_amount),
                    cycle: c ? {
                        cycleId: c.id, paymentId: c.payment_id, state: c.state, skipReason: c.skip_reason, holdReason: c.hold_reason,
                        nextAttemptOn: c.next_attempt_on, announcedTotal: c.announced_total != null ? Number(c.announced_total) : null,
                        attemptsUsed: c.attempts_used,
                    } : null,
                };
            }),
            incidents: ((incidentes as any[]) ?? []).map(i => ({
                id: i.id, kind: i.kind, state: i.state, paymentId: i.payment_id,
                athleteName: i.subscription_id && subPorId.get(i.subscription_id) ? nombreAtleta(subPorId.get(i.subscription_id)) : null,
                amount: i.amount != null ? Number(i.amount) : null,
                providerTransactionId: i.provider_transaction_id, createdAt: i.created_at,
            })),
            parentSkips: ciclosArr
                .filter(c => c.state === 'skipped' && c.skip_reason === 'parent_skip' && c.payments?.status === 'pending')
                .map(c => ({
                    cycleId: c.id, paymentId: c.payment_id, periodMonth: c.payments?.period_month,
                    athleteName: subPorId.get(c.subscription_id) ? nombreAtleta(subPorId.get(c.subscription_id)) : 'Deportista',
                    reportedAt: c.updated_at,
                })),
        });
    } catch (e: any) {
        req.log?.error({ err: e?.message }, 'autopay panel falló');
        return res.status(500).json({ error: 'No pudimos cargar el panel.' });
    }
});

const AjustesSchema = z.object({
    offered: z.boolean(),
    paused: z.boolean(),
    surchargeMode: z.enum(['same_as_online', 'none']),
    daysBeforeDue: z.number().int().min(0).max(10),
});

router.post('/school/:schoolId/settings', requireAuth, schoolGuard(), async (req: Request, res: Response) => {
    const p = AjustesSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Datos inválidos.' });
    const schoolId = String(req.params.schoolId);
    const b = p.data;
    const antes = (await ajustesDe([schoolId])).get(schoolId);
    if (b.offered && !antes.offered && !(await credsDeEscuela(schoolId))) {
        return res.status(409).json({ error: 'Conecta primero tu cuenta Wompi en SportMaps Pay.', code: 'gateway_unavailable' });
    }
    const { error } = await supabase.from('school_settings').update({
        autopay_enabled: b.offered,
        autopay_debits_paused: b.paused,
        autopay_surcharge_mode: b.surchargeMode,
        autopay_days_before_due: b.daysBeforeDue,
        updated_at: new Date().toISOString(),
    }).eq('school_id', schoolId);
    if (error) return res.status(500).json({ error: 'No pudimos guardar los ajustes.' });

    // D10: pausar avisa a las familias con débito activo.
    let notified = 0;
    if (b.paused && !antes.paused) {
        const { data: subs } = await supabase.from('recurring_subscriptions')
            .select('payer_user_id').eq('school_id', schoolId).eq('status', 'active');
        const pagadores = [...new Set(((subs as any[]) ?? []).map(s => s.payer_user_id))];
        for (const u of pagadores) {
            await avisar(u, schoolId, 'Débitos automáticos en pausa',
                `${antes.name} pausó los débitos automáticos por ahora. Este mes paga desde Mis Pagos.`,
                '/my-payments', { kind: 'autopay_paused' });
        }
        notified = pagadores.length;
    }
    return res.json({ ok: true, notified });
});

router.post('/school/:schoolId/subscriptions/:id/cancel', requireAuth, schoolGuard(), async (req: Request, res: Response) => {
    if (!zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'id inválido.' });
    const { data: sub } = await supabase.from('recurring_subscriptions').select('school_id, payer_user_id')
        .eq('id', req.params.id).maybeSingle();
    if (!sub || (sub as any).school_id !== req.params.schoolId) return res.status(404).json({ error: 'No encontrado.' });

    const { data, error } = await supabase.rpc('autopay_cancel_subscription', {
        p_actor_id: req.user.id, p_subscription_id: req.params.id, p_reason: 'school',
    });
    if (error || !(data as any)?.ok) return res.status(403).json({ error: 'No pudimos cancelar el débito.' });
    await anularFuenteSiSobra(data, req.log);
    await avisar((sub as any).payer_user_id, String(req.params.schoolId), 'La escuela canceló tu débito automático',
        'La escuela canceló tu débito automático. Tus mensualidades siguen en Mis Pagos para pagarlas como siempre.',
        '/my-payments', { kind: 'autopay_cancelled_by_school' });
    return res.json({ ok: true });
});

const ResolverSchema = z.object({
    state: z.enum(['refund_requested', 'refunded', 'credited', 'dismissed']),
    note: z.string().max(500).optional(),
});

router.post('/school/:schoolId/incidents/:id/resolve', requireAuth, schoolGuard(), async (req: Request, res: Response) => {
    const p = ResolverSchema.safeParse(req.body);
    if (!p.success || !zUuid.safeParse(req.params.id).success) return res.status(400).json({ error: 'Datos inválidos.' });
    const { data, error } = await supabase.rpc('autopay_resolve_incident', {
        p_actor_id: req.user.id, p_incident_id: req.params.id, p_state: p.data.state, p_note: p.data.note ?? null,
    });
    if (error) return res.status(500).json({ error: 'No pudimos guardar el cambio.' });
    const r = data as any;
    if (!r?.ok) return res.status(r?.error === 'forbidden' ? 403 : 409).json({ error: 'No pudimos guardar el cambio.', code: r?.error });
    return res.json({ ok: true });
});

export default router;
