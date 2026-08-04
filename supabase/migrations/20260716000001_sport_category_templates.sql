-- ============================================================
-- SPORTMAPS — Catálogo de plantillas de categorías por deporte
-- ------------------------------------------------------------
-- Alimenta el editor de Categorías de torneos con SUGERENCIAS por deporte
-- (fútbol → Sub-10/12/15 × rama + tamaño de equipo; cheer/gimnasia → niveles;
-- natación → por edad individual). El organizador las agrega de un clic y las
-- edita libremente. Editable por super-admin (RLS de escritura).
--
-- sport se guarda en minúsculas sin tildes para casar con events.sport
-- (que llega como 'futbol','porras','tejo'...). El BFF hace lower() al filtrar.
-- Fecha: 2026-07-16
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sport_category_templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sport       text NOT NULL,                 -- key normalizada: 'futbol','porras','gimnasia',...
    archetype   text,                          -- 'team' | 'judged' | 'race' (informativo)
    division    text NOT NULL,
    category    text NOT NULL,
    rama        text NOT NULL DEFAULT 'Mixto' CHECK (rama IN ('Masculino','Femenino','Mixto')),
    level       text,                          -- nivel (cheer/gimnasia); NULL si no aplica
    age_min     integer,
    age_max     integer,
    team_min    integer,
    team_max    integer,
    sort_order  integer NOT NULL DEFAULT 0,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sport_cat_templates_sport ON public.sport_category_templates (lower(sport)) WHERE is_active;

ALTER TABLE public.sport_category_templates ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier autenticado (para poblar el editor).
DROP POLICY IF EXISTS sport_cat_templates_read ON public.sport_category_templates;
CREATE POLICY sport_cat_templates_read ON public.sport_category_templates
    FOR SELECT TO authenticated USING (true);

-- Escritura: solo super-admin de plataforma.
DROP POLICY IF EXISTS sport_cat_templates_admin_write ON public.sport_category_templates;
CREATE POLICY sport_cat_templates_admin_write ON public.sport_category_templates
    FOR ALL TO authenticated
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- ── Seed de arranque (editable luego por admin) ─────────────────────────────
INSERT INTO public.sport_category_templates (sport, archetype, division, category, rama, level, age_min, age_max, team_min, team_max, sort_order) VALUES
-- Fútbol (equipo)
('futbol','team','Sub-8','Sub-8','Mixto',NULL,6,8,7,16,1),
('futbol','team','Sub-10','Sub-10','Masculino',NULL,9,10,7,18,2),
('futbol','team','Sub-10','Sub-10','Femenino',NULL,9,10,7,18,3),
('futbol','team','Sub-12','Sub-12','Masculino',NULL,11,12,11,20,4),
('futbol','team','Sub-12','Sub-12','Femenino',NULL,11,12,11,20,5),
('futbol','team','Sub-15','Sub-15','Masculino',NULL,13,15,11,22,6),
('futbol','team','Sub-15','Sub-15','Femenino',NULL,13,15,11,22,7),
('futbol','team','Libre','Libre','Masculino',NULL,16,99,11,22,8),
('futbol','team','Libre','Libre','Femenino',NULL,16,99,11,22,9),
-- Baloncesto (equipo)
('baloncesto','team','Sub-13','Sub-13','Masculino',NULL,11,13,5,12,1),
('baloncesto','team','Sub-13','Sub-13','Femenino',NULL,11,13,5,12,2),
('baloncesto','team','Sub-15','Sub-15','Masculino',NULL,14,15,5,12,3),
('baloncesto','team','Sub-17','Sub-17','Mixto',NULL,16,17,5,12,4),
-- Voleibol (equipo)
('voleibol','team','Sub-14','Sub-14','Femenino',NULL,12,14,6,14,1),
('voleibol','team','Sub-17','Sub-17','Femenino',NULL,15,17,6,14,2),
('voleibol','team','Libre','Libre','Mixto',NULL,16,99,6,14,3),
-- Porrismo / Cheerleading (juzgado, por nivel)
('porras','judged','All Stars','Prep','Femenino','Prep',5,12,5,24,1),
('porras','judged','All Stars','Novice','Femenino','Novice',5,14,5,24,2),
('porras','judged','All Stars','Nivel 1','Mixto','1',6,16,5,24,3),
('porras','judged','All Stars','Nivel 2','Mixto','2',8,18,5,24,4),
('porras','judged','All Stars','Nivel 3','Mixto','3',10,18,5,24,5),
('cheerleading','judged','All Stars','Prep','Femenino','Prep',5,12,5,24,1),
('cheerleading','judged','All Stars','Novice','Femenino','Novice',5,14,5,24,2),
('cheerleading','judged','All Stars','Nivel 1','Mixto','1',6,16,5,24,3),
('cheerleading','judged','All Stars','Nivel 2','Mixto','2',8,18,5,24,4),
-- Gimnasia (juzgado, niveles USAG, individual)
('gimnasia','judged','USAG','Nivel 1','Femenino','1',6,8,1,1,1),
('gimnasia','judged','USAG','Nivel 2','Femenino','2',7,9,1,1,2),
('gimnasia','judged','USAG','Nivel 3','Femenino','3',8,11,1,1,3),
('gimnasia','judged','USAG','Nivel 4','Femenino','4',9,12,1,1,4),
('gimnasia','judged','USAG','Nivel 5','Femenino','5',10,14,1,1,5),
-- Natación (carrera, por edad, individual)
('natacion','race','Infantil','Infantil','Mixto',NULL,8,10,1,1,1),
('natacion','race','Juvenil','Juvenil','Mixto',NULL,11,14,1,1,2),
('natacion','race','Mayores','Mayores','Mixto',NULL,15,99,1,1,3),
-- Atletismo (carrera, por edad, individual)
('atletismo','race','Menores','Menores','Mixto',NULL,8,11,1,1,1),
('atletismo','race','Juvenil','Juvenil','Mixto',NULL,12,15,1,1,2),
('atletismo','race','Mayores','Mayores','Mixto',NULL,16,99,1,1,3)
ON CONFLICT DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
