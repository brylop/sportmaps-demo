-- ============================================================
-- SPORTMAPS — create_invitation reutiliza la invitación pendiente
-- ------------------------------------------------------------
-- Las dos versiones vivas en BD (8 y 9 parámetros) hacían INSERT a secas: cada
-- vez que la escuela invitaba de nuevo al mismo hijo —para cambiarle el plan,
-- por ejemplo— quedaba una invitación pendiente duplicada. Así aparecieron los
-- pares duplicados de Dynasty (anyela0123@, paularozo@).
--
-- Con el índice ux_invitations_pending_unique (20260730000000) ese INSERT pasó
-- a fallar con 23505 y el error crudo de Postgres llegaba a la pantalla.
--
-- Fix: UPSERT sobre ese mismo índice. Invitar de nuevo al mismo (escuela,
-- correo, rol, hijo) ACTUALIZA la pendiente con los datos nuevos y devuelve su
-- id — que es lo que la UI espera para armar el link.
--
-- La versión de 8 parámetros queda delegando en la de 9 para que no haya dos
-- lógicas que mantener. (PostgREST elige overload por nombres de argumento; se
-- conservan ambas firmas para no romper llamadas existentes.)
--
-- Fecha: 2026-07-30
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email                   text  DEFAULT NULL,
    p_role                    text  DEFAULT 'parent',
    p_child_name              text  DEFAULT NULL,
    p_team_id                 uuid  DEFAULT NULL,
    p_monthly_fee             numeric DEFAULT NULL,
    p_parent_phone            text  DEFAULT NULL,
    p_branch_id               uuid  DEFAULT NULL,
    p_offering_plan_id        uuid  DEFAULT NULL,
    p_unregistered_athlete_id uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school_id   uuid;
  v_branch_id   uuid;
  v_id          uuid;
  v_clean_email text;
BEGIN
  -- Limpiar email (NULL si viene vacío)
  v_clean_email := NULLIF(TRIM(COALESCE(p_email, '')), '');
  IF v_clean_email IS NOT NULL THEN
    v_clean_email := LOWER(v_clean_email);
  END IF;

  -- Validar: al menos uno de email o teléfono
  IF v_clean_email IS NULL AND (p_parent_phone IS NULL OR TRIM(p_parent_phone) = '') THEN
    RAISE EXCEPTION 'Se requiere al menos un email o número de teléfono.';
  END IF;

  -- Obtener school_id del usuario actual (el que invita)
  SELECT school_id INTO v_school_id FROM public.school_members
  WHERE profile_id = auth.uid()
    AND role IN ('owner', 'admin', 'super_admin', 'school_admin')
    AND status = 'active'
  LIMIT 1;

  IF v_school_id IS NULL THEN
    SELECT id INTO v_school_id FROM public.schools WHERE owner_id = auth.uid() LIMIT 1;
  END IF;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una escuela administrada por ti.';
  END IF;

  v_branch_id := p_branch_id;
  IF v_branch_id IS NULL THEN
    SELECT id INTO v_branch_id FROM public.school_branches
    WHERE school_id = v_school_id AND is_main = true LIMIT 1;
  END IF;

  -- ── Bloqueo: ya la aceptó ──────────────────────────────────────────────
  -- Reinvitar a alguien que ya entró no tiene sentido y confunde al acudiente.
  IF v_clean_email IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.invitations i
       WHERE i.school_id = v_school_id
         AND LOWER(TRIM(i.email)) = v_clean_email
         AND i.role_to_assign = p_role
         AND LOWER(TRIM(COALESCE(i.child_name, ''))) = LOWER(TRIM(COALESCE(p_child_name, '')))
         AND i.status = 'accepted'
  ) THEN
    -- Sin ERRCODE de constraint a propósito: este mensaje ya está redactado para
    -- una persona y el frontend lo muestra tal cual (ver dbErrorMessage.ts).
    RAISE EXCEPTION 'Esta persona ya aceptó su invitación para % y tiene acceso a la academia.',
      COALESCE(NULLIF(TRIM(p_child_name), ''), 'este atleta');
  END IF;

  -- ── Crear o actualizar la pendiente ────────────────────────────────────
  -- El UPSERT usa ux_invitations_pending_unique: invitar otra vez al mismo
  -- (escuela, correo, rol, hijo) refresca la pendiente en vez de duplicarla.
  INSERT INTO public.invitations (
    email, school_id, role_to_assign, invited_by,
    child_name, team_id, monthly_fee, parent_phone,
    branch_id, offering_plan_id, status
  )
  VALUES (
    v_clean_email, v_school_id, p_role, auth.uid(),
    p_child_name, p_team_id, p_monthly_fee, p_parent_phone,
    v_branch_id, p_offering_plan_id, 'pending'
  )
  ON CONFLICT (school_id, LOWER(TRIM(email)), role_to_assign, LOWER(TRIM(COALESCE(child_name, ''))))
    WHERE status = 'pending' AND email IS NOT NULL
  -- La fila existente se referencia como `invitations.x` (sin esquema: dentro de
  -- ON CONFLICT DO UPDATE solo vale el nombre/alias de la tabla destino).
  DO UPDATE SET
    team_id          = COALESCE(EXCLUDED.team_id,          invitations.team_id),
    offering_plan_id = COALESCE(EXCLUDED.offering_plan_id, invitations.offering_plan_id),
    monthly_fee      = COALESCE(EXCLUDED.monthly_fee,      invitations.monthly_fee),
    parent_phone     = COALESCE(EXCLUDED.parent_phone,     invitations.parent_phone),
    branch_id        = COALESCE(EXCLUDED.branch_id,        invitations.branch_id),
    invited_by       = EXCLUDED.invited_by,
    -- refrescar la fecha para que el link no se vea "viejo" en la lista
    created_at       = now()
  RETURNING id INTO v_id;

  -- ── Vincular unregistered_athlete con la invitación ──────────────────────
  -- Garantiza que accept_invitation_pro pueda resolver el atleta
  -- incluso cuando no hay email (solo teléfono, como en el bulk upload)
  IF p_unregistered_athlete_id IS NOT NULL THEN
    UPDATE public.unregistered_athletes
    SET invitation_id = v_id
    WHERE id = p_unregistered_athlete_id
      AND school_id = v_school_id
      AND linked_profile_id IS NULL;  -- solo si aún no fue migrado
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO authenticated;


-- ── Overload de 8 parámetros: delega, no duplica lógica ─────────────────────
CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email            text  DEFAULT NULL,
    p_role             text  DEFAULT 'parent',
    p_child_name       text  DEFAULT NULL,
    p_team_id          uuid  DEFAULT NULL,
    p_monthly_fee      numeric DEFAULT NULL,
    p_parent_phone     text  DEFAULT NULL,
    p_branch_id        uuid  DEFAULT NULL,
    p_offering_plan_id uuid  DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.create_invitation(
    p_email, p_role, p_child_name, p_team_id, p_monthly_fee,
    p_parent_phone, p_branch_id, p_offering_plan_id, NULL::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
