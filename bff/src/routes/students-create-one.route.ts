/**
 * POST /api/v1/students/create-one
 *
 * Tres tipos:
 *
 *   "child"          → Menor: INSERT children (child_id) + enrollment(s) + pago + invitación acudiente
 *   "adult_existing" → Adulto ya en profiles: INSERT school_members (si no existe) + enrollment (user_id) + pago
 *   "adult_invite"   → Adulto sin cuenta: solo INSERT invitations (no enrollment posible sin auth)
 *
 * Reglas de enrollments:
 *   - team_id       → INSERT enrollment separado  (enrollments.team_id, sin offering_*)
 *   - offering_plan_id + offering_id → INSERT enrollment separado (sin team_id)
 *   - Ambos         → dos enrollments independientes
 *   - Ninguno       → no se crea enrollment (solo el registro del atleta)
 *
 * Columnas usadas en enrollments:
 *   child_id | user_id  → quién es el atleta (solo uno aplica según tipo)
 *   team_id             → equipo (solo cuando type=team)
 *   offering_plan_id    → plan específico (offering_plans.id)
 *   offering_id         → offering padre  (offerings.id)
 *   school_id, status, start_date → siempre
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { calcFirstPayment, BillingCycleType } from '../utils/prorationUtils';
import { normalizeSchoolName } from '../utils/brandingUtils';


const router = Router();

// ─── Helpers de schema ─────────────────────────────────────────────────────
// Convierte string vacío o "none" a null antes de validar el UUID
const uuid_or_null = z
  .union([z.string().uuid(), z.literal(''), z.literal('none')])
  .nullable()
  .optional()
  .transform(v => (!v || v === '' || v === 'none') ? null : v);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const EnrollmentBase = z.object({
  branch_id:        uuid_or_null,
  team_id:          uuid_or_null,
  offering_plan_id: uuid_or_null,
  offering_id:      uuid_or_null,
  start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthly_fee:      z.number().min(10000).nullable().optional(),
  discount_pct:     z.number().min(0).max(100).optional(),
});

const ChildSchema = EnrollmentBase.extend({
  type:          z.literal('child'),
  doc_type:      z.enum(['TI', 'CC', 'CE', 'PP']).default('TI'),
  doc_number:    z.string().min(1),
  full_name:     z.string().min(2).max(150).trim(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender:        z.string().nullable().optional(),
  grade:         z.string().max(20).nullable().optional(),
  medical_info:  z.string().optional(),   // JSON con has_allergies
  parent_name:   z.string().min(2),
  parent_email:  z.string().email(),
  parent_phone:  z.string().regex(/^\d{10,}$/),
});

const AdultExistingSchema = EnrollmentBase.extend({
  type:    z.literal('adult_existing'),
  user_id: z.string().uuid(),   // profiles.id
});

const ChildExistingSchema = EnrollmentBase.extend({
  type:     z.literal('child_existing'),
  child_id: z.string().uuid(),
});

const AdultInviteSchema = z.object({
  type:  z.literal('adult_invite'),
  email: z.string().email(),
});

const UnregisteredAdultSchema = EnrollmentBase.extend({
  type:          z.literal('unregistered_adult'),
  doc_type:      z.string().optional(),
  doc_number:    z.string().nullable().optional(),
  full_name:     z.string().min(2).max(150).trim(),
  email:         z.string().email().nullable().optional(),
  phone:         z.string().nullable().optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender:        z.string().nullable().optional(),
  send_invite:   z.boolean().default(false),
});

const CreateOneSchema = z.discriminatedUnion('type', [
  ChildSchema,
  AdultExistingSchema,
  ChildExistingSchema,
  AdultInviteSchema,
  UnregisteredAdultSchema,
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcProratedFee(startDate: string, monthlyFee: number): number {
  const [year, month, day] = startDate.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day === 1) return monthlyFee;
  const remainingDays = daysInMonth - day + 1;
  return Math.round((remainingDays / daysInMonth) * monthlyFee);
}

function endOfMonth(startDate: string): string {
  const [year, month] = startDate.split('-').map(Number);
  return new Date(year, month, 0).toISOString().split('T')[0];
}

/**
 * Crea UN enrollment y devuelve el id creado (o null si ya existía o falló).
 * athlete puede ser { child_id } o { user_id } — nunca ambos.
 */
