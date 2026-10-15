-- =============================================================================
-- 20261014215112_staff_no_se_reactiva_ni_cambia_de_escuela.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014212627
-- Objetivo: que un miembro del staff, editando SU PROPIA ficha de school_staff,
--           no pueda reactivarse ni mudarse a otra escuela.
-- =============================================================================
-- El agujero (hallado el 2026-10-14 al auditar contextos de rol):
--
--   La policy "Staff manage themselves" (20260814184728) es:
--     FOR UPDATE TO authenticated
--     USING      (email = auth.email())
--     WITH CHECK (email = auth.email() AND school_id = ANY (user_school_ids()))
--
--   user_school_ids() incluye escuelas donde la persona es solo PADRE o ATLETA.
--   Un ex-coach (fila 'inactive') que además es acudiente en otra escuela podía
--   hacer UPDATE de su propia fila a status='active' y school_id = esa escuela.
--   Como user_staff_school_ids() resuelve staff por school_staff (incluso por
--   correo), eso le daba permisos de STAFF en una escuela donde nadie se los dio.
--
-- Por qué un trigger y no otra policy: RLS no puede comparar OLD con NEW. La
-- policy se deja (puede haber clientes que actualicen datos de contacto de su
-- ficha), pero los campos que definen QUIÉN es staff y DÓNDE quedan inmutables
-- para el propio interesado. Quien administra la escuela de la fila
-- (user_admin_school_ids) y los procesos sin JWT (service_role del BFF, SQL)
-- siguen pudiendo cambiarlos.
--
-- Verificado antes de escribir esto: el frontend no hace UPDATE de school_staff
-- en ningún lado; el BFF (bff/src/routes/school-staff.ts) usa service_role.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.school_staff_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Sin usuario (service_role del BFF, migraciones, SQL): no aplica.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Administración de la escuela de la fila: puede cambiar todo, como hoy.
  IF OLD.school_id = ANY (public.user_admin_school_ids()) THEN
    RETURN NEW;
  END IF;

  IF NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Solo la administración de la escuela puede cambiar la escuela, la sede, el estado o el correo de una ficha de staff'
      USING ERRCODE = '42501';
  END IF;

  -- coach_auth_id: solo se puede VINCULAR a uno mismo (de NULL a auth.uid()).
  IF NEW.coach_auth_id IS DISTINCT FROM OLD.coach_auth_id
     AND NOT (OLD.coach_auth_id IS NULL AND NEW.coach_auth_id = auth.uid()) THEN
    RAISE EXCEPTION 'No se puede cambiar la cuenta vinculada a esta ficha de staff'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.school_staff_guard_self_update() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_school_staff_guard_self_update ON public.school_staff;
CREATE TRIGGER trg_school_staff_guard_self_update
  BEFORE UPDATE ON public.school_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.school_staff_guard_self_update();

COMMIT;
