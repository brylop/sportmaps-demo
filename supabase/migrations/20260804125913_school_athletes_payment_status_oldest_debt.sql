-- =============================================================================
-- 20260804125913_school_athletes_payment_status_oldest_debt.sql
-- Autor: brylop   Fecha: 2026-08-04   Versión anterior: 20260804125644
-- Objetivo: `school_athletes.payment_status` debe decir si el atleta DEBE algo,
--   no cuál fue el último cobro que se le creó.
-- Plan: docs/plan-school-athletes-payment-status.md
-- =============================================================================
-- Recordatorios (CLAUDE.md):
--   · Inmutable: una vez commiteada no se edita ni se borra. Un fix va en una
--     migración NUEVA con timestamp posterior.
--   · Toda CREATE FUNCTION lleva SET search_path = pg_catalog, public, pg_temp.
--     (Acá no se crean funciones.)
--   · GRANT EXECUTE explícito por RPC (SECURITY DEFINER no exime al caller).
--   · Estados/enums en tablas nuevas: text + CHECK, no CREATE TYPE.
--   · Policies de RLS: nunca SELECT sobre la misma tabla en el USING.
-- =============================================================================
--
-- EL DEFECTO
--
-- El lateral que alimenta `payment_status` tomaba el cobro MÁS NUEVO por
-- `created_at`, sin filtrar estados y sin mirar deuda:
--
--     ORDER BY py.created_at DESC LIMIT 1
--
-- Tres consecuencias, las tres medidas en Dynasty el 2026-08-04:
--
--   1. Esconde deuda vieja. Quien debe agosto y paga septiembre sale "Al día"
--      porque la fila de septiembre es más nueva. LAURA SOFIA FAJARDO RINCON
--      tiene 7/2026 pagado y 8/2026 pendiente, y el tablero la daba al día.
--   2. No excluye estados terminales. Al anular 5 cobros duplicados, el contador
--      "OTROS" pasó de 1 a 6 y "AL DÍA" de 73 a 67: cinco atletas que no deben
--      nada quedaron en una categoría inventada, porque su cobro `cancelled` era
--      el más reciente y `getPaymentState` no tiene caso para él.
--   3. `payment_due_date` era del cobro equivocado, así que el veredicto
--      `overdue` (que se deriva de `due_date < hoy`) no se disparaba con el
--      vencimiento más antiguo, que es el único que importa para cobrar.
--
-- No era un problema de datos: con los periodos perfectos, el semáforo seguía
-- mintiendo.
--
-- EL CRITERIO NUEVO
--
--   · Se ignoran los estados terminales (cancelled, rejected, failed).
--   · Si hay deuda (pending, awaiting_approval, overdue, partial, glosado) se
--     expone la de `due_date` MÁS ANTIGUO — la que hay que cobrar, y la que hace
--     que `overdue` se dispare cuando corresponde.
--   · Si no hay deuda, el paid/approved más reciente → "Al día" pasa a significar
--     NO DEBE NADA.
--   · Sin ningún cobro pero con inscripción activa se conserva el fallback
--     'pending'. Deliberado: una inscripción activa sin cobro es un problema, no
--     un "al día" — es el estado exacto en el que JUANA TORRES LEON aparecía al
--     día sin tener mensualidad generada.
--
-- UN SOLO LATERAL, NO DOS
--
-- El desempate va en el ORDER BY del lateral que ya existía. Importa que sea uno:
-- la auditoría de lentitud de 2026-07 encontró que RLS amplifica esta vista unas
-- 3000×, así que un scan extra por atleta se paga caro. Este ORDER BY no agrega
-- scans, solo ordena las mismas filas.
--
-- security_invoker=true SE RESTATEA A PROPÓSITO
--
-- Verificado antes de escribir (`SELECT reloptions FROM pg_class …` → devolvió
-- {security_invoker=true}). CREATE OR REPLACE VIEW no lo hereda. Omitirlo la haría
-- ejecutar con los privilegios del owner, RLS dejaría de filtrar y una escuela
-- vería atletas de otra. No es cosmético.
--
-- LO QUE NO CAMBIA (a propósito)
--
-- Las columnas, su orden y sus tipos quedan idénticos — por eso alcanza CREATE OR
-- REPLACE y no hace falta DROP CASCADE. Las claves de join de cada rama también:
-- en particular la rama de adultos sigue cruzando solo por `py.user_id = pr.id` y
-- NO por `py.parent_id`, aunque existe data legacy con el pagador adulto en
-- `parent_id` (open_month sí la contempla). Ampliar ese join cambiaría a qué
-- atletas les aparece deuda, y eso es una decisión aparte de este arreglo. Queda
-- como limitación conocida.
--
-- LA DEFINICIÓN ANTERIOR, PARA PODER VOLVER
--
-- La vista es deriva no versionada: su cuerpo previo no existía en ningún archivo
-- del repo. Se deja acá, capturado con `pg_get_viewdef('public.school_athletes',
-- true)` el 2026-08-04, porque sin esto la vuelta atrás no tiene fuente. El único
-- fragmento que esta migración modifica es el lateral `pay` de las tres ramas,
-- que antes era, respectivamente:
--
--   -- rama children:
--   LEFT JOIN LATERAL ( SELECT py.status, py.due_date
--          FROM payments py
--         WHERE py.child_id = c.id AND py.school_id = c.school_id
--         ORDER BY py.created_at DESC
--        LIMIT 1) pay ON true
--
--   -- rama adultos:
--   LEFT JOIN LATERAL ( SELECT py.status, py.due_date
--          FROM payments py
--         WHERE py.user_id = pr.id AND py.school_id = sm.school_id
--         ORDER BY py.created_at DESC
--        LIMIT 1) pay ON true
--
--   -- rama no registrados:
--   LEFT JOIN LATERAL ( SELECT py.status, py.due_date
--          FROM payments py
--         WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id
--         ORDER BY py.created_at DESC
--        LIMIT 1) pay ON true
--
-- Todo lo demás (los laterales te/pe/act, el WHERE ua.linked_profile_id IS NULL)
-- se reproduce igual. Vuelta atrás: migración NUEVA con esos tres laterales
-- restaurados — nunca editando este archivo.

