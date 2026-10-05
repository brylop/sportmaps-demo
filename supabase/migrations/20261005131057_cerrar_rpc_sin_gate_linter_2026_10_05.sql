-- =============================================================================
-- Cierre de las RPC SECURITY DEFINER sin gate (cruce linter × auditorías, 2026-10-05)
-- =============================================================================
-- Contexto: docs/auditoria-seguridad-2026-08-14.md, adenda 2026-10-05.
-- El default privilege de funciones se cerró el 2026-09-17 (20260917152834),
-- pero NO es retroactivo: las funciones creadas antes conservan EXECUTE para
-- anon/authenticated. Este barrido las leyó cuerpo por cuerpo contra la base viva.
--
-- Tres tratamientos:
--   A. REVOKE a anon/authenticated → solo service_role. Funciones sin llamador
--      en el frontend, sin uso en policies/vistas, y llamadas solo desde otras
--      funciones SECURITY DEFINER (corren como dueño, no necesitan el GRANT) o
--      desde el BFF (service_role).
--   B. Gate dentro: el frontend sí las llama. Se renombra la original a
--      *_impl (solo service_role) y se crea un envoltorio con la MISMA firma
--      que valida al llamador. No se reescribe la lógica de negocio.
--   C. buscar_menor_por_documento_publico: filtra por la escuela recibida
--      (antes solo exigía que no fuera NULL) y enmascara el contacto del acudiente.
--
-- NO se tocan los helpers que usan las policies (get_trainer_athlete_ids,
-- is_school_member, is_coach_parent_messaging_blocked, school_is_operational,
-- store_enabled, ...): revocarles EXECUTE tumba con 403 toda query sobre esas
-- tablas (CLAUDE.md). Quedan como residual aceptado en la allowlist de I7.
--
-- Radio medido antes de escribir (2026-10-05, solo lectura):
--   · process_enrollment_checkout: 0 pagos en toda la historia con sus conceptos
--     ('Enrollment Fee' / 'Plan Enrollment') → nadie usa el camino que se cierra.
--   · buscar_menor_por_documento_publico: 343 menores + 148 atletas sin registro
--     exponían nombre/correo/teléfono del acudiente a cualquier anónimo.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Helpers de autorización (internos: sin EXECUTE para anon/authenticated)
-- -----------------------------------------------------------------------------

-- Llamada desde el servidor: BFF con service_role, o sin JWT (cron, SQL directo).
-- Por PostgREST un anónimo trae role='anon' y un usuario 'authenticated', nunca NULL.
CREATE OR REPLACE FUNCTION public._es_llamada_de_servidor()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT coalesce(auth.role(), '') IN ('service_role', '');
$$;

