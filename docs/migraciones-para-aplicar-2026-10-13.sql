-- =============================================================================
-- Las 8 migraciones pendientes al 2026-10-13, en orden, para pegar UNA vez en el
-- SQL Editor de Supabase. Verificado contra la base viva (comparación objeto por
-- objeto): ninguna está aplicada y ninguna pisa cambios hechos a mano.
--
-- Todo va en UNA transacción: si algo falla, no se aplica nada (vuelve a
-- pegarlo después de avisar el error). Al final se anotan en
-- supabase_migrations.schema_migrations para que quede el rastro.
-- =============================================================================

BEGIN;


-- ▼▼▼ 20260718000001_glosa_notification_markers.sql ▼▼▼

-- ============================================================
-- SPORTMAPS — Comprobantes v2, Fase 4: marcas de idempotencia de correo de glosa
-- Spec: docs/specs/receipt-extraction-v2-glosas.md §5.5
-- ------------------------------------------------------------
-- El recordatorio "vence mañana" y el correo de ratificación automática se envían
-- desde el JOB del BFF (el cron SQL no puede mandar email). El BFF usa claim atómico
-- (UPDATE ... RETURNING) sobre estas marcas para no duplicar correos entre réplicas.
-- La transición de estado de ratificación SIGUE en el pg_cron `ratify_expired_glosas`
-- de Fase 3 (robusta aunque el BFF esté caído); el BFF solo agrega los correos.
-- Fecha: 2026-07-18
-- ============================================================

ALTER TABLE public.payment_glosas
    ADD COLUMN IF NOT EXISTS reminder_sent_at     timestamptz,
    ADD COLUMN IF NOT EXISTS ratify_email_sent_at timestamptz;

COMMENT ON COLUMN public.payment_glosas.reminder_sent_at IS
    'Marca de idempotencia del correo "vence mañana" enviado por el job del BFF. NULL = pendiente.';
COMMENT ON COLUMN public.payment_glosas.ratify_email_sent_at IS
    'Marca de idempotencia del correo de ratificación automática (resolved_by NULL) enviado por el job del BFF.';

-- reopen_glosa: al reabrir hay un nuevo plazo → los correos deben poder volver a
-- dispararse, así que se resetean AMBAS marcas. Migración nueva (no edita la anterior).
CREATE OR REPLACE FUNCTION public.reopen_glosa(p_actor uuid, p_glosa_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_school_id  uuid;
    v_status     text;
    v_payment_id uuid;
    v_parent_id  uuid;
    v_days       int;
    v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
    IF p_note IS NULL OR btrim(p_note) = '' THEN
        RAISE EXCEPTION 'La nota de reapertura es obligatoria' USING ERRCODE = '22023';
    END IF;
    SELECT school_id, status, payment_id INTO v_school_id, v_status, v_payment_id
    FROM public.payment_glosas WHERE id = p_glosa_id;
    IF v_school_id IS NULL THEN
        RAISE EXCEPTION 'Glosa no encontrada' USING ERRCODE = '02000';
    END IF;
    IF NOT public._glosa_actor_is_admin(p_actor, v_school_id) THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_status <> 'RATIFICADA' THEN
        RAISE EXCEPTION 'Solo se puede reabrir una glosa RATIFICADA (actual: %)', v_status
            USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(glosa_response_days, 5) INTO v_days
    FROM public.school_settings WHERE school_id = v_school_id;

    UPDATE public.payment_glosas
    SET status = 'GLOSADA',
        responds_by = v_today + COALESCE(v_days, 5),
        resolution_note = p_note,
        resolved_at = NULL, resolved_by = NULL, responded_at = NULL,
        reminder_sent_at = NULL, ratify_email_sent_at = NULL,
        updated_at = now()
    WHERE id = p_glosa_id;

    UPDATE public.payments SET status = 'glosado', updated_at = now()
    WHERE id = v_payment_id;

    SELECT parent_id INTO v_parent_id FROM public.payments WHERE id = v_payment_id;
    PERFORM public._glosa_notify(
        v_parent_id, v_school_id,
        'Reabrimos tu aclaración',
        'Reabrimos la aclaración de tu comprobante. Ábrela para responder de nuevo.',
        '/my-payments'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.reopen_glosa(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_glosa(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ▲▲▲ fin 20260718000001_glosa_notification_markers.sql ▲▲▲

-- ▼▼▼ 20260811110226_update_get_onboarding_status_check_offering_plans.sql ▼▼▼

-- =============================================================================
-- 20260811110226_update_get_onboarding_status_check_offering_plans.sql
-- Autor: judegor99   Fecha: 2026-08-11   Versión anterior: 20260809101617
-- Objetivo: Corregir get_onboarding_status para evaluar has_plans usando
--           offering_plans en lugar de la tabla obsoleta subscription_plans.
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_school_id uuid;
  v_email_verified boolean;
  v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;

  v_email_verified := (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL;

  SELECT school_id INTO v_school_id
    FROM public.school_members
   WHERE profile_id = v_user_id
     AND status = 'active'
    ORDER BY joined_at DESC
    LIMIT 1;

  SELECT jsonb_build_object(
    'role', v_role,
    'school_id', v_school_id,
    'email_verified', v_email_verified,

    'onboarding_status', (
        SELECT onboarding_status FROM public.schools
         WHERE id = v_school_id OR owner_id = v_user_id
         ORDER BY created_at DESC LIMIT 1
    ),

    'business_model', (
        SELECT business_model FROM public.schools
         WHERE id = v_school_id OR owner_id = v_user_id
         ORDER BY created_at DESC LIMIT 1
    ),

    'profile_complete', (
        SELECT (
            full_name IS NOT NULL AND full_name != 'Usuario' AND
            phone IS NOT NULL AND
            date_of_birth IS NOT NULL AND
            (role != 'athlete' OR (bio IS NOT NULL OR (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)))
        )
        FROM public.profiles
        WHERE id = v_user_id
    ),
    'has_avatar', (SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_user_id AND avatar_url IS NOT NULL)),

    'has_pending_invitation', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'pending')),
    'has_accepted_invite',    (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE profile_id = v_user_id AND status = 'active')),

    'has_children',          (SELECT EXISTS(SELECT 1 FROM public.children WHERE parent_id = v_user_id)),
    'has_medical_records',   (SELECT EXISTS(SELECT 1 FROM public.children c WHERE c.parent_id = v_user_id AND c.medical_info IS NOT NULL)),
    'has_enrollment', (
        SELECT EXISTS(
            SELECT 1 FROM public.enrollments e
            WHERE e.child_id IN (SELECT id FROM public.children WHERE parent_id = v_user_id)
              AND e.status = 'active'
        ) OR EXISTS(
            SELECT 1 FROM public.enrollments e
            WHERE e.user_id = v_user_id AND e.status = 'active'
        )
    ),

    'has_school',                (SELECT EXISTS(SELECT 1 FROM public.schools WHERE owner_id = v_user_id)),
    'has_branches', (
        SELECT EXISTS(
            SELECT 1 FROM public.school_branches b JOIN public.schools s ON b.school_id = s.id
             WHERE s.owner_id = v_user_id OR s.id = v_school_id
        )
    ),
    'has_teams', (
        SELECT EXISTS(
            SELECT 1 FROM public.teams
             WHERE school_id = v_school_id
                OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id))
        )
    ),
    -- Corregido: se verifica offering_plans en lugar de la tabla obsoleta subscription_plans
    'has_plans', (
        SELECT EXISTS(
            SELECT 1
              FROM public.offering_plans op
             WHERE op.is_active = true
               AND (op.school_id = v_school_id
                    OR (v_school_id IS NULL AND op.school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id)))
        )
    ),
    'has_staff', (SELECT EXISTS(SELECT 1 FROM public.school_members WHERE school_id = v_school_id AND role IN ('coach', 'admin'))),
    'has_professional_profile', (SELECT EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = v_user_id AND profile_completed = true)),

    'has_students', (
        SELECT EXISTS(
            SELECT 1 FROM public.children
            WHERE school_id = v_school_id
            OR (v_school_id IS NULL AND school_id IN (SELECT id FROM public.schools WHERE owner_id = v_user_id))
        )
    ),
    'payment_setup_completed', (
        SELECT EXISTS(
            SELECT 1 FROM public.school_settings
            WHERE school_id = v_school_id
            AND bank_name IS NOT NULL
            AND bank_account_number IS NOT NULL
        )
    ),

    'has_sports_interest', (
        SELECT (
            (bio IS NOT NULL AND length(bio) > 10) OR
            (sports_interests IS NOT NULL AND array_length(sports_interests, 1) > 0)
        )
        FROM public.profiles
        WHERE id = v_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_onboarding_status() IS
    'Status maestro del onboarding del usuario. Para escuelas devuelve '
    'business_model (teams|plans|both) + has_teams + has_plans para que '
    'el wizard adapte los pasos (se lee de offering_plans).';

-- Re-grant explícito
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO anon;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO service_role;


-- Forzar reload de schema en PostgREST
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- ▲▲▲ fin 20260811110226_update_get_onboarding_status_check_offering_plans.sql ▲▲▲

-- ▼▼▼ 20260921204955_guard_de_prueba_en_rpcs_restantes.sql ▼▼▼

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

-- ▲▲▲ fin 20260921204955_guard_de_prueba_en_rpcs_restantes.sql ▲▲▲

-- ▼▼▼ 20261010124934_alta_exonerar_inscripcion_seguro.sql ▼▼▼

-- =============================================================================
-- 20261010124934_alta_exonerar_inscripcion_seguro.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261009121558
-- Objetivo: que la escuela pueda NO cobrar la inscripción y/o el seguro de un
-- alta concreta (pedido de una escuela cliente: «la inscripción ni el seguro no
-- los cobre» para algunos atletas nuevos; la mensualidad sí se cobra).
--
--   · emit_enrollment_fees gana dos parámetros al final:
--       p_waive_registration boolean DEFAULT false
--       p_waive_insurance    boolean DEFAULT false
--     Con true, esa fila 'one_time' NO se inserta. Defaults false = hoy.
--     Como cambia la lista de argumentos, se hace DROP de la firma de 9 y
--     CREATE de la de 11: un CREATE OR REPLACE con argumentos nuevos crearía una
--     SOBRECARGA y las llamadas de 9 argumentos quedarían ambiguas
--     («function is not unique»). Las llamadas de 9 argumentos (posicionales o
--     con nombre) resuelven a la nueva por los defaults.
--   · create_enrollment_with_payments: el elemento {"kind":"enrollment_fees"}
--     acepta "waive_registration_fee" / "waive_insurance_fee" (boolean, ausente
--     = false) y los pasa a emit_enrollment_fees. El resto del cuerpo es
--     idéntico al VIVO, que ya incluye discount_pct y list_amount en el INSERT
--     de payments (20261010140528 payments_descuento_viaja_con_el_cobro, aplicada
--     en la base por otra vía, sin archivo en el repo). Rebasado el 2026-10-10 en
--     QA sobre el gemelo: la versión anterior partía de 20261005214250 y al
--     aplicarla habría borrado ese paso de discount_pct/list_amount.
--
-- Quién puede exonerar: el BFF (único caller, service_role) solo lo permite en
-- el alta (POST /students/create-one y POST /enrollments), con la misma
-- autorización que el alta, y deja rastro en audit_logs.
--
-- Radio: 0 filas tocadas. Mismos grants (solo service_role). Sin callers fuera
-- del BFF. Mientras nadie mande los flags, el comportamiento es el de hoy.
-- =============================================================================


DROP FUNCTION IF EXISTS public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text);

