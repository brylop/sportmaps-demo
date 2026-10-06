-- =============================================================================
-- 20261005214258_niv_f2_progresion_competitiva.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-06   Versión anterior: 20261005135530
-- Objetivo: F-F (docs/specs/dreamers-reglas-completas-plan.md) — progresión
--   competitiva por puntaje (spec dreamers-niveles-por-horas-y-progresion.md,
--   D3/D4/D5/D6/D15, F2/F3) + bug B5.
--
--   1. B5: el CHECK vivo de competition_results.result_type solo acepta
--      score/time/placement/rounds/rating_change, pero el BFF y el formulario
--      de resultados mandan preparatorio/competencia_oficial → 23514 / 500 en
--      TODAS las escuelas. Se reemplaza por la UNIÓN de ambos catálogos (solo
--      amplía: las 2 filas vivas son 'score' y siguen siendo válidas).
--   2. competition_results.points / competition_level (D3) — dato pasivo, sin
--      flag. Índice para la consulta por atleta y temporada.
--   3. offering_plans.promotion_threshold_points / promotion_min_competition_level
--      (D15): el umbral vive en el plan DESTINO. NULL = sin umbral.
--   4. school_settings.level_progression_enabled (D6) default false: la única
--      mecánica que reacciona a los puntajes (aviso al owner) va detrás de él.
--   5. competition_level_rank(text) y get_level_promotion_eligibility(...):
--      solo LECTURA. Nunca cambia el plan ni el monthly_fee (D4 — sugerido,
--      nunca automático). Solo service_role (lo llama el BFF).
--
-- Seguridad: la policy competition_results_insert_school_or_self deja que el
-- propio atleta inserte filas suyas. Por eso la elegibilidad SOLO cuenta
-- resultados cuyo recorded_by es staff de la escuela (misma semántica que
-- user_staff_school_ids(): miembro activo que no es parent/athlete/accountant,
-- school_staff activo por coach_auth_id o por email, u owner de la escuela).
--
-- Radio: 0 filas tocadas. Columnas nullable / flag en false: para las 371
-- escuelas el despliegue es un no-evento. Cero school_id en la lógica.
-- =============================================================================

BEGIN;

-- ── 1. B5: CHECK de result_type = unión de los dos catálogos ────────────────
ALTER TABLE public.competition_results
  DROP CONSTRAINT IF EXISTS competition_results_result_type_check;

ALTER TABLE public.competition_results
  ADD CONSTRAINT competition_results_result_type_check
  CHECK (result_type IN (
    'score', 'time', 'placement', 'rounds', 'rating_change',   -- catálogo regularizado
    'preparatorio', 'competencia_oficial'                       -- catálogo que escribe la app
  ));

-- ── 2. Puntaje y nivel de la competencia (D3) ───────────────────────────────
ALTER TABLE public.competition_results
  ADD COLUMN IF NOT EXISTS points numeric,
  ADD COLUMN IF NOT EXISTS competition_level text;

ALTER TABLE public.competition_results
  DROP CONSTRAINT IF EXISTS competition_results_points_check;
ALTER TABLE public.competition_results
  ADD CONSTRAINT competition_results_points_check
  CHECK (points IS NULL OR points >= 0);

ALTER TABLE public.competition_results
  DROP CONSTRAINT IF EXISTS competition_results_competition_level_check;
ALTER TABLE public.competition_results
  ADD CONSTRAINT competition_results_competition_level_check
  CHECK (competition_level IS NULL OR competition_level IN ('club', 'regional', 'nacional', 'federacion'));

COMMENT ON COLUMN public.competition_results.points IS
  'Puntaje del resultado (ej. All-Around USAG). NULL para result_type que no son puntaje (D3).';
COMMENT ON COLUMN public.competition_results.competition_level IS
  'Nivel de la competencia: club < regional < nacional < federacion (D3). Ver competition_level_rank().';

CREATE INDEX IF NOT EXISTS idx_competition_results_subject_season
  ON public.competition_results (school_id, subject_type, subject_id, competition_date);

-- ── 3. Umbral de ascenso en el plan destino (D15) ───────────────────────────
ALTER TABLE public.offering_plans
  ADD COLUMN IF NOT EXISTS promotion_threshold_points numeric,
  ADD COLUMN IF NOT EXISTS promotion_min_competition_level text;

ALTER TABLE public.offering_plans
  DROP CONSTRAINT IF EXISTS offering_plans_promotion_threshold_points_check;
