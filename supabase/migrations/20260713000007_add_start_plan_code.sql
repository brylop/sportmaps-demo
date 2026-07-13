-- ============================================================
-- SPORTMAPS — Nuevo plan 'start' (Escuela Start $69k)
-- ------------------------------------------------------------
-- Alineación de la escalera de planes con la landing pública:
--   starter=Free Start, start=Escuela Start (NUEVO), crecimiento=Escuela
--   Crecimiento, profesional=Escuela Pro, elite=Escuela Elite, enterprise=Custom.
-- Solo se AGREGA el código 'start' a los CHECK; los demás códigos se mantienen
-- (los nombres/precios viven en saas-plans.ts) para no migrar datos existentes.
-- Fecha: 2026-07-13
-- ============================================================

BEGIN;

-- school_subscriptions.plan_code
DO $$
DECLARE v_name text;
BEGIN
    SELECT conname INTO v_name
      FROM pg_constraint
     WHERE conrelid = 'public.school_subscriptions'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%plan_code%';
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.school_subscriptions DROP CONSTRAINT %I', v_name);
    END IF;
END $$;

ALTER TABLE public.school_subscriptions
    ADD CONSTRAINT school_subscriptions_plan_code_check
    CHECK (plan_code IN ('starter','start','crecimiento','profesional','elite','enterprise'));

-- plan_upgrade_requests.requested_plan_code (si tiene CHECK)
DO $$
DECLARE v_name text;
BEGIN
    SELECT conname INTO v_name
      FROM pg_constraint
     WHERE conrelid = 'public.plan_upgrade_requests'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%requested_plan_code%';
    IF v_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.plan_upgrade_requests DROP CONSTRAINT %I', v_name);
        ALTER TABLE public.plan_upgrade_requests
            ADD CONSTRAINT plan_upgrade_requests_requested_plan_code_check
            CHECK (requested_plan_code IS NULL OR requested_plan_code IN
                ('starter','start','crecimiento','profesional','elite','enterprise'));
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