async function createEnrollment(params: {
  childId?: string;
  userId?: string;
  unregisteredAthleteId?: string;
  schoolId: string;
  startDate: string;
  status?: string;
  teamId?: string | null;
  offeringPlanId?: string | null;
  offeringId?: string | null;
  log?: any;
}): Promise<string | null> {
  const { childId, userId, unregisteredAthleteId, schoolId, startDate, status, teamId, offeringPlanId, offeringId, log } = params;

  // Verificar si ya existe un enrollment activo igual
  let existingQuery = supabase
    .from('enrollments')
    .select('id')
    .eq('school_id', schoolId)
    .in('status', ['active', 'pending']);

  if (childId) existingQuery = existingQuery.eq('child_id', childId);
  if (userId)  existingQuery = existingQuery.eq('user_id', userId);
  if (unregisteredAthleteId) existingQuery = existingQuery.eq('unregistered_athlete_id', unregisteredAthleteId);
  if (teamId)  existingQuery = existingQuery.eq('team_id', teamId);
  if (offeringPlanId) existingQuery = existingQuery.eq('offering_plan_id', offeringPlanId);

  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return null; // Ya inscrito — no duplicar

  const record: Record<string, any> = {
    school_id:  schoolId,
    status:     status || 'active',
    start_date: startDate,
  };


  if (childId) record.child_id = childId;
  if (userId)  record.user_id  = userId;
  if (unregisteredAthleteId) record.unregistered_athlete_id = unregisteredAthleteId;

  // Equipo — solo team_id
  if (teamId) {
    record.team_id = teamId;
  }

  // Plan — offering_plan_id + offering_id (siempre juntos)
  if (offeringPlanId && offeringId) {
    record.offering_plan_id = offeringPlanId;
    record.offering_id      = offeringId;
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    log?.error({ err: error }, 'Error creando enrollment');
    return null;
  }
  return data?.id ?? null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  '/create-one',
  requireAuth,
  requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school', 'coach', 'staff'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req;

    const parsed = CreateOneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Datos inválidos.', details: parsed.error.issues });
    }

    const data = parsed.data;

    try {
      // ── Obtener nombre y configuración de la escuela ───────────────────────
      const [{ data: school }, { data: settings }] = await Promise.all([
        supabase.from('schools').select('name').eq('id', schoolId).single(),
        supabase.from('school_settings')
          .select('billing_cycle_type, payment_cutoff_day, require_payment_proof')
          .eq('school_id', schoolId)
          .maybeSingle(),
      ]);
      const schoolName     = normalizeSchoolName(school?.name || 'la Academia');
      const cycleType      = (settings?.billing_cycle_type || 'prorated') as BillingCycleType;
      const cutoffDay      = settings?.payment_cutoff_day || 10;
      const requireProof   = settings?.require_payment_proof ?? true;

      // Fuente del link de invitacion, en orden de preferencia:
      //   1. Origin del request (dominio desde donde se invita: stg / dev / app).
      //   2. FRONTEND_URL del entorno como failsafe.
      //   3. Fallback a app.sportmaps.co (TLD corregido; antes decia .com).
      // El CORS middleware ya valida que Origin sea *.sportmaps.co / vercel.app,
      // asi que no hay riesgo de spoof de un dominio arbitrario.
      const requestOrigin =
        (req.headers.origin as string | undefined) ||
        (req.headers.referer as string | undefined)?.replace(/\/$/, '');
      const origin = requestOrigin || process.env.FRONTEND_URL || 'https://app.sportmaps.co';

      // ══════════════════════════════════════════════════════════════════════
      // FLUJO A — Menor de edad
      // ══════════════════════════════════════════════════════════════════════
      if (data.type === 'child') {
        // 1. Verificar duplicado por doc_number en esta escuela
        const { data: existing } = await supabase
          .from('children')
          .select('id')
          .eq('school_id', schoolId)
          .eq('doc_number', data.doc_number)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({
            error: `Ya existe un menor con el documento ${data.doc_number} en esta escuela.`,
            existing_id: existing.id,
          });
        }

        // 2. INSERT children
        const { data: child, error: childErr } = await supabase
          .from('children')
          .insert({
            full_name:         data.full_name,
            doc_type:          data.doc_type,
            doc_number:        data.doc_number,
            date_of_birth:     data.date_of_birth     || null,
            gender:            data.gender             || null,
            grade:             data.grade              || null,
            medical_info:      data.medical_info       || JSON.stringify({ has_allergies: false }),
            school_id:         schoolId,
            branch_id:         data.branch_id          || null,
            // Guardamos team_id en children solo como referencia rápida
            // El enrollment es la fuente de verdad
            team_id:           data.team_id            || null,
            monthly_fee:       data.monthly_fee        || null,
            parent_name_temp:  data.parent_name,
            parent_email_temp: data.parent_email,
            parent_phone_temp: data.parent_phone,
            is_active:         true,
            is_demo:           false,
          })
          .select('id')
          .single();

        if (childErr || !child) {
          return res.status(500).json({ error: childErr?.message || 'Error al crear el menor.' });
        }

        const childId = child.id;
        let enrollmentsCreated = 0;

        // 3a. Enrollment de EQUIPO (si aplica — independiente)
        let teamName = 'Equipo';
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', data.team_id).single();
          if (team) teamName = team.name;

          const eid = await createEnrollment({
            childId, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 3b. Enrollment de PLAN (si aplica — independiente)
        if (data.offering_plan_id && data.offering_id) {
          const eid = await createEnrollment({
            childId, schoolId,
            status: 'active',
            startDate: data.start_date,
            offeringPlanId: data.offering_plan_id,
            offeringId: data.offering_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 4. Pagos proporcionales
        let paymentCreated = false;
        // Pago del equipo
        if (data.team_id && data.monthly_fee && data.monthly_fee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(data.monthly_fee * (1 - data.discount_pct / 100))
            : data.monthly_fee;

          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const { error: payErr } = await supabase.from('payments').insert({
            child_id:     childId,
            school_id:    schoolId,
            branch_id:    data.branch_id || null,
            team_id:      data.team_id,
            amount:       payCalc.amount,
            concept:      `Equipo ${teamName} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date:     payCalc.dueDate,
            status:       'pending',
            payment_type: 'subscription',
          });
          if (!payErr) paymentCreated = true;
          else req.log?.error({ err: payErr }, 'Error creando pago equipo menor');
        }

        // Pago del plan (precio viene de offering_plans.price)
        if (data.offering_plan_id && data.offering_id) {
          const { data: plan } = await supabase
            .from('offering_plans')
            .select('price, name')
            .eq('id', data.offering_plan_id)
            .single();

          if (plan && plan.price >= 10000) {
            const effectiveFee = data.discount_pct
              ? Math.round(Number(plan.price) * (1 - data.discount_pct / 100))
              : Number(plan.price);

            const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
            const { error: payErr } = await supabase.from('payments').insert({
              child_id:     childId,
              school_id:    schoolId,
              branch_id:    data.branch_id || null,
              offering_plan_id: data.offering_plan_id,
              amount:       payCalc.amount,
              concept:      `Plan ${plan.name} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
              due_date:     payCalc.dueDate,
              status:       'pending',
              payment_type: 'subscription',
            });
            if (!payErr) paymentCreated = true;
            else req.log?.error({ err: payErr }, 'Error creando pago plan menor');
          }
        }


        // 5. Invitación al acudiente
        let invitationSent = false;
        let invite: any = null;
        const { data: existingInvite } = await supabase
          .from('invitations')
          .select('id')
          .eq('school_id', schoolId)
          .eq('email', data.parent_email)
          .in('status', ['pending', 'accepted'])
          .maybeSingle();

        if (!existingInvite) {
          const { data: inviteData, error: invErr } = await supabase
            .from('invitations')
            .insert({
              email:            data.parent_email,
              school_id:        schoolId,
              role_to_assign:   'parent',
              invited_by:       req.user?.id || null,
              status:           'pending',
              child_name:       data.full_name,
              team_id:          data.team_id          || null,
              offering_plan_id: data.offering_plan_id || null,
              monthly_fee:      data.monthly_fee      || null,
            })
            .select('id')
            .single();

          if (!invErr && inviteData) {
            invite = inviteData;
            invitationSent = true;
            const { emailClient } = await import('../utils/emailClient');
            const { BrandedEmailTemplates } = await import('../utils/emailTemplates');
            const link = `${origin}/register?email=${encodeURIComponent(data.parent_email)}&role=parent&invite=${invite.id}`;
            try {
              const tpl = await BrandedEmailTemplates.invitation({
                parentName: data.parent_name,
                childName: data.full_name,
                schoolId,
                inviteLink: link,
              });
              emailClient.send({
                to: data.parent_email,
                subject: tpl.subject,
                html: tpl.html,
              }).catch((e: any) => req.log?.error({ email: data.parent_email, err: e }, 'Fallo email'));
            } catch (e: any) {
              req.log?.error({ email: data.parent_email, err: e }, 'Fallo template branded');
            }
          }
        }

        const registrationLink = invitationSent
          ? `${origin}/register?email=${encodeURIComponent(data.parent_email)}&role=parent&invite=${invite?.id ?? ''}`
          : null;

        return res.status(201).json({
          success: true,
          child_id: childId,
          enrollments_created: enrollmentsCreated,
          payment_created: paymentCreated,
          invitation_sent: invitationSent,
          registration_link: registrationLink,
          parent_phone: data.parent_phone ?? null,
          message: `Menor registrado. ${enrollmentsCreated} inscripción(es) creada(s).${invitationSent ? ` Invitación enviada a ${data.parent_email}.` : ''}`,
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // FLUJO B — Atleta adulto existente en profiles
      // ══════════════════════════════════════════════════════════════════════
      if (data.type === 'adult_existing') {
        const userId = data.user_id; // profiles.id

        // 1. Verificar que el perfil exista
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', userId)
          .maybeSingle();

        if (!profile) {
          return res.status(404).json({ error: 'No se encontró el perfil del atleta.' });
        }

        // 2. INSERT school_members si no es miembro activo de esta escuela
        const { data: existingMember } = await supabase
          .from('school_members')
          .select('id')
          .eq('profile_id', userId)
          .eq('school_id', schoolId)
          .eq('status', 'active')
          .maybeSingle();

        if (!existingMember) {
          const { error: memberErr } = await supabase.from('school_members').insert({
            profile_id: userId,
            school_id:  schoolId,
            role:       'athlete',
            status:     'active',
            branch_id:  data.branch_id || null,
            joined_at:  new Date().toISOString(),
          });
          if (memberErr) {
            req.log?.error({ err: memberErr }, 'Error creando school_member');
            // No bloqueamos — igual creamos el enrollment
          }
        }

        // 3a. Enrollment de EQUIPO (independiente)
        let enrollmentsCreated = 0;
        let teamName = 'Equipo';
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', data.team_id).single();
          if (team) teamName = team.name;

          const eid = await createEnrollment({
            userId, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 3b. Enrollment de PLAN (independiente)
        if (data.offering_plan_id && data.offering_id) {
          const eid = await createEnrollment({
            userId, schoolId,
            status: 'active',
            startDate: data.start_date,
            offeringPlanId: data.offering_plan_id,
            offeringId: data.offering_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 4. Pagos proporcionales
        let paymentCreated = false;
        // Pago del equipo
        if (data.team_id && data.monthly_fee && data.monthly_fee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(data.monthly_fee * (1 - data.discount_pct / 100))
            : data.monthly_fee;

          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const { error: payErr } = await supabase.from('payments').insert({
            user_id:      userId,
            school_id:    schoolId,
            branch_id:    data.branch_id || null,
            team_id:      data.team_id,
            amount:       payCalc.amount,
            concept:      `Equipo ${teamName} — ${payCalc.description} — ${profile.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date:     payCalc.dueDate,
            status:       'pending',
            payment_type: 'subscription',
          });
          if (!payErr) paymentCreated = true;
          else req.log?.error({ err: payErr }, 'Error creando pago equipo adulto');
        }

        // Pago del plan
        if (data.offering_plan_id && data.offering_id) {
          const { data: plan } = await supabase
            .from('offering_plans')
            .select('price, name')
            .eq('id', data.offering_plan_id)
            .single();

          if (plan && plan.price >= 10000) {
            const effectiveFee = data.discount_pct
              ? Math.round(Number(plan.price) * (1 - data.discount_pct / 100))
              : Number(plan.price);

            const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
            const { error: payErr } = await supabase.from('payments').insert({
              user_id:      userId,
              school_id:    schoolId,
              branch_id:    data.branch_id || null,
              offering_plan_id: data.offering_plan_id,
              amount:       payCalc.amount,
              concept:      `Plan ${plan.name} — ${payCalc.description} — ${profile.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
              due_date:     payCalc.dueDate,
              status:       'pending',
              payment_type: 'subscription',
            });
            if (!payErr) paymentCreated = true;
            else req.log?.error({ err: payErr }, 'Error creando pago plan adulto');
          }
        }


        return res.status(201).json({
          success: true,
          user_id: userId,
          enrollments_created: enrollmentsCreated,
          payment_created: paymentCreated,
          message: `${profile.full_name} inscrito correctamente. ${enrollmentsCreated} inscripción(es) creada(s).`,
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // FLUJO E — Menor ya registrado en children
      // ══════════════════════════════════════════════════════════════════════
      if (data.type === 'child_existing') {
        const { child_id } = data;

        // 1. Verificar que el menor exista
        const { data: child } = await supabase
          .from('children')
          .select('id, full_name, school_id')
          .eq('id', child_id)
          .maybeSingle();

        if (!child) {
          return res.status(404).json({ error: 'No se encontró el registro del menor.' });
        }

        // 2. Enrollment de EQUIPO (independiente)
        let enrollmentsCreated = 0;
        let teamName = 'Equipo';
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', data.team_id).single();
          if (team) teamName = team.name;

          const eid = await createEnrollment({
            childId: child_id, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 3. Enrollment de PLAN (independiente)
        if (data.offering_plan_id && data.offering_id) {
          const eid = await createEnrollment({
            childId: child_id, schoolId,
            status: 'active',
            startDate: data.start_date,
            offeringPlanId: data.offering_plan_id,
            offeringId: data.offering_id,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 4. Pagos proporcionales
        let paymentCreated = false;
        if (data.monthly_fee && data.monthly_fee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(data.monthly_fee * (1 - data.discount_pct / 100))
            : data.monthly_fee;

          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const { error: payErr } = await supabase.from('payments').insert({
            child_id:     child_id,
            school_id:    schoolId,
            branch_id:    data.branch_id || null,
            team_id:      data.team_id || null,
            offering_plan_id: data.offering_plan_id || null,
            amount:       payCalc.amount,
            concept:      `Suscripción — ${payCalc.description} — ${child.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date:     payCalc.dueDate,
            status:       'pending',
            payment_type: 'subscription',
          });
          if (!payErr) paymentCreated = true;
        }

        return res.status(201).json({
          success: true,
          child_id: child_id,
          enrollments_created: enrollmentsCreated,
          payment_created: paymentCreated,
          message: `${child.full_name} inscrito correctamente. ${enrollmentsCreated} inscripción(es) creada(s).`,
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // FLUJO C — Atleta sin cuenta → solo invitación
      // ══════════════════════════════════════════════════════════════════════
      if (data.type === 'adult_invite') {
        // Verificar si ya hay invitación pendiente/aceptada
        const { data: existingInvite } = await supabase
          .from('invitations')
          .select('id')
          .eq('school_id', schoolId)
          .eq('email', data.email)
          .in('status', ['pending', 'accepted'])
          .maybeSingle();

        if (existingInvite) {
          return res.status(409).json({
            error: `Ya existe una invitación activa para ${data.email}.`,
          });
        }

        const { data: invite, error: invErr } = await supabase
          .from('invitations')
          .insert({
            email:          data.email,
            school_id:      schoolId,
            role_to_assign: 'athlete',
            invited_by:     req.user?.id || null,
            status:         'pending',
          })
          .select('id')
          .single();

        if (invErr || !invite) {
          return res.status(500).json({ error: invErr?.message || 'Error creando invitación.' });
        }

        // Fire-and-forget email branded por escuela
        const { emailClient } = await import('../utils/emailClient');
        const { BrandedEmailTemplates } = await import('../utils/emailTemplates');
        const link = `${origin}/register?email=${encodeURIComponent(data.email)}&role=athlete&invite=${invite.id}`;
        try {
          const tpl = await BrandedEmailTemplates.invitation({
            parentName: data.email.split('@')[0],
            childName: '',
            schoolId,
            inviteLink: link,
          });
          emailClient.send({
            to: data.email,
            subject: tpl.subject,
            html: tpl.html,
          }).catch((e: any) => req.log?.error({ email: data.email, err: e }, 'Fallo email invitación'));
        } catch (e: any) {
          req.log?.error({ email: data.email, err: e }, 'Fallo template branded');
        }

        return res.status(201).json({
          success: true,
          invitation_id: invite.id,
          registration_link: link,
          message: `Invitación enviada a ${data.email}. Una vez se registre podrás inscribirlo.`,
        });
      }

      // ── FLUJO D: Atleta adulto sin cuenta ──────────────────────────────────────────
      if (data.type === 'unregistered_adult') {
        const { data: ua, error: uaErr } = await supabase
          .from('unregistered_athletes')
          .insert({
            school_id:     schoolId,
            doc_type:      data.doc_type      || null,
            doc_number:    data.doc_number    || null,
            full_name:     data.full_name,
            email:         data.email         || null,
            phone:         data.phone         || null,
            date_of_birth: data.date_of_birth || null,
            gender:        data.gender        || null,
            branch_id:     data.branch_id     || null,
            is_active:     true,
          })
          .select('id')
          .single();

        if (uaErr || !ua) {
          return res.status(500).json({ error: uaErr?.message || 'Error al registrar atleta.' });
        }

        const uaId = ua.id;
        let enrollmentsCreated = 0;

        let teamName = 'Equipo';
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name').eq('id', data.team_id).single();
          if (team) teamName = team.name;

          const eid = await createEnrollment({
            unregisteredAthleteId: uaId, schoolId,
            status: 'active',
            startDate: data.start_date, teamId: data.team_id, 
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        if (data.offering_plan_id && data.offering_id) {
          const eid = await createEnrollment({
            unregisteredAthleteId: uaId, schoolId,
            status: 'active',
            startDate: data.start_date,
            offeringPlanId: data.offering_plan_id,
            offeringId: data.offering_id, 
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // Pago proporcional
        if (data.team_id != null && data.monthly_fee && data.monthly_fee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(data.monthly_fee * (1 - data.discount_pct / 100))
            : data.monthly_fee;

          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          await supabase.from('payments').insert({
            school_id: schoolId, branch_id: data.branch_id || null,
            unregistered_athlete_id: uaId,
            team_id: data.team_id,
            amount: payCalc.amount,
            concept: `Equipo ${teamName} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date: payCalc.dueDate, status: 'pending', payment_type: 'subscription',
          });
        }

        // Pago del plan
        if (data.offering_plan_id && data.offering_id) {
          const { data: plan } = await supabase
            .from('offering_plans')
            .select('price, name')
            .eq('id', data.offering_plan_id)
            .single();

          if (plan && plan.price >= 10000) {
            const effectiveFee = data.discount_pct
              ? Math.round(Number(plan.price) * (1 - data.discount_pct / 100))
              : Number(plan.price);

            const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
            await supabase.from('payments').insert({
              school_id: schoolId, branch_id: data.branch_id || null,
              unregistered_athlete_id: uaId,
              offering_plan_id: data.offering_plan_id,
              amount: payCalc.amount,
              concept: `Plan ${plan.name} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
              due_date: payCalc.dueDate, status: 'pending', payment_type: 'subscription',
            });
          }
        }


        let invitationSent = false;
        let invite: any = null;
        if (data.send_invite && data.email) {
          const { data: existingInv } = await supabase.from('invitations').select('id')
            .eq('school_id', schoolId).eq('email', data.email)
            .in('status', ['pending', 'accepted']).maybeSingle();

          if (!existingInv) {
            // Calcular el monto efectivo descontado para guardarlo en la invitación
            let invMonthlyFee: number | null = null;
            if (data.offering_plan_id && data.offering_id) {
              const { data: plan } = await supabase
                .from('offering_plans').select('price').eq('id', data.offering_plan_id).single();
              if (plan) {
                invMonthlyFee = data.discount_pct
                  ? Math.round(Number(plan.price) * (1 - data.discount_pct / 100))
                  : Number(plan.price);
              }
            } else if (data.monthly_fee) {
              invMonthlyFee = data.discount_pct
                ? Math.round(data.monthly_fee * (1 - data.discount_pct / 100))
                : data.monthly_fee;
            }

            const { data: inviteData } = await supabase.from('invitations')
              .insert({
                email: data.email, school_id: schoolId,
                role_to_assign: 'athlete', invited_by: req.user?.id || null, status: 'pending',
                offering_plan_id: data.offering_plan_id || null,
                team_id: data.team_id || null,
                monthly_fee: invMonthlyFee,
                parent_phone: data.phone || null,
              })
              .select('id').single();

            if (inviteData) {
              invite = inviteData;
              // Vincular invitación al registro
              await supabase.from('unregistered_athletes')
                .update({ invitation_id: invite.id }).eq('id', uaId);

              invitationSent = true;
              const { emailClient }          = await import('../utils/emailClient');
              const { BrandedEmailTemplates } = await import('../utils/emailTemplates');
              const link = `${origin}/register?email=${encodeURIComponent(data.email)}&role=athlete&invite=${invite.id}`;
              try {
                const tpl = await BrandedEmailTemplates.invitation({
                  parentName: data.full_name,
                  childName: '',
                  schoolId,
                  inviteLink: link,
                });
                emailClient.send({
                  to: data.email,
                  subject: tpl.subject,
                  html: tpl.html,
                }).catch((e: any) => req.log?.error({ err: e }, 'Fallo email'));
              } catch (e: any) {
                req.log?.error({ err: e }, 'Fallo template branded');
              }
            }
          }
        }

        return res.status(201).json({
          success: true,
          unregistered_athlete_id: uaId,
          enrollments_created: enrollmentsCreated,
          invitation_sent: invitationSent,
          registration_link: invitationSent && data.email
            ? `${origin}/register?email=${encodeURIComponent(data.email)}&role=athlete&invite=${invite?.id ?? ''}`
            : null,
          phone: data.phone ?? null,
          message: `${data.full_name} registrado.${invitationSent ? ` Invitación enviada a ${data.email}.` : ''}`,
        });
      }

    } catch (err: any) {
      req.log?.error({ err: err.message || err }, 'Error inesperado en create-one');
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
  }
);

export default router;