ALTER TABLE public.offering_plans
  ADD CONSTRAINT offering_plans_promotion_threshold_points_check
  CHECK (promotion_threshold_points IS NULL OR promotion_threshold_points >= 0);

ALTER TABLE public.offering_plans
  DROP CONSTRAINT IF EXISTS offering_plans_promotion_min_competition_level_check;
ALTER TABLE public.offering_plans
  ADD CONSTRAINT offering_plans_promotion_min_competition_level_check
  CHECK (promotion_min_competition_level IS NULL
         OR promotion_min_competition_level IN ('club', 'regional', 'nacional', 'federacion'));

COMMENT ON COLUMN public.offering_plans.promotion_threshold_points IS
  'Puntaje mínimo para ENTRAR a este plan (plan destino, D15). NULL = el plan no es destino de ascenso. Editable por el owner cada temporada (R4).';
COMMENT ON COLUMN public.offering_plans.promotion_min_competition_level IS
  'Nivel mínimo de competencia en que debe lograrse el puntaje (club/regional/nacional/federacion). NULL = cualquier nivel.';

-- ── 4. Flag por escuela (D6) ────────────────────────────────────────────────
ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS level_progression_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.level_progression_enabled IS
  'Progresión competitiva (F2/F3): aviso al owner y vista de elegibilidad de ascenso. Default false (D6).';

