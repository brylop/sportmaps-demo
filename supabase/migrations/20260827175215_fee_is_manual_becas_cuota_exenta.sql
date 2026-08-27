-- =============================================================================
-- 20260827175215_fee_is_manual_becas_cuota_exenta.sql
-- Autor: brylop   Fecha: 2026-08-27   Versión anterior: 20260827174556
-- Objetivo: marcar becas / cuotas exentas por atleta (menor, adulto o no
--   registrado) sin que el mes siguiente le vuelva a cobrar el precio del
--   plan o del equipo.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- EL BUG QUE ESTO CIERRA
--
-- `open_month`/`preview_open_month` resuelven la cuota con
-- `COALESCE(NULLIF(e.monthly_fee, 0), op.price, t.price_monthly, c.monthly_fee, 0)`.
-- `NULLIF(x, 0)` convierte un 0 explícito en NULL, así que un atleta al que se le
-- puso la cuota en 0 a mano (becado) cae igual al precio del plan o del equipo el
-- mes siguiente. Documentado y sin cerrar en docs/plan-tarifa-congelada-c12.md y en
-- docs/specs/sport-categories-and-multi-category.md (D6) — ambos piden la misma
-- columna sin haberla construido. Se unifican acá bajo un solo flag.
--
-- fee_is_manual = true saca al atleta de la cascada por completo: su monto es
-- `COALESCE(e.monthly_fee, 0)` tal cual, sin caer a plan/equipo/children. Sirve
-- tanto para "becado, cuota 0" como para una beca parcial pactada (ej. $50.000 en
-- vez de $180.000) — el mismo flag protege cualquier monto puesto a mano.
-- `fee_reason`/`fee_set_by`/`fee_set_at` dejan el rastro de quién y por qué, para
-- poder responder "¿por qué este atleta no genera cobro?" sin adivinar.
--
-- El cambio va en las DOS funciones (open_month y preview_open_month), con el
-- mismo criterio: si preview no lo refleja, la pantalla de confirmación miente.

BEGIN;

-- ── 1. Columnas en enrollments ───────────────────────────────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS fee_is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_reason    text,
  ADD COLUMN IF NOT EXISTS fee_set_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fee_set_at    timestamptz;

COMMENT ON COLUMN public.enrollments.fee_is_manual IS
  'true = la cuota (monthly_fee) fue puesta a mano y manda tal cual, sin caer al precio del plan/equipo/children. Cubre becas (monto 0) y descuentos negociados (monto > 0 distinto del catálogo).';
COMMENT ON COLUMN public.enrollments.fee_reason IS
  'Motivo libre de la cuota manual (ej. "Beca deportiva", "Convenio interinstitucional", "Descuento hermano"). Solo tiene sentido junto a fee_is_manual = true.';
COMMENT ON COLUMN public.enrollments.fee_set_by IS
  'Quién marcó la cuota como manual por última vez.';
COMMENT ON COLUMN public.enrollments.fee_set_at IS
  'Cuándo se marcó la cuota como manual por última vez.';

-- ── 2. open_month: respeta fee_is_manual antes de caer a la cascada ─────────
CREATE OR REPLACE FUNCTION public.open_month(
  p_school_id uuid,
  p_year      int,
  p_month     int,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_created     int := 0;
  v_caller      uuid := auth.uid();
BEGIN
  -- Autorización: admin de la escuela / super admin. El cron y service_role
  -- corren sin auth.uid() (v_caller NULL) y pasan.
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  -- Serializa por (escuela, periodo): dos disparadores concurrentes (doble-clic,
  -- cron + botón el mismo día) esperan en fila → cero duplicados por carrera.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );

  WITH elegibles AS (
    -- Una fila por ATLETA. Ver el encabezado: el desempate no mira el monto.
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,                       -- solo el menor tiene acudiente; adulto/unreg → NULL
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      -- Cuota manual (beca / descuento pactado): manda tal cual, sin caer a la
      -- cascada. Un becado con fee_is_manual=true y monthly_fee=0 queda con
      -- amount=0 y lo filtra el `fee.amount > 0` de abajo — no genera cobro.
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0),
                 0
               )
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))  -- adulto (incl. legacy en parent_id)
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)  -- legacy sin periodo
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,   -- 1. el plan gobierna el cobro
             (e.team_id IS NOT NULL)          DESC,   -- 2. antes que una huérfana
             e.created_at ASC                         -- 3. la más antigua: carga el historial
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month
    )
    SELECT
      el.school_id,
      el.branch_id,
      el.parent_id,
      el.child_id,
      el.user_id,
      el.unregistered_athlete_id,
      el.team_id,
      el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount,
      v_due,
      'pending',
      'subscription',
      p_year::smallint,
      p_month::smallint
    FROM elegibles el
    -- Cinturón (§11.3): el DISTINCT ON deduplica por la clave que elegimos. Basta una
    -- vía futura que produzca un choque no contemplado para volver a abortar un lote de
    -- 400 cobros. Con esto, ese fallo pasa a ser "se salta esa fila".
    -- No falsea el contador: RETURNING no devuelve las filas que chocan.
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id,
    'year',      p_year,
    'month',     p_month,
    'due_date',  v_due,
    'generados', v_created
  );
