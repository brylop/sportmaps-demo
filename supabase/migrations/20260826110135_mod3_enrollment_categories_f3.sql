-- =============================================================================
-- 20260826110135_mod3_enrollment_categories_f3.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260826105957
-- Objetivo: MOD-3 F3 — multi-categoría real: una inscripción, N categorías.
--   Sigue a 20260826105957 (F1+F2). SIN el trigger de recálculo de precio
--   (eso es F4, explícitamente afuera de esta pasada — esta carga no
--   factura todavía). El punto de enganche en el BFF ya estaba anotado en
--   bff/src/routes/enrollments.ts:395-397 antes de esta migración.
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

CREATE TABLE IF NOT EXISTS public.enrollment_categories (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id uuid        NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    school_id     uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    category_id   uuid        NOT NULL REFERENCES public.school_categories(id) ON DELETE RESTRICT,
    team_id       uuid        REFERENCES public.teams(id) ON DELETE SET NULL,
    is_primary    boolean     NOT NULL DEFAULT false,
    billable      boolean     NOT NULL DEFAULT true,
    status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
    start_date    date        NOT NULL DEFAULT CURRENT_DATE,
    end_date      date,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- R2: sin categorías repetidas en la misma inscripción
CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_categories_unique
    ON public.enrollment_categories (enrollment_id, category_id) WHERE status = 'active';
-- R1: exactamente una principal
CREATE UNIQUE INDEX IF NOT EXISTS ux_enrollment_categories_primary
    ON public.enrollment_categories (enrollment_id) WHERE is_primary AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollment_categories_enrollment
    ON public.enrollment_categories (enrollment_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollment_categories_category
    ON public.enrollment_categories (category_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS update_enrollment_categories_updated_at ON public.enrollment_categories;
CREATE TRIGGER update_enrollment_categories_updated_at
    BEFORE UPDATE ON public.enrollment_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- R3: el team_id de la fila (si trae uno) tiene que pertenecer a esa categoría.
-- No se puede expresar como CHECK (Postgres no permite subquery en CHECK).
CREATE OR REPLACE FUNCTION public.tg_enrollment_categories_check_team()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NEW.team_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.teams t
            WHERE t.id = NEW.team_id AND t.category_id = NEW.category_id
        ) THEN
            RAISE EXCEPTION 'enrollment_categories: team_id % no pertenece a category_id %', NEW.team_id, NEW.category_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrollment_categories_check_team ON public.enrollment_categories;
CREATE TRIGGER trg_enrollment_categories_check_team
    BEFORE INSERT OR UPDATE ON public.enrollment_categories
    FOR EACH ROW EXECUTE FUNCTION public.tg_enrollment_categories_check_team();

-- Helper de RLS: ¿el caller es el sujeto de esta inscripción (o su acudiente)?
-- SECURITY DEFINER para no recursar RLS. Cubre los tres ejes (child/user/unregistered).
CREATE OR REPLACE FUNCTION public.can_view_enrollment(p_enrollment_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.enrollments e
        LEFT JOIN public.children c ON c.id = e.child_id
        LEFT JOIN public.unregistered_athletes ua ON ua.id = e.unregistered_athlete_id
        WHERE e.id = p_enrollment_id
          AND (e.user_id = auth.uid() OR c.parent_id = auth.uid() OR ua.linked_profile_id = auth.uid())
    );
$$;
REVOKE ALL ON FUNCTION public.can_view_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_enrollment(uuid) TO authenticated;

ALTER TABLE public.enrollment_categories ENABLE ROW LEVEL SECURITY;

-- Sin self-recursion: school_id va denormalizado, la policy no hace join a enrollments.
CREATE POLICY "enrollment_categories_select"
    ON public.enrollment_categories FOR SELECT
    USING (
        public.is_school_admin(school_id)
        OR public.is_school_coach(school_id)
        OR public.can_view_enrollment(enrollment_id)
    );

CREATE POLICY "enrollment_categories_manage_staff"
    ON public.enrollment_categories FOR ALL
    USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));

REVOKE ALL ON public.enrollment_categories FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollment_categories TO authenticated;
GRANT ALL ON public.enrollment_categories TO service_role;

COMMENT ON TABLE public.enrollment_categories IS
  'MOD-3 F3: el atleta pertenece a 1..N categorías dentro de UNA inscripción activa (nunca una segunda fila de enrollments). Sin trigger de recálculo de precio — eso es F4, todavía no construido.';

-- Backfill: la inscripción del piloto (Alan, U9 Y U11 MIXTO) queda con su
-- categoría principal ya representada en el modelo nuevo.
INSERT INTO public.enrollment_categories (enrollment_id, school_id, category_id, team_id, is_primary, billable, status)
SELECT 'b0479f6c-da14-4601-8899-3121be537588', 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c', sc.id,
       'b45bd5cb-1ac5-457c-bb4e-129477f99108', true, true, 'active'
FROM public.school_categories sc
WHERE sc.school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND sc.code = 'U9U11'
ON CONFLICT DO NOTHING;

COMMIT;
