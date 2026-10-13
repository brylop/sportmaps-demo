-- =============================================================================
-- 20261010202857_signup_rol_whitelist_y_gates_admin_por_rol.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-11   Versión anterior: 20261010201426
-- Objetivo: que el rol con que alguien se REGISTRA no le dé privilegios.
--
-- El agujero (verificado contra la base viva el 2026-10-10):
--   handle_new_user (trigger AFTER INSERT en auth.users) copiaba
--   raw_user_meta_data.role a profiles.role SIN lista blanca. Ese metadata lo
--   escribe el propio cliente en supabase.auth.signUp({ options: { data } }).
--     · {role:'super_admin'} → profiles.role = 'admin'
--     · cualquier otro valor del enum (reporter, accountant, organizer,
--       external_vendor…) pasaba tal cual.
--   El guard de UPDATE (trg_profiles_guard_role, 20260910073724) está VIVO,
--   pero solo mira UPDATE: el INSERT del signup quedaba fuera.
--
-- Qué abría profiles.role = 'admin' autoasignado (todo comprobado en vivo):
--   1. Policy school_payment_providers_owner_write (FOR ALL, sin TO): rama
--      `profiles.role = 'admin'` sin correlación con la escuela → leer y
--      reescribir llaves y cuenta destino de la pasarela de CUALQUIER escuela
--      por PostgREST. La memoria la daba por "rama muerta" porque ninguna
--      cuenta tenía role='admin'; el signup la revivía.
--   2. BFF payment-providers.routes.ts isAdminGlobal() leía profiles.role
--      (corregido en el mismo cambio, en el BFF).
--   3. BFF requireMarketplaceAuth → PRIVILEGED_ROLES en vendor-products /
--      vendor-services (corregido en el BFF).
--   4. Frontend: menú y rutas estrictas de plataforma (datos igual gateados
--      por is_super_admin() en las RPC admin_*).
--   Y is_support_agent() leía profiles.role = 'super_admin' (soporte: todos
--   los tickets y mensajes). Hoy no se alcanzaba por signup (super_admin se
--   mapeaba a 'admin'), pero es la misma confianza en una columna de perfil.
--
-- Qué cambia:
--   A. public.normalize_signup_role(text): función PURA (IMMUTABLE) con la
--      lista blanca de roles autoasignables. Devuelve el valor de user_role o
--      NULL si el rol no se puede autoasignar.
--      Lista blanca = lo que el registro público ofrece HOY (RegisterPage:
--      athlete, parent, coach, school, wellness_professional, store_owner,
--      personal_trainer) + alias que ya circulan: 'padre' → parent,
--      'wellness' → wellness_professional (link del footer
--      /register?role=wellness, que hoy rompía el cast y caía al fallback).
--      'organizer' NO: se registra como atleta con needs_role_selection=true
--      y lo elige en /onboarding/role (complete_role_selection lo admite).
--   B. handle_new_user: idéntico al vivo salvo la resolución del rol.
--        · rol en la lista blanca           → ese rol (como hoy).
--        · sin rol (OAuth/Google)           → athlete + needs_role_selection
--                                             (como hoy).
--        · 'school_admin'/'admin' SIN invitación pendiente → escuela
--                                             ('school'), como hacía el vivo.
--                                             7 dueños de feb–mar se
--                                             registraron con 'school_admin'
--                                             + school_name.
--        · rol pedido con una invitación PENDIENTE para ese correo y ese rol
--          (reporter, school_admin, accountant…) → athlete SIN selección de
--          rol y SIN autocrear escuela: accept_invitation_pro le pone el rol
--          real. Antes, la invitación school_admin creaba un perfil 'school'
--          (accept_invitation_pro lo rechaza: "cuentas administrativas…") y
--          además una escuela fantasma con el nombre de la que invitaba.
--        · cualquier otro rol (super_admin, admin, reporter, accountant,
--          organizer, external_vendor, basura) → athlete +
--          needs_role_selection = true → /onboarding/role.
--   C. complete_role_selection: solo mientras needs_role_selection = true.
--      Antes cualquier usuario la podía llamar en cualquier momento y pasarse
--      a 'school' u 'organizer'. Único llamador: OnboardingRolePage, que solo
--      se muestra con la bandera en true (redirige a /dashboard si no).
--   D. is_support_agent() → is_platform_admin().
--   E. school_payment_providers_owner_write: la rama `profiles.role='admin'`
--      pasa a is_super_admin(). La rama del dueño (owner_id) queda igual.
--
-- Radio medido (2026-10-10, base viva):
--   · platform_admins activos = 1 (el super admin real, que también tiene
--     profiles.role='super_admin'). D y E no le quitan nada.
--   · profiles.role='admin' = 0 → E no le quita escritura a nadie legítimo.
--     El formulario de pasarelas va por el BFF con service_role.
--   · Signups históricos por metadata.role: parent 876, athlete 158, sin rol
--     59, school 47, coach 38, personal_trainer 14, school_admin 12,
--     wellness_professional 6, store_owner 4, organizer 2, admin 2,
--     reporter 1. Con esta lista blanca, ningún flujo público actual cambia
--     de resultado salvo organizer (pasa por /onboarding/role).
--   · Invitaciones pendientes con rol fuera de la lista: reporter 2,
--     school_admin 1 — caen en el camino "invitación pendiente".
--   · needs_role_selection = true hoy: 6 perfiles (siguen pudiendo elegir).
--   · Las cuentas existentes NO se tocan (ver lista en el reporte).
--
-- Verificar después de aplicar:
--   select public.normalize_signup_role('super_admin');   -- NULL
--   select public.normalize_signup_role(' School ');       -- school
--   select count(*) from public.platform_admins where is_active;  -- >= 1
--   Smoke: supabase/migrations/_smoke/signup_rol_whitelist_smoke.sql
-- =============================================================================

