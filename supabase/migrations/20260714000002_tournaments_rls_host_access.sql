-- ============================================================
-- SPORTMAPS — Torneos por Escuela: RLS de acceso por escuela host
-- ------------------------------------------------------------
-- Las policies existentes atan el manejo al CREADOR individual
-- (events.creator_id = auth.uid()). Falta que CUALQUIER admin de la escuela
-- dueña del torneo (events.school_id) pueda gestionarlo, y que el host vea/
-- gestione las delegaciones, pagos, categorías y registros de SU evento.
--
-- Se agrega el helper can_manage_event() (SECURITY DEFINER → no dispara RLS
-- del caller, sin recursión al invocarse desde policies de OTRAS tablas) y
-- policies aditivas "host_manage". No se toca nada existente.
-- Convención: is_platform_admin() + school_members(role owner/admin/school_admin, active).
-- Ref: docs/tournaments-decisions.md. Fecha: 2026-07-14
-- ============================================================

BEGIN;

-- ── 0. Helper: ¿el usuario puede gestionar este evento? ────────────────────
CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.events e
        WHERE e.id = p_event_id
          AND (
                e.creator_id = p_uid
             OR public.is_platform_admin()
             OR (e.school_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.school_members sm
                    WHERE sm.school_id  = e.school_id
                      AND sm.profile_id = p_uid
                      AND sm.role   = ANY (ARRAY['owner','admin','school_admin'])
                      AND sm.status = 'active'))
          )
    );
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_event(uuid, uuid) TO authenticated;

-- Helper directo de membresía admin de una escuela (para policy de events,
-- evitando self-select sobre events dentro de su propia policy).
CREATE OR REPLACE FUNCTION public.is_school_admin_of(p_school_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT p_school_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.school_members sm
        WHERE sm.school_id  = p_school_id
          AND sm.profile_id = p_uid
          AND sm.role   = ANY (ARRAY['owner','admin','school_admin'])
          AND sm.status = 'active'
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_school_admin_of(uuid, uuid) TO authenticated;

-- ── 1. events: co-admins de la escuela dueña gestionan el torneo ───────────
DROP POLICY IF EXISTS events_school_admin_manage ON public.events;
CREATE POLICY events_school_admin_manage ON public.events
    FOR ALL TO authenticated
    USING      (public.is_school_admin_of(school_id))
    WITH CHECK (public.is_school_admin_of(school_id));

-- ── 2. event_delegations: el host ve/gestiona las delegaciones de su evento ─
DROP POLICY IF EXISTS delegation_host_manage ON public.event_delegations;
CREATE POLICY delegation_host_manage ON public.event_delegations
    FOR ALL TO authenticated
    USING      (public.can_manage_event(event_id))
    WITH CHECK (public.can_manage_event(event_id));

-- ── 3. event_delegation_payments: idem para pagos ──────────────────────────
DROP POLICY IF EXISTS del_payments_host_manage ON public.event_delegation_payments;
CREATE POLICY del_payments_host_manage ON public.event_delegation_payments
    FOR ALL TO authenticated
    USING      (public.can_manage_event(event_id))
    WITH CHECK (public.can_manage_event(event_id));

-- ── 4. event_categories_config: idem para categorías ───────────────────────
DROP POLICY IF EXISTS categories_host_manage ON public.event_categories_config;
CREATE POLICY categories_host_manage ON public.event_categories_config
    FOR ALL TO authenticated
    USING      (public.can_manage_event(event_id))
    WITH CHECK (public.can_manage_event(event_id));

-- ── 5. event_registrations: el host ve/gestiona los registros de su evento ─
DROP POLICY IF EXISTS registrations_host_manage ON public.event_registrations;
CREATE POLICY registrations_host_manage ON public.event_registrations
    FOR ALL TO authenticated
    USING      (public.can_manage_event(event_id))
    WITH CHECK (public.can_manage_event(event_id));

COMMIT;

NOTIFY pgrst, 'reload schema';
