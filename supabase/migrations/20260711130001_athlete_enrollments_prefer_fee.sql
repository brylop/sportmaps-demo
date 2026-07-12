-- ============================================================
-- SPORTMAPS — get_athlete_enrollments: la cuota individual manda
-- ------------------------------------------------------------
-- La versión instalada calculaba price_monthly como
--   COALESCE(t.price_monthly, op.price, 0)
-- es decir, ignoraba la cuota individual editable del atleta
-- (enrollments.monthly_fee, que setea la escuela/PT en "editar deportista").
-- Por eso, tras editar el valor de un equipo/plan, el picker de "Nuevo Pago"
-- del atleta/padre seguía mostrando el precio de catálogo (o $0 si el equipo
-- no tenía precio).
--
-- Fix: anteponer enrollments.monthly_fee. Se conserva EXACTA la firma (RETURNS
-- jsonb) y toda la lógica actual (adultos + menores del padre, dedup contra
-- pagos vigentes, branding). Único cambio: la expresión de price_monthly.
-- Fecha: 2026-07-11
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_athlete_enrollments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  uid     uuid := auth.uid();
  v_today date := (NOW() AT TIME ZONE 'America/Bogota')::date;
  v_data  jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_data
  FROM (
    SELECT
      e.id,
      e.status                                                    AS enrollment_status,
      e.start_date,
      e.expires_at,
      e.sessions_used,
      e.offering_plan_id,
      e.team_id,
      e.child_id,
      c.full_name                                                 AS child_name,
      COALESCE(t.name, op.name)                                   AS program_name,
      t.sport                                                     AS program_sport,
      t.name                                                      AS team_name,
      op.name                                                     AS plan_name,
      -- Cuota individual del atleta primero; luego catálogo (equipo/plan).
      COALESCE(
        NULLIF(e.monthly_fee, 0),
        NULLIF(t.price_monthly, 0),
        NULLIF(op.price, 0),
        0
      )                                                           AS price_monthly,
      s.id                                                        AS school_id,
      s.name                                                      AS school_name,
      s.logo_url                                                  AS school_logo,
      COALESCE(s.branding_settings->>'primary_color','#0ea5e9')   AS school_primary_color
    FROM enrollments e
    LEFT JOIN children       c  ON c.id  = e.child_id
    LEFT JOIN teams          t  ON t.id  = e.team_id
    LEFT JOIN offering_plans op ON op.id = e.offering_plan_id
    LEFT JOIN schools        s  ON s.id  = e.school_id
    WHERE e.status = 'active'
      AND (
        e.user_id  = uid
        OR e.child_id IN (
          SELECT ch.id FROM children ch WHERE ch.parent_id = uid
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM payments p
        WHERE p.school_id = e.school_id
          AND p.status    IN ('pending', 'awaiting_approval', 'paid')
          AND p.due_date  >= v_today
          AND (
            (e.child_id IS NOT NULL AND p.child_id = e.child_id)
            OR (e.user_id IS NOT NULL AND p.user_id = e.user_id)
          )
          AND (
            (e.team_id           IS NOT NULL AND p.team_id           = e.team_id)
            OR (e.offering_plan_id IS NOT NULL AND p.offering_plan_id = e.offering_plan_id)
          )
      )
    ORDER BY c.full_name NULLS LAST, COALESCE(t.name, op.name)
  ) r;

  RETURN v_data;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_athlete_enrollments() TO authenticated;

NOTIFY pgrst, 'reload schema';