BEGIN;

-- ── A. Lista blanca pura ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_signup_role(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE LOWER(TRIM(COALESCE(p_role, '')))
        WHEN 'athlete'               THEN 'athlete'
        WHEN 'parent'                THEN 'parent'
        WHEN 'padre'                 THEN 'parent'
        WHEN 'coach'                 THEN 'coach'
        WHEN 'school'                THEN 'school'
        WHEN 'wellness_professional' THEN 'wellness_professional'
        WHEN 'wellness'              THEN 'wellness_professional'
        WHEN 'store_owner'           THEN 'store_owner'
        WHEN 'personal_trainer'      THEN 'personal_trainer'
        ELSE NULL
    END;
$$;

COMMENT ON FUNCTION public.normalize_signup_role(text) IS
    'Lista blanca de roles autoasignables en el signup. NULL = no autoasignable '
    '(nunca admin/super_admin/reporter/accountant/organizer). La usa handle_new_user.';

-- Solo la usa el trigger (corre como owner). Default privileges del esquema le
-- dan EXECUTE a authenticated/anon: se revoca explícito (CLAUDE.md, trampa 3).
REVOKE ALL ON FUNCTION public.normalize_signup_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_signup_role(text) FROM anon;
REVOKE ALL ON FUNCTION public.normalize_signup_role(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_signup_role(text) TO service_role;

-- ── B. handle_new_user (desde el cuerpo VIVO de pg_get_functiondef) ─────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  meta_role       text;
  normalized_role text;
  legacy_role     text;
  valid_role_id   uuid;
  new_school_id   uuid;
  school_name_val text;
  v_needs_role    boolean;
  v_dob           date;
  v_invitado      boolean := false;
BEGIN
  meta_role       := LOWER(TRIM(new.raw_user_meta_data->>'role'));
  school_name_val := new.raw_user_meta_data->>'school_name';

  v_needs_role := (meta_role IS NULL OR meta_role = '');

  BEGIN
    v_dob := NULLIF(new.raw_user_meta_data->>'date_of_birth', '')::date;
  EXCEPTION WHEN others THEN
    v_dob := NULL;
  END;

  -- Rol: SOLO de la lista blanca. El metadata lo escribe el cliente.
  legacy_role := public.normalize_signup_role(meta_role);

  IF legacy_role IS NULL AND NOT v_needs_role THEN
    -- Pidió un rol que no se autoasigna. ¿Lo respalda una invitación pendiente
    -- a SU correo con ESE rol? (los links de invitación llevan &role=<rol>).
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.invitations i
         WHERE i.status = 'pending'
           AND i.email IS NOT NULL
           AND LOWER(TRIM(i.email)) = LOWER(TRIM(new.email))
           AND LOWER(TRIM(i.role_to_assign)) = meta_role
      ) INTO v_invitado;
    EXCEPTION WHEN others THEN
      v_invitado := false;
    END;

    IF v_invitado THEN
      -- accept_invitation_pro le pone el rol real; mientras tanto, el menor
      -- privilegio y sin pasar por /onboarding/role.
      legacy_role  := 'athlete';
      v_needs_role := false;
    ELSIF meta_role IN ('school_admin', 'admin') THEN
      -- Alta de escuela con el nombre del catálogo (así se registraron 7
      -- dueños en feb–mar 2026). Mismo resultado que el cuerpo anterior.
      legacy_role := 'school';
    ELSE
      -- super_admin, reporter, accountant, organizer, external_vendor, basura…
      legacy_role  := 'athlete';
      v_needs_role := true;
    END IF;
  END IF;

  IF legacy_role IS NULL OR legacy_role = '' THEN
    legacy_role := 'athlete';   -- sin rol (OAuth): v_needs_role ya es true
  END IF;

  normalized_role := CASE legacy_role WHEN 'school' THEN 'school_admin' ELSE legacy_role END;
  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;

  INSERT INTO public.profiles (
    id, full_name, role, role_id, email,
    avatar_url, phone, date_of_birth, invitation_code, needs_role_selection
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
    legacy_role::public.user_role,
    valid_role_id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_user_meta_data->>'phone',
    v_dob,
    new.raw_user_meta_data->>'invitation_code',
    v_needs_role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name        = EXCLUDED.full_name,
    phone            = COALESCE(EXCLUDED.phone, profiles.phone),
    date_of_birth    = COALESCE(EXCLUDED.date_of_birth, profiles.date_of_birth),
    role             = EXCLUDED.role,
    role_id          = EXCLUDED.role_id,
    invitation_code  = COALESCE(EXCLUDED.invitation_code, profiles.invitation_code),
    updated_at       = now();

  -- Auto-creación de escuela AISLADA. NO se crea la sede aquí: el trigger
  -- on_school_created (handle_new_school) crea Sede Principal + settings +
  -- membresía owner. Insertarla aquí también duplicaba la "Sede Principal".
  -- Con invitación pendiente legacy_role es 'athlete': no se crea escuela
  -- fantasma con el nombre de la escuela que invita.
  IF legacy_role = 'school' AND school_name_val IS NOT NULL AND school_name_val <> '' THEN
    BEGIN
      INSERT INTO public.schools (name, owner_id, onboarding_status, onboarding_step)
      VALUES (school_name_val, new.id, 'in_progress', 2)
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL;  -- el perfil school ya quedó; la escuela se crea luego en onboarding
    END;
  END IF;

  RETURN new;

EXCEPTION WHEN others THEN
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, role_id, email, needs_role_selection)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Nuevo Usuario'),
      -- legacy_role solo puede ser un valor de la lista blanca, 'school' o 'athlete'.
      COALESCE(NULLIF(legacy_role, ''), 'athlete')::public.user_role,
      valid_role_id,
      new.email,
      COALESCE(v_needs_role, true)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN others THEN
    BEGIN
      INSERT INTO public.profiles (id, full_name, role, email, needs_role_selection)
      VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'),
        'athlete'::public.user_role,
        new.email,
        true
      )
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END;
  RETURN new;
