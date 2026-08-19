-- ============================================================================
-- SEG-19 (2/2) — El guard de fin de prueba en create_invitation
--
-- Fecha: 2026-08-18
-- Sigue a 20260818071427, que cubrió las dos del QR.
--
-- ── Por qué esta es la que más importa ──────────────────────────────────────
-- De las siete funciones de la Fase B, esta es la única con superficie viva:
-- **36 invitaciones pendientes de escuelas bloqueadas**, y una bloqueada puede
-- seguir emitiendo. Se llama desde cinco pantallas, siempre directo a Supabase:
-- ni las policies RESTRICTIVE de la Fase A (los `SECURITY DEFINER` corren como
-- su dueño) ni el 402 del BFF la alcanzan.
--
-- ── Un solo envoltorio cubre los dos caminos ────────────────────────────────
-- Hay dos sobrecargas, de 8 y de 9 argumentos, y **la de 8 delega en la de 9**.
-- Así que envolviendo solo la de 9 quedan cubiertas las dos: la de 8 llama por
-- nombre y termina en el envoltorio nuevo. No hace falta tocarla.
--
-- ── La escuela no viene por parámetro ───────────────────────────────────────
-- `create_invitation` deriva la escuela de QUIEN INVITA, con esta lógica exacta
-- (se replica igual acá, no una parecida):
--
--     school_members donde profile_id = auth.uid()
--       AND role IN ('owner','admin','super_admin','school_admin')
--       AND status = 'active'
--     y si no hay, schools.owner_id = auth.uid()
--
-- Si no resuelve ninguna, el envoltorio **no decide**: delega, para que el error
-- siga siendo el de la función original («No se encontró una escuela
-- administrada por ti»).
--
-- ── Envolver, no reescribir ─────────────────────────────────────────────────
-- Mismo criterio que en las del QR: el cuerpo original queda intacto y el
-- envoltorio es corto. Al interno se le quita `authenticated`, o el envoltorio
-- sería opcional.
-- ============================================================================

BEGIN;

ALTER FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid)
    RENAME TO create_invitation__interno;

CREATE OR REPLACE FUNCTION public.create_invitation(
    p_email                   text    DEFAULT NULL,
    p_role                    text    DEFAULT 'parent',
    p_child_name              text    DEFAULT NULL,
    p_team_id                 uuid    DEFAULT NULL,
    p_monthly_fee             numeric DEFAULT NULL,
    p_parent_phone            text    DEFAULT NULL,
    p_branch_id               uuid    DEFAULT NULL,
    p_offering_plan_id        uuid    DEFAULT NULL,
    p_unregistered_athlete_id uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
DECLARE
    v_school_id uuid;
BEGIN
    -- Misma resolución que la función original, no una aproximación: si acá se
    -- resolviera distinto, el guard mediría una escuela y la función escribiría
    -- en otra.
    SELECT school_id INTO v_school_id
      FROM public.school_members
     WHERE profile_id = auth.uid()
       AND role IN ('owner', 'admin', 'super_admin', 'school_admin')
       AND status = 'active'
     LIMIT 1;

    IF v_school_id IS NULL THEN
        SELECT id INTO v_school_id
          FROM public.schools
         WHERE owner_id = auth.uid()
         LIMIT 1;
    END IF;

    IF v_school_id IS NOT NULL AND NOT public.school_is_operational(v_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede enviar invitaciones nuevas.'
            USING ERRCODE = '42501';
    END IF;

    -- Si no resolvió escuela, NO se decide acá: delega, para que el mensaje sea
    -- el de la función original.
    RETURN public.create_invitation__interno(
        p_email, p_role, p_child_name, p_team_id, p_monthly_fee,
        p_parent_phone, p_branch_id, p_offering_plan_id, p_unregistered_athlete_id);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.create_invitation__interno(text, text, text, uuid, numeric, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation__interno(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO service_role;

REVOKE ALL  ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_invitation(text, text, text, uuid, numeric, text, uuid, uuid, uuid) IS
    'Envoltorio con el guard de fin de prueba (SEG-19). El cuerpo real esta en '
    'create_invitation__interno, sin tocar. La sobrecarga de 8 argumentos delega en esta, asi que '
    'queda cubierta sin modificarla.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Las tres firmas (envoltorio de 9, sobrecarga de 8, interna de 9) y quién
--    puede ejecutar cada una. Las de 8 y 9 públicas: `authenticated`. La
--    interna: NO.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)                 AS firma,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname LIKE 'create_invitation%'
 ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- 2. La sobrecarga de 8 debe seguir delegando al nombre PÚBLICO (que ahora es el
--    envoltorio). Si dijera `create_invitation__interno`, se saltaría el guard.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)          AS firma,
       (p.prosrc LIKE '%create_invitation__interno%')     AS delega_al_interno_MAL,
       (p.prosrc LIKE '%public.create_invitation(%')      AS delega_al_publico_BIEN
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = 'create_invitation'
   AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%p_unregistered_athlete_id%';

-- 3. Cuántas invitaciones pendientes hay de escuelas que el guard ya bloquearía.
--    Son las que quedaron emitidas antes de este fix: el guard no las borra.
SELECT count(*)                                    AS pendientes_de_escuelas_bloqueadas,
       count(DISTINCT i.school_id)                  AS escuelas
  FROM public.invitations i
 WHERE i.status = 'pending'
   AND NOT public.school_is_operational(i.school_id);
