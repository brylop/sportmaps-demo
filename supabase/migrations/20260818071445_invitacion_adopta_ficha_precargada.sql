-- =============================================================================
-- 20260818071445_invitacion_adopta_ficha_precargada.sql
-- Autor: brylop   Fecha: 2026-08-18   Versión anterior: 20260817222932
-- Objetivo: que aceptar la invitación ADOPTE la ficha que la escuela ya cargó,
--           en vez de crear una segunda. Última puerta abierta antes de Carmel.
--
-- ── El bug ──────────────────────────────────────────────────────────────────
-- `accept_invitation_pro` busca la ficha del hijo con dos consultas, y las dos
-- se quedan cortas:
--
--   1. `parent_id = auth.uid()`             → solo halla lo que YA es suyo.
--   2. `parent_email_temp = v_user_email`   → exige el correo EXACTO.
--
-- Y ambas comparan el nombre con `LOWER(TRIM(...))`, que **no quita acentos**.
--
-- Los dos fallos, medidos en Dynasty:
--
--   · «ANAISABEL MONDRAGON MEJIA» (precargada) vs «Anaisabel Mondragón Mejía»
--     (la invitación): la ó y la í rompen el match aunque el resto sea igual.
--   · Gabriela Buitrago: el correo precargado era `lforero52@`, distinto del de
--     la invitación. Ninguna de las dos consultas la alcanza.
--
-- En los dos casos cae al INSERT y nace el duplicado.
--
-- ── El arreglo ──────────────────────────────────────────────────────────────
-- Se agrega una TERCERA búsqueda, después de las dos que ya existen (no las
-- reemplaza: si alguna acierta, se queda con ese resultado). Busca en TODA la
-- escuela por nombre normalizado —`normalize_athlete_name`, que sí quita
-- acentos— con un candado: solo adopta fichas LIBRES (`parent_id IS NULL`).
--
-- Si la ficha ya tiene otro acudiente, no toca nada y sigue de largo. Eso es un
-- homónimo real o una disputa de acudiente, y adivinar ahí es peor que duplicar.
--
-- ── Por qué no se cruza también por documento o fecha de nacimiento ─────────
-- Porque `invitations` no los tiene: sus columnas son id, school_id, email,
-- role_to_assign, status, created_at, invited_by, branch_id, child_name,
-- team_id, monthly_fee, parent_phone, expires_at, offering_plan_id. El nombre
-- es todo lo que viaja. (`submit_qr_signup` sí cruza por fecha porque el
-- formulario del QR la pide.)
--
-- Riesgo medido antes de aplicar: en Dynasty hay 205 fichas libres y **cero**
-- pares con el mismo nombre normalizado entre ellas, así que no hay ambigüedad
-- posible. Y ninguna de las 205 está sin correo — o sea que el criterio viejo
-- fallaba solo por typo o por correo de otra persona, que es justo lo que pasó.
--
-- ── Por qué se parchea con DO + replace y no con el cuerpo entero ───────────
-- La función tiene 13.635 caracteres y el repo ya no reproduce la base (ver
-- `npm run migrations:drift`). Pegar un cuerpo completo sacado del repo
-- pisaría cualquier cambio que hoy esté vivo y no versionado — que es
-- exactamente cómo se pierden fixes.
--
-- Este DO toma la definición VIVA, le inserta el bloque nuevo y la vuelve a
-- crear. Si el ancla no aparece tal cual, aborta sin tocar nada: es preferible
-- que la migración falle a que reemplace lo que no era.
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

DO $do$
DECLARE
  v_def   text;
  v_viejo text;
  v_nuevo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'accept_invitation_pro';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'accept_invitation_pro no existe — abortado.';
  END IF;

  v_viejo :=
'IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE LOWER(TRIM(parent_email_temp)) = v_user_email
              AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_invite.child_name))
              AND (school_id IS NULL OR school_id = v_invite.school_id)
            ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
            LIMIT 1;
        END IF;';

  v_nuevo :=
'IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE LOWER(TRIM(parent_email_temp)) = v_user_email
              AND LOWER(TRIM(full_name)) = LOWER(TRIM(v_invite.child_name))
              AND (school_id IS NULL OR school_id = v_invite.school_id)
            ORDER BY CASE WHEN school_id = v_invite.school_id THEN 0 ELSE 1 END
            LIMIT 1;
        END IF;

        -- Adopcion por nombre NORMALIZADO en toda la escuela.
        --
        -- Las dos busquedas de arriba usan LOWER(TRIM(...)), que no quita
        -- acentos, y ademas exigen que la ficha ya sea del acudiente o que su
        -- parent_email_temp coincida EXACTO. Por eso «ANAISABEL MONDRAGON
        -- MEJIA» no encontro a «Anaisabel Mondragon Mejia» con tildes, y
        -- Gabriela Buitrago tampoco: el correo precargado era de otra persona.
        -- Resultado: ficha nueva y duplicado.
        --
        -- Solo adopta fichas LIBRES (parent_id IS NULL). Si ya tiene otro
        -- acudiente no toca nada: eso es un homonimo real o una disputa, y
        -- adivinar ahi es peor que duplicar.
        IF v_child_id IS NULL THEN
            SELECT id INTO v_child_id
            FROM public.children
            WHERE school_id = v_invite.school_id
              AND parent_id IS NULL
              AND public.normalize_athlete_name(full_name)
                  = public.normalize_athlete_name(v_invite.child_name)
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;';

  IF position(v_viejo IN v_def) = 0 THEN
    RAISE EXCEPTION
      'El bloque a reemplazar no aparece tal cual en la definicion viva de '
      'accept_invitation_pro. Abortado sin tocar nada: revisar si ya se aplico '
      'o si la funcion cambio.';
  END IF;

  EXECUTE replace(v_def, v_viejo, v_nuevo);
END
$do$;

-- Verificación: si el parche no quedó, que la migración falle acá y no en
-- producción con una familia esperando.
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'accept_invitation_pro'
       AND p.prosrc ILIKE '%normalize_athlete_name%'
  ) THEN
    RAISE EXCEPTION 'accept_invitation_pro no quedo con la adopcion normalizada.';
  END IF;
END
$check$;

COMMIT;
