-- =============================================================================
-- 20261014155445_pizarra_ia_cupo_por_entrenador_tokens.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261014125632
-- Objetivo: decisión del usuario del 2026-10-14 que REEMPLAZA el §6 de
--   docs/specs/pizarra-multideporte-3d-ia.md: la IA de la pizarra se lanza como
--   mejora PARA EL ROL COACH, limitada por COSTO REAL (tokens), sin precio
--   todavía. Se mide el uso y después se fija el precio; quien quiera más, compra.
--
--   Construye ENCIMA de 20261014111442 (cupo por escuela contado en análisis)
--   sin editarla. Las dos están sin aplicar; esta va después.
--
--   · Cupo mensual POR USUARIO (coach/staff que analiza) en MICRODÓLARES de
--     costo real (1 USD = 1.000.000). El BFF calcula el costo de cada llamada
--     con los tokens de entrada / escritura de caché / lectura de caché / salida
--     y la tabla de precios del modelo usado (bff/src/services/llm-usage.service.ts
--     → PRECIOS_POR_MILLON). Acá se guardan el costo y los tokens crudos.
--   · Presupuesto por usuario y mes: USD 1,00 → tactical_ai_user_budget_micro_usd().
--     Techo por ESCUELA y mes: 10 × el del usuario → tactical_ai_school_ceiling_factor().
--     Medido en la base viva el 2026-10-14: 41 escuelas con staff activo; p90 = 4
--     personas de staff, máximo 13 (una sola escuela pasa de 10). El techo casi
--     nunca muerde: es el tope de exposición por escuela (USD 10/mes), no el
--     límite del día a día.
--     Las filas guardan una FOTO del presupuesto/techo vigente al crearse:
--     cambiar las funciones no reescribe meses ya abiertos.
--   · Flujo (todo por RPC SECURITY DEFINER, EXECUTE solo service_role = el BFF):
--       tactical_ai_reserve  → FOR UPDATE sobre la fila de la ESCUELA y después la
--                              del USUARIO (siempre en ese orden: sin deadlocks);
--                              reserva un estimado (BFF: USD 0,08, > el máximo
--                              medido de USD 0,064). Sin saldo (usuario o escuela)
--                              → ok=false, denied_scope, y NO se llama al modelo.
--       tactical_ai_settle   → al llegar la respuesta: libera la reserva y cobra
--                              el costo REAL (puede ser menor o algo mayor).
--       tactical_ai_release  → el modelo falló o la salida no sirvió: libera.
--       tactical_ai_record_cache_hit → misma jugada ya analizada: USD 0, solo cuenta.
--     Una reserva que nunca se cerró (el BFF se cayó entre reservar y cobrar)
--     vence a los 15 min (tactical_ai_reservation_ttl) y se libera sola en la
--     próxima reserva de esa escuela: el saldo no queda tomado para siempre.
--   · Garantía: la suma de lo RESERVADO nunca pasa el presupuesto (la reserva
--     exige estimado ≤ disponible bajo FOR UPDATE). Lo COBRADO puede pasarlo
--     por centavos si una respuesta real cuesta más que el estimado: es plata
--     ya gastada en el proveedor y se registra tal cual.
--   · Más cupo (super admin): grant_tactical_ai_credits(escuela, usd, usuario?, nota?)
--       - con usuario: suma al usuario EN ESA ESCUELA y, por el mismo monto, al
--         techo de la escuela (si no, el techo podría frenar lo que se regaló);
--       - sin usuario: sube solo el techo de la escuela (escuela con muchos coaches
--         que topó el techo; no le da más a ningún coach en particular).
--     Vale para el mes en curso (el cupo se mide por mes). Cada regalo queda en
--     tactical_ai_grants con quién lo dio.
--     COMPATIBILIDAD: la firma vieja grant_tactical_ai_credits(uuid, integer)
--     («N análisis» a la escuela) se mantiene y ahora convierte N análisis a
--     N × USD 0,08 de techo de escuela.
--   · OBSOLETO de 20261014111442 (se depreca SIN borrar datos):
--       tactical_ai_credits (contador por escuela en número de análisis),
--       tactical_ai_free_quota(), consume_/refund_tactical_ai_credit(),
--       tactical_ai_balance(). Se conserva la tabla (solo lectura: se le quita
--       EXECUTE de consume/refund a service_role, así ningún código la vuelve a
--       mover) y se marca con COMMENT. No se crea vista de compatibilidad: no hay
--       consumidores (nunca se aplicó ni hubo flujo de compra).
--       tactical_ai_analyses (caché por hash) SIGUE vigente.
--   · RLS: el usuario lee lo suyo; el admin de la escuela
--     (user_admin_school_ids(): sin coaches) lee el consumo de su escuela por
--     coach; el super admin lee todo. Nadie escribe directo.
--
--   NO APLICADA (la base es la misma de producción). Para quien integre:
--   aplicar DESPUÉS de 20261014111442, correr `npm run seguridad:invariantes` y
--   `npm run seguridad:rls-pizarra` (casos «esperado tras 20261014155445»).
--   Helpers que se usan (vivos, verificado 2026-10-14): user_admin_school_ids()
--   → uuid[], is_super_admin() → boolean, auth.uid(), auth.jwt().
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
-- 0. Parámetros (cambiarlos = migración nueva que reemplace la función).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tactical_ai_user_budget_micro_usd()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 1000000::bigint $$;  -- USD 1,00 por usuario y mes

