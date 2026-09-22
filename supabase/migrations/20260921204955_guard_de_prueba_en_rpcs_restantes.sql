-- =============================================================================
-- 20260921204955_guard_de_prueba_en_rpcs_restantes.sql
-- Autor: brylop   Fecha: 2026-09-22   Versión anterior: 20260921131039
-- Objetivo: SEG-15 (Fase B, cola) — cierra el resto de la lista que quedó
-- explícita en 20260813170813 ("FALTA (Fase B, no entra acá)...") y que
-- 20260818071427/20260818131456 (SEG-19) no alcanzaron a cubrir:
-- create_school_join_qr, request_athlete_certificate, issue_athlete_certificate.
--
-- El patrón es el mismo que en SEG-19 y no se repite la explicación completa:
-- las policies RESTRICTIVE de 20260813170813 (Fase A) cubren INSERT/UPDATE/
-- DELETE del navegador vía PostgREST, pero un RPC SECURITY DEFINER corre como
-- su dueño y salta RLS por definición — necesita su propio guard.
--
-- ── Por qué estas tres y no las cuatro que faltaban ─────────────────────────
-- La lista original de Fase B tenía 7: submit_qr_signup, create_invitation,
-- create_school_join_qr, generate_qr_monthly_charge, request_athlete_certificate,
-- issue_athlete_certificate, notify_user. Las primeras 4 ya quedaron cerradas.
-- De las 3 restantes, notify_user se deja FUERA a propósito: no crea cartera
-- ni ningún registro de negocio (inscripción, cobro, constancia) — solo
-- inserta una fila en `notifications`, que ya tiene su propia policy
-- RESTRICTIVE de Fase A para la escritura directa del navegador. Bloquear
-- notificaciones de una escuela vencida no cierra ningún agujero de negocio y
-- sí puede tapar el aviso mismo de "tu prueba venció" si algún flujo lo usa
-- para eso. Se documenta la exclusión en vez de callarla.
--
-- ── Radio de impacto medido antes de escribir esto (solo lectura, sin tocar
--    la base — ver reporte de la tarea) ──────────────────────────────────────
--   328 escuelas account_type='real', 167 bloqueadas hoy (is_operational=false).
--   De esas 167: 1 QR activo, 0 plantillas de constancia activas, 0 constancias
--   pendientes — la superficie viva de estas tres RPC es baja HOY, pero el
--   guard cierra la puerta para cualquier escuela que llegue a ese estado
--   después (167 → creciendo cada día por el cron `expire-trials-daily`).
--   16 de las 167 tienen algún miembro activo (las otras 151 no tienen a nadie
--   que pueda ni intentar llamar estas RPC) — ese es el radio real de quien
--   podría notar el bloqueo.
--
-- ── Envolver, no reescribir (mismo criterio que SEG-19) ─────────────────────
-- Se renombra la función original a `..._interno` y se crea un envoltorio con
-- el mismo nombre y firma. El cuerpo original queda intacto. Al interno se le
-- quita el acceso a `authenticated`/`anon`, o el envoltorio sería opcional.
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

-- ── 1. create_school_join_qr(...12 args, con p_fixed_amount) ───────────────
-- La escuela viene por parámetro (p_school_id, como texto) — no hay que
-- resolverla, a diferencia de create_invitation.
ALTER FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) RENAME TO create_school_join_qr__interno;

