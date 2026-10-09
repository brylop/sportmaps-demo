-- =============================================================================
-- 20261008154653_metricas_por_escuela_entrenamiento.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-08   Versión anterior: 20261008154652
-- Objetivo: F5 del spec docs/specs/rediseno-seguimiento-deportivo.md — "cada
--   escuela elige sus métricas". La tabla school_metric_definitions
--   (20260926131340, 0 filas) pasa a guardar también la elección de la
--   evaluación de ENTRENAMIENTO (applies_to 'training' | 'both').
--
--   Lo que YA estaba y no se toca (verificado en la base 2026-10-08):
--     · applies_to text + CHECK ('match','training','both');
--     · UNIQUE (school_id, metric_key)  → el BFF hace upsert sobre esa clave;
--     · INSERT / UPDATE / DELETE solo administración (user_admin_school_ids()),
--       UPDATE con USING y WITH CHECK, ninguna FOR ALL.
--
--   Lo que cambia:
--     1. smd_select: antes leía cualquiera de calendar_family_school_ids()
--        (padres y atletas incluidos) TODAS las filas. Ahora:
--          · staff de la escuela (user_staff_school_ids()) lee todo;
--          · familias solo las filas de PARTIDO ('match','both'), que es lo que
--            la evaluación de partido compartida puede necesitar nombrar.
--        La configuración de entrenamiento es interna de la escuela.
--     2. Trigger de updated_at (no existía; la columna quedaba congelada).
--     3. Índice parcial para la lectura del modal (escuela + entrenamiento activo).
--
--   La escritura real la hace el BFF (service_role) en
--   PUT /api/v1/school/performance/metric-settings, con requireRole admin y en
--   un solo upsert (una sentencia → atómico). Las policies de escritura quedan
--   como defensa si algún día se escribe desde el cliente.
--
--   Antes de aplicar (CLAUDE.md, trampa 1): listar TODAS las policies de la tabla
--     select cmd, policyname, permissive, roles, qual, with_check
--       from pg_policies where tablename = 'school_metric_definitions';
--   Hoy son 4: smd_select, smd_insert, smd_update, smd_delete. Si aparece otra,
--   revisarla: se suman con OR.
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

-- ─── 1. Lectura: staff todo; familias solo criterios de partido ─────────────
-- Sin self-recursion: las funciones de alcance son SECURITY DEFINER y no leen
-- school_metric_definitions.
DROP POLICY IF EXISTS smd_select ON public.school_metric_definitions;
CREATE POLICY smd_select ON public.school_metric_definitions
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_admin())
    OR school_id = ANY ((SELECT public.user_staff_school_ids())::uuid[])
    OR (
      applies_to IN ('match', 'both')
      AND school_id = ANY ((SELECT public.calendar_family_school_ids())::uuid[])
    )
  );

-- ─── 2. updated_at ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS school_metric_definitions_set_updated_at ON public.school_metric_definitions;
CREATE TRIGGER school_metric_definitions_set_updated_at
  BEFORE UPDATE ON public.school_metric_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Índice de la lectura del modal ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_school_metric_definitions_training
  ON public.school_metric_definitions (school_id, sort_order)
  WHERE is_active AND applies_to IN ('training', 'both');

COMMENT ON TABLE public.school_metric_definitions IS
  'Métricas que cada escuela eligió. applies_to: match = evaluación de partido; '
  'training = evaluación rápida de entrenamiento (modal Registrar Rendimiento); '
  'both = las dos. Sin filas training/both activas, el BFF usa la lista corta '
  'por defecto del deporte. Escribe solo administración (BFF metric-settings).';

COMMIT;

-- =============================================================================
-- SEMILLA OPCIONAL — Club Carmel (NO se ejecuta; descomentar solo con el visto
-- del usuario). Deja en la evaluación rápida las 5 por defecto de fútbol.
-- Equivale a guardar esas 5 desde Ajustes → Métricas de evaluación.
-- =============================================================================
-- INSERT INTO public.school_metric_definitions
--   (school_id, metric_key, display_name, scale, unit, min_value, max_value,
--    options, applies_to, sort_order, is_active, source_definition_id)
-- SELECT '374a6716-af42-4745-afe1-8d089153e01b'::uuid,
--        d.metric_key, d.display_name, 'scale_1_5', d.unit, d.min_value, d.max_value,
--        d.options, 'training', o.ord * 10, true, d.id
--   FROM public.sport_metric_definitions d
--   JOIN (VALUES ('actitud_esfuerzo', 1), ('control_balon', 2), ('precision_pase', 3),
--                ('posicionamiento_tactico', 4), ('definicion', 5)) AS o(metric_key, ord)
--     ON o.metric_key = d.metric_key
--  WHERE d.sport_category_id = '5c560204-8c0e-41d9-b73a-d675799f4ab9'  -- Fútbol
--    AND d.is_active
-- ON CONFLICT (school_id, metric_key) DO UPDATE
--   SET applies_to = CASE WHEN school_metric_definitions.applies_to = 'match'
--                         THEN 'both' ELSE 'training' END,
--       sort_order = EXCLUDED.sort_order,
--       is_active  = true;
