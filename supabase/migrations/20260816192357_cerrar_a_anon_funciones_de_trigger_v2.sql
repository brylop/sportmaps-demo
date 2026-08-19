-- ============================================================================
-- SEG-16c — Cerrar a `anon` las funciones de TRIGGER (el barrido sin riesgo)
--
-- Fecha: 2026-08-16
--
-- ⚠️ REEMPLAZA a `20260816192113_cerrar_a_anon_funciones_de_trigger.sql`, que
--    tiene un guion de menos en un comentario (línea 103: `-` en vez de `--`) y
--    aborta con `42601: syntax error`. Ese archivo **no aplicó nada** —falló al
--    parsear, antes de ejecutar— y queda **superseded: no correrlo**. Se deja en
--    su sitio porque las migraciones son inmutables, mismo criterio que con
--    `20260812180437` en SEG-8.
--
-- ── El tamaño del problema, medido ──────────────────────────────────────────
-- Después de SEG-16 y SEG-16b quedan **165 funciones SECURITY DEFINER
-- ejecutables por `anon`**, y el desglose dice por dónde entran:
--
--     definer_abiertas_a_anon          165
--     con_grant_a_public               120   <- herencia de PUBLIC
--     sin_acl_explicita_hereda_public    0
--
-- O sea: 120 de 165 están abiertas porque su migración hizo `GRANT ... TO
-- authenticated` sin el `REVOKE ... FROM PUBLIC`. Es el mismo defecto de
-- SEG-16b, repetido a lo largo de todo el repo.
--
-- ── Por qué esta migración toca SOLO las de trigger ─────────────────────────
-- Cerrar las 165 de una obliga a decidir, una por una, cuáles son públicas de
-- verdad (perfil de escuela, QR de inscripción, verificación de carnet,
-- invitaciones). Equivocarse en una rompe un flujo público — y con el cliente
-- entrando el martes, ese no es el momento.
--
-- Las funciones que devuelven `trigger` son la parte **sin ninguna decisión**:
--   * Postgres las ejecuta como parte del trigger, con los privilegios del
--     trigger, NO del rol que hace el INSERT/UPDATE. Revocar EXECUTE no afecta
--     en absoluto a los triggers que las usan.
--   * Llamarlas por RPC no tiene sentido: sin `TG_OP`, `NEW` ni `OLD`, fallan.
--     Que estén expuestas en `/rest/v1/rpc/...` es puro accidente de los
--     privilegios por defecto.
--
-- Así que acá el riesgo es cero y el beneficio es sacar de la superficie
-- expuesta a todo un grupo que nunca debió estar.
--
-- El resto (helpers de RLS tipo `is_school_admin`, y las mutaciones) queda para
-- un barrido posterior CON allowlist revisada. Ver la consulta 2 al final: deja
-- la lista de candidatas agrupada para esa pasada.
--
-- Catálogo-driven a propósito: enumerar 25 firmas a mano es como abortó el
-- primer intento de SEG-8 (`42883`, firmas copiadas del repo que no coincidían
-- con la base). Acá se resuelven contra `pg_proc` en tiempo de ejecución.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_fn       record;
    v_cerradas int := 0;
    v_nombres  text[] := '{}';
BEGIN
    FOR v_fn IN
        SELECT p.oid,
               p.proname,
               pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.prokind = 'f'
           -- Devuelve `trigger`: solo la invoca el motor de triggers.
           AND p.prorettype = 'pg_catalog.trigger'::regtype
           -- Solo las que hoy alguien sin sesión podría invocar.
           AND (has_function_privilege('anon', p.oid, 'EXECUTE')
                OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
         ORDER BY p.proname
    LOOP
        -- Se cierran los DOS caminos: PUBLIC (herencia) y las concesiones
        -- directas. No se re-concede a nadie: una función de trigger no
        -- necesita EXECUTE para que su trigger funcione.
        EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                       v_fn.proname, v_fn.args);
        v_cerradas := v_cerradas + 1;
        v_nombres  := v_nombres || v_fn.proname;
    END LOOP;

    IF v_cerradas = 0 THEN
        RAISE NOTICE 'No quedaban funciones de trigger expuestas.';
    ELSE
        RAISE NOTICE 'Cerradas % funciones de trigger: %', v_cerradas, array_to_string(v_nombres, ', ');
    END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Comprobación: ninguna función de trigger debe quedar ejecutable.
--    (El SQL editor no muestra los NOTICE, por eso se consulta.)
-- ────────────────────────────────────────────────────────────────────────────
SELECT count(*) AS triggers_aun_expuestas
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.prorettype = 'pg_catalog.trigger'::regtype
   AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Lo que queda para el barrido con allowlist, agrupado por qué son:
--
--    helper_rls -> is_*/check_is_*/can_*/user_*/coach_*/staff_*/_*: las llaman
--                  las policies, NUNCA el navegador. Candidatas seguras.
--    publica    -> flujos sin sesión de verdad (perfil, QR, invitación,
--                  verificación de carnet). Estas se QUEDAN abiertas.
--    revisar    -> el resto. Una por una.
-- ────────────────────────────────────────────────────────────────────────────
SELECT CASE
         WHEN p.proname ~ '^(_|is_|check_is_|can_|user_|coach_|staff_|current_|get_user_|get_my_)'
              THEN 'helper_rls'
         WHEN p.proname ~ '^(get_school_by_slug|get_school_id_by_|get_join_qr_public|get_qr_pay_targets|submit_qr_signup|generate_qr_monthly_charge|validate_child_for_team_join|validate_doc_for_plan_join|find_athletes_by_document|get_team_join_info|get_plan_join_info|get_public_program_slots|get_invitation_details|accept_invitation|get_school_branding_by_invitation|verify_athlete_|access_demo_link|search_|schools_near_location|get_distance_km|is_school_open_now)'
              THEN 'publica'
         ELSE 'revisar'
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
