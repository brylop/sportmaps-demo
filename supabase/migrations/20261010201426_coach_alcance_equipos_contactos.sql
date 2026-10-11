-- =============================================================================
-- 20261010201426_coach_alcance_equipos_contactos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-11   Versión anterior: 20261010201231
-- Objetivo: acotar al ENTRENADOR a los equipos que dirige, en tres frentes:
--   1. Escrituras sobre `teams` / `team_coaches` / `team_branches`.
--   2. Contacto de acudientes (teléfono / correo) en la vista `school_athletes`.
--   3. Disponibilidad médica (`get_school_athlete_availability`).
--
-- Base viva medida el 2026-10-10 (MCP, solo lectura) — lo que había:
--
--   · `teams."Teams: manage staff"` FOR ALL USING/CHECK
--       school_id = ANY(user_staff_school_ids()) AND NOT is_scoped_coach_school(school_id)
--     (sin versionar hasta 20260831191515, que solo le RESTÓ a Carmel).
--     user_staff_school_ids() incluye a cualquier coach → en toda escuela sin
--     coach_can_create_teams un entrenador podía CREAR, EDITAR, ARCHIVAR y
--     BORRAR cualquier equipo de su escuela, incluido cambiarle el precio
--     (teams.price_monthly alimenta la mensualidad en open_month) o el
--     entrenador. Simulado con la sesión de un coach de Besser: 8/8 equipos
--     escribibles dirigiendo 3; de Dynasty: 11/11 dirigiendo 10.
--   · `teams."Programs: manage admin"` FOR ALL USING is_school_admin(school_id)
--     sin WITH CHECK (I3 del linter de invariantes).
--   · `team_coaches_manage_staff` / `team_branches_manage_staff` FOR ALL con el
--     mismo user_staff_school_ids(): un coach podía asignarse (o quitar) a
--     cualquier equipo — y team_coaches es lo que define qué roster, asistencia
--     y contactos ve un coach. Asignar acceso = otorgar permisos → solo admin.
--     Simulado: coach de Dynasty, 81 filas de team_coaches escribibles.
--   · Vista `school_athletes` (security_invoker): parent_email / parent_phone
--     de TODA la escuela para el coach (children es legible para el coach vía
--     coach_school_ids()/staff_school_ids()). Simulado: coach de Besser ve el
--     contacto de 31 familias de equipos que no dirige (de 57); Carmel 54/100;
--     Dynasty 17/489.
--   · get_school_athlete_availability: gate p_school_id = ANY(user_staff_school_ids())
--     → cualquier coach ve las restricciones médicas de toda la escuela.
--     (Hoy athlete_injuries tiene 0 filas: radio 0.)
--
-- Qué NO cambia (verificado contra datos):
--   · Carmel Club (coach_can_create_teams = true): su carril
--     "Teams: coach manage own (scoped)" queda INTACTO (crear/editar/archivar/
--     borrar SUS equipos, sin reasignar entrenador). El trigger nuevo se salta
--     las escuelas con ese flag. Para Carmel no cambia nada en `teams`.
--   · Asistencia, evaluaciones, informes: van por el BFF (service role) o por
--     tablas que esta migración no toca. Últimos 90 días: 0 sesiones de
--     asistencia de coaches de Besser/Carmel/Dynasty sobre equipos que no
--     dirigen (74 Carmel, 51 Besser, 34 Dynasty, todas propias).
--   · Alta/edición de atletas por coach (coach_can_create_athletes,
--     coach_can_edit_categories): van por el BFF con service role. Sin cambio.
--   · El coach sigue viendo NOMBRE, equipo y datos deportivos de toda la
--     escuela en school_athletes (lo necesita para inscribir atletas existentes
--     en su equipo); solo se le enmascara teléfono/correo fuera de sus equipos.
--
-- Escape por escuela (default false = regla nueva):
--   school_settings.coach_can_see_all_contacts — si la escuela decide que sus
--   entrenadores vean el contacto de todas las familias.
--
-- `teams.coach_id` y `team_coaches.coach_id` son `school_staff.id`, NO
-- auth.uid(); la identidad del usuario vive en school_staff.coach_auth_id (con
-- fallback por correo para fichas legacy sin vincular, igual que
-- user_staff_school_ids()).
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

