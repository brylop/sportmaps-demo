-- =============================================================================
-- 20260902190219_offering_coaches_documentar_y_endurecer_rls.sql
-- Autor: judegor99   Fecha: 2026-09-03   Versión anterior: 20260831172237
-- Objetivo: documentar offering_coaches (vivía en prod sin migración, hallazgo
--   de la auditoría SEG-4/INF-1) y endurecer su RLS: la policy vigente
--   delegaba en user_staff_school_ids() (cualquier coach/staff podía
--   asignarse a sí mismo a cualquier plan llamando Supabase directo con su
--   propio JWT), mientras que el BFF (offerings.ts) ya exige
--   owner/super_admin/admin/school_admin para lo mismo. Se alinea RLS con
--   esa regla de negocio. También revoca el GRANT viejo a anon (predata
--   SEG-23; RLS ya bloqueaba a anon porque no había policy para ese rol,
--   pero el grant de tabla no debía existir de todos modos).
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

-- Documenta el esquema real (verificado en vivo el 2026-09-02) — no-op en
-- producción, donde la tabla ya existe; solo materializa en ambientes nuevos.
CREATE TABLE IF NOT EXISTS public.offering_coaches (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id uuid NOT NULL REFERENCES public.offerings(id) ON DELETE CASCADE,
    coach_id    uuid NOT NULL REFERENCES public.school_staff(id) ON DELETE CASCADE,
    school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT offering_coaches_offering_id_coach_id_key UNIQUE (offering_id, coach_id)
);

ALTER TABLE public.offering_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_members_manage_offering_coaches ON public.offering_coaches;

CREATE POLICY offering_coaches_admin_manage ON public.offering_coaches
    FOR ALL
    TO authenticated
    USING (school_id = ANY (public.user_admin_school_ids()))
    WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

REVOKE ALL ON public.offering_coaches FROM anon;

COMMIT;
