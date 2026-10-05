-- =============================================================================
-- 20261005112635_autopay_f0_cerrar_payment_tokens.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261004083707
-- Objetivo: F0 del débito automático (docs/plan-debito-automatico.md, opción A).
--   Cierra lo que hoy está expuesto en la base viva alrededor de las tarjetas
--   guardadas, sin tocar código:
--     1. payment_tokens: policy FOR ALL a `public` sin WITH CHECK (viola I3) y
--        GRANT de INSERT/UPDATE/DELETE a anon y authenticated. Queda SOLO
--        lectura del dueño. El BFF escribe con service_role (no le afecta).
--     2. pending_card_saves y payment_consents: GRANT de escritura a anon y
--        authenticated (las policies ya eran solo SELECT del dueño). Se dejan
--        en solo lectura del dueño. payment_consents es prueba legal
--        (Ley 1581): nadie fuera de service_role la puede alterar.
--     3. create_recurring_subscription de 8 argumentos: SECURITY DEFINER
--        ejecutable por anon. Nadie la llama con esa firma (el BFF usa 11
--        parámetros con nombre) y la tabla que escribe no existe → DROP.
--     4. save_payment_token vieja (11 args, la que aún llama mercadopago.ts):
--        opción A → no se borra; solo se fija search_path (I4). Se elimina en F2.
--   Verificado antes de escribir (2026-10-05): el frontend no lee ni escribe
--   directo ninguna de las 3 tablas; las RPCs que las tocan son solo de
--   service_role.
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

-- ── 1. payment_tokens ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS payment_tokens_owner_all ON public.payment_tokens;

CREATE POLICY payment_tokens_owner_select ON public.payment_tokens
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.payment_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_tokens TO authenticated;

-- ── 2. pending_card_saves y payment_consents ────────────────────────────────
REVOKE ALL ON public.pending_card_saves FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pending_card_saves TO authenticated;

REVOKE ALL ON public.payment_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_consents TO authenticated;

-- ── 3. create_recurring_subscription (8 args) ───────────────────────────────
DROP FUNCTION IF EXISTS public.create_recurring_subscription(
  uuid, uuid, uuid, numeric, smallint, text, uuid, uuid
);

-- ── 4. save_payment_token vieja: solo search_path (opción A) ────────────────
ALTER FUNCTION public.save_payment_token(
  uuid, text, text, text, text, text, date, boolean, text, text, text
) SET search_path = pg_catalog, public, pg_temp;

-- ── Verificación: aborta la transacción si algo quedó abierto ───────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_tokens', 'pending_card_saves', 'payment_consents'] LOOP
    IF has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'F0: anon conserva privilegios sobre %', t;
    END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'F0: authenticated conserva escritura sobre %', t;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('payment_tokens', 'pending_card_saves', 'payment_consents')
      AND cmd <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'F0: queda una policy de escritura sobre las tablas de tarjetas';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_recurring_subscription'
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
           OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'F0: create_recurring_subscription sigue ejecutable por anon/authenticated';
  END IF;
END
$$;

COMMIT;
