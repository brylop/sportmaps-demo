-- ============================================================================
-- SEG-15 Fase B — Inspección previa. NO modifica nada.
--
-- Las policies RESTRICTIVE de la Fase A (20260813170813) no alcanzan a los RPC
-- `SECURITY DEFINER`: esos corren como su dueño y saltan RLS, así que una
-- escuela vencida todavía inscribe gente y genera cobros por esa vía.
--
-- Para ponerles el guard hay que hacer CREATE OR REPLACE, y eso reemplaza el
-- cuerpo entero. Hoy ya se vio dos veces que el repo y la base no coinciden
-- (INF-1), así que primero se mira lo que está VIVO.
--
-- Corré esto y pegame el resultado. Con eso escribo la migración contra el
-- cuerpo real y no contra lo que el repo supone.
-- ============================================================================

SELECT p.proname                                        AS funcion,
       pg_get_function_identity_arguments(p.oid)        AS firma,
       p.prosecdef                                      AS es_definer,
       p.proconfig                                      AS config,
       pg_get_userbyid(p.proowner)                      AS duenio,
       -- ¿ya menciona el guard?
       (p.prosrc LIKE '%school_is_operational%')        AS ya_tiene_guard,
       length(p.prosrc)                                 AS largo_cuerpo,
       -- El repo tiene una version de cada una; esto dice si coinciden en tamanio
       md5(p.prosrc)                                    AS huella
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
        'submit_qr_signup',
        'generate_qr_monthly_charge',
        'create_school_join_qr',
        'create_invitation',
        'request_athlete_certificate',
        'issue_athlete_certificate',
        'notify_user'
   )
 ORDER BY p.proname;

-- ── El cuerpo de las dos que más importan ───────────────────────────────────
-- `submit_qr_signup` inscribe personas y `generate_qr_monthly_charge` crea
-- cartera: son las dos por las que una escuela bloqueada sigue operando.
SELECT p.proname,
       pg_get_functiondef(p.oid) AS definicion_completa
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('submit_qr_signup', 'generate_qr_monthly_charge')
 ORDER BY p.proname;
