-- ============================================================
-- F0 (3/3) — El cron delega en open_month (fin de la lógica paralela)
-- ------------------------------------------------------------
-- Reescribe generate_monthly_charges() para que sea un thin loop sobre las
-- escuelas con auto_generate_payments que llama a open_month() para el mes en
-- curso (hora Colombia). Así el cron y el botón manual usan EXACTAMENTE el mismo
-- código canónico (period poblado, subscription, dedup por mes, advisory lock).
--
-- El cron.schedule existente ('generate-monthly-charges-daily', 06:30 UTC) sigue
-- apuntando a esta función — no se toca pg_cron.
--
-- Manejo de error POR ESCUELA: una escuela que falle no aborta el batch
-- (savepoint vía BEGIN/EXCEPTION), solo emite WARNING.
-- Fecha: 2026-07-24
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_monthly_charges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_today   date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_year    int  := extract(year  from v_today)::int;
  v_month   int  := extract(month from v_today)::int;
  r         record;
  v_res     jsonb;
  v_total   int := 0;
  v_schools int := 0;
BEGIN
  FOR r IN
    SELECT school_id FROM public.school_settings WHERE auto_generate_payments IS TRUE
  LOOP
    BEGIN
      v_res     := public.open_month(r.school_id, v_year, v_month, NULL);
      v_total   := v_total + COALESCE((v_res->>'generados')::int, 0);
      v_schools := v_schools + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[generate_monthly_charges] escuela % fallo: %', r.school_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[generate_monthly_charges] fecha=% escuelas=% cobros_creados=%',
    v_today, v_schools, v_total;

  RETURN jsonb_build_object(
    'run_date', v_today, 'schools', v_schools, 'charges_created', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.generate_monthly_charges() IS
  'Cron diario: delega en open_month() por cada escuela con auto_generate_payments. Una sola vía canónica de generación. Manejo de error por escuela.';

REVOKE ALL ON FUNCTION public.generate_monthly_charges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_monthly_charges() TO service_role;

NOTIFY pgrst, 'reload schema';
