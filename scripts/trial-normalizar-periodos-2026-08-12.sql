-- ============================================================================
-- SportMaps — Normalizar el periodo de prueba del parque (2026-08-12)
--
-- Requisito: aplicar PRIMERO las dos migraciones, en orden:
--   1. 20260812125503_periodo_de_prueba_aviso_y_bloqueo.sql
--   2. 20260812150627_entidades_informativas_no_se_bloquean.sql
--
-- Por qué hace falta: hoy el dato no sirve para disparar nada. Auditado con
-- scripts/audit-trial-2meses-2026-08-12.mjs sobre 364 escuelas:
--   · 178 quedaron en status='active' tras un UPDATE masivo del 2026-07-21.
--   · 151 no tienen fila en school_subscriptions.
--   · trial_ends_at está vencido en casi todas (Dynasty 2026-06-27, patinaje 2026-07-04)
--     porque se calculó con now()+30d el día del backfill, no desde el registro.
--
-- Regla acordada: la prueba se cuenta desde schools.created_at y duró 2 meses
-- para el parque actual (el registro nuevo ya nace con 1 mes, vía trigger).
--
-- Quién NO se inhabilita (decisión del dueño, 2026-08-12): Dynasty (PASO 4),
-- las cuentas demo/pruebas (por account_type, ya excluidas en todos los pasos) y
-- GYM RM (PASO 5, pendiente de validar con el cliente). Todas ellas ven el aviso.
-- El resto de las vencidas quedan INHABILITADAS, y para TODOS sus usuarios por
-- igual — incluidos los padres, que tampoco podrán pagar mientras esté bloqueada.
--
-- ⚠ ORDEN DE EJECUCIÓN: los pasos 0 y 1 son de lectura. Del 2 al 5 escriben.
--    Corre el PASO 5 en la misma ventana que el 3: si no, GYM RM queda cortada
--    entre uno y otro.
--
-- Todo es reversible: no se borra nada, solo se fija trial_ends_at / status /
-- blocking_exempt, y el super admin puede cambiarlos desde el panel.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 0 (LECTURA) — ¿qué va a pasar? Corre esto y revisa antes de escribir.
-- ────────────────────────────────────────────────────────────────────────────
WITH uso AS (
    SELECT s.id AS school_id,
           (SELECT count(*) FROM public.enrollments e
             WHERE e.school_id = s.id AND e.status IN ('active','paid'))          AS insc_activas,
           (SELECT count(*) FROM public.payments p
             WHERE p.school_id = s.id AND p.status IN ('paid','partial'))         AS cobros_pagados,
           (SELECT COALESCE(sum(p.amount), 0) FROM public.payments p
             WHERE p.school_id = s.id AND p.status IN ('paid','partial'))         AS recaudado
      FROM public.schools s
), clasificado AS (
    SELECT s.id, s.name, s.created_at, s.account_type,
           COALESCE(ss.status, '(sin fila)')                  AS status_actual,
           s.created_at + interval '2 months'                 AS fin_prueba,
           (u.insc_activas > 0 OR u.cobros_pagados > 0)       AS en_uso,
           u.insc_activas, u.recaudado,
           CASE
               WHEN s.account_type <> 'real'                              THEN 'EXENTA · cuenta nuestra'
               WHEN ss.status = 'grandfathered'                           THEN 'EXENTA · grandfathered (G-PAGA)'
               WHEN s.id = '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid   THEN 'EXENTA · Dynasty (avisa, no bloquea)'
               WHEN (s.created_at + interval '2 months') > now()           THEN 'AVISO · le queda tiempo'
               WHEN (u.insc_activas > 0 OR u.cobros_pagados > 0)          THEN 'DECISIÓN · vencida pero EN USO'
               ELSE 'BLOQUEAR · vencida y dormida'
           END AS destino
      FROM public.schools s
      LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
      JOIN uso u ON u.school_id = s.id
)
SELECT destino, count(*) AS escuelas,
       sum(insc_activas) AS inscripciones_activas,
       sum(recaudado)    AS recaudado_total
  FROM clasificado
 GROUP BY destino
 ORDER BY 2 DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 1 (LECTURA) — el detalle de las que están EN USO y vencidas.
-- Son las que quedan inhabilitadas (menos GYM RM, exenta en el PASO 5). Vale
-- leerlas antes: son clubes operando hoy, y sus padres tampoco podrán pagar.
-- ────────────────────────────────────────────────────────────────────────────
SELECT s.name,
       s.created_at::date                        AS registro,
       (s.created_at + interval '2 months')::date AS fin_prueba,
       COALESCE(ss.status, '(sin fila)')          AS status,
       p.email                                    AS owner,
       (SELECT count(*) FROM public.enrollments e
         WHERE e.school_id = s.id AND e.status IN ('active','paid'))     AS insc_activas,
       (SELECT COALESCE(sum(pa.amount), 0) FROM public.payments pa
         WHERE pa.school_id = s.id AND pa.status IN ('paid','partial'))  AS recaudado
  FROM public.schools s
  LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
  LEFT JOIN public.profiles p               ON p.id = s.owner_id
 WHERE s.account_type = 'real'
   AND COALESCE(ss.status, 'trialing') <> 'grandfathered'
   AND s.id <> '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid
   AND (s.created_at + interval '2 months') <= now()
   AND EXISTS (SELECT 1 FROM public.enrollments e
                WHERE e.school_id = s.id AND e.status IN ('active','paid'))
 ORDER BY recaudado DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 2 — ANULADO. No corras nada acá.
