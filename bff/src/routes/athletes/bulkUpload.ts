/**
 * POST /api/v1/athletes/bulk-upload
 *
 * Inserta atletas no registrados desde una migración histórica (ej: Excel).
 * Por cada atleta hace 3 inserts en orden:
 *   1. unregistered_athletes
 *   2. enrollments  (trigger resuelve offering_id automáticamente)
 *   3. payments     (status=paid, payment_channel=manual)
 *
 * Seguridad:
 *  - Requiere autenticación + role staff de escuela.
 *  - El BFF usa service role para los inserts (bypass RLS para velocidad batch),
 *    PERO el school_id efectivo se toma de req.schoolId (del JWT/header), nunca
 *    del body. El campo school_id de cada atleta en el payload se ignora.
 *  - Nunca genera invitaciones — eso se hace manualmente desde el panel después.
 */

import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middlewares/authMiddleware';

const router = Router();

// ── Service role client (bypass RLS) ─────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Tipos ─────────────────────────────────────────────────────────────────────
type DocType = 'CC' | 'TI' | 'RC' | 'CE' | 'PASAPORTE' | 'PPT';
type PaymentMethod = 'transfer' | 'cash' | 'card' | 'pse' | 'other';
type EnrollmentStatus = 'active' | 'pending' | 'overdue';

interface BulkAthleteInput {
  fila?: number;               // número de fila del Excel (solo para trazabilidad)
  /** Ignorado: el school_id efectivo se toma de req.schoolId. Se mantiene en el
   *  tipo para retrocompatibilidad con frontends viejos que aun lo envian. */
  school_id?: string;
  full_name: string;
  doc_type: DocType | null;
  doc_number: string | null;
  phone: string;
  branch_id?: string | null;          // opcional — si null se usa la sede principal
  offering_plan_id: string;
  start_date: string;          // YYYY-MM-DD
  end_date: string;            // YYYY-MM-DD
  expires_at?: string;         // igual a end_date si no se especifica
  enrollment_status: EnrollmentStatus;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;        // YYYY-MM-DD — fecha en que pagó (= start_date)
  concept: string;
}

interface BulkUploadBody {
  /** Ignorado: el school_id efectivo se toma de req.schoolId. */
  school_id?: string;
  athletes: BulkAthleteInput[];
  dry_run?: boolean;           // si true, valida sin insertar
}

interface AthleteResult {
  fila?: number;
  full_name: string;
  status: 'inserted' | 'skipped_duplicate' | 'error';
  unregistered_athlete_id?: string;
  enrollment_id?: string;
  payment_id?: string;
  error?: string;
}

// ── Validación de documento colombiano ───────────────────────────────────────
function isValidDoc(docType: DocType | null, docNumber: string | null): boolean {
  if (!docType || !docNumber) return false;
  const rules: Record<DocType, { pattern: RegExp }> = {
    CC:        { pattern: /^\d{3,10}$/ },
    TI:        { pattern: /^\d{10}$/ },
    RC:        { pattern: /^\d{10}$/ },
    CE:        { pattern: /^\d{3,7}$/ },
    PASAPORTE: { pattern: /^[A-Za-z0-9]{2,9}$/ },
    PPT:       { pattern: /^\d{1,7}$/ },
  };
  return rules[docType]?.pattern.test(docNumber) ?? false;
}

