-- ============================================================================
-- SEG-16d — Cerrar a `anon` los RPC de módulo (Dotación e Informes)
--
-- Fecha: 2026-08-16
--
-- ── Dónde estamos ───────────────────────────────────────────────────────────
-- Tras SEG-16c quedan 141 funciones SECURITY DEFINER ejecutables por `anon`:
--
--     revisar      67
--     helper_rls   48
--     publica      26
--
-- ── ⚠️ CORRECCIÓN: `helper_rls` NO es el grupo seguro ───────────────────────
-- La consulta 2 de SEG-16c los etiquetó como «candidatas seguras». **Es al
-- revés.** El `CLAUDE.md` del repo ya lo advierte:
--
--     «Helpers de RLS: nunca revocar is_school_admin(), is_super_admin(), etc.
--      al rol que las invoca desde policies, o rompe con 403 todas las queries.»
--
-- Si una policy llama a `is_school_member()` y alguien sin sesión consulta esa
-- tabla, Postgres evalúa la policy y necesita que **ese rol** tenga EXECUTE.
-- Sin el privilegio no devuelve 0 filas: devuelve error. Barrer esos 48 es la
-- forma más rápida de tumbar todas las lecturas públicas.
--
-- Y el regex de agrupación de SEG-16c se quedó corto: `has_entitlement`,
-- `has_role`, `has_school_role`, `fn_is_admin_of_school`, `school_is_operational`
-- y `school_member_profile_ids` cayeron en `revisar` y también son helpers.
-- Ninguno se toca acá.
--
-- ── Lo que sí es seguro, y por qué ──────────────────────────────────────────
-- Los RPC de los módulos de **Dotación** (`equipment_*`) e **Informes del
-- atleta**. Verificado antes de escribir esto:
--   * Ninguna policy los referencia (grep sobre las migraciones).
--   * El frontend los llama con sesión: `authenticated` CONSERVA el EXECUTE.
--   * No participan de ningún flujo público — no hay pantalla sin login que
--     entregue dotación ni publique un informe.
--
-- Se cierran los dos caminos (PUBLIC y concesión directa) y se re-concede a
-- `authenticated` y `service_role`, que es lo que evita el 403.
--
-- OJO con `_equipment_is_active_coach`, `_equipment_notify_admins`,
-- `_equipment_set_acta_fields`, `_next_equipment_folio`, `_report_send_day` y
-- `_report_attended_subjects`: empiezan con `_`, son helpers internos y pueden
-- estar dentro de policies o de otras funciones. **Quedan fuera** de este
-- barrido a propósito.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_fn       record;
    v_cerradas int := 0;
    v_nombres  text[] := '{}';
BEGIN
    FOR v_fn IN
        SELECT p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           AND p.prosecdef
           AND has_function_privilege('anon', p.oid, 'EXECUTE')
           -- Dotación: todo el módulo MENOS los helpers con prefijo `_`.
           AND (
                 (p.proname LIKE 'equipment\_%')
                 -- Informes del atleta: acciones de la pantalla de reportes.
              OR p.proname IN ('publish_athlete_report', 'publish_team_reports',
                               'regenerate_report_snapshot', 'set_athlete_report_note',
                               'hold_athlete_report', 'mark_report_viewed',
                               'generate_report_drafts', 'report_coverage',
                               'reschedule_pending_reports')
           )
         ORDER BY p.proname
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                       v_fn.proname, v_fn.args);
        -- Re-concesión explícita: el REVOKE a PUBLIC también se lleva por
        -- delante lo que authenticated y service_role heredaban.
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
                       v_fn.proname, v_fn.args);
        v_cerradas := v_cerradas + 1;
        v_nombres  := v_nombres || v_fn.proname;
    END LOOP;

    RAISE NOTICE 'Cerradas a anon % funciones: %', v_cerradas, array_to_string(v_nombres, ', ');
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Las tocadas: anon=false y authenticated=true. Si alguna quedara en
--    auth=false, la pantalla de ese módulo respondería 403.
-- ────────────────────────────────────────────────────────────────────────────
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       CASE
           WHEN has_function_privilege('anon', p.oid, 'EXECUTE')            THEN '🔴 sigue abierta'
           WHEN NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN '⚠️ ROMPE LA PANTALLA'
           ELSE '✅ ok'
       END AS estado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND (p.proname LIKE 'equipment\_%'
        OR p.proname IN ('publish_athlete_report','publish_team_reports',
                         'regenerate_report_snapshot','set_athlete_report_note',
                         'hold_athlete_report','mark_report_viewed',
                         'generate_report_drafts','report_coverage',
                         'reschedule_pending_reports'))
 ORDER BY estado, p.proname;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. El saldo: cuántas quedan y en qué grupo.
-- ────────────────────────────────────────────────────────────────────────────
SELECT CASE
         WHEN p.proname ~ '^(_|is_|check_is_|can_|user_|coach_|staff_|current_|get_user_|get_my_)'
              OR p.proname IN ('has_entitlement','has_role','has_school_role',
                               'fn_is_admin_of_school','school_is_operational',
                               'school_member_profile_ids','school_has_native_app',
                               'school_shows_own_brand')
              THEN 'helper_rls (NO TOCAR — rompe policies)'
         WHEN p.proname ~ '^(get_school_by_slug|get_school_id_by_|get_join_qr_public|get_qr_pay_targets|submit_qr_signup|generate_qr_monthly_charge|validate_child_for_team_join|validate_doc_for_plan_join|find_athletes_by_document|get_team_join_info|get_plan_join_info|get_public_program_slots|get_invitation_details|accept_invitation|get_school_branding_by_invitation|verify_athlete_|access_demo_link|search_|schools_near_location|get_distance_km|is_school_open_now)'
              THEN 'publica (se quedan)'
         ELSE 'revisar una por una'
       END                                            AS grupo,
       count(*)                                       AS cuantas,
       string_agg(p.proname, ', ' ORDER BY p.proname) AS funciones
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND p.prosecdef
   AND p.prorettype <> 'pg_catalog.trigger'::regtype
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
 GROUP BY 1
 ORDER BY 2 DESC;
