-- ============================================================================
-- SEG-8 — ¿siguen `anon` / `authenticated` pudiendo ejecutar las funciones que
-- su propia migración declaró solo para `service_role`?
--
-- Solo LECTURA. Pegar en el SQL Editor de Supabase.
--
-- Por qué por catálogo y no probando: comprobar `apply_late_fees` o
-- `complete_refund` llamándolas como anónimo sería CAUSAR el daño. El barrido
-- del 12-ago probó dos a propósito y se detuvo ahí por eso mismo.
--
-- Contexto: Supabase concede EXECUTE a `anon`/`authenticated` DIRECTAMENTE, no
-- vía PUBLIC — por eso un `REVOKE ... FROM PUBLIC` en la migración original no
-- cerró nada. Hay que mirar el privilegio efectivo por rol.
-- ============================================================================

-- ── 1. Veredicto: cuántas siguen abiertas ───────────────────────────────────
WITH criticas(nombre) AS (
    VALUES ('complete_refund'), ('apply_late_fees'), ('generate_monthly_charges'),
           ('save_payment_token'), ('upsert_school_provider'), ('wa_verify_otp'),
           ('auto_approve_payment'), ('_notify_school_staff'), ('expire_trials'),
           ('open_month'), ('admin_set_school_plan'), ('admin_set_school_addon')
)
SELECT p.proname                                              AS funcion,
       pg_get_function_identity_arguments(p.oid)              AS args,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_puede,
       CASE
           WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN '🔴 ABIERTA A ANÓNIMOS'
           WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN '🟡 abierta a cualquier logueado'
           ELSE '✅ cerrada'
       END                                                    AS estado
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN criticas c ON c.nombre = p.proname
 WHERE n.nspname = 'public'
 ORDER BY has_function_privilege('anon', p.oid, 'EXECUTE') DESC, p.proname;


-- ── 2. El barrido completo: TODA función de public ejecutable por anon ──────
-- Las que se esperan acá son las públicas de verdad (perfil de escuela, QR de
-- inscripción, verificación de carnet). Cualquier otra hay que justificarla.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       CASE WHEN p.prosecdef THEN 'DEFINER — se salta RLS' ELSE 'invoker' END AS seguridad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
   AND p.prokind = 'f'
 ORDER BY p.prosecdef DESC, p.proname;


-- ── 3. Conteo, para comparar antes y después de aplicar la migración ────────
SELECT count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))          AS ejecutables_por_anon,
       count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
                          AND p.prosecdef)                                                AS anon_y_security_definer,
       count(*)                                                                           AS total_funciones
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'f';
