-- Pegar COMPLETO en el SQL Editor de Supabase y ejecutar. Paso 4 de 5 (ver README.md).

-- =============================================================================
-- 20261005135530_cancelar_inscripcion_ficha_anula_cobros.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-05   Versión anterior: 20261005135525
-- Objetivo: al cancelar la inscripción de una ficha SIN cuenta
--   (enrollments.unregistered_athlete_id), anular sus cobros pendientes, con la
--   misma política que set_school_athlete_status. Hallazgo H-08 de
--   docs/qa/monster-prelanzamiento-2026-10-05.md.
-- =============================================================================
--
-- trg_cancel_payments_on_enrollment_cancel (AFTER UPDATE OF status) solo
-- buscaba cobros por user_id / child_id. Las 125 inscripciones de Monster son
-- de fichas (unregistered_athlete_id): si el cron fn_expire_overdue_enrollments
-- o el editor cancelaban una, el atleta desaparecía del roster y de la
-- asistencia pero sus cobros seguían vivos en cartera, con mora.
--
-- Rama nueva, solo para fichas (las de user_id/child_id quedan EXACTAMENTE
-- igual, para no cambiar un comportamiento que hoy usan otras escuelas):
--   · Estados que se anulan: 'pending', 'awaiting_approval', 'overdue' — la
--     política de set_school_athlete_status. 'paid' y 'partial' son dinero
--     recibido y no se tocan.
--   · Qué cobros:
--       - los de ESA inscripción: mismo plan, o mismo equipo sin plan (si otra
--         inscripción activa del atleta tiene ese mismo equipo, el cobro es de
--         la que sigue viva y no se toca);
--       - si el atleta se queda SIN ninguna inscripción activa en la escuela,
--         además todo lo demás que siga pendiente (cobros sin equipo ni plan,
--         mensualidades de un equipo anterior), igual que set_school_athlete_status.
--     Con otra inscripción activa, un cobro que no es de la cancelada queda
--     vivo: open_month emite UN cobro por atleta con el equipo/plan de la
--     inscripción que eligió (caso C de M05).
--
-- Pruebas: supabase/tests/monster_cobros/M05_cancelar_inscripcion_ficha_anula_cobros.sql.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_cancel_payments_on_enrollment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_otra_activa boolean;
BEGIN
  IF NEW.status NOT IN ('cancelled', 'expired', 'rejected') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Cuentas (adulto / menor con acudiente): sin cambios.
  UPDATE public.payments
  SET status = 'cancelled'
  WHERE school_id = NEW.school_id
    AND status IN ('pending', 'awaiting_approval', 'partial')
    AND (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR
      (NEW.child_id IS NOT NULL AND child_id = NEW.child_id)
    )
    AND (
      (NEW.offering_plan_id IS NOT NULL AND offering_plan_id = NEW.offering_plan_id)
      OR (NEW.offering_plan_id IS NULL AND offering_plan_id IS NULL)
    );

  -- FIX 2026-10-05 (H-08) — fichas sin cuenta.
  IF NEW.unregistered_athlete_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.enrollments e
       WHERE e.unregistered_athlete_id = NEW.unregistered_athlete_id
         AND e.school_id = NEW.school_id
         AND e.status = 'active'
         AND e.id <> NEW.id
    ) INTO v_otra_activa;

    UPDATE public.payments p
       SET status     = 'cancelled',
           updated_at = now()
     WHERE p.school_id = NEW.school_id
       AND p.unregistered_athlete_id = NEW.unregistered_athlete_id
       AND p.status IN ('pending', 'awaiting_approval', 'overdue')
       AND (
             (NEW.offering_plan_id IS NOT NULL AND p.offering_plan_id = NEW.offering_plan_id)
          OR (p.offering_plan_id IS NULL AND NEW.team_id IS NOT NULL AND p.team_id = NEW.team_id
              AND NOT (v_otra_activa AND EXISTS (
                    SELECT 1 FROM public.enrollments e2
                     WHERE e2.unregistered_athlete_id = NEW.unregistered_athlete_id
                       AND e2.school_id = NEW.school_id
                       AND e2.status = 'active'
                       AND e2.id <> NEW.id
                       AND e2.team_id = p.team_id)))
          OR (NOT v_otra_activa AND p.offering_plan_id IS NULL AND p.team_id IS NULL)
          OR (NOT v_otra_activa
              AND COALESCE(p.payment_category, 'mensualidad') = 'mensualidad'
              AND p.period_year IS NOT NULL)
       );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_cancel_payments_on_enrollment_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cancel_payments_on_enrollment_cancel() FROM anon;
REVOKE ALL ON FUNCTION public.fn_cancel_payments_on_enrollment_cancel() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancel_payments_on_enrollment_cancel() TO service_role;

COMMIT;

-- Registro (el SQL Editor no deja rastro en schema_migrations)
insert into supabase_migrations.schema_migrations (version, name, created_by)
values ('20261005135530', '20261005135530_cancelar_inscripcion_ficha_anula_cobros', 'sql-editor 2026-10-05') on conflict (version) do nothing;