CREATE FUNCTION public.emit_enrollment_fees(
  p_school_id          uuid,
  p_plan_id            uuid,
  p_child_id           uuid,
  p_user_id            uuid,
  p_unreg_id           uuid,
  p_parent_id          uuid,
  p_branch_id          uuid,
  p_due_date           date,
  p_person_name        text,
  p_waive_registration boolean DEFAULT false,
  p_waive_insurance    boolean DEFAULT false
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_plan     record;
  v_due      date := COALESCE(p_due_date, (now() AT TIME ZONE 'America/Bogota')::date);
  v_parent   uuid := p_parent_id;
  v_athlete  uuid := COALESCE(p_child_id, p_user_id, p_unreg_id);
  v_suffix   text := CASE WHEN NULLIF(btrim(p_person_name), '') IS NULL THEN ''
                          ELSE ' — ' || btrim(p_person_name) END;
  v_ids      uuid[] := ARRAY[]::uuid[];
  v_id       uuid;
  v_reg_fee  numeric;
  v_ins_fee  numeric;
BEGIN
  IF p_school_id IS NULL OR p_plan_id IS NULL THEN
    RAISE EXCEPTION 'emit_enrollment_fees: school_id y plan_id son obligatorios'
      USING ERRCODE = '22023';
  END IF;

  IF (p_child_id IS NOT NULL)::int + (p_user_id IS NOT NULL)::int + (p_unreg_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'emit_enrollment_fees: exactamente uno de child_id / user_id / unreg_id'
      USING ERRCODE = '22023';
  END IF;

  -- El plan tiene que ser de ESTA escuela: es la fuente del monto.
  SELECT op.name, op.registration_fee, op.insurance_fee
    INTO v_plan
    FROM public.offering_plans op
   WHERE op.id = p_plan_id
     AND op.school_id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_no_encontrado: el plan % no pertenece a la escuela', p_plan_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Exoneración por alta: la escuela decidió no cobrar este concepto.
  v_reg_fee := CASE WHEN COALESCE(p_waive_registration, false) THEN 0
                    ELSE COALESCE(v_plan.registration_fee, 0) END;
  v_ins_fee := CASE WHEN COALESCE(p_waive_insurance, false) THEN 0
                    ELSE COALESCE(v_plan.insurance_fee, 0) END;

  IF v_reg_fee <= 0 AND v_ins_fee <= 0 THEN
    RETURN v_ids;   -- sin cobros únicos configurados (o exonerados los dos).
  END IF;

  -- Serializa altas concurrentes del mismo atleta (dedupe de seguro sin carrera).
  PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

  -- Quién paga: el acudiente del menor (sin esto el cobro es impagable online,
  -- ver enrollmentBilling.ts). Si aún no tiene acudiente, trg_backfill_payment_
  -- payer_on_link lo completa cuando se vincule.
  IF v_parent IS NULL AND p_child_id IS NOT NULL THEN
    SELECT c.parent_id INTO v_parent FROM public.children c WHERE c.id = p_child_id;
  END IF;

  IF v_reg_fee > 0 THEN
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_branch_id, v_parent, p_child_id, p_user_id, p_unreg_id,
      p_plan_id, v_reg_fee,
      'Inscripción — ' || v_plan.name || v_suffix,
      v_due, 'pending', 'one_time',
      extract(year FROM v_due)::smallint, extract(month FROM v_due)::smallint,
      'inscripcion', true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END IF;

  IF v_ins_fee > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.payments p
        WHERE p.school_id = p_school_id
          AND p.payment_category = 'seguro'
          AND p.status <> 'cancelled'
          AND p.due_date > v_due - 365
          AND (
                (p_child_id IS NOT NULL AND p.child_id = p_child_id)
             OR (p_user_id  IS NOT NULL AND p.user_id  = p_user_id AND p.child_id IS NULL)
             OR (p_unreg_id IS NOT NULL AND p.unregistered_athlete_id = p_unreg_id)
          )
     ) THEN
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt
    ) VALUES (
      p_school_id, p_branch_id, v_parent, p_child_id, p_user_id, p_unreg_id,
      p_plan_id, v_ins_fee,
      'Seguro de accidentes — ' || v_plan.name || v_suffix,
      v_due, 'pending', 'one_time',
      extract(year FROM v_due)::smallint, extract(month FROM v_due)::smallint,
      'seguro', true
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END IF;

  RETURN v_ids;
END;
$function$;

COMMENT ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) IS
  'Cobros únicos del alta (inscripción + seguro con dedupe 365 días). p_waive_* = la escuela no cobra ese concepto en esta alta. Solo service_role (BFF). Fuente única: también la usa create_enrollment_with_payments.';

REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.emit_enrollment_fees(uuid, uuid, uuid, uuid, uuid, uuid, uuid, date, text, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.create_enrollment_with_payments(
  p_school_id  uuid,
  p_enrollment jsonb,
  p_payments   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_enr         public.enrollments;
  v_enr_id      uuid;
  v_elem        jsonb;
  v_pay         public.payments;
  v_athlete     uuid;
  v_ids         uuid[] := ARRAY[]::uuid[];
  v_fee_ids     uuid[];
  v_id          uuid;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: school_id obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) NOT IN ('array', 'null') THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: p_payments debe ser un arreglo' USING ERRCODE = '22023';
  END IF;

  -- ── 1. Inscripción ─────────────────────────────────────────────────────────
  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    v_enr := jsonb_populate_record(NULL::public.enrollments, p_enrollment);

    IF v_enr.offering_plan_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.offering_plans op
          WHERE op.id = v_enr.offering_plan_id AND op.school_id = p_school_id) THEN
      RAISE EXCEPTION 'plan_no_encontrado: el plan % no pertenece a la escuela', v_enr.offering_plan_id
        USING ERRCODE = 'P0002';
    END IF;

    v_athlete := COALESCE(v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id);
    IF v_athlete IS NOT NULL THEN
      -- Misma llave que emit_enrollment_fees: serializa altas del mismo atleta.
      PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));
    END IF;

    INSERT INTO public.enrollments (
      school_id, child_id, user_id, unregistered_athlete_id, team_id,
      offering_plan_id, offering_id, start_date, status, monthly_fee, first_payment_mode
    ) VALUES (
      p_school_id, v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id, v_enr.team_id,
      v_enr.offering_plan_id, v_enr.offering_id,
      COALESCE(v_enr.start_date, (now() AT TIME ZONE 'America/Bogota')::date),
      COALESCE(v_enr.status, 'active'), v_enr.monthly_fee, v_enr.first_payment_mode
    )
    RETURNING id INTO v_enr_id;
  END IF;

  -- ── 2. Cobros ──────────────────────────────────────────────────────────────
  FOR v_elem IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    -- 2a. Inscripción + seguro: misma función que usa POST /enrollments.
    IF v_elem->>'kind' = 'enrollment_fees' THEN
      v_fee_ids := public.emit_enrollment_fees(
        p_school_id,
        NULLIF(v_elem->>'plan_id', '')::uuid,
        NULLIF(v_elem->>'child_id', '')::uuid,
        NULLIF(v_elem->>'user_id', '')::uuid,
        NULLIF(v_elem->>'unregistered_athlete_id', '')::uuid,
        NULLIF(v_elem->>'parent_id', '')::uuid,
        NULLIF(v_elem->>'branch_id', '')::uuid,
        NULLIF(v_elem->>'due_date', '')::date,
        v_elem->>'person_name',
        COALESCE((v_elem->>'waive_registration_fee')::boolean, false),
        COALESCE((v_elem->>'waive_insurance_fee')::boolean, false)
      );
      v_ids := v_ids || COALESCE(v_fee_ids, ARRAY[]::uuid[]);
      CONTINUE;
    END IF;

    -- 2b. Cobro con período (mensualidad / parcial / mes siguiente).
    v_pay := jsonb_populate_record(NULL::public.payments, v_elem);
    v_athlete := COALESCE(v_pay.child_id, v_pay.user_id, v_pay.unregistered_athlete_id);
    IF v_athlete IS NULL THEN
      RAISE EXCEPTION 'create_enrollment_with_payments: cobro sin atleta' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

    -- Mismo predicado que uniq_payment_active_period_* (por eso sin school_id):
    -- se adelanta al 23505 con un mensaje que el BFF traduce a 409.
    IF v_pay.period_year IS NOT NULL AND v_pay.period_month IS NOT NULL
       AND NOT COALESCE(v_pay.period_uniqueness_exempt, false)
       AND EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.period_year  = v_pay.period_year
            AND p.period_month = v_pay.period_month
            AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
            AND NOT p.period_uniqueness_exempt
            AND (
                  (v_pay.child_id IS NOT NULL AND p.child_id = v_pay.child_id)
               OR (v_pay.child_id IS NULL AND v_pay.user_id IS NOT NULL
                     AND p.child_id IS NULL AND p.user_id = v_pay.user_id)
               OR (v_pay.unregistered_athlete_id IS NOT NULL
                     AND p.unregistered_athlete_id = v_pay.unregistered_athlete_id)
            )
       ) THEN
      RAISE EXCEPTION 'periodo_ocupado:%', to_char(make_date(v_pay.period_year, v_pay.period_month, 1), 'YYYY-MM')
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt,
      discount_pct, list_amount
    ) VALUES (
      p_school_id, v_pay.branch_id, v_pay.parent_id, v_pay.child_id, v_pay.user_id,
      v_pay.unregistered_athlete_id, v_pay.team_id, v_pay.offering_plan_id,
      v_pay.amount, v_pay.concept, v_pay.due_date, 'pending',
      COALESCE(v_pay.payment_type, 'subscription'),
      v_pay.period_year, v_pay.period_month, v_pay.payment_category,
      COALESCE(v_pay.period_uniqueness_exempt, false),
      v_pay.discount_pct, v_pay.list_amount
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', v_enr_id, 'payment_ids', to_jsonb(v_ids));
END;
$function$;

COMMENT ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) IS
  'Alta atómica: inscripción + cobros (+ inscripción/seguro vía emit_enrollment_fees; waive_registration_fee / waive_insurance_fee en el elemento enrollment_fees los exoneran). periodo_ocupado:YYYY-MM si el período ya tiene cobro activo. Solo service_role (BFF).';

REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) TO service_role;

-- PostgREST: la firma de emit_enrollment_fees cambió.
NOTIFY pgrst, 'reload schema';


-- ▲▲▲ fin 20261010124934_alta_exonerar_inscripcion_seguro.sql ▲▲▲

-- ▼▼▼ 20261010201231_carnets_plantilla_predeterminada_y_privacidad_publica.sql ▼▼▼

