-- =============================================================================
-- 20260831191515_coach_can_create_teams_carmel.sql
-- Autor: brylop   Fecha: 2026-08-31   Versión anterior: 20260831190312
-- Objetivo: los entrenadores de Carmel Club arman sus propios equipos con sus
-- atletas, pero el equipo queda del club, no del entrenador: no puede
-- reasignar quién lo entrena (eso es admin-only) y si el admin se lo
-- reasigna a otro, pierde la posibilidad de seguir editándolo.
--
-- Contexto — la base viva NO es lo que dicen las migraciones commiteadas:
-- `teams` tiene una policy `"Teams: manage staff" FOR ALL USING (school_id =
-- ANY(user_staff_school_ids()))` que no está en ningún .sql del repo (deriva
-- de esquema sin versionar). `user_staff_school_ids()` incluye a CUALQUIER
-- staff activo, coach incluido — o sea que HOY cualquier coach de CUALQUIER
-- escuela ya puede crear/editar/borrar CUALQUIER equipo de su escuela, y
-- `team_coaches`/`team_branches` tienen el mismo patrón (`..._manage_staff`),
-- así que también puede reasignar el entrenador de un equipo ajeno. No hace
-- falta "dar" permiso nuevo — hace falta RESTRINGIR, y solo para Carmel.
--
-- Como las policies RLS son permisivas (se suman con OR), no se puede restar
-- alcance agregando una policy nueva: hay que reescribir "Teams: manage staff"
-- (y las dos de team_coaches/team_branches) agregando `AND NOT
-- is_scoped_coach_school(school_id)`. Esa condición es `false` para cualquier
-- escuela sin el flag prendido, así que la policy queda matemáticamente
-- idéntica a la de hoy para todas las escuelas menos Carmel — no se midió
-- radio ahí porque no hay radio: la condición no cambia para nadie más.
--
-- Radio en Carmel medido contra la base viva (2026-08-31): 1 sola fila en
-- `team_coaches` (Carlos Arturo Ruiz, sobre el único equipo que él mismo
-- creó) — cero reasignación cruzada que romper.
--
-- `teams.coach_id` NO es `auth.uid()` — es `school_staff.id`. La identidad
-- real del usuario logueado vive en `school_staff.coach_auth_id`. Un helper
-- aparte (`is_own_team_coach`) resuelve ese join para no repetirlo tres veces.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller);
--     REVOKE de PUBLIC primero, GRANT explícito a authenticated después.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

-- ── 1. Toggle en school_settings ─────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_create_teams boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_create_teams IS
    'Si true, un entrenador (coach) de la escuela puede crear y editar SUS '
    'PROPIOS equipos (excepción a la regla general — caso Carmel Club, mismo '
    'patrón que coach_can_create_athletes). El coach NUNCA puede reasignar el '
    'entrenador de un equipo (teams.coach_id, team_coaches, team_branches): '
    'eso es exclusivo de admin/owner, con o sin este flag. Gate en RLS '
    '(teams/team_coaches/team_branches vía is_scoped_coach_school()), no en '
    'el BFF: `teams` no tiene ruta en el BFF, escribe directo '
    'frontend→Supabase. Default false = comportamiento previo a 2026-08-31 '
    'para todas las escuelas (que hoy, por la policy sin versionar '
    '"Teams: manage staff", es MÁS amplio que "solo admin": cualquier staff '
    'ya gestiona cualquier equipo de su escuela).';

UPDATE public.school_settings
SET coach_can_create_teams = true
WHERE school_id = '374a6716-af42-4745-afe1-8d089153e01b'; -- Carmel Club, verificado contra la base (nombre único)

-- ── 2. Helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_scoped_coach_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members sm
    WHERE sm.school_id = p_school_id
      AND sm.profile_id = auth.uid()
      AND sm.role = 'coach'
      AND sm.status = 'active'
  )
  AND EXISTS (
    SELECT 1 FROM public.school_settings ss
    WHERE ss.school_id = p_school_id
      AND ss.coach_can_create_teams = true
  );
$$;

COMMENT ON FUNCTION public.is_scoped_coach_school(uuid) IS
    'true si quien llama es coach activo de p_school_id Y esa escuela activó '
    'coach_can_create_teams (hoy, solo Carmel). Usado para RESTAR alcance a '
    '"...manage staff" en teams/team_coaches/team_branches: NOT '
    'is_scoped_coach_school(school_id) dentro de esas policies deja el '
    'comportamiento de siempre para toda escuela sin el flag.';

