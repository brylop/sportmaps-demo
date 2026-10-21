-- =============================================================================
-- 20261021143945_horas_adicionales_prepagadas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-21   Versión anterior: 20261020111232
-- Objetivo: vender HORAS ADICIONALES POR ADELANTADO en el banco de horas
--   (Dreamers). Hoy «Horas adicionales» solo factura un excedente que el cron ya
--   calculó al cerrar el periodo; si una familia compra 2 horas antes de usarlas
--   no hay cómo registrarlo (Edna, 2026-10-21) y, aunque se cobrara como «Clase
--   extra», el banco no se enteraba: al consumirlas el cron cobraba el excedente
--   OTRA VEZ.
-- =============================================================================
-- Qué hace:
--   1. hour_bank_grants: registro de cada suma de horas (quién, cuánto, por qué,
--      de qué pago). Solo lectura para admins por RLS; escribe la RPC.
--   2. grant_hour_bank_minutes(): suma minutos a included_minutes del periodo de
--      la fecha, en una transacción, con candado de fila e idempotente por pago
--      (un doble clic o un reintento del BFF no suma dos veces). Solo acepta un
--      pago PAGADO, de categoría clase_extra, de la escuela y del MISMO atleta de
--      la inscripción.
--   2b. revoke_hour_bank_grant(): deshace una suma cuando se anula el cobro (sin
--      esto, anular el lote dejaba las horas gratis). Idempotente; no baja de 0 y
--      si ya se consumieron, el cron cobrará ese excedente como siempre.
--   3. apply_hour_bank_plan_change(): al cambiar de plan reasigna included_minutes
--      al valor del plan (absoluto). Se le suman las horas compradas del periodo;
--      si no, el cambio de plan las borraba y se cobraban dos veces.
--
-- No se tocan open_month, create_charge_batch ni confirm_hour_bank_overage: el
-- cobro de las horas va por el lote de siempre (categoría clase_extra) y la
-- suma al banco la hace el BFF con esta RPC, usando el id del pago como llave.
-- Si el cobro entra y la suma falla, queda el cobro sin horas (visible y
-- reintentable), nunca horas sin cobro.
--
-- Radio: tabla y función nuevas; una función existente parchada con guarda de
-- md5 y de ancla. Sin efecto hasta que el BFF las llame.
-- Revertir: DROP de la RPC y la tabla; CREATE OR REPLACE de
-- apply_hour_bank_plan_change con el cuerpo de md5 a095bff3…
-- =============================================================================

BEGIN;

-- ─── 0. Guardas ──────────────────────────────────────────────────────────────
DO $guard$
DECLARE v_md5 text;
BEGIN
  SELECT md5(replace(prosrc, E'\r', '')) INTO v_md5 FROM pg_proc
   WHERE oid = 'public.apply_hour_bank_plan_change(uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM 'a095bff36f06f4bdf7a23eb89d8df12c' THEN
    RAISE EXCEPTION 'apply_hour_bank_plan_change cambió en la base: md5 % (esperado a095bff36f06f4bdf7a23eb89d8df12c). Re-leer el cuerpo vivo.', v_md5;
  END IF;
  IF to_regprocedure('public.get_or_open_hour_bank_period_at(uuid,date)') IS NULL THEN
    RAISE EXCEPTION 'Falta public.get_or_open_hour_bank_period_at(uuid,date)';
  END IF;
  IF to_regprocedure('public._actor_rol_finanzas(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Falta public._actor_rol_finanzas(uuid,uuid)';
  END IF;
END
$guard$;

-- ─── 1. Registro de horas sumadas ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hour_bank_grants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id),
  period_id     uuid NOT NULL REFERENCES public.hour_bank_periods(id),
  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id),
  minutes       integer NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  reason        text NOT NULL CHECK (length(btrim(reason)) >= 3),
  source        text NOT NULL DEFAULT 'cobro' CHECK (source IN ('cobro', 'manual')),
  payment_id    uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  granted_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  reverted_at   timestamptz,
  reverted_by   uuid REFERENCES public.profiles(id),
  revert_reason text
);

