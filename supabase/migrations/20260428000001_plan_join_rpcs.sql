-- =========================================================================
-- 20260428000001 — Plan join RPCs (publicas) para auto-registro por plan.
-- Espejo del flujo team-join (07a/07b/07c) pero usando offering_plans.
--
-- Flujo:
--   1. School admin comparte link /join-plan/:planId
--   2. Usuario (atleta o padre) abre la pagina y carga info via
--      get_plan_join_info
--   3. Ingresa el documento (CC) -> validate_doc_for_plan_join valida que
--      hay un atleta con enrollment activo a ese plan que matchee
--   4. Se registra (auth.signUp) -> claim_member_for_plan vincula el
--      profile al child y crea el school_members con rol 'parent' o
--      'athlete' segun corresponda
-- =========================================================================

-- ---- 1. get_plan_join_info -------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_plan_join_info(p_plan_id uuid)
RETURNS TABLE (
    plan_id        uuid,
    plan_name      text,
    offering_id    uuid,
    offering_name  text,
    school_id      uuid,
    school_name    text,
    branch_id      uuid,
    branch_name    text,
    plan_price     numeric,
    plan_currency  text,
    duration_days  integer,
    max_sessions   integer,
    athletes_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn1$
    SELECT
        op.id,
        op.name,
        o.id,
        o.name,
        op.school_id,
        s.name,
        b.id,
        b.name,
        op.price,
        op.currency,
        op.duration_days,
        op.max_sessions,
        (
            SELECT COUNT(*)::integer
              FROM public.enrollments e
             WHERE e.offering_plan_id = op.id
               AND e.status = 'active'
        )
    FROM public.offering_plans op
    JOIN public.offerings o ON o.id = op.offering_id
    JOIN public.schools   s ON s.id = op.school_id
    LEFT JOIN public.school_branches b ON b.id = o.branch_id
    WHERE op.id = p_plan_id
      AND op.is_active = true;
$fn1$;

GRANT EXECUTE ON FUNCTION public.get_plan_join_info(uuid) TO anon, authenticated;


-- ---- 2. validate_doc_for_plan_join -----------------------------------------
-- Devuelve el child que tenga enrollment activo al plan y cuyo doc_number
-- coincida (ignorando guiones/espacios). Funciona tanto cuando el atleta
-- ingresa SU propio CC (atleta adulto) como cuando el padre ingresa el CC
-- del hijo — ambos casos comparten la misma tabla children.
CREATE OR REPLACE FUNCTION public.validate_doc_for_plan_join(
    p_plan_id    uuid,
    p_doc_number text
)
RETURNS TABLE (
    child_id       uuid,
    full_name      text,
    already_linked boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn2$
    SELECT
        c.id,
        c.full_name,
        c.parent_id IS NOT NULL
    FROM public.children c
    JOIN public.enrollments e
      ON e.child_id = c.id
     AND e.offering_plan_id = p_plan_id
     AND e.status = 'active'
    WHERE regexp_replace(COALESCE(c.doc_number, ''), '[^0-9]', '', 'g')
        = regexp_replace(COALESCE(p_doc_number, ''), '[^0-9]', '', 'g')
      AND p_doc_number IS NOT NULL
      AND p_doc_number <> ''
    LIMIT 1;
$fn2$;

GRANT EXECUTE ON FUNCTION public.validate_doc_for_plan_join(uuid, text) TO anon, authenticated;


-- ---- 3. claim_member_for_plan ----------------------------------------------
-- Vincula al usuario autenticado con el child y registra el school_members
-- con el rol correspondiente ('parent' o 'athlete'). El enrollment al plan
-- ya existe en BD (es lo que validate_doc_for_plan_join hizo match).
--
-- status_code: 'ok' | 'already_linked' | 'not_found' | 'no_auth' | 'invalid_role'
CREATE OR REPLACE FUNCTION public.claim_member_for_plan(
    p_child_id  uuid,
    p_plan_id   uuid,
    p_role      text DEFAULT 'parent',
    p_full_name text DEFAULT NULL,
    p_phone     text DEFAULT NULL
)
RETURNS TABLE (
    status_code     text,
    child_id        uuid,
    school_id       uuid,
    branch_id       uuid,
    offering_plan_id uuid,
    school_name     text,
    plan_name       text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $claim$
    WITH
    role_check AS (
        SELECT (p_role IN ('parent', 'athlete')) AS valid_role
    ),
    role_value AS (
        SELECT
            CASE WHEN p_role IN ('parent', 'athlete')
                 THEN p_role::public.user_role
            END AS profile_role,
            CASE WHEN p_role IN ('parent', 'athlete')
                 THEN p_role::public.member_role
            END AS member_role
        WHERE p_role IN ('parent', 'athlete')
    ),
    child_info AS (
        SELECT
            c.id,
            c.school_id,
            c.branch_id,
            c.parent_id,
            s.name AS school_name,
            op.id   AS plan_id,
            op.name AS plan_name
        FROM public.children c
        JOIN public.schools s        ON s.id = c.school_id
        JOIN public.enrollments e    ON e.child_id = c.id
                                    AND e.offering_plan_id = p_plan_id
                                    AND e.status = 'active'
        JOIN public.offering_plans op ON op.id = e.offering_plan_id
        WHERE c.id = p_child_id
        LIMIT 1
    ),
    updated_child AS (
        UPDATE public.children
           SET parent_id  = auth.uid(),
               updated_at = now()
         WHERE id = p_child_id
           AND auth.uid() IS NOT NULL
           AND (parent_id IS NULL OR parent_id = auth.uid())
           AND EXISTS (SELECT 1 FROM child_info)
           AND EXISTS (SELECT 1 FROM role_check WHERE valid_role)
        RETURNING id
    ),
    updated_profile AS (
        UPDATE public.profiles
           SET full_name  = COALESCE(NULLIF(p_full_name, ''), full_name),
               phone      = COALESCE(NULLIF(p_phone, ''), phone),
               role       = (SELECT profile_role FROM role_value),
               updated_at = now()
         WHERE id = auth.uid()
           AND EXISTS (SELECT 1 FROM updated_child)
           AND EXISTS (SELECT 1 FROM role_value)
        RETURNING id
    ),
    inserted_member AS (
        INSERT INTO public.school_members (school_id, profile_id, branch_id, role, status)
        SELECT ci.school_id, auth.uid(), ci.branch_id, (SELECT member_role FROM role_value), 'active'
        FROM child_info ci
        WHERE EXISTS (SELECT 1 FROM updated_child)
          AND EXISTS (SELECT 1 FROM role_value)
        ON CONFLICT (school_id, profile_id)
        DO UPDATE SET
            branch_id = COALESCE(EXCLUDED.branch_id, public.school_members.branch_id),
            role      = EXCLUDED.role,
            status    = 'active'
        RETURNING school_id
    )
    SELECT
        CASE
            WHEN auth.uid() IS NULL                       THEN 'no_auth'
            WHEN NOT (SELECT valid_role FROM role_check)  THEN 'invalid_role'
            WHEN ci.id IS NULL                            THEN 'not_found'
            WHEN EXISTS (SELECT 1 FROM updated_child)     THEN 'ok'
            ELSE 'already_linked'
        END                       AS status_code,
        ci.id                     AS child_id,
        ci.school_id,
        ci.branch_id,
        ci.plan_id                AS offering_plan_id,
        ci.school_name,
        ci.plan_name
    FROM (
        SELECT * FROM child_info
        UNION ALL
        SELECT NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
               NULL::text, NULL::uuid, NULL::text
        WHERE NOT EXISTS (SELECT 1 FROM child_info)
    ) ci
    LIMIT 1;
$claim$;

GRANT EXECUTE ON FUNCTION public.claim_member_for_plan(uuid, uuid, text, text, text) TO authenticated;
