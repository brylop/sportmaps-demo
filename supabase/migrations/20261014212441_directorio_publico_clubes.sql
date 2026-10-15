-- =============================================================================
-- 20261014212441_directorio_publico_clubes.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-15   Versión anterior: 20261014153542
-- Objetivo: fuente única del directorio público de clubes para la landing
--           (sportmaps.co/clubes/<slug>, HTML estático en el build).
-- =============================================================================
-- Por qué SECURITY INVOKER y no DEFINER:
--   La función corre con los permisos de quien la llama (anon en el build de la
--   landing) y solo lee lo que anon YA puede leer por diseño:
--     · v_school_settings_publico  → filtra public_profile_enabled = true
--     · schools                    → policy "select public" (lista blanca de I1)
--     · teams                      → policy teams_select_public (active = true)
--     · school_branches            → policy "select public" (lista blanca de I1)
--     · v_school_staff_publico     → solo nombre y especialidad (sin contacto)
--   No amplía ningún acceso: no salta I7 (que solo mira DEFINER) y si mañana se
--   endurece una de esas policies, el directorio se endurece con ella.
--
-- Qué NO sale (aunque anon pudiera leerlo hoy de schools):
--   phone, email, payment_settings, owner_id, branding_settings, nada de
--   deportistas ni de cobros. La descripción solo sale para clubes con dueño:
--   la de las fichas importadas del registro público trae nombres de
--   representantes y no se republica.
--
-- Precios: solo si la escuela tiene show_plans; equipos solo si show_programs.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.list_public_school_directory()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $fn$
  SELECT coalesce(jsonb_agg(club ORDER BY (club->>'is_client')::boolean DESC, club->>'name'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'slug',            s.slug,
      'name',            btrim(s.name),
      'city',            s.city,
      'school_type',     s.school_type,
      'sports',          coalesce(to_jsonb(s.sports), '[]'::jsonb),
      'logo_url',        s.logo_url,
      'cover_image_url', s.cover_image_url,
      'verified',        coalesce(s.verified, false),
      -- Cliente = tiene dueño en SportMaps y al menos un equipo activo.
      'is_client',       (s.owner_id IS NOT NULL AND t.n_teams > 0),
      'description',     CASE WHEN s.owner_id IS NOT NULL THEN nullif(btrim(s.description), '') END,
      'business_hours',  vs.business_hours,
      'teams',           CASE WHEN coalesce(vs.show_programs, true) THEN coalesce(t.teams, '[]'::jsonb) ELSE '[]'::jsonb END,
      'price_from',      CASE WHEN coalesce(vs.show_plans, false) THEN t.price_from END,
      'branches',        coalesce(b.branches, '[]'::jsonb),
      'staff',           CASE WHEN s.owner_id IS NOT NULL THEN coalesce(st.staff, '[]'::jsonb) ELSE '[]'::jsonb END,
      'updated_at',      greatest(s.updated_at, t.last_team_update)
    ) AS club
    FROM public.schools s
    JOIN public.v_school_settings_publico vs ON vs.school_id = s.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS n_teams,
             max(tm.updated_at) AS last_team_update,
             min(tm.price_monthly) FILTER (WHERE tm.price_monthly > 0) AS price_from,
             jsonb_agg(jsonb_build_object(
               'name',       btrim(tm.name),
               'sport',      tm.sport,
               'age_group',  tm.age_group,
               'age_min',    tm.age_min,
               'age_max',    tm.age_max,
               'level',      tm.level,
               'schedule',   tm.schedule,
               'location',   tm.location,
               'accepts_new', tm.admite_nuevos,
               'price_monthly', CASE WHEN coalesce(vs.show_plans, false) THEN tm.price_monthly END
             ) ORDER BY tm.sport, tm.age_min NULLS LAST, tm.name) AS teams
        FROM public.teams tm
       WHERE tm.school_id = s.id
         AND tm.active = true
         AND coalesce(tm.is_demo, false) = false
         AND coalesce(tm.status, 'active') = 'active'
    ) t ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'name', br.name, 'city', br.city, 'address', br.address,
               'lat', br.lat, 'lng', br.lng, 'is_main', br.is_main
             ) ORDER BY br.is_main DESC NULLS LAST, br.name) AS branches
        FROM public.school_branches br
       WHERE br.school_id = s.id
         AND coalesce(br.status, 'active') = 'active'
    ) b ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('full_name', sp.full_name, 'specialty', sp.specialty)
               ORDER BY sp.full_name) AS staff
        FROM public.v_school_staff_publico sp
       WHERE sp.school_id = s.id
    ) st ON true
    WHERE coalesce(s.is_demo, false) = false
      AND s.slug IS NOT NULL
      AND vs.public_profile_enabled
  ) x;
$fn$;

COMMENT ON FUNCTION public.list_public_school_directory() IS
  'Directorio público de clubes para sportmaps.co/clubes (build de la landing). SECURITY INVOKER: solo lee fuentes ya públicas; sin contacto, pagos ni deportistas.';

-- Default privileges dan EXECUTE a PUBLIC/authenticated en cada función nueva
-- (CLAUDE.md, trampa 3): se deja explícito a quién va.
REVOKE ALL ON FUNCTION public.list_public_school_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_school_directory() TO anon, authenticated, service_role;

COMMIT;