-- Una suma por pago: la llave de idempotencia.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hour_bank_grants_payment
  ON public.hour_bank_grants (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hour_bank_grants_period
  ON public.hour_bank_grants (period_id);

COMMENT ON TABLE public.hour_bank_grants IS
  'Horas sumadas a mano o por una venta de horas adicionales. included_minutes del periodo = plan + SUM(minutes). Escribe grant_hour_bank_minutes (service_role).';

ALTER TABLE public.hour_bank_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hour_bank_grants_select_admin ON public.hour_bank_grants;
CREATE POLICY hour_bank_grants_select_admin
  ON public.hour_bank_grants
  FOR SELECT
  TO authenticated
  USING (school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[]));

REVOKE ALL ON public.hour_bank_grants FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hour_bank_grants FROM authenticated;
GRANT SELECT ON public.hour_bank_grants TO authenticated;
GRANT ALL ON public.hour_bank_grants TO service_role;

-- ─── 2. RPC: sumar minutos al banco ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_hour_bank_minutes(
  p_enrollment_id uuid,
  p_minutes       integer,
  p_reason        text,
  p_actor         uuid,
  p_payment_id    uuid DEFAULT NULL,
  p_on            date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_school    uuid;
  v_period    uuid;
  v_existing  public.hour_bank_grants%ROWTYPE;
  v_grant_id  uuid;
  v_included  integer;
  v_consumed  integer;
  v_reserved  integer;
BEGIN
  IF p_minutes IS NULL OR p_minutes <= 0 OR p_minutes > 1440 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: los minutos deben estar entre 1 y 1440' USING ERRCODE = 'P0001';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: escribe el motivo (mínimo 3 caracteres)' USING ERRCODE = 'P0001';
  END IF;

  SELECT e.school_id INTO v_school FROM public.enrollments e WHERE e.id = p_enrollment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: la inscripción no existe' USING ERRCODE = 'P0001';
  END IF;

  IF public._actor_rol_finanzas(v_school, p_actor) IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: un pago suma una sola vez, aunque el BFF reintente o hagan doble clic.
  IF p_payment_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('hb_grant:' || p_payment_id::text, 0));
    SELECT * INTO v_existing FROM public.hour_bank_grants WHERE payment_id = p_payment_id;
    IF FOUND THEN
      RETURN jsonb_build_object('granted', false, 'duplicated', true, 'grant_id', v_existing.id,
                                'minutes', v_existing.minutes, 'period_id', v_existing.period_id);
    END IF;
    -- El pago debe estar PAGADO, ser una venta de horas (clase_extra) de esta escuela y del
    -- mismo atleta de la inscripción: nadie acredita horas con un pago ajeno o pendiente.
    IF NOT EXISTS (
      SELECT 1
        FROM public.payments pa
        JOIN public.enrollments en ON en.id = p_enrollment_id
       WHERE pa.id = p_payment_id
         AND pa.school_id = v_school
         AND pa.status = 'paid'
         AND pa.payment_category = 'clase_extra'
         AND ( (en.child_id IS NOT NULL AND pa.child_id = en.child_id)
            OR (en.child_id IS NULL AND en.user_id IS NOT NULL AND pa.user_id = en.user_id)
            OR (en.unregistered_athlete_id IS NOT NULL AND pa.unregistered_athlete_id = en.unregistered_athlete_id) )
    ) THEN
      RAISE EXCEPTION 'DATOS_INVALIDOS: el pago no está pagado, no es una venta de horas o no es de este atleta' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_period := public.get_or_open_hour_bank_period_at(p_enrollment_id, p_on);
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'SIN_BANCO_DE_HORAS: el plan de esta inscripción no tiene horas configuradas o la escuela no usa banco de horas'
      USING ERRCODE = 'P0001';
  END IF;

  -- El UPDATE toma el candado de la fila del periodo: dos sumas simultáneas se serializan.
  UPDATE public.hour_bank_periods
     SET included_minutes = included_minutes + p_minutes,
         updated_at       = now()
   WHERE id = v_period
  RETURNING included_minutes, consumed_minutes, reserved_minutes
    INTO v_included, v_consumed, v_reserved;

  INSERT INTO public.hour_bank_grants (school_id, period_id, enrollment_id, minutes, reason, source, payment_id, granted_by)
  VALUES (v_school, v_period, p_enrollment_id, p_minutes, btrim(p_reason),
          CASE WHEN p_payment_id IS NULL THEN 'manual' ELSE 'cobro' END, p_payment_id, p_actor)
  RETURNING id INTO v_grant_id;

  RETURN jsonb_build_object(
    'granted', true, 'duplicated', false, 'grant_id', v_grant_id, 'period_id', v_period,
    'minutes', p_minutes, 'included_minutes', v_included,
    'available_minutes', v_included - v_consumed - v_reserved);
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_hour_bank_minutes(uuid, integer, text, uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_hour_bank_minutes(uuid, integer, text, uuid, uuid, date)
  TO service_role;

-- ─── 2b. RPC: deshacer una suma (cobro anulado) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_hour_bank_grant(
  p_payment_id uuid,
  p_actor      uuid,
  p_reason     text DEFAULT 'Cobro anulado'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_g        public.hour_bank_grants%ROWTYPE;
  v_included integer;
BEGIN
  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS: falta el pago' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('hb_grant:' || p_payment_id::text, 0));
  SELECT * INTO v_g FROM public.hour_bank_grants WHERE payment_id = p_payment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reverted', false, 'reason', 'sin_suma');
  END IF;

  IF public._actor_rol_finanzas(v_g.school_id, p_actor) IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
  END IF;
  IF v_g.reverted_at IS NOT NULL THEN
    RETURN jsonb_build_object('reverted', false, 'reason', 'ya_revertida', 'grant_id', v_g.id);
  END IF;

  -- Candado de la fila del periodo; nunca por debajo de 0. Si las horas ya se usaron, el
  -- excedente lo cobra el cron como cualquier otro (no se inventa una deuda aquí).
  UPDATE public.hour_bank_periods
     SET included_minutes = GREATEST(0, included_minutes - v_g.minutes),
         updated_at       = now()
   WHERE id = v_g.period_id
  RETURNING included_minutes INTO v_included;

  UPDATE public.hour_bank_grants
     SET reverted_at = now(), reverted_by = p_actor, revert_reason = left(btrim(coalesce(p_reason, 'Cobro anulado')), 300)
   WHERE id = v_g.id;

  RETURN jsonb_build_object('reverted', true, 'grant_id', v_g.id, 'minutes', v_g.minutes,
                            'period_id', v_g.period_id, 'included_minutes', v_included);
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_hour_bank_grant(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_hour_bank_grant(uuid, uuid, text) TO service_role;

-- ─── 3. El cambio de plan conserva las horas compradas ───────────────────────
DO $patch$
DECLARE
  v_def    text;
  v_ancla  constant text := 'included_minutes = v_plan_minutes,';
  v_nuevo  constant text :=
    E'included_minutes = v_plan_minutes\n'
    || E'                            -- 20261021: las horas compradas del periodo sobreviven al cambio de plan.\n'
    || E'                            + COALESCE((SELECT sum(g.minutes)::integer FROM public.hour_bank_grants g WHERE g.period_id = v_period_id AND g.reverted_at IS NULL), 0),';
  v_n      int;
  v_acl    text;
  v_acl2   text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), E'\r', ''), p.proacl::text
    INTO v_def, v_acl
    FROM pg_proc p WHERE p.oid = 'public.apply_hour_bank_plan_change(uuid)'::regprocedure;
  v_n := (length(v_def) - length(replace(v_def, v_ancla, ''))) / length(v_ancla);
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'apply_hour_bank_plan_change: el ancla aparece % veces (esperado 1)', v_n;
  END IF;
  EXECUTE replace(v_def, v_ancla, v_nuevo);
  SELECT proacl::text INTO v_acl2 FROM pg_proc WHERE oid = 'public.apply_hour_bank_plan_change(uuid)'::regprocedure;
  IF v_acl2 IS DISTINCT FROM v_acl THEN
    RAISE EXCEPTION 'apply_hour_bank_plan_change: la ACL cambió (% → %)', v_acl, v_acl2;
  END IF;
END
$patch$;

-- ─── 4. Verificación ─────────────────────────────────────────────────────────
DO $post$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.apply_hour_bank_plan_change(uuid)'::regprocedure
                    AND prosrc LIKE '%hour_bank_grants%') THEN
    RAISE EXCEPTION 'apply_hour_bank_plan_change: el parche no quedó';
  END IF;
  IF has_function_privilege('authenticated', 'public.grant_hour_bank_minutes(uuid,integer,text,uuid,uuid,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.grant_hour_bank_minutes(uuid,integer,text,uuid,uuid,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.revoke_hour_bank_grant(uuid,uuid,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.revoke_hour_bank_grant(uuid,uuid,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'grant/revoke_hour_bank_* no deben ser ejecutables por authenticated/anon';
  END IF;
END
$post$;

COMMIT;

NOTIFY pgrst, 'reload schema';
