-- ============================================================
-- SPORTMAPS — Una sola "Sede Principal" (is_main) por escuela
--
-- Contexto: el doble-insert histórico (handle_new_user + handle_new_school) y
-- backfills previos dejaron muchas escuelas con 2 sedes is_main=true. El fix
-- del trigger (20260708000001) evita nuevos duplicados; esta migración limpia
-- los existentes y blinda con un índice único.
--
-- ESTRATEGIA (sin borrar, cero riesgo de FK):
--   Por cada escuela con >1 sede is_main, conservar UNA como principal y
--   degradar el resto a is_main=false. Se prioriza conservar la sede que TIENE
--   datos (members/children/teams/payments/enrollments); a igualdad, la más
--   antigua. Las sedes degradadas siguen existiendo (no se pierde nada).
--
--   Luego, índice único parcial: garantiza a nivel BD una sola is_main por
--   escuela para el futuro.
-- ============================================================

-- 1. Degradar las sedes principales sobrantes ---------------------------------
WITH scored AS (
    SELECT
        b.id,
        b.school_id,
        (   EXISTS (SELECT 1 FROM public.school_members m WHERE m.branch_id = b.id)
         OR EXISTS (SELECT 1 FROM public.children       c WHERE c.branch_id = b.id)
         OR EXISTS (SELECT 1 FROM public.teams          t WHERE t.branch_id = b.id)
         OR EXISTS (SELECT 1 FROM public.payments       p WHERE p.branch_id = b.id)
         OR EXISTS (SELECT 1 FROM public.enrollments    e WHERE e.branch_id = b.id)
        ) AS has_ref,
        b.created_at
    FROM public.school_branches b
    WHERE b.is_main = true
),
ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY school_id
               ORDER BY has_ref DESC, created_at ASC, id ASC
           ) AS rn
    FROM scored
)
UPDATE public.school_branches b
   SET is_main = false, updated_at = now()
  FROM ranked r
 WHERE b.id = r.id
   AND r.rn > 1;

-- 2. Índice único: una sola sede principal por escuela ------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_main_branch_per_school
    ON public.school_branches (school_id) WHERE is_main = true;
