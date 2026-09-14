-- =============================================================================
-- 20260914184316_perfil_publico_horarios_reales.sql
-- Autor: brylop   Fecha: 2026-09-14   Versión anterior: 20260914151934
-- Objetivo: Fase 4 de docs/specs/perfil-publico-plantillas.md — el bloque
--   "Horarios de Atención" del perfil público estaba hardcodeado igual para
--   las 361 escuelas. Se agrega school_settings.business_hours (jsonb, uno
--   por escuela) y se expone en la vista pública. Mientras la escuela no lo
--   configure (NULL), los 4 layouts siguen mostrando el mismo horario fijo
--   de siempre — "cuando eso se active se usa", nada cambia hasta que la
--   escuela lo llena desde su perfil.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. school_settings.business_hours
-- ============================================================
-- Array de hasta 7 filas: [{day, closed, open, close}], day = 0..6
-- (0=domingo..6=sábado, igual convención que schools.ts/DAYS). NULL = la
-- escuela no lo configuró todavía -> el frontend usa el horario fijo actual.
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS business_hours jsonb
  CONSTRAINT school_settings_business_hours_is_array
  CHECK (business_hours IS NULL OR jsonb_typeof(business_hours) = 'array');

COMMENT ON COLUMN public.school_settings.business_hours IS
  'Horario de atención configurado por la escuela para su perfil público. '
  'Array de {day: 0-6, closed: bool, open: "HH:MM", close: "HH:MM"}. NULL = '
  'sin configurar, el perfil público usa el horario fijo de respaldo. '
  'Ver docs/specs/perfil-publico-plantillas.md (Fase 4).';

-- ============================================================
-- 2. Exponer en la vista pública (no es dato sensible)
-- ============================================================
-- Sin WITH (security_invoker=true): la vista original no lo tenía (corre
-- como su dueño), que es lo que le permite a `anon` leerla pese a que
-- school_settings tiene RLS que NO le da acceso directo. Agregarlo acá
-- reactivaría esa RLS y anon perdería la lectura (ver
-- [[project_rls_view_perf_lateral]] en memoria: mismo patrón, otra vista).
CREATE OR REPLACE VIEW public.v_school_settings_publico AS
SELECT school_id,
       public_profile_enabled,
       show_programs,
       show_plans,
       show_facilities,
       business_hours
FROM public.school_settings ss
WHERE public_profile_enabled = true;

COMMIT;
