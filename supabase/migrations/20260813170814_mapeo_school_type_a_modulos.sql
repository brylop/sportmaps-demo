-- ============================================================================
-- SPORTMAPS — v_school_entitlements: mapear los school_type que existen de verdad
--
-- Fecha: 2026-08-12
--
-- El problema: la vista deriva has_academy / has_reservations / has_wallet de
-- `schools.school_type`, pero solo conoce tres valores ('academy','venue',
-- 'hybrid'). La base tiene ocho:
--
--   academy 117 · club 83 · federation 79 · institute 62 · personal_trainer 11
--   association 10 · escuela 1 · gimnasio 1
--
-- Resultado medido hoy: **has_academy = false en 247 escuelas**, entre ellas
-- 83 clubes, 11 entrenadores personales (5 con atletas activos) y el gimnasio.
-- O sea: escuelas que están usando el módulo de academia todos los días
-- aparecen como si no lo tuvieran. No explota hoy porque EntitlementGate está
-- montado en una sola página, pero deja el gating apoyado en un dato falso —
-- y la demo insignia (Club Campestre, school_type='club') sale sin academia
-- Y sin reservas.
--
-- ── Criterio ────────────────────────────────────────────────────────────────
-- has_academy      → todo lo que opera como escuela: academy, hybrid, club,
--                    escuela, gimnasio, personal_trainer y NULL.
-- has_reservations → SOLO venue, hybrid y gimnasio. Deliberadamente NO se
--   /has_wallet       incluye `club`: prender Reservas y Wallet a 83 clubes
--                    reales que nunca lo pidieron es un cambio de producto,
--                    no un arreglo de datos. El club que quiera Reservas se
--                    pasa a 'hybrid' — que es justo lo que hacen las demos.
-- Entidades informativas (institute/federation/association) quedan en false:
--                    no son clientes SaaS (ver 20260812150627).
--
-- ⚠ CREATE OR REPLACE VIEW no deja reordenar ni renombrar columnas (42P16).
--   Las 30 columnas van en el MISMO orden que dejó 20260812125503; acá solo
--   cambian TRES expresiones.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.v_school_entitlements
WITH (security_invoker = true) AS
SELECT
    s.id                                                                AS school_id,
    s.school_type,
    COALESCE(sub.plan_code, 'starter')                                  AS plan_code,
    COALESCE(sub.tier, 'free')                                          AS tier,
    COALESCE(sub.status, 'trialing')                                    AS subscription_status,
    COALESCE(sub.trial_ends_at, s.created_at + interval '1 month')      AS trial_ends_at,
    sub.current_period_start,
    sub.current_period_end,
    sub.billing_cycle,

    -- ── Las tres que cambian ────────────────────────────────────────────────
    (s.school_type IS NULL OR s.school_type IN (
        'academy','hybrid','club','escuela','gimnasio','personal_trainer'
    ))                                                                  AS has_academy,
    (s.school_type IN ('venue','hybrid','gimnasio'))                    AS has_reservations,
    (s.school_type IN ('venue','hybrid','gimnasio'))                    AS has_wallet,

    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'tournaments'    AND a.enabled) AS has_tournaments,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'access_control' AND a.enabled) AS has_access_control,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'biomech'        AND a.enabled) AS has_biomech,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'nutrition'      AND a.enabled) AS has_nutrition,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whitelabel'     AND a.enabled) AS has_whitelabel,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'whatsapp'       AND a.enabled) AS has_whatsapp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'wompi'          AND a.enabled) AS has_wompi,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'mp'             AND a.enabled) AS has_mp,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'store'          AND a.enabled) AS has_store,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'accounting'     AND a.enabled) AS has_accounting,
    EXISTS (SELECT 1 FROM public.school_addons a WHERE a.school_id = s.id AND a.addon_key = 'invoicing'      AND a.enabled) AS has_invoicing,

    s.created_at                                                        AS school_created_at,
    s.account_type,
    (sub.school_id IS NOT NULL)                                         AS has_subscription_row,
    sub.trial_months,
    COALESCE(sub.blocking_exempt, false)                                AS blocking_exempt,
    sub.blocking_exempt_reason,
    public.school_is_operational(s.id)                                  AS is_operational
FROM public.schools s
LEFT JOIN public.school_subscriptions sub ON sub.school_id = s.id;

COMMENT ON VIEW public.v_school_entitlements IS
    'Entitlements por escuela. has_academy cubre los 8 school_type reales de la base '
    '(antes solo academy/hybrid, dejando en false a 247 escuelas que sí operan como escuela). '
    'has_reservations/has_wallet siguen siendo opt-in: venue, hybrid y gimnasio — un club que '
    'quiera Reservas se pasa a hybrid. Incluye el estado del periodo de prueba (trial_ends_at, '
    'is_operational, blocking_exempt, account_type).';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────────────
-- Verificación: cuántas escuelas ganan academia y quién queda con reservas.
-- ────────────────────────────────────────────────────────────────────────────
SELECT school_type,
       count(*)                                  AS escuelas,
       bool_or(has_academy)                      AS academia,
       bool_or(has_reservations)                 AS reservas
  FROM public.v_school_entitlements
 GROUP BY school_type
 ORDER BY count(*) DESC;
