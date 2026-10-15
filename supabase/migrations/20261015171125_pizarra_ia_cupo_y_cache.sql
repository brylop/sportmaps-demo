-- =============================================================================
-- 20261014111442_pizarra_ia_cupo_y_cache.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013165308
-- Objetivo: M3 de docs/specs/pizarra-multideporte-3d-ia.md («Analizar jugada» con
--   IA, decisión D6 y §6 Cobro). Cupo gratis mensual por escuela + paquetes de
--   análisis comprados + caché de análisis por hash de la jugada.
--
--   · tactical_ai_credits: una fila por (escuela, periodo 'YYYY-MM' hora Bogotá).
--     used = análisis gastados en el periodo; purchased = análisis comprados en
--     el periodo; free_quota = cupo gratis VIGENTE cuando se creó la fila (foto:
--     cambiar el cupo no reescribe meses pasados).
--     Los comprados NO vencen con el mes: el saldo pagado es
--       Σ purchased − Σ max(used − free_quota, 0)   (todas las filas de la escuela)
--     y se gasta primero el cupo gratis del mes, después lo comprado.
--   · tactical_ai_analyses: caché del resultado YA VALIDADO por el BFF (sin nombres
--     ni ids de atletas: las claves de jugador son p1..pN / r1..rN). Mismo
--     board_hash (sha256 de la jugada normalizada + deporte) en la misma escuela
--     = no se llama al modelo y no se descuenta cupo. Guarda los tokens de la
--     llamada para fijar el precio del paquete con el costo medido (§6).
--   · Contadores solo por RPC SECURITY DEFINER con SELECT … FOR UPDATE (regla del
--     repo). consume / refund / grant / balance: EXECUTE solo para service_role
--     (el BFF), salvo grant, que además acepta al super admin con su sesión.
--   · RLS: staff de la escuela (user_staff_school_ids(): sin padres ni atletas)
--     LEE su saldo y su historial; nadie escribe directo (sin policies de
--     escritura + REVOKE a authenticated/anon).
--   · llm_usage.feature acepta 'pizarra_ia' (antes: bot/ocr/transcripcion/sportbot)
--     para que cada análisis quede con su costo real en el informe de consumo.
--
--   PENDIENTE (no se inventa acá): el CHECK de tactical_board_events.event
--   (20261008183746) no tiene 'ai_analyze'. Cuando se quiera la métrica de uso del
--   botón, agregarlo en una migración nueva (y en TACTICAL_BOARD_EVENTS del front).
--
--   Helpers que se usan (deben existir vivos): user_staff_school_ids() → uuid[],
--   is_super_admin() → boolean, auth.jwt(). Mismo patrón de ANY ((SELECT …)::uuid[])
--   que 20261008183746 (el ANY sin cast falló con 42883 al aplicarse).
--
--   NO APLICADA (la base es la misma de producción). Para quien integre:
--   después de aplicarla correr `npm run seguridad:invariantes` y estos casos de
--   RLS (no hay scripts/rls-pruebas-pizarra.mjs en esta rama; agregarlos allí):
--     R1 anon:   select count(*) from tactical_ai_credits / tactical_ai_analyses → 0 filas o 42501.
--     R2 padre/atleta de la escuela E: select … where school_id = E → 0 filas.
--     R3 coach/staff de E: ve SOLO las filas de E (no las de otra escuela F).
--     R4 staff de E: insert/update/delete directo en las dos tablas → 42501.
--     R5 authenticated (coach, admin): rpc consume/refund/balance → 42501
--        (permission denied for function); solo service_role las ejecuta.
--     R6 authenticated no super admin: rpc grant_tactical_ai_credits → 42501.
--     R7 super admin: grant(E, 50) → ok, purchased +50 en el periodo actual.
--     R8 service_role: 16 consume seguidos en un mes nuevo → 15 ok (gratis),
--        el 16.º ok=false, needs_purchase=true; tras grant(E,50) el 16.º ok y
--        paid_remaining = 49. Concurrencia: 20 consume en paralelo con cupo 15
--        → exactamente 15 ok (FOR UPDATE).
--     R9 refund después de consume → used vuelve atrás, nunca < 0.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Cupo gratis mensual (spec §6: 15, configurable). Cambiarlo = migración nueva
--    que reemplace esta función; las filas ya creadas conservan su free_quota.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tactical_ai_free_quota()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 15 $$;

REVOKE ALL ON FUNCTION public.tactical_ai_free_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_free_quota() TO service_role;

-- Periodo actual en hora de Bogotá ('YYYY-MM'): el cupo se reinicia el 1.º del mes.
CREATE OR REPLACE FUNCTION public.tactical_ai_current_period()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM') $$;