CREATE OR REPLACE FUNCTION public.tactical_ai_school_ceiling_factor()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 10 $$;  -- techo de la escuela = 10 × presupuesto del usuario

CREATE OR REPLACE FUNCTION public.tactical_ai_school_ceiling_micro_usd()
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT public.tactical_ai_user_budget_micro_usd() * public.tactical_ai_school_ceiling_factor() $$;

-- Reserva sin cerrar más vieja que esto se libera sola (el BFF corta al modelo a los 75 s).
CREATE OR REPLACE FUNCTION public.tactical_ai_reservation_ttl()
RETURNS interval
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT interval '15 minutes' $$;

REVOKE ALL ON FUNCTION public.tactical_ai_user_budget_micro_usd()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_school_ceiling_factor()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_school_ceiling_micro_usd() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tactical_ai_reservation_ttl()          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_user_budget_micro_usd()    TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_school_ceiling_factor()    TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_school_ceiling_micro_usd() TO service_role;
GRANT EXECUTE ON FUNCTION public.tactical_ai_reservation_ttl()          TO service_role;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

-- Consumo por usuario, escuela y mes. Un coach de dos escuelas tiene un cupo en
-- cada una: el cupo es una mejora del plan de la ESCUELA para su staff.
CREATE TABLE IF NOT EXISTS public.tactical_ai_user_usage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period              text        NOT NULL,
  budget_micro_usd    bigint      NOT NULL,
  extra_micro_usd     bigint      NOT NULL DEFAULT 0,
  used_micro_usd      bigint      NOT NULL DEFAULT 0,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  analyses            integer     NOT NULL DEFAULT 0,
  cache_hits          integer     NOT NULL DEFAULT 0,
  needs_more_count    integer     NOT NULL DEFAULT 0,
  input_tokens        bigint      NOT NULL DEFAULT 0,
  output_tokens       bigint      NOT NULL DEFAULT 0,
  cache_read_tokens   bigint      NOT NULL DEFAULT 0,
  cache_write_tokens  bigint      NOT NULL DEFAULT 0,
  limit_hit_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_user_usage_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_user_usage_money_check  CHECK (budget_micro_usd >= 0 AND extra_micro_usd >= 0 AND used_micro_usd >= 0 AND reserved_micro_usd >= 0),
  CONSTRAINT tactical_ai_user_usage_count_check  CHECK (analyses >= 0 AND cache_hits >= 0 AND needs_more_count >= 0),
  CONSTRAINT tactical_ai_user_usage_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens >= 0 AND cache_write_tokens >= 0),
  CONSTRAINT tactical_ai_user_usage_key UNIQUE (school_id, user_id, period)
);
CREATE INDEX IF NOT EXISTS tactical_ai_user_usage_user_idx   ON public.tactical_ai_user_usage (user_id, period);
CREATE INDEX IF NOT EXISTS tactical_ai_user_usage_period_idx ON public.tactical_ai_user_usage (period);

COMMENT ON TABLE public.tactical_ai_user_usage IS
  'Pizarra IA: costo real (microdólares) y tokens por usuario, escuela y mes (hora Bogotá). Mutada SOLO por RPC. Spec §6 (2026-10-14).';