-- =============================================================================
-- 20261010201231_carnets_plantilla_predeterminada_y_privacidad_publica.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-11   Versión anterior: 20261010180834
-- Objetivo: dos arreglos del módulo Carnets Digitales, ambos sobre el cuerpo
-- VIVO de las funciones (leído con pg_get_functiondef el 2026-10-11, no del repo).
--
-- 1) issue_athlete_id_card: elegir «Predeterminada de la escuela» manda
--    p_template_id = NULL y la RPC nunca buscaba la plantilla is_default → el
--    carnet quedaba SIN plantilla (Club Campestre Demo: 7 de 8 carnets sin
--    plantilla aunque la escuela tiene una predeterminada). Ahora, si llega
--    NULL, usa la plantilla activa is_default de la escuela (si existe).
--
-- 2) verify_athlete_id_card_public: es la página pública /c/:token (sin login,
--    GRANT a anon). Si la plantilla encendía esos campos, CUALQUIERA con el
--    QR veía el teléfono del contacto de emergencia, EPS, RH, documento y el
--    concepto/valor del último pago. Ahora esos datos solo salen para:
--      · staff activo de la escuela del carnet (user_staff_school_ids()),
--      · super admin,
--      · el acudiente vinculado (children.parent_id = auth.uid()),
--      · el propio atleta adulto (profile_id = auth.uid()).
--    El público ve: nombre, foto/iniciales, escuela, equipo/sede, vigencia y QR.
--    La respuesta suma 'viewer' ('public' | 'staff' | 'guardian') para que la
--    página sepa qué está mostrando.
--    Además: si el carnet no tiene plantilla, usa la predeterminada activa de la
--    escuela (mismo criterio que el punto 1, así los carnets ya emitidos con el
--    bug toman el diseño que la escuela eligió).
--    Null-safe: todo se arma con jsonb_build_object / ||, nunca jsonb_set
--    (ver mig 20260925135705: jsonb_set es STRICT y anulaba el atleta entero).
--
-- Firmas, SECURITY DEFINER, search_path y ACL se conservan (se re-declaran
-- explícitos al final).
-- =============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 1) issue_athlete_id_card
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_athlete_id_card(
    p_school_id uuid,
    p_child_id uuid DEFAULT NULL::uuid,
    p_profile_id uuid DEFAULT NULL::uuid,
    p_template_id uuid DEFAULT NULL::uuid,
    p_valid_until date DEFAULT NULL::date,
    p_photo_url text DEFAULT NULL::text,
    p_unregistered_athlete_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_card_id     uuid;
    v_qr_token    uuid;
    v_valid_until date;
    v_version     int;
    v_old_id      uuid;
    v_old_version int;
    v_owner_count int;
    v_template_id uuid := p_template_id;
BEGIN
    IF NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
        RAISE EXCEPTION 'Forbidden: school admin only' USING ERRCODE = '42501';
    END IF;

    IF ((p_child_id IS NOT NULL)::int + (p_profile_id IS NOT NULL)::int + (p_unregistered_athlete_id IS NOT NULL)::int) <> 1 THEN
        RAISE EXCEPTION 'Must specify exactly one of p_child_id, p_profile_id or p_unregistered_athlete_id'
            USING ERRCODE = '22023';
    END IF;

    IF p_child_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.children
        WHERE id = p_child_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
                USING ERRCODE = '42501';
        END IF;

    ELSIF p_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.school_members
        WHERE profile_id = p_profile_id
          AND school_id  = p_school_id
          AND status     = 'active';

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete profile is not an active member of this school'
                USING ERRCODE = '42501';
        END IF;

    ELSE
        SELECT COUNT(*) INTO v_owner_count
        FROM public.unregistered_athletes
        WHERE id = p_unregistered_athlete_id AND school_id = p_school_id AND is_active = true;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Athlete does not belong to this school'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    IF v_template_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_count
        FROM public.athlete_id_card_templates
        WHERE id = v_template_id AND school_id = p_school_id;

        IF v_owner_count = 0 THEN
            RAISE EXCEPTION 'Template does not belong to this school'
                USING ERRCODE = '42501';
        END IF;
    ELSE
        -- «Predeterminada de la escuela»: antes quedaba NULL y el carnet salía
        -- sin plantilla. Si la escuela no tiene predeterminada activa, sigue NULL
        -- (diseño por defecto), como antes.
        SELECT t.id INTO v_template_id
        FROM public.athlete_id_card_templates t
        WHERE t.school_id = p_school_id
          AND t.is_default = true
          AND t.active = true
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
        LIMIT 1;
    END IF;

    v_valid_until := COALESCE(p_valid_until, (CURRENT_DATE + interval '12 months')::date);

    IF p_child_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE child_id = p_child_id AND status = 'active';
    ELSIF p_profile_id IS NOT NULL THEN
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE profile_id = p_profile_id AND status = 'active';
    ELSE
        SELECT id, version INTO v_old_id, v_old_version
        FROM public.athlete_id_cards
        WHERE unregistered_athlete_id = p_unregistered_athlete_id AND status = 'active';
    END IF;

    IF v_old_id IS NOT NULL THEN
        UPDATE public.athlete_id_cards
        SET status = 'revoked',
            revoked_at = now(),
            revocation_reason = 'Replaced by new issuance'
        WHERE id = v_old_id;
        v_version := COALESCE(v_old_version, 1) + 1;
    ELSE
        v_version := 1;
    END IF;

    INSERT INTO public.athlete_id_cards (
        school_id, template_id, child_id, profile_id, unregistered_athlete_id,
        valid_until, photo_url, version, issued_by
    ) VALUES (
        p_school_id, v_template_id, p_child_id, p_profile_id, p_unregistered_athlete_id,
        v_valid_until, p_photo_url, v_version, auth.uid()
    )
    RETURNING id, qr_token INTO v_card_id, v_qr_token;

    RETURN jsonb_build_object(
        'id',          v_card_id,
        'qr_token',    v_qr_token,
        'valid_until', v_valid_until,
        'version',     v_version,
        'template_id', v_template_id
    );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2) verify_athlete_id_card_public
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_athlete_id_card_public(p_qr_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_card        record;
    v_template    record;
    v_school      record;
    v_show        jsonb;
    v_athlete_filtered jsonb := '{}'::jsonb;
    v_branch_name text;
    v_team_name   text;
    v_monthly_fee numeric;
    v_fee_status  text := 'unknown';
    v_last_paid   date;
    v_next_due    date;
    v_today       date := CURRENT_DATE;
    v_child_branch uuid;
    v_child_team   uuid;
    v_child_parent uuid;
    v_last_payment jsonb;
    v_uid          uuid := auth.uid();
    v_is_staff     boolean := false;
    v_is_guardian  boolean := false;
    v_private      boolean := false;
    v_viewer       text := 'public';
    v_kind         text;
BEGIN
    SELECT * INTO v_card FROM public.athlete_id_cards WHERE qr_token = p_qr_token;

    IF v_card.id IS NULL THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    IF v_card.status = 'revoked' THEN
        RETURN jsonb_build_object('found', true, 'status', 'revoked', 'revoked_at', v_card.revoked_at, 'reason', v_card.revocation_reason);
    END IF;

    IF v_card.valid_until < v_today THEN
        RETURN jsonb_build_object('found', true, 'status', 'expired', 'valid_until', v_card.valid_until);
    END IF;

    -- ¿Quién mira? Sin sesión → público. Los datos médicos, de emergencia,
    -- documento y pagos solo salen para staff de ESTA escuela o el acudiente.
    IF v_uid IS NOT NULL THEN
        v_is_staff := public.is_super_admin()
                      OR v_card.school_id = ANY (public.user_staff_school_ids());
        v_is_guardian := (v_card.profile_id IS NOT NULL AND v_card.profile_id = v_uid)
                      OR (v_card.child_id IS NOT NULL AND EXISTS (
                            SELECT 1 FROM public.children cc
                             WHERE cc.id = v_card.child_id AND cc.parent_id = v_uid));
    END IF;
    v_private := COALESCE(v_is_staff, false) OR COALESCE(v_is_guardian, false);
    v_viewer  := CASE WHEN v_is_staff THEN 'staff' WHEN v_is_guardian THEN 'guardian' ELSE 'public' END;

    SELECT * INTO v_template FROM public.athlete_id_card_templates WHERE id = v_card.template_id;

    -- Carnet sin plantilla → la predeterminada activa de la escuela.
    IF v_template.id IS NULL THEN
        SELECT * INTO v_template
        FROM public.athlete_id_card_templates t
        WHERE t.school_id = v_card.school_id AND t.is_default = true AND t.active = true
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC
        LIMIT 1;
    END IF;

    v_show := COALESCE(v_template.show_fields, jsonb_build_object(
        'photo', true, 'doc_number', false, 'team', true, 'branch', true, 'plan', false,
        'valid_until', true, 'fee_status', false, 'blood_type', false,
        'emergency_contact', false, 'eps', false, 'tshirt_size', false));

    -- Lo privado se apaga para el público aunque la plantilla lo encienda.
    IF NOT v_private THEN
        v_show := v_show || jsonb_build_object(
            'doc_number', false, 'fee_status', false, 'blood_type', false,
            'emergency_contact', false, 'eps', false, 'tshirt_size', false, 'plan', false);
    END IF;

    SELECT id, name, logo_url, branding_settings, slug INTO v_school FROM public.schools WHERE id = v_card.school_id;

    IF v_card.child_id IS NOT NULL THEN
        v_kind := 'child';

        SELECT jsonb_build_object('kind', 'child', 'full_name', c.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, c.avatar_url)),
               c.branch_id, c.team_id, c.monthly_fee, c.parent_id
        INTO v_athlete_filtered, v_child_branch, v_child_team, v_monthly_fee, v_child_parent
        FROM public.children c WHERE c.id = v_card.child_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', c.doc_type, 'doc_number', c.doc_number)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('blood_type', c.blood_type)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('eps_name', c.eps_name)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'tshirt_size')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('tshirt_size', c.tshirt_size)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('emergency_contact', c.emergency_contact)
            INTO v_athlete_filtered FROM public.children c WHERE c.id = v_card.child_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT name INTO v_team_name FROM public.teams WHERE id = v_child_team;
        END IF;

    ELSIF v_card.profile_id IS NOT NULL THEN
        v_kind := 'profile';

        SELECT jsonb_build_object('kind', 'profile', 'full_name', p.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, p.avatar_url))
        INTO v_athlete_filtered FROM public.profiles p WHERE p.id = v_card.profile_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', p.document_type, 'doc_number', p.document_number)
            INTO v_athlete_filtered FROM public.profiles p WHERE p.id = v_card.profile_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT sb2.name INTO v_branch_name
            FROM (
                SELECT sb2.id FROM public.team_members tm
                  JOIN public.teams t ON t.id = tm.team_id
                  JOIN public.school_branches sb2 ON sb2.id = t.branch_id
                 WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
                UNION ALL
                SELECT sb2.id FROM public.enrollments e
                  JOIN public.teams prog ON prog.id = e.team_id
                  JOIN public.school_branches sb2 ON sb2.id = prog.branch_id
                 WHERE e.user_id = v_card.profile_id AND e.school_id = v_card.school_id AND e.status = 'active'
                UNION ALL
                SELECT sb2.id FROM public.school_members sm
                  JOIN public.school_branches sb2 ON sb2.id = sm.branch_id
                 WHERE sm.profile_id = v_card.profile_id AND sm.school_id = v_card.school_id
            ) sub
            JOIN public.school_branches sb2 ON sb2.id = sub.id
            LIMIT 1;
        END IF;

        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT t.name INTO v_team_name
            FROM public.team_members tm
            JOIN public.teams t ON t.id = tm.team_id
            WHERE tm.profile_id = v_card.profile_id AND t.school_id = v_card.school_id
            LIMIT 1;

            IF v_team_name IS NULL THEN
                SELECT t.name INTO v_team_name
                FROM public.enrollments e
                JOIN public.teams t ON t.id = e.team_id
                WHERE e.user_id = v_card.profile_id AND e.school_id = v_card.school_id AND e.status = 'active'
                ORDER BY e.created_at LIMIT 1;
            END IF;
        END IF;

    ELSE
        v_kind := 'unregistered';

        SELECT jsonb_build_object('kind', 'unregistered', 'full_name', ua.full_name,
                                  'avatar_url', COALESCE(v_card.photo_url, ua.avatar_url)),
               ua.branch_id
        INTO v_athlete_filtered, v_child_branch
        FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;

        IF COALESCE((v_show->>'doc_number')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('doc_type', ua.doc_type, 'doc_number', ua.doc_number)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'blood_type')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('blood_type', ua.blood_type)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'eps')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object('eps_name', ua.eps_name)
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;
        IF COALESCE((v_show->>'emergency_contact')::boolean, false) THEN
            SELECT COALESCE(v_athlete_filtered, '{}'::jsonb) || jsonb_build_object(
                     'emergency_contact',
                     NULLIF(btrim(COALESCE(ua.guardian_full_name, '') || ' ' || COALESCE(ua.guardian_phone, '')), '')
                   )
            INTO v_athlete_filtered FROM public.unregistered_athletes ua WHERE ua.id = v_card.unregistered_athlete_id;
        END IF;

        IF COALESCE((v_show->>'branch')::boolean, true) THEN
            SELECT name INTO v_branch_name FROM public.school_branches WHERE id = v_child_branch;
        END IF;
        IF COALESCE((v_show->>'team')::boolean, true) THEN
            SELECT t.name INTO v_team_name
            FROM public.enrollments e
            JOIN public.teams t ON t.id = e.team_id
            WHERE e.unregistered_athlete_id = v_card.unregistered_athlete_id
              AND e.school_id = v_card.school_id AND e.status = 'active'
            ORDER BY e.created_at LIMIT 1;
        END IF;
    END IF;

    -- Si la fila del atleta desapareció, el objeto nunca queda NULL.
    v_athlete_filtered := COALESCE(v_athlete_filtered, jsonb_build_object('kind', v_kind));

    IF COALESCE((v_show->>'fee_status')::boolean, false) AND v_card.unregistered_athlete_id IS NULL THEN
        SELECT jsonb_build_object('concept', p.concept, 'amount', p.amount, 'amount_paid', p.amount_paid,
                                  'payment_date', p.payment_date, 'created_at', p.created_at,
                                  'provider_reference', p.provider_reference, 'payment_method', p.payment_method),
               COALESCE(p.payment_date, p.created_at::date)
          INTO v_last_payment, v_last_paid
          FROM public.payments p
         WHERE p.school_id = v_card.school_id
           AND p.status = 'paid'
           AND ((v_card.child_id IS NOT NULL AND (p.child_id = v_card.child_id OR (p.child_id IS NULL AND v_child_parent IS NOT NULL AND p.parent_id = v_child_parent)))
                OR (v_card.profile_id IS NOT NULL AND p.parent_id = v_card.profile_id))
         ORDER BY COALESCE(p.payment_date, p.created_at::date) DESC, p.created_at DESC
         LIMIT 1;

        IF v_last_paid IS NULL THEN
            v_fee_status := 'no_payments';
            v_last_payment := NULL;
        ELSE
            IF v_today - v_last_paid <= 30 THEN
                v_fee_status := 'paid';
            ELSIF v_today - v_last_paid <= 45 THEN
                v_fee_status := 'due_soon';
            ELSE
                v_fee_status := 'overdue';
            END IF;
            v_next_due := v_last_paid + interval '30 days';
        END IF;
    ELSE
        v_fee_status := NULL;
        v_last_paid := NULL;
        v_next_due := NULL;
        v_monthly_fee := NULL;
        v_last_payment := NULL;
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'status', 'active',
        'viewer', v_viewer,
        'card_id', v_card.id,
        'qr_token', v_card.qr_token,
        'issued_at', v_card.issued_at,
        'valid_until', v_card.valid_until,
        'version', v_card.version,
        'school', jsonb_build_object('id', v_school.id, 'name', v_school.name, 'slug', v_school.slug,
                                     'logo_url', v_school.logo_url, 'branding_settings', v_school.branding_settings),
        'template', CASE WHEN v_template.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', v_template.id,
            'name', v_template.name,
            'accent_color', v_template.accent_color,
            'secondary_color', v_template.secondary_color,
            'layout', v_template.layout,
            'pattern', v_template.pattern,
            'photo_shape', v_template.photo_shape,
            'text_mode', v_template.text_mode,
            'background_url', v_template.background_url,
            'header_text', v_template.header_text,
            'footer_text', v_template.footer_text,
            -- show_fields EFECTIVOS (con lo privado apagado para el público):
            -- el frontend decide qué filas pinta con esto.
            'show_fields', v_show) END,
        'athlete', v_athlete_filtered,
        'branch_name', v_branch_name,
        'team_name', v_team_name,
        'monthly_fee', v_monthly_fee,
        'fee_status', v_fee_status,
        'last_paid_at', v_last_paid,
        'next_due', v_next_due,
        'last_payment', v_last_payment
    );
