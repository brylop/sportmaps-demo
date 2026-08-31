import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';
import { BrandedEmailTemplates } from '../utils/emailTemplates';

const router = Router();

// ── Rate limiting propio de este router ────────────────────────────────────
const otpStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `otp-start-${req.ip}`,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

const OTP_TTL_MIN = 10;
const MAX_OTP_PER_EMAIL_WINDOW = 3;
const OTP_EMAIL_WINDOW_MIN = 10;

// PUBLIC_BOOKING_DEBUG_OTP=true devuelve el código en la respuesta (para no
// tener que leer el correo en desarrollo local). ANTES esto se gateaba con
// `NODE_ENV !== 'production'` — roto en este repo porque render.yaml
// despliega sportmaps-bff-dev y sportmaps-bff-stg como servicios PÚBLICOS
// con NODE_ENV=development/staging, y los tres ambientes (dev/stg/prod)
// apuntan a LA MISMA Supabase — el bypass de OTP quedaba vivo contra datos
// reales en dos de los tres BFFs. Este flag no se declara en render.yaml
// para ningún servicio: por ausencia queda apagado en todo lo desplegado,
// y solo se prende a mano en un .env local.
const DEBUG_OTP_ENABLED = process.env.PUBLIC_BOOKING_DEBUG_OTP === 'true';

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