-- Techo y total de la escuela por mes.
CREATE TABLE IF NOT EXISTS public.tactical_ai_school_usage (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period              text        NOT NULL,
  ceiling_micro_usd   bigint      NOT NULL,
  extra_micro_usd     bigint      NOT NULL DEFAULT 0,
  used_micro_usd      bigint      NOT NULL DEFAULT 0,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  analyses            integer     NOT NULL DEFAULT 0,
  needs_more_count    integer     NOT NULL DEFAULT 0,
  limit_hit_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_school_usage_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_school_usage_money_check  CHECK (ceiling_micro_usd >= 0 AND extra_micro_usd >= 0 AND used_micro_usd >= 0 AND reserved_micro_usd >= 0),
  CONSTRAINT tactical_ai_school_usage_count_check  CHECK (analyses >= 0 AND needs_more_count >= 0),
  CONSTRAINT tactical_ai_school_usage_key UNIQUE (school_id, period)
);
CREATE INDEX IF NOT EXISTS tactical_ai_school_usage_period_idx ON public.tactical_ai_school_usage (period);

COMMENT ON TABLE public.tactical_ai_school_usage IS
  'Pizarra IA: techo (10 × presupuesto del usuario) y total de la escuela por mes. Mutada SOLO por RPC.';

-- Una fila por intento: reserva → settled/released/expired, o cache_hit, o
-- denied (sin saldo). Es el libro para el panel del super admin (costo medio
-- por deporte, tokens). Sin datos de atletas.
CREATE TABLE IF NOT EXISTS public.tactical_ai_runs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id             uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  period              text        NOT NULL,
  sport               text        NOT NULL,
  status              text        NOT NULL,
  denied_scope        text,
  reserved_micro_usd  bigint      NOT NULL DEFAULT 0,
  cost_micro_usd      bigint      NOT NULL DEFAULT 0,
  provider            text,
  model               text,
  input_tokens        integer     NOT NULL DEFAULT 0,
  output_tokens       integer     NOT NULL DEFAULT 0,
  cache_read_tokens   integer     NOT NULL DEFAULT 0,
  cache_write_tokens  integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  CONSTRAINT tactical_ai_runs_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_runs_sport_check  CHECK (sport IN ('futbol', 'futbol7', 'futbol5', 'futsal', 'voleibol', 'baloncesto', 'balonmano')),
  CONSTRAINT tactical_ai_runs_status_check CHECK (status IN ('reserved', 'settled', 'released', 'expired', 'cache_hit', 'denied')),
  CONSTRAINT tactical_ai_runs_scope_check  CHECK (denied_scope IS NULL OR denied_scope IN ('user', 'school')),
  CONSTRAINT tactical_ai_runs_money_check  CHECK (reserved_micro_usd >= 0 AND cost_micro_usd >= 0 AND cost_micro_usd <= 10000000),
  CONSTRAINT tactical_ai_runs_tokens_check CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cache_read_tokens >= 0 AND cache_write_tokens >= 0),
  CONSTRAINT tactical_ai_runs_provider_len CHECK (provider IS NULL OR char_length(provider) <= 40),
  CONSTRAINT tactical_ai_runs_model_len    CHECK (model IS NULL OR char_length(model) <= 120)
);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_school_period_idx ON public.tactical_ai_runs (school_id, period);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_period_idx        ON public.tactical_ai_runs (period, sport);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_user_idx          ON public.tactical_ai_runs (user_id);
CREATE INDEX IF NOT EXISTS tactical_ai_runs_reserved_idx      ON public.tactical_ai_runs (school_id, created_at) WHERE status = 'reserved';

COMMENT ON TABLE public.tactical_ai_runs IS
  'Pizarra IA: cada intento (reserva/cobro/liberación/caché/sin saldo) con costo real y tokens crudos. Mutada SOLO por RPC.';