// ── Handler principal ─────────────────────────────────────────────────────────
router.post(
  '/bulk-upload',
  requireAuth,
  requireRole('owner', 'admin', 'super_admin', 'school_admin', 'school'),
  async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as BulkUploadBody;

  // El school_id efectivo SIEMPRE viene del JWT/header, jamás del body.
  // Esto cierra un IDOR cross-tenant donde un admin de escuela A enviaba
  // body.school_id = '<escuela B>' y el service role bypasseaba RLS.
  const schoolId = req.schoolId;
  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId del request es requerido.' });
  }

  if (!Array.isArray(body.athletes) || body.athletes.length === 0) {
    return res.status(400).json({ error: 'Se requiere athletes[] no vacío.' });
  }

  // ── 0. Resolver sede principal de la escuela ─────────────────────────────────
  const { data: mainBranch } = await supabase
    .from('school_branches')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_main', true)
    .single();

  const defaultBranchId: string | null = mainBranch?.id ?? null;

  // ── 1. Verificar que los offering_plan_id existen y pertenecen a la escuela ─
  const planIds = [...new Set(body.athletes.map(a => a.offering_plan_id))];
  const { data: plans, error: plansError } = await supabase
    .from('offering_plans')
    .select('id, price, name')
    .in('id', planIds)
    .eq('school_id', schoolId);

  if (plansError) return res.status(500).json({ error: 'Error validando planes.', detail: plansError.message });

  const foundPlanIds = new Set((plans || []).map((p: any) => p.id));
  const missingPlans = planIds.filter(id => !foundPlanIds.has(id));
  if (missingPlans.length > 0) {
    return res.status(422).json({
      error: 'Algunos offering_plan_id no existen o no pertenecen a esta escuela.',
      missing: missingPlans,
    });
  }

  // ── 2. Pre-flight: documentos duplicados en la BD ─────────────────────────
  const docsToCheck = body.athletes
    .filter(a => a.doc_number)
    .map(a => a.doc_number!);

  const { data: existingDocs } = await supabase
    .from('unregistered_athletes')
    .select('doc_number, doc_type, full_name')
    .eq('school_id', schoolId)
    .in('doc_number', docsToCheck);

  const existingDocSet = new Set(
    (existingDocs || []).map((r: any) => `${r.doc_type}:${r.doc_number}`)
  );

  if (body.dry_run) {
    const preview = body.athletes.map(a => ({
      fila: a.fila,
      full_name: a.full_name,
      would_skip: a.doc_number ? existingDocSet.has(`${a.doc_type}:${a.doc_number}`) : false,
      doc_valid: isValidDoc(a.doc_type, a.doc_number),
    }));
    return res.json({ dry_run: true, total: body.athletes.length, preview });
  }

  // ── 3. Insertar atletas ───────────────────────────────────────────────────
  const results: AthleteResult[] = [];
  let inserted = 0, skipped = 0, errors = 0;

  for (const athlete of body.athletes) {
    const result: AthleteResult = {
      fila: athlete.fila,
      full_name: athlete.full_name,
      status: 'error',
    };

    // Saltar duplicados
    if (athlete.doc_number && existingDocSet.has(`${athlete.doc_type}:${athlete.doc_number}`)) {
      result.status = 'skipped_duplicate';
      results.push(result);
      skipped++;
      continue;
    }

    try {
      // ── STEP 1: unregistered_athletes ──────────────────────────────────────
      const { data: uaData, error: uaError } = await supabase
        .from('unregistered_athletes')
        .insert({
          school_id:   schoolId,
          full_name:   athlete.full_name.trim(),
          doc_type:    athlete.doc_type,
          doc_number:  athlete.doc_number,
          phone:       athlete.phone,
          branch_id:   athlete.branch_id ?? defaultBranchId,  // ← sede principal por defecto
          is_active:   true,
        })
        .select('id')
        .single();

      if (uaError) throw new Error(`unregistered_athletes: ${uaError.message}`);
      const uaId = uaData.id;
      result.unregistered_athlete_id = uaId;

      // ── STEP 2: enrollments ────────────────────────────────────────────────
      // El trigger fn_sync_enrollment_offering_id resuelve offering_id
      // automáticamente desde offering_plan_id → no hay que pasarlo
      const { data: enrollData, error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          school_id:                schoolId,
          unregistered_athlete_id:  uaId,
          offering_plan_id:         athlete.offering_plan_id,
          start_date:               athlete.start_date,
          end_date:                 athlete.end_date,
          expires_at:               athlete.expires_at ?? athlete.end_date,
          status:                   athlete.enrollment_status,
        })
        .select('id')
        .single();

      if (enrollError) throw new Error(`enrollments: ${enrollError.message}`);
      result.enrollment_id = enrollData.id;

      // ── STEP 3: payments ───────────────────────────────────────────────────
      const { data: payData, error: payError } = await supabase
        .from('payments')
        .insert({
          school_id:                schoolId,
          unregistered_athlete_id:  uaId,
          offering_plan_id:         athlete.offering_plan_id,
          amount:                   athlete.amount,
          concept:                  athlete.concept,
          due_date:                 athlete.end_date,
          payment_date:             athlete.payment_date,
          status:                   'paid',
          payment_method:           athlete.payment_method,
          payment_type:             'one_time',
          payment_channel:          'manual',
        })
        .select('id')
        .single();

      if (payError) throw new Error(`payments: ${payError.message}`);
      result.payment_id = payData.id;

      // Marcar como exitoso y agregar a set para evitar duplicados dentro del batch
      result.status = 'inserted';
      if (athlete.doc_number) {
        existingDocSet.add(`${athlete.doc_type}:${athlete.doc_number}`);
      }
      inserted++;

    } catch (err: any) {
      result.status = 'error';
      result.error = err.message;
      errors++;
      // Si falló en step 2 o 3, limpiar el unregistered_athlete creado
      if (result.unregistered_athlete_id && !result.enrollment_id) {
        await supabase
          .from('unregistered_athletes')
          .delete()
          .eq('id', result.unregistered_athlete_id);
        result.unregistered_athlete_id = undefined;
      }
    }

    results.push(result);
  }

  return res.status(200).json({
    summary: {
      total:    body.athletes.length,
      inserted,
      skipped,
      errors,
    },
    results,
  });
});

export default router;