BEGIN;

CREATE OR REPLACE VIEW public.school_athletes
WITH (security_invoker = true) AS
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
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE COALESCE(c.monthly_fee, 0::numeric)
        END AS price_monthly,
    pe.plan_name,
    COALESCE(p.full_name, c.parent_name_temp) AS parent_name,
    COALESCE(p.email, c.parent_email_temp) AS parent_email,
    COALESCE(p.phone, c.parent_phone_temp) AS parent_phone,
    COALESCE(b.name, ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(c.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM children c
     LEFT JOIN profiles p ON p.id = c.parent_id
     LEFT JOIN school_branches b ON b.id = c.branch_id
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.child_id = c.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
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
          WHERE py.child_id = c.id AND py.school_id = c.school_id
            AND py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text])
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC,
                   CASE WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])
                        THEN py.due_date END ASC NULLS LAST,
                   py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.child_id = c.id AND e.status = 'active'::text
         LIMIT 1) act ON true
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
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    pr.email AS parent_email,
    pr.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = te.team_branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = sm.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(sm.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM profiles pr
     JOIN school_members sm ON sm.profile_id = pr.id AND sm.role = 'athlete'::text
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly,
            t.branch_id AS team_branch_id
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
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
          WHERE py.user_id = pr.id AND py.school_id = sm.school_id
            AND py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text])
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC,
                   CASE WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])
                        THEN py.due_date END ASC NULLS LAST,
                   py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.user_id = pr.id AND e.school_id = sm.school_id AND e.status = 'active'::text
         LIMIT 1) act ON true