-- Cupo extra dado por el super admin (auditoría).
CREATE TABLE IF NOT EXISTS public.tactical_ai_grants (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid        NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  user_id           uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  period            text        NOT NULL,
  amount_micro_usd  bigint      NOT NULL,
  note              text,
  granted_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tactical_ai_grants_period_check CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT tactical_ai_grants_amount_check CHECK (amount_micro_usd > 0 AND amount_micro_usd <= 1000000000),
  CONSTRAINT tactical_ai_grants_note_len     CHECK (note IS NULL OR char_length(note) <= 300)
);
CREATE INDEX IF NOT EXISTS tactical_ai_grants_school_period_idx ON public.tactical_ai_grants (school_id, period);

COMMENT ON TABLE public.tactical_ai_grants IS
  'Pizarra IA: cupo extra (USD) dado por el super admin, a un usuario o al techo de la escuela, para un mes.';

-- -----------------------------------------------------------------------------
-- 2. RLS: el usuario lee lo suyo; el admin de la escuela lee su escuela; el
--    super admin todo. Nadie escribe directo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.tactical_ai_user_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_school_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_ai_grants       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tactical_ai_user_usage   FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_school_usage FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_runs         FROM PUBLIC, anon;
REVOKE ALL ON public.tactical_ai_grants       FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_user_usage   FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_school_usage FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_runs         FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tactical_ai_grants       FROM authenticated;
GRANT SELECT ON public.tactical_ai_user_usage   TO authenticated;
GRANT SELECT ON public.tactical_ai_school_usage TO authenticated;
GRANT SELECT ON public.tactical_ai_runs         TO authenticated;
GRANT SELECT ON public.tactical_ai_grants       TO authenticated;
GRANT ALL ON public.tactical_ai_user_usage   TO service_role;
GRANT ALL ON public.tactical_ai_school_usage TO service_role;
GRANT ALL ON public.tactical_ai_runs         TO service_role;
GRANT ALL ON public.tactical_ai_grants       TO service_role;

DROP POLICY IF EXISTS tactical_ai_user_usage_select ON public.tactical_ai_user_usage;
CREATE POLICY tactical_ai_user_usage_select
  ON public.tactical_ai_user_usage
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_school_usage_select ON public.tactical_ai_school_usage;
CREATE POLICY tactical_ai_school_usage_select
  ON public.tactical_ai_school_usage
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_runs_select ON public.tactical_ai_runs;
CREATE POLICY tactical_ai_runs_select
  ON public.tactical_ai_runs
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

DROP POLICY IF EXISTS tactical_ai_grants_select ON public.tactical_ai_grants;
CREATE POLICY tactical_ai_grants_select
  ON public.tactical_ai_grants
  FOR SELECT
  TO authenticated
  USING (
    school_id = ANY ((SELECT public.user_admin_school_ids())::uuid[])
    OR (SELECT public.is_super_admin())
  );