CREATE OR REPLACE FUNCTION public.create_school_join_qr(
    p_school_id text DEFAULT NULL,
    p_name      text DEFAULT NULL,
    p_target_type text DEFAULT 'open',
    p_target_id text DEFAULT NULL,
    p_branch_id text DEFAULT NULL,
    p_intro_text text DEFAULT NULL,
    p_cta_text  text DEFAULT 'Inscribirme',
    p_accept_payments boolean DEFAULT true,
    p_require_first_payment boolean DEFAULT true,
    p_expires_at timestamptz DEFAULT NULL,
    p_slug      text DEFAULT NULL,
    p_fixed_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
DECLARE
    v_school_uuid uuid := NULLIF(p_school_id, '')::uuid;
BEGIN
    IF v_school_uuid IS NOT NULL AND NOT public.school_is_operational(v_school_uuid) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede crear QR de inscripción nuevos.'
            USING ERRCODE = '42501';
    END IF;

    -- Si no vino school_id o es inválido, NO se decide acá: delega, para que
    -- el error siga siendo el de la función original (cast fallido o Forbidden).
    RETURN public.create_school_join_qr__interno(
        p_school_id, p_name, p_target_type, p_target_id, p_branch_id,
        p_intro_text, p_cta_text, p_accept_payments, p_require_first_payment,
        p_expires_at, p_slug, p_fixed_amount);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.create_school_join_qr__interno(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr__interno(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) TO service_role;

REVOKE ALL ON FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_school_join_qr(
    text, text, text, text, text, text, text, boolean, boolean, timestamptz, text, numeric
) IS
    'Envoltorio con el guard de fin de prueba (SEG-15 Fase B, cola). El cuerpo real esta en '
    'create_school_join_qr__interno, sin tocar.';


-- ── 2. request_athlete_certificate(uuid, uuid, uuid, uuid) ─────────────────
ALTER FUNCTION public.request_athlete_certificate(uuid, uuid, uuid, uuid)
    RENAME TO request_athlete_certificate__interno;

CREATE OR REPLACE FUNCTION public.request_athlete_certificate(
    p_school_id   uuid,
    p_template_id uuid,
    p_child_id    uuid DEFAULT NULL,
    p_profile_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
BEGIN
    IF p_school_id IS NOT NULL AND NOT public.school_is_operational(p_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede recibir solicitudes de constancias nuevas.'
            USING ERRCODE = '42501';
    END IF;

    RETURN public.request_athlete_certificate__interno(
        p_school_id, p_template_id, p_child_id, p_profile_id);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.request_athlete_certificate__interno(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_athlete_certificate__interno(uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.request_athlete_certificate(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_athlete_certificate(uuid, uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.request_athlete_certificate(uuid, uuid, uuid, uuid) IS
    'Envoltorio con el guard de fin de prueba (SEG-15 Fase B, cola). El cuerpo real esta en '
    'request_athlete_certificate__interno, sin tocar.';


-- ── 3. issue_athlete_certificate(uuid) ──────────────────────────────────────
-- La escuela NO viene por parámetro: hay que leerla de la fila (igual que el
-- guard de generate_qr_monthly_charge resuelve por slug). SECURITY DEFINER a
-- propósito, para no depender de que el llamador tenga SELECT sobre la fila.
ALTER FUNCTION public.issue_athlete_certificate(uuid)
    RENAME TO issue_athlete_certificate__interno;

CREATE OR REPLACE FUNCTION public.issue_athlete_certificate(
    p_certificate_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $envoltorio$
DECLARE
    v_school_id uuid;
BEGIN
    SELECT school_id INTO v_school_id
      FROM public.athlete_certificates
     WHERE id = p_certificate_id;

    IF v_school_id IS NOT NULL AND NOT public.school_is_operational(v_school_id) THEN
        RAISE EXCEPTION 'Esta escuela tiene el periodo de prueba vencido: no puede emitir constancias nuevas.'
            USING ERRCODE = '42501';
    END IF;

    -- Si no encontró la constancia, NO se decide acá: delega, para que el
    -- mensaje siga siendo el de la función original ("Certificate not found").
    RETURN public.issue_athlete_certificate__interno(p_certificate_id);
END;
$envoltorio$;

REVOKE ALL ON FUNCTION public.issue_athlete_certificate__interno(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_athlete_certificate__interno(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.issue_athlete_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_athlete_certificate(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.issue_athlete_certificate(uuid) IS
    'Envoltorio con el guard de fin de prueba (SEG-15 Fase B, cola). El cuerpo real esta en '
    'issue_athlete_certificate__interno, sin tocar.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación — léela, no la saltes.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Las tres parejas (envoltorio + interna) y quién puede ejecutar cada una.
--    Solo los envoltorios deben quedar en `authenticated`.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid)                 AS firma,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.proname LIKE 'create_school_join_qr%'
        OR p.proname LIKE 'request_athlete_certificate%'
        OR p.proname LIKE 'issue_athlete_certificate%')
 ORDER BY p.proname;

-- 2. Qué haría el guard hoy: escuelas bloqueadas con QR activos, plantillas de
--    constancia activas o constancias pendientes (la superficie real, medida
--    antes de escribir esta migración).
SELECT
    (SELECT count(*) FROM public.school_join_qr_codes q
       JOIN public.schools s ON s.id = q.school_id
      WHERE q.active = true AND s.account_type = 'real'
        AND NOT public.school_is_operational(s.id))                AS qr_activos_de_escuelas_bloqueadas,
    (SELECT count(*) FROM public.school_certificate_templates t
       JOIN public.schools s ON s.id = t.school_id
      WHERE t.active = true AND s.account_type = 'real'
        AND NOT public.school_is_operational(s.id))                AS plantillas_activas_de_escuelas_bloqueadas,
    (SELECT count(*) FROM public.athlete_certificates c
       JOIN public.schools s ON s.id = c.school_id
      WHERE c.status IN ('pending_review','pending_payment')
        AND s.account_type = 'real'
        AND NOT public.school_is_operational(s.id))                AS constancias_pendientes_de_escuelas_bloqueadas;