-- ¿El llamador puede ver datos de este menor? Acudiente, staff de una escuela
-- donde el menor está o estuvo inscrito, super admin, o el servidor.
CREATE OR REPLACE FUNCTION public._puede_ver_menor(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT public._es_llamada_de_servidor()
        OR coalesce(public.is_super_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.children c
             WHERE c.id = p_child_id
               AND (c.parent_id = auth.uid()
                    OR c.school_id = ANY (public.user_staff_school_ids()))
        )
        OR EXISTS (
            SELECT 1 FROM public.enrollments e
             WHERE e.child_id = p_child_id
               AND e.school_id = ANY (public.user_staff_school_ids())
        );
$$;

-- ¿El llamador puede ver datos de este atleta adulto (profile)?
CREATE OR REPLACE FUNCTION public._puede_ver_atleta(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT public._es_llamada_de_servidor()
        OR p_athlete_id = auth.uid()
        OR coalesce(public.is_super_admin(), false)
        OR EXISTS (
            SELECT 1 FROM public.enrollments e
             WHERE e.user_id = p_athlete_id
               AND e.school_id = ANY (public.user_staff_school_ids())
        );
$$;

CREATE OR REPLACE FUNCTION public._enmascarar_correo(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        WHEN p IS NULL OR btrim(p) = '' OR position('@' IN p) = 0 THEN NULL
        ELSE left(split_part(btrim(p), '@', 1), 2) || '***@' || split_part(btrim(p), '@', 2)
    END;
$$;

CREATE OR REPLACE FUNCTION public._enmascarar_telefono(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        WHEN p IS NULL OR length(regexp_replace(p, '[^0-9]', '', 'g')) < 4 THEN NULL
        ELSE '*** *** ' || right(regexp_replace(p, '[^0-9]', '', 'g'), 4)
    END;
$$;

-- Nombre: primer nombre + iniciales (mismo formato que ya usa la función para el menor).
CREATE OR REPLACE FUNCTION public._enmascarar_nombre(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
    SELECT CASE
        WHEN p IS NULL OR btrim(p) = '' THEN NULL
        ELSE split_part(btrim(p), ' ', 1) || COALESCE(
            (SELECT string_agg(' ' || left(w, 1) || '.', '')
               FROM unnest(string_to_array(btrim(p), ' ')) WITH ORDINALITY AS t(w, i)
              WHERE i > 1 AND w <> ''), '')
    END;
$$;

REVOKE ALL ON FUNCTION public._es_llamada_de_servidor()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._puede_ver_menor(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._puede_ver_atleta(uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._enmascarar_correo(text)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._enmascarar_telefono(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._enmascarar_nombre(text)   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._es_llamada_de_servidor()  TO service_role;
GRANT EXECUTE ON FUNCTION public._puede_ver_menor(uuid)     TO service_role;
GRANT EXECUTE ON FUNCTION public._puede_ver_atleta(uuid)    TO service_role;

-- -----------------------------------------------------------------------------
-- A. Solo servidor (REVOKE a anon y authenticated)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    f text;
    v_firmas text[] := ARRAY[
        -- N1 · pago 'completed' con monto del cliente, cualquier escuela/acudiente
        'public.process_enrollment_checkout(uuid, uuid, uuid, uuid, numeric, text, boolean, uuid)',
        'public.process_enrollment_checkout(uuid, uuid, uuid, numeric, text, uuid, uuid)',
        -- N2 · SELECT * de school_athletes (médico + contacto) de cualquier escuela
        'public.get_school_athletes(uuid)',
        -- N5 · anon inyecta notificaciones con link arbitrario a admins (phishing)
        'public._equipment_notify_admins(uuid, text, text, text)',
        'public._equipment_set_acta_fields(uuid)',
        'public._next_equipment_folio(uuid)',
        'public._equipment_is_active_coach(uuid, uuid)',
        -- Informes: helpers internos (las RPC públicas del módulo ya tienen gate)
        'public._report_attended_subjects(uuid, date, date)',
        'public._report_send_day(uuid, uuid)',
        -- Certificados: helpers internos de request_athlete_certificate
        'public._build_certificate_snapshot(uuid, uuid, uuid, uuid)',
        'public._next_certificate_folio(uuid)',
        -- Escrituras sin gate, sin llamador en el frontend (BFF/triggers/funciones)
        'public.enroll_student(uuid, uuid, uuid, uuid)',
        'public.increment_session_bookings(uuid)',
        'public.decrement_session_bookings(uuid)',
        'public.fn_book_pt_session(uuid, date, time without time zone, uuid, text, text)',
        'public.fn_generate_pt_sessions(uuid, uuid, integer)',
        'public.fn_generate_sessions_for_offering(uuid, uuid, integer)',
        'public.fn_generate_sessions_from_offering_schedule(uuid, integer)',
        'public.fn_sync_all_offering_sessions(uuid, integer)',
        'public.calculate_delegation_balance(uuid)',
        'public.lock_delegation_price_phase(uuid)',
        'public.prorate_delegation_payment(uuid)',
        'public.process_referral_registration(text, uuid)',
        'public.register_qr_paid_conversion(uuid)',
        -- Lecturas sin gate, sin llamador en el frontend
        'public.get_payment_providers_for_school(uuid)',
        'public.get_payment_providers_for_vendor(uuid)',
        'public.get_cash_session_summary(uuid)',
        'public.get_pt_client_summary(uuid)',
        'public.get_athlete_stats(uuid, text, uuid, integer)',
        'public.get_facility_availability(uuid, date)',
        'public.validate_product_quality(uuid)',
        'public.enrollment_pausada_el(uuid, date)',
        'public.enrollment_pausada_en(uuid, integer, integer)',
        'public.get_onboarding_status(uuid)',          -- la de 0 args (auth.uid) sigue igual
        -- Oráculos de identidad: rol/estado de cualquier usuario por UUID
        'public.has_role(uuid, text)',
        'public.is_demo_user(uuid)',
        'public.is_personal_trainer(uuid)'
    ];
BEGIN
    FOREACH f IN ARRAY v_firmas LOOP
        IF to_regprocedure(f) IS NULL THEN
            RAISE EXCEPTION 'firma no encontrada (revisar antes de aplicar): %', f;
        END IF;
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- B. Gate dentro (el frontend las llama): renombrar a *_impl + envoltorio
-- -----------------------------------------------------------------------------

-- B1 · mark_overdue_payments — escribía en payments de CUALQUIER escuela
ALTER FUNCTION public.mark_overdue_payments(uuid) RENAME TO _mark_overdue_payments_impl;
REVOKE ALL ON FUNCTION public._mark_overdue_payments_impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mark_overdue_payments_impl(uuid) TO service_role;

CREATE FUNCTION public.mark_overdue_payments(p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT (public._es_llamada_de_servidor()
            OR coalesce(public.is_school_admin(p_school_id), false)
            OR coalesce(public.is_super_admin(), false)) THEN
        RAISE EXCEPTION 'No tienes permisos sobre los cobros de esta escuela.' USING ERRCODE = '42501';
    END IF;
    RETURN public._mark_overdue_payments_impl(p_school_id);
END;
$$;

-- B2 · get_athletes_without_payment (N4) — contacto de acudientes de cualquier escuela
ALTER FUNCTION public.get_athletes_without_payment(uuid) RENAME TO _get_athletes_without_payment_impl;
REVOKE ALL ON FUNCTION public._get_athletes_without_payment_impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._get_athletes_without_payment_impl(uuid) TO service_role;

CREATE FUNCTION public.get_athletes_without_payment(p_school_id uuid)
RETURNS TABLE(athlete_id uuid, full_name text, athlete_type text, team_name text,
              plan_name text, price_monthly numeric, contact_email text, contact_phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT (public._es_llamada_de_servidor()
            OR coalesce(public.is_school_admin(p_school_id), false)
            OR coalesce(public.is_super_admin(), false)) THEN
        RAISE EXCEPTION 'No tienes permisos sobre los cobros de esta escuela.' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY SELECT * FROM public._get_athletes_without_payment_impl(p_school_id);
END;
$$;

-- B3 · next_unpaid_period / period_payment_status — estado de pago de cualquier menor
ALTER FUNCTION public.next_unpaid_period(uuid) RENAME TO _next_unpaid_period_impl;
REVOKE ALL ON FUNCTION public._next_unpaid_period_impl(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._next_unpaid_period_impl(uuid) TO service_role;

CREATE FUNCTION public.next_unpaid_period(p_child_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    -- NULL se deja pasar: la impl ya responde {'error':'child_id_required'}.
    IF p_child_id IS NOT NULL AND NOT public._puede_ver_menor(p_child_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._next_unpaid_period_impl(p_child_id);
END;
$$;

ALTER FUNCTION public.period_payment_status(uuid, smallint, smallint) RENAME TO _period_payment_status_impl;
REVOKE ALL ON FUNCTION public._period_payment_status_impl(uuid, smallint, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._period_payment_status_impl(uuid, smallint, smallint) TO service_role;

CREATE FUNCTION public.period_payment_status(p_child_id uuid, p_period_year smallint, p_period_month smallint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF p_child_id IS NOT NULL AND NOT public._puede_ver_menor(p_child_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._period_payment_status_impl(p_child_id, p_period_year, p_period_month);
END;
$$;

-- B4 · estadísticas de ejercicio — datos de rendimiento de cualquier menor/atleta
ALTER FUNCTION public.get_child_exercise_stats(uuid, integer) RENAME TO _get_child_exercise_stats_impl;
ALTER FUNCTION public.get_child_exercise_stats(uuid, integer, uuid) RENAME TO _get_child_exercise_stats_impl;
ALTER FUNCTION public.get_athlete_exercise_stats(uuid, integer) RENAME TO _get_athlete_exercise_stats_impl;
ALTER FUNCTION public.get_athlete_exercise_stats(uuid, integer, uuid) RENAME TO _get_athlete_exercise_stats_impl;
REVOKE ALL ON FUNCTION public._get_child_exercise_stats_impl(uuid, integer)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._get_child_exercise_stats_impl(uuid, integer, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._get_athlete_exercise_stats_impl(uuid, integer)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._get_athlete_exercise_stats_impl(uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._get_child_exercise_stats_impl(uuid, integer)         TO service_role;
GRANT EXECUTE ON FUNCTION public._get_child_exercise_stats_impl(uuid, integer, uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public._get_athlete_exercise_stats_impl(uuid, integer)       TO service_role;
GRANT EXECUTE ON FUNCTION public._get_athlete_exercise_stats_impl(uuid, integer, uuid) TO service_role;

-- Mismas firmas y defaults que las originales (incluida la ambigüedad de
-- sobrecarga que ya existía: el frontend siempre manda los parámetros nombrados).
CREATE FUNCTION public.get_child_exercise_stats(p_child_id uuid, p_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public._puede_ver_menor(p_child_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._get_child_exercise_stats_impl(p_child_id, p_days);
END;
$$;

CREATE FUNCTION public.get_child_exercise_stats(p_child_id uuid, p_days integer DEFAULT 90, p_school_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public._puede_ver_menor(p_child_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._get_child_exercise_stats_impl(p_child_id, p_days, p_school_id);
END;
$$;

CREATE FUNCTION public.get_athlete_exercise_stats(p_athlete_id uuid, p_days integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public._puede_ver_atleta(p_athlete_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._get_athlete_exercise_stats_impl(p_athlete_id, p_days);
END;
$$;

CREATE FUNCTION public.get_athlete_exercise_stats(p_athlete_id uuid, p_days integer DEFAULT 90, p_school_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF NOT public._puede_ver_atleta(p_athlete_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este atleta.' USING ERRCODE = '42501';
    END IF;
    RETURN public._get_athlete_exercise_stats_impl(p_athlete_id, p_days, p_school_id);
END;
$$;

-- Los envoltorios nacen con el default privilege cerrado (solo service_role);
-- se otorga explícito a authenticated porque el frontend los llama. Nunca a anon.
DO $$
DECLARE f text;
BEGIN
    FOREACH f IN ARRAY ARRAY[
        'public.mark_overdue_payments(uuid)',
        'public.get_athletes_without_payment(uuid)',
        'public.next_unpaid_period(uuid)',
        'public.period_payment_status(uuid, smallint, smallint)',
        'public.get_child_exercise_stats(uuid, integer)',
        'public.get_child_exercise_stats(uuid, integer, uuid)',
        'public.get_athlete_exercise_stats(uuid, integer)',
        'public.get_athlete_exercise_stats(uuid, integer, uuid)'
    ] LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- C. buscar_menor_por_documento_publico (N3)
-- -----------------------------------------------------------------------------
-- Antes: exigía p_school_id NOT NULL pero nunca filtraba por él → búsqueda
-- nacional; y devolvía nombre/correo/teléfono del acudiente en claro a anon.
-- Ahora: solo la escuela recibida; contacto enmascarado. El formulario ya no
-- precarga el dato real (frontend: JoinSchoolPublicPage muestra la pista).
-- Mismas columnas y tipos: CREATE OR REPLACE conserva los GRANT (flujo público).
CREATE OR REPLACE FUNCTION public.buscar_menor_por_documento_publico(p_doc_number text, p_school_id uuid)
RETURNS TABLE(child_id uuid, nombre text, school_id uuid, school_name text, team_name text,
              branch_name text, already_linked boolean, parent_name_temp text,
              parent_email_temp text, parent_phone_temp text, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
    WITH q AS (
        SELECT regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g') AS doc
    )
    SELECT c.id,
           public._enmascarar_nombre(c.full_name),
           c.school_id, s.name, t.name, b.name,
           (c.parent_id IS NOT NULL),
           CASE WHEN c.parent_id IS NULL THEN public._enmascarar_nombre(c.parent_name_temp) END,
           CASE WHEN c.parent_id IS NULL THEN public._enmascarar_correo(c.parent_email_temp) END,
           CASE WHEN c.parent_id IS NULL THEN public._enmascarar_telefono(c.parent_phone_temp) END,
           'children'::text
      FROM q, public.children c
      LEFT JOIN public.schools s ON s.id = c.school_id
      LEFT JOIN public.teams t ON t.id = c.team_id
      LEFT JOIN public.school_branches b ON b.id = c.branch_id
     WHERE q.doc <> '' AND length(q.doc) >= 5
       AND p_school_id IS NOT NULL
       AND c.school_id = p_school_id
       AND regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g') = q.doc
       AND COALESCE(c.is_active, true)
    UNION ALL
    SELECT ua.id,
           public._enmascarar_nombre(ua.full_name),
           ua.school_id, s.name, t.name, b.name,
           (ua.linked_profile_id IS NOT NULL),
           CASE WHEN ua.linked_profile_id IS NULL THEN public._enmascarar_nombre(ua.guardian_full_name) END,
           CASE WHEN ua.linked_profile_id IS NULL THEN public._enmascarar_correo(ua.guardian_email) END,
           CASE WHEN ua.linked_profile_id IS NULL THEN public._enmascarar_telefono(ua.guardian_phone) END,
           'unregistered_athlete'::text
      FROM q, public.unregistered_athletes ua
      LEFT JOIN public.schools s ON s.id = ua.school_id
      LEFT JOIN public.enrollments e ON e.unregistered_athlete_id = ua.id AND e.status IN ('active', 'pending')
      LEFT JOIN public.teams t ON t.id = e.team_id
      LEFT JOIN public.school_branches b ON b.id = ua.branch_id
     WHERE q.doc <> '' AND length(q.doc) >= 5
       AND p_school_id IS NOT NULL
       AND ua.school_id = p_school_id
       AND regexp_replace(COALESCE(ua.doc_number, ''), '[^0-9]', '', 'g') = q.doc
       AND COALESCE(ua.is_active, true);
$$;

COMMIT;