REVOKE EXECUTE ON FUNCTION public.is_scoped_coach_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_scoped_coach_school(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_own_team_coach(p_team_coach_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_team_coach_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_staff ss
    WHERE ss.id = p_team_coach_id
      AND ss.coach_auth_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_own_team_coach(uuid) IS
    'true si p_team_coach_id (teams.coach_id, que es school_staff.id, NO '
    'auth.uid()) corresponde al school_staff cuyo coach_auth_id es quien '
    'llama. Resuelve el join una sola vez para las policies de teams.';

REVOKE EXECUTE ON FUNCTION public.is_own_team_coach(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_own_team_coach(uuid) TO authenticated;

-- ── 3. teams: restar alcance a "manage staff", sumar el carril acotado ───────
DROP POLICY IF EXISTS "Teams: manage staff" ON public.teams;
CREATE POLICY "Teams: manage staff" ON public.teams
FOR ALL
USING (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
)
WITH CHECK (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
);

CREATE POLICY "Teams: coach manage own (scoped)" ON public.teams
FOR ALL
USING (
  public.is_scoped_coach_school(school_id)
  AND public.is_own_team_coach(coach_id)
)
WITH CHECK (
  public.is_scoped_coach_school(school_id)
  AND public.is_own_team_coach(coach_id)
);

-- ── 4. team_coaches / team_branches: mismo recorte, sin carril de reemplazo ──
-- Reasignar entrenador o sede es admin-only para el coach acotado — no se
-- agrega ninguna policy nueva para él en estas dos tablas.
DROP POLICY IF EXISTS "team_coaches_manage_staff" ON public.team_coaches;
CREATE POLICY "team_coaches_manage_staff" ON public.team_coaches
FOR ALL
USING (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
)
WITH CHECK (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
);

DROP POLICY IF EXISTS "team_branches_manage_staff" ON public.team_branches;
CREATE POLICY "team_branches_manage_staff" ON public.team_branches
FOR ALL
USING (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
)
WITH CHECK (
  school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
);

-- ── 5. Exponer el flag a v_school_entitlements ───────────────────────────────
-- CREATE OR REPLACE VIEW no permite reordenar/renombrar columnas (42P16), así
-- que se copia la definición vigente completa (confirmada con
-- pg_get_viewdef contra la base, coincidía con 20260828174117) y se agrega
-- la columna nueva al final — mismo patrón que esa migración.
CREATE OR REPLACE VIEW public.v_school_entitlements AS
 SELECT s.id AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter'::text) AS plan_code,
    COALESCE(sub.tier, 'free'::text) AS tier,
    COALESCE(sub.status, 'trialing'::text) AS subscription_status,
    COALESCE(sub.trial_ends_at, s.created_at + '1 mon'::interval) AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,
    s.school_type IS NULL OR (s.school_type = ANY (ARRAY['academy'::text, 'hybrid'::text, 'club'::text, 'escuela'::text, 'gimnasio'::text, 'personal_trainer'::text])) AS has_academy,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_reservations,
    s.school_type = ANY (ARRAY['venue'::text, 'hybrid'::text, 'gimnasio'::text]) AS has_wallet,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'tournaments'::text AND a.enabled)) AS has_tournaments,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'access_control'::text AND a.enabled)) AS has_access_control,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'biomech'::text AND a.enabled)) AS has_biomech,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'nutrition'::text AND a.enabled)) AS has_nutrition,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'::text AND a.enabled)) AS has_whitelabel,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'::text AND a.enabled)) AS has_whatsapp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'wompi'::text AND a.enabled)) AS has_wompi,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'mp'::text AND a.enabled)) AS has_mp,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'store'::text AND a.enabled)) AS has_store,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'accounting'::text AND a.enabled)) AS has_accounting,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND a.addon_key = 'invoicing'::text AND a.enabled)) AS has_invoicing,
    s.created_at AS school_created_at,
    s.account_type,
    sub.school_id IS NOT NULL AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false) AS blocking_exempt,
    sub.blocking_exempt_reason,
    school_is_operational(s.id) AS is_operational,
    (EXISTS ( SELECT 1
           FROM school_addons a
          WHERE a.school_id = s.id AND (a.addon_key = ANY (ARRAY['pwa_branding'::text, 'whitelabel'::text])) AND a.enabled)) AS has_pwa_branding,
    COALESCE(sset.billing_enabled, true) AS has_billing,
    ( SELECT jsonb_object_agg(m.module_key, m.enabled) AS jsonb_object_agg
           FROM school_module_overrides m
          WHERE m.school_id = s.id) AS module_overrides,
    COALESCE(sset.coach_can_create_athletes, false) AS coach_can_create_athletes,
    COALESCE(sset.coach_can_create_teams, false) AS coach_can_create_teams
   FROM schools s
     LEFT JOIN school_subscriptions sub ON sub.school_id = s.id
     LEFT JOIN school_settings sset ON sset.school_id = s.id;

ALTER VIEW public.v_school_entitlements SET (security_invoker = true);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verificación (correr después) ────────────────────────────────────────────
-- 1. Cualquier OTRA escuela (no Carmel) sigue igual — is_scoped_coach_school
--    da false, "Teams: manage staff" queda idéntica a hoy:
--    select set_config('request.jwt.claims', json_build_object('sub','<coach de otra escuela>')::text, true);
--    select public.is_scoped_coach_school('<esa escuela>'); -- debe dar false
--
-- 2. Carlos (Carmel) SOLO gestiona su propio equipo:
--    select set_config('request.jwt.claims', json_build_object('sub','967cfc55-0ce4-45ac-9ecd-5ba4c5a28413')::text, true);
--    set local role authenticated;
--    update teams set name = name where id = '0a01e42f-33ac-4091-8c1d-bb5b1fbaebb1'; -- su equipo: debe andar
--    update teams set name = name where id = '92a7c248-f1c5-4478-9b8a-4f7d5df06952'; -- "Carmel Club" (coach_id null, no es suyo): debe fallar
--    update teams set coach_id = null where id = '0a01e42f-33ac-4091-8c1d-bb5b1fbaebb1'; -- reasignarse: debe fallar (WITH CHECK)
--    insert into team_coaches (team_id, coach_id, school_id) values ('0a01e42f-33ac-4091-8c1d-bb5b1fbaebb1', '<otro staff>', '374a6716-af42-4745-afe1-8d089153e01b'); -- debe fallar
--
-- 3. v_school_entitlements.coach_can_create_teams sale true solo para Carmel:
--    select school_id, coach_can_create_teams from v_school_entitlements
--    where coach_can_create_teams = true; -- debe devolver 1 fila (Carmel)
