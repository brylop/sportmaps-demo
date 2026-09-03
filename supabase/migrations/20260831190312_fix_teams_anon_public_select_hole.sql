-- =============================================================================
-- 20260831190312_fix_teams_anon_public_select_hole.sql
-- Autor: brylop   Fecha: 2026-08-31   Versión anterior: 20260831133329
-- Objetivo: cerrar una fuga de lectura anónima en `teams` encontrada al
-- verificar en vivo (sesión Carmel Club, equipos por entrenador).
--
-- Hallazgo: `teams` tiene DOS policies SELECT para el rol `public` (alcanza a
-- `anon`, sin login):
--   · "teams_select_public"   USING (active = true)   — acotada, parece el
--     mecanismo real detrás del catálogo público (SchoolDetailPage.tsx:169,
--     ParentCheckoutPage.tsx:311/337 resuelven school_id desde un teamId sin
--     sesión) y de /explorar.
--   · "Programs: select public"  USING (true)  — SIN NINGÚN filtro. Nombre
--     "Programs" = resto de la migración de renombrado programs→teams
--     (ver [[project_carnets_digitales]], "programs es legacy"). Verificado
--     en vivo simulando `anon`: con esta policy activa, `select count(*) from
--     teams` devuelve las 136 filas de TODAS las escuelas, activas e
--     INACTIVAS — incluye escuelas que nunca pidieron catálogo público (ej.
--     Carmel Club, [[project_club_carmel_reports_consent]], que ya dejó
--     explícito que no quiere compartir datos por fuera de lo estrictamente
--     necesario).
--
-- Fix: DROP de la policy sin filtro. Se conserva "teams_select_public"
-- (active = true) porque acota a lo que el catálogo público necesita y hoy
-- lo usan flujos reales sin sesión (ver arriba) — no se toca ese mecanismo en
-- esta migración. Después del fix, `anon` sigue viendo equipos ACTIVOS de
-- CUALQUIER escuela (ese alcance más amplio es un tema de producto aparte —
-- si el catálogo público debe acotarse por escuela que optó a él, es un
-- cambio separado, no esta migración).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Programs: select public" ON public.teams;

COMMIT;

-- ── Verificación (correr después) ───────────────────────────────────────────
-- set local role anon;
-- select count(*) as visible_rows from public.teams;
-- -- antes: 136 (todas, activas e inactivas, todas las escuelas)
-- -- después: solo las de active = true — confirmar que baja y que
-- --   SchoolDetailPage / ParentCheckoutPage (activas, por school_id o id)
-- --   siguen resolviendo bien.