END;
$function$;

-- (Sin cambios de GRANT: CREATE OR REPLACE conserva el ACL, y una función
-- RETURNS trigger no se puede invocar como RPC.)

-- ── C. complete_role_selection: solo durante el onboarding ──────────────────
-- Cuerpo vivo + un único chequeo nuevo (needs_role_selection = true).
CREATE OR REPLACE FUNCTION public.complete_role_selection(p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  meta_role text := LOWER(TRIM(p_role));
  normalized_role text;
  legacy_role text;
  valid_role_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF meta_role NOT IN (
    'athlete','parent','coach','school',
    'wellness_professional','store_owner','personal_trainer','organizer'
  ) THEN
    RAISE EXCEPTION 'Rol no permitido: %', p_role;
  END IF;

  -- NUEVO: el rol se elige UNA vez. Fuera del onboarding el cambio de rol va
  -- por invitación (accept_invitation_pro) o por soporte, no a voluntad.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND needs_role_selection IS TRUE
  ) THEN
    RAISE EXCEPTION 'Tu cuenta ya tiene un rol asignado.' USING ERRCODE = '42501';
  END IF;

  IF meta_role = 'school' THEN
    normalized_role := 'school_admin';  legacy_role := 'school';
  ELSIF meta_role = 'parent' THEN
    normalized_role := 'parent';        legacy_role := 'parent';
  ELSE
    normalized_role := meta_role;       legacy_role := meta_role;
  END IF;

  SELECT id INTO valid_role_id FROM public.roles WHERE LOWER(name) = normalized_role LIMIT 1;
  -- No degradar el rol si el catálogo no lo tiene: se respeta legacy_role y
  -- role_id queda NULL (el rol elegido por el usuario manda).

  UPDATE public.profiles
     SET role = legacy_role::public.user_role,
         role_id = valid_role_id,
         needs_role_selection = false,
         updated_at = now()
   WHERE id = v_uid;

  RETURN jsonb_build_object('role', legacy_role, 'needs_role_selection', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_role_selection(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_role_selection(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_role_selection(text) TO authenticated;

-- ── D. is_support_agent → plataforma ─────────────────────────────────────────
-- Usada por support_messages.messages_select_agent,
-- support_tickets.tickets_select_agent y support_tickets.tickets_update_agent.
-- Se conserva la firma y el GRANT (las policies la invocan como authenticated).
CREATE OR REPLACE FUNCTION public.is_support_agent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.is_platform_admin();
$$;

-- ── E. school_payment_providers_owner_write sin profiles.role ────────────────
-- Las policies son PERMISIVAS y se suman con OR: listadas TODAS antes de tocar
-- (2026-10-10): _admin_read (SELECT, user_admin_school_ids() OR
-- is_super_admin()) y _owner_write (ALL). Solo cambia la rama de admin.
DROP POLICY IF EXISTS school_payment_providers_owner_write ON public.school_payment_providers;
CREATE POLICY school_payment_providers_owner_write ON public.school_payment_providers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.schools s
             WHERE s.id = school_payment_providers.school_id
               AND (s.owner_id = auth.uid() OR (SELECT public.is_super_admin()))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.schools s
             WHERE s.id = school_payment_providers.school_id
               AND (s.owner_id = auth.uid() OR (SELECT public.is_super_admin()))
        )
    );

-- Cinturón: si platform_admins quedara vacía, D y E no le conceden nada a
-- nadie (y el BFF tampoco). Abortar antes que dejar a soporte ciego.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE is_active) THEN
        RAISE EXCEPTION 'platform_admins sin filas activas: no aplicar esta migración.';
    END IF;
END $$;

COMMIT;