REVOKE ALL ON FUNCTION public.tactical_ai_current_period() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_current_period() TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Saldo por escuela y mes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tactical_ai_credits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period      text        NOT NULL,
  used        integer     NOT NULL DEFAULT 0,
  purchased   integer     NOT NULL DEFAULT 0,
  free_quota  integer     NOT NULL DEFAULT 15,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_credits_period_check     CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_credits_used_check       CHECK (used >= 0),
  CONSTRAINT tactical_ai_credits_purchased_check  CHECK (purchased >= 0),
  CONSTRAINT tactical_ai_credits_free_quota_check CHECK (free_quota >= 0 AND free_quota <= 10000),
  CONSTRAINT tactical_ai_credits_school_period_key UNIQUE (school_id, period)
);

COMMENT ON TABLE public.tactical_ai_credits IS
  'M3 pizarra IA: análisis usados/comprados por escuela y mes (hora Bogotá). Mutada SOLO por RPC (consume/refund/grant). Spec: docs/specs/pizarra-multideporte-3d-ia.md §6';

-- -----------------------------------------------------------------------------
-- 2. Caché de análisis
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tactical_ai_analyses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id        uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
  board_hash     text        NOT NULL,
  sport          text        NOT NULL,
  result         jsonb       NOT NULL,
  provider       text,
  model          text,
  input_tokens   integer     NOT NULL DEFAULT 0,
  output_tokens  integer     NOT NULL DEFAULT 0,
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_analyses_hash_check   CHECK (board_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT tactical_ai_analyses_sport_check  CHECK (sport IN ('futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano')),
  CONSTRAINT tactical_ai_analyses_result_check CHECK (jsonb_typeof(result) = 'object' AND pg_column_size(result) <= 262144),
  CONSTRAINT tactical_ai_analyses_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0),
  CONSTRAINT tactical_ai_analyses_provider_len CHECK (provider IS NULL OR char_length(provider) <= 40),
  CONSTRAINT tactical_ai_analyses_model_len    CHECK (model IS NULL OR char_length(model) <= 120),
  CONSTRAINT tactical_ai_analyses_school_hash_key UNIQUE (school_id, board_hash)
);

COMMENT ON TABLE public.tactical_ai_analyses IS
  'M3 pizarra IA: caché del análisis validado por (escuela, board_hash). Sin nombres ni ids de atletas (claves p1..pN / r1..rN). INSERT solo service_role (BFF).';