--
-- La idea era crear la fila de suscripción a las 151 escuelas que no la tenían.
-- Al intentarlo saltó el trigger `prevent_gov_entity_subscription()`:
--
--   ERROR: No se permite crear subscriptions en entidades no-SaaS
--          (institute/federation/association/facility)
--
-- Y tenía razón. Las 151 sin suscripción son EXACTAMENTE esas entidades
-- informativas del mapa: 79 federation + 62 institute + 10 association = 151.
-- Ninguna escuela SaaS real está sin fila, así que no hay nada que crear.
--
-- Lo que sí hacía falta —que a esas entidades no se les aplique el bloqueo—
-- se resolvió en la migración 20260812150627_entidades_informativas_no_se_bloquean.sql.
-- Aplícala antes de seguir con el PASO 3.
-- ────────────────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 3 (ESCRIBE) — fijar la fecha real: registro + 2 meses.
--
-- Excluye grandfathered (gate G-PAGA: quien ya venía no cambia de trato),
-- cancelled y las que ya tienen un plan comercial 'active' de verdad… salvo que
-- ese 'active' venga del UPDATE masivo del 2026-07-21 sin proveedor de pago,
-- que es el caso de las 178 y NO significa "cliente pagando".
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.school_subscriptions ss
   SET trial_ends_at = s.created_at + interval '2 months',
       trial_months  = 2,
       status        = CASE
                          WHEN (s.created_at + interval '2 months') > now() THEN 'trialing'
                          ELSE 'trial_expired'
                       END,
       metadata      = ss.metadata || jsonb_build_object(
                          'via', 'normalizacion_trial_2026_08_12',
                          'status_anterior', ss.status,
                          'trial_ends_at_anterior', to_jsonb(ss.trial_ends_at)),
       updated_at    = now()
  FROM public.schools s
 WHERE ss.school_id = s.id
   AND s.account_type = 'real'
   AND ss.status NOT IN ('grandfathered', 'cancelled')
   -- Guard a futuro: hoy no excluye a nadie (0 de 213 suscripciones tienen
   -- payment_provider), pero evita pisar la primera escuela que conecte pasarela
   -- si este script se vuelve a correr más adelante.
   AND ss.payment_provider IS NULL
   AND ss.school_id <> '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid;  -- Dynasty va en el paso 4


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 4 (ESCRIBE) — Dynasty: "vence hoy" y NUNCA se bloquea.
--
-- Se registró el 2026-06-13, así que por la regla vencía el 2026-08-13. Se
-- adelanta al cierre de HOY para que el owner vea "vence hoy", y se marca
-- blocking_exempt para que el cron de mañana la deje en trial_expired (verdad
-- del estado) sin cortarle el acceso (consecuencia neutralizada).
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.school_subscriptions
   SET trial_ends_at          = date_trunc('day', now() AT TIME ZONE 'America/Bogota')
                                + interval '23 hours 59 minutes',
       trial_months           = 2,
       status                 = 'trialing',
       blocking_exempt        = true,
       blocking_exempt_reason = 'En uso real (457 atletas activos, 31.8M recaudados). '
                                || 'Avisar al owner, no bloquear, hasta cerrar el plan comercial.',
       metadata               = metadata || jsonb_build_object(
                                   'via', 'normalizacion_trial_2026_08_12',
                                   'decision', 'aviso_sin_bloqueo'),
       updated_at             = now()
 WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'::uuid;


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 5 (ESCRIBE) — GYM RM: aviso sin bloqueo, pendiente de validar.
--
-- Decisión del dueño del producto (2026-08-12): la ÚNICA exención además de
-- Dynasty y las cuentas demo. Se valida con el cliente hoy; hasta entonces no
-- se le corta (126 atletas activos, 6.8M recaudados).
--
-- El resto de las vencidas en uso (THE BLAIR TEAM, Felipe Rincón,
-- SPIRIT ALL STARS, ORIGINAL BOXING STYLE y las demás) quedan INHABILITADAS
-- por decisión explícita: el PASO 3 ya las dejó en trial_expired y el bloqueo
-- aplica solo. Si alguna hay que soltarla después, es un botón en el panel
-- (admin_set_blocking_exempt) — no hace falta SQL.
-- ────────────────────────────────────────────────────────────────────────────
UPDATE public.school_subscriptions
   SET blocking_exempt        = true,
       blocking_exempt_reason = 'Aviso sin bloqueo — validación comercial en curso (2026-08-12)',
       metadata               = metadata || jsonb_build_object('via', 'exencion_gymrm_2026_08_12'),
       updated_at             = now()
 WHERE school_id = '2137182d-a695-4695-8e5a-61151fc59196'::uuid;   -- GYM RM


-- ────────────────────────────────────────────────────────────────────────────
-- PASO 6 (LECTURA) — verificación. Esto es lo que va a ver cada escuela.
-- ────────────────────────────────────────────────────────────────────────────
SELECT
    CASE
        WHEN NOT public.school_is_operational(s.id)                      THEN '1. BLOQUEADA (solo lectura)'
        WHEN ss.blocking_exempt                                          THEN '2. AVISO sin bloqueo (exenta)'
        WHEN ss.trial_ends_at::date = (now() AT TIME ZONE 'America/Bogota')::date THEN '3. AVISO: vence hoy'
        WHEN ss.trial_ends_at > now()                                    THEN '4. AVISO: contador corriendo'
        ELSE '5. Sin aviso (plan activo / cuenta nuestra)'
    END AS lo_que_ve_el_owner,
    count(*) AS escuelas
  FROM public.schools s
  LEFT JOIN public.school_subscriptions ss ON ss.school_id = s.id
 GROUP BY 1
 ORDER BY 1;