-- -----------------------------------------------------------------------------
-- 3. Candados internos. ORDEN ÚNICO en todas las RPC: escuela → usuario → run.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._tactical_ai_lock_school(p_school_id uuid, p_period text)
RETURNS public.tactical_ai_school_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_school_usage;
BEGIN
  INSERT INTO public.tactical_ai_school_usage (school_id, period, ceiling_micro_usd)
  VALUES (p_school_id, p_period, public.tactical_ai_school_ceiling_micro_usd())
  ON CONFLICT (school_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_school_usage
  WHERE school_id = p_school_id AND period = p_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public._tactical_ai_lock_user(p_school_id uuid, p_user_id uuid, p_period text)
RETURNS public.tactical_ai_user_usage
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_row public.tactical_ai_user_usage;
BEGIN
  INSERT INTO public.tactical_ai_user_usage (school_id, user_id, period, budget_micro_usd)
  VALUES (p_school_id, p_user_id, p_period, public.tactical_ai_user_budget_micro_usd())
  ON CONFLICT (school_id, user_id, period) DO NOTHING;

  SELECT * INTO v_row
  FROM public.tactical_ai_user_usage
  WHERE school_id = p_school_id AND user_id = p_user_id AND period = p_period
  FOR UPDATE;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_lock_school(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tactical_ai_lock_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_school(uuid, text)     TO service_role;
GRANT EXECUTE ON FUNCTION public._tactical_ai_lock_user(uuid, uuid, text) TO service_role;

-- Saldo como JSON (sin bloquear ni crear filas: si faltan, el mes está en cero).
CREATE OR REPLACE FUNCTION public._tactical_ai_balance_json(p_school_id uuid, p_user_id uuid, p_period text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_u public.tactical_ai_user_usage;
  v_s public.tactical_ai_school_usage;
BEGIN
  SELECT * INTO v_s FROM public.tactical_ai_school_usage WHERE school_id = p_school_id AND period = p_period;
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_u FROM public.tactical_ai_user_usage
     WHERE school_id = p_school_id AND user_id = p_user_id AND period = p_period;
  END IF;
  RETURN jsonb_build_object(
    'period', p_period,
    'user', CASE WHEN p_user_id IS NULL THEN NULL ELSE jsonb_build_object(
      'budget_micro_usd',   COALESCE(v_u.budget_micro_usd, public.tactical_ai_user_budget_micro_usd()),
      'extra_micro_usd',    COALESCE(v_u.extra_micro_usd, 0),
      'used_micro_usd',     COALESCE(v_u.used_micro_usd, 0),
      'reserved_micro_usd', COALESCE(v_u.reserved_micro_usd, 0),
      'analyses',           COALESCE(v_u.analyses, 0),
      'cache_hits',         COALESCE(v_u.cache_hits, 0)
    ) END,
    'school', jsonb_build_object(
      'ceiling_micro_usd',  COALESCE(v_s.ceiling_micro_usd, public.tactical_ai_school_ceiling_micro_usd()),
      'extra_micro_usd',    COALESCE(v_s.extra_micro_usd, 0),
      'used_micro_usd',     COALESCE(v_s.used_micro_usd, 0),
      'reserved_micro_usd', COALESCE(v_s.reserved_micro_usd, 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_balance_json(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_balance_json(uuid, uuid, text) TO service_role;

-- Libera las reservas vencidas de una escuela (BFF caído entre reservar y
-- cobrar). La llama tactical_ai_reserve con la fila de la escuela del mes ya
-- bloqueada; respeta el orden escuela → usuario → run de cada reserva.
CREATE OR REPLACE FUNCTION public._tactical_ai_expire_stale(p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r        record;
  v_status text;
  v_n      integer := 0;
BEGIN
  FOR r IN
    SELECT id, user_id, period, reserved_micro_usd
      FROM public.tactical_ai_runs
     WHERE school_id = p_school_id AND status = 'reserved'
       AND created_at < now() - public.tactical_ai_reservation_ttl()
     ORDER BY created_at
     LIMIT 50
  LOOP
    PERFORM public._tactical_ai_lock_school(p_school_id, r.period);
    IF r.user_id IS NOT NULL THEN
      PERFORM public._tactical_ai_lock_user(p_school_id, r.user_id, r.period);
    END IF;
    SELECT status INTO v_status FROM public.tactical_ai_runs WHERE id = r.id FOR UPDATE;
    CONTINUE WHEN v_status IS DISTINCT FROM 'reserved';

    UPDATE public.tactical_ai_runs SET status = 'expired', finished_at = now() WHERE id = r.id;
    IF r.user_id IS NOT NULL THEN
      UPDATE public.tactical_ai_user_usage
         SET reserved_micro_usd = GREATEST(reserved_micro_usd - r.reserved_micro_usd, 0), updated_at = now()
       WHERE school_id = p_school_id AND user_id = r.user_id AND period = r.period;
    END IF;
    UPDATE public.tactical_ai_school_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - r.reserved_micro_usd, 0), updated_at = now()
     WHERE school_id = p_school_id AND period = r.period;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public._tactical_ai_expire_stale(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._tactical_ai_expire_stale(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 4. RPCs del BFF (solo service_role).
-- -----------------------------------------------------------------------------

-- Reserva un estimado antes de llamar al modelo. Sin saldo → ok=false y
-- denied_scope ('user' | 'school'); se cuenta el intento y no se reserva nada.
CREATE OR REPLACE FUNCTION public.tactical_ai_reserve(
  p_school_id uuid,
  p_user_id uuid,
  p_sport text,
  p_estimate_micro_usd bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_s      public.tactical_ai_school_usage;
  v_u      public.tactical_ai_user_usage;
  v_scope  text;
  v_id     uuid;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  IF p_estimate_micro_usd IS NULL OR p_estimate_micro_usd < 1 OR p_estimate_micro_usd > 5000000 THEN
    RAISE EXCEPTION 'estimado fuera de rango (1..5000000 microdólares)' USING ERRCODE = '22023';
  END IF;

  -- 1) escuela (candado que serializa todo lo de la escuela), 2) vencidas, 3) usuario.
  PERFORM public._tactical_ai_lock_school(p_school_id, v_period);
  PERFORM public._tactical_ai_expire_stale(p_school_id);
  SELECT * INTO v_s FROM public.tactical_ai_school_usage WHERE school_id = p_school_id AND period = v_period;
  v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);

  IF v_u.budget_micro_usd + v_u.extra_micro_usd - v_u.used_micro_usd - v_u.reserved_micro_usd < p_estimate_micro_usd THEN
    v_scope := 'user';
  ELSIF v_s.ceiling_micro_usd + v_s.extra_micro_usd - v_s.used_micro_usd - v_s.reserved_micro_usd < p_estimate_micro_usd THEN
    v_scope := 'school';
  END IF;

  IF v_scope IS NOT NULL THEN
    UPDATE public.tactical_ai_user_usage
       SET needs_more_count = needs_more_count + 1, limit_hit_at = COALESCE(limit_hit_at, now()), updated_at = now()
     WHERE id = v_u.id;
    IF v_scope = 'school' THEN
      UPDATE public.tactical_ai_school_usage
         SET needs_more_count = needs_more_count + 1, limit_hit_at = COALESCE(limit_hit_at, now()), updated_at = now()
       WHERE id = v_s.id;
    END IF;
    INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, denied_scope, finished_at)
    VALUES (p_school_id, p_user_id, v_period, p_sport, 'denied', v_scope, now());
    RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
           || jsonb_build_object('ok', false, 'denied_scope', v_scope);
  END IF;

  INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, reserved_micro_usd)
  VALUES (p_school_id, p_user_id, v_period, p_sport, 'reserved', p_estimate_micro_usd)
  RETURNING id INTO v_id;
  UPDATE public.tactical_ai_user_usage
     SET reserved_micro_usd = reserved_micro_usd + p_estimate_micro_usd, updated_at = now()
   WHERE id = v_u.id;
  UPDATE public.tactical_ai_school_usage
     SET reserved_micro_usd = reserved_micro_usd + p_estimate_micro_usd, updated_at = now()
   WHERE id = v_s.id;

  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
         || jsonb_build_object('ok', true, 'reservation_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_reserve(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_reserve(uuid, uuid, text, bigint) TO service_role;

-- Cobra el costo REAL y libera la reserva. Idempotente: una reserva ya cerrada
-- no se cobra dos veces. Una vencida (ya liberada) igual se cobra: la plata se
-- gastó en el proveedor.
CREATE OR REPLACE FUNCTION public.tactical_ai_settle(
  p_reservation_id uuid,
  p_cost_micro_usd bigint,
  p_provider text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cache_read_tokens integer,
  p_cache_write_tokens integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run   public.tactical_ai_runs;
  v_hold  bigint;
  v_cost  bigint := GREATEST(COALESCE(p_cost_micro_usd, 0), 0);
  v_in    integer := GREATEST(COALESCE(p_input_tokens, 0), 0);
  v_out   integer := GREATEST(COALESCE(p_output_tokens, 0), 0);
  v_cr    integer := GREATEST(COALESCE(p_cache_read_tokens, 0), 0);
  v_cw    integer := GREATEST(COALESCE(p_cache_write_tokens, 0), 0);
BEGIN
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva inexistente' USING ERRCODE = 'P0002';
  END IF;
  IF v_cost > 10000000 THEN
    RAISE EXCEPTION 'costo fuera de rango' USING ERRCODE = '22023';
  END IF;

  PERFORM public._tactical_ai_lock_school(v_run.school_id, v_run.period);
  IF v_run.user_id IS NOT NULL THEN
    PERFORM public._tactical_ai_lock_user(v_run.school_id, v_run.user_id, v_run.period);
  END IF;
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id FOR UPDATE;

  IF v_run.status NOT IN ('reserved', 'expired') THEN
    RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
           || jsonb_build_object('ok', true, 'already', v_run.status);
  END IF;
  v_hold := CASE WHEN v_run.status = 'reserved' THEN v_run.reserved_micro_usd ELSE 0 END;

  UPDATE public.tactical_ai_runs
     SET status = 'settled', cost_micro_usd = v_cost, finished_at = now(),
         provider = left(p_provider, 40), model = left(p_model, 120),
         input_tokens = v_in, output_tokens = v_out, cache_read_tokens = v_cr, cache_write_tokens = v_cw
   WHERE id = v_run.id;

  IF v_run.user_id IS NOT NULL THEN
    UPDATE public.tactical_ai_user_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_hold, 0),
           used_micro_usd = used_micro_usd + v_cost,
           analyses = analyses + 1,
           input_tokens = input_tokens + v_in, output_tokens = output_tokens + v_out,
           cache_read_tokens = cache_read_tokens + v_cr, cache_write_tokens = cache_write_tokens + v_cw,
           updated_at = now()
     WHERE school_id = v_run.school_id AND user_id = v_run.user_id AND period = v_run.period;
  END IF;
  UPDATE public.tactical_ai_school_usage
     SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_hold, 0),
         used_micro_usd = used_micro_usd + v_cost,
         analyses = analyses + 1,
         updated_at = now()
   WHERE school_id = v_run.school_id AND period = v_run.period;

  RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_settle(uuid, bigint, text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_settle(uuid, bigint, text, text, integer, integer, integer, integer) TO service_role;

-- El modelo falló / la salida no sirvió: se libera la reserva sin cobrar.
CREATE OR REPLACE FUNCTION public.tactical_ai_release(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_run public.tactical_ai_runs;
BEGIN
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva inexistente' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._tactical_ai_lock_school(v_run.school_id, v_run.period);
  IF v_run.user_id IS NOT NULL THEN
    PERFORM public._tactical_ai_lock_user(v_run.school_id, v_run.user_id, v_run.period);
  END IF;
  SELECT * INTO v_run FROM public.tactical_ai_runs WHERE id = p_reservation_id FOR UPDATE;

  IF v_run.status = 'reserved' THEN
    UPDATE public.tactical_ai_runs SET status = 'released', finished_at = now() WHERE id = v_run.id;
    IF v_run.user_id IS NOT NULL THEN
      UPDATE public.tactical_ai_user_usage
         SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_run.reserved_micro_usd, 0), updated_at = now()
       WHERE school_id = v_run.school_id AND user_id = v_run.user_id AND period = v_run.period;
    END IF;
    UPDATE public.tactical_ai_school_usage
       SET reserved_micro_usd = GREATEST(reserved_micro_usd - v_run.reserved_micro_usd, 0), updated_at = now()
     WHERE school_id = v_run.school_id AND period = v_run.period;
  END IF;

  RETURN public._tactical_ai_balance_json(v_run.school_id, v_run.user_id, v_run.period)
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_release(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_release(uuid) TO service_role;

-- Misma jugada ya analizada en la escuela: USD 0, solo se cuenta.
CREATE OR REPLACE FUNCTION public.tactical_ai_record_cache_hit(p_school_id uuid, p_user_id uuid, p_sport text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_u      public.tactical_ai_user_usage;
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  PERFORM public._tactical_ai_lock_school(p_school_id, v_period);
  v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);
  UPDATE public.tactical_ai_user_usage SET cache_hits = cache_hits + 1, updated_at = now() WHERE id = v_u.id;
  INSERT INTO public.tactical_ai_runs (school_id, user_id, period, sport, status, finished_at)
  VALUES (p_school_id, p_user_id, v_period, p_sport, 'cache_hit', now());
  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period) || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_record_cache_hit(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_record_cache_hit(uuid, uuid, text) TO service_role;

-- Saldo del mes en curso (sin crear filas). El BFF ya validó quién pregunta.
CREATE OR REPLACE FUNCTION public.tactical_ai_user_balance(p_school_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'school_id y user_id requeridos' USING ERRCODE = '22023';
  END IF;
  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, public.tactical_ai_current_period())
         || jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.tactical_ai_user_balance(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tactical_ai_user_balance(uuid, uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Más cupo (super admin). Gate interno: authenticated tiene EXECUTE para que
--    el super admin la llame con su sesión (queda como granted_by).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(
  p_school_id uuid,
  p_amount_usd numeric,
  p_user_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_period text := public.tactical_ai_current_period();
  v_micro  bigint;
  v_s      public.tactical_ai_school_usage;
  v_u      public.tactical_ai_user_usage;
BEGIN
  -- service_role (BFF), super admin con su sesión, o la consola SQL SIN sesión
  -- simulada (una sesión con claims de authenticated/anon no pasa por ahí).
  IF NOT (
    COALESCE((SELECT auth.jwt()) ->> 'role', '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND COALESCE((SELECT auth.jwt()) ->> 'role', '') NOT IN ('authenticated', 'anon'))
    OR COALESCE((SELECT public.is_super_admin()), false)
  ) THEN
    RAISE EXCEPTION 'solo super admin o service_role' USING ERRCODE = '42501';
  END IF;
  IF p_school_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'escuela inexistente' USING ERRCODE = '22023';
  END IF;
  IF p_amount_usd IS NULL OR p_amount_usd < 0.01 OR p_amount_usd > 1000 THEN
    RAISE EXCEPTION 'p_amount_usd debe estar entre 0.01 y 1000' USING ERRCODE = '22023';
  END IF;
  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_members sm
     WHERE sm.school_id = p_school_id AND sm.profile_id = p_user_id AND sm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'el usuario no es miembro activo de la escuela' USING ERRCODE = '22023';
  END IF;
  v_micro := round(p_amount_usd * 1000000)::bigint;

  v_s := public._tactical_ai_lock_school(p_school_id, v_period);
  IF p_user_id IS NOT NULL THEN
    v_u := public._tactical_ai_lock_user(p_school_id, p_user_id, v_period);
    UPDATE public.tactical_ai_user_usage
       SET extra_micro_usd = extra_micro_usd + v_micro, updated_at = now()
     WHERE id = v_u.id;
  END IF;
  -- Con o sin usuario, el techo de la escuela sube lo mismo (lo regalado a un
  -- coach no puede quedar frenado por el techo).
  UPDATE public.tactical_ai_school_usage
     SET extra_micro_usd = extra_micro_usd + v_micro, updated_at = now()
   WHERE id = v_s.id;

  INSERT INTO public.tactical_ai_grants (school_id, user_id, period, amount_micro_usd, note, granted_by)
  VALUES (p_school_id, p_user_id, v_period, v_micro, left(p_note, 300), (SELECT auth.uid()));

  RETURN public._tactical_ai_balance_json(p_school_id, p_user_id, v_period)
         || jsonb_build_object('ok', true, 'granted_micro_usd', v_micro);
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, numeric, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, numeric, uuid, text) TO authenticated, service_role;

-- Compatibilidad con la firma de 20261014111442 («N análisis» a la escuela):
-- N análisis = N × USD 0,08 (el estimado de reserva) de techo de escuela.
CREATE OR REPLACE FUNCTION public.grant_tactical_ai_credits(p_school_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'p_amount debe estar entre 1 y 10000' USING ERRCODE = '22023';
  END IF;
  RETURN public.grant_tactical_ai_credits(
    p_school_id, (p_amount * 0.08)::numeric, NULL::uuid,
    'compat: ' || p_amount || ' análisis (firma vieja, 20261014111442)');
END;
$$;

REVOKE ALL ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_tactical_ai_credits(uuid, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Lo obsoleto de 20261014111442: se conserva sin borrar datos, congelado.
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.tactical_ai_credits IS
  'OBSOLETA desde 20261014155445: el cupo pasó a costo real por usuario (tactical_ai_user_usage / tactical_ai_school_usage). Se conserva solo lectura; nadie la mueve.';
COMMENT ON FUNCTION public.tactical_ai_free_quota() IS
  'OBSOLETA desde 20261014155445 (cupo en número de análisis). Ver tactical_ai_user_budget_micro_usd().';
COMMENT ON FUNCTION public.consume_tactical_ai_credit(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_reserve / tactical_ai_settle / tactical_ai_release.';
COMMENT ON FUNCTION public.refund_tactical_ai_credit(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_release.';
COMMENT ON FUNCTION public.tactical_ai_balance(uuid) IS
  'OBSOLETA desde 20261014155445. Usar tactical_ai_user_balance.';
REVOKE EXECUTE ON FUNCTION public.consume_tactical_ai_credit(uuid) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.refund_tactical_ai_credit(uuid)  FROM service_role;

COMMIT;