// ── GET /schools/:slug — info pública de la escuela para el link ───────────
router.get('/schools/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, slug')
      .eq('slug', slug)
      .maybeSingle();

    if (!school) return res.status(404).json({ error: 'Escuela no encontrada.' });

    const { data: facilities } = await supabase
      .from('facilities')
      .select('id, name, type, capacity')
      .eq('school_id', school.id)
      .eq('status', 'available')
      .eq('booking_enabled', true)
      .order('name');

    const { data: courtesy } = await supabase
      .from('school_courtesy_settings')
      .select('enabled')
      .eq('school_id', school.id)
      .maybeSingle();

    // Clases de prueba (trial_class_categories) — link nuevo y separado de
    // instalaciones/cortesía (ver 20260829115629). Aditivo: no cambia nada
    // de lo que ya devolvía este endpoint.
    const { data: trialSettings } = await supabase
      .from('school_trial_class_settings')
      .select('enabled, self_service_enabled')
      .eq('school_id', school.id)
      .maybeSingle();

    let trialCategories: any[] = [];
    if (trialSettings?.enabled && trialSettings?.self_service_enabled) {
      const { data: categories } = await supabase
        .from('trial_class_categories')
        .select('id, name, description, price, allow_repeat, repeat_price')
        .eq('school_id', school.id)
        .eq('is_active', true)
        .order('name');
      trialCategories = categories || [];
    }

    return res.json({
      school: { id: school.id, name: school.name },
      facilities: facilities || [],
      courtesy_available: courtesy?.enabled ?? false,
      trial_classes_available: trialCategories.length > 0,
      trial_categories: trialCategories,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking schools/:slug error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /start-verification — resuelve correo y manda OTP ─────────────────
// Se identifica por CORREO (no por teléfono): el usuario provee su propio
// dato, así que confirmar "ya existe una cuenta con este correo" no revela
// nada que no supiera de antemano — a diferencia de teléfono, que permitía
// escribir un número ajeno y recibir de vuelta el correo de esa cuenta.
router.post('/start-verification', otpStartLimiter, async (req: Request, res: Response) => {
  try {
    const { school_id, email, full_name } = req.body as {
      school_id: string; email: string; full_name?: string;
    };
    if (!school_id || !email) return res.status(400).json({ error: 'school_id y email son requeridos.' });

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Correo inválido.' });

    // Anti-flood por correo específico (además del rate-limit por IP)
    const windowStart = new Date(Date.now() - OTP_EMAIL_WINDOW_MIN * 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('public_booking_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school_id)
      .eq('resolved_email', cleanEmail)
      .gte('created_at', windowStart);

    if ((recentCount ?? 0) >= MAX_OTP_PER_EMAIL_WINDOW) {
      return res.status(429).json({ error: 'Demasiados códigos solicitados para este correo. Espera unos minutos.' });
    }

    // ── Escenario 3: ya tiene cuenta con este correo ────────────────────────
    // Seguro de confirmar sin OTP: el usuario escribió su propio correo, no
    // uno ajeno — no hay nada nuevo que se le esté revelando.
    const { data: profileMatch } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (profileMatch) {
      return res.json({
        scenario: 'already_registered',
        email: cleanEmail,
        message: 'Ya tienes una cuenta registrada. Por seguridad, debes iniciar sesión con tu correo y contraseña.',
      });
    }

    // ── Escenario 2: coincide con unregistered_athlete con enrollment activo ──
    const { data: unregMatch } = await supabase
      .from('unregistered_athletes')
      .select('id, full_name')
      .eq('school_id', school_id)
      .eq('email', cleanEmail)
      .maybeSingle();

    if (unregMatch) {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('school_id', school_id)
        .eq('unregistered_athlete_id', unregMatch.id)
        .eq('status', 'active')
        .maybeSingle();

      if (enrollment) {
        const code = generateCode();
        const { data: verif, error } = await supabase
          .from('public_booking_verifications')
          .insert({
            school_id,
            otp_hash: hashOtp(code),
            resolved_email: cleanEmail,
            resolved_kind: 'enrolled_unregistered',
            resolved_unregistered_id: unregMatch.id,
            resolved_enrollment_id: enrollment.id,
            full_name: unregMatch.full_name,
            expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
          })
          .select('id').single();
        if (error) throw error;

        await emailClient.send({
          to: cleanEmail,
          subject: 'Tu código para agendar en SportMaps',
          html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
          text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
        });

        return res.json({
          verification_id: verif.id,
          scenario: 'enrolled_unregistered',
          masked_email: maskEmail(cleanEmail),
          ...(DEBUG_OTP_ENABLED ? { debug_code: code } : {}),
        });
      }
    }

    // ── Escenario 1: nuevo — requiere nombre explícito ──────────────────────
    if (!full_name || !full_name.trim()) {
      return res.json({ scenario: 'new_needs_name' });
    }

    const { data: courtesySettings } = await supabase
      .from('school_courtesy_settings')
      .select('enabled')
      .eq('school_id', school_id)
      .maybeSingle();

    if (!courtesySettings?.enabled) {
      return res.status(422).json({
        error: 'No encontramos tu correo en nuestros registros y esta escuela no tiene clases de cortesía activas.',
        reason: 'no_courtesy',
      });
    }

    // Anti-abuso: ¿algún unregistered_athlete con este correo ya reclamó cortesía?
    const { data: priorClaim } = await supabase
      .from('unregistered_athletes')
      .select('id')
      .eq('school_id', school_id)
      .eq('email', cleanEmail)
      .maybeSingle();

    if (priorClaim) {
      const { data: priorEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('unregistered_athlete_id', priorClaim.id)
        .maybeSingle();
      if (priorEnrollment) {
        return res.status(422).json({
          error: 'Ya se reclamó una clase de cortesía con estos datos en esta escuela.',
          reason: 'courtesy_already_claimed',
        });
      }
    }

    const code = generateCode();
    const { data: verif, error } = await supabase
      .from('public_booking_verifications')
      .insert({
        school_id,
        otp_hash: hashOtp(code),
        resolved_email: cleanEmail,
        resolved_kind: 'new',
        full_name: full_name.trim(),
        expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
      })
      .select('id').single();
    if (error) throw error;

    await emailClient.send({
      to: cleanEmail,
      subject: 'Tu código para agendar tu clase de cortesía',
      html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
      text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
    });

    return res.json({
      verification_id: verif.id,
      scenario: 'new',
      masked_email: maskEmail(cleanEmail),
      ...(DEBUG_OTP_ENABLED ? { debug_code: code } : {}),
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking start-verification error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /verify-otp ────────────────────────────────────────────────────────
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { verification_id, code } = req.body as { verification_id: string; code: string };
    if (!verification_id || !code) return res.status(400).json({ error: 'verification_id y code son requeridos.' });

    const { data: verif } = await supabase
      .from('public_booking_verifications')
      .select('*')
      .eq('id', verification_id)
      .maybeSingle();

    if (!verif) return res.status(404).json({ error: 'Verificación no encontrada.' });
    if (verif.verified_at) return res.status(400).json({ error: 'Este código ya fue usado.' });
    if (new Date(verif.expires_at) < new Date()) {
      return res.status(400).json({ error: 'El código expiró. Solicita uno nuevo.', reason: 'expired' });
    }
    if (verif.attempts >= 5) {
      return res.status(400).json({ error: 'Demasiados intentos. Solicita un código nuevo.', reason: 'too_many_attempts' });
    }

    if (hashOtp(code) !== verif.otp_hash) {
      await supabase.from('public_booking_verifications')
        .update({ attempts: verif.attempts + 1 })
        .eq('id', verification_id);
      return res.status(400).json({
        error: 'Código incorrecto.',
        reason: 'wrong_code',
        attempts_left: Math.max(0, 4 - verif.attempts),
      });
    }

    // ── Escenario 3 (registrado): generar magic link, no booking_token ─────
    if (verif.resolved_kind === 'registered') {
      await supabase.from('public_booking_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', verification_id);

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: verif.resolved_email!,
        options: { redirectTo: `${process.env.FRONTEND_URL || 'https://app.sportmaps.co'}/enrollments` },
      });

      if (linkErr || !linkData) {
        req.log?.error({ linkErr }, 'generateLink failed');
        return res.status(500).json({ error: 'No se pudo generar el acceso. Intenta iniciar sesión manualmente.' });
      }

      return res.json({
        scenario: 'registered',
        magic_link: linkData.properties?.action_link,
      });
    }

    // ── Escenario 1 y 2: booking_token de un solo uso ───────────────────────
    const bookingToken = crypto.randomBytes(24).toString('hex');
    await supabase.from('public_booking_verifications')
      .update({ verified_at: new Date().toISOString(), booking_token: bookingToken })
      .eq('id', verification_id);

    let resolvedName = verif.full_name || '';
    if (verif.resolved_unregistered_id) {
      const { data: unreg } = await supabase
        .from('unregistered_athletes')
        .select('full_name')
        .eq('id', verif.resolved_unregistered_id)
        .maybeSingle();
      if (unreg) resolvedName = unreg.full_name;
    }

    return res.json({
      scenario: verif.resolved_kind,
      booking_token: bookingToken,
      email: verif.resolved_email,
      fullName: resolvedName,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking verify-otp error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── Helper: resolver verificación por token, validando uso único ───────────
async function resolveByToken(token: string) {
  const { data: verif } = await supabase
    .from('public_booking_verifications')
    .select('*')
    .eq('booking_token', token)
    .maybeSingle();
  if (!verif) return { error: 'Token inválido.', status: 404 };
  if (!verif.verified_at) return { error: 'Token no verificado.', status: 400 };
  if (new Date(verif.expires_at).getTime() + 30 * 60_000 < Date.now()) {
    return { error: 'El token expiró. Vuelve a verificarte.', status: 400 };
  }
  return { verif };
}

// ── GET /slots — reusa la generación de disponibilidad de instalación ──────
router.get('/slots', async (req: Request, res: Response) => {
  try {
    const { token, facility_id, school_id: schoolIdParam } = req.query as {
      token?: string; facility_id: string; school_id?: string;
    };
    if (!facility_id) return res.status(400).json({ error: 'facility_id es requerido.' });

    let schoolId: string;
    if (token) {
      const resolved = await resolveByToken(token);
      if ('error' in resolved) return res.status(resolved.status!).json({ error: resolved.error });
      schoolId = resolved.verif.school_id;
    } else if (schoolIdParam) {
      schoolId = schoolIdParam;
    } else {
      return res.status(400).json({ error: 'token o school_id son requeridos.' });
    }

    const { data: facility } = await supabase
      .from('facilities')
      .select('id, name, school_id, min_booking_advance_hours')
      .eq('id', facility_id)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (!facility) return res.status(404).json({ error: 'Instalación no encontrada.' });

    const { data: availData } = await supabase
      .from('facility_availability')
      .select('id, day_of_week, start_time, end_time, max_group_capacity')
      .eq('facility_id', facility_id);

    const today = todayStr();
    const [year, month, day] = today.split('-').map(Number);
    const DAYS_AHEAD = 14;
    const nowMs = Date.now();
    const advanceMs = (facility.min_booking_advance_hours ?? 0) * 60 * 60 * 1000;

    const { data: existingSessions } = await supabase
      .from('attendance_sessions')
      .select('facility_availability_id, session_date, current_bookings, max_capacity')
      .eq('facility_id', facility_id)
      .gte('session_date', today);

    const capMap: Record<string, { current: number; max: number | null }> = {};
    (existingSessions || []).forEach((s: any) => {
      if (!s.facility_availability_id) return;
      capMap[`${s.facility_availability_id}_${s.session_date}`] = { current: s.current_bookings ?? 0, max: s.max_capacity };
    });

    const slots: any[] = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(Date.UTC(year, month - 1, day + i));
      const dateStr = d.toISOString().split('T')[0];
      const dbDay = d.getUTCDay();
      if (dateStr < today) continue;

      for (const avail of (availData || []).filter((a: any) => a.day_of_week === dbDay)) {
        const slotStart = avail.start_time.substring(0, 5);
        const slotMs = new Date(`${dateStr}T${avail.start_time.substring(0, 8)}-05:00`).getTime();
        if (slotMs - nowMs < advanceMs) continue;

        const key = `${avail.id}_${dateStr}`;
        const cap = capMap[key];
        const current = cap?.current ?? 0;
        const max = cap?.max ?? avail.max_group_capacity ?? 10;

        slots.push({
          facility_availability_id: avail.id,
          date: dateStr,
          start_time: `${slotStart}:00`,
          end_time: avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time,
          available_spots: Math.max(0, max - current),
          is_full: current >= max,
        });
      }
    }

    return res.json({ facility: { id: facility.id, name: facility.name }, slots });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking slots error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /confirm — reserva final (Escenarios 1 y 2 únicamente) ────────────
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { token, facility_availability_id, date } = req.body as {
      token: string; facility_availability_id: string; date: string;
    };
    if (!token || !facility_availability_id || !date) {
      return res.status(400).json({ error: 'token, facility_availability_id y date son requeridos.' });
    }

    const resolved = await resolveByToken(token);
    if ('error' in resolved) return res.status(resolved.status!).json({ error: resolved.error });
    const { verif } = resolved;

    if (verif.booking_token_used_at) {
      return res.status(400).json({ error: 'Este token ya fue usado para agendar. Verifícate de nuevo.' });
    }

    const { data: avail } = await supabase
      .from('facility_availability')
      .select('facility_id, school_id, start_time, end_time, max_group_capacity, facility:facilities(name, min_booking_advance_hours)')
      .eq('id', facility_availability_id)
      .maybeSingle();
    if (!avail) return res.status(404).json({ error: 'Disponibilidad no encontrada.' });
    if (avail.school_id !== verif.school_id) return res.status(403).json({ error: 'No autorizado.' });

    // Revalidar ventana de anticipación en servidor
    const advanceHours = (avail as any).facility?.min_booking_advance_hours ?? 0;
    const slotMs = new Date(`${date}T${avail.start_time.substring(0, 8)}-05:00`).getTime();
    const hoursUntil = (slotMs - Date.now()) / 3_600_000;
    if (hoursUntil < advanceHours) {
      return res.status(400).json({ error: `Este horario requiere ${advanceHours}h de anticipación.`, reason: 'outside_booking_advance_window' });
    }

    // ── Resolver enrollment_id + child_id/user_id según escenario ──────────
    let enrollmentId: string;
    let childId: string | null = null;
    let unregisteredAthleteId: string | null = null;

    if (verif.resolved_kind === 'enrolled_unregistered') {
      if (!verif.resolved_enrollment_id) return res.status(422).json({ error: 'No se encontró tu inscripción.' });
      enrollmentId = verif.resolved_enrollment_id;
      unregisteredAthleteId = verif.resolved_unregistered_id;

      // El trigger de BD (fn_process_session_booking) NO valida esto porque
      // session_bookings.enrollment_id queda NULL para no-registrados.
      // Hay que replicar aquí la misma validación que el trigger hace para
      // reservas normales: plan activo, no vencido, con crédito disponible.
      const { data: enr } = await supabase
        .from('enrollments')
        .select('status, expires_at, sessions_used, offering_plans!enrollments_offering_plan_id_fkey(max_sessions)')
        .eq('id', enrollmentId)
        .single();

      if (!enr || enr.status !== 'active') {
        return res.status(422).json({ error: 'Tu inscripción no está activa.', reason: 'enrollment_not_active' });
      }
      if (enr.expires_at && enr.expires_at < todayStr()) {
        return res.status(422).json({ error: `Tu plan venció el ${enr.expires_at}.`, reason: 'plan_expired' });
      }
      const maxSess = (enr as any).offering_plans?.max_sessions;
      if (maxSess !== null && maxSess !== undefined && (enr.sessions_used ?? 0) >= maxSess) {
        return res.status(422).json({ error: 'Ya no tienes clases disponibles en tu plan.', reason: 'no_credits' });
      }
    } else if (verif.resolved_kind === 'new') {
      // Crear unregistered_athlete + enrollment de cortesía (idempotente por verification_id)
      const { data: courtesySettings } = await supabase
        .from('school_courtesy_settings')
        .select('*')
        .eq('school_id', verif.school_id)
        .maybeSingle();
      if (!courtesySettings?.enabled) return res.status(422).json({ error: 'Cortesía no disponible.' });

      let planId = courtesySettings.courtesy_offering_plan_id;
      if (!planId) {
        // Crear offering + plan de cortesía, una sola vez por escuela (lazy init)
        const { data: offering, error: offErr } = await supabase
          .from('offerings')
          .insert({ school_id: verif.school_id, name: 'Clases de Cortesía', offering_type: 'single_session', is_active: true })
          .select('id').single();
        if (offErr) throw offErr;

        const { data: plan, error: planErr } = await supabase
          .from('offering_plans')
          .insert({ offering_id: offering.id, school_id: verif.school_id, name: 'Cortesía (1 clase)', max_sessions: 1, price: 0, is_active: true })
          .select('id').single();
        if (planErr) throw planErr;

        planId = plan.id;
        await supabase.from('school_courtesy_settings')
          .update({ courtesy_offering_plan_id: planId })
          .eq('school_id', verif.school_id);
      }

      const { data: guest, error: guestErr } = await supabase
        .from('unregistered_athletes')
        .insert({ school_id: verif.school_id, full_name: verif.full_name, email: verif.resolved_email })
        .select('id').single();
      if (guestErr) throw guestErr;
      unregisteredAthleteId = guest.id;

      const { data: enrollment, error: enrErr } = await supabase
        .from('enrollments')
        .insert({
          school_id: verif.school_id,
          unregistered_athlete_id: guest.id,
          offering_plan_id: planId,
          status: courtesySettings.requires_approval ? 'pending' : 'active',
          sessions_used: 0,
        })
        .select('id').single();
      if (enrErr) throw enrErr;
      enrollmentId = enrollment.id;

      if (courtesySettings.requires_approval) {
        return res.status(202).json({
          success: true,
          pending_approval: true,
          message: 'Tu solicitud de clase de cortesía quedó registrada. La escuela debe aprobarla antes de confirmarse.',
        });
      }
    } else {
      return res.status(400).json({ error: 'Escenario inválido para este endpoint.' });
    }

    // ── Resolver/crear la sesión + chequear cupo + reservar + mover el
    // crédito, todo atómico en una sola RPC (ver migración
    // 20260828230515_public_booking_confirmar_atomico_y_grants.sql). Esta
    // ruta es pública y sin sesión, la más expuesta a envíos concurrentes
    // para el mismo bloque — por eso el advisory lock vive en la RPC, no acá.
    const start_time = avail.start_time.length === 5 ? `${avail.start_time}:00` : avail.start_time;
    const end_time = avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time;

    const { data: confirmData, error: confirmErr } = await supabase.rpc('public_booking_confirm_reservation', {
      p_school_id: verif.school_id,
      p_facility_id: avail.facility_id,
      p_facility_availability_id: facility_availability_id,
      p_date: date,
      p_start_time: start_time,
      p_end_time: end_time,
      p_max_group_capacity: avail.max_group_capacity ?? null,
      p_enrollment_id: enrollmentId,
      p_unregistered_athlete_id: unregisteredAthleteId,
    });

    if (confirmErr) {
      if (confirmErr.message?.includes('CAPACITY_FULL')) {
        return res.status(409).json({ error: 'Este horario ya alcanzó su cupo máximo.', reason: 'capacity_full' });
      }
      req.log?.error({ err: confirmErr }, 'public-booking confirm: fallo en la RPC atómica');
      return res.status(409).json({ error: confirmErr.message });
    }

    const confirmed = Array.isArray(confirmData) ? confirmData[0] : confirmData;

    await supabase.from('public_booking_verifications')
      .update({ booking_token_used_at: new Date().toISOString() })
      .eq('id', verif.id);

    // Correo de confirmación al prospecto — la reserva ya quedó creada, un
    // fallo acá no debe tumbar la respuesta, solo se reporta sin confirmación.
    let emailSent = false;
    try {
      const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
      const { subject, html } = await BrandedEmailTemplates.publicBookingConfirmation({
        recipientName: verif.full_name || 'cliente',
        facilityName: (avail as any).facility?.name ?? '',
        dateLabel,
        timeLabel: start_time.slice(0, 5),
        schoolId: verif.school_id,
      });
      const sendResult = await emailClient.send({ to: verif.resolved_email, subject, html });
      emailSent = !!sendResult.success;
    } catch (emailErr) {
      req.log?.error({ err: emailErr, bookingId: confirmed.booking_id }, 'public-booking confirm: fallo enviando correo de confirmación');
    }

    return res.status(201).json({
      success: true,
      booking: { id: confirmed.booking_id, session_id: confirmed.session_id },
      session_date: date,
      start_time,
      email_sent: emailSent,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking confirm error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// =============================================================================
// Clases de prueba — link público NUEVO y separado de instalaciones/cortesía
// (ver docs/specs/mis-inscripciones-agenda-clases-prueba.md, decisión
// "un link distinto, pero con las mismas validaciones/verificación").
// Reusa TAL CUAL: la tabla public_booking_verifications, el helper
// resolveByToken, y el endpoint /verify-otp de arriba (es genérico — no le
// importa PARA QUÉ se está verificando, solo valida el código). Lo único
// nuevo es start-verification (gate distinto: categorías de prueba, no
// cortesía) y confirm (llama trial_class_public_create, no
// public_booking_confirm_reservation). Ninguna ruta existente se tocó.
// =============================================================================

// ── POST /trial-start-verification ──────────────────────────────────────────
router.post('/trial-start-verification', otpStartLimiter, async (req: Request, res: Response) => {
  try {
    const { school_id, email, full_name } = req.body as {
      school_id: string; email: string; full_name?: string;
    };
    if (!school_id || !email) return res.status(400).json({ error: 'school_id y email son requeridos.' });

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Correo inválido.' });

    const windowStart = new Date(Date.now() - OTP_EMAIL_WINDOW_MIN * 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('public_booking_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school_id)
      .eq('resolved_email', cleanEmail)
      .gte('created_at', windowStart);

    if ((recentCount ?? 0) >= MAX_OTP_PER_EMAIL_WINDOW) {
      return res.status(429).json({ error: 'Demasiados códigos solicitados para este correo. Espera unos minutos.' });
    }

    // Escenario 3: ya tiene cuenta — mismo criterio que /start-verification.
    // El magic link de /verify-otp ya redirige a /enrollments, donde el
    // self-service (con el chequeo has_active_plan) resuelve todo solo.
    const { data: profileMatch } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (profileMatch) {
      return res.json({
        scenario: 'already_registered',
        email: cleanEmail,
        message: 'Ya tienes una cuenta registrada. Por seguridad, debes iniciar sesión con tu correo y contraseña.',
      });
    }

    // Escenario 2: coincide con unregistered_athlete con enrollment activo.
    // A diferencia de cortesía, acá SÍ puede repetir — trial_class_public_create
    // decide el precio (primera vez vs repetición) y si allow_repeat lo permite.
    const { data: unregMatch } = await supabase
      .from('unregistered_athletes')
      .select('id, full_name')
      .eq('school_id', school_id)
      .eq('email', cleanEmail)
      .maybeSingle();

    if (unregMatch) {
      const code = generateCode();
      const { data: verif, error } = await supabase
        .from('public_booking_verifications')
        .insert({
          school_id,
          otp_hash: hashOtp(code),
          resolved_email: cleanEmail,
          resolved_kind: 'enrolled_unregistered',
          resolved_unregistered_id: unregMatch.id,
          full_name: unregMatch.full_name,
          expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
        })
        .select('id').single();
      if (error) throw error;

      await emailClient.send({
        to: cleanEmail,
        subject: 'Tu código para agendar tu clase de prueba',
        html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
        text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
      });

      return res.json({
        verification_id: verif.id,
        scenario: 'enrolled_unregistered',
        masked_email: maskEmail(cleanEmail),
        ...(DEBUG_OTP_ENABLED ? { debug_code: code } : {}),
      });
    }

    // Escenario 1: nuevo — requiere nombre explícito.
    if (!full_name || !full_name.trim()) {
      return res.json({ scenario: 'new_needs_name' });
    }

    // Gate: la escuela necesita self-service prendido Y al menos una
    // categoría activa — no "cortesía habilitada" como en el otro flujo.
    const { data: trialSettings } = await supabase
      .from('school_trial_class_settings')
      .select('enabled, self_service_enabled')
      .eq('school_id', school_id)
      .maybeSingle();

    if (!trialSettings?.enabled || !trialSettings?.self_service_enabled) {
      return res.status(422).json({
        error: 'Esta escuela no tiene clases de prueba habilitadas por este link.',
        reason: 'trial_not_available',
      });
    }
    const { count: activeCategoryCount } = await supabase
      .from('trial_class_categories')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school_id)
      .eq('is_active', true);
    if (!activeCategoryCount) {
      return res.status(422).json({ error: 'Esta escuela no tiene categorías de prueba activas.', reason: 'trial_not_available' });
    }

    const code = generateCode();
    const { data: verif, error } = await supabase
      .from('public_booking_verifications')
      .insert({
        school_id,
        otp_hash: hashOtp(code),
        resolved_email: cleanEmail,
        resolved_kind: 'new',
        full_name: full_name.trim(),
        expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
      })
      .select('id').single();
    if (error) throw error;

    await emailClient.send({
      to: cleanEmail,
      subject: 'Tu código para agendar tu clase de prueba',
      html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
      text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
    });

    return res.json({
      verification_id: verif.id,
      scenario: 'new',
      masked_email: maskEmail(cleanEmail),
      ...(DEBUG_OTP_ENABLED ? { debug_code: code } : {}),
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking trial-start-verification error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── GET /trial-slots?token=&category_id=&from=&to= ─────────────────────────
// Agregado: cruza TODAS las canchas con TODOS los entrenadores de la
// escuela — el visitante nunca elige entrenador a mano (fricción y expone
// identidad de staff sin necesidad, ver 20260829120423).
router.get('/trial-slots', async (req: Request, res: Response) => {
  try {
    const { token, category_id, from, to } = req.query as Record<string, string | undefined>;
    if (!token || !category_id || !from || !to) {
      return res.status(400).json({ error: 'token, category_id, from y to son requeridos.' });
    }

    const resolved = await resolveByToken(token);
    if ('error' in resolved) return res.status(resolved.status!).json({ error: resolved.error });

    const { data, error } = await supabase.rpc('trial_class_public_get_slots', {
      p_school_id: resolved.verif.school_id,
      p_category_id: category_id,
      p_from_date: from,
      p_to_date: to,
    });

    if (error) return res.status(409).json({ error: error.message });
    return res.json(data);
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking trial-slots error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /trial-confirm ─────────────────────────────────────────────────────
router.post('/trial-confirm', async (req: Request, res: Response) => {
  try {
    const {
      token, category_id, facility_availability_id, coach_availability_id,
      date, start_time, end_time, prospect_whatsapp, is_minor, child_name,
    } = req.body as {
      token: string; category_id: string; facility_availability_id: string; coach_availability_id: string;
      date: string; start_time: string; end_time: string;
      prospect_whatsapp?: string; is_minor?: boolean; child_name?: string;
    };
    if (!token || !category_id || !facility_availability_id || !coach_availability_id || !date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Faltan datos requeridos.' });
    }

    const resolved = await resolveByToken(token);
    if ('error' in resolved) return res.status(resolved.status!).json({ error: resolved.error });
    const { verif } = resolved;

    if (verif.booking_token_used_at) {
      return res.status(400).json({ error: 'Este token ya fue usado para agendar. Verifícate de nuevo.' });
    }
    if (verif.resolved_kind !== 'enrolled_unregistered' && verif.resolved_kind !== 'new') {
      return res.status(400).json({ error: 'Escenario inválido para este endpoint.' });
    }

    let rpcParams: Record<string, any> = {
      p_school_id: verif.school_id,
      p_category_id: category_id,
      p_facility_availability_id: facility_availability_id,
      p_coach_availability_id: coach_availability_id,
      p_scheduled_date: date,
      p_start_time: start_time,
      p_end_time: end_time,
    };

    if (verif.resolved_kind === 'enrolled_unregistered') {
      rpcParams.p_unregistered_athlete_id = verif.resolved_unregistered_id;
    } else {
      if (!prospect_whatsapp) return res.status(400).json({ error: 'prospect_whatsapp es requerido.' });
      if (is_minor && !child_name) return res.status(400).json({ error: 'child_name es requerido cuando is_minor es true.' });
      rpcParams = {
        ...rpcParams,
        p_prospect_name: verif.full_name,
        p_prospect_email: verif.resolved_email,
        p_prospect_whatsapp: prospect_whatsapp,
        p_is_minor: !!is_minor,
        p_child_name: is_minor ? child_name : null,
      };
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('trial_class_public_create', rpcParams);

    if (rpcError) {
      req.log?.error({ err: rpcError }, 'public-booking trial-confirm: fallo en la RPC');
      return res.status(409).json({ error: rpcError.message });
    }

    const confirmed = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    await supabase.from('public_booking_verifications')
      .update({ booking_token_used_at: new Date().toISOString() })
      .eq('id', verif.id);

    let emailSent = false;
    try {
      const [{ data: facility }, { data: coach }, { data: category }] = await Promise.all([
        supabase.from('facility_availability').select('facility_id, facilities(name)').eq('id', facility_availability_id).single(),
        supabase.from('coach_availability').select('coach_id, school_staff(full_name)').eq('id', coach_availability_id).single(),
        supabase.from('trial_class_categories').select('name').eq('id', category_id).single(),
      ]);
      const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
      const { subject, html } = await BrandedEmailTemplates.trialClassConfirmation({
        prospectName: verif.full_name || 'cliente',
        childName: is_minor ? (child_name ?? null) : null,
        dateLabel,
        timeLabel: start_time.slice(0, 5),
        facilityName: (facility as any)?.facilities?.name ?? '',
        coachName: (coach as any)?.school_staff?.full_name ?? '',
        priceLabel: confirmed.price > 0 ? `$${confirmed.price}` : null,
        schoolId: verif.school_id,
      });
      const sendResult = await emailClient.send({ to: verif.resolved_email, subject, html });
      emailSent = !!sendResult.success;
    } catch (emailErr) {
      req.log?.error({ err: emailErr, bookingId: confirmed.booking_id }, 'public-booking trial-confirm: fallo enviando correo');
    }

    return res.status(201).json({
      success: true,
      booking_id: confirmed.booking_id,
      price: confirmed.price,
      is_first: confirmed.is_first,
      payment_mode: confirmed.payment_mode,
      email_sent: emailSent,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking trial-confirm error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default router;