END;
$function$;

-- ACL: igual que la viva. issue → solo authenticated/service_role.
-- verify → también anon (la página /c/:token es pública a propósito).
REVOKE ALL ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_athlete_id_card(uuid, uuid, uuid, uuid, date, text, uuid) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.verify_athlete_id_card_public(uuid) TO anon, authenticated, service_role;


-- ▲▲▲ fin 20261010201231_carnets_plantilla_predeterminada_y_privacidad_publica.sql ▲▲▲

-- ▼▼▼ 20261010201426_coach_alcance_equipos_contactos.sql ▼▼▼

-- =============================================================================
-- 20261010201426_coach_alcance_equipos_contactos.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-11   Versión anterior: 20261010201231
-- Objetivo: acotar al ENTRENADOR a los equipos que dirige, en tres frentes:
--   1. Escrituras sobre `teams` / `team_coaches` / `team_branches`.
--   2. Contacto de acudientes (teléfono / correo) en la vista `school_athletes`.
--   3. Disponibilidad médica (`get_school_athlete_availability`).
--
-- Base viva medida el 2026-10-10 (MCP, solo lectura) — lo que había:
--
--   · `teams."Teams: manage staff"` FOR ALL USING/CHECK
--       school_id = ANY(user_staff_school_ids()) AND NOT is_scoped_coach_school(school_id)
--     (sin versionar hasta 20260831191515, que solo le RESTÓ a Carmel).
--     user_staff_school_ids() incluye a cualquier coach → en toda escuela sin
--     coach_can_create_teams un entrenador podía CREAR, EDITAR, ARCHIVAR y
--     BORRAR cualquier equipo de su escuela, incluido cambiarle el precio
--     (teams.price_monthly alimenta la mensualidad en open_month) o el
--     entrenador. Simulado con la sesión de un coach de Besser: 8/8 equipos
--     escribibles dirigiendo 3; de Dynasty: 11/11 dirigiendo 10.
--   · `teams."Programs: manage admin"` FOR ALL USING is_school_admin(school_id)
--     sin WITH CHECK (I3 del linter de invariantes).
--   · `team_coaches_manage_staff` / `team_branches_manage_staff` FOR ALL con el
--     mismo user_staff_school_ids(): un coach podía asignarse (o quitar) a
--     cualquier equipo — y team_coaches es lo que define qué roster, asistencia
--     y contactos ve un coach. Asignar acceso = otorgar permisos → solo admin.
--     Simulado: coach de Dynasty, 81 filas de team_coaches escribibles.
--   · Vista `school_athletes` (security_invoker): parent_email / parent_phone
--     de TODA la escuela para el coach (children es legible para el coach vía
--     coach_school_ids()/staff_school_ids()). Simulado: coach de Besser ve el
--     contacto de 31 familias de equipos que no dirige (de 57); Carmel 54/100;
--     Dynasty 17/489.
--   · get_school_athlete_availability: gate p_school_id = ANY(user_staff_school_ids())
--     → cualquier coach ve las restricciones médicas de toda la escuela.
--     (Hoy athlete_injuries tiene 0 filas: radio 0.)
--
-- Qué NO cambia (verificado contra datos):
--   · Carmel Club (coach_can_create_teams = true): su carril
--     "Teams: coach manage own (scoped)" queda INTACTO (crear/editar/archivar/
--     borrar SUS equipos, sin reasignar entrenador). El trigger nuevo se salta
--     las escuelas con ese flag. Para Carmel no cambia nada en `teams`.
--   · Asistencia, evaluaciones, informes: van por el BFF (service role) o por
--     tablas que esta migración no toca. Últimos 90 días: 0 sesiones de
--     asistencia de coaches de Besser/Carmel/Dynasty sobre equipos que no
--     dirigen (74 Carmel, 51 Besser, 34 Dynasty, todas propias).
--   · Alta/edición de atletas por coach (coach_can_create_athletes,
--     coach_can_edit_categories): van por el BFF con service role. Sin cambio.
--   · El coach sigue viendo NOMBRE, equipo y datos deportivos de toda la
--     escuela en school_athletes (lo necesita para inscribir atletas existentes
--     en su equipo); solo se le enmascara teléfono/correo fuera de sus equipos.
--
-- Escape por escuela (default false = regla nueva):
--   school_settings.coach_can_see_all_contacts — si la escuela decide que sus
--   entrenadores vean el contacto de todas las familias.
--
-- `teams.coach_id` y `team_coaches.coach_id` son `school_staff.id`, NO
-- auth.uid(); la identidad del usuario vive en school_staff.coach_auth_id (con
-- fallback por correo para fichas legacy sin vincular, igual que
-- user_staff_school_ids()).
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================


