-- ============================================================
-- F0 (2/3) — Generación unificada de cuotas: open_month() + preview_open_month()
-- ------------------------------------------------------------
-- Una sola fuente de verdad que reemplaza las 3 vías incompatibles:
--   A) cron generate_monthly_charges  B) botón manual client-side  C) (C solo listaba)
--
-- Reglas canónicas:
--   - Puebla SIEMPRE period_year/period_month (H2) → los índices únicos aplican.
--   - payment_type = 'subscription' (recurrencia). NUNCA prorratea (cuota completa);
--     el prorrateo pertenece al alta (checkout/QR), no aquí.
--   - Identidad canónica: menor→child_id (+parent_id acudiente); adulto→user_id;
--     no-registrado→unregistered_athlete_id. parent_id NULL para adulto/unreg.
--   - Monto: enrollment.monthly_fee > plan > equipo > hijo (jerarquía probada).
--   - due_date = payment_cutoff_day del mes abierto (acotado a fin de mes).
--   - Dedup por MES CALENDARIO robusto: no genera si ya hay cobro ACTIVO del atleta
--     en el periodo — reconociendo tanto period poblado como legacy (period NULL por
--     due_date), y adultos legacy que viven en parent_id (cron viejo) o user_id.
--   - Concurrencia: advisory lock por (escuela, periodo) → mata doble-clic /
--     cron+botón simultáneos. Idempotente (2ª llamada genera 0).
-- Fecha: 2026-07-24
-- ============================================================

-- Estados que representan una obligación viva (mismo set que los índices únicos).
-- Se define como constante replicada en las funciones para no depender de un enum.

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

  WITH ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month
    )
    SELECT
      e.school_id,
      COALESCE(c.branch_id, t.branch_id),
      c.parent_id,                       -- solo el menor tiene acudiente; adulto/unreg → NULL
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - '
        || COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta'),
      fee.amount,
      v_due,
      'pending',
      'subscription',
      p_year::smallint,
      p_month::smallint
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
        NULLIF(t.price_monthly, 0),
        NULLIF(c.monthly_fee, 0),
        0
      ) AS amount
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
  'Genera las cuotas del mes para una escuela por una sola vía canónica (period poblado, subscription, sin prorrateo, dedup por mes calendario, advisory lock). Idempotente. Reemplaza cron/botón/insert client-side.';

-- Preview: qué generaría, sin persistir (reemplaza el loadPreview client-side)
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta'),
           'tipo',     CASE WHEN e.child_id IS NOT NULL THEN 'menor'
                            WHEN e.user_id  IS NOT NULL THEN 'adulto'
                            ELSE 'no_registrado' END,
           'amount',   fee.amount,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM public.enrollments e
  LEFT JOIN public.children               c  ON c.id  = e.child_id
  LEFT JOIN public.profiles               pr ON pr.id = e.user_id
  LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
  LEFT JOIN public.teams                  t  ON t.id  = e.team_id
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      NULLIF(e.monthly_fee, 0),
      NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
      NULLIF(t.price_monthly, 0),
      NULLIF(c.monthly_fee, 0), 0) AS amount
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
    );

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.preview_open_month(uuid, int, int, uuid) IS
  'Vista previa de open_month sin persistir. Para la pantalla de confirmación del botón Generar.';

-- Grants: authenticated (gate interno por is_school_admin) + service_role (cron/BFF)
REVOKE ALL ON FUNCTION public.open_month(uuid, int, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, int, int, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, int, int, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, int, int, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