-- ── 5a. Rango de nivel de competencia ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.competition_level_rank(p_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE p_level
           WHEN 'club'       THEN 1
           WHEN 'regional'   THEN 2
           WHEN 'nacional'   THEN 3
           WHEN 'federacion' THEN 4
           ELSE 0            -- NULL / desconocido: no cumple ningún mínimo no nulo
         END;
$$;

REVOKE ALL ON FUNCTION public.competition_level_rank(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.competition_level_rank(text) FROM anon;
REVOKE ALL ON FUNCTION public.competition_level_rank(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.competition_level_rank(text) TO service_role;

-- ── 5b. Elegibilidad de ascenso (solo lectura, D4/D5) ───────────────────────
-- Por cada inscripción activa con plan que tenga al menos un resultado con
-- puntaje, cargado por staff, en la temporada (año calendario p_season):
--   · best_*      : su mejor resultado de la temporada (cualquier nivel).
--   · suggested_* : el plan candidato de MENOR umbral que ya cumple.
-- Candidatos: planes activos de la misma escuela con umbral no nulo, distintos
-- del actual y con umbral mayor que el del plan actual (o cualquiera si el
-- actual no tiene umbral). Un candidato se cumple si el mejor puntaje logrado
-- en un nivel >= promotion_min_competition_level alcanza el umbral.
-- suggested_fee = price del plan sugerido (la escuela decide; nada se escribe).
CREATE OR REPLACE FUNCTION public.get_level_promotion_eligibility(
  p_school_id     uuid,
  p_season        integer,
  p_enrollment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  enrollment_id          uuid,
  subject_type           text,
  subject_id             uuid,
  athlete_name           text,
  current_plan_id        uuid,
  current_plan_name      text,
  current_threshold      numeric,
  best_result_id         uuid,
  best_points            numeric,
  best_level             text,
  best_competition_date  date,
  suggested_plan_id      uuid,
  suggested_plan_name    text,
  suggested_threshold    numeric,
  suggested_min_level    text,
  suggested_fee          numeric,
  qualifying_result_id   uuid,
  qualifying_points      numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH enr AS (
    SELECT e.id,
           e.offering_plan_id,
           CASE
             WHEN e.child_id IS NOT NULL                THEN 'child'
             WHEN e.user_id IS NOT NULL                 THEN 'profile'
             WHEN e.unregistered_athlete_id IS NOT NULL THEN 'unregistered'
           END AS s_type,
           COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) AS s_id
      FROM public.enrollments e
     WHERE e.school_id = p_school_id
       AND e.status = 'active'
       AND e.offering_plan_id IS NOT NULL
       AND (p_enrollment_id IS NULL OR e.id = p_enrollment_id)
  ),
  res AS (
    -- Solo resultados con puntaje, de la temporada, cargados por STAFF de la
    -- escuela (lo que suba el propio atleta por la policy _or_self no cuenta).
    SELECT cr.id, cr.subject_type, cr.subject_id, cr.points,
           cr.competition_level, cr.competition_date
      FROM public.competition_results cr
     WHERE cr.school_id = p_school_id
       AND cr.subject_type IN ('child', 'profile', 'unregistered')
       AND cr.subject_id IS NOT NULL
       AND cr.points IS NOT NULL
       AND cr.competition_date >= make_date(p_season, 1, 1)
       AND cr.competition_date <  make_date(p_season + 1, 1, 1)
       AND (
             EXISTS (SELECT 1 FROM public.schools s
                      WHERE s.id = p_school_id AND s.owner_id = cr.recorded_by)
          OR EXISTS (SELECT 1 FROM public.school_members sm
                      WHERE sm.school_id = p_school_id
                        AND sm.profile_id = cr.recorded_by
                        AND sm.status = 'active'
                        AND sm.role NOT IN ('parent', 'athlete', 'accountant'))
          OR EXISTS (SELECT 1 FROM public.school_staff ss
                      WHERE ss.school_id = p_school_id
                        AND ss.status = 'active'
                        AND (ss.coach_auth_id = cr.recorded_by
                             OR (ss.coach_auth_id IS NULL
                                 AND EXISTS (SELECT 1 FROM auth.users au
                                              WHERE au.id = cr.recorded_by
                                                AND lower(au.email) = lower(ss.email)))))
       )
  ),
  best AS (
    SELECT DISTINCT ON (enr.id)
           enr.id AS enrollment_id, r.id AS result_id, r.points,
           r.competition_level, r.competition_date
      FROM enr
      JOIN res r ON r.subject_type = enr.s_type AND r.subject_id = enr.s_id
     ORDER BY enr.id, r.points DESC,
              public.competition_level_rank(r.competition_level) DESC,
              r.competition_date DESC, r.id
  ),
  cand AS (
    SELECT enr.id AS enrollment_id,
           p.id   AS plan_id,
           p.name AS plan_name,
           p.promotion_threshold_points       AS thr,
           p.promotion_min_competition_level  AS min_level,
           p.price,
           q.result_id,
           q.points
      FROM enr
      JOIN public.offering_plans cur ON cur.id = enr.offering_plan_id
      JOIN public.offering_plans p
        ON p.school_id = p_school_id
       AND p.is_active
       AND p.promotion_threshold_points IS NOT NULL
       AND p.id <> enr.offering_plan_id
       AND (cur.promotion_threshold_points IS NULL
            OR p.promotion_threshold_points > cur.promotion_threshold_points)
      JOIN LATERAL (
        SELECT r.id AS result_id, r.points
          FROM res r
         WHERE r.subject_type = enr.s_type
           AND r.subject_id   = enr.s_id
           AND public.competition_level_rank(r.competition_level)
               >= public.competition_level_rank(p.promotion_min_competition_level)
         ORDER BY r.points DESC, r.competition_date DESC, r.id
         LIMIT 1
      ) q ON q.points >= p.promotion_threshold_points
  ),
  sugg AS (
    SELECT DISTINCT ON (c.enrollment_id) c.*
      FROM cand c
     ORDER BY c.enrollment_id, c.thr ASC, c.price ASC NULLS LAST, c.plan_id
  )
  SELECT enr.id,
         enr.s_type,
         enr.s_id,
         COALESCE(ch.full_name, pr.full_name, ua.full_name) AS athlete_name,
         cur.id, cur.name, cur.promotion_threshold_points,
         b.result_id, b.points, b.competition_level, b.competition_date,
         sg.plan_id, sg.plan_name, sg.thr, sg.min_level, sg.price,
         sg.result_id, sg.points
    FROM enr
    JOIN best b                       ON b.enrollment_id = enr.id
    JOIN public.offering_plans cur    ON cur.id = enr.offering_plan_id
    LEFT JOIN sugg sg                 ON sg.enrollment_id = enr.id
    LEFT JOIN public.children ch      ON enr.s_type = 'child'        AND ch.id = enr.s_id
    LEFT JOIN public.profiles pr      ON enr.s_type = 'profile'      AND pr.id = enr.s_id
    LEFT JOIN public.unregistered_athletes ua
                                      ON enr.s_type = 'unregistered' AND ua.id = enr.s_id
   ORDER BY (sg.plan_id IS NULL), athlete_name;
$$;

COMMENT ON FUNCTION public.get_level_promotion_eligibility(uuid, integer, uuid) IS
  'F-F / D4: elegibilidad de ascenso por puntaje en la temporada p_season (año calendario). Solo lectura: sugiere, nunca cambia plan ni monto. Solo resultados cargados por staff. Solo service_role.';

REVOKE ALL ON FUNCTION public.get_level_promotion_eligibility(uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_level_promotion_eligibility(uuid, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_level_promotion_eligibility(uuid, integer, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_level_promotion_eligibility(uuid, integer, uuid) TO service_role;

COMMIT;