-- ── 0. Toggle por escuela ────────────────────────────────────────────────────
ALTER TABLE public.school_settings
    ADD COLUMN IF NOT EXISTS coach_can_see_all_contacts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.school_settings.coach_can_see_all_contacts IS
    'Si true, los entrenadores de la escuela ven teléfono y correo de los '
    'acudientes de TODOS los deportistas (comportamiento previo a '
    '20261010201426). Default false: el coach solo ve el contacto de los '
    'deportistas de los equipos que dirige (teams.coach_id o team_coaches).';

-- ── 1. Helpers ────────────────────────────────────────────────────────────────
-- Equipos que dirige quien llama (principal o asistente). SECURITY DEFINER:
-- lee teams/team_coaches/school_staff sin pasar por su RLS, por eso puede
-- usarse dentro de una policy de `teams` sin auto-recursión.
CREATE OR REPLACE FUNCTION public.user_coached_team_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  WITH yo AS (
    SELECT ss.id
      FROM public.school_staff ss
     WHERE ss.coach_auth_id = auth.uid()
       AND ss.status = 'active'
    UNION
    SELECT ss.id
      FROM public.school_staff ss
      JOIN auth.users au ON lower(au.email) = lower(ss.email)
     WHERE au.id = auth.uid()
       AND ss.coach_auth_id IS NULL
       AND ss.status = 'active'
  )
  SELECT COALESCE(ARRAY(
    SELECT t.id FROM public.teams t WHERE t.coach_id IN (SELECT id FROM yo)
    UNION
    SELECT tc.team_id FROM public.team_coaches tc WHERE tc.coach_id IN (SELECT id FROM yo)
  ), '{}'::uuid[]);
$$;

COMMENT ON FUNCTION public.user_coached_team_ids() IS
    'Equipos que dirige el usuario actual (teams.coach_id o team_coaches), '
    'resolviendo school_staff por coach_auth_id y, si la ficha no está '
    'vinculada, por correo. Vacío para quien no es entrenador.';

REVOKE ALL ON FUNCTION public.user_coached_team_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_coached_team_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.user_coached_team_ids() TO authenticated, service_role;

-- ¿A quien llama hay que enmascararle el contacto de familias ajenas en esta
-- escuela? true solo para un ENTRENADOR que no es administración de la
-- escuela, cuando la escuela no activó coach_can_see_all_contacts.
CREATE OR REPLACE FUNCTION public.coach_contact_masked_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
     AND p_school_id IS NOT NULL
     AND NOT (p_school_id = ANY (public.user_admin_school_ids()))
     AND NOT public.is_platform_admin()
     AND (
          EXISTS (SELECT 1 FROM public.school_members sm
                   WHERE sm.school_id = p_school_id
                     AND sm.profile_id = auth.uid()
                     AND sm.role = 'coach'
                     AND sm.status = 'active')
       OR EXISTS (SELECT 1 FROM public.school_staff ss
                   WHERE ss.school_id = p_school_id
                     AND ss.coach_auth_id = auth.uid()
                     AND ss.status = 'active')
     )
     AND NOT COALESCE((SELECT st.coach_can_see_all_contacts
                         FROM public.school_settings st
                        WHERE st.school_id = p_school_id), false);
$$;