UNION ALL
 SELECT ua.id,
    ua.full_name,
    NULL::text AS avatar_url,
    ua.school_id,
    COALESCE(ua.branch_id, get_single_branch_id(ua.school_id)) AS branch_id,
    NULL::uuid AS team_id,
    ua.date_of_birth,
    ua.is_active,
    'unregistered'::text AS athlete_type,
    NULL::uuid AS parent_id,
    NULL::uuid AS user_id,
    NULL::text AS medical_info,
    te.enrollment_id,
    'active'::text AS enrollment_status,
    te.team_id AS enrolled_team_id,
    pe.offering_plan_id,
    te.start_date AS enrollment_start_date,
    pe.start_date AS plan_start_date,
    COALESCE(
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN 0::numeric
            ELSE COALESCE(te.monthly_fee, te.team_price_monthly, 0::numeric)
        END, 0::numeric) AS team_monthly_fee,
    COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric) AS plan_monthly_fee,
    pe.sessions_used,
    pe.secondary_sessions_used,
    pe.expires_at,
    te.team_name,
    te.team_sport,
        CASE
            WHEN pe.offering_plan_id IS NOT NULL THEN COALESCE(COALESCE(pe.monthly_fee, pe.plan_price), 0::numeric)
            WHEN te.enrollment_id IS NOT NULL THEN COALESCE(COALESCE(te.monthly_fee, te.team_price_monthly), 0::numeric)
            ELSE 0::numeric
        END AS price_monthly,
    pe.plan_name,
    NULL::text AS parent_name,
    ua.email AS parent_email,
    ua.phone AS parent_phone,
    COALESCE(( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = ua.branch_id), ( SELECT sb.name
           FROM school_branches sb
          WHERE sb.id = get_single_branch_id(ua.school_id))) AS branch_name,
    COALESCE(pay.status,
        CASE
            WHEN act.has_active THEN 'pending'::text
            ELSE NULL::text
        END) AS payment_status,
    pay.due_date AS payment_due_date
   FROM unregistered_athletes ua
     LEFT JOIN LATERAL ( SELECT e.id AS enrollment_id,
            e.team_id,
            e.start_date,
            e.monthly_fee,
            t.name AS team_name,
            t.sport AS team_sport,
            t.price_monthly AS team_price_monthly
           FROM enrollments e
             LEFT JOIN teams t ON t.id = e.team_id
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text AND e.team_id IS NOT NULL
          ORDER BY e.created_at
         LIMIT 1) te ON true
     LEFT JOIN LATERAL ( SELECT e.offering_plan_id,
            e.start_date,
            e.monthly_fee,
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
          WHERE py.unregistered_athlete_id = ua.id AND py.school_id = ua.school_id
            AND py.status <> ALL (ARRAY['cancelled'::text, 'rejected'::text, 'failed'::text])
          ORDER BY (py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])) DESC,
                   CASE WHEN py.status = ANY (ARRAY['pending'::text, 'awaiting_approval'::text, 'overdue'::text, 'partial'::text, 'glosado'::text])
                        THEN py.due_date END ASC NULLS LAST,
                   py.created_at DESC
         LIMIT 1) pay ON true
     LEFT JOIN LATERAL ( SELECT true AS has_active
           FROM enrollments e
          WHERE e.unregistered_athlete_id = ua.id AND e.status = 'active'::text
         LIMIT 1) act ON true
  WHERE ua.linked_profile_id IS NULL;

COMMENT ON VIEW public.school_athletes IS
  'Roster unificado de atletas de una escuela (menor / adulto / no registrado) con equipo, plan, sede, acudiente y estado de pago. `payment_status` = la DEUDA MÁS ANTIGUA sin saldar, ignorando cancelled/rejected/failed; si no hay deuda, el pago más reciente. "paid" significa NO DEBE NADA. `payment_due_date` acompaña a ese mismo cobro, para que el veredicto overdue se derive del vencimiento más viejo. security_invoker=true: la vista respeta las policies del caller — NO quitar, o una escuela ve atletas de otra.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ── Verificación después de aplicar ────────────────────────────────────────
--
-- 1) security_invoker sigue puesto. SI ESTO SALE VACÍO, REVERTIR YA: la vista
--    quedó corriendo como owner y RLS no está filtrando por escuela.
--
--    SELECT c.relname, c.reloptions
--      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relname = 'school_athletes'
--
--    Esperado: {security_invoker=true}
--
-- 2) Los 5 buckets del tablero. "OTROS" debería quedar en 0 o cerca — era casi
--    todo estados terminales:
--
--    SELECT payment_status, count(*)
--      FROM public.school_athletes
--     WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226' AND is_active
--     GROUP BY 1 ORDER BY 2 DESC
--
-- 3) Los tres atletas con deuda escondida (medidos ANTES de aplicar) deben pasar
--    a 'pending' con el vencimiento del cobro VIEJO, no del nuevo:
--
--    SELECT full_name, payment_status, payment_due_date
--      FROM public.school_athletes
--     WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--       AND full_name IN ('LAURA SOFIA FAJARDO RINCON','Mariangel Morales Vargas','SARA PRIOLO GALEANO')
--
--    Esperado: LAURA → pending / 2026-08-10 (su agosto real).
--              Mariangel y SARA → pending / 2026-09-10 (septiembre espurio del
--              bug del alta; su arreglo es limpieza de datos, no la vista).
--
-- 4) Los 5 de cobro anulado deben volver a 'paid', no quedarse en 'cancelled':
--
--    SELECT full_name, payment_status FROM public.school_athletes
--     WHERE school_id = '2d509571-3238-4c04-ac3f-6dfe20539226'
--       AND full_name ILIKE ANY (ARRAY['%Anna Isabella Forero%','%HELLEN VALENTINA%',
--                                      '%Linda Saray%','%Luciana Sandoval%','%Maria Gabriela Medina%'])
--
-- 5) Y JUANA TORRES LEON → pending / 2026-08-10.
--
-- Vuelta atrás: migración NUEVA con los tres laterales `pay` del encabezado.
