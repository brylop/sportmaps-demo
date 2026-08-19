-- ============================================================================
-- wellness_evaluations: las columnas que el formulario llena y la tabla no tiene
--
-- Fecha: 2026-08-17
-- Encontrado al regenerar los tipos de Supabase (INF-8).
--
-- ── Lo que está roto hoy ────────────────────────────────────────────────────
-- `WellnessPatientsPage` manda al crear una evaluación:
--     evaluation_type, score, recommendations, follow_up_date, metrics
-- y la tabla solo tiene:
--     id, athlete_id, professional_id, type, date, notes, status, created_at
--
-- El insert de `useWellnessData.createEvaluation` va con `as any`, así que
-- compila y **falla en la base**: crear una evaluación de bienestar nunca
-- funcionó. Además la lectura ordenaba por `evaluation_date`, columna que
-- tampoco existe, así que la lista también fallaba (eso se corrige en el
-- frontend, ordenando por `date`).
--
-- ── Decisiones ──────────────────────────────────────────────────────────────
-- **No** se agrega `evaluation_type` ni `evaluation_date`: ya están, se llaman
-- `type` y `date`. Duplicarlas para que calce el nombre del formulario dejaría
-- dos columnas para el mismo dato, que es peor que renombrar en el frontend.
--
-- Sí se agrega lo que no tiene dónde ir. La alternativa era mapear todo a
-- `notes` y perder el resto, y eso es tirar en silencio lo que el profesional
-- escribió — el mismo defecto que `nequi_number` en el onboarding de
-- organizador (20260817131907).
--
-- `score` va como numeric(5,2) y no como int: una evaluación puede dar 8.5.
-- El CHECK se deja amplio (0–100) porque la escala la define cada tipo de
-- evaluación y no la conocemos.
--
-- ── Por qué es seguro ───────────────────────────────────────────────────────
-- `wellness_evaluations` tiene **0 filas** y `health_records` también
-- (verificado por REST el 2026-08-17): sin backfill y sin riesgo de bloqueo.
-- ============================================================================

BEGIN;

ALTER TABLE public.wellness_evaluations
    ADD COLUMN IF NOT EXISTS health_record_id uuid REFERENCES public.health_records(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS score            numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    ADD COLUMN IF NOT EXISTS recommendations  text,
    ADD COLUMN IF NOT EXISTS follow_up_date   date,
    ADD COLUMN IF NOT EXISTS metrics          jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_wellness_evaluations_athlete
    ON public.wellness_evaluations (athlete_id);
CREATE INDEX IF NOT EXISTS idx_wellness_evaluations_profesional_fecha
    ON public.wellness_evaluations (professional_id, date DESC);

COMMENT ON COLUMN public.wellness_evaluations.metrics IS
    'Mediciones de la evaluación, con forma libre porque depende del tipo. Lo llena el '
    'formulario de WellnessPatientsPage.';

COMMENT ON COLUMN public.wellness_evaluations.score IS
    'Puntaje de la evaluación. numeric porque puede ser 8.5. El CHECK (0–100) es amplio a '
    'propósito: la escala la define cada tipo de evaluación.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: están las seis columnas nuevas y la tabla sigue vacía.
-- ────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'wellness_evaluations'
 ORDER BY ordinal_position;

SELECT count(*) AS filas FROM public.wellness_evaluations;