REVOKE ALL ON FUNCTION public.coach_contact_masked_school(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.coach_contact_masked_school(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.coach_contact_masked_school(uuid) TO authenticated, service_role;

-- ── 2. teams ──────────────────────────────────────────────────────────────────
-- Definiciones vivas reemplazadas (copiadas de pg_policies el 2026-10-10):
--   "Teams: manage staff"   FOR ALL TO public
--       USING      ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--       WITH CHECK ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--   "Programs: manage admin" FOR ALL TO public USING (is_school_admin(school_id))  -- sin WITH CHECK
-- Se conservan sin tocar: "Teams: coach manage own (scoped)" (Carmel),
-- "Teams: select members", "Teams: select staff", "teams_select_public" y las
-- tres RESTRICTIVE trial_block_*.
DROP POLICY IF EXISTS "Teams: manage staff"    ON public.teams;
DROP POLICY IF EXISTS "Programs: manage admin" ON public.teams;

-- Administración: user_admin_school_ids() ⊇ is_school_admin() (owner/admin/
-- school_admin activos) + super_admin de escuela + schools.owner_id (dueños sin
-- fila en school_members, que antes entraban por user_staff_school_ids()).
DROP POLICY IF EXISTS "Teams: manage admin" ON public.teams;
CREATE POLICY "Teams: manage admin" ON public.teams
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

-- Entrenador (escuelas SIN coach_can_create_teams): solo EDITA los equipos que
-- dirige. No crea ni borra. Qué columnas puede cambiar lo decide el trigger.
DROP POLICY IF EXISTS "Teams: coach update own" ON public.teams;
CREATE POLICY "Teams: coach update own" ON public.teams
FOR UPDATE TO authenticated
USING (
      id = ANY (public.user_coached_team_ids())
  AND NOT public.is_scoped_coach_school(school_id)
)
WITH CHECK (
      id = ANY (public.user_coached_team_ids())
  AND school_id = ANY (public.user_staff_school_ids())
  AND NOT public.is_scoped_coach_school(school_id)
);

-- Una policy no ve OLD: el corte por columnas va en un trigger. Archivar
-- (status/active), cambiar precio, entrenador principal, sede o escuela queda
-- para administración. Se salta: service_role/jobs (auth.uid() nulo),
-- administración de la escuela, staff de plataforma, y las escuelas con
-- coach_can_create_teams (Carmel), que se rigen por su propio carril sin cambio.
CREATE OR REPLACE FUNCTION public.teams_guard_coach_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.school_id = ANY (public.user_admin_school_ids()) OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF public.is_scoped_coach_school(OLD.school_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.school_id     IS DISTINCT FROM OLD.school_id
  OR NEW.coach_id      IS DISTINCT FROM OLD.coach_id
  OR NEW.price_monthly IS DISTINCT FROM OLD.price_monthly
  OR NEW.status        IS DISTINCT FROM OLD.status
  OR NEW.active        IS DISTINCT FROM OLD.active
  OR NEW.branch_id     IS DISTINCT FROM OLD.branch_id THEN
    RAISE EXCEPTION 'Solo la administración de la escuela puede cambiar el estado, el precio, la sede o el entrenador de un equipo'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.teams_guard_coach_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teams_guard_coach_update() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_teams_guard_coach_update ON public.teams;
CREATE TRIGGER trg_teams_guard_coach_update
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.teams_guard_coach_update();

-- ── 3. team_coaches / team_branches: asignar acceso = solo administración ────
-- Vivas reemplazadas:
--   team_coaches_manage_staff  FOR ALL TO public
--       USING/CHECK ((school_id = ANY (user_staff_school_ids())) AND (NOT is_scoped_coach_school(school_id)))
--   team_branches_manage_staff FOR ALL TO public (idéntica)
-- Se conservan: *_delete_via_team (is_school_admin), *_select_staff, trial_block_*.
-- school_id no es nulo en ninguna fila de las dos tablas (verificado: 0 y 0).
DROP POLICY IF EXISTS "team_coaches_manage_staff" ON public.team_coaches;
DROP POLICY IF EXISTS "team_coaches_manage_admin" ON public.team_coaches;
CREATE POLICY "team_coaches_manage_admin" ON public.team_coaches
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

DROP POLICY IF EXISTS "team_branches_manage_staff" ON public.team_branches;
DROP POLICY IF EXISTS "team_branches_manage_admin" ON public.team_branches;
CREATE POLICY "team_branches_manage_admin" ON public.team_branches
FOR ALL TO authenticated
USING      (school_id = ANY (public.user_admin_school_ids()))
WITH CHECK (school_id = ANY (public.user_admin_school_ids()));

-- ── 4. Disponibilidad médica: el coach ve solo a los de sus equipos ──────────
-- Cuerpo vivo copiado de pg_get_functiondef el 2026-10-10; único cambio: la
-- condición de alcance (administración ve toda la escuela; el resto, solo
-- deportistas inscritos en un equipo que dirige).
CREATE OR REPLACE FUNCTION public.get_school_athlete_availability(p_school_id uuid)
RETURNS TABLE(child_id uuid, profile_id uuid, athlete_name text, availability_status text, rtp_stage text, restrictions text, expected_return date, body_region text, updated_at timestamp with time zone, professional_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
    SELECT DISTINCT ON (COALESCE(p.child_id, p.profile_id))
           p.child_id, p.profile_id, p.full_name,
           i.availability_status, i.rtp_stage, i.restrictions, i.expected_return,
           i.body_region,  -- zona general ("rodilla"), no diagnóstico: el coach la necesita para adaptar
           i.updated_at, pr.full_name
      FROM public.athlete_injuries i
      JOIN public.clinical_patients p ON p.id = i.patient_id
      JOIN public.profiles pr ON pr.id = i.professional_id
     WHERE p_school_id = ANY (public.user_staff_school_ids())
       AND i.status = 'activa'
       AND public.clinical_patient_has_consent(p.id, 'compartir_disponibilidad')
       AND EXISTS (
            SELECT 1 FROM public.enrollments en
             WHERE en.school_id = p_school_id AND en.status = 'active'
               AND ((p.child_id IS NOT NULL AND en.child_id = p.child_id)
                 OR (p.profile_id IS NOT NULL AND en.user_id = p.profile_id)))
       AND (
            p_school_id = ANY (public.user_admin_school_ids())
         OR EXISTS (
            SELECT 1 FROM public.enrollments ec
             WHERE ec.school_id = p_school_id AND ec.status = 'active'
               AND ec.team_id = ANY (public.user_coached_team_ids())
               AND ((p.child_id IS NOT NULL AND ec.child_id = p.child_id)
                 OR (p.profile_id IS NOT NULL AND ec.user_id = p.profile_id)))
       )
     ORDER BY COALESCE(p.child_id, p.profile_id),
              CASE i.availability_status WHEN 'no_disponible' THEN 0 WHEN 'restringido' THEN 1 ELSE 2 END,
              i.updated_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_school_athlete_availability(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_school_athlete_availability(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_school_athlete_availability(uuid) TO authenticated, service_role;

-- ── 5. school_athletes: contacto enmascarado fuera de los equipos del coach ──
-- Definición viva copiada de pg_get_viewdef el 2026-10-10. Cambios, y nada más:
--   · un LATERAL `hc` por rama que decide hide_contact;
--   · parent_email / parent_phone → NULL cuando hide_contact.
-- Mismas columnas, mismo orden, mismos tipos (CREATE OR REPLACE lo exige).
-- security_invoker = true NO es opcional (ver 20260916103807): sin él la vista
-- corre como owner y salta la RLS de children/enrollments.
-- `(SELECT user_coached_team_ids())::uuid[]` es una subconsulta no correlacionada
-- (el cast es obligatorio: sin él `= ANY (subconsulta)` compara uuid con uuid[] → 42883):
-- el planner la evalúa una sola vez (InitPlan), no por fila.
CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true)
AS
 SELECT c.id,
    c.full_name,
    c.avatar_url,
    c.school_id,
    COALESCE(c.branch_id, get_single_branch_id(c.school_id)) AS branch_id,
    c.team_id,
    c.date_of_birth,
    c.is_active,
    'child'::text AS athlete_type,
    c.parent_id,
    NULL::uuid AS user_id,
    c.medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE COALESCE(c.monthly_fee, 0::numeric)
            END
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.email, c.parent_email_temp)
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE COALESCE(p.phone, c.parent_phone_temp)
        END AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    c.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.child_id = c.id AND py.school_id = c.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(c.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = c.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(c.school_id) THEN NOT (
                    COALESCE(c.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]), false)
                    OR EXISTS ( SELECT 1
                           FROM enrollments e
                          WHERE e.child_id = c.id AND e.status = 'active'::text
                            AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[])))
                ELSE false
            END AS hide_contact) hc ON true
UNION ALL
 SELECT pr.id,
    pr.full_name,
    pr.avatar_url,
    sm.school_id,
    COALESCE(te.team_branch_id, sm.branch_id, get_single_branch_id(sm.school_id)) AS branch_id,
    te.team_id,
    pr.date_of_birth,
    sm.status = 'active'::text AS is_active,
    'adult'::text AS athlete_type,
    NULL::uuid AS parent_id,
    pr.id AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE pr.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    sm.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(sm.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = sm.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(sm.school_id) THEN NOT EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
                        AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]))
                ELSE false
            END AS hide_contact) hc ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    ua.avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    COALESCE(te.enrollment_id, pe.enrollment_id) AS enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
                ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
            END, 0::numeric)
        END AS team_monthly_fee,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
        END AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN hm.hide_money THEN NULL::numeric
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
                WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
                ELSE 0::numeric
            END
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.email
        END AS parent_email,
        CASE
            WHEN hc.hide_contact THEN NULL::text
            ELSE ua.phone
        END AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE COALESCE(pay.status,
            CASE
                WHEN pe.offering_plan_id IS NOT NULL AND pe.fee_is_manual AND COALESCE(pe.monthly_fee, pe.plan_price, 0::numeric) = 0::numeric OR pe.offering_plan_id IS NULL AND te.enrollment_id IS NOT NULL AND te.fee_is_manual AND COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric) = 0::numeric THEN NULL::text
                WHEN act.has_active THEN 'pending'::text
                ELSE NULL::text
            END)
        END AS payment_status,
        CASE
            WHEN hm.hide_money THEN NULL::date
            ELSE pay.due_date
        END AS payment_due_date,
        CASE
            WHEN hm.hide_money THEN NULL::boolean
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_is_manual
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_is_manual
                ELSE false
            END
        END AS fee_is_manual,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.fee_reason
                WHEN te.enrollment_id IS NOT NULL THEN te.fee_reason
                ELSE NULL::text
            END
        END AS fee_reason,
    ua.dorsal,
        CASE
            WHEN hm.hide_money THEN NULL::text
            ELSE
            CASE
                WHEN pe.offering_plan_id IS NOT NULL THEN pe.discount_type
                WHEN te.enrollment_id IS NOT NULL THEN te.discount_type
                ELSE NULL::text
            END
        END AS discount_type
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
            e.fee_is_manual,
            e.fee_reason,
            e.discount_type,
            e.sessions_used,
            e.secondary_sessions_used,
            e.expires_at,
            op.name AS plan_name,
            op.price AS plan_price
           FROM enrollments e
             JOIN offering_plans op ON op.id = e.offering_plan_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.offering_plan_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) pe ON true
     LEFT JOIN LATERAL ( SELECT py.status,
            py.due_date
           FROM payments py
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id AND (py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text]))
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC, (
                CASE
                    WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text]) THEN py.due_date
                    ELSE NULL::date
                END), py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(is_school_coach(ua.school_id) AND ss.coach_hide_financial_info, false) AS hide_money
           FROM school_settings ss
          WHERE ss.school_id = ua.school_id) hm ON true
     LEFT JOIN LATERAL ( SELECT
            CASE
                WHEN coach_contact_masked_school(ua.school_id) THEN NOT EXISTS ( SELECT 1
                       FROM enrollments e
                      WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
                        AND e.team_id = ANY ((SELECT user_coached_team_ids())::uuid[]))
                ELSE false
            END AS hide_contact) hc ON true
  WHERE ua.linked_profile_id IS NULL;


