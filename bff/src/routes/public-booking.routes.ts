import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import { emailClient } from '../utils/emailClient';

const router = Router();

// ── Rate limiting propio de este router ────────────────────────────────────
const otpStartLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `otp-start-${req.ip}`,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

const OTP_TTL_MIN = 10;
const MAX_OTP_PER_PHONE_WINDOW = 3;
const OTP_PHONE_WINDOW_MIN = 10;

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

    return res.json({
      school: { id: school.id, name: school.name },
      facilities: facilities || [],
      courtesy_available: courtesy?.enabled ?? false,
    });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking schools/:slug error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ── POST /start-verification — resuelve teléfono y manda OTP ───────────────
router.post('/start-verification', otpStartLimiter, async (req: Request, res: Response) => {
  try {
    const { school_id, phone, full_name, email } = req.body as {
      school_id: string; phone: string; full_name?: string; email?: string;
    };
    if (!school_id || !phone) return res.status(400).json({ error: 'school_id y phone son requeridos.' });

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 7) return res.status(400).json({ error: 'Teléfono inválido.' });

    // Anti-flood por teléfono específico (además del rate-limit por IP)
    const windowStart = new Date(Date.now() - OTP_PHONE_WINDOW_MIN * 60_000).toISOString();
    const { count: recentCount } = await supabase
      .from('public_booking_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', school_id)
      .eq('phone', cleanPhone)
      .gte('created_at', windowStart);

    if ((recentCount ?? 0) >= MAX_OTP_PER_PHONE_WINDOW) {
      return res.status(429).json({ error: 'Demasiados códigos solicitados para este número. Espera unos minutos.' });
    }

    // ── Escenario 3: coincide con un profile (adulto o padre) ──────────────
    const { data: profileMatch } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('phone', cleanPhone)
      .maybeSingle();

    // ── Escenario 3 (hijo): coincide con parent_phone de un child ──────────
    let childMatch: { id: string; parent_id: string } | null = null;
    let parentEmailForChild: string | null = null;
    if (!profileMatch) {
      const { data: child } = await supabase
        .from('children')
        .select('id, parent_id, parent_phone')
        .eq('parent_phone', cleanPhone)
        .maybeSingle();
      if (child) {
        childMatch = { id: child.id, parent_id: child.parent_id };
        const { data: parentProfile } = await supabase
          .from('profiles').select('email').eq('id', child.parent_id).maybeSingle();
        parentEmailForChild = parentProfile?.email ?? null;
      }
    }

    if (profileMatch || childMatch) {
      const targetEmail = profileMatch?.email ?? parentEmailForChild;
      if (!targetEmail) {
        return res.status(422).json({
          error: 'Encontramos tu cuenta pero no tiene un correo asociado. Contacta a la escuela.',
        });
      }

      return res.json({
        scenario: 'already_registered',
        email: targetEmail,
        message: 'Ya tienes una cuenta registrada. Por seguridad, debes iniciar sesión con tu correo y contraseña.',
      });
    }

    // ── Escenario 2: coincide con unregistered_athlete con enrollment activo ──
    const { data: unregMatch } = await supabase
      .from('unregistered_athletes')
      .select('id, full_name, email')
      .eq('school_id', school_id)
      .eq('phone', cleanPhone)
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
        const targetEmail = unregMatch.email || email;
        if (!targetEmail) {
          return res.status(200).json({
            scenario: 'enrolled_needs_email',
            unregistered_id: unregMatch.id,
            message: 'Encontramos tu inscripción. Necesitamos un correo para enviarte el código.',
          });
        }

        const code = generateCode();
        const { data: verif, error } = await supabase
          .from('public_booking_verifications')
          .insert({
            school_id, phone: cleanPhone,
            otp_hash: hashOtp(code),
            resolved_email: targetEmail,
            resolved_kind: 'enrolled_unregistered',
            resolved_unregistered_id: unregMatch.id,
            resolved_enrollment_id: enrollment.id,
            expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
          })
          .select('id').single();
        if (error) throw error;

        await emailClient.send({
          to: targetEmail,
          subject: 'Tu código para agendar en SportMaps',
          html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
          text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
        });

        return res.json({
          verification_id: verif.id,
          scenario: 'enrolled_unregistered',
          masked_email: maskEmail(targetEmail),
          ...(process.env.NODE_ENV !== 'production' ? { debug_code: code } : {}),
        });
      }
    }

    // ── Escenario 1: nuevo — requiere nombre + email explícitos ─────────────
    if (!full_name || !email) {
      return res.json({ scenario: 'new_needs_details' });
    }

    const { data: courtesySettings } = await supabase
      .from('school_courtesy_settings')
      .select('enabled')
      .eq('school_id', school_id)
      .maybeSingle();

    if (!courtesySettings?.enabled) {
      return res.status(422).json({
        error: 'No encontramos tu número en nuestros registros y esta escuela no tiene clases de cortesía activas.',
        reason: 'no_courtesy',
      });
    }

    // Anti-abuso: ¿este teléfono o algún unregistered_athlete con este email ya reclamó cortesía?
    const { data: priorClaim } = await supabase
      .from('unregistered_athletes')
      .select('id')
      .eq('school_id', school_id)
      .or(`phone.eq.${cleanPhone},email.eq.${email}`)
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
        school_id, phone: cleanPhone,
        otp_hash: hashOtp(code),
        resolved_email: email,
        resolved_kind: 'new',
        full_name,
        expires_at: new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString(),
      })
      .select('id').single();
    if (error) throw error;

    await emailClient.send({
      to: email,
      subject: 'Tu código para agendar tu clase de cortesía',
      html: `<p>Tu código de verificación es:</p><h2 style="letter-spacing:3px">${code}</h2><p>Vence en ${OTP_TTL_MIN} minutos.</p>`,
      text: `Tu código de verificación es ${code} (vence en ${OTP_TTL_MIN} min).`,
    });

    return res.json({
      verification_id: verif.id,
      scenario: 'new',
      masked_email: maskEmail(email),
      ...(process.env.NODE_ENV !== 'production' ? { debug_code: code } : {}),
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
      .select('facility_id, school_id, start_time, end_time, max_group_capacity, facility:facilities(min_booking_advance_hours)')
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
        .insert({ school_id: verif.school_id, full_name: verif.full_name, phone: verif.phone, email: verif.resolved_email })
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

    // ── Crear o reusar attendance_session, e insertar el booking ────────────
    const start_time = avail.start_time.length === 5 ? `${avail.start_time}:00` : avail.start_time;
    const end_time = avail.end_time.length === 5 ? `${avail.end_time}:00` : avail.end_time;

    const { data: existS } = await supabase
      .from('attendance_sessions')
      .select('id, max_capacity, current_bookings')
      .eq('facility_availability_id', facility_availability_id)
      .eq('session_date', date)
      .maybeSingle();

    let sessionId: string;
    let maxCapacity: number;

    if (existS) {
      sessionId = existS.id;
      maxCapacity = existS.max_capacity;
    } else {
      const { data: newS, error: newErr } = await supabase.from('attendance_sessions')
        .insert({
          school_id: verif.school_id,
          facility_id: avail.facility_id,
          facility_availability_id,
          coach_id: null, offering_id: null,
          session_date: date, start_time, end_time,
          max_capacity: avail.max_group_capacity ?? 10,
          current_bookings: 0, is_bookable: true, finalized: false,
        }).select('id, max_capacity').single();

      if (newErr) {
        if (newErr.code === '23505') {
          // Otro request ganó la carrera y ya la creó -- ahora es único, la recupero
          const { data: retryS, error: retryErr } = await supabase
            .from('attendance_sessions')
            .select('id, max_capacity')
            .eq('facility_availability_id', facility_availability_id)
            .eq('session_date', date)
            .single();
          if (retryErr || !retryS) return res.status(500).json({ error: 'No se pudo resolver el bloque, intenta de nuevo.' });
          sessionId = retryS.id;
          maxCapacity = retryS.max_capacity;
        } else {
          throw newErr;
        }
      } else {
        sessionId = newS.id;
        maxCapacity = newS.max_capacity;
      }
    }

    const { count: activeCount } = await supabase
      .from('session_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .neq('status', 'cancelled');
    if ((activeCount ?? 0) >= maxCapacity) {
      return res.status(409).json({ error: 'Este horario ya alcanzó su cupo máximo.', reason: 'capacity_full' });
    }

    const { data: booking, error: bookErr } = await supabase.from('session_bookings').insert({
      school_id: verif.school_id,
      session_id: sessionId,
      unregistered_athlete_id: unregisteredAthleteId,
      is_secondary: false,
      booking_type: 'reservation',
      status: 'confirmed',
    }).select().single();
    if (bookErr) return res.status(409).json({ error: bookErr.message });

    await supabase.from('enrollments')
      .select('sessions_used').eq('id', enrollmentId).single()
      .then(async ({ data: enr }) => {
        if (enr) await supabase.from('enrollments').update({ sessions_used: (enr.sessions_used || 0) + 1 }).eq('id', enrollmentId);
      });

    await supabase.from('public_booking_verifications')
      .update({ booking_token_used_at: new Date().toISOString() })
      .eq('id', verif.id);

    return res.status(201).json({ success: true, booking, session_date: date, start_time });
  } catch (err: any) {
    req.log?.error({ err }, 'public-booking confirm error');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default router;
