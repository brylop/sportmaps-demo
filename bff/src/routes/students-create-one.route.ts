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
import { todayInZone } from '../utils/businessDate';


const router = Router();

// ─── Auditoría — alta/edición de atleta por un coach ────────────────────────
// Excepción a la decisión de negocio de docs/coach-athlete-scoping.md, habilitada
// por escuela vía school_settings.coach_can_create_athletes (mig 20260828174117).
// Se deja rastro explícito de quién (coach) creó a quién, porque reabre un
// permiso que el resto de las escuelas tiene cerrado.
async function auditCoachAthleteAction(
  req: AuthenticatedRequest,
  tableName: string,
  recordId: string,
  action: string,
  newData: Record<string, any>,
): Promise<void> {
  if (req.role !== 'coach') return;
  const { error } = await supabase.from('audit_logs').insert({
    school_id:  req.schoolId,
    profile_id: req.user?.id || null,
    table_name: tableName,
    record_id:  recordId,
    action,
    new_data:   newData,
  });
  if (error) req.log?.error({ err: error }, 'Error registrando auditoría de alta por coach');
}

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
  doc_number:    z.string().trim().min(1).nullable().optional(),   // documento opcional
  full_name:     z.string().min(2).max(150).trim(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender:        z.string().nullable().optional(),
  grade:         z.string().max(20).nullable().optional(),
  dorsal:        z.string().trim().max(10).nullable().optional(),
  medical_info:  z.string().optional(),   // JSON con has_allergies
  parent_name:   z.string().min(2),
  // Obligatorio salvo que la escuela active school_settings.parent_email_optional
  // (Carmel Club) — validado a mano después del parse, no acá, porque Zod no
  // conoce settings de la escuela en este punto.
  parent_email:  z.string().email().nullable().optional(),
  parent_phone:  z.string().regex(/^\d{10,}$/),
  send_invite:   z.boolean().default(true),
  /** Confirmación explícita del staff: "ya vi el duplicado, son personas distintas". */
  allow_duplicate: z.boolean().default(false),
  /** Escape para el mayor de edad que la escuela igual quiere bajo un acudiente
   *  (caso real: atleta con discapacidad, o deportista de 18 que sigue con el
   *  papá como responsable de pago). Explícito, nunca por defecto. */
  allow_adult_as_child: z.boolean().default(false),
});