-- =============================================================================
-- Verificación post-aplicación (SQL Editor, sin escribir nada):
--
--   select policyname, cmd, roles, qual, with_check from pg_policies
--    where tablename in ('teams','team_coaches','team_branches') order by 1,2;
--   -- Esperado en teams: "Teams: manage admin" (ALL), "Teams: coach update own"
--   -- (UPDATE), "Teams: coach manage own (scoped)" (ALL, Carmel), 3 SELECT y
--   -- 3 trial_block_*. Ya NO: "Teams: manage staff", "Programs: manage admin".
--
--   select reloptions from pg_class where oid = 'public.school_athletes'::regclass;
--   -- Esperado: {security_invoker=true}
--
-- Prueba con sesión simulada: supabase/migrations/_smoke/coach_alcance_equipos_contactos_smoke.sql
-- =============================================================================

-- ▲▲▲ fin 20261010201426_coach_alcance_equipos_contactos.sql ▲▲▲

-- ▼▼▼ 20261010202857_signup_rol_whitelist_y_gates_admin_por_rol.sql ▼▼▼

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


-- ▲▲▲ fin 20261010202857_signup_rol_whitelist_y_gates_admin_por_rol.sql ▲▲▲

-- ▼▼▼ 20261013124655_wa_bandeja_autocierre_por_pago.sql ▼▼▼

-- =============================================================================
-- 20261013124655_wa_bandeja_autocierre_por_pago.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-13   Versión anterior: 20261010202857
-- Objetivo: que la «Bandeja de comprobantes» del canal de WhatsApp se cierre
--   sola cuando el pago al que apunta una fila se aprueba o se rechaza, por el
--   camino que sea (Pagos, conciliación, Wompi, RPCs, SQL).
-- =============================================================================
-- Por qué (medido en Dynasty el 2026-10-13): 206 filas abiertas en la bandeja y
-- 0 cerradas por la escuela. Las únicas que se cerraban solas eran las
-- `ya_registrado`, y solo cuando alguien abría la pestaña (barrido en el BFF).
-- Una fila que pedía decidir («varios cobros», «monto distinto»…) seguía
-- abierta aunque la escuela ya hubiera aprobado ese comprobante en Pagos.
--
-- El BFF ya hace el mismo cierre al leer la bandeja (filasParaAutocierrePorDecision,
-- bff/src/services/whatsapp-bandeja.service.ts). Este trigger lo hace en el
-- momento de la decisión, para que el contador del correo diario y del Resumen
-- no dependa de que alguien abra la pantalla.
--
-- Enlace fila → pago (nunca «la familia tiene algún pago aprobado»):
--   · whatsapp_inbound_queue.result_ref_id = payments.id
--   · pregunta_ocr->>'sha'              = payments.receipt_image_sha256
--   · pregunta_ocr->'ocr'->>'reference' = payments.ocr_reference / receipt_reference_norm
-- y solo si la decisión es POSTERIOR a la llegada de la fila (5 min de margen).
--
-- Decisión:
--   · aprobado  → status pasa a 'paid'/'approved'/'completed'
--   · rechazado → receipt_rejected_at cambia (reject_payment_receipt devuelve el
--                 cobro a pending/overdue) o status pasa a 'rejected'
--
-- Formato del cierre: el mismo que escribe el BFF (prefijo `cerrado_escuela:`
-- en error_message, motivo original tras « | »), así la pantalla y las métricas
-- lo leen igual. NO toca payments ni bloquea su UPDATE: cualquier error del
-- trigger se traga con un WARNING.
--
-- NO APLICADA. Aplicar por CLI de Supabase o apply_migration (deja rastro).
-- Antes, correr el SELECT de verificación del final contra la base.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.wa_bandeja_cerrar_por_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_decision text;
    v_cuando   timestamptz;
    v_motivo   text;
BEGIN
    IF NEW.status IN ('paid', 'approved', 'completed')
       AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_decision := 'aprobado';
        v_cuando   := COALESCE(NEW.approved_at, now());
    ELSIF NEW.receipt_rejected_at IS NOT NULL
       AND NEW.receipt_rejected_at IS DISTINCT FROM OLD.receipt_rejected_at THEN
        v_decision := 'rechazado';
        v_cuando   := NEW.receipt_rejected_at;
    ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_decision := 'rechazado';
        v_cuando   := now();
    ELSE
        RETURN NEW;
    END IF;

    v_motivo := CASE v_decision
        WHEN 'aprobado'  THEN 'el pago se aprobó (' || NEW.status || ': ' || left(COALESCE(NEW.concept, ''), 80) || ')'
        ELSE 'el comprobante se rechazó en Pagos (' || left(COALESCE(NEW.concept, ''), 80) || ')'
    END;
    v_motivo := replace(v_motivo, '|', '/');

    BEGIN
        UPDATE public.whatsapp_inbound_queue q
           SET status        = 'ignored',
               locked_until  = NULL,
               error_message = left('cerrado_escuela: resuelto_auto — ' || v_motivo || ' | '
                                    || COALESCE(q.error_message, ''), 1000),
               updated_at    = now()
         WHERE q.school_id = NEW.school_id
           AND q.status IN ('failed', 'ignored', 'waiting_user')
           AND COALESCE(q.error_message, '') NOT LIKE 'cerrado_escuela:%'
           -- `ya_registrado` lo cierra su propio barrido (otra regla).
           AND COALESCE(q.error_message, '') NOT LIKE 'recuperado: ya_registrado%'
           AND COALESCE(q.error_message, '') NOT LIKE 'referencia ya usada%'
           AND q.created_at <= v_cuando + interval '5 minutes'
           AND (
                q.result_ref_id = NEW.id
             OR (NEW.receipt_image_sha256 IS NOT NULL AND q.pregunta_ocr->>'sha' = NEW.receipt_image_sha256)
             OR (NEW.ocr_reference IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.ocr_reference)
             OR (NEW.receipt_reference_norm IS NOT NULL AND q.pregunta_ocr->'ocr'->>'reference' = NEW.receipt_reference_norm)
           );
    EXCEPTION WHEN OTHERS THEN
        -- La bandeja nunca puede trabar la aprobación de un pago.
        RAISE WARNING 'wa_bandeja_cerrar_por_pago: % (pago %)', SQLERRM, NEW.id;
    END;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.wa_bandeja_cerrar_por_pago() IS
    'Trigger: cierra (resuelto_auto) las filas abiertas de la Bandeja de comprobantes de WhatsApp '
    'enlazadas a un pago cuando ese pago se aprueba o su comprobante se rechaza. No toca payments.';

-- Función de trigger: nadie la llama como RPC. Los default privileges del
-- esquema le darían EXECUTE a authenticated/anon (trampa 3 de CLAUDE.md).
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM anon;
REVOKE ALL ON FUNCTION public.wa_bandeja_cerrar_por_pago() FROM authenticated;

DROP TRIGGER IF EXISTS trg_wa_bandeja_cerrar_por_pago ON public.payments;
CREATE TRIGGER trg_wa_bandeja_cerrar_por_pago
    AFTER UPDATE OF status, receipt_rejected_at ON public.payments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status
          OR OLD.receipt_rejected_at IS DISTINCT FROM NEW.receipt_rejected_at)
    EXECUTE FUNCTION public.wa_bandeja_cerrar_por_pago();


-- Verificación (después de aplicar):
--   select tgname from pg_trigger where tgrelid = 'public.payments'::regclass
--      and tgname = 'trg_wa_bandeja_cerrar_por_pago';
--   select proconfig from pg_proc where proname = 'wa_bandeja_cerrar_por_pago';  -- search_path fijo (I4)
--   npm run seguridad:invariantes

-- ▲▲▲ fin 20261013124655_wa_bandeja_autocierre_por_pago.sql ▲▲▲

-- Rastro en el registro de migraciones
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260718000001', 'glosa_notification_markers'),
  ('20260811110226', 'update_get_onboarding_status_check_offering_plans'),
  ('20260921204955', 'guard_de_prueba_en_rpcs_restantes'),
  ('20261010124934', 'alta_exonerar_inscripcion_seguro'),
  ('20261010201231', 'carnets_plantilla_predeterminada_y_privacidad_publica'),
  ('20261010201426', 'coach_alcance_equipos_contactos'),
  ('20261010202857', 'signup_rol_whitelist_y_gates_admin_por_rol'),
  ('20261013124655', 'wa_bandeja_autocierre_por_pago')
ON CONFLICT (version) DO NOTHING;

COMMIT;
