-- ============================================================
-- SportMaps — Listado COMPLETO de usuarios registrados
-- Pegar en el SQL editor de Supabase. Solo lectura.
-- ============================================================

-- ── 1) Resumen: conteo por rol ──────────────────────────────
SELECT p.role,
       r.name AS catalogo,
       count(*) AS total
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
GROUP BY p.role, r.name
ORDER BY total DESC;

-- ── 2) Detalle completo de cada usuario ─────────────────────
SELECT
  -- Identidad
  p.email,
  p.full_name,
  p.role                                   AS role_enum,        -- enum legacy (profiles.role)
  r.name                                   AS role_catalogo,    -- nombre en tabla roles (via role_id)
  p.phone,
  p.date_of_birth,
  p.location,

  -- Estado de onboarding / selección de rol
  p.needs_role_selection,
  p.onboarding_started,
  p.onboarding_completed,

  -- Datos de perfil
  p.bio,
  p.sports_interests,
  p.subscription_tier,
  p.sportmaps_points,
  p.invitation_code,
  p.avatar_url,
  p.preferences,

  -- Datos de auth (auth.users)
  (u.email_confirmed_at IS NOT NULL)       AS email_confirmado,
  u.last_sign_in_at,
  COALESCE(u.raw_app_meta_data->>'provider', '')      AS provider,
  COALESCE(u.raw_app_meta_data->'providers', '[]')    AS providers,

  -- Datos relacionados según rol
  (SELECT count(*) FROM public.schools  s WHERE s.owner_id  = p.id) AS escuelas_propias,
  (SELECT s.name   FROM public.schools  s WHERE s.owner_id  = p.id ORDER BY s.created_at LIMIT 1) AS escuela_nombre,
  (SELECT s.onboarding_status FROM public.schools s WHERE s.owner_id = p.id ORDER BY s.created_at LIMIT 1) AS escuela_onboarding,
  (SELECT count(*) FROM public.children c WHERE c.parent_id = p.id) AS hijos,
  (SELECT vp.vendor_type FROM public.vendor_profiles vp WHERE vp.user_id = p.id LIMIT 1) AS vendor_type,

  -- Fechas
  p.created_at,
  p.updated_at
FROM public.profiles p
LEFT JOIN public.roles r      ON r.id = p.role_id
LEFT JOIN auth.users  u       ON u.id = p.id
-- Filtros opcionales (descomenta):
-- WHERE p.role = 'school'
-- WHERE p.onboarding_completed = false
-- WHERE p.created_at >= '2026-06-01'
ORDER BY p.created_at DESC;

-- ── 3) (Opcional) Detectar posibles desajustes rol↔catálogo ─
-- Filas donde el enum no concuerda con el catálogo (ej. school↔school_admin
-- está bien; athlete↔school_admin sería sospechoso) o sin role_id.
SELECT p.email, p.role AS role_enum, r.name AS catalogo, p.role_id
FROM public.profiles p
LEFT JOIN public.roles r ON r.id = p.role_id
WHERE p.role_id IS NULL
   OR (p.role = 'school'   AND r.name <> 'school_admin')
   OR (p.role = 'admin'    AND r.name <> 'super_admin')
   OR (p.role::text <> r.name
       AND NOT (p.role = 'school' AND r.name = 'school_admin')
       AND NOT (p.role = 'admin'  AND r.name = 'super_admin'))
ORDER BY p.created_at DESC;