END;
$$;

COMMENT ON FUNCTION public.open_month(uuid, int, int, uuid) IS
  'Genera las cuotas del mes para una escuela por una sola vía canónica (period poblado, subscription, sin prorrateo, dedup por mes calendario, advisory lock). Un cobro por ATLETA: DISTINCT ON con desempate plan > equipo > más antigua, sin mirar el monto. fee_is_manual=true salta la cascada (plan/equipo/children) y respeta el monto puesto a mano, incluido 0 (becado). Idempotente. Reemplaza cron/botón/insert client-side. OJO: no persiste ninguna apertura — monthly_closes no existe todavía, así que abrir el mes no deja rastro (desviación consciente respecto del spec del ciclo de mes).';

-- Preview: qué generaría, sin persistir (mismo criterio que open_month)
CREATE OR REPLACE FUNCTION public.preview_open_month(
  p_school_id uuid,
  p_year      int,
  p_month     int,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_month_start date := make_date(p_year, p_month, 1);
  v_month_end   date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff      int;
  v_due         date;
  v_items       jsonb;
  v_caller      uuid := auth.uid();
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10) INTO v_cutoff
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));

  -- MISMO CTE que open_month. Si acá el criterio difiere, la pantalla de confirmación
  -- miente respecto de lo que se va a generar.
  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT CASE
               WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
               ELSE COALESCE(
                 NULLIF(e.monthly_fee, 0),
                 NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
                 NULLIF(t.price_monthly, 0),
                 NULLIF(c.monthly_fee, 0), 0)
             END AS amount
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.preview_open_month(uuid, int, int, uuid) IS
  'Vista previa de open_month sin persistir. Para la pantalla de confirmación del botón Generar. Lleva el MISMO DISTINCT ON, desempate y trato de fee_is_manual que open_month: si difieren, el preview miente.';

-- ── 3. school_athletes: expone fee_is_manual/fee_reason para el badge ───────
CREATE OR REPLACE VIEW public.school_athletes AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
            ELSE false
        END AS fee_is_manual,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
            WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
            ELSE NULL::text
        END AS fee_reason
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
  WHERE ua.linked_profile_id IS NULL;

COMMENT ON VIEW public.school_athletes IS
  'Vista unificada de atletas (child/adult/unregistered) para SchoolStudentsManagementPage. '
  'enrollment_id = COALESCE(inscripción con equipo, inscripción con plan). '
  'fee_is_manual/fee_reason pasan del enrollment que gobierna el precio (plan > equipo) — '
  'permiten mostrar el badge "Becado"/cuota negociada. Actualizado 2026-08-27 para exponerlos.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ──────────────────────────────────────────
--
-- 1) Las columnas nuevas existen:
--
--    SELECT column_name, data_type, column_default FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'enrollments'
--       AND column_name IN ('fee_is_manual','fee_reason','fee_set_by','fee_set_at');
--
-- 2) Marcar un atleta becado a mano y confirmar que preview_open_month lo excluye
--    aunque su plan/equipo tenga precio:
--
--    UPDATE public.enrollments SET fee_is_manual = true, monthly_fee = 0,
--           fee_reason = 'Beca deportiva (prueba)'
--     WHERE id = '<enrollment_id de prueba>';
--    SELECT public.preview_open_month('<school_id>', 2026, 9);
--    -- el atleta marcado NO debe aparecer en 'items'.
--
-- 3) Confirmar que sin fee_is_manual el comportamiento no cambió (0 sigue cayendo
--    al precio del plan/equipo, igual que antes de esta migración).
--
-- Vuelta atrás: migración nueva que reponga el CASE sin fee_is_manual (cuerpo de
-- 20260803114540 para las funciones, 20260827144226 para la vista) y un
-- ALTER TABLE ... DROP COLUMN para las columnas si hiciera falta.
