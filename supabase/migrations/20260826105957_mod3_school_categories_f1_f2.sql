-- =============================================================================
-- 20260826105957_mod3_school_categories_f1_f2.sql
-- Autor: brylop   Fecha: 2026-08-26   Versión anterior: 20260825234316
-- Objetivo: MOD-3 F1+F2 — catálogo de categorías por escuela y el equipo
--   pertenece a una categoría. Adelantado (fuera del orden del roadmap, que lo
--   pone detrás de DIN-1) porque el roster real de Monster's Volley Club trae
--   ~13 atletas en dos categorías a la vez (confirmado con doc_number
--   repetido entre hojas + la hoja de entrenadores real). Sin esto, cargar el
--   resto del roster obliga a perder el dato o a insertar una segunda fila de
--   enrollments, que rompe school_athletes/open_month (ver spec
--   docs/specs/sport-categories-and-multi-category.md §0.3, D3).
--   F4 (precio por cantidad) queda explícitamente AFUERA: esta carga no
--   factura todavía.
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

-- ─── F1. Catálogo de categorías por escuela ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_categories (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    branch_id       uuid        REFERENCES public.school_branches(id) ON DELETE SET NULL,
    template_id     uuid        REFERENCES public.sport_category_templates(id) ON DELETE SET NULL,
    sport           text        NOT NULL,
    code            text        NOT NULL,
    name            text        NOT NULL,
    rama            text        NOT NULL DEFAULT 'Mixto' CHECK (rama IN ('Masculino','Femenino','Mixto')),
    axis            text        NOT NULL DEFAULT 'age' CHECK (axis IN ('age','weight','belt','level','division','none')),
    age_rule        text        NOT NULL DEFAULT 'age_at_date' CHECK (age_rule IN ('age_at_date','birth_year')),
    age_min         integer,
    age_max         integer,
    birth_year_min  integer,
    birth_year_max  integer,
    level           text,
    belt            text,
    weight_min_kg   numeric,
    weight_max_kg   numeric,
    team_min        integer,
    team_max        integer,
    color           text,
    is_active       boolean     NOT NULL DEFAULT true,
    sort_order      integer     NOT NULL DEFAULT 0,
    metadata        jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT school_categories_age_range  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
    CONSTRAINT school_categories_year_range CHECK (birth_year_min IS NULL OR birth_year_max IS NULL OR birth_year_min <= birth_year_max)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_school_categories_code
    ON public.school_categories (school_id, lower(sport), upper(code), rama)
    WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_school_categories_school
    ON public.school_categories (school_id) WHERE is_active;

ALTER TABLE public.school_categories ENABLE ROW LEVEL SECURITY;

-- Mismo criterio que las policies vivas de teams (Teams: select members /
-- select staff / manage staff): lectura por membresía o por
-- user_school_ids(), escritura por user_staff_school_ids() — crear/editar
-- categorías es trabajo operativo de escuela (coach incluido), no un permiso
-- que se otorga, así que NO es is_school_admin a secas.
CREATE POLICY "school_categories_select_members"
    ON public.school_categories FOR SELECT
    USING (school_id IN (SELECT sm.school_id FROM public.school_members sm WHERE sm.profile_id = auth.uid()));

CREATE POLICY "school_categories_select_staff"
    ON public.school_categories FOR SELECT
    USING (school_id = ANY (public.user_school_ids()));

CREATE POLICY "school_categories_manage_staff"
    ON public.school_categories FOR ALL
    USING (school_id = ANY (public.user_staff_school_ids()))
    WITH CHECK (school_id = ANY (public.user_staff_school_ids()));

REVOKE ALL ON public.school_categories FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_categories TO authenticated;
GRANT ALL ON public.school_categories TO service_role;

COMMENT ON TABLE public.school_categories IS
  'MOD-3 F1: catálogo de categorías deportivas por escuela (ej. "Sub-13", "U15 Femenino Proyección"). No tiene horario ni precio propio — eso vive en teams/offering_plans.';

DROP TRIGGER IF EXISTS update_school_categories_updated_at ON public.school_categories;
CREATE TRIGGER update_school_categories_updated_at
    BEFORE UPDATE ON public.school_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── F2. El equipo pertenece a una categoría ─────────────────────────────────
-- teams.price_monthly ya existe (no es drift en esta base) — solo falta el
-- vínculo a la categoría.
ALTER TABLE public.teams
    ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.school_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.category_id IS
  'MOD-3 F2: la categoría deportiva del equipo. NULL para todo equipo que no haya adoptado el catálogo — comportamiento actual intacto.';

-- ─── Seed: las 13 categorías reales de Monster´s Volley Club (Sede Suba) ─────
-- Confirmadas contra la hoja ENTRENADORES real (no plantilla genérica). Sin
-- wizard de adopción: se cargan directo porque hoy es la única escuela usando
-- esto. sport en minúsculas sin tildes (convención del repo).
INSERT INTO public.school_categories (school_id, sport, code, name, rama, age_rule)
VALUES
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U9U11',       'U9 Y U11 MIXTO',                 'Mixto',     'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U13',         'U13 MIXTO',                       'Mixto',     'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U15FEMPROY',  'U15 FEMENINO PROYECCIÓN',         'Femenino',  'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U15FEMCOMP',  'U15 FEMENINO COMPETENCIA',        'Femenino',  'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U15MASC',     'U15 MASCULINO',                   'Masculino', 'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U17FEMPROY',  'U17 FEMENINO PROYECCIÓN',         'Femenino',  'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U17MASCPROY', 'U17 MASCULINO PROYECCIÓN',        'Masculino', 'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U17MASCCOMP', 'U17 MASCULINO COMPETENCIA',       'Masculino', 'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U19U21FEM',   'U19 Y U21 FEMENINO',              'Femenino',  'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'U19U21MASC',  'U19 Y U21 MASCULINO',             'Masculino', 'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'MAYFEM',      'MAYORES FEMENINO',                'Femenino',  'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'MAYMASC',     'MAYORES MASCULINO',               'Masculino', 'age_at_date'),
    ('eb3ebc77-4ea4-4992-96c8-3c8ec574578c', 'voleibol', 'MAYMIXPROF',  'MIXTO MAYORES PROFUNDIZACIÓN',    'Mixto',     'age_at_date')
ON CONFLICT DO NOTHING;

-- El equipo ya creado en el piloto ("U9 Y U11 MIXTO") queda vinculado a su categoría.
UPDATE public.teams
   SET category_id = (
        SELECT id FROM public.school_categories
         WHERE school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' AND code = 'U9U11'
   )
 WHERE id = 'b45bd5cb-1ac5-457c-bb4e-129477f99108';

COMMIT;