const AdultExistingSchema = EnrollmentBase.extend({
  type:    z.literal('adult_existing'),
  user_id: z.string().uuid(),   // profiles.id
  dorsal:  z.string().trim().max(10).nullable().optional(),
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
  dorsal:        z.string().trim().max(10).nullable().optional(),
  send_invite:   z.boolean().default(false),
  /** Ver ChildSchema.allow_duplicate. */
  allow_duplicate: z.boolean().default(false),
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

// ─── Detección de atleta duplicado ────────────────────────────────────────────
//
// BLOQUEAR Y SUGERIR, nunca adoptar en automático. Un merge equivocado fusiona a
// dos personas distintas y eso es mucho más difícil de deshacer que un duplicado.
// Caso real en Dynasty: las hermanas Mariana y Sofia Ariza Sánchez comparten fecha
// de nacimiento (2011-11-16) y el teléfono del acudiente, así que cualquier
// adopción por teléfono+fecha habría hecho desaparecer a una de las dos.
//
// Por eso acá NO se cruza por teléfono ni por fecha de nacimiento: esas dos
// señales son las que tienen falsos positivos entre hermanos. Se cruza por:
//
//   1. doc_number exacto — señal fuerte, pero en la práctica atrapa poco: en los
//      cuatro duplicados medidos el 2026-08-04 el documento se re-tecleó distinto
//      cada vez (1018475529 vs 1016020710 para la misma Gabriela), así que el
//      match exacto nunca disparó.
//   2. NOMBRE NORMALIZADO — sin acentos, sin mayúsculas, espacios colapsados. Es
//      la que sí atrapa lo observado (Josue Cortes Saenz, Gabriela Buitrago,
//      Julieta Mayorga: nombre idéntico al normalizar) y NO toca a las hermanas
//      Ariza, que se llaman distinto.
//
// Se comparan las tres tablas de identidad de atleta, porque un menor puede estar
// duplicado contra un `unregistered_athletes` y viceversa. (Que existan tres
// tablas de identidad es la causa raíz de fondo; mientras siga así, cada flujo
// nuevo tiene que acordarse de consultar las tres.)

/**
 * Años cumplidos a la fecha de negocio. `null` si no hay fecha de nacimiento.
 *
 * Se usa para decidir QUÉ es cada quien, no solo para mostrarlo: un mayor de
 * edad registrado como `children` con acudiente arrastra una identidad falsa.
 * En Dynasty hay 52 así, y en 28 de ellos el "acudiente" es el propio atleta —
 * se auto-registró como su propio padre porque no había otra forma.
 */
function edadCumplida(dob?: string | null): number | null {
  if (!dob) return null;
  const hoy = todayInZone();
  let años = Number(hoy.slice(0, 4)) - Number(dob.slice(0, 4));
  if (hoy.slice(5) < dob.slice(5)) años -= 1;   // todavía no cumplió este año
  return años;
}

/** minúsculas, sin acentos, espacios colapsados. Para comparar nombres escritos a mano. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita diacriticos (JERONIMO == Jeronimo)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AthleteDuplicate {
  table: 'children' | 'unregistered_athletes';
  id: string;
  full_name: string;
  doc_number: string | null;
  date_of_birth: string | null;
  matched_by: 'doc_number' | 'nombre';
}

/**
 * Busca un atleta ya registrado en la escuela que sea probablemente la misma
 * persona. Devuelve el primer match, priorizando documento sobre nombre.
 *
 * Trae el padrón de la escuela y compara en memoria a propósito: la comparación
 * de nombres necesita quitar acentos y PostgREST no expone `unaccent`. Con ~400
 * atletas por escuela el costo es irrelevante frente a un alta.
 */
async function findExistingAthlete(
  schoolId: string,
  opts: { docNumber?: string | null; fullName?: string | null },
): Promise<AthleteDuplicate | null> {
  const doc = opts.docNumber?.trim() || null;
  const name = opts.fullName ? normalizeName(opts.fullName) : null;
  if (!doc && !name) return null;

  const [kids, unreg] = await Promise.all([
    supabase.from('children')
      .select('id, full_name, doc_number, date_of_birth')
      .eq('school_id', schoolId),
    supabase.from('unregistered_athletes')
      .select('id, full_name, doc_number, date_of_birth')
      .eq('school_id', schoolId),
  ]);

  const pool: Array<AthleteDuplicate> = [
    ...((kids.data ?? []) as any[]).map(r => ({ ...r, table: 'children' as const, matched_by: 'nombre' as const })),
    ...((unreg.data ?? []) as any[]).map(r => ({ ...r, table: 'unregistered_athletes' as const, matched_by: 'nombre' as const })),
  ];

  // Documento primero: es la señal más fuerte cuando existe.
  if (doc) {
    const hit = pool.find(r => (r.doc_number ?? '').trim() === doc);
    if (hit) return { ...hit, matched_by: 'doc_number' };
  }

  if (name) {
    const hit = pool.find(r => normalizeName(r.full_name ?? '') === name);
    if (hit) return { ...hit, matched_by: 'nombre' };
  }

  return null;
}

/** Cuerpo del 409. La ruta es staff-only, así que devolver el registro hallado no
 *  expone datos de otra familia a un tercero — el caller ya administra ese padrón.
 *  OJO: si algún día esto se expone al flujo del acudiente (QR público), la
 *  respuesta debe degradarse a un mensaje sin nombres. */
function duplicateResponse(dup: AthleteDuplicate) {
  const como = dup.matched_by === 'doc_number'
    ? `el documento ${dup.doc_number}`
    : 'el mismo nombre';
  return {
    error: `Ya existe un atleta con ${como} en esta escuela: "${dup.full_name}". `
         + 'Si es la misma persona, editá ese registro en vez de crear uno nuevo. '
         + 'Si son personas distintas, reenviá con allow_duplicate = true.',
    duplicate: dup,
    existing_id: dup.id,   // se conserva por compatibilidad con el cliente actual
  };
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
  monthlyFee?: number | null;
  log?: any;
}): Promise<string | null> {
  const { childId, userId, unregisteredAthleteId, schoolId, startDate, status, teamId, offeringPlanId, offeringId, monthlyFee, log } = params;

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

  // Cuota individual editable (fuente de verdad del monto — ver fee-source).
  if (monthlyFee != null && monthlyFee > 0) {
    record.monthly_fee = monthlyFee;
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

// Cobro de inscripción/matrícula, aparte de la mensualidad (D17-D19,
// docs/specs/dreamers-niveles-por-horas-y-progresion.md §9.2). Fila `one_time`
// SIN período — no compite con uniq_payment_active_period_* (esa solo aplica a
// filas con period_year/period_month no nulos) y no toca calcFirstPayment.
// NULL/0 en offering_plans.registration_fee = sin cobro, comportamiento actual.
async function chargeRegistrationFeeIfApplicable(params: {
  schoolId: string;
  branchId?: string | null;
  offeringPlanId: string | null;
  planName: string | null;
  registrationFee: number | null;
  dueDate: string;
  personName: string;
  childId?: string | null;
  userId?: string | null;
  unregisteredAthleteId?: string | null;
  log?: any;
}): Promise<boolean> {
  const { offeringPlanId, registrationFee } = params;
  if (!offeringPlanId || !registrationFee || registrationFee <= 0) return false;

  const { error } = await supabase.from('payments').insert({
    school_id:               params.schoolId,
    branch_id:               params.branchId || null,
    child_id:                params.childId || null,
    user_id:                 params.userId || null,
    unregistered_athlete_id: params.unregisteredAthleteId || null,
    offering_plan_id:        offeringPlanId,
    amount:                  registrationFee,
    concept:                 `Inscripción — ${params.planName || 'Plan'} — ${params.personName}`,
    due_date:                params.dueDate,
    status:                  'pending',
    payment_type:            'one_time',
    period_year:             null,
    period_month:            null,
    payment_category:        'inscripcion',
  });

  if (error) {
    params.log?.error({ err: error }, 'Error creando cobro de inscripción');
    return false;
  }
  return true;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post(
  '/create-one',
  requireAuth,
  // Alta de atletas: admin/owner de la escuela, o coach si la escuela lo activó
  // (school_settings.coach_can_create_athletes — excepción de Carmel Club, ver
  // mig 20260828174117). Por default el coach sigue sin poder: se rechaza más
  // abajo, después de leer settings, no en esta lista estática.
  requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school', 'coach'),
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
          .select('billing_cycle_type, payment_cutoff_day, require_payment_proof, coach_can_create_athletes, parent_email_optional')
          .eq('school_id', schoolId)
          .maybeSingle(),
      ]);
      const schoolName     = normalizeSchoolName(school?.name || 'la Academia');
      const cycleType      = (settings?.billing_cycle_type || 'prorated') as BillingCycleType;
      const cutoffDay      = settings?.payment_cutoff_day || 10;
      const requireProof   = settings?.require_payment_proof ?? true;

      // Sin fila de settings se aplica el default de la columna (false): un
      // coach solo pasa si la escuela lo activó explícitamente.
      if (req.role === 'coach' && !settings?.coach_can_create_athletes) {
        return res.status(403).json({
          error: 'Esta escuela no permite que un entrenador dé de alta atletas. Pídelo a la escuela.',
        });
      }

      // parent_email es opcional en el schema (para que la escuela con el
      // flag pueda omitirlo), pero para el resto sigue siendo obligatorio —
      // se valida acá porque Zod no conoce settings de la escuela.
      if (data.type === 'child' && !data.parent_email && !settings?.parent_email_optional) {
        return res.status(400).json({ error: 'El email del acudiente es obligatorio.' });
      }

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
        // 0. ¿De verdad es un menor?
        //
        // El tipo lo elige quien llama, y hasta acá nadie lo contrastaba contra
        // la fecha de nacimiento. Por eso hay 52 adultos en Dynasty modelados
        // como menores con acudiente ficticio. Un mayor de edad es un ATLETA:
        // entra con su cuenta, paga y recibe los avisos él mismo.
        const edad = edadCumplida(data.date_of_birth);
        if (edad !== null && edad >= 18 && !data.allow_adult_as_child) {
          return res.status(409).json({
            error: `${data.full_name} tiene ${edad} años: es mayor de edad y va como atleta, no como menor con acudiente.`,
            reason: 'mayor_de_edad',
            edad,
            sugerencia: 'Usa el alta de atleta adulto (type "adult_invite" si no tiene cuenta, '
                      + '"adult_existing" si ya se registró). Así entra con su propia cuenta y recibe los avisos.',
            forzar_con: 'allow_adult_as_child',
          });
        }

        // 1. Duplicado ya registrado en la escuela.
        //
        // Antes esto solo miraba `children` y solo por `doc_number` exacto. Con eso
        // pasaron los cuatro duplicados del 2026-08-04: el documento se re-tecleó
        // distinto cada vez, así que el match nunca disparó. Ahora cruza también por
        // nombre normalizado y contra `unregistered_athletes` — un menor puede estar
        // duplicado contra un registro que la escuela creó sin cuenta.
        if (!data.allow_duplicate) {
          const dup = await findExistingAthlete(schoolId, {
            docNumber: data.doc_number,
            fullName: data.full_name,
          });
          if (dup) return res.status(409).json(duplicateResponse(dup));
        }

        // 2. INSERT children
        const { data: child, error: childErr } = await supabase
          .from('children')
          .insert({
            full_name:         data.full_name,
            doc_type:          data.doc_type,
            doc_number:        data.doc_number || null,
            date_of_birth:     data.date_of_birth     || null,
            gender:            data.gender             || null,
            grade:             data.grade              || null,
            dorsal:            data.dorsal             || null,
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

        // ── UN atleta = UNA inscripción = UN cobro ─────────────────────────────
        // El equipo es roster; el plan es lo que se cobra. Cuota efectiva:
        // monthly_fee editado > precio del plan > precio del equipo.
        const hasPlan = !!(data.offering_plan_id && data.offering_id);

        let teamName = 'Equipo'; let teamPrice: number | null = null;
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name, price_monthly').eq('id', data.team_id).single();
          if (team) { teamName = team.name; teamPrice = team.price_monthly != null ? Number(team.price_monthly) : null; }
        }
        let planName: string | null = null; let planPrice: number | null = null; let planRegistrationFee: number | null = null;
        if (hasPlan) {
          const { data: plan } = await supabase.from('offering_plans').select('price, name, registration_fee').eq('id', data.offering_plan_id).single();
          if (plan) { planName = plan.name; planPrice = plan.price != null ? Number(plan.price) : null; planRegistrationFee = plan.registration_fee != null ? Number(plan.registration_fee) : null; }
        }

        // plan manda si hay plan; si no, equipo. monthly_fee editado tiene prioridad.
        const baseFee: number | null =
          (data.monthly_fee && data.monthly_fee > 0) ? data.monthly_fee
          : hasPlan ? planPrice
          : teamPrice;

        // UNA sola inscripción con equipo (roster) y/o plan (cobro) referenciados.
        if (data.team_id || hasPlan) {
          const eid = await createEnrollment({
            childId, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id || null,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            offeringId: hasPlan ? data.offering_id : null,
            monthlyFee: baseFee,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // UN solo cobro proporcional = cuota efectiva.
        let paymentCreated = false;
        if (baseFee && baseFee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(baseFee * (1 - data.discount_pct / 100))
            : baseFee;
          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const conceptName = planName ? `Plan ${planName}` : `Equipo ${teamName}`;
          const { error: payErr } = await supabase.from('payments').insert({
            child_id:         childId,
            school_id:        schoolId,
            branch_id:        data.branch_id || null,
            team_id:          data.team_id || null,
            offering_plan_id: hasPlan ? data.offering_plan_id : null,
            amount:           payCalc.amount,
            concept:          `${conceptName} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date:         payCalc.dueDate,
            status:           'pending',
            payment_type:     'subscription',
            // Explícito, NO derivado del due_date por trg_payments_fill_period:
            // ese camino mandaba el cobro al mes siguiente y dejaba el mes de
            // entrada sin facturar. Además, sin periodo el cobro se escapa de
            // uniq_payment_active_period_* y se puede duplicar el mes.
            period_year:      payCalc.periodYear,
            period_month:     payCalc.periodMonth,
          });
          if (!payErr) paymentCreated = true;
          else req.log?.error({ err: payErr }, 'Error creando pago menor');

          await chargeRegistrationFeeIfApplicable({
            schoolId, branchId: data.branch_id,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            planName, registrationFee: planRegistrationFee,
            dueDate: payCalc.dueDate, personName: data.full_name,
            childId, log: req.log,
          });
        }


        // 5. Invitación al acudiente
        // Sin parent_email (escuela con parent_email_optional) no hay a quién
        // invitar: el menor queda registrado sin acudiente con acceso a la cuenta.
        let invitationSent = false;
        let invite: any = null;
        const existingInvite = data.parent_email
          ? (await supabase
              .from('invitations')
              .select('id')
              .eq('school_id', schoolId)
              .eq('email', data.parent_email)
              .in('status', ['pending', 'accepted'])
              .maybeSingle()).data
          : null;

        if (data.parent_email && !existingInvite) {
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
            if (data.send_invite !== false) {
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
        }

        const registrationLink = invitationSent && data.parent_email
          ? `${origin}/register?email=${encodeURIComponent(data.parent_email)}&role=parent&invite=${invite?.id ?? ''}`
          : null;

        await auditCoachAthleteAction(req, 'children', childId, 'COACH_CREATE_ATHLETE', {
          full_name: data.full_name, type: 'child',
        });

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
            dorsal:     data.dorsal || null,
            joined_at:  new Date().toISOString(),
          });
          if (memberErr) {
            req.log?.error({ err: memberErr }, 'Error creando school_member');
            // No bloqueamos — igual creamos el enrollment
          }
        } else if (data.dorsal) {
          const { error: dorsalErr } = await supabase
            .from('school_members')
            .update({ dorsal: data.dorsal })
            .eq('id', existingMember.id);
          if (dorsalErr) {
            req.log?.error({ err: dorsalErr }, 'Error actualizando dorsal de school_member');
          }
        }

        // ── UN atleta = UNA inscripción = UN cobro (plan manda; equipo = roster) ─
        let enrollmentsCreated = 0;
        const hasPlan = !!(data.offering_plan_id && data.offering_id);

        let teamName = 'Equipo'; let teamPrice: number | null = null;
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name, price_monthly').eq('id', data.team_id).single();
          if (team) { teamName = team.name; teamPrice = team.price_monthly != null ? Number(team.price_monthly) : null; }
        }
        let planName: string | null = null; let planPrice: number | null = null; let planRegistrationFee: number | null = null;
        if (hasPlan) {
          const { data: plan } = await supabase.from('offering_plans').select('price, name, registration_fee').eq('id', data.offering_plan_id).single();
          if (plan) { planName = plan.name; planPrice = plan.price != null ? Number(plan.price) : null; planRegistrationFee = plan.registration_fee != null ? Number(plan.registration_fee) : null; }
        }

        const baseFee: number | null =
          (data.monthly_fee && data.monthly_fee > 0) ? data.monthly_fee
          : hasPlan ? planPrice
          : teamPrice;

        if (data.team_id || hasPlan) {
          const eid = await createEnrollment({
            userId, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id || null,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            offeringId: hasPlan ? data.offering_id : null,
            monthlyFee: baseFee,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // UN solo cobro proporcional = cuota efectiva.
        let paymentCreated = false;
        if (baseFee && baseFee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(baseFee * (1 - data.discount_pct / 100))
            : baseFee;
          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const conceptName = planName ? `Plan ${planName}` : `Equipo ${teamName}`;
          const { error: payErr } = await supabase.from('payments').insert({
            user_id:          userId,
            school_id:        schoolId,
            branch_id:        data.branch_id || null,
            team_id:          data.team_id || null,
            offering_plan_id: hasPlan ? data.offering_plan_id : null,
            amount:           payCalc.amount,
            concept:          `${conceptName} — ${payCalc.description} — ${profile.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date:         payCalc.dueDate,
            status:           'pending',
            payment_type:     'subscription',
            period_year:      payCalc.periodYear,
            period_month:     payCalc.periodMonth,
          });
          if (!payErr) paymentCreated = true;
          else req.log?.error({ err: payErr }, 'Error creando pago adulto');

          await chargeRegistrationFeeIfApplicable({
            schoolId, branchId: data.branch_id,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            planName, registrationFee: planRegistrationFee,
            dueDate: payCalc.dueDate, personName: profile.full_name,
            userId, log: req.log,
          });
        }


        await auditCoachAthleteAction(req, 'profiles', userId, 'COACH_CREATE_ATHLETE', {
          full_name: profile.full_name, type: 'adult_existing',
        });

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

        // UNA sola inscripción con equipo (roster) y/o plan (cobro).
        let enrollmentsCreated = 0;
        const hasPlan = !!(data.offering_plan_id && data.offering_id);
        let planName: string | null = null; let planRegistrationFee: number | null = null;
        if (hasPlan) {
          const { data: plan } = await supabase.from('offering_plans').select('name, registration_fee').eq('id', data.offering_plan_id).single();
          if (plan) { planName = plan.name; planRegistrationFee = plan.registration_fee != null ? Number(plan.registration_fee) : null; }
        }
        if (data.team_id || hasPlan) {
          const eid = await createEnrollment({
            childId: child_id, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id || null,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            offeringId: hasPlan ? data.offering_id : null,
            monthlyFee: (data.monthly_fee && data.monthly_fee > 0) ? data.monthly_fee : null,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // 4. UN solo cobro proporcional (ya era único aquí).
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
            period_year:  payCalc.periodYear,
            period_month: payCalc.periodMonth,
          });
          if (!payErr) paymentCreated = true;

          await chargeRegistrationFeeIfApplicable({
            schoolId, branchId: data.branch_id,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            planName, registrationFee: planRegistrationFee,
            dueDate: payCalc.dueDate, personName: child.full_name,
            childId: child_id, log: req.log,
          });
        }

        await auditCoachAthleteAction(req, 'children', child_id, 'COACH_CREATE_ATHLETE', {
          full_name: child.full_name, type: 'child_existing',
        });

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

        await auditCoachAthleteAction(req, 'invitations', invite.id, 'COACH_CREATE_ATHLETE', {
          email: data.email, type: 'adult_invite',
        });

        return res.status(201).json({
          success: true,
          invitation_id: invite.id,
          registration_link: link,
          message: `Invitación enviada a ${data.email}. Una vez se registre podrás inscribirlo.`,
        });
      }

      // ── FLUJO D: Atleta adulto sin cuenta ──────────────────────────────────────────
      if (data.type === 'unregistered_adult') {
        // Esta rama NO tenía ningún chequeo: insertaba directo. Es la que creó
        // DAIMARIS VASQUEZ PEREZ tres minutos antes de que la misma persona
        // apareciera como atleta adulta con su propia cuenta.
        if (!data.allow_duplicate) {
          const dup = await findExistingAthlete(schoolId, {
            docNumber: data.doc_number,
            fullName: data.full_name,
          });
          if (dup) return res.status(409).json(duplicateResponse(dup));
        }

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
            dorsal:        data.dorsal        || null,
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

        // ── UN atleta = UNA inscripción = UN cobro (plan manda; equipo = roster) ─
        const hasPlan = !!(data.offering_plan_id && data.offering_id);

        let teamName = 'Equipo'; let teamPrice: number | null = null;
        if (data.team_id) {
          const { data: team } = await supabase.from('teams').select('name, price_monthly').eq('id', data.team_id).single();
          if (team) { teamName = team.name; teamPrice = team.price_monthly != null ? Number(team.price_monthly) : null; }
        }
        let planName: string | null = null; let planPrice: number | null = null; let planRegistrationFee: number | null = null;
        if (hasPlan) {
          const { data: plan } = await supabase.from('offering_plans').select('price, name, registration_fee').eq('id', data.offering_plan_id).single();
          if (plan) { planName = plan.name; planPrice = plan.price != null ? Number(plan.price) : null; planRegistrationFee = plan.registration_fee != null ? Number(plan.registration_fee) : null; }
        }

        const baseFee: number | null =
          (data.monthly_fee && data.monthly_fee > 0) ? data.monthly_fee
          : hasPlan ? planPrice
          : teamPrice;

        if (data.team_id || hasPlan) {
          const eid = await createEnrollment({
            unregisteredAthleteId: uaId, schoolId,
            status: 'active',
            startDate: data.start_date,
            teamId: data.team_id || null,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            offeringId: hasPlan ? data.offering_id : null,
            monthlyFee: baseFee,
            log: req.log,
          });
          if (eid) enrollmentsCreated++;
        }

        // UN solo cobro proporcional = cuota efectiva.
        if (baseFee && baseFee >= 10000) {
          const effectiveFee = data.discount_pct
            ? Math.round(baseFee * (1 - data.discount_pct / 100))
            : baseFee;
          const payCalc = calcFirstPayment(data.start_date, effectiveFee, cycleType, cutoffDay);
          const conceptName = planName ? `Plan ${planName}` : `Equipo ${teamName}`;
          await supabase.from('payments').insert({
            school_id: schoolId, branch_id: data.branch_id || null,
            unregistered_athlete_id: uaId,
            team_id: data.team_id || null,
            offering_plan_id: hasPlan ? data.offering_plan_id : null,
            amount: payCalc.amount,
            concept: `${conceptName} — ${payCalc.description} — ${data.full_name}${data.discount_pct ? ` (Desc. ${data.discount_pct}%)` : ''}`,
            due_date: payCalc.dueDate, status: 'pending', payment_type: 'subscription',
            period_year: payCalc.periodYear, period_month: payCalc.periodMonth,
          });

          await chargeRegistrationFeeIfApplicable({
            schoolId, branchId: data.branch_id,
            offeringPlanId: hasPlan ? data.offering_plan_id : null,
            planName, registrationFee: planRegistrationFee,
            dueDate: payCalc.dueDate, personName: data.full_name,
            unregisteredAthleteId: uaId, log: req.log,
          });
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

        await auditCoachAthleteAction(req, 'unregistered_athletes', uaId, 'COACH_CREATE_ATHLETE', {
          full_name: data.full_name, type: 'unregistered_adult',
        });

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