CREATE INDEX IF NOT EXISTS tactical_ai_analyses_school_created_idx
  ON public.tactical_ai_analyses (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tactical_ai_analyses_team_idx
  ON public.tactical_ai_analyses (team_id);

-- -----------------------------------------------------------------------------
-- 3. RLS: staff LEE lo suyo; nadie escribe directo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_ai_credits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_ai_credits  FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_analyses FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_credits  FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_analyses FROM authenticated;
GRANT SELECT ON public.tactical_ai_credits  TO authenticated;
GRANT SELECT ON public.tactical_ai_analyses TO authenticated;
GRANT ALL ON public.tactical_ai_credits  TO service_role;
GRANT ALL ON public.tactical_ai_analyses TO service_role;

DROP POLICY IF EXISTS tactical_ai_credits_select_staff ON public.tactical_ai_credits;
CREATE POLICY tactical_ai_credits_select_staff
  ON public.tactical_ai_credits
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_analyses_select_staff ON public.tactical_ai_analyses;
CREATE POLICY tactical_ai_analyses_select_staff
  ON public.tactical_ai_analyses
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 4. RPCs de saldo. Todas toman la fila del MES ACTUAL con FOR UPDATE: es el
--    candado que serializa consumir / devolver / comprar de una escuela.
-- -----------------------------------------------------------------------------

-- Fila del mes actual bloqueada (la crea si no existe). Interna: sin EXECUTE
-- para nadie más que service_role / las RPC de abajo (corren como su dueño).
CREATE OR REPLACE FUNCTION public._tactical_ai_lock_period(p_school_id uuid)
RETURNS public.tactical_ai_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_row    public.tactical_ai_credits;
BEGIN
  INSERT INTO public.tactical_ai_credits (school_id, period, free_quota)
  VALUES (p_school_id, v_period, public.tactical_ai_free_quota())
  ON CONFLICT (school_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_credits
  WHERE school_id = p_school_id AND period = v_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_lock_period(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_period(uuid) TO service_role;

-- Saldo pagado de la escuela (todas las filas). Llamar con la fila del mes ya
-- bloqueada para que el número no cambie entre la lectura y la escritura.
CREATE OR REPLACE FUNCTION public._tactical_ai_paid_remaining(p_school_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT GREATEST(0, COALESCE(SUM(purchased), 0) - COALESCE(SUM(GREATEST(used - free_quota, 0)), 0))::integer
  FROM public.tactical_ai_credits
  WHERE school_id = p_school_id
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_paid_remaining(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_paid_remaining(uuid) TO service_role;

-- Respuesta común: { ok, remaining, free_remaining, paid_remaining, used,
-- free_quota, period, needs_purchase }.
CREATE OR REPLACE FUNCTION public._tactical_ai_balance_json(p_row public.tactical_ai_credits, p_ok boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_free integer := GREATEST(p_row.free_quota - p_row.used, 0);
  v_paid integer := public._tactical_ai_paid_remaining(p_row.school_id);
BEGIN
  RETURN jsonb_build_object(
    'ok', p_ok,
    'remaining', v_free + v_paid,
    'free_remaining', v_free,
    'paid_remaining', v_paid,
    'used', p_row.used,
    'free_quota', p_row.free_quota,
    'period', p_row.period,
    'needs_purchase', (v_free + v_paid) = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_balance_json(public.tactical_ai_credits, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_balance_json(public.tactical_ai_credits, boolean) TO service_role;

-- Descuenta UN análisis si hay saldo (gratis del mes primero, después pagado).
-- Sin saldo: ok=false, needs_purchase=true y no cambia nada. Solo el BFF.
CREATE OR REPLACE FUNCTION public.consume_tactical_ai_credit(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row  public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  v_row := public._tactical_ai_lock_period(p_school_id);

  IF v_row.used < v_row.free_quota OR public._tactical_ai_paid_remaining(p_school_id) > 0 THEN
    UPDATE public.tactical_ai_credits
       SET used = used + 1, updated_at = now()
     WHERE id = v_row.id
    RETURNING * INTO v_row;
    RETURN public._tactical_ai_balance_json(v_row, true);
  END IF;

  RETURN public._tactical_ai_balance_json(v_row, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tactical_ai_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tactical_ai_credit(uuid) TO service_role;

-- Devuelve el análisis descontado cuando el modelo falló después de consumir.
CREATE OR REPLACE FUNCTION public.refund_tactical_ai_credit(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  v_row := public._tactical_ai_lock_period(p_school_id);
  UPDATE public.tactical_ai_credits
     SET used = GREATEST(used - 1, 0), updated_at = now()
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.refund_tactical_ai_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_tactical_ai_credit(uuid) TO service_role;

-- Saldo sin consumir (para mostrar «Te quedan N análisis este mes»). Solo el BFF,
-- que ya validó que quien pregunta es staff de la escuela.
CREATE OR REPLACE FUNCTION public.tactical_ai_balance(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'school_id requerido' USING ERRCODE = '22023';
  END IF;
  -- Crea la fila del mes si falta: así el saldo mostrado y el que se consume
  -- salen de la misma foto de free_quota.
  v_row := public._tactical_ai_lock_period(p_school_id);
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_balance(uuid) TO service_role;

-- Suma análisis comprados (paquete «50 análisis»). Hoy NO hay checkout: lo usa
-- el super admin a mano o el BFF (service_role) cuando exista el flujo de pago
-- del adicional. Gate interno porque authenticated tiene EXECUTE (super admin).
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(p_school_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_credits;
BEGIN
  IF NOT (
    COALESCE((SELECT auth.jwt()) ->> 'role', '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
    OR COALESCE((SELECT public.is_super_admin()), false)
  ) THEN
    RAISE EXCEPTION 'solo super admin o service_role' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'escuela inexistente' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount debe estar entre 1 y 10000' USING ERRCODE = '22023';
  END IF;

  v_row := public._tactical_ai_lock_period(p_school_id);
  UPDATE public.tactical_ai_credits
     SET purchased = purchased + p_amount, updated_at = now()
   WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN public._tactical_ai_balance_json(v_row, true);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. llm_usage: la función 'pizarra_ia' (si la tabla ya existe en esta base).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.llm_usage') IS NOT NULL THEN
    ALTER TABLE public.llm_usage DROP CONSTRAINT IF EXISTS llm_usage_feature_check;
    ALTER TABLE public.llm_usage ADD CONSTRAINT llm_usage_feature_check
      CHECK (feature IN ('bot', 'ocr', 'transcripcion', 'sportbot', 'pizarra_ia'));
  END IF;
END;
$$;

COMMIT;