-- ── 0. Toggle por escuela ────────────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_see_all_contacts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_see_all_contacts IS
    'Si true, los entrenadores de la escuela ven teléfono y correo de los '
    'acudientes de TODOS los deportistas (comportamiento previo a '
    '20261010201426). Default false: el coach solo ve el contacto de los '
    'deportistas de los equipos que dirige (teams.coach_id o team_coaches).';

-- ── 1. Helpers ────────────────────────────────────────────────────────────────
-- Equipos que dirige quien llama (principal o asistente). SECURITY DEFINER:
-- lee teams/team_coaches/school_staff sin pasar por su RLS, por eso puede
-- usarse dentro de una policy de `teams` sin auto-recursión.
CREATE OR REPLACE FUNCTION public.user_coached_team_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH yo AS (
    SELECT ss.id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.id
      FROM public.school_staff ss
      JOIN auth.users au ON lower(au.email) = lower(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
  )
  SELECT COALESCE(ARRAY(
    SELECT t.id FROM public.teams t WHERE t.coach_id IN (SELECT id FROM yo)
    UNION
    SELECT tc.team_id FROM public.team_coaches tc WHERE tc.coach_id IN (SELECT id FROM yo)
  ), '{}'::uuid[]);
$$;

COMMENT ON FUNCTION public.user_coached_team_ids() IS
    'Equipos que dirige el usuario actual (teams.coach_id o team_coaches), '
    'resolviendo school_staff por coach_auth_id y, si la ficha no está '
    'vinculada, por correo. Vacío para quien no es entrenador.';

REVOKE ALL ON FUNCTION public.user_coached_team_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_coached_team_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_coached_team_ids() TO authenticated, service_role;

-- ¿A quien llama hay que enmascararle el contacto de familias ajenas en esta
-- escuela? true solo para un ENTRENADOR que no es administración de la
-- escuela, cuando la escuela no activó coach_can_see_all_contacts.
CREATE OR REPLACE FUNCTION public.coach_contact_masked_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_school_id IS NOT NULL
     AND NOT (p_school_id = ANY (public.user_admin_school_ids()))
     AND NOT public.is_platform_admin()
     AND (
          EXISTS (SELECT 1 FROM public.school_members sm
                   WHERE sm.school_id = p_school_id
                     AND sm.profile_id = auth.uid()
                     AND sm.role = 'coach'
                     AND sm.status = 'active')
       OR EXISTS (SELECT 1 FROM public.school_staff ss
                   WHERE ss.school_id = p_school_id
                     AND ss.coach_auth_id = auth.uid()
                     AND ss.status = 'active')
     )
     AND NOT COALESCE((SELECT st.coach_can_see_all_contacts
                         FROM public.school_settings st
                        WHERE st.school_id = p_school_id), false);
$$;

REVOKE ALL ON FUNCTION public.coach_contact_masked_school(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_contact_masked_school(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.coach_contact_masked_school(uuid) TO authenticated, service_role;

-- ── 2. teams ──────────────────────────────────────────────────────────────────
-- Definiciones vivas reemplazadas (copiadas de pg_policies el 2026-10-10):
--   "Teams: manage staff"   FOR ALL TO public
--       USING      ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--       WITH CHECK ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--   "Programs: manage admin" FOR ALL TO public USING (is_school_admin(school_id))  -- sin WITH CHECK
-- Se conservan sin tocar: "Teams: coach manage own (scoped)" (Carmel),
-- "Teams: select members", "Teams: select staff", "teams_select_public" y las
-- tres RESTRICTIVE trial_block_*.
DROP POLICY IF EXISTS "Teams: manage staff"    ON public.teams;
DROP POLICY IF EXISTS "Programs: manage admin" ON public.teams;

-- Administración: user_admin_school_ids() ⊇ is_school_admin() (owner/admin/
-- school_admin activos) + super_admin de escuela + schools.owner_id (dueños sin
-- fila en school_members, que antes entraban por user_staff_school_ids()).
DROP POLICY IF EXISTS "Teams: manage admin" ON public.teams;
CREATE POLICY "Teams: manage admin" ON public.teams
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

-- Entrenador (escuelas SIN coach_can_create_teams): solo EDITA los equipos que
-- dirige. No crea ni borra. Qué columnas puede cambiar lo decide el trigger.
DROP POLICY IF EXISTS "Teams: coach update own" ON public.teams;
CREATE POLICY "Teams: coach update own" ON public.teams
FOR UPDATE TO authenticated
USING (
      id = ANY (public.user_coached_team_ids())
  AND NOT public.is_scoped_coach_school(school_id)
)
WITH CHECK (
      id = ANY (public.user_coached_team_ids())
  AND school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
);

-- Una policy no ve OLD: el corte por columnas va en un trigger. Archivar
-- (status/active), cambiar precio, entrenador principal, sede o escuela queda
-- para administración. Se salta: service_role/jobs (auth.uid() nulo),
-- administración de la escuela, staff de plataforma, y las escuelas con
-- coach_can_create_teams (Carmel), que se rigen por su propio carril sin cambio.
CREATE OR REPLACE FUNCTION public.teams_guard_coach_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.school_id = ANY (public.user_admin_school_ids()) OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF public.is_scoped_coach_school(OLD.school_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.school_id     IS DISTINCT FROM OLD.school_id
  OR NEW.coach_id      IS DISTINCT FROM OLD.coach_id
  OR NEW.price_monthly IS DISTINCT FROM OLD.price_monthly
  OR NEW.status        IS DISTINCT FROM OLD.status
  OR NEW.active        IS DISTINCT FROM OLD.active
  OR NEW.branch_id     IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Solo la administración de la escuela puede cambiar el estado, el precio, la sede o el entrenador de un equipo'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.teams_guard_coach_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teams_guard_coach_update() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_teams_guard_coach_update ON public.teams;
CREATE TRIGGER trg_teams_guard_coach_update
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.teams_guard_coach_update();

-- ── 3. team_coaches / team_branches: asignar acceso = solo administración ────
-- Vivas reemplazadas:
--   team_coaches_manage_staff  FOR ALL TO public
--       USING/CHECK ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--   team_branches_manage_staff FOR ALL TO public (idéntica)
-- Se conservan: *_delete_via_team (is_school_admin), *_select_staff, trial_block_*.
-- school_id no es nulo en ninguna fila de las dos tablas (verificado: 0 y 0).
DROP POLICY IF EXISTS "team_coaches_manage_staff" ON public.team_coaches;
DROP POLICY IF EXISTS "team_coaches_manage_admin" ON public.team_coaches;
CREATE POLICY "team_coaches_manage_admin" ON public.team_coaches
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

DROP POLICY IF EXISTS "team_branches_manage_staff" ON public.team_branches;
DROP POLICY IF EXISTS "team_branches_manage_admin" ON public.team_branches;
CREATE POLICY "team_branches_manage_admin" ON public.team_branches
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

-- ── 4. Disponibilidad médica: el coach ve solo a los de sus equipos ──────────
-- Cuerpo vivo copiado de pg_get_functiondef el 2026-10-10; único cambio: la
-- condición de alcance (administración ve toda la escuela; el resto, solo
-- deportistas inscritos en un equipo que dirige).
CREATE OR REPLACE FUNCTION public.get_school_athlete_availability(p_school_id uuid)
RETURNS TABLE(child_id uuid, profile_id uuid, athlete_name text, availability_status text, rtp_stage text, restrictions text, expected_return date, body_region text, updated_at timestamp with time zone, professional_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT DISTINCT ON (COALESCE(p.child_id, p.profile_id))
           p.child_id, p.profile_id, p.full_name,
           i.availability_status, i.rtp_stage, i.restrictions, i.expected_return,
           i.body_region,  -- zona general ("rodilla"), no diagnóstico: el coach la necesita para adaptar
           i.updated_at, pr.full_name
      FROM public.athlete_injuries i
      JOIN public.clinical_patients p ON p.id = i.patient_id
      JOIN public.profiles pr ON pr.id = i.professional_id
     WHERE p_school_id = ANY (public.user_staff_school_ids())
       AND i.status = 'activa'
       AND public.clinical_patient_has_consent(p.id, 'compartir_disponibilidad')
       AND EXISTS (
            SELECT 1 FROM public.enrollments en
             WHERE en.school_id = p_school_id AND en.status = 'active'
               AND ((p.child_id IS NOT NULL AND en.child_id = p.child_id)
                 OR (p.profile_id IS NOT NULL AND en.user_id = p.profile_id)))
       AND (
            p_school_id = ANY (public.user_admin_school_ids())
         OR EXISTS (
            SELECT 1 FROM public.enrollments ec
             WHERE ec.school_id = p_school_id AND ec.status = 'active'
               AND ec.team_id = ANY (public.user_coached_team_ids())
               AND ((p.child_id IS NOT NULL AND ec.child_id = p.child_id)
                 OR (p.profile_id IS NOT NULL AND ec.user_id = p.profile_id)))
       )
     ORDER BY COALESCE(p.child_id, p.profile_id),
              CASE i.availability_status WHEN 'no_disponible' THEN 0 WHEN 'restringido' THEN 1 ELSE 2 END,
              i.updated_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_school_athlete_availability(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_school_athlete_availability(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_school_athlete_availability(uuid) TO authenticated, service_role;

-- ── 5. school_athletes: contacto enmascarado fuera de los equipos del coach ──
-- Definición viva copiada de pg_get_viewdef el 2026-10-10. Cambios, y nada más:
--   · un LATERAL `hc` por rama que decide hide_contact;
--   · parent_email / parent_phone → NULL cuando hide_contact.
-- Mismas columnas, mismo orden, mismos tipos (CREATE OR REPLACE lo exige).
-- security_invoker = true NO es opcional (ver 20260916103807): sin él la vista
-- corre como owner y salta la RLS de children/enrollments.
-- `(SELECT user_coached_team_ids())::uuid[]` es una subconsulta no correlacionada
-- (el cast es obligatorio: sin él `= ANY (subconsulta)` compara uuid con uuid[] → 42883):
-- el planner la evalúa una sola vez (InitPlan), no por fila.
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true)
AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE COALESCE(c.monthly_fee, 0::numeric)
            END
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.email, c.parent_email_temp)
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.phone, c.parent_phone_temp)
        END AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    c.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(c.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = c.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(c.school_id) THEN NOT (
                    COALESCE(c.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]), false)
                    OR EXISTS ( SELECT 1
                           FROM enrollments e
                          WHERE e.child_id = c.id AND e.status = 'active'::text
                            AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[])))
                ELSE false
            END AS hide_contact) hc ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    sm.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(sm.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = sm.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(sm.school_id) THEN NOT EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
                        AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]))
                ELSE false
            END AS hide_contact) hc ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    ua.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(ua.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = ua.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(ua.school_id) THEN NOT EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
                        AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]))
                ELSE false
            END AS hide_contact) hc ON true
  WHERE ua.linked_profile_id IS NULL;

COMMIT;

-- =============================================================================
-- Verificación post-aplicación (SQL Editor, sin escribir nada):
--
--   select policyname, cmd, roles, qual, with_check from pg_policies
--    where tablename in ('teams','team_coaches','team_branches') order by 1,2;
--   -- Esperado en teams: "Teams: manage admin" (ALL), "Teams: coach update own"
--   -- (UPDATE), "Teams: coach manage own (scoped)" (ALL, Carmel), 3 SELECT y
--   -- 3 trial_block_*. Ya NO: "Teams: manage staff", "Programs: manage admin".
--
--   select reloptions from pg_class where oid = 'public.school_athletes'::regclass;
--   -- Esperado: {security_invoker=true}
--
-- Prueba con sesión simulada: supabase/migrations/_smoke/coach_alcance_equipos_contactos_smoke.sql
-- =============================================================================
