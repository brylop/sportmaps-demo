-- ============================================================================
-- SportMaps — Verificación del bloqueo por fin de prueba (solo LECTURA)
--
-- Fecha: 2026-08-12
-- Pegar en el SQL Editor de Supabase. No escribe nada.
--
-- Cubre lo que NO se puede ver desde PostgREST con la service key: el catálogo
-- (pg_class / pg_policy / cron.job). El estado de las escuelas sí se puede leer
-- por REST y ya está validado — ver el resumen en
-- docs/periodo-de-prueba-aviso-y-bloqueo-2026-08-12.md
-- ============================================================================


-- ── 1. ¿Las piezas quedaron creadas? ────────────────────────────────────────
SELECT p.proname                                   AS funcion,
       CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS seguridad,
       pg_get_function_identity_arguments(p.oid)   AS argumentos,
       CASE WHEN array_to_string(p.proconfig, ',') LIKE '%search_path%'
            THEN 'ok' ELSE '⚠ SIN search_path' END AS search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('school_is_operational','is_informational_entity','expire_trials',
                     'admin_set_trial','admin_extend_trial','admin_expire_trial_now',
                     'admin_set_blocking_exempt','admin_set_account_type',
                     'admin_reactivate_school','admin_list_trials',
                     'create_default_school_subscription')
 ORDER BY p.proname;


-- ── 2. ¿El cron quedó agendado? ─────────────────────────────────────────────
-- Debe aparecer expire-trials-daily a las 10 9 * * * y active = true.
SELECT jobname, schedule, active, command
  FROM cron.job
 WHERE jobname = 'expire-trials-daily';


-- ── 3. ¿Qué tablas quedaron cubiertas por el bloqueo en RLS? ────────────────
-- Correr DESPUÉS de aplicar 20260813170813_bloqueo_de_prueba_en_rls.sql.
--
-- estado = 'DESCUBIERTA — RLS apagado' significa que ahí el bloqueo NO aplica:
-- una policy sobre una tabla sin RLS no hace nada. No encender RLS a la ligera:
-- sin permissive previas, la tabla queda denegando todo.
SELECT c.relname                                                       AS tabla,
       c.relrowsecurity                                                AS rls_encendido,
       count(p.polname) FILTER (WHERE p.polname LIKE 'trial_block_%')  AS policies_trial,
       count(p.polname)                                                AS policies_totales,
       CASE
           WHEN NOT c.relrowsecurity THEN 'DESCUBIERTA — RLS apagado'
           WHEN count(p.polname) FILTER (WHERE p.polname LIKE 'trial_block_%') = 3 THEN 'OK'
           ELSE 'REVISAR'
       END                                                             AS estado
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
 WHERE n.nspname = 'public'
   AND c.relname = ANY (ARRAY[
        'payments','enrollments','expenses','teams','team_coaches','team_branches',
        'school_branches','invitations','notifications','products','academic_progress',
        'athlete_id_card_templates','payment_reminder_logs','school_settings'
   ])
 GROUP BY c.relname, c.relrowsecurity
 ORDER BY c.relrowsecurity, c.relname;


-- ── 4. Prueba real del bloqueo: ¿la policy deja pasar o no? ─────────────────
-- No basta con que la policy exista; hay que ver qué responde para una escuela
-- bloqueada y para una exenta. Esto evalúa la MISMA expresión que usa la policy.
SELECT s.name                                AS escuela,
       s.account_type,
       ss.status,
       ss.blocking_exempt,
       public.school_is_operational(s.id)    AS puede_escribir,
       CASE WHEN public.school_is_operational(s.id)
            THEN 'escribe normal' ELSE 'BLOQUEADA (solo lectura)' END AS efecto
  FROM public.schools s
  LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
 WHERE s.name ILIKE ANY (ARRAY['%DYNASTY%','%GYM RM%','%patinaje real bogota%',
                               '%BLAIR TEAM TRAINING%','%SPIRIT ALL STARS%'])
 ORDER BY puede_escribir DESC, s.name;


-- ── 5. Resumen: qué ve cada escuela ─────────────────────────────────────────
SELECT CASE
           WHEN public.is_informational_entity(s.school_type)  THEN '0. Entidad del mapa (no aplica)'
           WHEN NOT public.school_is_operational(s.id)         THEN '1. INHABILITADA (solo lectura)'
           WHEN COALESCE(ss.blocking_exempt, false)            THEN '2. AVISO sin bloqueo (exenta)'
           WHEN s.account_type <> 'real'                       THEN '3. Cuenta nuestra (sin aviso)'
           WHEN ss.trial_ends_at::date = (now() AT TIME ZONE 'America/Bogota')::date
                                                               THEN '4. AVISO: vence hoy'
           WHEN ss.trial_ends_at > now()                       THEN '5. AVISO: contador corriendo'
           ELSE '6. Sin aviso (plan activo)'
       END        AS lo_que_ve,
       count(*)   AS escuelas
  FROM public.schools s
  LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
 GROUP BY 1
 ORDER BY 1;


-- ── 6. Cuentas de prueba tuyas marcadas como cliente real ───────────────────
-- Si una escuela tuya sigue en account_type='real', el cron la bloquea igual.
-- Se corrige desde el panel de super admin (selector Cliente/Pruebas/Demo).
SELECT s.name, p.email AS owner, s.account_type,
       ss.status, ss.trial_ends_at::date AS vence,
       public.school_is_operational(s.id) AS puede_escribir
  FROM public.schools s
  LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
  LEFT JOIN public.profiles p ON p.id = s.owner_id
 WHERE s.account_type = 'real'
   AND (s.name ILIKE '%prueba%' OR s.name ILIKE '%test%' OR s.name ILIKE '%demo%'
        OR p.email ILIKE '%spoortmaps%' OR p.email ILIKE '%sportmaps%')
 ORDER BY s.name;
